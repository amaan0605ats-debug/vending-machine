const nodemailer = require('nodemailer');

// Configure transporter (replace with real credentials in production)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'user@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
});

/**
 * Send an email.
 * @param {Object} options { from, to, subject, text, html }
 * @returns {Promise}
 */
function sendMail(options) {
  const mailOptions = {
    from: options.from || 'no-reply@vendx.com',
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { sendMail };
