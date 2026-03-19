const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { sendVerificationEmail } = require('../utils/emailService');

exports.signup = async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.redirect('/?error=missing-fields');
    }

    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.redirect('/?error=emailInUse');
    }

    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) {
      return res.redirect('/?error=usernameInUse');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    await User.create({
      email,
      password: hashedPassword,
      username,
      isVerified: false,
      verificationToken,
    });

    await sendVerificationEmail(email, verificationToken);

    return res.redirect('/?signup=success');
  } catch (err) {
    console.error('Signup error:', err);
    return res.redirect('/?error=server');
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ where: { verificationToken: token } });
    if (!user) {
      return res.redirect('/?error=invalidToken');
    }

    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    return res.redirect('/?signup=verified');
  } catch (err) {
    console.error('Email verification error:', err);
    return res.redirect('/?error=server');
  }
};
