(() => {
  'use strict';

  const freezeRows = rows => Object.freeze(rows.map(row => Object.freeze(row)));
  const page = Object.freeze({
    DASHBOARD: 'dashboard',
    PLAN: 'plan',
    ACCOUNTS: 'accounts',
    TRANSACTIONS: 'transactions',
    DATA: 'data'
  });
  window.HouseholdPlannerConstants = window.HouseholdPlannerConstants || {};
  window.HouseholdPlannerConstants.app = Object.freeze({
    STORAGE_KEY: 'household-planner-v1',
    THEME_STORAGE_KEY: 'household-planner-theme',
    PAGE_ID: page,
    DEFAULT_TAB: page.DASHBOARD,
    DEFAULT_ALLOCATIONS: Object.freeze({
      essential: 50,
      savings: 20,
      debt: 10,
      discretionary: 20
    }),
    DEFAULT_FX_RATES: Object.freeze({
      PHP: 1 / 36,
      USD: 1.8
    }),
    BUDGET_CATEGORIES: freezeRows([
      ['essential', 'Essential expenses', 'c1'],
      ['savings', 'Savings', 'c2'],
      ['debt', 'Debt service', 'c3'],
      ['discretionary', 'Discretionary expenses', 'c4']
    ]),
    NAV_TABS: freezeRows([
      [page.DASHBOARD, 'Dashboard', page.DASHBOARD, 'dashboard', 'Dashboard'],
      [page.PLAN, 'Plan', page.PLAN, 'plan', 'Plan'],
      [page.ACCOUNTS, 'Accounts', page.ACCOUNTS, 'accounts', 'Accounts'],
      [page.TRANSACTIONS, 'Transactions', page.TRANSACTIONS, 'transactions', 'Activity'],
      [page.DATA, 'People and data', page.DATA, 'people', 'People']
    ])
  });
})();
