const { transporter } = require('./emailService');

const from = `SoulTrader <${process.env.EMAIL_USER}>`;
const BASE_URL = process.env.BASE_URL || 'https://soultrader.gg';

/**
 * Send notification when a user receives a friend request
 */
exports.sendFriendRequestEmail = async (recipientEmail, recipientUsername, senderUsername) => {
  await transporter.sendMail({
    from,
    to: recipientEmail,
    subject: `${senderUsername} sent you a friend request — SoulTrader`,
    html: `
      <div style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
        <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:2rem;border:1px solid #333;">
          <h2 style="color:#c9a84c;margin-top:0;">Friend Request</h2>
          <p><strong>${senderUsername}</strong> sent you a friend request on SoulTrader.</p>
          <a href="${BASE_URL}/login" style="display:inline-block;padding:0.65rem 1.25rem;background:#c9a84c;color:#111;border-radius:4px;text-decoration:none;font-weight:bold;">Log In &amp; Check Your Profile</a>
          <hr style="border-color:#333;margin:1.5rem 0;">
          <p style="color:#666;font-size:0.8em;">You received this because someone sent you a friend request on SoulTrader.</p>
        </div>
      </div>
    `,
  });
};
