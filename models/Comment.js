const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: { len: [1, 500] },
  },
  editedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'comments',
});

module.exports = Comment;
