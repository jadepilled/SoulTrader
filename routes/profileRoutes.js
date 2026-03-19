const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { User, Trade } = require('../models');
const { ensureAuthenticated } = require('../middleware/roleMiddleware');
const { getUsernameStyle, gameConfigs } = require('../controllers/gameController');
const { profileUpdateLimiter } = require('../middleware/rateLimiter');

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
        'steamId', 'discordId', 'createdAt',
        'contactDiscord', 'contactSteam', 'contactPSN', 'contactXbox',
      ],
    });

    if (!user) {
      return res.status(404).send('User not found.');
    }

    // Count trades
    const completedTradeCount = await Trade.count({
      where: {
        status: 'completed',
        [require('sequelize').Op.or]: [
          { offerCreatorId: user.id },
          { acceptorId: user.id },
        ],
      },
    });

    const totalKarma = user.positiveKarma - user.negativeKarma;
    const totalRatings = user.positiveKarma + user.negativeKarma;
    const positivePercent = totalRatings > 0
      ? Math.round((user.positiveKarma / totalRatings) * 100)
      : 0;

    const isOwnProfile = req.user && req.user.id === user.id;

    res.render('profile', {
      profileUser: user,
      completedTradeCount,
      totalKarma,
      positivePercent,
      isOwnProfile,
      userId: req.user ? req.user.id : null,
      username: req.user ? req.user.username : null,
      role: req.user ? req.user.role : 'user',
      karma: req.user ? (req.user.positiveKarma - req.user.negativeKarma) : 0,
      usernameStyle: getUsernameStyle(req.user ? req.user.role : 'user'),
      getUsernameStyle,
      gameConfigs,
      query: req.query,
    });
  } catch (err) {
    console.error('Error loading profile:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Update bio ──────────────────────────────────────────────────────────────
router.post('/update', ensureAuthenticated, profileUpdateLimiter, async (req, res) => {
  try {
    const { bio } = req.body;
    req.user.bio = bio ? bio.substring(0, 500) : '';
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
