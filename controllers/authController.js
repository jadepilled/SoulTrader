const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

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

exports.resendVerification = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/?error=notLoggedIn');
    }

    if (req.user.isVerified) {
      return res.redirect(`/profile/${req.user.username}?error=alreadyVerified`);
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    req.user.verificationToken = verificationToken;
    await req.user.save();

    await sendVerificationEmail(req.user.email, verificationToken);

    return res.redirect('/?signup=resent');
  } catch (err) {
    console.error('Resend verification error:', err);
    return res.redirect('/?error=server');
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.redirect('/auth/forgot-password?error=missing-fields');
    }

    // Always show the same success message to prevent email enumeration
    const user = await User.findOne({ where: { email } });
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      try {
        await sendPasswordResetEmail(email, resetToken);
      } catch (emailErr) {
        console.error('Failed to send password reset email:', emailErr);
      }
    }

    return res.redirect('/auth/forgot-password?signup=resetSent');
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.redirect('/auth/forgot-password?error=server');
  }
};

exports.resetPasswordPage = async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
      },
    });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return res.redirect('/?error=invalidResetToken');
    }

    return res.render('auth/reset-password', {
      token,
      query: req.query,
      userId: null,
      username: null,
      role: 'user',
    });
  } catch (err) {
    console.error('Reset password page error:', err);
    return res.redirect('/?error=server');
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.redirect(`/auth/reset-password/${token}?error=missing-fields`);
    }

    if (password !== confirmPassword) {
      return res.redirect(`/auth/reset-password/${token}?error=passwordMismatch`);
    }

    if (password.length < 8) {
      return res.redirect(`/auth/reset-password/${token}?error=passwordTooShort`);
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
      },
    });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return res.redirect('/?error=invalidResetToken');
    }

    user.password = await bcrypt.hash(password, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    return res.redirect('/?signup=passwordReset');
  } catch (err) {
    console.error('Reset password error:', err);
    return res.redirect('/?error=server');
  }
};
