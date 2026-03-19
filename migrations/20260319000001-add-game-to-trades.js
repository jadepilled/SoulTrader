'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('trades');
    if (!tableDesc.game) {
      await queryInterface.addColumn('trades', 'game', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'Dark Souls',
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('trades', 'game');
  },
};
