const { Item, Trade, User } = require('../models');

// ─── Role-based username styling ─────────────────────────────────────────────
const roleColors = {
  admin: { textColor: '#fa9cff', shadowColor: 'darkpink' },
  moderator: { textColor: '#5b9bff', shadowColor: 'darkblue' },
  user: { textColor: '#eee', shadowColor: 'gray' },
};

const getUsernameStyle = (role) => {
  const { textColor, shadowColor } = roleColors[role] || roleColors.user;
  return `color: ${textColor}; text-shadow: 2px 2px 4px ${shadowColor};`;
};

// ─── Game configurations ─────────────────────────────────────────────────────
const gameConfigs = {
  darksouls: {
    title: 'Dark Souls: Remastered',
    game: 'Dark Souls',
    gameKey: 'darksouls',
    accentColor: '#c91010',
    accentColorRgb: '201, 16, 16',
    secondaryColor: '#0061ff',
    secondaryColorRgb: '0, 97, 255',
    logoUrl: 'https://i.imgur.com/B7uNYzr.png',
  },
  darksouls2: {
    title: 'Dark Souls II: Scholar of the First Sin',
    game: 'Dark Souls 2',
    gameKey: 'darksouls2',
    accentColor: '#d4a017',
    accentColorRgb: '212, 160, 23',
    secondaryColor: '#5b9bff',
    secondaryColorRgb: '91, 155, 255',
    logoUrl: 'https://i.imgur.com/TFHkXED.png',
  },
  darksouls3: {
    title: 'Dark Souls III',
    game: 'Dark Souls 3',
    gameKey: 'darksouls3',
    accentColor: '#ff6a00',
    accentColorRgb: '255, 106, 0',
    secondaryColor: '#5b9bff',
    secondaryColorRgb: '91, 155, 255',
    logoUrl: 'https://i.imgur.com/sETyDch.png',
  },
  bloodborne: {
    title: 'Bloodborne',
    game: 'Bloodborne',
    gameKey: 'bloodborne',
    accentColor: '#8b0000',
    accentColorRgb: '139, 0, 0',
    secondaryColor: '#c0c0c0',
    secondaryColorRgb: '192, 192, 192',
    logoUrl: 'https://i.imgur.com/0q8jRGA.png',
  },
  eldenring: {
    title: 'Elden Ring',
    game: 'Elden Ring',
    gameKey: 'eldenring',
    accentColor: '#c8a84e',
    accentColorRgb: '200, 168, 78',
    secondaryColor: '#5b9bff',
    secondaryColorRgb: '91, 155, 255',
    logoUrl: 'https://i.imgur.com/7aq4TkU.png',
  },
  demonssouls: {
    title: "Demon's Souls",
    game: "Demon's Souls",
    gameKey: 'demonssouls',
    accentColor: '#4a7a8c',
    accentColorRgb: '74, 122, 140',
    secondaryColor: '#c0c0c0',
    secondaryColorRgb: '192, 192, 192',
    logoUrl: 'https://i.imgur.com/R9wKWFE.png',
  },
};

// ─── Shared game page handler ────────────────────────────────────────────────
const renderGamePage = async (req, res, gameKey) => {
  try {
    const config = gameConfigs[gameKey];
    if (!config) return res.status(404).send('Game not found');

    const items = await Item.findAll({ where: { game: config.game } });
    const sort = req.query.sort === 'asc' ? 'ASC' : 'DESC';

    const offers = await Trade.findAll({
      where: { status: 'open', game: config.game },
      include: [
        { model: User, as: 'offerCreator', attributes: ['username', 'positiveKarma', 'negativeKarma', 'role'] },
      ],
      order: [['createdAt', sort]],
    });

    const userId = req.user ? req.user.id : null;
    const username = req.user ? req.user.username : null;
    const role = req.user ? req.user.role : 'user';
    const karma = req.user ? (req.user.positiveKarma - req.user.negativeKarma) : 0;
    const usernameStyle = getUsernameStyle(role);

    res.render('game', {
      ...config,
      items,
      offers,
      userId,
      username,
      karma,
      role,
      usernameStyle,
      query: req.query,
      getUsernameStyle,
      gameConfigs,
    });
  } catch (err) {
    console.error(`Error fetching ${gameKey} data:`, err);
    res.status(500).send('Server error');
  }
};

// ─── Route handlers ──────────────────────────────────────────────────────────
exports.darksouls = (req, res) => renderGamePage(req, res, 'darksouls');
exports.darksouls2 = (req, res) => renderGamePage(req, res, 'darksouls2');
exports.darksouls3 = (req, res) => renderGamePage(req, res, 'darksouls3');
exports.bloodborne = (req, res) => renderGamePage(req, res, 'bloodborne');
exports.eldenring = (req, res) => renderGamePage(req, res, 'eldenring');
exports.demonssouls = (req, res) => renderGamePage(req, res, 'demonssouls');

exports.getUsernameStyle = getUsernameStyle;
exports.gameConfigs = gameConfigs;
