const express = require('express');
const router = express.Router();
const { Trade, User, Item } = require('../models');
const { Op } = require('sequelize');
const tradeEmail = require('../utils/tradeEmailService');
const { tradeCreateLimiter, tradeAcceptLimiter } = require('../middleware/rateLimiter');
const { getUsernameStyle } = require('../controllers/gameController');
const { ensureVerified } = require('../middleware/roleMiddleware');

// ─── Game key → DB game name mapping ─────────────────────────────────────────
const gameKeyMap = {
  darksouls:   'Dark Souls',
  darksouls2:  'Dark Souls 2',
  darksouls3:  'Dark Souls 3',
  bloodborne:  'Bloodborne',
  eldenring:   'Elden Ring',
  demonssouls: "Demon's Souls",
};

// ─── SEARCH ITEMS ─────────────────────────────────────────────────────────────
router.get('/search-items', async (req, res) => {
  const { game, query } = req.query;
  if (!game || !query) return res.status(400).json({ error: 'Missing game or query' });

  try {
    const gameName = gameKeyMap[game] || game;
    const items = await Item.findAll({
      where: { game: gameName, name: { [Op.iLike]: `%${query}%` } },
      attributes: ['id', 'name', 'type', 'iconPath'],
      limit: 20,
      order: [['name', 'ASC']],
    });
    res.json(items);
  } catch (err) {
    console.error('Item search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── CREATE TRADE ─────────────────────────────────────────────────────────────
router.post('/create', tradeCreateLimiter, ensureVerified, async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');

    const { offeredItems, requestedItems, platform, additionalNotes, game } = req.body;

    if (!offeredItems || !requestedItems || !platform || !game) {
      return res.status(400).send('Missing required fields.');
    }

    // Parse JSON arrays from hidden inputs
    let offeredArr, requestedArr;
    try {
      offeredArr  = JSON.parse(offeredItems);
      requestedArr = JSON.parse(requestedItems);
    } catch {
      return res.status(400).send('Invalid item data format.');
    }

    if (!Array.isArray(offeredArr)  || offeredArr.length === 0)  return res.status(400).send('Please add at least one offered item.');
    if (!Array.isArray(requestedArr) || requestedArr.length === 0) return res.status(400).send('Please add at least one requested item.');

    const gameName = gameKeyMap[game] || game;

    // Validate item names exist in DB for this game
    const offeredNames  = offeredArr.map(i => i.name);
    const requestedNames = requestedArr.map(i => i.name);

    const [offeredRecords, requestedRecords] = await Promise.all([
      Item.findAll({ where: { name: offeredNames,  game: gameName } }),
      Item.findAll({ where: { name: requestedNames, game: gameName } }),
    ]);

    if (offeredRecords.length  !== offeredNames.length)  return res.status(400).send('One or more offered items are invalid.');
    if (requestedRecords.length !== requestedNames.length) return res.status(400).send('One or more requested items are invalid.');

    // Clamp qty to 1-99, upgrade to 0-25
    const sanitize = (items) => items.map(item => ({
      name:     String(item.name),
      qty:      Math.min(99, Math.max(1, parseInt(item.qty, 10) || 1)),
      upgrade:  (item.upgrade !== null && item.upgrade !== undefined) ? Math.min(25, Math.max(0, parseInt(item.upgrade, 10) || 0)) : null,
      type:     String(item.type || 'misc'),
      iconPath: item.iconPath || null,
    }));

    await Trade.create({
      offeredItems:   sanitize(offeredArr),
      requestedItems: sanitize(requestedArr),
      platform,
      additionalNotes: additionalNotes || null,
      game: gameName,
      offerCreatorId: req.user.id,
    });

    const gameKey = Object.keys(gameKeyMap).find(k => gameKeyMap[k] === gameName) || 'darksouls';
    res.redirect(`/${gameKey}`);
  } catch (err) {
    console.error('Error creating trade:', err);
    res.status(500).send('Server error');
  }
});

// ─── TRADE DETAILS (for accept modal) ────────────────────────────────────────
router.get('/details/:id', async (req, res) => {
  try {
    const trade = await Trade.findByPk(req.params.id, {
      include: [{ model: User, as: 'offerCreator', attributes: ['username'] }],
    });
    if (!trade) return res.status(404).json({ error: 'Trade not found.' });

    res.json({
      offerCreator:   trade.offerCreator,
      offeredItems:   trade.offeredItems,   // already parsed array via getter
      requestedItems: trade.requestedItems,
      game:           trade.game,
    });
  } catch (err) {
    console.error('Error fetching trade details:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ACCEPT TRADE ─────────────────────────────────────────────────────────────
router.post('/accept/:id', tradeAcceptLimiter, ensureVerified, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const trade = await Trade.findByPk(req.params.id, {
      include: [{ model: User, as: 'offerCreator', attributes: ['id', 'email', 'username'] }],
    });

    if (!trade)                          return res.status(404).json({ error: 'Trade not found.' });
    if (trade.status !== 'open')         return res.status(400).json({ error: 'This trade is no longer available.' });
    if (trade.offerCreatorId === req.user.id) return res.status(400).json({ error: 'You cannot accept your own trade.' });

    const { meetingPoint, discordName, additionalInfo, inGameName } = req.body;

    trade.status    = 'awaiting_confirmation';
    trade.acceptorId = req.user.id;
    await trade.save();

    tradeEmail.sendTradeAcceptedEmail(
      trade.offerCreator.email, trade.offerCreator.username,
      req.user.username, trade,
      { meetingPoint, discordName, inGameName, additionalInfo }
    ).catch(err => console.error('Trade accepted email failed:', err));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Error accepting trade:', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── CONFIRM TRADE (dual confirmation) ───────────────────────────────────────
router.post('/confirm/:id', async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');

    const trade = await Trade.findByPk(req.params.id, {
      include: [
        { model: User, as: 'offerCreator', attributes: ['id', 'email', 'username'] },
        { model: User, as: 'acceptor',     attributes: ['id', 'email', 'username'] },
      ],
    });

    if (!trade || trade.status !== 'awaiting_confirmation') {
      return res.status(400).send('Invalid trade or not awaiting confirmation.');
    }

    const isCreator  = trade.offerCreatorId === req.user.id;
    const isAcceptor = trade.acceptorId === req.user.id;
    if (!isCreator && !isAcceptor) return res.status(403).send('You are not part of this trade.');

    if (isCreator)  trade.creatorConfirmed  = true;
    else            trade.acceptorConfirmed = true;

    if (trade.creatorConfirmed && trade.acceptorConfirmed) {
      trade.status = 'completed';
      await trade.save();
      tradeEmail.sendTradeCompletedEmail(trade.offerCreator.email, trade.offerCreator.username, trade.acceptor.username, trade).catch(e => console.error(e));
      tradeEmail.sendTradeCompletedEmail(trade.acceptor.email,     trade.acceptor.username,     trade.offerCreator.username, trade).catch(e => console.error(e));
    } else {
      await trade.save();
      const other     = isCreator ? trade.acceptor     : trade.offerCreator;
      const confirmer = isCreator ? trade.offerCreator : trade.acceptor;
      tradeEmail.sendTradeConfirmedByPartyEmail(other.email, confirmer.username, other.username, trade).catch(e => console.error(e));
    }

    return res.redirect('/trade/my-trades');
  } catch (err) {
    console.error('Error confirming trade:', err);
    res.status(500).send('Server error.');
  }
});

// ─── DECLINE TRADE ───────────────────────────────────────────────────────────
router.post('/decline/:id', async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');

    const trade = await Trade.findByPk(req.params.id, {
      include: [
        { model: User, as: 'offerCreator', attributes: ['id', 'email', 'username'] },
        { model: User, as: 'acceptor',     attributes: ['id', 'email', 'username'] },
      ],
    });

    if (!trade) return res.status(404).send('Trade not found.');
    if (trade.status !== 'awaiting_confirmation') return res.status(400).send('Only awaiting-confirmation trades can be declined.');
    if (trade.offerCreatorId !== req.user.id && req.user.role !== 'admin') return res.status(403).send('Forbidden.');

    trade.status      = 'declined';
    trade.declinedById = req.user.id;
    await trade.save();

    if (trade.acceptor) {
      tradeEmail.sendTradeDeclinedEmail(trade.acceptor.email, trade.acceptor.username, trade.offerCreator.username, trade).catch(e => console.error(e));
    }

    return res.redirect('/trade/my-trades');
  } catch (err) {
    console.error('Error declining trade:', err);
    res.status(500).send('Server error.');
  }
});

// ─── CANCEL / RESCIND TRADE ──────────────────────────────────────────────────
async function cancelTrade(req, res, redirectTo) {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');

    const trade = await Trade.findByPk(req.params.id, {
      include: [
        { model: User, as: 'offerCreator', attributes: ['id', 'username'] },
        { model: User, as: 'acceptor',     attributes: ['id', 'email', 'username'] },
      ],
    });

    if (!trade) return res.status(404).send('Trade not found.');
    if (trade.offerCreatorId !== req.user.id && req.user.role !== 'admin') return res.status(403).send('Forbidden.');
    if (trade.status === 'completed') return res.status(400).send('Completed trades cannot be cancelled.');

    const hadAcceptor = trade.acceptor && trade.status === 'awaiting_confirmation';
    trade.status      = 'cancelled';
    trade.cancelledAt = new Date();
    await trade.save();

    if (hadAcceptor) {
      tradeEmail.sendTradeCancelledEmail(trade.acceptor.email, trade.acceptor.username, trade.offerCreator.username, trade).catch(e => console.error(e));
    }

    return res.redirect(redirectTo);
  } catch (err) {
    console.error('Error cancelling trade:', err);
    res.status(500).send('Server error.');
  }
}

router.post('/cancel/:id',  (req, res) => cancelTrade(req, res, '/trade/my-trades'));
router.post('/rescind/:id', async (req, res) => {
  const trade = await Trade.findByPk(req.params.id).catch(() => null);
  const gameKey = trade ? (Object.keys(gameKeyMap).find(k => gameKeyMap[k] === trade.game) || 'darksouls') : 'darksouls';
  return cancelTrade(req, res, `/${gameKey}?trade=rescinded`);
});

// ─── RATE TRADE PARTNER ───────────────────────────────────────────────────────
router.post('/rate/:id', ensureVerified, async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');

    const r = parseInt(req.body.rating, 10);
    if (Number.isNaN(r) || r < 1 || r > 10) return res.status(400).send('Rating must be 1–10.');

    const trade = await Trade.findByPk(req.params.id, {
      include: [
        { model: User, as: 'offerCreator' },
        { model: User, as: 'acceptor' },
      ],
    });

    if (!trade || trade.status !== 'completed') return res.status(400).send('Trade not found or not completed.');

    const isCreator  = req.user.id === trade.offerCreatorId;
    const isAcceptor = req.user.id === trade.acceptorId;
    if (!isCreator && !isAcceptor) return res.status(403).send('Not part of this trade.');
    if (isCreator  && trade.creatorRated)  return res.status(400).send('Already rated.');
    if (isAcceptor && trade.acceptorRated) return res.status(400).send('Already rated.');

    const karmaDelta = [0, -5, -3, -2, -1, 0, 1, 2, 3, 4, 5][r] ?? 0;
    const target = isCreator ? trade.acceptor : trade.offerCreator;
    if (karmaDelta > 0) target.positiveKarma += karmaDelta;
    else if (karmaDelta < 0) target.negativeKarma += Math.abs(karmaDelta);
    await target.save();

    if (isCreator)  trade.creatorRated  = true;
    else            trade.acceptorRated = true;
    await trade.save();

    return res.redirect('/trade/my-trades');
  } catch (err) {
    console.error('Error rating trade:', err);
    res.status(500).send('Server error.');
  }
});

// ─── MY TRADES ────────────────────────────────────────────────────────────────
router.get('/my-trades', async (req, res) => {
  try {
    if (!req.user) return res.redirect('/');

    const userId = req.user.id;
    const include = [
      { model: User, as: 'offerCreator', attributes: ['id', 'username', 'role', 'positiveKarma', 'negativeKarma'] },
      { model: User, as: 'acceptor',     attributes: ['id', 'username', 'role', 'positiveKarma', 'negativeKarma'] },
    ];

    const [createdTrades, acceptedTrades] = await Promise.all([
      Trade.findAll({ where: { offerCreatorId: userId }, include, order: [['createdAt', 'DESC']] }),
      Trade.findAll({ where: { acceptorId:     userId }, include, order: [['createdAt', 'DESC']] }),
    ]);

    res.render('myTrades', {
      createdTrades,
      acceptedTrades,
      username: req.user.username,
      userId,
      role:    req.user.role,
      karma:   req.user.positiveKarma - req.user.negativeKarma,
      query:   req.query,
      getUsernameStyle,
      gameKeyMap,
    });
  } catch (err) {
    console.error('Error fetching trades:', err);
    res.status(500).send('Server error.');
  }
});

module.exports = router;
