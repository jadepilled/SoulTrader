const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticateUser = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (user && user.isBanned) {
      res.clearCookie('token');
      req.user = null;
      return next();
    }

    req.user = user || null;

    // Update lastOnline (throttle to once per 2 minutes to avoid DB spam)
    if (user) {
      const now = new Date();
      const last = user.lastOnline ? new Date(user.lastOnline) : null;
      if (!last || (now - last) > 120000) {
        user.lastOnline = now;
        user.save({ silent: true }).catch(() => {});
      }
    }

    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

module.exports = authenticateUser;
