'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Step 1: Add new temporary JSON columns
    await queryInterface.addColumn('trades', 'offeredItemsJSON', {
      type: Sequelize.JSON,
      allowNull: true, // Temporarily allow NULL during migration
    });

    await queryInterface.addColumn('trades', 'requestedItemsJSON', {
      type: Sequelize.JSON,
      allowNull: true, // Temporarily allow NULL during migration
    });

    // Step 2: Migrate data from STRING to JSON columns
    const trades = await queryInterface.sequelize.query(
      'SELECT id, "offeredItems", "requestedItems" FROM "trades";',
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const trade of trades) {
      const offeredItems = trade.offeredItems
        ? trade.offeredItems.split(',').map((item) => ({ name: item.trim(), quantity: 1 }))
        : [];
      const requestedItems = trade.requestedItems
        ? trade.requestedItems.split(',').map((item) => ({ name: item.trim(), quantity: 1 }))
        : [];

      await queryInterface.sequelize.query(
        'UPDATE "trades" SET "offeredItemsJSON" = :offeredItems, "requestedItemsJSON" = :requestedItems WHERE "id" = :id;',
        {
          replacements: {
            id: trade.id,
            offeredItems: JSON.stringify(offeredItems),
            requestedItems: JSON.stringify(requestedItems),
          },
        }
      );
    }

    // Step 3: Remove old STRING columns
    await queryInterface.removeColumn('trades', 'offeredItems');
    await queryInterface.removeColumn('trades', 'requestedItems');

    // Step 4: Rename new JSON columns
    await queryInterface.renameColumn('trades', 'offeredItemsJSON', 'offeredItems');
    await queryInterface.renameColumn('trades', 'requestedItemsJSON', 'requestedItems');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert Step 4: Add old STRING columns back
    await queryInterface.addColumn('trades', 'offeredItems', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.addColumn('trades', 'requestedItems', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // Revert Step 3: Migrate JSON back to STRING format
    const trades = await queryInterface.sequelize.query(
      'SELECT id, "offeredItems", "requestedItems" FROM "trades";',
      { type: Sequelize.QueryTypes.SELECT }
    );

    for (const trade of trades) {
      const offeredItems = trade.offeredItems
        ? trade.offeredItems.map((item) => item.name).join(',')
        : '';
      const requestedItems = trade.requestedItems
        ? trade.requestedItems.map((item) => item.name).join(',')
        : '';

      await queryInterface.sequelize.query(
        'UPDATE "trades" SET "offeredItems" = :offeredItems, "requestedItems" = :requestedItems WHERE "id" = :id;',
        {
          replacements: {
            id: trade.id,
            offeredItems,
            requestedItems,
          },
        }
      );
    }

    // Revert Step 2: Remove JSON columns
    await queryInterface.removeColumn('trades', 'offeredItems');
    await queryInterface.removeColumn('trades', 'requestedItems');
  },
};
