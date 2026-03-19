const { transporter } = require('./emailService');

const from = `SoulTrader <${process.env.EMAIL_USER}>`;
const BASE_URL = process.env.BASE_URL || 'https://soultrader.gg';

// Format a structured items array into readable text
function formatItems(items) {
  if (!Array.isArray(items)) return String(items || '');
  return items.map(item => {
    let s = `${item.name} ×${item.qty || 1}`;
    if (item.upgrade !== null && item.upgrade !== undefined) s += ` [+${item.upgrade}]`;
    return s;
  }).join(', ') || '(none)';
}

exports.sendTradeAcceptedEmail = async (creatorEmail, creatorUsername, acceptorUsername, trade, contactInfo) => {
  await transporter.sendMail({
    from,
    to: creatorEmail,
    subject: `${acceptorUsername} wants to trade — SoulTrader`,
    html: `
      <div style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
        <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:2rem;border:1px solid #333;">
          <h2 style="color:#c9a84c;margin-top:0;">Trade Accepted</h2>
          <p><strong>${acceptorUsername}</strong> has accepted your trade offer for <strong>${trade.game}</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:1rem 0;">
            <tr><td style="padding:0.4rem 0;color:#999;width:160px;">Offering</td><td>${formatItems(trade.offeredItems)}</td></tr>
            <tr><td style="padding:0.4rem 0;color:#999;">Requesting</td><td>${formatItems(trade.requestedItems)}</td></tr>
            <tr><td style="padding:0.4rem 0;color:#999;">Meeting point</td><td>${contactInfo.meetingPoint || 'Not specified'}</td></tr>
            <tr><td style="padding:0.4rem 0;color:#999;">Discord</td><td>${contactInfo.discordName || 'Not provided'}</td></tr>
            <tr><td style="padding:0.4rem 0;color:#999;">In-game name</td><td>${contactInfo.inGameName || 'Not specified'}</td></tr>
            <tr><td style="padding:0.4rem 0;color:#999;">Additional info</td><td>${contactInfo.additionalInfo || 'None'}</td></tr>
          </table>
          <a href="${BASE_URL}/trade/my-trades" style="display:inline-block;padding:0.65rem 1.25rem;background:#c9a84c;color:#111;border-radius:4px;text-decoration:none;font-weight:bold;">View in My Trades</a>
        </div>
      </div>
    `,
  });
};

exports.sendTradeConfirmedByPartyEmail = async (otherEmail, confirmerUsername, otherUsername, trade) => {
  await transporter.sendMail({
    from,
    to: otherEmail,
    subject: `${confirmerUsername} confirmed the trade — SoulTrader`,
    html: `
      <div style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
        <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:2rem;border:1px solid #333;">
          <h2 style="color:#c9a84c;margin-top:0;">Trade Confirmation</h2>
          <p><strong>${confirmerUsername}</strong> has confirmed the <strong>${trade.game}</strong> trade. Please log in to confirm your side.</p>
          <a href="${BASE_URL}/trade/my-trades" style="display:inline-block;padding:0.65rem 1.25rem;background:#c9a84c;color:#111;border-radius:4px;text-decoration:none;font-weight:bold;">Confirm Now</a>
        </div>
      </div>
    `,
  });
};

exports.sendTradeCompletedEmail = async (email, username, partnerUsername, trade) => {
  await transporter.sendMail({
    from,
    to: email,
    subject: 'Trade Complete — Please Rate Your Partner — SoulTrader',
    html: `
      <div style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
        <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:2rem;border:1px solid #333;">
          <h2 style="color:#c9a84c;margin-top:0;">Trade Complete</h2>
          <p>Your <strong>${trade.game}</strong> trade with <strong>${partnerUsername}</strong> is now complete.</p>
          <p>Please rate your trade partner to update their reputation.</p>
          <a href="${BASE_URL}/trade/my-trades" style="display:inline-block;padding:0.65rem 1.25rem;background:#c9a84c;color:#111;border-radius:4px;text-decoration:none;font-weight:bold;">Rate Partner</a>
        </div>
      </div>
    `,
  });
};

exports.sendTradeDeclinedEmail = async (acceptorEmail, acceptorUsername, creatorUsername, trade) => {
  await transporter.sendMail({
    from,
    to: acceptorEmail,
    subject: 'Trade Declined — SoulTrader',
    html: `
      <div style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
        <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:2rem;border:1px solid #333;">
          <h2 style="color:#c9a84c;margin-top:0;">Trade Declined</h2>
          <p><strong>${creatorUsername}</strong> has declined your trade request for <strong>${trade.game}</strong>.</p>
          <p><strong>Offered:</strong> ${formatItems(trade.offeredItems)}</p>
          <p><strong>Requested:</strong> ${formatItems(trade.requestedItems)}</p>
          <a href="${BASE_URL}" style="display:inline-block;padding:0.65rem 1.25rem;background:#c9a84c;color:#111;border-radius:4px;text-decoration:none;font-weight:bold;">Browse Trades</a>
        </div>
      </div>
    `,
  });
};

exports.sendTradeCancelledEmail = async (acceptorEmail, acceptorUsername, creatorUsername, trade) => {
  await transporter.sendMail({
    from,
    to: acceptorEmail,
    subject: 'Trade Cancelled — SoulTrader',
    html: `
      <div style="background:#111;color:#eee;font-family:sans-serif;padding:2rem;">
        <div style="max-width:560px;margin:0 auto;background:#1a1a1a;border-radius:8px;padding:2rem;border:1px solid #333;">
          <h2 style="color:#c9a84c;margin-top:0;">Trade Cancelled</h2>
          <p><strong>${creatorUsername}</strong> has cancelled the <strong>${trade.game}</strong> trade.</p>
          <p><strong>Offered:</strong> ${formatItems(trade.offeredItems)}</p>
          <p><strong>Requested:</strong> ${formatItems(trade.requestedItems)}</p>
          <a href="${BASE_URL}" style="display:inline-block;padding:0.65rem 1.25rem;background:#c9a84c;color:#111;border-radius:4px;text-decoration:none;font-weight:bold;">Browse Trades</a>
        </div>
      </div>
    `,
  });
};
