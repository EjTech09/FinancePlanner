(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.dashboardService = context => {
    const { state, D, num, sum, save, render } = context;

    const summary = () => {
      const R = D();
      const inc = R.income;
      const tot = R.totalBudgeted;
      const left = inc - tot;
      const top = Math.max(inc, tot, 1);
      const over = left < -0.005;
      const pct = inc > 0 ? tot / inc * 100 : 0;
      const circumference = 2 * Math.PI * 48;
      const dash = Math.min(pct, 100) / 100 * circumference;
      const goalsOn = state.goals.filter(goal => R.goals[goal.id].hasTarget);
      const onTrack = goalsOn.filter(goal => /^(On track|Reached)/.test(R.goals[goal.id].status)).length;
      const debtsOn = state.debts.filter(debt =>
        /^(On track|Fully funded)/.test(R.debts[debt.id].status)
      ).length;
      const goalScale = Math.max(
        1,
        ...state.goals.map(goal => Math.max(num(goal.monthly), R.goals[goal.id].required || 0))
      );
      const debtScale = Math.max(1, ...state.debts.map(debt => R.debts[debt.id].bal));
      const people = state.users.map(user => {
        const accounts = state.accounts
          .filter(account => account.user === user.id)
          .map(account => R.accounts[account.id]);
        return {
          name: user.name,
          net: sum(accounts, 'net'),
          committed: sum(accounts, 'committed'),
          free: sum(accounts, 'free'),
          accountCount: accounts.length
        };
      }).filter(person => person.accountCount);
      const peopleScale = Math.max(1, ...people.map(person => Math.max(person.net, 0)));

      return {
        R, inc, tot, left, top, over, pct, circumference, dash,
        goalsOn, onTrack, debtsOn, goalScale, debtScale, people, peopleScale
      };
    };

    const startFromScratch = () => {
      state.ui.tab = 'data';
      save();
      render();
    };

    return { summary, startFromScratch };
  };
})();
