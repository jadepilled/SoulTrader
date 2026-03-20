const express = require('express');
const router = express.Router();
const { User, Trade } = require('../models');
const { ensureAdmin } = require('../middleware/roleMiddleware');
const { getUsernameStyle, gameConfigs } = require('../controllers/gameController');
const Sequelize = require('sequelize');

// All admin routes require admin role
router.use(ensureAdmin);

// ─── Admin Dashboard ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalTrades = await Trade.count();
    const openTrades = await Trade.count({ where: { status: 'open' } });
    const completedTrades = await Trade.count({ where: { status: 'completed' } });
    const awaitingTrades = await Trade.count({ where: { status: 'awaiting_confirmation' } });
    const bannedUsers = await User.count({ where: { isBanned: true } });

    // Trades by game
    const tradesByGame = await Trade.findAll({
      attributes: ['game', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
      group: ['game'],
      raw: true,
    });

    // Recent users
    const recentUsers = await User.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: ['id', 'username', 'email', 'role', 'isBanned', 'createdAt'],
    });

    res.render('admin/dashboard', {
      totalUsers,
      totalTrades,
      openTrades,
      completedTrades,
      awaitingTrades,
      bannedUsers,
      tradesByGame,
      recentUsers,
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      karma: req.user.positiveKarma - req.user.negativeKarma,
      usernameStyle: getUsernameStyle(req.user.role),
      getUsernameStyle,
      gameConfigs,
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).send('Server error.');
  }
});

// ─── User Management ─────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const search = req.query.search || '';
    const where = search
      ? { username: { [Sequelize.Op.iLike]: `%${search}%` } }
      : {};

    const users = await User.findAll({
      where,
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'username', 'email', 'role', 'isBanned', 'positiveKarma', 'negativeKarma', 'createdAt'],
      limit: 50,
    });

    res.json({ users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Ban user
router.post('/users/:id/ban', async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot ban an admin.' });
    }

    user.isBanned = true;
    user.banReason = reason || 'No reason provided';
    await user.save();

    res.json({ success: true, message: `${user.username} has been banned.` });
  } catch (err) {
    console.error('Error banning user:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Unban user
router.post('/users/:id/unban', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.isBanned = false;
    user.banReason = null;
    await user.save();

    res.json({ success: true, message: `${user.username} has been unbanned.` });
  } catch (err) {
    console.error('Error unbanning user:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Change role
router.post('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['user', 'moderator', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    user.role = role;
    await user.save();

    res.json({ success: true, message: `${user.username} role changed to ${role}.` });
  } catch (err) {
    console.error('Error changing role:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Trade Management ────────────────────────────────────────────────────────
router.get('/trades', async (req, res) => {
  try {
    const { status, game } = req.query;
    const where = {};
    if (status) where.status = status;
    if (game) where.game = game;

    const trades = await Trade.findAll({
      where,
      include: [
        { model: User, as: 'offerCreator', attributes: ['id', 'username'] },
        { model: User, as: 'acceptor', attributes: ['id', 'username'] },
      ],
      attributes: [
        'id', 'game', 'platform', 'status', 'offeredItems', 'requestedItems',
        'creatorConfirmed', 'acceptorConfirmed', 'creatorRated', 'acceptorRated',
        'characterLevel', 'additionalNotes', 'createdAt', 'updatedAt',
      ],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    res.json({ trades });
  } catch (err) {
    console.error('Error fetching trades:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Force-delete a trade
router.delete('/trades/:id', async (req, res) => {
  try {
    const trade = await Trade.findByPk(req.params.id);
    if (!trade) return res.status(404).json({ error: 'Trade not found.' });

    await trade.destroy();
    res.json({ success: true, message: 'Trade deleted.' });
  } catch (err) {
    console.error('Error deleting trade:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
