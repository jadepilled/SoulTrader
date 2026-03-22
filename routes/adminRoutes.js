const express = require('express');
const router = express.Router();
const { User, Trade, Report, Message } = require('../models');
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

    const pendingReportCount = await Report.count({ where: { status: 'pending' } });

    let pendingTradeCount = 0;
    if (req.user) {
      const { Op } = Sequelize;
      pendingTradeCount = await Trade.count({
        where: {
          status: 'awaiting_confirmation',
          [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }],
        },
      });
    }

    res.render('admin/dashboard', {
      totalUsers,
      totalTrades,
      openTrades,
      completedTrades,
      awaitingTrades,
      bannedUsers,
      tradesByGame,
      recentUsers,
      pendingReportCount,
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      karma: req.user.positiveKarma - 2 * req.user.negativeKarma,
      usernameStyle: getUsernameStyle(req.user.role),
      getUsernameStyle,
      gameConfigs,
      pendingTradeCount,
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

    if (user.role === 'admin' || user.role === 'super_admin') {
      return res.status(400).json({ error: 'Cannot ban an admin or super admin.' });
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
    const validRoles = ['user', 'moderator', 'admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Nobody can change a super_admin's role
    if (user.role === 'super_admin') {
      return res.status(400).json({ error: 'Cannot modify a Super Admin.' });
    }

    // Only super_admin can set role to admin or super_admin
    if (['admin', 'super_admin'].includes(role) && req.user.role !== 'super_admin') {
      return res.status(400).json({ error: 'Only Super Admins can promote to admin or higher.' });
    }

    // Admins cannot change other admins' roles
    if (user.role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(400).json({ error: 'Only Super Admins can modify admin roles.' });
    }

    // Mods cannot modify other mods (mods can only change users)
    if (user.role === 'moderator' && req.user.role === 'moderator') {
      return res.status(400).json({ error: 'Moderators cannot modify other moderators.' });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    // Send email notification if promoted to a staff role
    if (role !== 'user' && role !== oldRole) {
      try {
        const { sendRoleChangedEmail } = require('../utils/tradeEmailService');
        if (user.email) {
          sendRoleChangedEmail(user.email, user.username, role).catch(err => console.error('Role change email failed:', err));
        }
      } catch (e) { /* ignore */ }
    }

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

// ─── Reports ────────────────────────────────────────────────────────────────
router.get('/reports', async (req, res) => {
  try {
    const reports = await Report.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'reporter', attributes: ['id', 'username', 'role'] },
        { model: User, as: 'reportedUser', attributes: ['id', 'username', 'role'] },
        { model: Message, as: 'reportedMessage', attributes: ['id', 'content', 'createdAt'] },
      ],
    });

    // Flatten message content for the template
    const enrichedReports = reports.map(r => {
      const plain = r.get({ plain: true });
      plain.messageContent = plain.reportedMessage ? plain.reportedMessage.content : null;
      return plain;
    });

    const pendingReportCount = enrichedReports.filter(r => r.status === 'pending').length;

    const { Op } = Sequelize;
    const pendingTradeCount = await Trade.count({
      where: {
        status: 'awaiting_confirmation',
        [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }],
      },
    });

    res.render('admin/reports', {
      reports: enrichedReports,
      pendingReportCount,
      pendingTradeCount,
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      getUsernameStyle,
      gameConfigs,
      query: req.query,
    });
  } catch (err) {
    console.error('Error loading reports:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Admin: View conversation between two users ────────────────────────────
router.get('/conversation/:user1/:user2', async (req, res) => {
  try {
    const user1 = await User.findOne({ where: { username: req.params.user1 }, attributes: ['id', 'username', 'role', 'profileImagePath'] });
    const user2 = await User.findOne({ where: { username: req.params.user2 }, attributes: ['id', 'username', 'role', 'profileImagePath'] });
    if (!user1 || !user2) return res.status(404).send('User(s) not found.');

    const { Op } = Sequelize;
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: user1.id, recipientId: user2.id },
          { senderId: user2.id, recipientId: user1.id },
        ],
      },
      order: [['createdAt', 'ASC']],
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'profileImagePath', 'role'] },
      ],
    });

    const pendingTradeCount = await Trade.count({
      where: {
        status: 'awaiting_confirmation',
        [Op.or]: [{ offerCreatorId: req.user.id }, { acceptorId: req.user.id }],
      },
    });

    res.render('admin/conversation', {
      user1,
      user2,
      messages,
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      getUsernameStyle,
      gameConfigs,
      pendingTradeCount,
      query: req.query,
      isAdmin: true,
    });
  } catch (err) {
    console.error('Error loading admin conversation:', err);
    res.status(500).send('Server error.');
  }
});

router.post('/reports/:reportId', async (req, res) => {
  try {
    const report = await Report.findByPk(req.params.reportId);
    if (!report) return res.status(404).send('Report not found.');

    const { action, adminNotes } = req.body;
    if (action === 'reviewed') {
      report.status = 'reviewed';
    } else if (action === 'dismissed') {
      report.status = 'dismissed';
    } else {
      return res.status(400).send('Invalid action.');
    }

    report.adminNotes = adminNotes || null;
    await report.save();

    res.redirect('/admin/reports');
  } catch (err) {
    console.error('Error processing report:', err);
    res.status(500).send('Server error.');
  }
});

module.exports = router;
