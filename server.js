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

// Make current user available to all EJS views
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  next();
});

// ─── EJS Setup ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/auth', oauthRoutes);
app.use('/trade', tradeRoutes);
app.use('/profile', profileRoutes);
app.use('/admin', adminRoutes);

// Homepage
app.get('/', async (req, res) => {
  const { gameConfigs, getUsernameStyle } = require('./controllers/gameController');
  const { Trade } = require('./models');
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

  res.render('index', {
    userId: req.user ? req.user.id : null,
    username: req.user ? req.user.username : null,
    role: req.user ? req.user.role : 'user',
    karma: req.user ? (req.user.positiveKarma - req.user.negativeKarma) : 0,
    usernameStyle: getUsernameStyle(req.user ? req.user.role : 'user'),
    query: req.query,
    gameConfigs,
    pendingTradeCount,
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

// Feedback page (login required)
app.get('/feedback', (req, res) => {
  const { gameConfigs } = require('./controllers/gameController');
  const { Trade } = require('./models');
  const { Op } = require('sequelize');

  if (!req.user) {
    return res.redirect('/');
  }

  (async () => {
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
    });
  })();
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
