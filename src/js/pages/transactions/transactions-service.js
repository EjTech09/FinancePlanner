(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.transactionsService = context => {
    const { state, rate, num, sum, uid, commit, save, detach } = context;
    const TYPES = [
      ['income', 'Income'],
      ['expense', 'Expense'],
      ['debt', 'Debt payment'],
      ['goal', 'Goal contribution'],
      ['transfer', 'Transfer']
    ];
    const TYPE_LABEL = Object.fromEntries(TYPES);
    const txNZD = transaction => {
      const account = state.accounts.find(item => item.id === transaction.account);
      return num(transaction.amount) * (account ? rate(account.currency) : 1);
    };
    const hasAmount = transaction =>
      !(transaction.amount === '' || transaction.amount == null);
    const isBlank = transaction =>
      !transaction.description && !hasAmount(transaction) && !transaction.related;

    const addTransaction = selectedType => {
      const transaction = {
        id: uid(),
        date: new Date().toISOString().slice(0, 10),
        user: '',
        account: '',
        type: selectedType !== 'all' ? selectedType : 'expense',
        related: '',
        description: '',
        amount: ''
      };
      state.transactions.push(transaction);
      commit();
      return transaction;
    };

    const selectTransactionType = type => {
      state.ui.txType = type;
      save();
    };

    const deleteTransaction = transaction => {
      state.transactions = state.transactions.filter(item => item !== transaction);
      detach('transactions', transaction.id);
    };

    const discardBlankTransaction = transaction => {
      state.transactions = state.transactions.filter(item => item !== transaction);
    };

    return {
      TYPES,
      TYPE_LABEL,
      txNZD,
      hasAmount,
      isBlank,
      addTransaction,
      selectTransactionType,
      deleteTransaction,
      discardBlankTransaction,
      totalByType: type =>
        sum(state.transactions.filter(transaction => transaction.type === type), txNZD)
    };
  };
})();
