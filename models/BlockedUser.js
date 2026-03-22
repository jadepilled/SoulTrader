const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const BlockedUser = sequelize.define('BlockedUser', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  blockerId: { type: DataTypes.UUID, allowNull: false },
  blockedId: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'blocked_users', timestamps: true });

module.exports = BlockedUser;
