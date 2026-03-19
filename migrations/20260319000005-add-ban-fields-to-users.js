'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('users');

    if (!tableDesc.isBanned) {
      await queryInterface.addColumn('users', 'isBanned', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
    }
    if (!tableDesc.banReason) {
      await queryInterface.addColumn('users', 'banReason', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!tableDesc.suspendedUntil) {
      await queryInterface.addColumn('users', 'suspendedUntil', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'isBanned');
    await queryInterface.removeColumn('users', 'banReason');
    await queryInterface.removeColumn('users', 'suspendedUntil');
  },
};
