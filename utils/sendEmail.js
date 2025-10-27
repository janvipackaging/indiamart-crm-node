// utils/sendEmail.js
const nodemailer = require('nodemailer');

// Set up the transporter one time
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendEmail(to, subject, htmlBody) {
  const mailOptions = {
    from: `"JANVI PACKAGING" <${process.env.GMAIL_USER}>`, // Your "from" name
    to: to,
    subject: subject,
    html: htmlBody,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email '${subject}' sent to ${to}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

module.exports = { sendEmail };