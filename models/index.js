const sequelize = require('../config/db');
const User = require('./User');
const Item = require('./Item');
const Trade = require('./Trade');

// Trade creator
Trade.belongsTo(User, { as: 'offerCreator', foreignKey: 'offerCreatorId' });
User.hasMany(Trade, { as: 'createdTrades', foreignKey: 'offerCreatorId' });

// Trade acceptor
Trade.belongsTo(User, { as: 'acceptor', foreignKey: 'acceptorId' });
User.hasMany(Trade, { as: 'acceptedTrades', foreignKey: 'acceptorId' });

// Trade declined by
Trade.belongsTo(User, { as: 'declinedBy', foreignKey: 'declinedById' });

module.exports = {
  sequelize,
  User,
  Item,
  Trade,
};
