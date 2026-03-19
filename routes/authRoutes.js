const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const {
  signup,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPasswordPage,
  resetPassword,
} = require('../controllers/authController');
const {
  loginLimiter,
  signupLimiter,
  resendVerificationLimiter,
  passwordResetLimiter,
} = require('../middleware/rateLimiter');
const { ensureAuthenticated } = require('../middleware/roleMiddleware');

const router = express.Router();

// POST /auth/signup
router.post('/signup', signupLimiter, signup);

// GET /auth/verify/:token
router.get('/verify/:token', verifyEmail);

// POST /auth/resend-verification
router.post('/resend-verification', ensureAuthenticated, resendVerificationLimiter, resendVerification);

// GET /auth/forgot-password
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password', {
    query: req.query,
    userId: req.user ? req.user.id : null,
    username: req.user ? req.user.username : null,
    role: req.user ? req.user.role : 'user',
  });
});

// POST /auth/forgot-password
router.post('/forgot-password', passwordResetLimiter, forgotPassword);

// GET /auth/reset-password/:token
router.get('/reset-password/:token', resetPasswordPage);

// POST /auth/reset-password/:token
router.post('/reset-password/:token', resetPassword);

// POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.redirect('/?error=missing-fields');
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.redirect('/?error=invalidCredentials');
    }

    if (user.isBanned) {
      return res.redirect('/?error=banned');
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Allow unverified users to log in — they can browse but not trade
    if (!user.isVerified) {
      return res.redirect('/?warning=notVerified');
    }

    return res.redirect('/darksouls');
  } catch (err) {
    console.error('Login error:', err);
    return res.redirect('/?error=server');
  }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  return res.redirect('/');
});

module.exports = router;
