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
    accentColor: '#7b86a2',
    accentColorRgb: '123, 134, 162',
    secondaryColor: '#5b6d8e',
    secondaryColorRgb: '91, 109, 142',
    logoUrl: 'https://i.imgur.com/B7uNYzr.png',
    levelCap: 713,
  },
  darksouls2: {
    title: 'Dark Souls II: Scholar of the First Sin',
    game: 'Dark Souls 2',
    gameKey: 'darksouls2',
    accentColor: '#8b7eaa',
    accentColorRgb: '139, 126, 170',
    secondaryColor: '#6e5f8e',
    secondaryColorRgb: '110, 95, 142',
    logoUrl: 'https://i.imgur.com/TFHkXED.png',
    levelCap: 838,
  },
  darksouls3: {
    title: 'Dark Souls III',
    game: 'Dark Souls 3',
    gameKey: 'darksouls3',
    accentColor: '#6e7fa0',
    accentColorRgb: '110, 127, 160',
    secondaryColor: '#5a6e8c',
    secondaryColorRgb: '90, 110, 140',
    logoUrl: 'https://i.imgur.com/sETyDch.png',
    levelCap: 802,
  },
  bloodborne: {
    title: 'Bloodborne',
    game: 'Bloodborne',
    gameKey: 'bloodborne',
    accentColor: '#8b3a3a',
    accentColorRgb: '139, 58, 58',
    secondaryColor: '#6e2e2e',
    secondaryColorRgb: '110, 46, 46',
    logoUrl: 'https://i.imgur.com/0q8jRGA.png',
    levelCap: 544,
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
    levelCap: 713,
  },
  demonssouls: {
    title: "Demon's Souls",
    game: "Demon's Souls",
    gameKey: 'demonssouls',
    accentColor: '#8a8a8a',
    accentColorRgb: '138, 138, 138',
    secondaryColor: '#6e6e6e',
    secondaryColorRgb: '110, 110, 110',
    logoUrl: 'https://i.imgur.com/R9wKWFE.png',
    levelCap: 712,
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

    // Pending trade count for navbar
    let pendingTradeCount = 0;
    if (userId) {
      const { Op } = require('sequelize');
      pendingTradeCount = await Trade.count({
        where: {
          status: 'awaiting_confirmation',
          [Op.or]: [{ offerCreatorId: userId }, { acceptorId: userId }],
        },
      });
    }

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
      pendingTradeCount,
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
