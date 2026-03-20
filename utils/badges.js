// ─── SoulTrader Badge System ──────────────────────────────────────────────────
// Badges are computed dynamically from user state. A user can hold multiple
// badges simultaneously (one per category).

const TRADE_TIERS = [
  { min: 100, name: 'Trade God',           color: '#ffd700' },
  { min: 50,  name: 'Executive Trader',    color: '#c9a0ff' },
  { min: 25,  name: 'Marketeer',           color: '#ff8c42' },
  { min: 10,  name: 'Power Trader',        color: '#5bafff' },
  { min: 5,   name: 'Intermediate Trader', color: '#4ecdc4' },
  { min: 1,   name: 'Initiate Trader',     color: '#8fbc8f' },
];

const KARMA_TIERS = [
  { min: 150, name: 'Angel',        color: '#e8b4d0' },
  { min: 100, name: 'Saint',        color: '#ffd700' },
  { min: 50,  name: 'Hero',         color: '#ff6b6b' },
  { min: 25,  name: 'Knight',       color: '#87ceeb' },
  { min: 5,   name: 'Well-behaved', color: '#98d8a0' },
];

/**
 * Return the appropriate text colour (dark or light) for a given hex background.
 */
function textColorForBg(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#111' : '#fff';
}

/**
 * Compute all badges for a user.
 * @param {object}  user                 Sequelize User instance (or plain object)
 * @param {number}  completedTradeCount  Number of completed trades
 * @returns {Array<{name, color, textColor, category}>}
 */
function computeBadges(user, completedTradeCount = 0) {
  // Banned replaces all other badges
  if (user.isBanned) {
    return [{ name: 'Banned', color: '#ff0000', textColor: '#fff', category: 'status' }];
  }

  const badges = [];
  const karma = (user.positiveKarma || 0) - 2 * (user.negativeKarma || 0);

  // ── Role badges ──
  if (user.role === 'admin')     badges.push({ name: 'Admin',     color: '#fa9cff', textColor: '#111', category: 'role' });
  if (user.role === 'moderator') badges.push({ name: 'Moderator', color: '#5b9bff', textColor: '#fff', category: 'role' });

  // ── Special badges ──
  if (user.username === 'psyopgirl') badges.push({ name: 'CEO',     color: '#ffd700', textColor: '#111', category: 'special' });
  if (user.isSponsor)                badges.push({ name: 'Sponsor', color: '#ff69b4', textColor: '#fff', category: 'special' });

  // ── Verified ──
  if (user.isVerified) badges.push({ name: 'Verified', color: '#4ecdc4', textColor: '#111', category: 'status' });

  // ── Trade tier (highest match only) ──
  for (const tier of TRADE_TIERS) {
    if (completedTradeCount >= tier.min) {
      badges.push({ name: tier.name, color: tier.color, textColor: textColorForBg(tier.color), category: 'trade' });
      break;
    }
  }

  // ── Karma tier ──
  if (karma < -5) {
    badges.push({ name: 'Trade with caution', color: '#ff4444', textColor: '#fff', category: 'karma' });
  } else {
    for (const tier of KARMA_TIERS) {
      if (karma >= tier.min) {
        badges.push({ name: tier.name, color: tier.color, textColor: textColorForBg(tier.color), category: 'karma' });
        break;
      }
    }
  }

  return badges;
}

module.exports = { computeBadges, textColorForBg, TRADE_TIERS, KARMA_TIERS };
