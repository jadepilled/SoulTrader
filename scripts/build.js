/**
 * Build Script — Database sync, item seeding, and icon audit
 * Run: node scripts/build.js
 *      bash scripts/build.sh
 *
 * 1. Connects to the database
 * 2. Runs sequelize.sync({ alter: true }) to rebuild/migrate tables
 * 3. Clears existing items and re-seeds from data/ JSON + manual definitions
 * 4. Compares DB items against icon files on disk
 * 5. Outputs results to terminal (with color) AND build-report.txt
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { sequelize, Item } = require('../models');

const PROJECT_ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(PROJECT_ROOT, 'build-report.txt');

// ── ANSI color helpers ──────────────────────────────────────────────────────
const c = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

// ── Game key / name mapping (same as seedFromData.js) ────────────────────────
const GAME_MAP = {
  ds1: 'Dark Souls',
  ds2: 'Dark Souls 2',
  ds3: 'Dark Souls 3',
  eldenring: 'Elden Ring',
  demonssouls: "Demon's Souls",
};

const TYPE_MAP = {
  weapons: 'weapon',
  shields: 'shield',
  chest: 'chest',
  head: 'head',
  hands: 'hands',
  legs: 'legs',
};

// ── DS1 Boss / Consumable Souls ──────────────────────────────────────────────
const DS1_SOUL_ITEMS = [
  { name: 'Core of an Iron Golem',        type: 'soul', iconFile: 'Core of an Iron Golem.webp' },
  { name: 'Soul of Gwyn, Lord of Cinder', type: 'soul', iconFile: 'Soul of Gwyn, Lord of Cinder.webp' },
  { name: 'Soul of Gwyndolin',            type: 'soul', iconFile: 'Soul of Gwyndolin.webp' },
  { name: 'Soul of Ornstein',             type: 'soul', iconFile: 'Soul of Ornstein.webp' },
  { name: 'Soul of Priscilla',            type: 'soul', iconFile: 'Soul of Priscilla.webp' },
  { name: 'Soul of Quelaag',              type: 'soul', iconFile: 'Soul of Quelaag.webp' },
  { name: 'Soul of Sif',                  type: 'soul', iconFile: 'Soul of Sif.webp' },
  { name: 'Soul of Smough',               type: 'soul', iconFile: 'Soul of Smough.webp' },
  { name: 'Soul of the Moonlight Butterfly', type: 'soul', iconFile: 'Soul of the Moonlight Butterfly.webp' },
  { name: 'Soul of a Lost Undead (200)',           type: 'soul', iconFile: 'Soul of a Lost Undead (200).webp' },
  { name: 'Large Soul of a Lost Undead (400)',     type: 'soul', iconFile: 'Large Soul of a Lost Undead (400).webp' },
  { name: 'Soul of a Nameless Soldier (800)',      type: 'soul', iconFile: 'Soul of a Nameless Soldier (800).webp' },
  { name: 'Large Soul of a Nameless Soldier (1,000)', type: 'soul', iconFile: 'Large Soul of a Nameless Soldier (1,000).webp' },
  { name: 'Soul of a Proud Knight (2,000)',        type: 'soul', iconFile: 'Soul of a Proud Knight (2,000).webp' },
  { name: 'Large Soul of a Proud Knight (3,000)',  type: 'soul', iconFile: 'Large Soul of a Proud Knight (3,000).webp' },
  { name: 'Soul of a Brave Warrior (8,000)',       type: 'soul', iconFile: 'Soul of a Brave Warrior (8,000).webp' },
  { name: 'Large Soul of a Brave Warrior (5,000)', type: 'soul', iconFile: 'Large Soul of a Brave Warrior (5,000).webp' },
  { name: 'Soul of a Hero (10,000)',               type: 'soul', iconFile: 'Soul of a Hero (10,000).webp' },
  { name: 'Soul of a Great Hero (20,000)',         type: 'soul', iconFile: 'Soul of a Great Hero (20,000).webp' },
];

// ── Manual items (currencies, consumables, rings, misc — no icons) ───────────
const MANUAL_ITEMS = [
  // Currencies
  { game: 'Dark Souls',    type: 'currency', name: 'Souls' },
  { game: 'Dark Souls 2',  type: 'currency', name: 'Souls' },
  { game: 'Dark Souls 3',  type: 'currency', name: 'Souls' },
  { game: 'Dark Souls 3',  type: 'currency', name: 'Ember' },
  { game: 'Elden Ring',    type: 'currency', name: 'Runes' },
  { game: "Demon's Souls", type: 'currency', name: 'Souls' },
  // Dark Souls consumables
  { game: 'Dark Souls', type: 'consumable', name: 'Humanity' },
  { game: 'Dark Souls', type: 'consumable', name: 'Twin Humanities' },
  { game: 'Dark Souls', type: 'consumable', name: 'Titanite Shard' },
  { game: 'Dark Souls', type: 'consumable', name: 'Large Titanite Shard' },
  { game: 'Dark Souls', type: 'consumable', name: 'Titanite Chunk' },
  { game: 'Dark Souls', type: 'consumable', name: 'Titanite Slab' },
  { game: 'Dark Souls', type: 'consumable', name: 'Twinkling Titanite' },
  { game: 'Dark Souls', type: 'consumable', name: 'Demon Titanite' },
  { game: 'Dark Souls', type: 'consumable', name: 'Dragon Scale' },
  { game: 'Dark Souls', type: 'consumable', name: 'Green Titanite Shard' },
  { game: 'Dark Souls', type: 'consumable', name: 'White Titanite Shard' },
  { game: 'Dark Souls', type: 'consumable', name: 'Blue Titanite Shard' },
  { game: 'Dark Souls', type: 'consumable', name: 'Red Titanite Shard' },
  { game: 'Dark Souls', type: 'consumable', name: 'Green Titanite Chunk' },
  { game: 'Dark Souls', type: 'consumable', name: 'White Titanite Chunk' },
  { game: 'Dark Souls', type: 'consumable', name: 'Blue Titanite Chunk' },
  { game: 'Dark Souls', type: 'consumable', name: 'Red Titanite Chunk' },
  { game: 'Dark Souls', type: 'consumable', name: "Elizabeth's Mushroom" },
  { game: 'Dark Souls', type: 'consumable', name: 'Divine Blessing' },
  { game: 'Dark Souls', type: 'consumable', name: 'Transient Curse' },
  { game: 'Dark Souls', type: 'consumable', name: 'Black Firebomb' },
  { game: 'Dark Souls', type: 'consumable', name: "Lloyd's Talisman" },
  { game: 'Dark Souls', type: 'consumable', name: 'Cracked Red Eye Orb' },
  { game: 'Dark Souls', type: 'consumable', name: 'Eye of Death' },
  { game: 'Dark Souls', type: 'consumable', name: 'Souvenir of Reprisal' },
  { game: 'Dark Souls', type: 'consumable', name: 'Sunlight Medal' },
  // Dark Souls rings
  { game: 'Dark Souls', type: 'ring', name: "Havel's Ring" },
  { game: 'Dark Souls', type: 'ring', name: 'Ring of Favor and Protection' },
  { game: 'Dark Souls', type: 'ring', name: 'Wolf Ring' },
  { game: 'Dark Souls', type: 'ring', name: 'Hawk Ring' },
  { game: 'Dark Souls', type: 'ring', name: 'Leo Ring' },
  { game: 'Dark Souls', type: 'ring', name: 'Hornet Ring' },
  { game: 'Dark Souls', type: 'ring', name: 'Covetous Gold Serpent Ring' },
  { game: 'Dark Souls', type: 'ring', name: 'Covetous Silver Serpent Ring' },
  { game: 'Dark Souls', type: 'ring', name: 'Orange Charred Ring' },
  { game: 'Dark Souls', type: 'ring', name: 'Ring of Sacrifice' },
  { game: 'Dark Souls', type: 'ring', name: 'Rare Ring of Sacrifice' },
  { game: 'Dark Souls', type: 'ring', name: "Tiny Being's Ring" },
  { game: 'Dark Souls', type: 'ring', name: 'Lingering Dragoncrest Ring' },
  { game: 'Dark Souls', type: 'ring', name: 'Slumbering Dragoncrest Ring' },
  { game: 'Dark Souls', type: 'ring', name: "Ring of the Sun's Firstborn" },
  { game: 'Dark Souls', type: 'ring', name: 'Covenant of Artorias' },
  { game: 'Dark Souls', type: 'ring', name: 'Calamity Ring' },
  { game: 'Dark Souls', type: 'ring', name: 'Cat Covenant Ring' },
  // Dark Souls 2 consumables
  { game: 'Dark Souls 2', type: 'consumable', name: 'Titanite Shard' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Large Titanite Shard' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Titanite Chunk' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Titanite Slab' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Twinkling Titanite' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Petrified Dragon Bone' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Bonfire Ascetic' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Human Effigy' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Smooth & Silky Stone' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Sunlight Medal' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Token of Fidelity' },
  { game: 'Dark Souls 2', type: 'consumable', name: 'Token of Spite' },
  // Dark Souls 2 rings
  { game: 'Dark Souls 2', type: 'ring', name: 'Ring of Blades' },
  { game: 'Dark Souls 2', type: 'ring', name: 'Chloranthy Ring' },
  { game: 'Dark Souls 2', type: 'ring', name: "Havel's Ring" },
  { game: 'Dark Souls 2', type: 'ring', name: 'Third Dragon Ring' },
  { game: 'Dark Souls 2', type: 'ring', name: 'Stone Ring' },
  { game: 'Dark Souls 2', type: 'ring', name: 'Ring of Soul Protection' },
  { game: 'Dark Souls 2', type: 'ring', name: 'Covetous Gold Serpent Ring' },
  // Dark Souls 3 consumables
  { game: 'Dark Souls 3', type: 'consumable', name: 'Titanite Shard' },
  { game: 'Dark Souls 3', type: 'consumable', name: 'Large Titanite Shard' },
  { game: 'Dark Souls 3', type: 'consumable', name: 'Titanite Chunk' },
  { game: 'Dark Souls 3', type: 'consumable', name: 'Titanite Slab' },
  { game: 'Dark Souls 3', type: 'consumable', name: 'Twinkling Titanite' },
  { game: 'Dark Souls 3', type: 'consumable', name: 'Titanite Scale' },
  { game: 'Dark Souls 3', type: 'consumable', name: 'Sunlight Medal' },
  { game: 'Dark Souls 3', type: 'consumable', name: 'Pale Tongue' },
  { game: 'Dark Souls 3', type: 'consumable', name: 'Vertebra Shackle' },
  { game: 'Dark Souls 3', type: 'consumable', name: 'Proof of a Concord Kept' },
  { game: 'Dark Souls 3', type: 'consumable', name: 'Archtree Fragment' },
  // Dark Souls 3 rings
  { game: 'Dark Souls 3', type: 'ring', name: "Havel's Ring" },
  { game: 'Dark Souls 3', type: 'ring', name: 'Ring of Favor' },
  { game: 'Dark Souls 3', type: 'ring', name: 'Chloranthy Ring' },
  { game: 'Dark Souls 3', type: 'ring', name: "Lloyd's Sword Ring" },
  { game: 'Dark Souls 3', type: 'ring', name: 'Covetous Silver Serpent Ring' },
  { game: 'Dark Souls 3', type: 'ring', name: 'Covetous Gold Serpent Ring' },
  { game: 'Dark Souls 3', type: 'ring', name: 'Ring of Steel Protection' },
  // Elden Ring consumables
  { game: 'Elden Ring', type: 'consumable', name: 'Smithing Stone (1)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Smithing Stone (2)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Smithing Stone (3)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Smithing Stone (4)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Smithing Stone (5)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Smithing Stone (6)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Smithing Stone (7)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Smithing Stone (8)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Ancient Dragon Smithing Stone' },
  { game: 'Elden Ring', type: 'consumable', name: 'Somber Smithing Stone (1)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Somber Smithing Stone (2)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Somber Smithing Stone (3)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Somber Smithing Stone (4)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Somber Smithing Stone (5)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Somber Smithing Stone (6)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Somber Smithing Stone (7)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Somber Smithing Stone (8)' },
  { game: 'Elden Ring', type: 'consumable', name: 'Somber Ancient Dragon Smithing Stone' },
  { game: 'Elden Ring', type: 'consumable', name: 'Golden Seed' },
  { game: 'Elden Ring', type: 'consumable', name: 'Sacred Tear' },
  // Elden Ring rings (talismans)
  { game: 'Elden Ring', type: 'ring', name: "Erdtree's Favor" },
  { game: 'Elden Ring', type: 'ring', name: "Radagon's Soreseal" },
  { game: 'Elden Ring', type: 'ring', name: 'Godfrey Icon' },
  { game: 'Elden Ring', type: 'ring', name: 'Shard of Alexander' },
  { game: 'Elden Ring', type: 'ring', name: "Millicent's Prosthesis" },
  { game: 'Elden Ring', type: 'ring', name: 'Rotten Winged Sword Insignia' },
  { game: 'Elden Ring', type: 'ring', name: 'Dragoncrest Greatshield Talisman' },
  // Demon's Souls consumables
  { game: "Demon's Souls", type: 'consumable', name: "Colorless Demon's Soul" },
  { game: "Demon's Souls", type: 'consumable', name: 'Pure Moonlightstone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Pure Bladestone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Pure Clearstone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Pure Dragonstone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Pure Faintstone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Pure Greystone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Pure Hardstone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Pure Marrowstone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Pure Sharpstone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Pure Suckerstone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Spiderstone' },
  { game: "Demon's Souls", type: 'consumable', name: 'Darkmoonstone' },
  // Demon's Souls rings
  { game: "Demon's Souls", type: 'ring', name: "Clever Rat's Ring" },
  { game: "Demon's Souls", type: 'ring', name: 'Cling Ring' },
  { game: "Demon's Souls", type: 'ring', name: "Eternal Warrior's Ring" },
  { game: "Demon's Souls", type: 'ring', name: "Friend's Ring" },
  { game: "Demon's Souls", type: 'ring', name: "Foe's Ring" },
  { game: "Demon's Souls", type: 'ring', name: 'Ring of Avarice' },
  { game: "Demon's Souls", type: 'ring', name: 'Ring of the Accursed' },
];

// ── Dual output helper (terminal + report file) ─────────────────────────────
let reportLines = [];

function log(msg = '') {
  console.log(msg);
  // Strip ANSI codes for the file
  reportLines.push(msg.replace(/\x1b\[[0-9;]*m/g, ''));
}

function writeReport() {
  fs.writeFileSync(REPORT_PATH, reportLines.join('\n') + '\n', 'utf-8');
}

// ── Recursively collect .webp files from a directory ─────────────────────────
function collectWebpFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectWebpFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.webp')) {
      results.push(full);
    }
  }
  return results;
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═════════════════════════════════════════════════════════════════════════════
(async () => {
  try {
    const startTime = Date.now();

    // ── Step 1: Connect ──────────────────────────────────────────────────
    log(c.bold('=== Step 1: Connecting to database ==='));
    await sequelize.authenticate();
    log(c.green('  Connected successfully.\n'));

    // ── Step 2: Sync schema ──────────────────────────────────────────────
    log(c.bold('=== Step 2: Syncing schema (alter: true) ==='));
    await sequelize.sync({ alter: true });
    log(c.green('  Schema synced.\n'));

    // ── Step 3: Clear & re-seed items ────────────────────────────────────
    log(c.bold('=== Step 3: Clearing and re-seeding items ==='));

    const deletedCount = await Item.destroy({ where: {}, truncate: true });
    log(`  Cleared ${deletedCount} existing item rows.\n`);

    const stats = {};
    for (const gameName of Object.values(GAME_MAP)) {
      stats[gameName] = { created: 0, skipped: 0 };
    }

    // Phase 1: JSON data files
    log('  --- Phase 1: Items from data/ JSON files ---');
    for (const [gameKey, gameName] of Object.entries(GAME_MAP)) {
      const jsonPath = path.join(PROJECT_ROOT, 'data', gameKey, 'typed_items_for_web.json');
      if (!fs.existsSync(jsonPath)) {
        log(c.yellow(`  [SKIP] ${gameName}: JSON not found`));
        continue;
      }

      let items;
      try {
        items = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      } catch (err) {
        log(c.red(`  [ERROR] ${gameName}: ${err.message}`));
        continue;
      }

      for (const entry of items) {
        const dbType = TYPE_MAP[entry.type];
        if (!dbType) { stats[gameName].skipped++; continue; }
        const iconPath = `/data/${gameKey}/icons/${entry.image}`;
        await Item.create({ name: entry.name, game: gameName, type: dbType, iconPath });
        stats[gameName].created++;
      }
      log(`  ${c.green('[OK]')} ${gameName}: ${stats[gameName].created} items from JSON`);
    }

    // Phase 2: DS1 soul items
    log('\n  --- Phase 2: DS1 soul items (with icons) ---');
    let soulCount = 0;
    for (const entry of DS1_SOUL_ITEMS) {
      const iconPath = `/data/icons/ds1/souls/${entry.iconFile}`;
      await Item.create({ name: entry.name, game: 'Dark Souls', type: entry.type, iconPath });
      stats['Dark Souls'].created++;
      soulCount++;
    }
    log(`  ${c.green('[OK]')} Dark Souls souls: ${soulCount} items`);

    // Phase 3: Manual items
    log('\n  --- Phase 3: Manual items (consumables, rings, misc, currencies) ---');
    for (const entry of MANUAL_ITEMS) {
      if (!stats[entry.game]) stats[entry.game] = { created: 0, skipped: 0 };
      await Item.create({ name: entry.name, game: entry.game, type: entry.type, iconPath: null });
      stats[entry.game].created++;
    }
    for (const [gameName, s] of Object.entries(stats)) {
      log(`  ${gameName}: ${s.created} total items seeded`);
    }

    // ── Step 4: Icon audit ───────────────────────────────────────────────
    log(`\n${c.bold('=== Step 4: Icon audit — DB items vs disk files ===')}\n`);

    // Build a reverse map: gameName -> gameKey
    const NAME_TO_KEY = {};
    for (const [k, v] of Object.entries(GAME_MAP)) NAME_TO_KEY[v] = k;

    const allItems = await Item.findAll({ raw: true });

    let totalMatched = 0;
    let totalItemsMissingIcon = 0;
    let totalOrphanIcons = 0;

    for (const [gameKey, gameName] of Object.entries(GAME_MAP)) {
      log(c.bold(`  --- ${gameName} (${gameKey}) ---`));

      // Collect all .webp icon files on disk for this game
      const iconsDir = path.join(PROJECT_ROOT, 'data', gameKey, 'icons');
      const diskFiles = collectWebpFiles(iconsDir);

      // Build a set of relative icon paths (as stored in DB: /data/{gameKey}/icons/...)
      const diskPathSet = new Set(
        diskFiles.map((f) => '/' + path.relative(PROJECT_ROOT, f).replace(/\\/g, '/'))
      );

      // Also include the special DS1 souls icon directory
      if (gameKey === 'ds1') {
        const soulsDir = path.join(PROJECT_ROOT, 'data', 'icons', 'ds1', 'souls');
        const soulFiles = collectWebpFiles(soulsDir);
        for (const f of soulFiles) {
          diskPathSet.add('/' + path.relative(PROJECT_ROOT, f).replace(/\\/g, '/'));
        }
      }

      // Items for this game from DB
      const gameItems = allItems.filter((i) => i.game === gameName);
      const dbIconPaths = new Set(gameItems.filter((i) => i.iconPath).map((i) => i.iconPath));

      // Items with icons that exist on disk
      const matched = [];
      const missingIcon = [];
      const noIcon = [];

      for (const item of gameItems) {
        if (!item.iconPath) {
          noIcon.push(item);
          continue;
        }
        if (diskPathSet.has(item.iconPath)) {
          matched.push(item);
        } else {
          missingIcon.push(item);
        }
      }

      // Orphan icons: on disk but no DB item references them
      const orphanIcons = [...diskPathSet].filter((p) => !dbIconPaths.has(p));

      totalMatched += matched.length;
      totalItemsMissingIcon += missingIcon.length;
      totalOrphanIcons += orphanIcons.length;

      log(c.green(`    Matched (icon exists):    ${matched.length}`));
      log(c.dim(`    No icon expected:         ${noIcon.length}`));

      if (missingIcon.length > 0) {
        log(c.yellow(`    Items MISSING icon file:  ${missingIcon.length}`));
        for (const item of missingIcon) {
          log(c.yellow(`      - "${item.name}" -> ${item.iconPath}`));
        }
      } else {
        log(c.green(`    Items missing icon file:  0`));
      }

      if (orphanIcons.length > 0) {
        log(c.yellow(`    Orphan icons (no item):   ${orphanIcons.length}`));
        for (const p of orphanIcons) {
          log(c.yellow(`      - ${p}`));
        }
      } else {
        log(c.green(`    Orphan icons (no item):   0`));
      }

      log('');
    }

    // ── Summary ──────────────────────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(c.bold('=== Build Summary ===\n'));
    log(`  Total items in DB:         ${allItems.length}`);
    log(c.green(`  Icons matched:             ${totalMatched}`));
    if (totalItemsMissingIcon > 0) {
      log(c.yellow(`  Items missing icon file:   ${totalItemsMissingIcon}`));
    } else {
      log(c.green(`  Items missing icon file:   0`));
    }
    if (totalOrphanIcons > 0) {
      log(c.yellow(`  Orphan icon files:         ${totalOrphanIcons}`));
    } else {
      log(c.green(`  Orphan icon files:         0`));
    }
    log(`\n  Completed in ${elapsed}s`);

    // Write report
    writeReport();
    log(c.green(`\n  Report written to ${REPORT_PATH}`));

    process.exit(0);
  } catch (err) {
    log(c.red(`\nBuild FAILED: ${err.message}`));
    log(err.stack);
    writeReport();
    process.exit(1);
  }
})();
