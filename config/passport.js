const SteamStrategy = require('passport-steam').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const { User } = require('../models');

module.exports = (passport) => {
  // Steam OpenID 2.0
  if (process.env.STEAM_API_KEY) {
    passport.use(new SteamStrategy({
      returnURL: `${process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:5000'}/auth/steam/callback`,
      realm: process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:5000',
      apiKey: process.env.STEAM_API_KEY,
      passReqToCallback: true,
    }, async (req, identifier, profile, done) => {
      try {
        const steamId = profile.id;
        const steamUsername = profile.displayName;

        // Check if this Steam account is already linked to another user
        const existingLink = await User.findOne({ where: { steamId } });
        if (existingLink && existingLink.id !== req.user.id) {
          return done(null, false, { message: 'This Steam account is already linked to another SoulTrader account.' });
        }

        // Link to the current user
        req.user.steamId = steamId;
        req.user.steamUsername = steamUsername;
        await req.user.save();

        return done(null, req.user);
      } catch (err) {
        return done(err);
      }
    }));
  }

  // Discord OAuth2
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    passport.use(new DiscordStrategy({
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: `${process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:5000'}/auth/discord/callback`,
      scope: ['identify'],
      passReqToCallback: true,
    }, async (req, accessToken, refreshToken, profile, done) => {
      try {
        const discordId = profile.id;
        const discordUsername = `${profile.username}`;

        // Check if this Discord account is already linked to another user
        const existingLink = await User.findOne({ where: { discordId } });
        if (existingLink && existingLink.id !== req.user.id) {
          return done(null, false, { message: 'This Discord account is already linked to another SoulTrader account.' });
        }

        // Link to the current user
        req.user.discordId = discordId;
        req.user.discordUsername = discordUsername;
        await req.user.save();

        return done(null, req.user);
      } catch (err) {
        return done(err);
      }
    }));
  }

  // Serialize/deserialize for the OAuth flow only
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findByPk(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
