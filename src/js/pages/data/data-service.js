(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.dataService = context => {
    const PAGE_ID = window.HouseholdPlannerConstants.app.PAGE_ID;
    const {
      state, persistence, replaceState, setLegacy, markDirty, uid
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

    return { storageMessage, clearData, addTransactionCategory, removeTransactionCategory };
  };
})();
