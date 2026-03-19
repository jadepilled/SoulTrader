module.exports = {
  ensureAdmin: (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
      return next();
    }
    res.status(403).send('Forbidden: You do not have the required permissions.');
  },

  ensureModerator: (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'moderator')) {
      return next();
    }
    res.status(403).send('Forbidden: You do not have the required permissions.');
  },

  ensureAuthenticated: (req, res, next) => {
    if (req.user) {
      return next();
    }
    res.status(401).redirect('/');
  },
};
