const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Friendship, BlockedUser, User, Report } = require('../models');
const { ensureAuthenticated, ensureVerified } = require('../middleware/roleMiddleware');
const { getUsernameStyle, gameConfigs } = require('../controllers/gameController');
const { sendFriendRequestEmail } = require('../utils/friendEmailService');

// Staff roles that cannot be blocked by regular users
const STAFF_ROLES = ['moderator', 'admin', 'super_admin'];

// ─── Send friend request ────────────────────────────────────────────────────
router.post('/request/:username', ensureAuthenticated, ensureVerified, async (req, res) => {
  try {
    const targetUser = await User.findOne({ where: { username: req.params.username } });
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });
    if (targetUser.id === req.user.id) return res.status(400).json({ error: 'You cannot add yourself.' });

    // Check if blocked
    const blocked = await BlockedUser.findOne({
      where: {
        [Op.or]: [
          { blockerId: req.user.id, blockedId: targetUser.id },
          { blockerId: targetUser.id, blockedId: req.user.id },
        ],
      },
    });
    if (blocked) return res.status(400).json({ error: 'Cannot send friend request to this user.' });

    // Check if friendship already exists
    const existing = await Friendship.findOne({
      where: {
        [Op.or]: [
          { requesterId: req.user.id, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: req.user.id },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(400).json({ error: 'You are already friends.' });
      }
      if (existing.status === 'pending') {
        // If they sent us a request, auto-accept it
        if (existing.requesterId === targetUser.id) {
          existing.status = 'accepted';
          await existing.save();
          return res.json({ success: true, message: 'Friend request accepted!' });
        }
        return res.status(400).json({ error: 'Friend request already sent.' });
      }
      if (existing.status === 'declined') {
        // Allow re-sending after decline
        existing.status = 'pending';
        existing.requesterId = req.user.id;
        existing.addresseeId = targetUser.id;
        await existing.save();

        // Send email notification
        if (targetUser.email) {
          sendFriendRequestEmail(targetUser.email, targetUser.username, req.user.username)
            .catch(err => console.error('Friend request email failed:', err));
        }

        return res.json({ success: true, message: 'Friend request sent!' });
      }
    }

    // Create new friendship request
    await Friendship.create({
      requesterId: req.user.id,
      addresseeId: targetUser.id,
      status: 'pending',
    });

    // Send email notification
    if (targetUser.email) {
      sendFriendRequestEmail(targetUser.email, targetUser.username, req.user.username)
        .catch(err => console.error('Friend request email failed:', err));
    }

    return res.json({ success: true, message: 'Friend request sent!' });
  } catch (err) {
    console.error('Error sending friend request:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Accept friend request ──────────────────────────────────────────────────
router.post('/accept/:friendshipId', ensureAuthenticated, async (req, res) => {
  try {
    const friendship = await Friendship.findByPk(req.params.friendshipId);
    if (!friendship) return res.status(404).json({ error: 'Request not found.' });
    if (friendship.addresseeId !== req.user.id) return res.status(403).json({ error: 'Not your request.' });
    if (friendship.status !== 'pending') return res.status(400).json({ error: 'Request already processed.' });

    friendship.status = 'accepted';
    await friendship.save();
    return res.json({ success: true });
  } catch (err) {
    console.error('Error accepting friend request:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Decline friend request ─────────────────────────────────────────────────
router.post('/decline/:friendshipId', ensureAuthenticated, async (req, res) => {
  try {
    const friendship = await Friendship.findByPk(req.params.friendshipId);
    if (!friendship) return res.status(404).json({ error: 'Request not found.' });
    if (friendship.addresseeId !== req.user.id) return res.status(403).json({ error: 'Not your request.' });
    if (friendship.status !== 'pending') return res.status(400).json({ error: 'Request already processed.' });

    friendship.status = 'declined';
    await friendship.save();
    return res.json({ success: true });
  } catch (err) {
    console.error('Error declining friend request:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Remove friend ──────────────────────────────────────────────────────────
router.post('/remove/:username', ensureAuthenticated, async (req, res) => {
  try {
    const targetUser = await User.findOne({ where: { username: req.params.username } });
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    const friendship = await Friendship.findOne({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requesterId: req.user.id, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: req.user.id },
        ],
      },
    });
    if (!friendship) return res.status(400).json({ error: 'Not friends.' });

    await friendship.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error('Error removing friend:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Block user ─────────────────────────────────────────────────────────────
router.post('/block/:username', ensureAuthenticated, async (req, res) => {
  try {
    const targetUser = await User.findOne({ where: { username: req.params.username } });
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });
    if (targetUser.id === req.user.id) return res.status(400).json({ error: 'You cannot block yourself.' });

    // Regular users cannot block staff members
    if (STAFF_ROLES.includes(targetUser.role) && !STAFF_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'You cannot block staff members.' });
    }

    // Check if already blocked
    const existing = await BlockedUser.findOne({
      where: { blockerId: req.user.id, blockedId: targetUser.id },
    });
    if (existing) return res.status(400).json({ error: 'User already blocked.' });

    // Block the user
    await BlockedUser.create({
      blockerId: req.user.id,
      blockedId: targetUser.id,
    });

    // Also remove any friendship between them
    await Friendship.destroy({
      where: {
        [Op.or]: [
          { requesterId: req.user.id, addresseeId: targetUser.id },
          { requesterId: targetUser.id, addresseeId: req.user.id },
        ],
      },
    });

    // If the user also wants to report, handle via reportReason body param
    const { reportReason } = req.body;
    if (reportReason && reportReason.trim().length > 0) {
      await Report.create({
        reason: reportReason.trim().substring(0, 500),
        type: 'user',
        reporterId: req.user.id,
        reportedUserId: targetUser.id,
      });
    }

    return res.json({ success: true, message: 'User blocked.' });
  } catch (err) {
    console.error('Error blocking user:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Unblock user ───────────────────────────────────────────────────────────
router.post('/unblock/:username', ensureAuthenticated, async (req, res) => {
  try {
    const targetUser = await User.findOne({ where: { username: req.params.username } });
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    const block = await BlockedUser.findOne({
      where: { blockerId: req.user.id, blockedId: targetUser.id },
    });
    if (!block) return res.status(400).json({ error: 'User not blocked.' });

    await block.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error('Error unblocking user:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
