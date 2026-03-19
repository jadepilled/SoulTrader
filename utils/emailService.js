// utils/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'mail.spacemail.com',
  port: 465,
  secure: true,  
auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Export transporter
exports.transporter = transporter;

/**
 * Send a verification email with a link to /auth/verify/:token
 */
exports.sendVerificationEmail = async (recipientEmail, token) => {
  const verificationUrl = `http://soultrader.gg/auth/verify/${token}`;
  
  const mailOptions = {
    from: `SoulTrader <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: 'Verify your SoulTrader account',
    html: `
      <h2>Welcome to SoulTrader!</h2>
      <p>Please click the link below to verify your account:</p>
      <a href="${verificationUrl}">${verificationUrl}</a>
    `
  };

  await transporter.sendMail(mailOptions);
};
