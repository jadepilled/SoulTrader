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
    next();
  } catch (err) {
    req.user = null;
    next();
  }
};

module.exports = authenticateUser;
