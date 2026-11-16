(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.accountsService = context => {
    const {
      state, uid, detach, rate, accountCurrency, num, exchangeRates
    } = context;

    const accFilter = () => {
      const filter = state.ui.accUser || 'all';
      const isKnownUser = state.users.some(user => user.id === filter);
      return filter === 'all' || filter === 'none' || isKnownUser ? filter : 'all';
    };
    const accMatch = account => {
      const filter = accFilter();
      if (filter === 'all') return true;
      if (filter === 'none') return !account.user;
      return account.user === filter;
    };
    const comMatch = commitment => {
      const account = state.accounts.find(item => item.id === commitment.account);
      return account ? accMatch(account) : true;
    };
    const visibleAccounts = () => state.accounts.filter(accMatch);

    const deleteAccount = account => {
      state.accounts = state.accounts.filter(row => row !== account);
      detach('accounts', account.id);
    };
    const deleteCommitment = commitment => {
      state.commitments = state.commitments.filter(row => row !== commitment);
    };
    const createAccount = () => {
      const filter = accFilter();
      const account = {
        id: uid(),
        name: '',
        user: filter !== 'all' && filter !== 'none' ? filter : '',
        currency: 'NZD',
        balance: '',
        liabilities: ''
      };
      state.accounts.push(account);
      return account;
    };
    const createCommitment = () => {
      const accounts = visibleAccounts();
      const filter = accFilter();
      const commitment = {
        id: uid(),
        account: filter !== 'all' && accounts.length ? accounts[0].id : '',
        target: 'other',
        label: '',
        amount: ''
      };
      state.commitments.push(commitment);
      return commitment;
    };
    const setAccountFilter = userId => {
      state.ui.accUser = userId;
    };
    const updateExchangeRate = (key, input) => {
      state.fx[key] = input.value === '' ? 0 : parseFloat(input.value);
      state.fx[key + 'UpdatedAt'] = null;
      exchangeRates.setStatus(`Using the manually entered ${key === 'php' ? 'PHP/NZD' : 'USD/NZD'} rate.`);
    };
    const convertAccountCommitments = (accountId, oldCurrency, newCurrency) => {
      const from = rate(oldCurrency);
      const to = rate(newCurrency);
      if (from <= 0 || to <= 0) return;

      state.commitments
        .filter(commitment =>
          commitment.account === accountId &&
          commitment.amount !== '' &&
          commitment.amount != null
        )
        .forEach(commitment => {
          commitment.amount = num(commitment.amount) * from / to;
        });
    };
    const convertCommitmentForAccount = (commitment, oldAccountId, newAccountId) => {
      const oldRate = rate(accountCurrency(oldAccountId));
      const newRate = rate(accountCurrency(newAccountId));
      if (commitment.amount !== '' && commitment.amount != null && oldRate > 0 && newRate > 0) {
        commitment.amount = num(commitment.amount) * oldRate / newRate;
      }
    };

    return {
      accFilter,
      accMatch,
      comMatch,
      visibleAccounts,
      deleteAccount,
      deleteCommitment,
      createAccount,
      createCommitment,
      setAccountFilter,
      updateExchangeRate,
      convertAccountCommitments,
      convertCommitmentForAccount
    };
  };
})();
