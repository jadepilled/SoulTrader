const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Feedback = sequelize.define('Feedback', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { len: [1, 2000] },
  },
  category: {
    type: DataTypes.STRING,
    defaultValue: 'general',
  },
}, {
  tableName: 'feedback',
});

module.exports = Feedback;
