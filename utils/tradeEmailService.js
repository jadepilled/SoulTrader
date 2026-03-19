const { transporter } = require('./emailService');

const from = `SoulTrader <${process.env.EMAIL_USER}>`;

exports.sendTradeAcceptedEmail = async (creatorEmail, creatorUsername, acceptorUsername, trade, contactInfo) => {
  await transporter.sendMail({
    from,
    to: creatorEmail,
    subject: `${acceptorUsername} wants to trade - SoulTrader`,
    html: `
      <h2>Trade Acceptance on SoulTrader</h2>
      <p><strong>${acceptorUsername}</strong> has accepted your trade request for <strong>${trade.game}</strong>!</p>
      <hr>
      <p><strong>Preferred Meeting Point:</strong> ${contactInfo.meetingPoint || 'Not specified'}</p>
      <p><strong>Discord:</strong> ${contactInfo.discordName || 'Not provided'}</p>
      <p><strong>In-Game Name:</strong> ${contactInfo.inGameName || 'Not specified'}</p>
      <p><strong>Additional Info:</strong> ${contactInfo.additionalInfo || 'None'}</p>
      <hr>
      <p><strong>Offered Items:</strong> ${trade.offeredItems}</p>
      <p><strong>Requested Items:</strong> ${trade.requestedItems}</p>
      <hr>
      <p>Log in to <a href="https://soultrader.gg/trade/my-trades">SoulTrader</a> to confirm or decline this trade.</p>
      <p><em>Remember to backup your save before trading.</em></p>
    `,
  });
};

exports.sendTradeConfirmedByPartyEmail = async (otherEmail, confirmerUsername, otherUsername, trade) => {
  await transporter.sendMail({
    from,
    to: otherEmail,
    subject: `${confirmerUsername} confirmed the trade - SoulTrader`,
    html: `
      <h2>Trade Confirmation Update</h2>
      <p><strong>${confirmerUsername}</strong> has confirmed the trade for <strong>${trade.game}</strong>.</p>
      <p>Log in to <a href="https://soultrader.gg/trade/my-trades">SoulTrader</a> to confirm your side of the trade.</p>
    `,
  });
};

exports.sendTradeCompletedEmail = async (email, username, partnerUsername, trade) => {
  await transporter.sendMail({
    from,
    to: email,
    subject: 'Trade Completed - Please Rate Your Partner - SoulTrader',
    html: `
      <h2>Trade Completed!</h2>
      <p>Your trade with <strong>${partnerUsername}</strong> for <strong>${trade.game}</strong> is now complete.</p>
      <p>Please log in to <a href="https://soultrader.gg/trade/my-trades">SoulTrader</a> and rate your trade partner to update their karma!</p>
    `,
  });
};

exports.sendTradeDeclinedEmail = async (acceptorEmail, acceptorUsername, creatorUsername, trade) => {
  await transporter.sendMail({
    from,
    to: acceptorEmail,
    subject: 'Trade Declined - SoulTrader',
    html: `
      <h2>Trade Declined</h2>
      <p><strong>${creatorUsername}</strong> has declined the trade for <strong>${trade.game}</strong>.</p>
      <p><strong>Offered:</strong> ${trade.offeredItems}</p>
      <p><strong>Requested:</strong> ${trade.requestedItems}</p>
      <p>Browse more trades on <a href="https://soultrader.gg">SoulTrader</a>.</p>
    `,
  });
};

exports.sendTradeCancelledEmail = async (acceptorEmail, acceptorUsername, creatorUsername, trade) => {
  await transporter.sendMail({
    from,
    to: acceptorEmail,
    subject: 'Trade Cancelled - SoulTrader',
    html: `
      <h2>Trade Cancelled</h2>
      <p><strong>${creatorUsername}</strong> has cancelled the trade for <strong>${trade.game}</strong>.</p>
      <p><strong>Offered:</strong> ${trade.offeredItems}</p>
      <p><strong>Requested:</strong> ${trade.requestedItems}</p>
      <p>Browse more trades on <a href="https://soultrader.gg">SoulTrader</a>.</p>
    `,
  });
};
