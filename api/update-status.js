    // api/update-status.js
require('dotenv').config({ path: '../../.env' }); // Load .env file

const { sendWhatsAppMessage } = require('../utils/sendWhatsApp');
const { sendEmail } = require('../utils/sendEmail');

// This is the main function Vercel will run
module.exports = async (req, res) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    // Get the data sent from Google Apps Script
    const { status, name, phone, email } = req.body;

    console.log(`Received status update: ${status} for ${name}`);

    // Use a switch to decide which message to send
    switch (status) {
      case 'Contacted':
        // 1. Send "Contacted" WhatsApp
        // Note: You must pre-define 'contacted_template' in Meta
        // If your template has variables (e.g., customer name), you add 'components'
        await sendWhatsAppMessage(phone, 'contacted_template_name');

        // 2. Send "Contacted" Email
        await sendEmail(
          email,
          'Following up on your enquiry - JANVI PACKAGING',
          `<p>Hi ${name},</p><p>Thank you for your interest. We have received your enquiry and will be in touch shortly.</p>`
        );
        break;

      case 'Order Confirmed':
        // 1. Send "Order Confirmed" WhatsApp
        await sendWhatsAppMessage(phone, 'order_confirmed_template_name');

        // 2. Send "Order Confirmed" Email
        await sendEmail(
          email,
          'Your Order is Confirmed! - JANVI PACKAGING',
          `<p>Hi ${name},</p><p>We are happy to inform you that your order has been confirmed.</p>`
        );
        break;
      
      // Add more cases here (e.g., 'Shipped', 'Cancelled')
    }

    // Send a success response back to Google Apps Script
    res.status(200).send({ message: 'Automation triggered successfully' });

  } catch (error) {
    console.error('Error in /api/update-status:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
};