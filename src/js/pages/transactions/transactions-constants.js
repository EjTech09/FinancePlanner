(() => {
  'use strict';

  const type = Object.freeze({
    INCOME: 'income',
    EXPENSE: 'expense',
    DEBT: 'debt',
    GOAL: 'goal',
    TRANSFER: 'transfer'
  });
  const types = Object.freeze([
    Object.freeze([type.INCOME, 'Income']),
    Object.freeze([type.EXPENSE, 'Expense']),
    Object.freeze([type.DEBT, 'Debt payment']),
    Object.freeze([type.GOAL, 'Goal contribution']),
    Object.freeze([type.TRANSFER, 'Transfer'])
  ]);
  const typeLabels = Object.freeze(Object.fromEntries(types));
  const defaultCategories = Object.freeze([
    Object.freeze({ id: 'general', name: 'General' }),
    Object.freeze({ id: 'food', name: 'Food & dining' }),
    Object.freeze({ id: 'housing', name: 'Housing' }),
    Object.freeze({ id: 'transport', name: 'Transport' }),
    Object.freeze({ id: 'utilities', name: 'Utilities' }),
    Object.freeze({ id: 'health', name: 'Healthcare' }),
    Object.freeze({ id: 'shopping', name: 'Shopping' })
  ]);

  window.HouseholdPlannerConstants = window.HouseholdPlannerConstants || {};
  window.HouseholdPlannerConstants.transactions = Object.freeze({
    TYPE: type,
    TYPES: types,
    TYPE_LABEL: typeLabels,
    DEFAULT_CATEGORIES: defaultCategories,
    DEFAULT_TYPE: type.EXPENSE,
    ICONS: Object.freeze({
      [type.INCOME]: Object.freeze(['--green', '<path d="M12 5v14M12 19l-5-5M12 19l5-5"/>']),
      [type.EXPENSE]: Object.freeze(['--orange', '<path d="M12 19V5M12 5l-5 5M12 5l5 5"/>']),
      [type.DEBT]: Object.freeze(['--red', '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 10h18"/>']),
      [type.GOAL]: Object.freeze(['--blue', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>']),
      [type.TRANSFER]: Object.freeze(['--indigo', '<path d="M5 9h13M18 9l-3-3M18 9l-3 3M19 15H6M6 15l3-3M6 15l3 3"/>'])
    })
  });
})();
