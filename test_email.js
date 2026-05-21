require('dotenv').config();
const { sendMail } = require('./utils/email');
(async () => {
  try {
    const result = await sendMail({
      to: 'amaan0605ats@gmail.com',
      subject: 'VendX Test Email',
      text: 'This is a test email from VendX development server.',
      html: '<p>This is a <strong>test email</strong> from VendX development server.</p>'
    });
    console.log('✅ Email sent! Message ID:', result.messageId);
  } catch (err) {
    console.error('❌ Email sending failed:', err);
  }
})();
