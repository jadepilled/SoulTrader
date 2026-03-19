// models/Item.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Item = sequelize.define('Item', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  game: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  iconPath: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'items',
});

module.exports = Item;
