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
      planPeriod: window.HouseholdPlannerConstants.plan.DEFAULT_PERIOD,
      alloc: Object.assign({}, APP_CONSTANTS.DEFAULT_ALLOCATIONS),
      expenses: [],
      goals: [],
      debts: [],
      accounts: [],
      transactionCategories: window.HouseholdPlannerConstants.transactions
        .DEFAULT_CATEGORIES.map(category => Object.assign({}, category)),
      fx: {
        rates: Object.assign({}, APP_CONSTANTS.DEFAULT_FX_RATES),
        updatedAt: { PHP: null, USD: null }
      },
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
    if (!window.HouseholdPlannerConstants.plan.PERIODS.some(([period]) => period === data.planPeriod)) {
      data.planPeriod = defaults.planPeriod;
    }

    const collections = [
      'users', 'income', 'expenses', 'goals',
      'debts', 'accounts', 'commitments', 'transactions', 'transactionCategories'
    ];
    for (const collection of collections) {
      if (!Array.isArray(data[collection])) data[collection] = [];
    }

    const normalizeFrequency = item => {
      if (!window.HouseholdPlannerConstants.plan.PERIODS.some(([period]) => period === item.frequency)) {
        item.frequency = window.HouseholdPlannerConstants.plan.DEFAULT_PERIOD;
      }
    };
    data.income.forEach(income => {
      if (!income.currency) income.currency = DOMAIN_CONSTANTS.DEFAULT_CURRENCY;
      normalizeFrequency(income);
    });
    ['expenses', 'goals', 'debts'].forEach(collection =>
      data[collection].forEach(normalizeFrequency)
    );

    data.alloc = Object.assign({}, defaults.alloc, data.alloc);
    if (data.ui && (data.ui.tab === 'goals' || data.ui.tab === 'debts')) {
      data.ui.tab = 'plan';
    }
    const savedFx = data.fx || {};
    if (savedFx.rates && typeof savedFx.rates === 'object' && !Array.isArray(savedFx.rates)) {
      const rates = {};
      Object.entries(savedFx.rates).forEach(([currency, value]) => {
        const code = currency.toUpperCase();
        const rate = Number(value);
        if (code !== DOMAIN_CONSTANTS.DEFAULT_CURRENCY &&
          /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0) {
          rates[code] = rate;
        }
      });
      data.fx = {
        rates,
        updatedAt: Object.assign({}, savedFx.updatedAt)
      };
    } else {
      const phpPerNzd = num(savedFx.php) || 1 / defaults.fx.rates.PHP;
      const rates = Object.assign({}, defaults.fx.rates, {
        PHP: 1 / phpPerNzd,
        USD: num(savedFx.usd) || defaults.fx.rates.USD
      });
      data.fx = {
        rates,
        updatedAt: {
          PHP: savedFx.phpUpdatedAt || null,
          USD: savedFx.usdUpdatedAt || null
        }
      };
    }
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
