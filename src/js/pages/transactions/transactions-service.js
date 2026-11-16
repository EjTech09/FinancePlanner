(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.transactionsService = context => {
    const DOMAIN = window.HouseholdPlannerConstants.domain;
    const TRANSACTION_CONSTANTS = window.HouseholdPlannerConstants.transactions;
    const { state, rate, num, sum, uid, commit, save, detach } = context;
    const { TYPES, TYPE_LABEL } = TRANSACTION_CONSTANTS;
    const nameFor = (collection, id) =>
      (state[collection].find(item => item.id === id) || {}).name || '(unnamed)';
    const commitmentName = commitment => {
      if (commitment.label) return commitment.label;
      const target = commitment.target || '';
      if (target.startsWith('debt:')) return nameFor('debts', target.slice(5));
      if (target.startsWith('goal:')) return nameFor('goals', target.slice(5));
      return 'Something else';
    };
    const relatedOptions = transaction => {
      const options = [
        { v: '', t: 'None' },
        {
          g: 'Debt payments',
          items: state.debts.map(debt => ({
            v: 'debt:' + debt.id,
            t: nameFor('debts', debt.id)
          }))
        },
        {
          g: 'Money set aside',
          items: state.commitments.map(commitment => ({
            v: 'commitment:' + commitment.id,
            t: commitmentName(commitment)
          }))
        },
        {
          g: 'Planned expenses',
          items: state.expenses.map(expense => ({
            v: 'expense:' + expense.id,
            t: expense.name || '(unnamed)'
          }))
        }
      ];
      const values = options.flatMap(option => option.items || [option]).map(option => option.v);
      if (transaction.related && !values.includes(transaction.related)) {
        options.push({ v: transaction.related, t: 'Previously entered: ' + transaction.related });
      }
      return options;
    };
    const relatedLabel = transaction => {
      const related = transaction.related || '';
      if (related.startsWith('debt:')) return nameFor('debts', related.slice(5));
      if (related.startsWith('commitment:')) {
        const commitment = state.commitments.find(item => item.id === related.slice(11));
        return commitment ? commitmentName(commitment) : '';
      }
      if (related.startsWith('expense:')) {
        return nameFor('expenses', related.slice(8));
      }
      return related;
    };
    const categoryLabel = transaction =>
      (state.transactionCategories.find(category => category.id === transaction.category) || {}).name || '';
    const categoryOptions = transaction => {
      const options = [
        { v: '', t: 'None' },
        ...state.transactionCategories.map(category => ({ v: category.id, t: category.name }))
      ];
      if (
        transaction.category &&
        !state.transactionCategories.some(category => category.id === transaction.category)
      ) {
        options.push({ v: transaction.category, t: 'Unavailable category' });
      }
      return options;
    };
    const updateBalanceImpact = transaction => {
      const amount = Math.abs(num(transaction.amount));
      const account = state.accounts.find(item => item.id === transaction.account);
      transaction.balanceImpact = [];
      if (!account || amount <= 0) return;

      if (transaction.type === TRANSACTION_CONSTANTS.TYPE.TRANSFER) {
        const destination = state.accounts.find(item => item.id === transaction.transferTo);
        if (!destination || destination.id === account.id) return;
        const sourceRate = rate(account.currency);
        const destinationRate = rate(destination.currency);
        const destinationAmount = account.currency === destination.currency
          ? amount
          : sourceRate > 0 && destinationRate > 0
            ? amount * sourceRate / destinationRate
            : null;
        if (destinationAmount == null) return;
        transaction.balanceImpact = [
          { account: account.id, amount: -amount },
          { account: destination.id, amount: destinationAmount }
        ];
        return;
      }

      if (!TYPES.some(([type]) => type === transaction.type)) return;
      transaction.balanceImpact = [{
        account: account.id,
        amount: transaction.type === TRANSACTION_CONSTANTS.TYPE.INCOME ? amount : -amount
      }];
    };
    const updateRelated = transaction => {
      const related = transaction.related || '';
      if (related.startsWith('debt:')) {
        transaction.type = TRANSACTION_CONSTANTS.TYPE.DEBT;
      } else if (
        related.startsWith('commitment:') ||
        related.startsWith('expense:')
      ) {
        transaction.type = TRANSACTION_CONSTANTS.TYPE.EXPENSE;
      }
      updateBalanceImpact(transaction);
    };
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
        type: selectedType !== DOMAIN.FILTER_ALL ? selectedType : TRANSACTION_CONSTANTS.DEFAULT_TYPE,
        related: '',
        category: state.transactionCategories[0] ? state.transactionCategories[0].id : '',
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
      relatedOptions,
      relatedLabel,
      categoryLabel,
      categoryOptions,
      updateRelated,
      updateBalanceImpact,
      totalByType: type =>
        sum(state.transactions.filter(transaction => transaction.type === type), txNZD)
    };
  };
})();
