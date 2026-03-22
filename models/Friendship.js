const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Friendship = sequelize.define('Friendship', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  requesterId: { type: DataTypes.UUID, allowNull: false },
  addresseeId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'pending' }, // pending, accepted, declined
}, { tableName: 'friendships', timestamps: true });

module.exports = Friendship;
