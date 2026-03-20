const sequelize = require('../config/db');
const User = require('./User');
const Item = require('./Item');
const Trade = require('./Trade');
const Comment = require('./Comment');
const Feedback = require('./Feedback');

// Trade creator
Trade.belongsTo(User, { as: 'offerCreator', foreignKey: 'offerCreatorId' });
User.hasMany(Trade, { as: 'createdTrades', foreignKey: 'offerCreatorId' });

// Trade acceptor
Trade.belongsTo(User, { as: 'acceptor', foreignKey: 'acceptorId' });
User.hasMany(Trade, { as: 'acceptedTrades', foreignKey: 'acceptorId' });

// Trade declined by
Trade.belongsTo(User, { as: 'declinedBy', foreignKey: 'declinedById' });

// Comments
Comment.belongsTo(User, { as: 'author',      foreignKey: 'authorId' });
Comment.belongsTo(User, { as: 'profileUser',  foreignKey: 'profileUserId' });
User.hasMany(Comment, { as: 'writtenComments',  foreignKey: 'authorId' });
User.hasMany(Comment, { as: 'profileComments',  foreignKey: 'profileUserId' });

// Feedback
Feedback.belongsTo(User, { as: 'author', foreignKey: 'authorId' });
User.hasMany(Feedback, { as: 'feedbackSubmissions', foreignKey: 'authorId' });

module.exports = {
  sequelize,
  User,
  Item,
  Trade,
  Comment,
  Feedback,
};
