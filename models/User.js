const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  verificationToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user',
  },
  // Reputation
  positiveKarma: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  negativeKarma: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  karma: {
    type: DataTypes.VIRTUAL,
    get() {
      return this.getDataValue('positiveKarma') - (2 * this.getDataValue('negativeKarma'));
    },
  },
  // Profile
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  profileImagePath: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Steam linking
  steamId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
  },
  steamUsername: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Discord linking
  discordId: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: true,
  },
  discordUsername: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Moderation
  isBanned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  banReason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  suspendedUntil: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // Password reset
  passwordResetToken: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  passwordResetExpires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // User-configurable contact details
  contactDiscord: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  contactSteam: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  contactPSN: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  contactXbox: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  // Sponsor status (set manually by admins)
  isSponsor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'users',
});

module.exports = User;
