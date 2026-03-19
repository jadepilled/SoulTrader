// utils/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'mail.spacemail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000, // 10s to establish TCP connection
  greetingTimeout:   10000, // 10s to receive SMTP greeting
  socketTimeout:     15000, // 15s max socket inactivity
});

// Export transporter
exports.transporter = transporter;

/**
 * Send a verification email with a link to /auth/verify/:token
 */
exports.sendVerificationEmail = async (recipientEmail, token) => {
  const verificationUrl = `https://soultrader.gg/auth/verify/${token}`;
  
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

/**
 * Send a password reset email with a link to /auth/reset-password/:token
 */
exports.sendPasswordResetEmail = async (recipientEmail, token) => {
  const resetUrl = `https://soultrader.gg/auth/reset-password/${token}`;

  const mailOptions = {
    from: `SoulTrader <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: 'Reset your SoulTrader password',
    html: `
      <h2>Password Reset</h2>
      <p>You requested a password reset for your SoulTrader account.</p>
      <p>Click the link below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <a href="${resetUrl}">${resetUrl}</a>
      <p style="color:#888; font-size:0.85em;">If you did not request this, you can safely ignore this email. Your password will not change.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};
