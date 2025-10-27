// utils/sendWhatsApp.js
const axios = require('axios');

async function sendWhatsAppMessage(to, templateName, components = []) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const WHATSAPP_NUMBER_ID = process.env.WHATSAPP_NUMBER_ID;

  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_NUMBER_ID}/messages`;

  const data = {
    messaging_product: 'whatsapp',
    to: to, // Phone number with country code, e.g., 9198xxxxxxxx
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: 'en_US', // Or your template's language
      },
      components: components,
    },
  };

  try {
    await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    console.log(`WhatsApp template '${templateName}' sent to ${to}`);
  } catch (error) {
    console.error(
      'Error sending WhatsApp message:',
      error.response ? error.response.data : error.message
    );
  }
}

module.exports = { sendWhatsAppMessage };