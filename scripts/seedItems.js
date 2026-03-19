require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Item, sequelize } = require('../models');

/**
 * Script usage:
 *   node scripts/seedItems.js darksouls-items.txt
 *
 * The script infers "game" and "type" from the filename, e.g., "Dark Souls" and "Items".
 */

async function seedItemsFromFile(filename) {
  try {
    await sequelize.authenticate();
    console.log('DB connection established.');

    const filePath = path.join(__dirname, '..', filename);

    // Infer game and type from filename
    const match = path.basename(filename).match(/^([a-z0-9-]+)-([a-z]+)\.txt$/i);
    if (!match) {
      throw new Error('Filename must follow the format: <game>-<type>.txt');
    }

    const gameName = match[1].replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); // "darksouls" ? "Dark Souls"
    const type = match[2].charAt(0).toUpperCase() + match[2].slice(1); // "items" ? "Items"

    // Read and parse file
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n').map(line => line.trim()).filter(Boolean);

    for (const line of lines) {
      // Parse parentheses if present
      let name = line;
      const match = line.match(/\(([^)]+)\)$/);
      if (match) {
        name = line.replace(/\([^)]*\)$/, '').trim();
      }

      // Prevent duplicates
      const existingItem = await Item.findOne({ where: { name, game: gameName, type } });
      if (existingItem) {
        console.log(`Skipping duplicate item: [${gameName}] ${name}`);
        continue;
      }

      // Insert item
      await Item.create({
        name,
        game: gameName,
        type,
      });

      console.log(`Inserted item: [${gameName} - ${type}] ${name}`);
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding items:', err);
    process.exit(1);
  }
}

// If run directly from command line:
if (require.main === module) {
  const filename = process.argv[2];
  if (!filename) {
    console.error('Usage: node scripts/seedItems.js <filename>');
    process.exit(1);
  }
  seedItemsFromFile(filename);
}

module.exports = seedItemsFromFile;
