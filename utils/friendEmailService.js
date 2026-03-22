const { transporter } = require('./emailService');

const from = `SoulTrader <${process.env.EMAIL_USER}>`;
const BASE_URL = process.env.BASE_URL || 'https://soultrader.gg';

// Shared email wrapper for consistent styling
function emailWrapper(title, bodyHtml) {
  return `
    <div style="background:#0d0d0d;color:#e8e8e8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;padding:2.5rem 1rem;">
      <div style="max-width:560px;margin:0 auto;">
        <!-- Header -->
        <div style="text-align:center;padding-bottom:1.5rem;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:1.5rem;">
          <a href="${BASE_URL}" style="color:#e8e8e8;text-decoration:none;font-size:1.3rem;font-weight:700;letter-spacing:0.5px;">SoulTrader</a>
        </div>
        <!-- Content -->
        <div style="background:rgba(18,18,18,0.72);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:2rem;">
          <h2 style="color:#c8a84e;margin-top:0;margin-bottom:1rem;font-size:1.15rem;">${title}</h2>
          ${bodyHtml}
        </div>
        <!-- Footer -->
        <div style="text-align:center;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,0.06);margin-top:1.5rem;">
          <p style="color:#666;font-size:0.72rem;margin:0;">SoulTrader &mdash; Created by psyopgirl</p>
          <p style="color:#555;font-size:0.65rem;margin:0.3rem 0 0;">You received this email because of your account on <a href="${BASE_URL}" style="color:#c8a84e;text-decoration:none;">soultrader.gg</a></p>
        </div>
      </div>
    </div>
  `;
}

function emailButton(text, url) {
  return `<a href="${url}" style="display:inline-block;padding:0.65rem 1.5rem;background:#c8a84e;color:#0d0d0d;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.9rem;margin-top:0.5rem;">${text}</a>`;
}

/**
 * Send notification when a user receives a friend request
 */
exports.sendFriendRequestEmail = async (recipientEmail, recipientUsername, senderUsername) => {
  await transporter.sendMail({
    from,
    to: recipientEmail,
    subject: `${senderUsername} sent you a friend request — SoulTrader`,
    html: emailWrapper('Friend Request', `
      <p style="color:#999;margin-bottom:1rem;"><strong style="color:#e8e8e8;">${senderUsername}</strong> sent you a friend request on SoulTrader.</p>
      ${emailButton('View Your Profile', `${BASE_URL}/profile`)}
    `),
  });
};

/**
 * Send notification when a friend request is accepted
 */
exports.sendFriendAcceptedEmail = async (recipientEmail, recipientUsername, acceptorUsername) => {
  await transporter.sendMail({
    from,
    to: recipientEmail,
    subject: `${acceptorUsername} accepted your friend request — SoulTrader`,
    html: emailWrapper('Friend Request Accepted', `
      <p style="color:#999;margin-bottom:1rem;"><strong style="color:#e8e8e8;">${acceptorUsername}</strong> accepted your friend request. You are now friends on SoulTrader!</p>
      ${emailButton('View Their Profile', `${BASE_URL}/profile/${acceptorUsername}`)}
    `),
  });
};

// Export shared helpers for other email services
exports.emailWrapper = emailWrapper;
exports.emailButton = emailButton;
