// api/check-gmail.js
require('dotenv').config({ path: '../../.env' }); // Load .env file
const { google } = require('googleapis');
const cheerio = require('cheerio');
const { sendWhatsAppMessage } = require('../utils/sendWhatsApp');
const { sendEmail } = require('../utils/sendEmail');

// --- Google API Authentication ---

// 1. Auth for Google Sheets (Service Account)
const sheetsAuth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'), // Fix for Vercel
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// 2. Auth for Gmail (OAuth 2.0)
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground' // Redirect URI
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const sheets = google.sheets({ version: 'v4', auth: sheetsAuth });

// --- Email Parsing Function (NEEDS CUSTOMIZATION) ---

function parseIndiaMartEmail(htmlBody) {
  // This function is a GUESS. You MUST inspect your email's HTML
  // and update the selectors (e.g., 'table.enq-table') to match.
  
  try {
    const $ = cheerio.load(htmlBody);
    
    // Example: Find the table with the lead data.
    // Right-click your email in Gmail -> "Inspect" to find the real tags.
    const leadTable = $('table').first(); // This is just a guess
    
    // --- !! UPDATE THESE SELECTORS !! ---
    const name = leadTable.find('td:contains("Sender Name")').next().text().trim();
    const email = leadTable.find('td:contains("Email")').next().text().trim();
    const phone = leadTable.find('td:contains("Mobile")').next().text().trim();
    const product = leadTable.find('td:contains("Product Name")').next().text().trim();
    const message = leadTable.find('td:contains("Message")').next().text().trim();
    
    // Clean up the phone number (e.g., remove "+")
    const cleanedPhone = phone.replace(/[^0-9]/g, '');

    if (!name || !cleanedPhone || !email) {
      console.warn('Could not parse all details from email.');
      return null;
    }

    return {
      name,
      email,
      phone: cleanedPhone, // Make sure to include country code (e.g., 91)
      product,
      message,
    };
  } catch (error) {
    console.error('Error parsing email HTML:', error);
    return null;
  }
}

// --- Helper to decode Gmail's base64 body ---

function getEmailBody(message) {
  const parts = message.payload.parts;
  let bodyData = '';

  if (message.payload.body.data) {
    bodyData = message.payload.body.data;
  } else if (parts) {
    // Find the HTML part
    const part = parts.find((p) => p.mimeType === 'text/html');
    if (part) {
      bodyData = part.body.data;
    }
  }
  
  if (!bodyData) return null;

  return Buffer.from(bodyData, 'base64').toString('utf-8');
}

// --- Main Serverless Function ---

module.exports = async (req, res) => {
  try {
    console.log('Cron job started: Checking for new emails...');

    // 1. Search for new IndiaMart emails
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      // !! Check your Gmail for the exact subject/sender !!
      q: 'is:unread from:alerts@indiamart.com subject:"New Enquiry"', 
    });

    const messages = listResponse.data.messages;
    if (!messages || messages.length === 0) {
      console.log('No new emails found.');
      return res.status(200).send('No new emails found.');
    }

    console.log(`Found ${messages.length} new email(s).`);
    const leadsAdded = [];

    // 2. Process each email
    for (const msg of messages) {
      const msgResponse = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
      });

      const htmlBody = getEmailBody(msgResponse.data);
      if (!htmlBody) continue;

      // 3. Parse the email content
      const lead = parseIndiaMartEmail(htmlBody);
      if (!lead) {
        console.warn(`Could not parse email ID: ${msg.id}`);
        continue; // Skip this email
      }

      // 4. Add to Google Sheets
      const sheetName = 'Leads'; // !! Change this to your Sheet's tab name !!
      const newRow = [
        new Date().toISOString(),
        lead.name,
        lead.phone,
        lead.email,
        lead.product,
        lead.message,
        'New Lead', // Initial Status
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [newRow],
        },
      });

      console.log(`Added new lead to Google Sheets: ${lead.name}`);
      leadsAdded.push(lead.name);

      // 5. Send Welcome Messages
      // !! Replace with your real template names !!
      await sendWhatsAppMessage(lead.phone, 'welcome_template');
      await sendEmail(
        lead.email,
        `Thank you for your enquiry - JANVI PACKAGING`,
        `<p>Hi ${lead.name},</p><p>Thank you for your interest in ${lead.product}. We have received your enquiry and will contact you shortly.</p>`
      );

      // 6. Mark email as "Read" (remove 'UNREAD' label)
      await gmail.users.messages.modify({
        userId: 'me',
        id: msg.id,
        resource: {
          removeLabelIds: ['UNREAD'],
        },
      });
    }

    res.status(200).send(`Successfully processed ${leadsAdded.length} new leads: ${leadsAdded.join(', ')}`);
  } catch (error) {
    console.error('Error in Gmail check cron job:', error);
    res.status(500).send('Internal Server Error');
  }
};