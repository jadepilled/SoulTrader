const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { User, Trade, Comment, Friendship, BlockedUser } = require('../models');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/roleMiddleware');
const { getUsernameStyle, gameConfigs } = require('../controllers/gameController');
const { profileUpdateLimiter } = require('../middleware/rateLimiter');
const { computeBadges, getAvailableDisplayRoles, resolveDisplayRole } = require('../utils/badges');

// Configure multer for memory storage (we'll process with sharp before saving)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed.'));
    }
  },
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── User preview card (JSON — for hover card) ───────────────────────────────
router.get('/preview/:username', async (req, res) => {
  try {
    const user = await User.findOne({
      where: { username: req.params.username },
      attributes: ['id', 'username', 'role', 'positiveKarma', 'negativeKarma', 'profileImagePath', 'createdAt', 'isVerified', 'isBanned', 'isSponsor'],
    });
    if (!user) return res.status(404).json({ error: 'Not found' });

    const { Op } = require('sequelize');
    const completedTradeCount = await Trade.count({
      where: {
        status: 'completed',
        [Op.or]: [{ offerCreatorId: user.id }, { acceptorId: user.id }],
      },
    });

    const badges = computeBadges(user, completedTradeCount);

    res.json({
      username:            user.username,
      role:                user.role,
      positiveKarma:       user.positiveKarma,
      negativeKarma:       user.negativeKarma,
      profileImagePath:    user.profileImagePath,
      completedTradeCount,
      createdAt:           user.createdAt,
      badges,
    });
  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── View own profile (redirect) ────────────────────────────────────────────
router.get('/', ensureAuthenticated, (req, res) => {
  res.redirect(`/profile/${req.user.username}`);
});

// ─── View user profile ──────────────────────────────────────────────────────
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({
      where: { username: req.params.username },
      attributes: [
        'id', 'username', 'role', 'positiveKarma', 'negativeKarma',
        'bio', 'profileImagePath', 'steamUsername', 'discordUsername',
        'steamId', 'discordId', 'createdAt', 'isVerified', 'isBanned', 'isSponsor',
        'contactDiscord', 'contactSteam', 'contactPSN', 'contactXbox', 'lastOnline',
        'hideDiscord', 'hideSteam', 'hidePSN', 'hideXbox', 'displayRole',
        'timezone', 'hideTimezone',
      ],
    });

    if (!user) {
      return res.status(404).send('User not found.');
    }

    const { Op } = require('sequelize');

    // Count trades
    const completedTradeCount = await Trade.count({
      where: {
        status: 'completed',
        [Op.or]: [
          { offerCreatorId: user.id },
          { acceptorId: user.id },
        ],
      },
    });

    // Recent completed trades for trade history
    const recentTrades = await Trade.findAll({
      where: {
        status: 'completed',
        [Op.or]: [
          { offerCreatorId: user.id },
          { acceptorId: user.id },
        ],
      },
      include: [
        { model: User, as: 'offerCreator', attributes: ['username', 'role'] },
        { model: User, as: 'acceptor',     attributes: ['username', 'role'] },
      ],
      order: [['updatedAt', 'DESC']],
      limit: 5,
    });

    const totalKarma = user.positiveKarma - 2 * user.negativeKarma;
    const totalRatings = user.positiveKarma + user.negativeKarma;
    const positivePercent = totalRatings > 0
      ? Math.round((user.positiveKarma / totalRatings) * 100)
      : 0;

    const isOwnProfile = req.user && req.user.id === user.id;

    // Compute badges
    const badges = computeBadges(user, completedTradeCount);

    // Fetch trade feedback (comments left via rating system about this user)
    const tradeFeedback = await Trade.findAll({
      where: {
        status: 'completed',
        [Op.or]: [
          // Feedback left BY creator ABOUT this user (who was acceptor)
          { acceptorId: user.id, tradeFeedbackCreator: { [Op.ne]: null } },
          // Feedback left BY acceptor ABOUT this user (who was creator)
          { offerCreatorId: user.id, tradeFeedbackAcceptor: { [Op.ne]: null } },
        ],
      },
      include: [
        { model: User, as: 'offerCreator', attributes: ['username', 'role'] },
        { model: User, as: 'acceptor', attributes: ['username', 'role'] },
      ],
      order: [['updatedAt', 'DESC']],
      limit: 20,
    });

    // Transform trade feedback into a displayable format
    const feedbackItems = [];
    tradeFeedback.forEach(t => {
      if (t.acceptorId === user.id && t.tradeFeedbackCreator) {
        feedbackItems.push({
          authorUsername: t.offerCreator ? t.offerCreator.username : 'Unknown',
          authorRole: t.offerCreator ? t.offerCreator.role : 'user',
          content: t.tradeFeedbackCreator,
          rating: t.creatorRatingValue || null,
          date: t.updatedAt,
          game: t.game,
          type: 'trade_feedback',
          tradeId: t.id,
          party: 'creator',
        });
      }
      if (t.offerCreatorId === user.id && t.tradeFeedbackAcceptor) {
        feedbackItems.push({
          authorUsername: t.acceptor ? t.acceptor.username : 'Unknown',
          authorRole: t.acceptor ? t.acceptor.role : 'user',
          content: t.tradeFeedbackAcceptor,
          rating: t.acceptorRatingValue || null,
          date: t.updatedAt,
          game: t.game,
          type: 'trade_feedback',
          tradeId: t.id,
          party: 'acceptor',
        });
      }
    });

    // Paginated comments
    const commentPage = Math.max(1, parseInt(req.query.commentPage, 10) || 1);
    const commentsPerPage = 10;
    const totalComments = await Comment.count({ where: { profileUserId: user.id } });
    const totalCommentPages = Math.ceil(totalComments / commentsPerPage) || 1;

    const comments = await Comment.findAll({
      where: { profileUserId: user.id },
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'role', 'profileImagePath'] }],
      order: [['createdAt', 'DESC']],
      limit: commentsPerPage,
      offset: (commentPage - 1) * commentsPerPage,
    });

    // Pending trade count for navbar
    let pendingTradeCount = 0;
    if (req.user) {
      pendingTradeCount = await Trade.count({
        where: {
          status: 'awaiting_confirmation',
          [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }],
        },
      });
    }

    // Resolve display role (validate it's still earned)
    const resolvedDisplayRole = resolveDisplayRole(user.displayRole, user, completedTradeCount);
    // If stored display role is no longer valid, clear it
    if (user.displayRole && !resolvedDisplayRole) {
      user.displayRole = null;
      user.save().catch(() => {});
    }

    // Available display roles for own profile selector
    const availableDisplayRoles = isOwnProfile
      ? getAvailableDisplayRoles(user, completedTradeCount)
      : [];

    // Friends list for this profile
    const friendships = await Friendship.findAll({
      where: {
        status: 'accepted',
        [Op.or]: [{ requesterId: user.id }, { addresseeId: user.id }],
      },
      include: [
        { model: User, as: 'requester', attributes: ['id', 'username', 'profileImagePath', 'role'] },
        { model: User, as: 'addressee', attributes: ['id', 'username', 'profileImagePath', 'role'] },
      ],
    });
    const friendsList = friendships.map(f => {
      return f.requesterId === user.id ? f.addressee : f.requester;
    }).filter(f => f);

    // Friendship status between viewer and profile owner
    let friendshipStatus = null; // null = no relation, 'pending_sent', 'pending_received', 'accepted'
    let friendshipId = null;
    if (req.user && !isOwnProfile) {
      const friendship = await Friendship.findOne({
        where: {
          [Op.or]: [
            { requesterId: req.user.id, addresseeId: user.id },
            { requesterId: user.id, addresseeId: req.user.id },
          ],
        },
      });
      if (friendship) {
        friendshipId = friendship.id;
        if (friendship.status === 'accepted') {
          friendshipStatus = 'accepted';
        } else if (friendship.status === 'pending') {
          friendshipStatus = friendship.requesterId === req.user.id ? 'pending_sent' : 'pending_received';
        }
      }
    }

    // Block status
    let isBlocked = false;
    let isBlockedBy = false;
    if (req.user && !isOwnProfile) {
      const blockOut = await BlockedUser.findOne({ where: { blockerId: req.user.id, blockedId: user.id } });
      const blockIn = await BlockedUser.findOne({ where: { blockerId: user.id, blockedId: req.user.id } });
      isBlocked = !!blockOut;
      isBlockedBy = !!blockIn;
    }

    // Pending friend requests (for own profile)
    let pendingFriendRequests = [];
    if (isOwnProfile) {
      pendingFriendRequests = await Friendship.findAll({
        where: { addresseeId: user.id, status: 'pending' },
        include: [{ model: User, as: 'requester', attributes: ['id', 'username', 'profileImagePath', 'role'] }],
        order: [['createdAt', 'DESC']],
      });
    }

    res.render('profile', {
      profileUser: user,
      completedTradeCount,
      totalKarma,
      positivePercent,
      recentTrades,
      isOwnProfile,
      badges,
      comments,
      commentPage,
      totalCommentPages,
      totalComments,
      feedbackItems,
      resolvedDisplayRole,
      availableDisplayRoles,
      userId: req.user ? req.user.id : null,
      username: req.user ? req.user.username : null,
      role: req.user ? req.user.role : 'user',
      karma: req.user ? (req.user.positiveKarma - 2 * req.user.negativeKarma) : 0,
      usernameStyle: getUsernameStyle(req.user ? req.user.role : 'user'),
      getUsernameStyle,
      gameConfigs,
      pendingTradeCount,
      query: req.query,
      friendsList,
      friendshipStatus,
      friendshipId,
      isBlocked,
      isBlockedBy,
      pendingFriendRequests,
    });
  } catch (err) {
    console.error('Error loading profile:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Update bio ──────────────────────────────────────────────────────────────
router.post('/update', ensureAuthenticated, profileUpdateLimiter, async (req, res) => {
  try {
    let { bio } = req.body;
    if (bio) {
      bio = bio.substring(0, 500);
      // Strip URLs/links but preserve line breaks
      bio = bio.replace(/https?:\/\/[^\s]+/gi, '')
               .replace(/www\.[^\s]+/gi, '')
               .replace(/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?/gi, '');
    }
    req.user.bio = bio || '';
    await req.user.save();
    res.redirect(`/profile/${req.user.username}?profile=updated`);
  } catch (err) {
    console.error('Error updating profile:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Update contact details ──────────────────────────────────────────────────
router.post('/update-contact', ensureAuthenticated, profileUpdateLimiter, async (req, res) => {
  try {
    const { contactDiscord, contactSteam, contactPSN, contactXbox } = req.body;

    req.user.contactDiscord = contactDiscord ? contactDiscord.substring(0, 100).trim() : null;
    req.user.contactSteam   = contactSteam   ? contactSteam.substring(0, 200).trim()  : null;
    req.user.contactPSN     = contactPSN     ? contactPSN.substring(0, 100).trim()    : null;
    req.user.contactXbox    = contactXbox    ? contactXbox.substring(0, 100).trim()   : null;

    await req.user.save();
    res.redirect(`/profile/${req.user.username}?profile=updated`);
  } catch (err) {
    console.error('Error updating contact details:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Update display role ────────────────────────────────────────────────────
router.post('/update-display-role', ensureAuthenticated, profileUpdateLimiter, async (req, res) => {
  try {
    const { displayRole } = req.body;

    if (!displayRole || displayRole === 'none') {
      // Clear display role
      req.user.displayRole = null;
      await req.user.save();
      return res.redirect(`/profile/${req.user.username}?profile=updated`);
    }

    // Validate the selected role is available to this user
    const { Op } = require('sequelize');
    const completedTradeCount = await Trade.count({
      where: {
        status: 'completed',
        [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }],
      },
    });

    const available = getAvailableDisplayRoles(req.user, completedTradeCount);
    const isValid = available.some(r => r.value === displayRole);

    if (!isValid) {
      return res.status(400).send('You have not unlocked that display role.');
    }

    req.user.displayRole = displayRole;
    await req.user.save();
    res.redirect(`/profile/${req.user.username}?profile=updated`);
  } catch (err) {
    console.error('Error updating display role:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Update privacy settings ────────────────────────────────────────────────
router.post('/update-privacy', ensureAuthenticated, profileUpdateLimiter, async (req, res) => {
  try {
    req.user.hideDiscord = req.body.hideDiscord === 'on';
    req.user.hideSteam   = req.body.hideSteam   === 'on';
    req.user.hidePSN     = req.body.hidePSN     === 'on';
    req.user.hideXbox    = req.body.hideXbox     === 'on';
    await req.user.save();
    res.redirect(`/profile/${req.user.username}?profile=updated`);
  } catch (err) {
    console.error('Error updating privacy settings:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Update timezone ─────────────────────────────────────────────────────────
router.post('/update-timezone', ensureAuthenticated, profileUpdateLimiter, async (req, res) => {
  try {
    const { timezone, hideTimezone } = req.body;

    if (!timezone || !String(timezone).trim()) {
      req.user.timezone = null;
    } else {
      req.user.timezone = String(timezone).substring(0, 100).trim();
    }
    req.user.hideTimezone = hideTimezone === 'on';
    await req.user.save();
    res.redirect(`/profile/${req.user.username}?profile=updated`);
  } catch (err) {
    console.error('Error updating timezone:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Delete trade feedback (admin+ only) ─────────────────────────────────────
router.post('/delete-feedback', ensureAdmin, async (req, res) => {
  try {
    const { tradeId, party } = req.body;
    if (!tradeId || !party) return res.status(400).send('Missing parameters.');

    const trade = await Trade.findByPk(tradeId);
    if (!trade) return res.status(404).send('Trade not found.');

    if (party === 'creator') {
      trade.tradeFeedbackCreator = null;
      trade.creatorRatingValue = null;
    } else if (party === 'acceptor') {
      trade.tradeFeedbackAcceptor = null;
      trade.acceptorRatingValue = null;
    } else {
      return res.status(400).send('Invalid party.');
    }

    await trade.save();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error deleting feedback:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Upload profile image ───────────────────────────────────────────────────
router.post('/upload-image', ensureAuthenticated, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) {
      return res.redirect(`/profile/${req.user.username}?error=no_file`);
    }

    const filename = `${req.user.id}.webp`;
    const outputPath = path.join(uploadsDir, filename);

    // Resize to 500x500 and convert to webp
    await sharp(req.file.buffer)
      .resize(500, 500, { fit: 'cover', position: 'centre' })
      .webp({ quality: 80 })
      .toFile(outputPath);

    req.user.profileImagePath = `/uploads/profiles/${filename}`;
    await req.user.save();

    res.redirect(`/profile/${req.user.username}`);
  } catch (err) {
    console.error('Error uploading profile image:', err);
    res.redirect(`/profile/${req.user.username}?error=upload_failed`);
  }
});

module.exports = router;
