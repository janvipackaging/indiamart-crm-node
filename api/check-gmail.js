// api/check-gmail.js
require('dotenv').config({ path: '../../.env' }); // Load .env file
const { google } = require('googleapis');
const cheerio = require('cheerio');
const { sendWhatsAppMessage } = require('../utils/sendWhatsApp');
const { sendEmail } = require('../utils/sendEmail'); // Use updated sender

// --- Google API Authentication (Same as before) ---
const sheetsAuth = new google.auth.GoogleAuth({ /* ... credentials ... */ });
const oauth2Client = new google.auth.OAuth2( /* ... credentials ... */ );
oauth2Client.setCredentials({ /* ... refresh token ... */ });
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });

// --- !! PARSING FUNCTION UPDATED FOR COMPANY NAME !! ---
function parseIndiaMartEmail(htmlBody, subject, fromAddress) {
  try {
    const $ = cheerio.load(htmlBody);
    let lead = {
        name: '',
        company: '', // Added company field
        email: '',
        phone: '',
        product: '',
        message: '',
    };

    const isBuyLead = fromAddress.includes('buyleads@indiamart.com');
    const isEnquiry = fromAddress.includes('buyershelpdesk@indiamart.com') || fromAddress.includes('buyershelp+enq@indiamart.com');

    if (isBuyLead) {
      console.log("Parsing as Buy Lead...");
      lead.product = $('div[style*="font-size:18px"] strong').first().text().trim();
      const contactBlock = $('a[href*="call+"]').closest('div');
      if (!contactBlock.length) return null;
      const contactHtml = contactBlock.html();
      const contactLines = contactHtml.split('<br>').map(line => line.replace(/<\/?[^>]+(>|$)/g, "").trim()); // Split and clean HTML tags

      lead.name = contactLines[0] || '';
      // Try to extract company name from the second line, clean city/state
      if (contactLines.length > 1) {
          lead.company = contactLines[1].split(/ - |,/)[0].trim(); // Take text before " - " or ","
          // Further cleaning if it looks like just a location
          if (/^\d+,\s*\w{2}$/.test(lead.company) || lead.company.toLowerCase() === 'india') {
            lead.company = ''; // Remove if it looks like "600050, TN" or just "India"
          }
      }

      const phoneLink = contactBlock.find('a[href*="call+"]').first().text().trim();
      lead.phone = phoneLink.replace(/[^0-9]/g, '');
      lead.email = contactBlock.find('a[href*="mailto:"]').first().text().trim();

      // Requirements parsing (same as before)
      let message = '';
      let reqTable = $('strong:contains("Quantity")').closest('table');
      if (!reqTable.length) reqTable = $('strong:contains("Width")').closest('table');
      if (!reqTable.length) reqTable = $('strong:contains("Thickness")').closest('table');
      reqTable.find('tr').each((i, el) => { /* ... (same logic) ... */ });
      lead.message = message.trim();

    } else if (isEnquiry) {
      console.log("Parsing as Enquiry...");
      // Product parsing (same as before)
      lead.product = $('p:contains("I am looking for") b').first().text().trim();
      // ... (fallback logic same as before) ...

       // Requirements parsing (same as before)
      let message = '';
       $('span:contains("Below are the requirement details")').closest('tr').next('tr').find('table tr').each((i, row) => { /* ... (same logic) ... */ });
       lead.message = message.trim();

      // Contact Details (from Regards section) - UPDATED for company
      const regardsTable = $('td:contains("Regards")').closest('table');
      const nameRow = regardsTable.find('span:contains("Regards")').closest('tr').nextAll('tr').first();
      lead.name = nameRow.find('span').text().trim();

      // Company might be on the row after the name
      const companyRow = nameRow.next('tr');
      const companyText = companyRow.find('span').text().trim();
      // Check if the next line exists and doesn't look like an address line starting with city or email/phone
      if (companyText && !companyText.startsWith('Click to call:') && !companyText.startsWith('Email:') && !companyText.match(/^[A-Za-z\s]+ - \d+,/)) {
          lead.company = companyText.split(',')[0].trim(); // Take text before comma
          if (lead.company.toLowerCase() === 'india') lead.company = ''; // Clean if just "India"
      } else {
          lead.company = ''; // Assume no company if next line looks like address or contact
      }

      const phoneLinkElement = regardsTable.find('a[href*="call+"]').first();
      lead.phone = phoneLinkElement.text().replace(/[^0-9]/g, '');

      const emailLinkElement = regardsTable.find('a[href*="mailto:"]').first();
      lead.email = emailLinkElement.text().split(' ')[0].trim();

    } else {
      console.warn(`Unknown email format from: ${fromAddress}. Subject: ${subject}`);
      return null;
    }

    // --- Common Validation and Cleanup (Same as before) ---
    if (!lead.product) return null;
    if (!lead.name || !lead.phone || !lead.email) return null;
    if (lead.phone && !lead.phone.startsWith('91') && lead.phone.length >= 10) {
        lead.phone = `91${lead.phone.slice(-10)}`;
    } else if (lead.phone && lead.phone.length < 10) {
        console.warn(`Phone number ${lead.phone} seems too short. Skipping.`);
        return null;
    }

    console.log("Parsed Lead:", lead);
    return lead;

  } catch (error) {
    console.error(`CRITICAL Error parsing email HTML (Subject: ${subject}):`, error);
    return null;
  }
}

// --- getEmailBody function (Same as before) ---
function getEmailBody(message) { /* ... (same logic) ... */ }

// --- Main Serverless Function (UPDATED) ---
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
      return res.status(200).send('No new emails found.');
    }

    console.log(`Found ${messages.length} new email(s).`);
    const leadsAdded = [];
    const leadsFailed = [];

    for (const msg of messages) {
      let subject = ''; let fromAddress = ''; let msgId = msg.id;
      try {
        const msgResponse = await gmail.users.messages.get({ userId: 'me', id: msgId, format: 'full' });
        if (!msgResponse.data || !msgResponse.data.payload) { /* ... skip ... */ }

        const headers = msgResponse.data.payload.headers;
        subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
        fromAddress = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'Unknown Sender';

        const htmlBody = getEmailBody(msgResponse.data);
        if (!htmlBody) { /* ... skip ... */ }

        const lead = parseIndiaMartEmail(htmlBody, subject, fromAddress);
        if (!lead) { /* ... skip ... */ }

        // --- Add to Google Sheets (COLUMN ORDER ADJUSTED) ---
        const sheetName = 'Leads'; // !! Change this to your Sheet's tab name !!
        const newRow = [
          new Date().toISOString(), // Column A: Timestamp
          lead.name,                // Column B: Name
          lead.company,             // Column C: Company <<-- NEW
          lead.phone,               // Column D: Phone (was C)
          lead.email,               // Column E: Email (was D)
          lead.product,             // Column F: Product (was E)
          lead.message,             // Column G: Requirements (was F)
          'New Lead',               // Column H: Status (was G)
        ];

        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          insertDataOption: 'INSERT_ROWS',
          resource: { values: [newRow] },
        });

        console.log(`Added new lead to Google Sheets: ${lead.name} (Email ID: ${msgId})`);
        leadsAdded.push(lead.name);

        // --- Send Welcome Messages (UPDATED) ---
        // Uses correct WhatsApp template name and updated sendEmail
        await sendWhatsAppMessage(lead.phone, 'welcome', [
          // Assuming 'welcome' template has one variable for customer name
          { type: 'body', parameters: [{ type: 'text', text: lead.name }] }
        ]);
        await sendEmail(lead.email, lead.name, 'welcome', lead.product, lead.message); // Pass details to new sendEmail

        // Mark email as read (same as before)
        await gmail.users.messages.modify({ userId: 'me', id: msgId, resource: { removeLabelIds: ['UNREAD'] } });
        console.log(`Marked email ${msgId} as read.`);

      } catch(error) { /* ... error handling ... */ }
    } // End loop

    // Response message (same as before)
    /* ... response logic ... */
    res.status(200).send(responseMessage);

  } catch (error) { /* ... error handling ... */ }
};

// --- Helper Functions (need to be included if not already) ---
// (Make sure the full definitions for sheetsAuth, oauth2Client, sheets, gmail, getEmailBody are present)