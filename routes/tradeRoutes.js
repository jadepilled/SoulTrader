const express = require('express');
const router = express.Router();
const { Trade, User, Item, sequelize } = require('../models');
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

// ─── SUGGEST ITEMS (common items for a game, currencies first) ──────────────
router.get('/suggest-items', async (req, res) => {
  const { game } = req.query;
  if (!game) return res.status(400).json({ error: 'Missing game' });

  try {
    const gameName = gameKeyMap[game] || game;
    // Fetch currencies and souls first, then popular consumables
    const items = await Item.findAll({
      where: { game: gameName, type: ['currency', 'soul', 'consumable'] },
      attributes: ['id', 'name', 'type', 'iconPath'],
      order: [
        [sequelize.literal("CASE WHEN type = 'currency' THEN 0 WHEN type = 'soul' THEN 1 ELSE 2 END"), 'ASC'],
        ['name', 'ASC'],
      ],
      limit: 15,
    });
    res.json(items);
  } catch (err) {
    console.error('Item suggest error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

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
      order: [
        [sequelize.literal("CASE WHEN type = 'currency' THEN 0 WHEN type = 'soul' THEN 1 ELSE 2 END"), 'ASC'],
        ['name', 'ASC'],
      ],
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

    const { offeredItems, requestedItems, additionalNotes, game } = req.body;
    let platform = req.body.platform;

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

    // Force Bloodborne to PlayStation
    if (gameName === 'Bloodborne') platform = 'PlayStation';

    // Validate game variant for DS1/DS2
    const validVariants = {
      'Dark Souls': ['Dark Souls', 'Dark Souls: Remastered'],
      'Dark Souls 2': ['Dark Souls II', 'Dark Souls II: SotFS'],
    };
    let gameVariant = req.body.gameVariant || null;
    if (validVariants[gameName]) {
      if (!gameVariant || !validVariants[gameName].includes(gameVariant)) {
        return res.status(400).send('Please select a game version.');
      }
    } else {
      gameVariant = null; // No variants for other games
    }

    // Validate item names exist in DB for this game
    const offeredNames  = offeredArr.map(i => i.name);
    const requestedNames = requestedArr.map(i => i.name);

    const [offeredRecords, requestedRecords] = await Promise.all([
      Item.findAll({ where: { name: offeredNames,  game: gameName } }),
      Item.findAll({ where: { name: requestedNames, game: gameName } }),
    ]);

    if (offeredRecords.length  !== offeredNames.length)  return res.status(400).send('One or more offered items are invalid.');
    if (requestedRecords.length !== requestedNames.length) return res.status(400).send('One or more requested items are invalid.');

    // Currency/soul items can go up to 10 million; regular items capped at 99
    const CURRENCY_TYPES = ['currency', 'soul'];
    const sanitize = (items) => items.map(item => {
      const isCurrency = CURRENCY_TYPES.includes(String(item.type || ''));
      const maxQty     = isCurrency ? 10_000_000 : 99;
      return {
        name:     String(item.name),
        qty:      Math.min(maxQty, Math.max(1, parseInt(item.qty, 10) || 1)),
        upgrade:  (item.upgrade !== null && item.upgrade !== undefined)
                    ? Math.min(25, Math.max(0, parseInt(item.upgrade, 10) || 0))
                    : null,
        type:     String(item.type || 'misc'),
        iconPath: item.iconPath || null,
      };
    });

    // Validate character level against per-game cap
    const gameLevelCaps = {
      'Dark Souls': 713, 'Dark Souls 2': 838, 'Dark Souls 3': 802,
      'Bloodborne': 544, 'Elden Ring': 713, "Demon's Souls": 712,
    };
    const charLevel = parseInt(req.body.characterLevel, 10);
    const maxLevel  = gameLevelCaps[gameName] || 999;

    const creatorInGameName = req.body.creatorInGameName;
    const creatorMeetingPoint = req.body.creatorMeetingPoint;

    await Trade.create({
      offeredItems:   sanitize(offeredArr),
      requestedItems: sanitize(requestedArr),
      platform,
      additionalNotes: additionalNotes || null,
      game: gameName,
      gameVariant,
      offerCreatorId: req.user.id,
      characterLevel: (!isNaN(charLevel) && charLevel >= 1 && charLevel <= maxLevel) ? charLevel : null,
      creatorInGameName: creatorInGameName ? String(creatorInGameName).substring(0, 100).trim() : null,
      creatorMeetingPoint: creatorMeetingPoint ? String(creatorMeetingPoint).substring(0, 200).trim() : null,
      creatorAdditionalInfo: additionalNotes ? String(additionalNotes).substring(0, 500).trim() : null,
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
      gameVariant:    trade.gameVariant,
      platform:       trade.platform,
      characterLevel: trade.characterLevel,
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

    const { meetingPoint, additionalInfo, inGameName } = req.body;

    // Require Discord set in profile
    const acceptorUser = await User.findByPk(req.user.id, { attributes: ['contactDiscord'] });
    if (!acceptorUser || !acceptorUser.contactDiscord) {
      return res.status(400).json({ error: 'Please set your Discord name in your profile before accepting a trade.' });
    }

    trade.status    = 'awaiting_confirmation';
    trade.acceptorId = req.user.id;
    trade.acceptedAt = new Date();
    trade.acceptorInGameName     = inGameName     ? String(inGameName).substring(0, 100).trim()     : null;
    trade.acceptorMeetingPoint   = meetingPoint   ? String(meetingPoint).substring(0, 200).trim()   : null;
    trade.acceptorAdditionalInfo = additionalInfo ? String(additionalInfo).substring(0, 500).trim() : null;
    await trade.save();

    tradeEmail.sendTradeAcceptedEmail(
      trade.offerCreator.email, trade.offerCreator.username,
      req.user.username, trade,
      { meetingPoint, inGameName, additionalInfo }
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

    // Simple confirmation — details were already collected at creation/accept time
    if (isCreator) {
      trade.creatorConfirmed = true;
    } else {
      trade.acceptorConfirmed = true;
    }

    if (trade.creatorConfirmed && trade.acceptorConfirmed) {
      trade.status = 'completed';
      await trade.save();
      tradeEmail.sendTradeCompletedEmail(trade.offerCreator.email, trade.offerCreator.username, trade.acceptor.username, trade).catch(e => console.error(e));
      tradeEmail.sendTradeCompletedEmail(trade.acceptor.email,     trade.acceptor.username,     trade.offerCreator.username, trade).catch(e => console.error(e));
      // Redirect with feedback prompt — trade just completed
      return res.redirect(`/trade/my-trades?feedbackFor=${trade.id}`);
    } else {
      await trade.save();
      const other     = isCreator ? trade.acceptor     : trade.offerCreator;
      const confirmer = isCreator ? trade.offerCreator : trade.acceptor;
      tradeEmail.sendTradeConfirmedByPartyEmail(other.email, confirmer.username, other.username, trade).catch(e => console.error(e));
    }

    return res.redirect('/trade/my-trades?confirmed=1');
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

    // Sanitise feedback text (optional, max 200 chars, strip links)
    let feedback = req.body.feedback ? String(req.body.feedback).substring(0, 200).trim() : null;
    if (feedback) {
      feedback = feedback.replace(/https?:\/\/[^\s]+/gi, '')
                         .replace(/www\.[^\s]+/gi, '')
                         .replace(/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?/gi, '');
      if (!feedback.trim()) feedback = null;
    }

    const karmaDelta = [0, -5, -3, -2, -1, 0, 1, 2, 3, 4, 5][r] ?? 0;
    const target = isCreator ? trade.acceptor : trade.offerCreator;
    if (karmaDelta > 0) target.positiveKarma += karmaDelta;
    else if (karmaDelta < 0) target.negativeKarma += Math.abs(karmaDelta);
    await target.save();

    if (isCreator) {
      trade.creatorRated = true;
      trade.tradeFeedbackCreator = feedback;
    } else {
      trade.acceptorRated = true;
      trade.tradeFeedbackAcceptor = feedback;
    }
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
      { model: User, as: 'offerCreator', attributes: ['id', 'username', 'role', 'positiveKarma', 'negativeKarma', 'contactDiscord', 'contactSteam', 'contactPSN', 'contactXbox'] },
      { model: User, as: 'acceptor',     attributes: ['id', 'username', 'role', 'positiveKarma', 'negativeKarma', 'contactDiscord', 'contactSteam', 'contactPSN', 'contactXbox'] },
    ];

    const [createdTrades, acceptedTrades, completedTrades] = await Promise.all([
      Trade.findAll({ where: { offerCreatorId: userId, status: { [Op.ne]: 'completed' } }, include, order: [['createdAt', 'DESC']] }),
      Trade.findAll({ where: { acceptorId: userId, status: { [Op.ne]: 'completed' } }, include, order: [['createdAt', 'DESC']] }),
      Trade.findAll({ where: { status: 'completed', [Op.or]: [{ offerCreatorId: userId }, { acceptorId: userId }] }, include, order: [['updatedAt', 'DESC']], limit: 50 }),
    ]);

    // Count pending trades for navbar badge
    const pendingTradeCount = createdTrades.filter(t => t.status === 'awaiting_confirmation').length
      + acceptedTrades.filter(t => t.status === 'awaiting_confirmation').length;

    res.render('myTrades', {
      createdTrades,
      acceptedTrades,
      completedTrades,
      username: req.user.username,
      userId,
      role:    req.user.role,
      karma:   req.user.positiveKarma - 2 * req.user.negativeKarma,
      usernameStyle: getUsernameStyle(req.user.role),
      query:   req.query,
      getUsernameStyle,
      gameKeyMap,
      gameConfigs: require('../controllers/gameController').gameConfigs,
      pendingTradeCount,
    });
  } catch (err) {
    console.error('Error fetching trades:', err);
    res.status(500).send('Server error.');
  }
});

module.exports = router;
