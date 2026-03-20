// ─── SoulTrader Content Filter ───────────────────────────────────────────────
// Blocks hateful / bigoted language and strips links.
// Common profanity (fuck, shit, damn, etc.) is explicitly allowed.

const HATE_TERMS = [
  'nigger', 'nigga', 'faggot', 'tranny', 'chink', 'gook', 'spic', 'kike',
  'wetback', 'beaner', 'raghead', 'towelhead', 'coon', 'darkie', 'gringo',
  'retard', 'retarded',
  // Common evasion spellings
  'n1gger', 'n1gga', 'f4ggot', 'tr4nny', 'n!gger', 'f@ggot',
  'nigg3r', 'nigg4',
];

/**
 * Filter user-generated text.
 * @param {string} text
 * @returns {{ blocked: boolean, reason?: string, text?: string }}
 */
function filterContent(text) {
  if (!text || typeof text !== 'string') {
    return { blocked: true, reason: 'Comment cannot be empty.' };
  }

  // Strip URLs / links
  let cleaned = text
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    .replace(/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?/gi, '');

  // Check for hate speech (normalise: lowercase, strip non-alphanumeric except spaces)
  const normalised = cleaned.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  for (const term of HATE_TERMS) {
    // Word-boundary-ish check: must be surrounded by spaces/start/end
    const regex = new RegExp(`(?:^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`);
    if (regex.test(normalised) || normalised.includes(term)) {
      return { blocked: true, reason: 'Your comment contains prohibited language. Hateful or bigoted language is not permitted on SoulTrader.' };
    }
  }

  cleaned = cleaned.trim();
  if (cleaned.length === 0) {
    return { blocked: true, reason: 'Comment cannot be empty after filtering.' };
  }

  return { blocked: false, text: cleaned };
}

module.exports = { filterContent };
