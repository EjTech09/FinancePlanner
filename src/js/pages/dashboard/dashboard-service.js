(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.dashboardService = context => {
    const { MIN_SCALE, RING_RADIUS } = window.HouseholdPlannerConstants.dashboard;
    const { MONEY_EPSILON } = window.HouseholdPlannerConstants.domain;
    const { PAGE_ID } = window.HouseholdPlannerConstants.app;
    const { state, D, num, sum, save, render } = context;

    const summary = () => {
      const R = D();
      const inc = R.income;
      const tot = R.totalBudgeted;
      const left = inc - tot;
      const top = Math.max(inc, tot, MIN_SCALE);
      const over = left < -MONEY_EPSILON;
      const pct = inc > 0 ? tot / inc * 100 : 0;
      const circumference = 2 * Math.PI * RING_RADIUS;
      const dash = Math.min(pct, 100) / 100 * circumference;
      const goalsOn = state.goals.filter(goal => R.goals[goal.id].hasTarget);
      const onTrack = goalsOn.filter(goal => /^(On track|Reached)/.test(R.goals[goal.id].status)).length;
      const debtsOn = state.debts.filter(debt =>
        /^(On track|Fully funded)/.test(R.debts[debt.id].status)
      ).length;
      const goalScale = Math.max(
        MIN_SCALE,
        ...state.goals.map(goal => Math.max(num(goal.monthly), R.goals[goal.id].required || 0))
      );
      const debtScale = Math.max(
        MIN_SCALE,
        ...state.debts.map(debt => R.debts[debt.id].bal)
      );
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
      const peopleScale = Math.max(
        MIN_SCALE,
        ...people.map(person => Math.max(person.net, 0))
      );

      return {
        R, inc, tot, left, top, over, pct, circumference, dash,
        goalsOn, onTrack, debtsOn, goalScale, debtScale, people, peopleScale
      };
    };

    const startFromScratch = () => {
      state.ui.tab = PAGE_ID.DATA;
      save();
      render();
    };

    return { summary, startFromScratch };
  };
})();
