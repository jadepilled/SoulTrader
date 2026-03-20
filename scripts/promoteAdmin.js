/**
 * One-off script: promote a user to admin by username.
 * Usage: node scripts/promoteAdmin.js psyopgirl
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { sequelize, User } = require('../models');

(async () => {
  const username = process.argv[2];
  if (!username) {
    console.error('Usage: node scripts/promoteAdmin.js <username>');
    process.exit(1);
  }

  try {
    await sequelize.authenticate();
    const user = await User.findOne({ where: { username } });
    if (!user) {
      console.error(`User "${username}" not found.`);
      process.exit(1);
    }
    const prevRole = user.role;
    user.role = 'admin';
    await user.save();
    console.log(`✓ Promoted "${user.username}" from "${prevRole}" → "admin".`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
