const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TradeOffer = sequelize.define('TradeOffer', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tradeId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  offererId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  inGameName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  meetingPoint: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  additionalInfo: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending', // pending, accepted, cancelled
  },
}, {
  tableName: 'trade_offers',
  timestamps: true,
});

module.exports = TradeOffer;
