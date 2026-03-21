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
  if (user.role === 'super_admin') badges.push({ name: 'Super Admin', color: '#b388ff', textColor: '#111', category: 'role' });
  if (user.role === 'admin')       badges.push({ name: 'Admin',       color: '#fa9cff', textColor: '#111', category: 'role' });
  if (user.role === 'moderator')   badges.push({ name: 'Moderator',   color: '#5b9bff', textColor: '#fff', category: 'role' });

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

/**
 * Compute available display roles a user can select for their profile theme.
 * Includes their actual role badge + all unlocked karma/trade tier badges at
 * or below their current level.
 */
function getAvailableDisplayRoles(user, completedTradeCount = 0) {
  const roles = [];
  const karma = (user.positiveKarma || 0) - 2 * (user.negativeKarma || 0);

  // ── Staff roles (only their own actual role, not higher) ──
  const staffRoles = ['super_admin', 'admin', 'moderator'];
  const staffColors = {
    super_admin: '#b388ff',
    admin: '#fa9cff',
    moderator: '#5b9bff',
  };
  const staffLabels = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    moderator: 'Moderator',
  };
  if (staffRoles.includes(user.role)) {
    roles.push({ name: staffLabels[user.role], value: user.role, color: staffColors[user.role], category: 'role' });
  }

  // ── Karma tiers: include ALL tiers at or below user's current karma level ──
  if (karma >= 5) {
    // Iterate from lowest to highest; include all that the user qualifies for
    const sortedKarma = [...KARMA_TIERS].sort((a, b) => a.min - b.min);
    for (const tier of sortedKarma) {
      if (karma >= tier.min) {
        roles.push({ name: tier.name, value: 'karma:' + tier.name, color: tier.color, category: 'karma' });
      }
    }
  }

  // ── Trade tiers: include ALL tiers at or below user's current trade count ──
  if (completedTradeCount >= 1) {
    const sortedTrade = [...TRADE_TIERS].sort((a, b) => a.min - b.min);
    for (const tier of sortedTrade) {
      if (completedTradeCount >= tier.min) {
        roles.push({ name: tier.name, value: 'trade:' + tier.name, color: tier.color, category: 'trade' });
      }
    }
  }

  return roles;
}

/**
 * Validate and resolve a display role value into its display name and color.
 * Returns null if the display role is invalid or no longer earned.
 */
function resolveDisplayRole(displayRoleValue, user, completedTradeCount = 0) {
  if (!displayRoleValue) return null;

  const available = getAvailableDisplayRoles(user, completedTradeCount);
  const match = available.find(r => r.value === displayRoleValue);
  if (!match) return null; // No longer qualified

  return { name: match.name, color: match.color, category: match.category };
}

module.exports = { computeBadges, textColorForBg, TRADE_TIERS, KARMA_TIERS, getAvailableDisplayRoles, resolveDisplayRole };
