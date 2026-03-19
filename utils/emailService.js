// utils/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'mail.spacemail.com',
  port: 587,
  secure: false,      // STARTTLS — connects on 587 then upgrades to TLS
  requireTLS: true,   // Refuse to send if TLS upgrade fails
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout:   10000,
  socketTimeout:     15000,
});

// Export transporter
exports.transporter = transporter;

/**
 * Send a verification email with a link to /auth/verify/:token
 */
exports.sendVerificationEmail = async (recipientEmail, token) => {
  const verificationUrl = `${process.env.BASE_URL || 'https://soultrader.gg'}/auth/verify/${token}`;

  const { error } = await transporter.sendMail({
    from: `SoulTrader <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: 'Verify your SoulTrader account',
    html: `
      <!DOCTYPE html>
      <html>
        <body style="background:#111; color:#eee; font-family:sans-serif; padding:2rem;">
          <div style="max-width:520px; margin:0 auto; background:#1a1a1a; border-radius:8px; padding:2rem; border:1px solid #333;">
            <h2 style="color:#c9a84c; margin-top:0;">Welcome to SoulTrader</h2>
            <p>Thank you for registering. Click the link below to verify your email address and activate your account.</p>
            <a href="${verificationUrl}"
               style="display:inline-block; margin:1.5rem 0; padding:0.75rem 1.5rem;
                      background:#c9a84c; color:#111; border-radius:4px;
                      text-decoration:none; font-weight:bold;">
              Verify Email Address
            </a>
            <p style="color:#888; font-size:0.85em;">
              Or copy this link into your browser:<br>
              <span style="color:#aaa;">${verificationUrl}</span>
            </p>
            <hr style="border-color:#333; margin:1.5rem 0;">
            <p style="color:#666; font-size:0.8em;">
              If you did not create a SoulTrader account, you can safely ignore this email.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) throw new Error(`Mail send error: ${error.message}`);
};

/**
 * Send a password reset email with a link to /auth/reset-password/:token
 */
exports.sendPasswordResetEmail = async (recipientEmail, token) => {
  const resetUrl = `${process.env.BASE_URL || 'https://soultrader.gg'}/auth/reset-password/${token}`;

  const { error } = await transporter.sendMail({
    from: `SoulTrader <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: 'Reset your SoulTrader password',
    html: `
      <!DOCTYPE html>
      <html>
        <body style="background:#111; color:#eee; font-family:sans-serif; padding:2rem;">
          <div style="max-width:520px; margin:0 auto; background:#1a1a1a; border-radius:8px; padding:2rem; border:1px solid #333;">
            <h2 style="color:#c9a84c; margin-top:0;">Password Reset</h2>
            <p>You requested a password reset for your SoulTrader account.</p>
            <p>Click the link below to set a new password. This link expires in <strong>1 hour</strong>.</p>
            <a href="${resetUrl}"
               style="display:inline-block; margin:1.5rem 0; padding:0.75rem 1.5rem;
                      background:#c9a84c; color:#111; border-radius:4px;
                      text-decoration:none; font-weight:bold;">
              Reset Password
            </a>
            <p style="color:#888; font-size:0.85em;">
              Or copy this link into your browser:<br>
              <span style="color:#aaa;">${resetUrl}</span>
            </p>
            <hr style="border-color:#333; margin:1.5rem 0;">
            <p style="color:#666; font-size:0.8em;">
              If you did not request a password reset, you can safely ignore this email.
              Your password will not change.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) throw new Error(`Mail send error: ${error.message}`);
};
