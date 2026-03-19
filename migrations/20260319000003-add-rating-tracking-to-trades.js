'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('trades');

    if (!tableDesc.creatorRated) {
      await queryInterface.addColumn('trades', 'creatorRated', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
    }
    if (!tableDesc.acceptorRated) {
      await queryInterface.addColumn('trades', 'acceptorRated', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('trades', 'creatorRated');
    await queryInterface.removeColumn('trades', 'acceptorRated');
  },
};
