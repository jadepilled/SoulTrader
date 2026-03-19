const express = require('express');
const passport = require('passport');
const router = express.Router();
const { User } = require('../models');
const { ensureAuthenticated } = require('../middleware/roleMiddleware');

// ─── Steam OAuth ─────────────────────────────────────────────────────────────

// Initiate Steam linking (user must be logged in)
router.get('/steam', ensureAuthenticated, passport.authenticate('steam'));

// Steam callback
router.get('/steam/callback',
  passport.authenticate('steam', { failureRedirect: '/profile?error=steam_link_failed' }),
  (req, res) => {
    res.redirect('/profile?linked=steam');
  }
);

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
