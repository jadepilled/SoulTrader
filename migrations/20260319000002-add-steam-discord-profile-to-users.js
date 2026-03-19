'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('users');

    if (!tableDesc.steamId) {
      await queryInterface.addColumn('users', 'steamId', {
        type: Sequelize.STRING,
        unique: true,
        allowNull: true,
      });
    }
    if (!tableDesc.steamUsername) {
      await queryInterface.addColumn('users', 'steamUsername', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!tableDesc.discordId) {
      await queryInterface.addColumn('users', 'discordId', {
        type: Sequelize.STRING,
        unique: true,
        allowNull: true,
      });
    }
    if (!tableDesc.discordUsername) {
      await queryInterface.addColumn('users', 'discordUsername', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    if (!tableDesc.bio) {
      await queryInterface.addColumn('users', 'bio', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!tableDesc.profileImagePath) {
      await queryInterface.addColumn('users', 'profileImagePath', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'steamId');
    await queryInterface.removeColumn('users', 'steamUsername');
    await queryInterface.removeColumn('users', 'discordId');
    await queryInterface.removeColumn('users', 'discordUsername');
    await queryInterface.removeColumn('users', 'bio');
    await queryInterface.removeColumn('users', 'profileImagePath');
  },
};
