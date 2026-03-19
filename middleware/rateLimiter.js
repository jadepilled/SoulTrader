const rateLimit = require('express-rate-limit');

exports.tradeCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many trade offers created. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

exports.tradeAcceptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many trade acceptances. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

exports.loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many login attempts. Please try again in a minute.',
  standardHeaders: true,
  legacyHeaders: false,
});

exports.signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many signup attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
