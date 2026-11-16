(() => {
  'use strict';

  /**
   * Browser persistence service.
   *
   * Saves the household planner state to localStorage and normalizes legacy data
   * before returning it to the rest of the application.
   */
  const { num, currencyRate } = window.HouseholdPlannerModel;
  const APP_CONSTANTS = window.HouseholdPlannerConstants.app;
  const DOMAIN_CONSTANTS = window.HouseholdPlannerConstants.domain;

  function blank() {
    return {
      users: [],
      income: [],
      alloc: Object.assign({}, APP_CONSTANTS.DEFAULT_ALLOCATIONS),
      expenses: [],
      goals: [],
      debts: [],
      accounts: [],
      fx: Object.assign({}, APP_CONSTANTS.DEFAULT_FX_RATES, {
        phpUpdatedAt: null,
        usdUpdatedAt: null
      }),
      commitments: [],
      transactions: [],
      ui: {
        tab: APP_CONSTANTS.DEFAULT_TAB,
        accUser: DOMAIN_CONSTANTS.FILTER_ALL
      }
    };
  }

  function normalize(data) {
    const defaults = blank();
    const dataBuild = Number(data.ui && data.ui.build) || 0;

    for (const key of Object.keys(defaults)) {
      if (data[key] == null) data[key] = defaults[key];
    }

    const collections = [
      'users', 'income', 'expenses', 'goals',
      'debts', 'accounts', 'commitments', 'transactions'
    ];
    for (const collection of collections) {
      if (!Array.isArray(data[collection])) data[collection] = [];
    }

    data.income.forEach(income => {
      if (!income.currency) income.currency = DOMAIN_CONSTANTS.DEFAULT_CURRENCY;
    });

    data.alloc = Object.assign({}, defaults.alloc, data.alloc);
    if (data.ui && (data.ui.tab === 'goals' || data.ui.tab === 'debts')) {
      data.ui.tab = 'plan';
    }
    data.fx = Object.assign({}, defaults.fx, data.fx);
    data.ui = Object.assign({}, defaults.ui, data.ui);

    if (dataBuild < 3) {
      data.commitments.forEach(commitment => {
        const account = data.accounts.find(item => item.id === commitment.account);
        const currency = account && account.currency || DOMAIN_CONSTANTS.DEFAULT_CURRENCY;
        if (commitment.amount !== '' && commitment.amount != null) {
          commitment.amount = num(commitment.amount) / currencyRate(currency, data.fx);
        }
      });
    }

    return data;
  }

  function createPersistence() {
    let available = true;
    let savedAt = null;
    try {
      localStorage.setItem('__t', '1');
      localStorage.removeItem('__t');
    } catch (error) {
      available = false;
    }

    return {
      blank,
      normalize,
      get available() {
        return available;
      },
      get savedAt() {
        return savedAt;
      },
      load(key, hasData) {
        try {
          if (available) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const savedData = JSON.parse(raw);
              const state = normalize(savedData);
              return {
                state,
                legacy: !(savedData.ui && savedData.ui.build) && hasData(state)
              };
            }
          }
        } catch (error) {}

        return { state: blank(), legacy: false };
      },
      save(key, state, onFailure) {
        if (!available) return;
        try {
          localStorage.setItem(key, JSON.stringify(state));
          savedAt = new Date();
        } catch (error) {
          available = false;
          onFailure();
        }
      },
      loadTheme(key) {
        try {
          if (available) {
            const savedTheme = localStorage.getItem(key);
            if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
          }
        } catch (error) {}
        return 'auto';
      },
      saveTheme(key, theme) {
        try {
          if (available) {
            if (theme === 'auto') localStorage.removeItem(key);
            else localStorage.setItem(key, theme);
          }
        } catch (error) {}
      }
    };
  }

  window.HouseholdPlannerPersistence = Object.freeze({
    blank,
    normalize,
    create: createPersistence
  });
})();
