(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.data = context => {
    const DATA_CONSTANTS = window.HouseholdPlannerConstants.data;
    const { state, h, save, render, commit, refreshExchangeRates, hasData } = context;
    const service = window.HouseholdPlannerPages.dataService(context);
    const view = window.HouseholdPlannerPages.dataView(context, service);

    const importFileInput = h('input', {
      type: 'file',
      accept: 'application/json,.json',
      hidden: true,
      'aria-label': 'Import JSON file'
    });
    importFileInput.addEventListener('change', () => {
      const selectedFile = importFileInput.files[0];
      if (!selectedFile) return;

      const fileReader = new FileReader();
      fileReader.onload = () => {
        try {
          const importedData = JSON.parse(fileReader.result);
          if (
            typeof importedData !== 'object'
            || importedData === null
            || !Array.isArray(importedData.accounts)
          ) {
            throw new Error('bad');
          }
          if (hasData() && !confirm('Replace everything here with the contents of this file?')) return;

          service.importState(importedData);
          save();
          render();
          window.scrollTo(0, 0);
        } catch (error) {
          alert('That file could not be read. Choose a JSON file exported from this page.');
        }
      };
      fileReader.readAsText(selectedFile);
      importFileInput.value = '';
    });
    document.body.append(importFileInput);
    const importJson = () => importFileInput.click();

    const exportJson = () => {
      const data = new Blob([JSON.stringify(state, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(data);
      const link = h('a', {
        href: url,
        download: DATA_CONSTANTS.EXPORT_FILENAME
      });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
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
    const clearLegacyData = () => {
      if (!confirm('Clear all saved data from this browser? Export a copy first if you want to keep it.')) return;
      service.clearLegacyData();
      save();
      render();
    };
    const keepLegacyData = () => {
      service.keepLegacyData();
      save();
      render();
    };

    const page = () => view({
      exportJson,
      clearData,
      importJson,
      addTransactionCategory,
      removeTransactionCategory,
      addExchangeRate,
      updateExchangeRate,
      removeExchangeRate,
      refreshExchangeRates
    });
    page.renderLegacyBanner = () => view.renderLegacyBanner({
      clearLegacyData,
      keepLegacyData
    });
    page.importJson = importJson;
    return page;
  };
})();
