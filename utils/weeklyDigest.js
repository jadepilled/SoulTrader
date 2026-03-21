/**
 * Weekly digest — sends email to users with unread messages or unactioned trades.
 * Can be called from a cron job or scheduled task.
 */
const { User, Message, Trade } = require('../models');
const { Op } = require('sequelize');
const { sendWeeklyDigestEmail } = require('./messageEmailService');

async function sendWeeklyDigests() {
  console.log('[WeeklyDigest] Starting weekly digest run...');

  try {
    const users = await User.findAll({
      where: {
        isVerified: true,
        isBanned: { [Op.or]: [false, null] },
      },
      attributes: ['id', 'email', 'username'],
    });

    let sent = 0;
    for (const user of users) {
      try {
        // Count unread messages
        const unreadCount = await Message.count({
          where: { recipientId: user.id, readAt: null },
        });

        // Count trades awaiting their action
        const pendingTradeCount = await Trade.count({
          where: {
            status: 'awaiting_confirmation',
            [Op.or]: [
              { offerCreatorId: user.id, creatorConfirmed: false },
              { acceptorId: user.id, acceptorConfirmed: false },
            ],
          },
        });

        if (unreadCount > 0 || pendingTradeCount > 0) {
          await sendWeeklyDigestEmail(user.email, user.username, unreadCount, pendingTradeCount);
          sent++;
        }
      } catch (err) {
        console.error(`[WeeklyDigest] Error processing user ${user.username}:`, err.message);
      }
    }

    console.log(`[WeeklyDigest] Complete. Sent ${sent} digest emails.`);
    return sent;
  } catch (err) {
    console.error('[WeeklyDigest] Fatal error:', err);
    throw err;
  }
}

module.exports = { sendWeeklyDigests };
