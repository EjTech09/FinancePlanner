(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.data = context => {
    const DATA_CONSTANTS = window.HouseholdPlannerConstants.data;
    const { state, h, save, render, commit, refreshExchangeRates } = context;
    const service = window.HouseholdPlannerPages.dataService(context);
    const view = window.HouseholdPlannerPages.dataView(context, service);

    const exportJson = () => {
      const data = new Blob([JSON.stringify(state, null, 2)], {
        type: 'application/json'
      });
      const link = h('a', {
        href: URL.createObjectURL(data),
        download: DATA_CONSTANTS.EXPORT_FILENAME
      });
      document.body.append(link);
      link.click();
      link.remove();
    };

    const clearData = () => {
      if (!confirm('Delete all data on this device? Export a copy first if you want to keep it.')) {
        return;
      }
      service.clearData();
      save();
      render();
    };

    const addTransactionCategory = name => {
      if (!service.addTransactionCategory(name)) {
        alert('Enter a unique category name.');
        return false;
      }
      save();
      render();
      return true;
    };
    const removeTransactionCategory = category => {
      if (!confirm('Remove this category? Existing transactions will become uncategorized.')) return;
      service.removeTransactionCategory(category);
      save();
      render();
    };

    const addExchangeRate = (currency, value) => {
      if (!service.addExchangeRate(currency, value)) {
        alert('Enter a unique three-letter currency code and a rate greater than zero.');
        return false;
      }
      commit();
      render();
      return true;
    };
    const updateExchangeRate = (currency, input) => {
      if (!service.updateExchangeRate(currency, input)) return;
      commit();
    };
    const removeExchangeRate = currency => {
      if (service.currencyUsage(currency)) {
        alert(`Move all accounts, income, and debts out of ${currency} before removing its rate.`);
        return;
      }
      if (!confirm(`Remove the ${currency} exchange rate?`)) return;
      service.removeExchangeRate(currency);
      commit();
      render();
    };

    return () => view({
      exportJson,
      clearData,
      addTransactionCategory,
      removeTransactionCategory,
      addExchangeRate,
      updateExchangeRate,
      removeExchangeRate,
      refreshExchangeRates
    });
  };
})();
