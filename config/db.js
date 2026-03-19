// config/db.js
require('dotenv').config(); // Ensure .env is loaded
const { Sequelize } = require('sequelize');

// Option: read from .env individually
const sequelize = new Sequelize(
  process.env.POSTGRES_DB,         // e.g., "soultrader"
  process.env.POSTGRES_USER,       // e.g., "soultrader_user"
  process.env.POSTGRES_PASSWORD,   // e.g., "someNewPassword"
  {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    dialect: 'postgres',
    logging: false, // or console.log if you want to see raw SQL
  }
);

module.exports = sequelize;
