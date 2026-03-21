const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Helper: parse stored JSON items, fall back to legacy CSV gracefully
function parseItems(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Legacy CSV format: "ItemA,ItemB" → [{name,qty:1,upgrade:null}]
    return raw.split(',').filter(Boolean).map(name => ({
      name: name.trim(), qty: 1, upgrade: null, type: 'misc', iconPath: null,
    }));
  }
}

const Trade = sequelize.define('Trade', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  game: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Dark Souls',
  },
  gameVariant: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  offeredItems: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() { return parseItems(this.getDataValue('offeredItems')); },
    set(val) { this.setDataValue('offeredItems', Array.isArray(val) ? JSON.stringify(val) : val); },
  },
  requestedItems: {
    type: DataTypes.TEXT,
    allowNull: false,
    get() { return parseItems(this.getDataValue('requestedItems')); },
    set(val) { this.setDataValue('requestedItems', Array.isArray(val) ? JSON.stringify(val) : val); },
  },
  additionalNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'open',
  },
  offerCreatorId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  acceptorId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  creatorConfirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  acceptorConfirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  creatorRated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  acceptorRated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  declinedById: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  cancelledAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  characterLevel: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // ── Acceptor details (filled when accepting) ──
  acceptorInGameName:     { type: DataTypes.STRING, allowNull: true },
  acceptorDiscordName:    { type: DataTypes.STRING, allowNull: true },
  acceptorMeetingPoint:   { type: DataTypes.STRING, allowNull: true },
  acceptorAdditionalInfo: { type: DataTypes.TEXT,   allowNull: true },
  // ── Creator details (filled when confirming) ──
  creatorInGameName:      { type: DataTypes.STRING, allowNull: true },
  creatorDiscordName:     { type: DataTypes.STRING, allowNull: true },
  creatorMeetingPoint:    { type: DataTypes.STRING, allowNull: true },
  creatorAdditionalInfo:  { type: DataTypes.TEXT,   allowNull: true },
  // ── Timestamps for trade lifecycle ──
  acceptedAt:             { type: DataTypes.DATE,   allowNull: true },
  // ── Trade feedback (filled when rating) ──
  tradeFeedbackCreator:   { type: DataTypes.TEXT,   allowNull: true },
  tradeFeedbackAcceptor:  { type: DataTypes.TEXT,   allowNull: true },
}, {
  tableName: 'trades',
  timestamps: true,
});

module.exports = Trade;
