// utils/sendWhatsApp.js
const axios = require('axios');

async function sendWhatsAppMessage(to, templateName, components = []) {
  // Retrieve secrets from environment variables
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const WHATSAPP_NUMBER_ID = process.env.WHATSAPP_NUMBER_ID;

  // Construct the API URL
  // Using v19.0 - update if needed
  const url = `https://graph.facebook.com/v19.0/${WHATSAPP_NUMBER_ID}/messages`;

  // Prepare the data payload for the API
  const data = {
    messaging_product: 'whatsapp',
    to: to, // Phone number with country code (e.g., 9198xxxxxxxx)
    type: 'template',
    template: {
      name: templateName, // Your approved template name
      language: {
        code: 'en_US', // Or your template's language code
      },
      components: components, // Pass the components array directly
    },
  };

  try {
    // Send the POST request to the Meta API
    await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`, // Use the Bearer token
        'Content-Type': 'application/json',
      },
    });
    // Log success
    console.log(`WhatsApp template '${templateName}' sent successfully to ${to}`);
  } catch (error) {
    // Log detailed error information if sending fails
    console.error(
      '❌ Error sending WhatsApp message:',
      // Check if the error has response data (from API) or just a message
      error.response ? JSON.stringify(error.response.data.error, null, 2) : error.message
    );
  }
}

// Export the function for use in other files
module.exports = { sendWhatsAppMessage };