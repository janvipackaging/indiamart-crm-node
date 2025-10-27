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

// --- Builds the HTML templates ---
function getEmailTemplate(name, type, product = '', requirements = '') {
    let subject, htmlBodyContent;

    // Base structure (header and footer)
    const header = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Janvi Packaging</title>
            <style>
                body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
                table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
                body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #F1F5F9; }
                /* Basic responsive adjustments */
                @media screen and (max-width: 600px) {
                    table[class="wrapper"] {
                        width: 100% !important;
                    }
                    td[class="logo"] img {
                         width: 150px !important; /* Smaller logo on mobile */
                         max-width: 150px !important;
                         min-width: 150px !important;
                    }
                    td[class="content"] {
                         padding: 20px !important; /* Less padding on mobile */
                    }
                    h1 {
                        font-size: 20px !important; /* Smaller heading on mobile */
                    }
                    p {
                        font-size: 14px !important; /* Smaller text on mobile */
                        line-height: 20px !important;
                    }
                }
            </style>
        </head>
        <body style="margin: 0 !important; padding: 0 !important; background-color: #F1F5F9;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                    <td align="center" style="padding: 20px 10px;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px;" class="wrapper">
                            <tr>
                                <td align="center" valign="top" style="padding: 20px 20px; background-color: #FFFFFF; border-top-left-radius: 12px; border-top-right-radius: 12px;" class="logo">
                                    <a href="https://janvipackaging.online/" target="_blank">
                                        <img src="https://www.janvipackaging.online/images/logo-email.png" alt="Janvi Packaging Logo" width="180" style="display: block; width: 180px; max-width: 180px; min-width: 180px;">
                                    </a>
                                </td>
                            </tr>
                            <tr>
                                <td align="left" style="padding: 30px 30px; background-color: #FFFFFF; font-family: Arial, sans-serif;" class="content">
    `;

    const footer = `
                                </td>
                            </tr>
                            <tr>
                                <td align="center" style="padding: 30px 20px; background-color: #0F172A; color: #E2E8F0; font-family: Arial, sans-serif; font-size: 12px; line-height: 18px; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
                                    <p style="margin: 0 0 15px;"><strong>JANVI PACKAGING</strong></p>
                                    <p style="margin: 0 0 15px;">
                                        <a href="https://janvipackaging.online/" target="_blank" style="color: #E2E8F0; text-decoration: none;">Website</a> &nbsp;|&nbsp;
                                        <a href="https://janvipackaging.online/privacy-policy.html" target="_blank" style="color: #E2E8F0; text-decoration: none;">Privacy Policy</a> &nbsp;|&nbsp;
                                        <a href="https://janvipackaging.online/disclaimer.html" target="_blank" style="color: #E2E8F0; text-decoration: none;">Disclaimer</a>
                                    </p>
                                    <p style="margin: 0; color: #94A3B8;">
                                        You are receiving this email as a follow-up to your inquiry or order with Janvi Packaging.
                                    </p>
                                    <p style="margin: 10px 0 0; color: #64748B; font-size: 10px;">
                                        13 Bhagyoday Utkarsk, Parsiwadi, Kaju Hill, Ghatkopar West, Mumbai, Maharashtra India 400084
                                     </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;

    // Dynamically set Subject and Body Content
    switch (type) {
        case 'welcome':
            subject = `We've Received Your Janvi Packaging Inquiry for ${product}`; // Include product
            htmlBodyContent = `
                <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #1E293B;">
                    Dear ${name},
                </h1>
                <p style="font-size: 16px; line-height: 24px; color: #475569; margin: 20px 0 0;">
                    Thank you for considering Janvi Packaging for your business needs regarding <strong>${product}</strong>. This email confirms we have received your request.
                </p>
                ${requirements ? `<p style="font-size: 15px; line-height: 22px; color: #475569; margin: 15px 0 0; padding: 10px; border-left: 3px solid #00A699; background-color: #F0FDF4;"><strong>Your Requirements:</strong><br>${requirements.replace(/\n/g, '<br>')}</p>` : ''}
                <p style="font-size: 16px; line-height: 24px; color: #475569; margin: 20px 0 30px;">
                    Our team is dedicated to finding the perfect solution for our clients, and a specialist is now reviewing your submission. They will be in touch soon with further details.
                </p>
                <p style="font-size: 16px; line-height: 24px; color: #475569; margin: 0;">
                    Best regards,<br>
                    The Janvi Packaging Team
                </p>
            `;
            break;

        case 'contacted':
            subject = "Following Up on Our Discussion - Janvi Packaging";
            htmlBodyContent = `
                <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #1E293B;">
                    Dear ${name},
                </h1>
                <p style="font-size: 16px; line-height: 24px; color: #475569; margin: 20px 0 0;">
                    Thank you for the discussion with us today. We appreciate you taking the time to speak with our team.
                </p>
                <p style="font-size: 16px; line-height: 24px; color: #475569; margin: 20px 0 30px;">
                    We hope we answered all of your questions clearly. If you think of anything else, please feel free to reply directly to this email or call us.
                </p>
                <p style="font-size: 16px; line-height: 24px; color: #475569; margin: 0;">
                    Best regards,<br>
                    The Janvi Packaging Team
                </p>
            `;
            break;

        case 'order_confirmed':
            subject = "Your Order is Confirmed! - Janvi Packaging";
            htmlBodyContent = `
                <h1 style="font-size: 24px; font-weight: 800; margin: 0; color: #1E293B;">
                    Dear ${name},
                </h1>
                <p style="font-size: 16px; line-height: 24px; color: #475569; margin: 20px 0 0;">
                    Great news! Your order with Janvi Packaging is confirmed.
                </p>
                <p style="font-size: 16px; line-height: 24px; color: #475569; margin: 20px 0 30px;">
                    We are now processing it and will send you another update as soon as it ships. Thank you for your business!
                </p>
                <p style="font-size: 16px; line-height: 24px; color: #475569; margin: 0;">
                    Best regards,<br>
                    The Janvi Packaging Team
                </p>
            `;
            break;

        default:
            subject = "A Message from Janvi Packaging";
            htmlBodyContent = `<p>Hi ${name}, thank you for getting in touch.</p>`;
    }

    return {
        subject: subject,
        html: header + htmlBodyContent + footer
    };
}


// --- Updated sendEmail function ---
async function sendEmail(to, name, type, product = '', requirements = '') {
    // Get the correct email subject and HTML based on the type
    const emailContent = getEmailTemplate(name, type, product, requirements);

    const mailOptions = {
        from: `"JANVI PACKAGING" <${process.env.GMAIL_USER}>`, // Your "from" name
        to: to,
        subject: emailContent.subject,
        html: emailContent.html,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email (type: ${type}) sent successfully to ${to}`);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

module.exports = { sendEmail }; // Export the updated function