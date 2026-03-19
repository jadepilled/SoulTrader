// models/Item.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Item = sequelize.define('Item', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
type: {
  type: DataTypes.STRING,
  allowNull: false,
},
  // game: "Dark Souls", "Bloodborne", etc.
  game: {
    type: DataTypes.STRING,
    allowNull: false
  }
}, {
  tableName: 'items'
});

module.exports = Item;
