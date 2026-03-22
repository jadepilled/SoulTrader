const { transporter } = require('./emailService');
const { emailWrapper, emailButton } = require('./friendEmailService');

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

function infoTable(rows) {
  let html = '<table style="width:100%;border-collapse:collapse;margin:1rem 0;">';
  for (const [label, value] of rows) {
    html += `<tr><td style="padding:0.4rem 0;color:#666;width:140px;font-size:0.85rem;vertical-align:top;">${label}</td><td style="padding:0.4rem 0;color:#e8e8e8;font-size:0.85rem;">${value}</td></tr>`;
  }
  html += '</table>';
  return html;
}

exports.sendTradeAcceptedEmail = async (creatorEmail, creatorUsername, acceptorUsername, trade, contactInfo) => {
  await transporter.sendMail({
    from,
    to: creatorEmail,
    subject: `${acceptorUsername} wants to trade — SoulTrader`,
    html: emailWrapper('New Trade Offer', `
      <p style="color:#999;margin-bottom:0.5rem;"><strong style="color:#e8e8e8;">${acceptorUsername}</strong> has made an offer on your <strong style="color:#e8e8e8;">${trade.game}</strong> trade.</p>
      ${infoTable([
        ['Offering', formatItems(trade.offeredItems)],
        ['Requesting', formatItems(trade.requestedItems)],
        ['Meeting Point', contactInfo.meetingPoint || 'Not specified'],
        ['In-Game Name', contactInfo.inGameName || 'Not specified'],
        ['Additional Info', contactInfo.additionalInfo || 'None'],
      ])}
      ${emailButton('View in My Trades', `${BASE_URL}/trade/my-trades`)}
    `),
  });
};

exports.sendTradeConfirmedByPartyEmail = async (otherEmail, confirmerUsername, otherUsername, trade) => {
  await transporter.sendMail({
    from,
    to: otherEmail,
    subject: `${confirmerUsername} confirmed the trade — SoulTrader`,
    html: emailWrapper('Trade Confirmation', `
      <p style="color:#999;margin-bottom:1rem;"><strong style="color:#e8e8e8;">${confirmerUsername}</strong> has confirmed the <strong style="color:#e8e8e8;">${trade.game}</strong> trade. Please log in to confirm your side.</p>
      ${emailButton('Confirm Now', `${BASE_URL}/trade/my-trades`)}
    `),
  });
};

exports.sendTradeCompletedEmail = async (email, username, partnerUsername, trade) => {
  await transporter.sendMail({
    from,
    to: email,
    subject: 'Trade Complete — Please Rate Your Partner — SoulTrader',
    html: emailWrapper('Trade Complete', `
      <p style="color:#999;margin-bottom:1rem;">Your <strong style="color:#e8e8e8;">${trade.game}</strong> trade with <strong style="color:#e8e8e8;">${partnerUsername}</strong> is now complete.</p>
      <p style="color:#999;margin-bottom:1rem;">Please rate your trade partner to update their reputation.</p>
      ${emailButton('Rate Partner', `${BASE_URL}/trade/my-trades`)}
    `),
  });
};

exports.sendTradeDeclinedEmail = async (acceptorEmail, acceptorUsername, creatorUsername, trade) => {
  await transporter.sendMail({
    from,
    to: acceptorEmail,
    subject: 'Trade Declined — SoulTrader',
    html: emailWrapper('Trade Declined', `
      <p style="color:#999;margin-bottom:0.5rem;"><strong style="color:#e8e8e8;">${creatorUsername}</strong> has declined your trade offer for <strong style="color:#e8e8e8;">${trade.game}</strong>.</p>
      ${infoTable([
        ['Offered', formatItems(trade.offeredItems)],
        ['Requested', formatItems(trade.requestedItems)],
      ])}
      ${emailButton('Browse Trades', BASE_URL)}
    `),
  });
};

exports.sendTradeCancelledEmail = async (acceptorEmail, acceptorUsername, creatorUsername, trade) => {
  await transporter.sendMail({
    from,
    to: acceptorEmail,
    subject: 'Trade Cancelled — SoulTrader',
    html: emailWrapper('Trade Cancelled', `
      <p style="color:#999;margin-bottom:0.5rem;"><strong style="color:#e8e8e8;">${creatorUsername}</strong> has cancelled the <strong style="color:#e8e8e8;">${trade.game}</strong> trade.</p>
      ${infoTable([
        ['Offered', formatItems(trade.offeredItems)],
        ['Requested', formatItems(trade.requestedItems)],
      ])}
      ${emailButton('Browse Trades', BASE_URL)}
    `),
  });
};

exports.sendTradeExpiredEmail = async (email, username, trade) => {
  await transporter.sendMail({
    from,
    to: email,
    subject: 'Trade Expired — SoulTrader',
    html: emailWrapper('Trade Expired', `
      <p style="color:#999;margin-bottom:0.5rem;">Your <strong style="color:#e8e8e8;">${trade.game}</strong> trade has expired after 14 days without completion.</p>
      ${infoTable([
        ['Offered', formatItems(trade.offeredItems)],
        ['Requested', formatItems(trade.requestedItems)],
      ])}
      <p style="color:#999;font-size:0.85rem;margin-bottom:1rem;">You can create a new trade listing at any time.</p>
      ${emailButton('Create New Trade', BASE_URL)}
    `),
  });
};

exports.sendOfferDeclinedEmail = async (offererEmail, offererUsername, creatorUsername, trade) => {
  await transporter.sendMail({
    from,
    to: offererEmail,
    subject: 'Trade Offer Rejected — SoulTrader',
    html: emailWrapper('Offer Rejected', `
      <p style="color:#999;margin-bottom:0.5rem;"><strong style="color:#e8e8e8;">${creatorUsername}</strong> has rejected your offer on their <strong style="color:#e8e8e8;">${trade.game}</strong> trade.</p>
      ${infoTable([
        ['They Offered', formatItems(trade.offeredItems)],
        ['They Wanted', formatItems(trade.requestedItems)],
      ])}
      ${emailButton('Browse Trades', BASE_URL)}
    `),
  });
};

exports.sendRoleChangedEmail = async (email, username, newRole) => {
  const roleDisplay = {
    moderator: 'Moderator',
    admin: 'Admin',
    super_admin: 'Super Admin',
  };
  const roleName = roleDisplay[newRole] || newRole;
  const roleColor = {
    moderator: '#5b9bff',
    admin: '#fa9cff',
    super_admin: '#b388ff',
  }[newRole] || '#c8a84e';

  await transporter.sendMail({
    from,
    to: email,
    subject: `You've been promoted to ${roleName} — SoulTrader`,
    html: emailWrapper('New Role Assigned', `
      <p style="color:#999;margin-bottom:1rem;">Congratulations, <strong style="color:#e8e8e8;">${username}</strong>! You have been promoted to <strong style="color:${roleColor};">${roleName}</strong> on SoulTrader.</p>
      <p style="color:#999;margin-bottom:1rem;">Thank you for being a valued member of the community.</p>
      ${emailButton('Visit SoulTrader', BASE_URL)}
    `),
  });
};
