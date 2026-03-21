const { transporter } = require('./emailService');

const from = `SoulTrader <${process.env.EMAIL_USER}>`;
const BASE_URL = process.env.BASE_URL || 'https://soultrader.gg';

/**
 * Send notification when a user receives a message from someone new
 */
exports.sendNewMessageEmail = async (recipientEmail, recipientUsername, senderUsername) => {
  await transporter.sendMail({
    from,
    to: recipientEmail,
    subject: `${senderUsername} messaged you — SoulTrader`,
    html: `
      <div style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
        <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:2rem;border:1px solid #333;">
          <h2 style="color:#c9a84c;margin-top:0;">New Message</h2>
          <p><strong>${senderUsername}</strong> sent you a message on SoulTrader.</p>
          <a href="${BASE_URL}/messages/${senderUsername}" style="display:inline-block;padding:0.65rem 1.25rem;background:#c9a84c;color:#111;border-radius:4px;text-decoration:none;font-weight:bold;">View Message</a>
          <hr style="border-color:#333;margin:1.5rem 0;">
          <p style="color:#666;font-size:0.8em;">You received this because someone messaged you for the first time on SoulTrader.</p>
        </div>
      </div>
    `,
  });
};

/**
 * Send weekly digest email for unread messages and unactioned trades
 */
exports.sendWeeklyDigestEmail = async (recipientEmail, recipientUsername, unreadCount, pendingTradeCount) => {
  const sections = [];
  if (unreadCount > 0) {
    sections.push(`<p>You have <strong>${unreadCount}</strong> unread message${unreadCount > 1 ? 's' : ''}.</p>`);
  }
  if (pendingTradeCount > 0) {
    sections.push(`<p>You have <strong>${pendingTradeCount}</strong> trade${pendingTradeCount > 1 ? 's' : ''} awaiting your action.</p>`);
  }

  if (sections.length === 0) return; // Nothing to notify about

  await transporter.sendMail({
    from,
    to: recipientEmail,
    subject: 'Your SoulTrader Weekly Summary',
    html: `
      <div style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
        <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:2rem;border:1px solid #333;">
          <h2 style="color:#c9a84c;margin-top:0;">Weekly Summary</h2>
          <p>Hey <strong>${recipientUsername}</strong>, here's what's waiting for you:</p>
          ${sections.join('')}
          <a href="${BASE_URL}/trade/my-trades" style="display:inline-block;padding:0.65rem 1.25rem;background:#c9a84c;color:#111;border-radius:4px;text-decoration:none;font-weight:bold;margin-top:1rem;">View on SoulTrader</a>
          <hr style="border-color:#333;margin:1.5rem 0;">
          <p style="color:#666;font-size:0.8em;">This is a weekly digest from SoulTrader.</p>
        </div>
      </div>
    `,
  });
};
