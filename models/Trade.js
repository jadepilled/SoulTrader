const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Trade = sequelize.define('Trade', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  game: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Dark Souls',
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  offeredItems: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  requestedItems: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  additionalNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'open',
  },
  offerCreatorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  acceptorId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  // Dual confirmation
  creatorConfirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  acceptorConfirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Rating tracking
  creatorRated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  acceptorRated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Decline/cancel
  declinedById: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'trades',
  timestamps: true,
});

module.exports = Trade;
