const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Report = sequelize.define('Report', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  reason: { type: DataTypes.TEXT, allowNull: false, validate: { len: [1, 500] } },
  type: { type: DataTypes.STRING, defaultValue: 'user' }, // 'user' or 'message'
  status: { type: DataTypes.STRING, defaultValue: 'pending' }, // 'pending', 'reviewed', 'dismissed'
  adminNotes: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'reports' });

module.exports = Report;
