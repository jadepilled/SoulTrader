const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { User } = require('../models');
const { signup, verifyEmail } = require('../controllers/authController');
const { loginLimiter, signupLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// POST /auth/signup
router.post('/signup', signupLimiter, signup);

// GET /auth/verify/:token
router.get('/verify/:token', verifyEmail);

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

    if (!user.isVerified) {
      return res.redirect('/?error=notVerified');
    }

    if (user.isBanned) {
      return res.redirect('/?error=banned');
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

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
