// api/update-status.js
require('dotenv').config({ path: '../../.env' });

const { sendWhatsAppMessage } = require('../utils/sendWhatsApp');
const { sendEmail } = require('../utils/sendEmail'); // Use updated sender

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const { status, name, phone, email } = req.body;
    console.log(`Received status update: ${status} for ${name}`);

     // Prepare components for WhatsApp templates if they need variables
     const customerNameComponent = [
         { type: 'body', parameters: [{ type: 'text', text: name }] }
     ];

    switch (status) {
      case 'Contacted':
        // Use 'contacted' template name and pass name variable
        await sendWhatsAppMessage(phone, 'contacted', customerNameComponent);
        // Use updated sendEmail with type 'contacted'
        await sendEmail(email, name, 'contacted');
        break;

      case 'Order Confirmed':
         // Use 'order_confirmed' template name and pass name variable
        await sendWhatsAppMessage(phone, 'order_confirmed', customerNameComponent);
         // Use updated sendEmail with type 'order_confirmed'
        await sendEmail(email, name, 'order_confirmed');
        break;
      // Add more cases if needed
    }

    res.status(200).send({ message: 'Automation triggered successfully' });

  } catch (error) {
    console.error('Error in /api/update-status:', error);
    res.status(500).send({ error: 'Internal Server Error' });
  }
};