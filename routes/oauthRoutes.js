const express = require('express');
const passport = require('passport');
const router = express.Router();
const { User } = require('../models');
const { ensureAuthenticated } = require('../middleware/roleMiddleware');

// ─── Steam OAuth ─────────────────────────────────────────────────────────────

// Initiate Steam linking (user must be logged in)
router.get('/steam', ensureAuthenticated, (req, res, next) => {
  // Store user ID in session so it persists through the OpenID dance
  req.session.steamLinkUserId = req.user.id;
  passport.authenticate('steam')(req, res, next);
});

// Steam callback
router.get('/steam/callback', (req, res, next) => {
  passport.authenticate('steam', async (err, user, info) => {
    if (err) {
      console.error('Steam OAuth error:', err);
      return res.redirect('/profile?error=steam_link_failed');
    }
    if (!user) {
      console.error('Steam OAuth: no user returned', info);
      // Fallback: try linking via session-stored user ID
      if (req.session && req.session.steamLinkUserId) {
        try {
          const fallbackUser = await User.findByPk(req.session.steamLinkUserId);
          if (fallbackUser) {
            delete req.session.steamLinkUserId;
            return res.redirect('/profile?linked=steam');
          }
        } catch (e) {
          console.error('Steam fallback error:', e);
        }
      }
      return res.redirect('/profile?error=steam_link_failed');
    }
    delete req.session.steamLinkUserId;
    res.redirect('/profile?linked=steam');
  })(req, res, next);
});

// Unlink Steam
router.post('/unlink/steam', ensureAuthenticated, async (req, res) => {
  try {
    req.user.steamId = null;
    req.user.steamUsername = null;
    await req.user.save();
    res.redirect('/profile?unlinked=steam');
  } catch (err) {
    console.error('Error unlinking Steam:', err);
    res.redirect('/profile?error=unlink_failed');
  }
});

// ─── Discord OAuth ───────────────────────────────────────────────────────────

// Initiate Discord linking (user must be logged in)
router.get('/discord', ensureAuthenticated, passport.authenticate('discord'));

// Discord callback
router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/profile?error=discord_link_failed' }),
  (req, res) => {
    res.redirect('/profile?linked=discord');
  }
);

// Unlink Discord
router.post('/unlink/discord', ensureAuthenticated, async (req, res) => {
  try {
    req.user.discordId = null;
    req.user.discordUsername = null;
    await req.user.save();
    res.redirect('/profile?unlinked=discord');
  } catch (err) {
    console.error('Error unlinking Discord:', err);
    res.redirect('/profile?error=unlink_failed');
  }
});

module.exports = router;
