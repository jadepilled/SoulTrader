const express = require('express');
const router = express.Router();
const { Trade, User, Item } = require('../models');
const Sequelize = require('sequelize');
const { transporter } = require('../utils/emailService');
const tradeEmail = require('../utils/tradeEmailService');
const { tradeCreateLimiter, tradeAcceptLimiter } = require('../middleware/rateLimiter');
const { getUsernameStyle } = require('../controllers/gameController');
const { ensureVerified } = require('../middleware/roleMiddleware');

// ─── Game key → DB game name mapping ─────────────────────────────────────────
const gameKeyMap = {
  darksouls: 'Dark Souls',
  darksouls2: 'Dark Souls 2',
  darksouls3: 'Dark Souls 3',
  bloodborne: 'Bloodborne',
  eldenring: 'Elden Ring',
  demonssouls: "Demon's Souls",
};

// ─── CREATE TRADE ────────────────────────────────────────────────────────────
router.post('/create', tradeCreateLimiter, ensureVerified, async (req, res) => {
  try {
    const { offeredItems, requestedItems, platform, additionalNotes, game } = req.body;

    if (!req.user) {
      return res.status(401).send('You must be logged in to create a trade offer.');
    }

    if (!offeredItems || !requestedItems || !platform || !game) {
      return res.status(400).send('Bad Request: Missing required fields.');
    }

    const gameName = gameKeyMap[game] || game;

    const offeredItemsArray = typeof offeredItems === 'string'
      ? offeredItems.split(',').map(i => i.trim()).filter(Boolean)
      : [];
    const requestedItemsArray = typeof requestedItems === 'string'
      ? requestedItems.split(',').map(i => i.trim()).filter(Boolean)
      : [];

    // Validate items exist for this game
    const offeredItemRecords = await Item.findAll({
      where: { name: offeredItemsArray, game: gameName },
    });
    if (offeredItemRecords.length !== offeredItemsArray.length) {
      return res.status(400).send('Bad Request: One or more offered items are invalid.');
    }

    const requestedItemRecords = await Item.findAll({
      where: { name: requestedItemsArray, game: gameName },
    });
    if (requestedItemRecords.length !== requestedItemsArray.length) {
      return res.status(400).send('Bad Request: One or more requested items are invalid.');
    }

    await Trade.create({
      offeredItems: offeredItemsArray.join(','),
      requestedItems: requestedItemsArray.join(','),
      platform,
      additionalNotes,
      game: gameName,
      offerCreatorId: req.user.id,
    });

    // Redirect back to the originating game page
    const gameKey = Object.keys(gameKeyMap).find(k => gameKeyMap[k] === gameName) || 'darksouls';
    res.redirect(`/${gameKey}`);
  } catch (error) {
    console.error('Error creating trade offer:', error);
    res.status(500).send('Server error');
  }
});

// ─── SEARCH ITEMS ────────────────────────────────────────────────────────────
router.get('/search-items', async (req, res) => {
  const { game, query } = req.query;
  if (!game || !query) {
    return res.status(400).json({ error: 'Missing game or query parameter' });
  }

  try {
    const gameName = gameKeyMap[game] || game;
    const items = await Item.findAll({
      where: {
        game: gameName,
        name: { [Sequelize.Op.iLike]: `%${query}%` },
      },
      attributes: ['name'],
      limit: 20,
    });
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── ACCEPT TRADE ────────────────────────────────────────────────────────────
router.post('/accept/:id', tradeAcceptLimiter, ensureVerified, async (req, res) => {
  try {
    const { meetingPoint, discordName, additionalInfo, inGameName } = req.body;
    const tradeId = req.params.id;

    if (!req.user) {
      return res.status(401).json({ error: 'You must be logged in.' });
    }

    const trade = await Trade.findByPk(tradeId, {
      include: [{ model: User, as: 'offerCreator', attributes: ['id', 'email', 'username'] }],
    });

    if (!trade) {
      return res.status(404).json({ error: 'Trade offer not found.' });
    }

    if (trade.status !== 'open') {
      return res.status(400).json({ error: 'This trade is no longer available.' });
    }

    if (trade.offerCreatorId === req.user.id) {
      return res.status(400).json({ error: 'You cannot accept your own trade offer.' });
    }

    trade.status = 'awaiting_confirmation';
    trade.acceptorId = req.user.id;
    await trade.save();

    // Send email to creator
    try {
      await tradeEmail.sendTradeAcceptedEmail(
        trade.offerCreator.email,
        trade.offerCreator.username,
        req.user.username,
        trade,
        { meetingPoint, discordName, inGameName, additionalInfo }
      );
    } catch (emailErr) {
      console.error('Failed to send trade accepted email:', emailErr);
    }

    return res.status(200).json({ success: true, message: 'Trade accepted successfully.' });
  } catch (error) {
    console.error('Error accepting trade offer:', error);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ─── CONFIRM TRADE (dual confirmation) ───────────────────────────────────────
router.post('/confirm/:id', async (req, res) => {
  try {
    const tradeId = req.params.id;
    const userId = req.user.id;

    const trade = await Trade.findByPk(tradeId, {
      include: [
        { model: User, as: 'offerCreator', attributes: ['id', 'email', 'username'] },
        { model: User, as: 'acceptor', attributes: ['id', 'email', 'username'] },
      ],
    });

    if (!trade || trade.status !== 'awaiting_confirmation') {
      return res.status(400).send('Invalid trade or not awaiting confirmation.');
    }

    const isCreator = trade.offerCreatorId === userId;
    const isAcceptor = trade.acceptorId === userId;

    if (!isCreator && !isAcceptor) {
      return res.status(403).send('You are not part of this trade.');
    }

    // Mark the confirming party
    if (isCreator) {
      trade.creatorConfirmed = true;
    } else {
      trade.acceptorConfirmed = true;
    }

    // Check if both confirmed
    if (trade.creatorConfirmed && trade.acceptorConfirmed) {
      trade.status = 'completed';
      await trade.save();

      // Email both parties to rate
      try {
        await tradeEmail.sendTradeCompletedEmail(
          trade.offerCreator.email, trade.offerCreator.username, trade.acceptor.username, trade
        );
        await tradeEmail.sendTradeCompletedEmail(
          trade.acceptor.email, trade.acceptor.username, trade.offerCreator.username, trade
        );
      } catch (emailErr) {
        console.error('Failed to send trade completed email:', emailErr);
      }
    } else {
      await trade.save();

      // Notify the other party
      const otherUser = isCreator ? trade.acceptor : trade.offerCreator;
      const confirmer = isCreator ? trade.offerCreator : trade.acceptor;
      try {
        await tradeEmail.sendTradeConfirmedByPartyEmail(
          otherUser.email, confirmer.username, otherUser.username, trade
        );
      } catch (emailErr) {
        console.error('Failed to send partial confirmation email:', emailErr);
      }
    }

    return res.redirect('/trade/my-trades');
  } catch (error) {
    console.error('Error confirming trade:', error);
    res.status(500).send('Server error confirming trade.');
  }
});

// ─── DECLINE TRADE ───────────────────────────────────────────────────────────
router.post('/decline/:id', async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');

    const trade = await Trade.findByPk(req.params.id, {
      include: [
        { model: User, as: 'offerCreator', attributes: ['id', 'email', 'username'] },
        { model: User, as: 'acceptor', attributes: ['id', 'email', 'username'] },
      ],
    });

    if (!trade) return res.status(404).send('Trade not found.');

    if (trade.status !== 'awaiting_confirmation') {
      return res.status(400).send('Only trades awaiting confirmation can be declined.');
    }

    if (trade.offerCreatorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).send('Only the trade creator or an admin can decline.');
    }

    trade.status = 'declined';
    trade.declinedById = req.user.id;
    await trade.save();

    // Notify acceptor
    if (trade.acceptor) {
      try {
        await tradeEmail.sendTradeDeclinedEmail(
          trade.acceptor.email, trade.acceptor.username, trade.offerCreator.username, trade
        );
      } catch (emailErr) {
        console.error('Failed to send trade declined email:', emailErr);
      }
    }

    return res.redirect('/trade/my-trades');
  } catch (error) {
    console.error('Error declining trade:', error);
    res.status(500).send('Server error.');
  }
});

// ─── CANCEL TRADE ────────────────────────────────────────────────────────────
router.post('/cancel/:id', async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');

    const trade = await Trade.findByPk(req.params.id, {
      include: [
        { model: User, as: 'offerCreator', attributes: ['id', 'username'] },
        { model: User, as: 'acceptor', attributes: ['id', 'email', 'username'] },
      ],
    });

    if (!trade) return res.status(404).send('Trade not found.');

    if (trade.offerCreatorId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).send('Only the trade creator or an admin can cancel.');
    }

    if (trade.status === 'completed') {
      return res.status(400).send('Completed trades cannot be cancelled.');
    }

    const hadAcceptor = trade.acceptor && trade.status === 'awaiting_confirmation';

    trade.status = 'cancelled';
    trade.cancelledAt = new Date();
    await trade.save();

    // Notify acceptor if there was one
    if (hadAcceptor) {
      try {
        await tradeEmail.sendTradeCancelledEmail(
          trade.acceptor.email, trade.acceptor.username, trade.offerCreator.username, trade
        );
      } catch (emailErr) {
        console.error('Failed to send trade cancelled email:', emailErr);
      }
    }

    return res.redirect('/trade/my-trades');
  } catch (error) {
    console.error('Error cancelling trade:', error);
    res.status(500).send('Server error.');
  }
});

// ─── RESCIND TRADE (legacy alias for cancel) ─────────────────────────────────
router.post('/rescind/:id', async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');

    const trade = await Trade.findByPk(req.params.id);
    if (!trade) return res.status(404).send('Trade offer not found.');

    const isAdmin = req.user.role === 'admin';
    const isOwner = trade.offerCreatorId === req.user.id;

    if (!isOwner && !isAdmin) {
      return res.status(403).send('You are not authorized to rescind this trade offer.');
    }

    trade.status = 'cancelled';
    trade.cancelledAt = new Date();
    await trade.save();

    // Redirect back to referring game page or my-trades
    const gameKey = Object.keys(gameKeyMap).find(k => gameKeyMap[k] === trade.game) || 'darksouls';
    res.redirect(`/${gameKey}?trade=rescinded`);
  } catch (error) {
    console.error('Error rescinding trade offer:', error);
    res.status(500).send('Server error');
  }
});

// ─── TRADE DETAILS ───────────────────────────────────────────────────────────
router.get('/details/:id', async (req, res) => {
  try {
    const trade = await Trade.findByPk(req.params.id, {
      include: [{ model: User, as: 'offerCreator', attributes: ['username'] }],
    });

    if (!trade) {
      return res.status(404).json({ error: 'Trade offer not found.' });
    }

    res.json({
      offerCreator: trade.offerCreator,
      offeredItems: trade.offeredItems,
      requestedItems: trade.requestedItems,
      game: trade.game,
    });
  } catch (error) {
    console.error('Error fetching trade details:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── RATE TRADE PARTNER ──────────────────────────────────────────────────────
router.post('/rate/:id', ensureVerified, async (req, res) => {
  try {
    if (!req.user) return res.status(401).send('Unauthorized');

    const { rating } = req.body;
    const tradeId = req.params.id;
    const r = parseInt(rating, 10);

    if (Number.isNaN(r) || r < 1 || r > 10) {
      return res.status(400).send('Invalid rating value. Must be 1-10.');
    }

    const trade = await Trade.findByPk(tradeId, {
      include: [
        { model: User, as: 'offerCreator' },
        { model: User, as: 'acceptor' },
      ],
    });

    if (!trade || trade.status !== 'completed') {
      return res.status(400).send('Trade not found or not completed yet.');
    }

    const isCreator = req.user.id === trade.offerCreatorId;
    const isAcceptor = req.user.id === trade.acceptorId;

    if (!isCreator && !isAcceptor) {
      return res.status(403).send('You are not part of this trade.');
    }

    // Prevent duplicate ratings
    if (isCreator && trade.creatorRated) {
      return res.status(400).send('You have already rated this trade.');
    }
    if (isAcceptor && trade.acceptorRated) {
      return res.status(400).send('You have already rated this trade.');
    }

    // Determine target user and karma delta
    const targetUser = isCreator ? trade.acceptor : trade.offerCreator;

    let karmaDelta = 0;
    switch (r) {
      case 10: karmaDelta = 5; break;
      case 9: karmaDelta = 4; break;
      case 8: karmaDelta = 3; break;
      case 7: karmaDelta = 2; break;
      case 6: karmaDelta = 1; break;
      case 5: karmaDelta = 0; break;
      case 4: karmaDelta = -1; break;
      case 3: karmaDelta = -2; break;
      case 2: karmaDelta = -3; break;
      case 1: karmaDelta = -5; break;
      default: karmaDelta = 0; break;
    }

    // Update split karma
    if (karmaDelta > 0) {
      targetUser.positiveKarma += karmaDelta;
    } else if (karmaDelta < 0) {
      targetUser.negativeKarma += Math.abs(karmaDelta);
    }
    await targetUser.save();

    // Mark as rated
    if (isCreator) {
      trade.creatorRated = true;
    } else {
      trade.acceptorRated = true;
    }
    await trade.save();

    return res.redirect('/trade/my-trades');
  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).send('Server error.');
  }
});

// ─── MY TRADES ───────────────────────────────────────────────────────────────
router.get('/my-trades', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/');
    }

    const userId = req.user.id;

    const createdTrades = await Trade.findAll({
      where: { offerCreatorId: userId },
      include: [
        { model: User, as: 'offerCreator', attributes: ['id', 'username', 'role', 'positiveKarma', 'negativeKarma'] },
        { model: User, as: 'acceptor', attributes: ['id', 'username', 'role', 'positiveKarma', 'negativeKarma'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    const acceptedTrades = await Trade.findAll({
      where: { acceptorId: userId },
      include: [
        { model: User, as: 'offerCreator', attributes: ['id', 'username', 'role', 'positiveKarma', 'negativeKarma'] },
        { model: User, as: 'acceptor', attributes: ['id', 'username', 'role', 'positiveKarma', 'negativeKarma'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.render('myTrades', {
      createdTrades,
      acceptedTrades,
      username: req.user.username,
      userId: req.user.id,
      role: req.user.role,
      karma: req.user.positiveKarma - req.user.negativeKarma,
      getUsernameStyle,
      gameKeyMap,
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).send('Server error while fetching trades.');
  }
});

module.exports = router;
