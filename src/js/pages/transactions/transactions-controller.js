(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.transactions = context => {
    const { $, commit, render: rerender } = context;
    const service = window.HouseholdPlannerPages.transactionsService(context);
    const view = window.HouseholdPlannerPages.transactionsView(context, service);
    let sheet = null;

    function closeSheet(immediate) {
      if (!sheet) return;
      const currentSheet = sheet;
      sheet = null;
      currentSheet.close(immediate);

      if (currentSheet.isNew && service.isBlank(currentSheet.row)) {
        service.discardBlankTransaction(currentSheet.row);
      }
      commit();
      const transactionButton = $(`.tx-row[data-id="${currentSheet.row.id}"]`);
      if (transactionButton) transactionButton.focus();
    }

    const deleteTransaction = transaction => {
      if (!confirm('Delete this transaction? This cannot be undone.')) return;
      service.deleteTransaction(transaction);
      if (sheet) sheet.isNew = false;
      closeSheet();
    };

    function openTxSheet(row, isNew) {
      closeSheet(true);
      const currentSheet = {
        row,
        isNew,
        close: null
      };
      sheet = currentSheet;
      currentSheet.close = view.createTransactionSheet(
        row,
        isNew,
        () => closeSheet(),
        () => deleteTransaction(row)
      ).close;
    }

    const addTransaction = selectedType => {
      const transaction = service.addTransaction(selectedType);
      openTxSheet(transaction, true);
    };

    const selectTransactionType = type => {
      service.selectTransactionType(type);
      rerender();
    };

    const txView = () => view.render(addTransaction, selectTransactionType, openTxSheet);
    return { render: txView, txIcon: view.txIcon };
  };
})();
