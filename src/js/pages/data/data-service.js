(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.dataService = context => {
    const PAGE_ID = window.HouseholdPlannerConstants.app.PAGE_ID;
    const {
      state, persistence, replaceState, setLegacy, markDirty, uid, exchangeRates
    } = context;

    const storageMessage = () => persistence.available
      ? 'Everything you type is saved in this browser on this device. Nothing is sent anywhere.'
      : 'Saving is switched off in this view. Open the file directly in your browser to keep your changes.';

    const clearData = () => {
      replaceState(persistence.blank());
      setLegacy(false);
      state.ui.tab = PAGE_ID.DATA;
      markDirty();
    };

    const addTransactionCategory = name => {
      const normalizedName = (name || '').trim();
      if (!normalizedName || state.transactionCategories.some(category =>
        (category.name || '').trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
      )) return false;
      state.transactionCategories.push({ id: uid(), name: normalizedName });
      return true;
    };
    const removeTransactionCategory = category => {
      state.transactionCategories = state.transactionCategories.filter(item => item !== category);
      state.transactions.forEach(transaction => {
        if (transaction.category === category.id) transaction.category = '';
      });
    };

    const currencyUsage = currency => [
      ...state.accounts.filter(item => item.currency === currency),
      ...state.income.filter(item => item.currency === currency),
      ...state.debts.filter(item => item.currency === currency)
    ].length;
    const addExchangeRate = (currency, value) => {
      const code = (currency || '').trim().toUpperCase();
      const rate = Number(value);
      if (!/^[A-Z]{3}$/.test(code) ||
        code === window.HouseholdPlannerConstants.domain.DEFAULT_CURRENCY ||
        Object.prototype.hasOwnProperty.call(state.fx.rates, code) ||
        !Number.isFinite(rate) || rate <= 0) {
        return false;
      }
      state.fx.rates[code] = rate;
      state.fx.updatedAt[code] = null;
      exchangeRates.setStatus(`Using the manually entered ${code} rate.`);
      return true;
    };
    const updateExchangeRate = (currency, input) => {
      const value = Number(input.value);
      if (!Number.isFinite(value) || value <= 0) {
        exchangeRates.setStatus(`Enter a rate greater than zero for ${currency}; the saved rate is unchanged.`);
        return false;
      }
      state.fx.rates[currency] = value;
      state.fx.updatedAt[currency] = null;
      exchangeRates.setStatus(`Using the manually entered ${currency} rate.`);
      return true;
    };
    const removeExchangeRate = currency => {
      if (!Object.prototype.hasOwnProperty.call(state.fx.rates, currency) ||
        currencyUsage(currency)) return false;
      delete state.fx.rates[currency];
      delete state.fx.updatedAt[currency];
      exchangeRates.setStatus(`Removed the ${currency} exchange rate.`);
      return true;
    };
    const importState = importedData => {
      replaceState(persistence.normalize(importedData));
      setLegacy(false);
      state.ui.tab = PAGE_ID.DASHBOARD;
      markDirty();
    };
    const clearLegacyData = () => {
      replaceState(persistence.blank());
      setLegacy(false);
      state.ui.tab = PAGE_ID.DATA;
      markDirty();
    };
    const keepLegacyData = () => {
      setLegacy(false);
      markDirty();
    };

    return {
      storageMessage,
      clearData,
      addTransactionCategory,
      removeTransactionCategory,
      currencyUsage,
      addExchangeRate,
      updateExchangeRate,
      removeExchangeRate,
      importState,
      clearLegacyData,
      keepLegacyData
    };
  };
})();
