// api/check-gmail.js
require('dotenv').config({ path: '../../.env' }); // Load .env file for Vercel
const { google } = require('googleapis');
const cheerio = require('cheerio');
const { sendWhatsAppMessage } = require('../utils/sendWhatsApp');
const { sendEmail } = require('../utils/sendEmail'); // Use updated sender with HTML templates

// --- Google API Authentication ---

// 1. Auth for Google Sheets (Service Account)
const sheetsAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'), // Added optional chaining for safety
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// 2. Auth for Gmail (OAuth 2.0)
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// Initialize API clients globally
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });


// --- Email Parsing Function (Handles Both Types & Company Name) ---
function parseIndiaMartEmail(htmlBody, subject, fromAddress) {
  try {
    const $ = cheerio.load(htmlBody);
    let lead = { name: '', company: '', email: '', phone: '', product: '', message: '' };
    const isBuyLead = fromAddress.includes('buyleads@indiamart.com');
    const isEnquiry = fromAddress.includes('buyershelpdesk@indiamart.com') || fromAddress.includes('buyershelp+enq@indiamart.com');

    if (isBuyLead) {
      // console.log("Parsing as Buy Lead..."); // Keep logs minimal for production
      lead.product = $('div[style*="font-size:18px"] strong').first().text().trim();
      const contactBlock = $('a[href*="call+"]').closest('div');
      if (!contactBlock.length) { console.warn('Buy Lead: No contact block.'); return null; }
      const contactHtml = contactBlock.html();
      const contactLines = contactHtml.split(/<br\s*\/?>/i).map(line => $('<div>'+line+'</div>').text().trim());
      lead.name = contactLines[0] || '';
      if (contactLines.length > 1) {
          let potentialCompany = contactLines[1].replace(/,\s*\w{2}\s*$/i, '').replace(/\s*-\s*\d{6,}\s*$/,'').trim();
          if (potentialCompany && potentialCompany.toLowerCase() !== 'india' && !/^\d+$/.test(potentialCompany)) { lead.company = potentialCompany; }
      }
      lead.phone = contactBlock.find('a[href*="call+"]').first().text().replace(/[^0-9]/g, '');
      lead.email = contactBlock.find('a[href*="mailto:"]').first().text().trim();
      let message = '';
      let reqTable = $('strong:contains("Quantity")').closest('table');
      if (!reqTable.length) reqTable = $('strong:contains("Width")').closest('table');
      if (!reqTable.length) reqTable = $('strong:contains("Thickness")').closest('table');
      reqTable.find('tr').each((i, el) => {
          const key = $(el).find('strong').first().text().trim().replace(':', '');
          const value = $(el).find('td').last().text().trim();
          if (key && value && value !== ':') { message += `${key}: ${value}\n`; }
      });
      lead.message = message.trim();
    } else if (isEnquiry) {
      // console.log("Parsing as Enquiry..."); // Keep logs minimal
      lead.product = $('p:contains("I am looking for") b').first().text().trim();
      if (!lead.product) { lead.product = $('p:contains("I need") b').first().text().trim(); }
      if (!lead.product) {
          const subjectMatch = subject.match(/Enquiry for (.*?) from/i);
          if (subjectMatch?.[1]) { lead.product = subjectMatch[1].split(',')[0].trim(); }
      }
      let message = '';
       $('span:contains("Below are the requirement details")').closest('tr').find('table tr').each((i, row) => {
           const cells = $(row).find('td');
           if (cells.length >= 3) {
               const key = $(cells[0]).text().trim().replace(':', '');
               const value = $(cells[2]).text().trim();
               if (key && value) { message += `${key}: ${value}\n`; }
           }
       });
       lead.message = message.trim();
      const regardsTable = $('td:contains("Regards")').closest('table');
      if (regardsTable.length) {
          const nameRow = regardsTable.find('span:contains("Regards")').closest('tr').nextAll('tr').first();
          lead.name = nameRow.find('td > span').first().text().trim();
          const companyRow = nameRow.next('tr');
          const companyText = companyRow.find('span').text().trim();
          if (companyText && !companyText.startsWith('Click to call:') && !companyText.startsWith('Email:') && !companyText.includes('verified')) {
              lead.company = companyText.split(',')[0].trim();
              if (lead.company.toLowerCase() === 'india' || /^\d+$/.test(lead.company) ) lead.company = '';
          }
          lead.phone = regardsTable.find('a[href*="call+"]').first().text().replace(/[^0-9]/g, '');
          lead.email = regardsTable.find('a[href*="mailto:"]').first().text().split(' ')[0].trim();
      } else { console.warn("Enquiry: Could not find 'Regards' section."); return null; }
    } else { console.warn(`Unknown email format from: ${fromAddress}.`); return null; }

    if (!lead.product) { console.warn('Could not parse Product. Skipping.'); return null; }
    if (!lead.name || !lead.phone || !lead.email) { console.warn('Could not parse Name/Phone/Email. Skipping.'); return null; }
    if (lead.phone && !lead.phone.startsWith('91') && lead.phone.length >= 10) { lead.phone = `91${lead.phone.slice(-10)}`; }
    else if (lead.phone && lead.phone.length < 10) { console.warn(`Phone ${lead.phone} too short. Skipping.`); return null; }

    // console.log("Parsed Lead:", JSON.stringify(lead)); // Optional: Keep for detailed production logs if needed
    return lead;
  } catch (error) { console.error(`CRITICAL Error parsing HTML (Subject: ${subject}):`, error); return null; }
}


// --- getEmailBody function (Cleaned - No Debugging) ---
function getEmailBody(message) {
  let bodyData = '';
  const payload = message.payload;
  if (!payload) return null;

  // Function to find the HTML part recursively
  const findHtmlPart = (parts) => {
    if (!parts) return null;
    for (let part of parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        return part.body.data;
      }
      if (part.parts) {
        const nestedData = findHtmlPart(part.parts);
        if (nestedData) return nestedData;
      }
    }
    return null;
  };

  // --- Extraction Logic ---
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    bodyData = payload.body.data;
  } else if (payload.parts) {
    bodyData = findHtmlPart(payload.parts);
  } else if (payload.body?.data) { // Fallback
       bodyData = payload.body.data;
  }

  if (!bodyData) {
       console.warn("getEmailBody: Could not extract body data.");
      return null;
  }

  // Decode Base64
  try {
      const cleanedData = bodyData.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(cleanedData, 'base64').toString('utf-8');
  } catch(e){
      console.error("getEmailBody: Error decoding base64:", e);
      return null;
  }
}


// --- Main Serverless Function (Restored for Vercel) ---
module.exports = async (req, res) => {
  try {
    console.log('Cron job started: Checking for new emails...');

    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread {from:buyleads@indiamart.com from:buyershelpdesk@indiamart.com from:buyershelp+enq@indiamart.com} subject:film',
    });

    const messages = listResponse.data.messages;
    if (!messages || messages.length === 0) {
      console.log('No new emails found matching the criteria.');
      return res.status(200).send('No new emails found.'); // Send response for Vercel
    }

    console.log(`Found ${messages.length} new email(s). Processing...`);
    const leadsAdded = [];
    const leadsFailed = [];

    // Process ALL found messages
    for (const msg of messages) {
      let subject = ''; let fromAddress = ''; let msgId = msg.id;
      try {
        const msgResponse = await gmail.users.messages.get({
            userId: 'me',
            id: msgId,
            format: 'full' // Request full details
        });

        if (!msgResponse.data?.payload?.headers) {
             console.warn(`Could not get sufficient details for email ID: ${msgId}. Skipping.`);
             leadsFailed.push(msgId + " (Incomplete)");
             continue;
         }

        const headers = msgResponse.data.payload.headers;
        subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
        fromAddress = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';
        // console.log(`Processing Email ID: ${msgId}, Subject: ${subject}`); // Optional log

        const htmlBody = getEmailBody(msgResponse.data);
        if (!htmlBody) {
             console.warn(`Could not extract/decode body for email ID: ${msgId}. Skipping.`);
             leadsFailed.push(msgId + " (No body)");
             // Mark as read to avoid retrying emails with bad bodies
             await gmail.users.messages.modify({ userId: 'me', id: msgId, resource: { removeLabelIds: ['UNREAD'] } });
             continue;
        }

        const lead = parseIndiaMartEmail(htmlBody, subject, fromAddress);
        if (!lead) {
          console.warn(`Could not parse details from email ID: ${msgId}. Skipping.`);
          leadsFailed.push(msgId + " (Parsing failed)");
          // Mark as read to avoid retrying unparseable emails
          await gmail.users.messages.modify({ userId: 'me', id: msgId, resource: { removeLabelIds: ['UNREAD'] } });
          console.log(`Marked unparseable email ${msgId} as read.`);
          continue; // Skip further processing if parsing failed
        }

        // --- UNCOMMENTED Actions ---
        // Add to Google Sheets
        const sheetName = 'Leads'; // !! Change this to your Sheet's tab name !!
        const newRow = [
          new Date().toISOString(), // A: Timestamp
          lead.name,                // B: Name
          lead.company,             // C: Company
          lead.phone,               // D: Phone
          lead.email,               // E: Email
          lead.product,             // F: Product
          lead.message,             // G: Requirements
          'New Lead',               // H: Status
        ];
        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEET_ID, range: `${sheetName}!A1`, valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', resource: { values: [newRow] },
        });
        console.log(`Added lead to Google Sheets: ${lead.name} (ID: ${msgId})`);
        leadsAdded.push(lead.name);

        // Send Welcome Messages
        await sendWhatsAppMessage(lead.phone, 'welcome', [ { type: 'body', parameters: [{ type: 'text', text: lead.name }] } ]);
        await sendEmail(lead.email, lead.name, 'welcome', lead.product, lead.message);

        // Mark email as read
        await gmail.users.messages.modify({ userId: 'me', id: msgId, resource: { removeLabelIds: ['UNREAD'] } });
        console.log(`Marked processed email ${msgId} as read.`);
        // --- End UNCOMMENTED Actions ---

      } catch(error) {
           console.error(`Error processing email ID: ${msgId} (Subject: ${subject}):`, error.message);
           leadsFailed.push(msgId + ` (Error: ${error.message.substring(0, 50)}...)`);
           // Consider not marking as read on error to allow retry, especially for API errors
      }
    } // End loop

    let responseMessage = `Successfully processed ${leadsAdded.length} leads: ${leadsAdded.join(', ')}.`;
    if (leadsFailed.length > 0) {
        responseMessage += ` Failed ${leadsFailed.length} emails. IDs/Reasons: ${leadsFailed.join('; ')}`;
    }
    console.log("Cron job finished.", responseMessage);
    res.status(200).send(responseMessage); // Restore response for Vercel

  } catch (error) {
    console.error('CRITICAL Error in main cron function:', error.message, error.stack);
    res.status(500).send(`Internal Server Error: ${error.message}`); // Restore response for Vercel
  }
} // Removed closing brace for runLocalTest
// Removed runLocalTest() call