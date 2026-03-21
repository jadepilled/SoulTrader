const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Message = sequelize.define('Message', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  content: { type: DataTypes.TEXT, allowNull: false, validate: { len: [1, 1000] } },
  readAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'messages' });

module.exports = Message;
