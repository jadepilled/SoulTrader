const express = require('express');
const router = express.Router();
const { Report, User, Message } = require('../models');
const { ensureAuthenticated, ensureVerified } = require('../middleware/roleMiddleware');
const rateLimit = require('express-rate-limit');

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many reports. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Report a user ──────────────────────────────────────────────────────────
router.post('/user/:userId', ensureAuthenticated, ensureVerified, reportLimiter, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length === 0) {
      return res.status(400).send('A reason is required.');
    }
    if (reason.length > 500) {
      return res.status(400).send('Reason too long (max 500 characters).');
    }

    const reportedUser = await User.findByPk(req.params.userId, { attributes: ['id', 'username'] });
    if (!reportedUser) return res.status(404).send('User not found.');
    if (reportedUser.id === req.user.id) return res.status(400).send('You cannot report yourself.');

    // Prevent duplicate pending reports
    const existing = await Report.findOne({
      where: {
        reporterId: req.user.id,
        reportedUserId: reportedUser.id,
        type: 'user',
        status: 'pending',
      },
    });
    if (existing) {
      return res.status(400).send('You already have a pending report for this user.');
    }

    await Report.create({
      reason: reason.trim(),
      type: 'user',
      reporterId: req.user.id,
      reportedUserId: reportedUser.id,
    });

    res.redirect(`/profile/${reportedUser.username}?success=${encodeURIComponent('User reported.')}`);
  } catch (err) {
    console.error('Error reporting user:', err);
    res.status(500).send('Server error.');
  }
});

module.exports = router;
