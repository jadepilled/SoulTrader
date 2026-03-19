'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDesc = await queryInterface.describeTable('trades');

    if (!tableDesc.creatorConfirmed) {
      await queryInterface.addColumn('trades', 'creatorConfirmed', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
    }
    if (!tableDesc.acceptorConfirmed) {
      await queryInterface.addColumn('trades', 'acceptorConfirmed', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
    }
    if (!tableDesc.declinedById) {
      await queryInterface.addColumn('trades', 'declinedById', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    if (!tableDesc.cancelledAt) {
      await queryInterface.addColumn('trades', 'cancelledAt', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('trades', 'creatorConfirmed');
    await queryInterface.removeColumn('trades', 'acceptorConfirmed');
    await queryInterface.removeColumn('trades', 'declinedById');
    await queryInterface.removeColumn('trades', 'cancelledAt');
  },
};
