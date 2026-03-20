/**
 * Unified Item Seed Script
 * Run: node seeds/seedFromData.js
 *
 * Reads typed_items_for_web.json from data/ directories to populate items with icons,
 * and also seeds manually-defined consumables, rings, and misc items (no icons).
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { sequelize, Item } = require('../models');

// ── Game key → DB name mapping ──────────────────────────────────────────────
const GAME_MAP = {
  ds1: 'Dark Souls',
  ds2: 'Dark Souls 2',
  ds3: 'Dark Souls 3',
  bloodborne: 'Bloodborne',
  eldenring: 'Elden Ring',
  demonssouls: "Demon's Souls",
};

// ── JSON type → DB type mapping ─────────────────────────────────────────────
const TYPE_MAP = {
  weapons: 'weapon',
  shields: 'shield',
  chest: 'chest',
  head: 'head',
  hands: 'hands',
  legs: 'legs',
};

// ── Boss Souls & Consumable Souls with icons (DS1) ──────────────────────────
const DS1_SOUL_ITEMS = [
  // Boss Souls
  { name: 'Core of an Iron Golem',       type: 'soul', iconFile: 'Core of an Iron Golem.webp' },
  { name: 'Soul of Gwyn, Lord of Cinder', type: 'soul', iconFile: 'Soul of Gwyn, Lord of Cinder.webp' },
  { name: 'Soul of Gwyndolin',            type: 'soul', iconFile: 'Soul of Gwyndolin.webp' },
  { name: 'Soul of Ornstein',             type: 'soul', iconFile: 'Soul of Ornstein.webp' },
  { name: 'Soul of Priscilla',            type: 'soul', iconFile: 'Soul of Priscilla.webp' },
  { name: 'Soul of Quelaag',              type: 'soul', iconFile: 'Soul of Quelaag.webp' },
  { name: 'Soul of Sif',                  type: 'soul', iconFile: 'Soul of Sif.webp' },
  { name: 'Soul of Smough',               type: 'soul', iconFile: 'Soul of Smough.webp' },
  { name: 'Soul of the Moonlight Butterfly', type: 'soul', iconFile: 'Soul of the Moonlight Butterfly.webp' },
  // Consumable Soul Items
  { name: 'Soul of a Lost Undead',         type: 'soul', iconFile: 'Soul of a Lost Undead (200).webp' },
  { name: 'Large Soul of a Lost Undead',   type: 'soul', iconFile: 'Large Soul of a Lost Undead (400).webp' },
  { name: 'Soul of a Nameless Soldier',    type: 'soul', iconFile: 'Soul of a Nameless Soldier (800).webp' },
  { name: 'Large Soul of a Nameless Soldier', type: 'soul', iconFile: 'Large Soul of a Nameless Soldier (1,000).webp' },
  { name: 'Soul of a Proud Knight',        type: 'soul', iconFile: 'Soul of a Proud Knight (2,000).webp' },
  { name: 'Large Soul of a Proud Knight',  type: 'soul', iconFile: 'Large Soul of a Proud Knight (3,000).webp' },
  { name: 'Soul of a Brave Warrior',       type: 'soul', iconFile: 'Soul of a Brave Warrior (8,000).webp' },
  { name: 'Large Soul of a Brave Warrior', type: 'soul', iconFile: 'Large Soul of a Brave Warrior (5,000).webp' },
  { name: 'Soul of a Hero',                type: 'soul', iconFile: 'Soul of a Hero (10,000).webp' },
  { name: 'Soul of a Great Hero',          type: 'soul', iconFile: 'Soul of a Great Hero (20,000).webp' },
];

// ── Manually-defined items (consumables, rings, misc, currencies — no icon data) ────
const MANUAL_ITEMS = [
  // ═══════════════════════════════════════════
  //  CURRENCIES (all games)
  // ═══════════════════════════════════════════
  { game: 'Dark Souls',    type: 'currency', name: 'Souls' },
  { game: 'Dark Souls 2',  type: 'currency', name: 'Souls' },
  { game: 'Dark Souls 3',  type: 'currency', name: 'Souls' },
  { game: 'Dark Souls 3',  type: 'currency', name: 'Ember' },
  { game: 'Bloodborne',    type: 'currency', name: 'Blood Echoes' },
  { game: 'Bloodborne',    type: 'currency', name: 'Insight' },
  { game: 'Elden Ring',    type: 'currency', name: 'Runes' },
  { game: "Demon's Souls", type: 'currency', name: 'Souls' },

  // ═══════════════════════════════════════════
  //  DARK SOULS
  // ═══════════════════════════════════════════
  // Consumables
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
  // Rings
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

  // ═══════════════════════════════════════════
  //  DARK SOULS 2
  // ═══════════════════════════════════════════
  // Consumables
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
  // Rings
  { game: 'Dark Souls 2', type: 'ring', name: 'Ring of Blades' },
  { game: 'Dark Souls 2', type: 'ring', name: 'Chloranthy Ring' },
  { game: 'Dark Souls 2', type: 'ring', name: "Havel's Ring" },
  { game: 'Dark Souls 2', type: 'ring', name: 'Third Dragon Ring' },
  { game: 'Dark Souls 2', type: 'ring', name: 'Stone Ring' },
  { game: 'Dark Souls 2', type: 'ring', name: 'Ring of Soul Protection' },
  { game: 'Dark Souls 2', type: 'ring', name: 'Covetous Gold Serpent Ring' },

  // ═══════════════════════════════════════════
  //  DARK SOULS 3
  // ═══════════════════════════════════════════
  // Consumables
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
  // Rings
  { game: 'Dark Souls 3', type: 'ring', name: "Havel's Ring" },
  { game: 'Dark Souls 3', type: 'ring', name: 'Ring of Favor' },
  { game: 'Dark Souls 3', type: 'ring', name: 'Chloranthy Ring' },
  { game: 'Dark Souls 3', type: 'ring', name: "Lloyd's Sword Ring" },
  { game: 'Dark Souls 3', type: 'ring', name: 'Covetous Silver Serpent Ring' },
  { game: 'Dark Souls 3', type: 'ring', name: 'Covetous Gold Serpent Ring' },
  { game: 'Dark Souls 3', type: 'ring', name: 'Ring of Steel Protection' },

  // ═══════════════════════════════════════════
  //  BLOODBORNE
  // ═══════════════════════════════════════════
  // Consumables
  { game: 'Bloodborne', type: 'consumable', name: 'Blood Stone Shard' },
  { game: 'Bloodborne', type: 'consumable', name: 'Twin Blood Stone Shards' },
  { game: 'Bloodborne', type: 'consumable', name: 'Blood Stone Chunk' },
  { game: 'Bloodborne', type: 'consumable', name: 'Blood Rock' },
  { game: 'Bloodborne', type: 'consumable', name: 'Coldblood Dew' },
  { game: 'Bloodborne', type: 'consumable', name: 'Ritual Blood (1)' },
  { game: 'Bloodborne', type: 'consumable', name: 'Ritual Blood (5)' },
  { game: 'Bloodborne', type: 'consumable', name: "Sage's Hair" },
  { game: 'Bloodborne', type: 'consumable', name: "Sage's Wrist" },
  { game: 'Bloodborne', type: 'consumable', name: 'Red Jelly' },
  { game: 'Bloodborne', type: 'consumable', name: 'Bastard of Loran' },
  { game: 'Bloodborne', type: 'consumable', name: 'Yellow Backbone' },
  { game: 'Bloodborne', type: 'consumable', name: 'Cursed Damp Blood Gem' },
  // Misc
  { game: 'Bloodborne', type: 'misc', name: 'Radial Blood Gem' },
  { game: 'Bloodborne', type: 'misc', name: 'Triangle Blood Gem' },
  { game: 'Bloodborne', type: 'misc', name: 'Waning Blood Gem' },
  { game: 'Bloodborne', type: 'misc', name: 'Circular Blood Gem' },

  // ═══════════════════════════════════════════
  //  ELDEN RING
  // ═══════════════════════════════════════════
  // Consumables
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
  // Rings (Talismans)
  { game: 'Elden Ring', type: 'ring', name: "Erdtree's Favor" },
  { game: 'Elden Ring', type: 'ring', name: "Radagon's Soreseal" },
  { game: 'Elden Ring', type: 'ring', name: 'Godfrey Icon' },
  { game: 'Elden Ring', type: 'ring', name: 'Shard of Alexander' },
  { game: 'Elden Ring', type: 'ring', name: "Millicent's Prosthesis" },
  { game: 'Elden Ring', type: 'ring', name: 'Rotten Winged Sword Insignia' },
  { game: 'Elden Ring', type: 'ring', name: 'Dragoncrest Greatshield Talisman' },

  // ═══════════════════════════════════════════
  //  DEMON'S SOULS
  // ═══════════════════════════════════════════
  // Consumables
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
  // Rings
  { game: "Demon's Souls", type: 'ring', name: "Clever Rat's Ring" },
  { game: "Demon's Souls", type: 'ring', name: 'Cling Ring' },
  { game: "Demon's Souls", type: 'ring', name: "Eternal Warrior's Ring" },
  { game: "Demon's Souls", type: 'ring', name: "Friend's Ring" },
  { game: "Demon's Souls", type: 'ring', name: "Foe's Ring" },
  { game: "Demon's Souls", type: 'ring', name: 'Ring of Avarice' },
  { game: "Demon's Souls", type: 'ring', name: 'Ring of the Accursed' },
];

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.\n');
    await sequelize.sync({ alter: true });

    const stats = {};
    for (const gameName of Object.values(GAME_MAP)) {
      stats[gameName] = { created: 0, updated: 0, skipped: 0 };
    }

    // ── Phase 1: Seed items from typed_items_for_web.json files ───────────
    console.log('=== Phase 1: Seeding items from data/ JSON files ===\n');

    for (const [gameKey, gameName] of Object.entries(GAME_MAP)) {
      const jsonPath = path.join(__dirname, '..', 'data', gameKey, 'typed_items_for_web.json');

      if (!fs.existsSync(jsonPath)) {
        console.log(`  [SKIP] ${gameName}: ${jsonPath} not found`);
        continue;
      }

      let items;
      try {
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        items = JSON.parse(raw);
      } catch (err) {
        console.error(`  [ERROR] ${gameName}: Failed to parse JSON - ${err.message}`);
        continue;
      }

      console.log(`  [LOAD] ${gameName}: ${items.length} items from ${gameKey}/typed_items_for_web.json`);

      for (const entry of items) {
        const dbType = TYPE_MAP[entry.type];
        if (!dbType) {
          console.warn(`    [WARN] Unknown type "${entry.type}" for item "${entry.name}" in ${gameName}, skipping`);
          stats[gameName].skipped++;
          continue;
        }

        const iconPath = `/data/${gameKey}/icons/${entry.image}`;

        const [item, wasCreated] = await Item.findOrCreate({
          where: { name: entry.name, game: gameName },
          defaults: { name: entry.name, game: gameName, type: dbType, iconPath },
        });

        if (wasCreated) {
          stats[gameName].created++;
        } else {
          // Update iconPath if the item already exists (icons may have been added later)
          if (item.iconPath !== iconPath) {
            await item.update({ iconPath });
            stats[gameName].updated++;
          } else {
            stats[gameName].skipped++;
          }
        }
      }
    }

    // ── Phase 2: Seed DS1 soul items (boss souls + consumable souls with icons) ──
    console.log('\n=== Phase 2: Seeding DS1 soul items (with icons) ===\n');

    for (const entry of DS1_SOUL_ITEMS) {
      const gameName = 'Dark Souls';
      const iconPath = `/data/icons/ds1/souls/${entry.iconFile}`;

      const [item, wasCreated] = await Item.findOrCreate({
        where: { name: entry.name, game: gameName },
        defaults: { name: entry.name, game: gameName, type: entry.type, iconPath },
      });

      if (wasCreated) {
        stats[gameName].created++;
      } else {
        if (item.iconPath !== iconPath) {
          await item.update({ iconPath });
          stats[gameName].updated++;
        } else {
          stats[gameName].skipped++;
        }
      }
    }

    // ── Phase 3: Seed manual items (consumables, rings, misc, currencies) ──
    console.log('\n=== Phase 3: Seeding manual items (consumables, rings, misc, currencies) ===\n');

    for (const entry of MANUAL_ITEMS) {
      if (!stats[entry.game]) {
        stats[entry.game] = { created: 0, updated: 0, skipped: 0 };
      }

      const [, wasCreated] = await Item.findOrCreate({
        where: { name: entry.name, game: entry.game },
        defaults: { ...entry, iconPath: null },
      });

      if (wasCreated) {
        stats[entry.game].created++;
      } else {
        stats[entry.game].skipped++;
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('\n=== Seed Summary ===\n');

    let totalCreated = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;

    for (const [gameName, s] of Object.entries(stats)) {
      const total = s.created + s.updated + s.skipped;
      console.log(`  ${gameName}:`);
      console.log(`    Created: ${s.created}  |  Updated: ${s.updated}  |  Skipped: ${s.skipped}  |  Total: ${total}`);
      totalCreated += s.created;
      totalUpdated += s.updated;
      totalSkipped += s.skipped;
    }

    const grandTotal = totalCreated + totalUpdated + totalSkipped;
    console.log(`\n  TOTAL: Created ${totalCreated} | Updated ${totalUpdated} | Skipped ${totalSkipped} | Total ${grandTotal} items`);
    console.log('\nSeed complete.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
