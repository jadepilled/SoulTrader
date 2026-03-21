require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');

const authenticateUser = require('./middleware/authMiddleware');
const { sequelize } = require('./models');
const gameController = require('./controllers/gameController');

// Route imports
const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const oauthRoutes = require('./routes/oauthRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const commentRoutes = require('./routes/commentRoutes');
const messageRoutes = require('./routes/messageRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline styles/scripts in EJS templates
  crossOriginEmbedderPolicy: false,
}));

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/icons', express.static(path.join(__dirname, 'icons')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// Session (needed for OAuth flow only)
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 5 * 60 * 1000 }, // 5 min session for OAuth dance only
}));

// Passport for OAuth
require('./config/passport')(passport);
app.use(passport.initialize());
app.use(passport.session());

// JWT auth middleware (runs on every request, sets req.user)
app.use(authenticateUser);

// Make current user available to all EJS views + global notification counts
app.use(async (req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.unreadMessageCount = 0;
  res.locals.pendingReportCount = 0;

  if (req.user) {
    try {
      const { Message, Report } = require('./models');
      // Unread message count for all logged-in users
      res.locals.unreadMessageCount = await Message.count({
        where: { recipientId: req.user.id, readAt: null },
      });
      // Pending report count for admins only
      if (req.user.role === 'admin') {
        res.locals.pendingReportCount = await Report.count({
          where: { status: 'pending' },
        });
      }
    } catch (e) { /* silently ignore */ }
  }

  next();
});

// ── Global EJS helper: format large quantities as K / M ──────────────────────
app.locals.fmtQty = (n) => {
  n = parseInt(n, 10) || 1;
  if (n <= 1) return null;
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return parseFloat(v.toFixed(2)).toString() + 'M';
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    return parseFloat(v.toFixed(1)).toString() + 'K';
  }
  return String(n);
};

// ─── EJS Setup ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/auth', oauthRoutes);
app.use('/trade', tradeRoutes);
app.use('/profile', profileRoutes);
app.use('/admin', adminRoutes);
app.use('/comments', commentRoutes);
app.use('/messages', messageRoutes);
app.use('/reports', reportRoutes);

// Homepage
app.get('/', async (req, res) => {
  const { gameConfigs, getUsernameStyle } = require('./controllers/gameController');
  const { Trade, User } = require('./models');
  const { Op } = require('sequelize');

  let pendingTradeCount = 0;
  if (req.user) {
    pendingTradeCount = await Trade.count({
      where: {
        status: 'awaiting_confirmation',
        [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }],
      },
    });
  }

  // Global stats for homepage tracker
  const totalTrades = await Trade.count({ where: { status: 'completed' } });
  const totalUsers = await User.count();

  // Compute total items traded and currency volume from completed trades
  const completedTrades = await Trade.findAll({
    where: { status: 'completed' },
    attributes: ['offeredItems', 'requestedItems'],
    raw: true,
  });
  let totalItems = 0;
  let currencyVolume = 0;
  completedTrades.forEach(t => {
    try {
      const offered = JSON.parse(t.offeredItems || '[]');
      const requested = JSON.parse(t.requestedItems || '[]');
      const all = [...offered, ...requested];
      totalItems += all.length;
      all.forEach(item => {
        if (item.type === 'currency' || item.type === 'soul') {
          currencyVolume += parseInt(item.qty, 10) || 0;
        }
      });
    } catch { /* skip */ }
  });

  res.render('index', {
    userId: req.user ? req.user.id : null,
    username: req.user ? req.user.username : null,
    role: req.user ? req.user.role : 'user',
    karma: req.user ? (req.user.positiveKarma - 2 * req.user.negativeKarma) : 0,
    usernameStyle: getUsernameStyle(req.user ? req.user.role : 'user'),
    query: req.query,
    gameConfigs,
    pendingTradeCount,
    siteStats: { totalTrades, totalUsers, totalItems, currencyVolume },
  });
});

// Item Database
app.get('/items', async (req, res) => {
  const { gameConfigs, getUsernameStyle } = require('./controllers/gameController');
  const { Item, Trade } = require('./models');
  const { Op } = require('sequelize');

  let pendingTradeCount = 0;
  if (req.user) {
    pendingTradeCount = await Trade.count({
      where: {
        status: 'awaiting_confirmation',
        [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }],
      },
    });
  }

  const items = await Item.findAll({
    attributes: ['name', 'type', 'game', 'iconPath'],
    order: [['game', 'ASC'], ['type', 'ASC'], ['name', 'ASC']],
    raw: true,
  });

  res.render('itemdb', {
    userId: req.user ? req.user.id : null,
    username: req.user ? req.user.username : null,
    role: req.user ? req.user.role : 'user',
    gameConfigs,
    pendingTradeCount,
    items,
    totalItems: items.length,
  });
});

// Users / Community page
app.get('/users', async (req, res) => {
  try {
  const { gameConfigs, getUsernameStyle } = require('./controllers/gameController');
  const { User, Trade } = require('./models');
  const { computeBadges } = require('./utils/badges');
  const { Op } = require('sequelize');

  let pendingTradeCount = 0;
  if (req.user) {
    pendingTradeCount = await Trade.count({
      where: { status: 'awaiting_confirmation', [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }] },
    });
  }

  const search = req.query.search || '';
  const sort   = req.query.sort   || 'karma';
  const filter = req.query.filter || '';
  const page   = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = 30;

  // Build where clause
  const where = {};
  if (search) where.username = { [Op.iLike]: `%${search}%` };
  if (filter === 'admin')     where.role = 'admin';
  if (filter === 'moderator') where.role = 'moderator';
  if (filter === 'sponsor')   where.isSponsor = true;

  // Sort order
  let order;
  if (sort === 'trades')      order = [[sequelize.literal('"completedTradeCount"'), 'DESC']];
  else if (sort === 'newest') order = [['createdAt', 'DESC']];
  else if (sort === 'oldest') order = [['createdAt', 'ASC']];
  else                        order = [[sequelize.literal('("positiveKarma" - 2 * "negativeKarma")'), 'DESC']];

  const totalUsers = await User.count({ where });
  const totalPages = Math.ceil(totalUsers / perPage) || 1;

  const users = await User.findAll({
    where,
    attributes: [
      'id', 'username', 'role', 'positiveKarma', 'negativeKarma',
      'profileImagePath', 'createdAt', 'isVerified', 'isBanned', 'isSponsor',
      [sequelize.literal(`(SELECT COUNT(*) FROM trades WHERE status = 'completed' AND ("offerCreatorId" = "User"."id" OR "acceptorId" = "User"."id"))`), 'completedTradeCount'],
    ],
    order,
    limit: perPage,
    offset: (page - 1) * perPage,
  });

  // Compute badges for each user
  const enriched = users.map(u => {
    const plain = u.get({ plain: true });
    plain.karma = (plain.positiveKarma || 0) - 2 * (plain.negativeKarma || 0);
    plain.completedTradeCount = parseInt(plain.completedTradeCount, 10) || 0;
    plain.badges = computeBadges(plain, plain.completedTradeCount);
    return plain;
  });

  res.render('users', {
    userId:   req.user ? req.user.id : null,
    username: req.user ? req.user.username : null,
    role:     req.user ? req.user.role : 'user',
    gameConfigs, getUsernameStyle, pendingTradeCount,
    users: enriched, totalUsers, totalPages, page,
    search, sort, filter,
  });
  } catch (err) {
    console.error('Error loading users page:', err);
    res.status(500).send('Server error.');
  }
});

// Code of Conduct
app.get('/code-of-conduct', async (req, res) => {
  const { gameConfigs } = require('./controllers/gameController');
  const { Trade } = require('./models');
  const { Op } = require('sequelize');

  let pendingTradeCount = 0;
  if (req.user) {
    pendingTradeCount = await Trade.count({
      where: { status: 'awaiting_confirmation', [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }] },
    });
  }

  res.render('codeOfConduct', {
    userId:   req.user ? req.user.id : null,
    username: req.user ? req.user.username : null,
    role:     req.user ? req.user.role : 'user',
    gameConfigs, pendingTradeCount,
  });
});

// Feedback page (login required)
app.get('/feedback', async (req, res) => {
  const { gameConfigs } = require('./controllers/gameController');
  const { Trade } = require('./models');
  const { Op } = require('sequelize');

  if (!req.user) return res.redirect('/');

  let pendingTradeCount = 0;
  pendingTradeCount = await Trade.count({
    where: {
      status: 'awaiting_confirmation',
      [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }],
    },
  });

  res.render('feedback', {
    userId: req.user.id,
    username: req.user.username,
    email: req.user.email,
    role: req.user.role,
    gameConfigs,
    pendingTradeCount,
    query: req.query,
  });
});

// Feedback POST
app.post('/feedback', async (req, res) => {
  if (!req.user) return res.redirect('/');
  const { Feedback } = require('./models');
  const { content, category } = req.body;
  if (!content || content.trim().length === 0) return res.redirect('/feedback');

  try {
    await Feedback.create({
      content: String(content).substring(0, 2000).trim(),
      category: ['general', 'bug', 'feature', 'other'].includes(category) ? category : 'general',
      authorId: req.user.id,
    });
    res.redirect('/feedback?success=1');
  } catch (err) {
    console.error('Error saving feedback:', err);
    res.redirect('/feedback');
  }
});

// Game pages
app.get('/darksouls', gameController.darksouls);
app.get('/darksouls2', gameController.darksouls2);
app.get('/darksouls3', gameController.darksouls3);
app.get('/bloodborne', gameController.bloodborne);
app.get('/eldenring', gameController.eldenring);
app.get('/demonssouls', gameController.demonssouls);

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

sequelize.sync({ alter: true })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SoulTrader running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to sync database:', err);
    process.exit(1);
  });
