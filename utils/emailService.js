// utils/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'mail.spacemail.com',
  port: 587,
  secure: false,      // STARTTLS
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout:   10000,
  socketTimeout:     15000,
});

exports.transporter = transporter;

const BASE_URL = process.env.BASE_URL || 'https://soultrader.gg';

exports.sendVerificationEmail = async (recipientEmail, token) => {
  const verificationUrl = `${BASE_URL}/auth/verify/${token}`;
  await transporter.sendMail({
    from: `SoulTrader <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: 'Verify your SoulTrader account',
    html: `
      <!DOCTYPE html><html>
      <body style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
        <div style="max-width:520px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:2rem;border:1px solid #333;">
          <h2 style="color:#c9a84c;margin-top:0;">Welcome to SoulTrader</h2>
          <p>Click the link below to verify your email address.</p>
          <a href="${verificationUrl}" style="display:inline-block;margin:1.5rem 0;padding:0.75rem 1.5rem;background:#c9a84c;color:#111;border-radius:4px;text-decoration:none;font-weight:bold;">Verify Email Address</a>
          <p style="color:#888;font-size:0.85em;">Or copy: <span style="color:#aaa;">${verificationUrl}</span></p>
          <hr style="border-color:#333;margin:1.5rem 0;">
          <p style="color:#666;font-size:0.8em;">If you did not create a SoulTrader account, ignore this email.</p>
        </div>
      </body></html>
    `,
  });
};

exports.sendPasswordResetEmail = async (recipientEmail, token) => {
  const resetUrl = `${BASE_URL}/auth/reset-password/${token}`;
  await transporter.sendMail({
    from: `SoulTrader <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: 'Reset your SoulTrader password',
    html: `
      <!DOCTYPE html><html>
      <body style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
        <div style="max-width:520px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:2rem;border:1px solid #333;">
          <h2 style="color:#c9a84c;margin-top:0;">Password Reset</h2>
          <p>Click the link below to set a new password. Expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:1.5rem 0;padding:0.75rem 1.5rem;background:#c9a84c;color:#111;border-radius:4px;text-decoration:none;font-weight:bold;">Reset Password</a>
          <p style="color:#888;font-size:0.85em;">Or copy: <span style="color:#aaa;">${resetUrl}</span></p>
          <hr style="border-color:#333;margin:1.5rem 0;">
          <p style="color:#666;font-size:0.8em;">If you did not request this, ignore this email.</p>
        </div>
      </body></html>
    `,
  });
};
