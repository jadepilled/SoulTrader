module.exports = {
  ensureSuperAdmin: (req, res, next) => {
    if (req.user && req.user.role === 'super_admin') {
      return next();
    }
    res.status(403).send('Forbidden: You do not have the required permissions.');
  },

  ensureAdmin: (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
      return next();
    }
    res.status(403).send('Forbidden: You do not have the required permissions.');
  },

  ensureModerator: (req, res, next) => {
    if (req.user && (req.user.role === 'moderator' || req.user.role === 'admin' || req.user.role === 'super_admin')) {
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

  ensureVerified: (req, res, next) => {
    if (!req.user) {
      return res.status(401).redirect('/');
    }
    if (!req.user.isVerified) {
      return res.status(403).json({ error: 'Please verify your email before performing this action.' });
    }
    next();
  },
};
