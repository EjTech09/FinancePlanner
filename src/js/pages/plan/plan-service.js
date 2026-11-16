(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.planService = context => {
    const DEFAULT_CURRENCY = window.HouseholdPlannerConstants.domain.DEFAULT_CURRENCY;
    const { state, num, uid, detach } = context;
    const pctOf = (amount, total) => total > 0 ? num(amount) / total * 100 : 0;
    const byPriority = (first, second) => {
      const firstPriority = first.priority === '' || first.priority == null
        ? 999
        : num(first.priority);
      const secondPriority = second.priority === '' || second.priority == null
        ? 999
        : num(second.priority);
      return firstPriority - secondPriority;
    };

    const updateAllocation = (category, input) => {
      state.alloc[category] = input.value === '' ? 0 : parseFloat(input.value);
    };
    const setPeriod = period => {
      state.planPeriod = period;
    };
    const setFrequency = (item, frequency) => {
      item.frequency = frequency;
    };
    const createIncome = () => {
      const income = {
        id: uid(),
        source: '',
        user: '',
        amount: '',
        frequency: state.planPeriod,
        currency: DEFAULT_CURRENCY
      };
      state.income.push(income);
      return income;
    };
    const createExpense = category => {
      const expense = {
        id: uid(),
        name: '',
        category,
        user: '',
        amount: '',
        frequency: state.planPeriod
      };
      state.expenses.push(expense);
      return expense;
    };
    const deleteMoneyItem = (row, collection) => {
      state[collection] = state[collection].filter(current => current !== row);
      if (collection === 'expenses') {
        state.transactions.forEach(transaction => {
          if (transaction.related === 'expense:' + row.id) transaction.related = '';
        });
      }
    };
    const createGoal = () => {
      const goal = {
        id: uid(),
        name: '',
        user: '',
        target: '',
        date: '',
        monthly: '',
        frequency: state.planPeriod
      };
      state.goals.push(goal);
      return goal;
    };
    const deleteGoal = goal => {
      state.goals = state.goals.filter(row => row !== goal);
      detach('goals', goal.id);
    };
    const createDebt = () => {
      const debt = {
        id: uid(),
        name: '',
        priority: '',
        borrower: '',
        creditor: '',
        due: '',
        currency: DEFAULT_CURRENCY,
        balance: '',
        monthly: '',
        frequency: state.planPeriod
      };
      state.debts.push(debt);
      return debt;
    };
    const deleteDebt = debt => {
      state.debts = state.debts.filter(row => row !== debt);
      state.transactions.forEach(transaction => {
        if (transaction.related === 'debt:' + debt.id) transaction.related = '';
      });
      detach('debts', debt.id);
    };

    return {
      pctOf,
      byPriority,
      updateAllocation,
      setPeriod,
      setFrequency,
      createIncome,
      createExpense,
      deleteMoneyItem,
      createGoal,
      deleteGoal,
      createDebt,
      deleteDebt
    };
  };
})();
