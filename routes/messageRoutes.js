const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Message, User, Report, BlockedUser, Friendship } = require('../models');
const { ensureAuthenticated, ensureVerified } = require('../middleware/roleMiddleware');
const { filterContent } = require('../utils/contentFilter');
const { getUsernameStyle, gameConfigs } = require('../controllers/gameController');
const { sendNewMessageEmail } = require('../utils/messageEmailService');
const rateLimit = require('express-rate-limit');

const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many messages. Please wait a moment.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: build standard view locals for message pages
async function viewLocals(req) {
  const { Trade } = require('../models');
  let pendingTradeCount = 0;
  if (req.user) {
    pendingTradeCount = await Trade.count({
      where: {
        status: 'awaiting_confirmation',
        [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }],
      },
    });
  }
  return {
    userId: req.user ? req.user.id : null,
    username: req.user ? req.user.username : null,
    role: req.user ? req.user.role : 'user',
    gameConfigs,
    getUsernameStyle,
    pendingTradeCount,
    query: req.query,
  };
}

// ─── Inbox — list conversations ─────────────────────────────────────────────
router.get('/', ensureAuthenticated, ensureVerified, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get blocked user IDs (both directions)
    const blocks = await BlockedUser.findAll({
      where: {
        [Op.or]: [{ blockerId: userId }, { blockedId: userId }],
      },
      attributes: ['blockerId', 'blockedId'],
      raw: true,
    });
    const blockedIds = new Set();
    blocks.forEach(b => {
      if (b.blockerId === userId) blockedIds.add(b.blockedId);
      else blockedIds.add(b.blockerId);
    });

    // Find all distinct users the current user has exchanged messages with
    const sent = await Message.findAll({
      where: { senderId: userId, deletedAt: null },
      attributes: ['recipientId'],
      group: ['recipientId'],
      raw: true,
    });
    const received = await Message.findAll({
      where: { recipientId: userId, deletedAt: null },
      attributes: ['senderId'],
      group: ['senderId'],
      raw: true,
    });

    // Collect unique partner IDs (exclude blocked users)
    const partnerIds = new Set();
    sent.forEach(m => { if (!blockedIds.has(m.recipientId)) partnerIds.add(m.recipientId); });
    received.forEach(m => { if (!blockedIds.has(m.senderId)) partnerIds.add(m.senderId); });

    // Build conversation summaries
    const conversations = [];
    for (const partnerId of partnerIds) {
      const otherUser = await User.findByPk(partnerId, {
        attributes: ['id', 'username', 'profileImagePath', 'role'],
      });
      if (!otherUser) continue;

      // Last message between the two users (non-deleted)
      const lastMessage = await Message.findOne({
        where: {
          deletedAt: null,
          [Op.or]: [
            { senderId: userId, recipientId: partnerId },
            { senderId: partnerId, recipientId: userId },
          ],
        },
        order: [['createdAt', 'DESC']],
      });
      if (!lastMessage) continue; // Skip if all messages in thread are deleted

      // Unread count (messages FROM partner that current user hasn't read)
      const unreadCount = await Message.count({
        where: {
          senderId: partnerId,
          recipientId: userId,
          readAt: null,
        },
      });

      conversations.push({
        otherUser,
        lastMessage,
        unreadCount,
      });
    }

    // Sort by most recent message first
    conversations.sort((a, b) => {
      const aDate = a.lastMessage ? a.lastMessage.createdAt : 0;
      const bDate = b.lastMessage ? b.lastMessage.createdAt : 0;
      return bDate - aDate;
    });

    // Get friends list for "New Message" feature
    const friendships = await Friendship.findAll({
      where: {
        status: 'accepted',
        [Op.or]: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: [
        { model: User, as: 'requester', attributes: ['id', 'username', 'profileImagePath', 'role'] },
        { model: User, as: 'addressee', attributes: ['id', 'username', 'profileImagePath', 'role'] },
      ],
    });
    const friends = friendships.map(f => {
      return f.requesterId === userId ? f.addressee : f.requester;
    }).filter(f => f && !blockedIds.has(f.id));

    const locals = await viewLocals(req);
    res.render('messages/inbox', { ...locals, conversations, friends });
  } catch (err) {
    console.error('Error loading inbox:', err);
    res.status(500).send('Server error.');
  }
});

// ─── New message redirect (by username) ─────────────────────────────────────
router.get('/new', ensureAuthenticated, ensureVerified, async (req, res) => {
  const { to } = req.query;
  if (!to || !to.trim()) return res.redirect('/messages');
  const targetUser = await User.findOne({ where: { username: to.trim() }, attributes: ['username'] });
  if (!targetUser) return res.redirect('/messages?error=' + encodeURIComponent('User not found.'));
  if (targetUser.username === req.user.username) return res.redirect('/messages');
  return res.redirect('/messages/' + targetUser.username);
});

// ─── Conversation thread with a specific user ───────────────────────────────
router.get('/:username', ensureAuthenticated, ensureVerified, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUser = await User.findOne({
      where: { username: req.params.username },
      attributes: ['id', 'username', 'profileImagePath', 'role'],
    });
    if (!otherUser) return res.status(404).send('User not found.');
    if (otherUser.id === userId) return res.redirect('/messages');

    // Check if either party has blocked the other
    const blockExists = await BlockedUser.findOne({
      where: {
        [Op.or]: [
          { blockerId: userId, blockedId: otherUser.id },
          { blockerId: otherUser.id, blockedId: userId },
        ],
      },
    });
    if (blockExists) {
      return res.redirect('/messages?error=' + encodeURIComponent('You cannot message this user.'));
    }

    // Mark unread messages from partner as read
    await Message.update(
      { readAt: new Date() },
      {
        where: {
          senderId: otherUser.id,
          recipientId: userId,
          readAt: null,
        },
      }
    );

    // Fetch all messages between the two users
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: userId, recipientId: otherUser.id },
          { senderId: otherUser.id, recipientId: userId },
        ],
      },
      order: [['createdAt', 'ASC']],
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'profileImagePath', 'role'] },
      ],
    });

    const locals = await viewLocals(req);
    res.render('messages/conversation', { ...locals, otherUser, messages });
  } catch (err) {
    console.error('Error loading conversation:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Send a message ─────────────────────────────────────────────────────────
router.post('/:username', ensureAuthenticated, ensureVerified, messageLimiter, async (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).send('Message cannot be empty.');
    }
    if (content.length > 1000) {
      return res.status(400).send('Message too long (max 1000 characters).');
    }

    const result = filterContent(content);
    if (result.blocked) {
      return res.redirect(`/messages/${req.params.username}?error=${encodeURIComponent(result.reason)}`);
    }

    const recipient = await User.findOne({
      where: { username: req.params.username },
      attributes: ['id', 'username'],
    });
    if (!recipient) return res.status(404).send('User not found.');
    if (recipient.id === userId) return res.status(400).send('You cannot message yourself.');

    // Check if either party has blocked the other
    const blockExists = await BlockedUser.findOne({
      where: {
        [Op.or]: [
          { blockerId: userId, blockedId: recipient.id },
          { blockerId: recipient.id, blockedId: userId },
        ],
      },
    });
    if (blockExists) {
      return res.redirect(`/messages/${req.params.username}?error=${encodeURIComponent('You cannot message this user.')}`);
    }

    // Check if this is the first message from this sender to this recipient
    const priorMessageCount = await Message.count({
      where: { senderId: userId, recipientId: recipient.id },
    });

    await Message.create({
      content: result.text,
      senderId: userId,
      recipientId: recipient.id,
    });

    // Send email notification on first message from this user
    if (priorMessageCount === 0) {
      const recipientFull = await User.findByPk(recipient.id, { attributes: ['email', 'username'] });
      if (recipientFull && recipientFull.email) {
        sendNewMessageEmail(recipientFull.email, recipientFull.username, req.user.username)
          .catch(err => console.error('New message email failed:', err));
      }
    }

    res.redirect(`/messages/${recipient.username}`);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Delete entire conversation thread ──────────────────────────────────────
router.post('/delete-thread/:username', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUser = await User.findOne({
      where: { username: req.params.username },
      attributes: ['id'],
    });
    if (!otherUser) return res.status(404).json({ error: 'User not found.' });

    // Soft-delete all messages in this thread (both directions)
    await Message.update(
      { deletedAt: new Date() },
      {
        where: {
          deletedAt: null,
          [Op.or]: [
            { senderId: userId, recipientId: otherUser.id },
            { senderId: otherUser.id, recipientId: userId },
          ],
        },
      }
    );

    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting thread:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Delete a sent message ──────────────────────────────────────────────────
router.post('/delete/:messageId', ensureAuthenticated, async (req, res) => {
  try {
    const message = await Message.findByPk(req.params.messageId);
    if (!message) return res.status(404).json({ error: 'Message not found.' });

    // Only sender can delete their own messages
    if (message.senderId !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete messages you sent.' });
    }

    // Soft delete — mark as deleted but keep in DB for admin review
    message.deletedAt = new Date();
    await message.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('Error deleting message:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Report a message ───────────────────────────────────────────────────────
router.post('/report/:messageId', ensureAuthenticated, ensureVerified, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
      return res.status(400).send('A reason is required.');
    }
    if (reason.length > 500) {
      return res.status(400).send('Reason too long (max 500 characters).');
    }

    const message = await Message.findByPk(req.params.messageId);
    if (!message) return res.status(404).send('Message not found.');

    // Only allow reporting messages you received
    if (message.recipientId !== req.user.id) {
      return res.status(403).send('You can only report messages sent to you.');
    }

    // Prevent duplicate reports
    const existing = await Report.findOne({
      where: {
        reporterId: req.user.id,
        reportedMessageId: message.id,
      },
    });
    if (existing) {
      return res.status(400).send('You have already reported this message.');
    }

    await Report.create({
      reason: reason.trim(),
      type: 'message',
      reporterId: req.user.id,
      reportedUserId: message.senderId,
      reportedMessageId: message.id,
    });

    // Redirect back to the conversation
    const sender = await User.findByPk(message.senderId, { attributes: ['username'] });
    res.redirect(`/messages/${sender ? sender.username : ''}?success=${encodeURIComponent('Message reported.')}`);
  } catch (err) {
    console.error('Error reporting message:', err);
    res.status(500).send('Server error.');
  }
});

module.exports = router;
