(() => {
'use strict';

/**
 * Core household-planner calculations.
 *
 * This model centralises conversions, budget totals, account summaries, debt
 * status, and goal progress so the view layers can stay focused on rendering.
 */
const CURRENCY = window.HouseholdPlannerConstants.domain.CURRENCY;
const MONEY_EPSILON = window.HouseholdPlannerConstants.domain.MONEY_EPSILON;
const PLAN_CONSTANTS = window.HouseholdPlannerConstants.plan;
const toNumber = value => {
  if (value === '' || value == null || !isFinite(+value)) return 0;
  return +value;
};
const toMonthlyAmount = (amount, frequency) => {
  const period = PLAN_CONSTANTS.PERIODS.find(([value]) => value === frequency) ||
    PLAN_CONSTANTS.PERIODS.find(([value]) => value === PLAN_CONSTANTS.DEFAULT_PERIOD);
  return toNumber(amount) / period[2];
};
const sumBy = (items, selector) => items.reduce((total, item) => {
  const value = typeof selector === 'function' ? selector(item) : item[selector];
  return total + toNumber(value);
}, 0);
const currencyRate = (currency, rates) => {
  if (currency === CURRENCY.BASE) return 1;
  const rate = toNumber(rates && rates.rates && rates.rates[currency]);
  return rate > 0 ? rate : 0;
};

function calculatePlan({
  balance,
  committed,
  monthly,
  dueDate,
  asOfDate,
  noPaymentStatus,
  completedStatus
}) {
  const remaining = Math.max(balance - committed, 0);
  const monthlyPayment = toNumber(monthly);
  let monthsToPayOff = null;
  if (remaining < MONEY_EPSILON) monthsToPayOff = 0;
  else if (monthlyPayment > 0) {
    monthsToPayOff = Math.ceil(remaining / monthlyPayment - 1e-9);
  }

  const due = dueDate ? new Date(dueDate + 'T00:00:00') : null;
  const monthsUntilDue = due
    ? (due.getFullYear() - asOfDate.getFullYear()) * 12 + due.getMonth() - asOfDate.getMonth()
    : null;

  let requiredMonthlyAmount = null;
  if (monthsUntilDue != null) {
    if (remaining < MONEY_EPSILON) requiredMonthlyAmount = 0;
    else if (monthsUntilDue <= 0) requiredMonthlyAmount = remaining;
    else requiredMonthlyAmount = remaining / monthsUntilDue;
  }

  let status;
  if (remaining < MONEY_EPSILON) status = completedStatus;
  else if (monthsToPayOff == null) status = noPaymentStatus;
  else if (monthsUntilDue == null) status = 'No due date';
  else if (monthsToPayOff <= monthsUntilDue) status = 'On track';
  else status = 'Behind by ' + (monthsToPayOff - monthsUntilDue) + ' mo';

  return {
    monthlyPayment,
    remaining,
    months: monthsToPayOff,
    until: monthsUntilDue,
    required: requiredMonthlyAmount,
    status,
    projected: monthsToPayOff == null
      ? null
      : new Date(
        asOfDate.getFullYear(),
        asOfDate.getMonth() + monthsToPayOff,
        asOfDate.getDate()
      )
  };
}

function calculateSummary(state, asOfDate) {
  const summary = { accounts: {}, commitments: {}, goals: {}, debts: {} };
  const rateFor = currency => currencyRate(currency, state.fx);
  const currencyForAccount = accountId =>
    (state.accounts.find(account => account.id === accountId) || {}).currency ||
    window.HouseholdPlannerConstants.domain.DEFAULT_CURRENCY;
  const commitmentAmount = commitment => {
    const accountCurrency = currencyForAccount(commitment.account);
    const fulfilled = sumBy(
      state.transactions.filter(transaction =>
        transaction.related === 'commitment:' + commitment.id &&
        transaction.type === window.HouseholdPlannerConstants.transactions.TYPE.EXPENSE &&
        state.accounts.some(account => account.id === transaction.account) &&
        toNumber(transaction.amount) !== 0
      ),
      transaction => {
        const transactionCurrency = currencyForAccount(transaction.account);
        const transactionRate = rateFor(transactionCurrency);
        const commitmentRate = rateFor(accountCurrency);
        if (transactionRate <= 0 || commitmentRate <= 0) return 0;
        const transactionAmount = Math.abs(toNumber(transaction.amount));
        return transactionAmount * transactionRate / commitmentRate;
      }
    );
    return Math.max(toNumber(commitment.amount) - fulfilled, 0);
  };
  const commitmentInNZD = commitment =>
    commitmentAmount(commitment) * rateFor(currencyForAccount(commitment.account));
  const committedForTarget = target =>
    sumBy(state.commitments.filter(commitment => commitment.target === target), commitmentInNZD);

  summary.income = sumBy(
    state.income,
    income => toMonthlyAmount(income.amount, income.frequency) * rateFor(income.currency)
  );

  for (const account of state.accounts) {
    const conversionRate = rateFor(account.currency);
    const transactionAdjustment = sumBy(
      state.transactions.flatMap(transaction =>
        Array.isArray(transaction.balanceImpact) ? transaction.balanceImpact : []
      ),
      impact => impact.account === account.id ? impact.amount : 0
    );
    const balance = (toNumber(account.balance) + transactionAdjustment) * conversionRate;
    const liabilities = toNumber(account.liabilities) * conversionRate;
    const committed = sumBy(
      state.commitments.filter(commitment => commitment.account === account.id),
      commitmentInNZD
    );
    const net = balance - liabilities;
    const free = net - committed;

    let status;
    if (net < -MONEY_EPSILON) status = 'Liabilities exceed balance';
    else if (free < -MONEY_EPSILON) status = 'Over-committed';
    else if (Math.abs(free) < MONEY_EPSILON) status = 'Fully committed';
    else status = 'Uncommitted funds available';

    summary.accounts[account.id] = {
      bal: balance,
      liab: liabilities,
      net,
      committed,
      free,
      status
    };
  }

  for (const commitment of state.commitments) {
    summary.commitments[commitment.id] = { amount: commitmentAmount(commitment) };
  }

  for (const goal of state.goals) {
    const saved = committedForTarget('goal:' + goal.id);
    const hasTarget = goal.target !== '' && goal.target != null;
    const monthlyPayment = toMonthlyAmount(goal.monthly, goal.frequency);
    const progress = hasTarget
      ? calculatePlan({
        balance: toNumber(goal.target),
        committed: saved,
        monthly: monthlyPayment,
        dueDate: goal.date,
        asOfDate,
        noPaymentStatus: 'No contribution',
        completedStatus: 'Reached'
      })
      : { remaining: 0, status: 'Set a target', monthlyPayment };

    summary.goals[goal.id] = { saved, hasTarget, ...progress };
  }

  for (const debt of state.debts) {
    const paid = sumBy(
      state.transactions.filter(transaction =>
        transaction.related === 'debt:' + debt.id &&
        transaction.type === window.HouseholdPlannerConstants.transactions.TYPE.DEBT &&
        state.accounts.some(account => account.id === transaction.account) &&
        toNumber(transaction.amount) !== 0
      ),
      transaction => {
        const transactionCurrency = currencyForAccount(transaction.account);
        const transactionRate = rateFor(transactionCurrency);
        const debtRate = rateFor(debt.currency);
        if (transactionRate <= 0 || debtRate <= 0) return 0;
        return Math.abs(toNumber(transaction.amount)) * transactionRate / debtRate;
      }
    );
    const balance = Math.max(toNumber(debt.balance) - paid, 0) * rateFor(debt.currency);
    const funded = committedForTarget('debt:' + debt.id);
    const progress = calculatePlan({
      balance,
      committed: funded,
      monthly: toMonthlyAmount(debt.monthly, debt.frequency),
      dueDate: debt.due,
      asOfDate,
      noPaymentStatus: 'No payment set',
      completedStatus: 'Fully funded'
    });

    summary.debts[debt.id] = {
      bal: balance,
      funded,
      ...progress,
      unfunded: progress.remaining
    };
  }

  const accounts = Object.values(summary.accounts);
  summary.net = sumBy(accounts, 'net');
  summary.committed = sumBy(accounts, 'committed');
  summary.free = sumBy(accounts, 'free');
  summary.budgeted = {
    essential: sumBy(
      state.expenses.filter(expense => expense.category === 'essential'),
      expense => toMonthlyAmount(expense.amount, expense.frequency)
    ),
    savings: sumBy(state.goals, goal => toMonthlyAmount(goal.monthly, goal.frequency)),
    debt: sumBy(state.debts, debt => toMonthlyAmount(debt.monthly, debt.frequency)),
    discretionary: sumBy(
      state.expenses.filter(expense => expense.category === 'discretionary'),
      expense => toMonthlyAmount(expense.amount, expense.frequency)
    )
  };

  summary.limit = {};
  for (const category in state.alloc) {
    summary.limit[category] = summary.income * toNumber(state.alloc[category]) / 100;
  }
  summary.totalBudgeted = sumBy(Object.values(summary.budgeted), value => value);
  summary.debtTotal = sumBy(Object.values(summary.debts), 'bal');
  summary.debtFunded = sumBy(Object.values(summary.debts), 'funded');
  summary.debtUnfunded = sumBy(Object.values(summary.debts), 'unfunded');

  return summary;
}

window.HouseholdPlannerModel = Object.freeze({
  num: toNumber,
  toMonthlyAmount,
  sum: sumBy,
  currencyRate,
  compute: calculateSummary
});
})();
