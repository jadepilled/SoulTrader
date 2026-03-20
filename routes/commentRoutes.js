const express = require('express');
const router = express.Router();
const { Comment, User } = require('../models');
const { ensureAuthenticated } = require('../middleware/roleMiddleware');
const { filterContent } = require('../utils/contentFilter');
const rateLimit = require('express-rate-limit');

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Too many comments. Please wait a moment.',
});

// ─── Post a comment on a user's profile ──────────────────────────────────────
router.post('/:profileUserId', ensureAuthenticated, commentLimiter, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) {
      return res.status(400).send('Comment cannot be empty.');
    }
    if (content.length > 200) {
      return res.status(400).send('Comment too long (max 200 characters).');
    }

    const result = filterContent(content);
    if (result.blocked) {
      // Redirect back with error
      const profileUser = await User.findByPk(req.params.profileUserId, { attributes: ['username'] });
      const uname = profileUser ? profileUser.username : '';
      return res.redirect(`/profile/${uname}?error=${encodeURIComponent(result.reason)}`);
    }

    const profileUser = await User.findByPk(req.params.profileUserId, { attributes: ['id', 'username'] });
    if (!profileUser) return res.status(404).send('User not found.');

    await Comment.create({
      content: result.text,
      authorId: req.user.id,
      profileUserId: profileUser.id,
    });

    res.redirect(`/profile/${profileUser.username}`);
  } catch (err) {
    console.error('Error posting comment:', err);
    res.status(500).send('Server error.');
  }
});

// ─── Edit a comment (author only, via AJAX) ──────────────────────────────────
router.put('/:commentId', ensureAuthenticated, async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });
    if (comment.authorId !== req.user.id) return res.status(403).json({ error: 'Forbidden.' });

    const { content } = req.body;
    if (!content || content.trim().length === 0) return res.status(400).json({ error: 'Comment cannot be empty.' });
    if (content.length > 500) return res.status(400).json({ error: 'Comment too long (max 200 characters).' });

    const result = filterContent(content);
    if (result.blocked) return res.status(400).json({ error: result.reason });

    comment.content  = result.text;
    comment.editedAt = new Date();
    await comment.save();

    res.json({ success: true, content: result.text });
  } catch (err) {
    console.error('Error editing comment:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── Delete a comment (author, profile owner, or admin) ─────────────────────
router.delete('/:commentId', ensureAuthenticated, async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found.' });

    const isAuthor       = comment.authorId === req.user.id;
    const isProfileOwner = comment.profileUserId === req.user.id;
    const isAdmin        = req.user.role === 'admin';

    if (!isAuthor && !isProfileOwner && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    await comment.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting comment:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
