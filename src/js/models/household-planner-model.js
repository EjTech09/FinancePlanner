(() => {
'use strict';

const toNumber = value => {
  if (value === '' || value == null || !isFinite(+value)) return 0;
  return +value;
};
const sumBy = (items, selector) => items.reduce((total, item) => {
  const value = typeof selector === 'function' ? selector(item) : item[selector];
  return total + toNumber(value);
}, 0);
const currencyRate = (currency, rates) => {
  if (currency === 'PHP') return 1 / (toNumber(rates.php) || 1);
  if (currency === 'USD') return toNumber(rates.usd);
  return 1;
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
  if (remaining < 0.005) monthsToPayOff = 0;
  else if (monthlyPayment > 0) {
    monthsToPayOff = Math.ceil(remaining / monthlyPayment - 1e-9);
  }

  const due = dueDate ? new Date(dueDate + 'T00:00:00') : null;
  const monthsUntilDue = due
    ? (due.getFullYear() - asOfDate.getFullYear()) * 12 + due.getMonth() - asOfDate.getMonth()
    : null;

  let requiredMonthlyAmount = null;
  if (monthsUntilDue != null) {
    if (remaining < 0.005) requiredMonthlyAmount = 0;
    else if (monthsUntilDue <= 0) requiredMonthlyAmount = remaining;
    else requiredMonthlyAmount = remaining / monthsUntilDue;
  }

  let status;
  if (remaining < 0.005) status = completedStatus;
  else if (monthsToPayOff == null) status = noPaymentStatus;
  else if (monthsUntilDue == null) status = 'No due date';
  else if (monthsToPayOff <= monthsUntilDue) status = 'On track';
  else status = 'Behind by ' + (monthsToPayOff - monthsUntilDue) + ' mo';

  return {
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
  const summary = { accounts: {}, goals: {}, debts: {} };
  const rateFor = currency => currencyRate(currency, state.fx);
  const currencyForAccount = accountId =>
    (state.accounts.find(account => account.id === accountId) || {}).currency || 'NZD';
  const commitmentInNZD = commitment =>
    toNumber(commitment.amount) * rateFor(currencyForAccount(commitment.account));
  const committedForTarget = target =>
    sumBy(state.commitments.filter(commitment => commitment.target === target), commitmentInNZD);

  summary.income = sumBy(
    state.income,
    income => toNumber(income.amount) * rateFor(income.currency)
  );

  for (const account of state.accounts) {
    const conversionRate = rateFor(account.currency);
    const balance = toNumber(account.balance) * conversionRate;
    const liabilities = toNumber(account.liabilities) * conversionRate;
    const committed = sumBy(
      state.commitments.filter(commitment => commitment.account === account.id),
      commitmentInNZD
    );
    const net = balance - liabilities;
    const free = net - committed;

    let status;
    if (net < -0.005) status = 'Liabilities exceed balance';
    else if (free < -0.005) status = 'Over-committed';
    else if (Math.abs(free) < 0.005) status = 'Fully committed';
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

  for (const goal of state.goals) {
    const saved = committedForTarget('goal:' + goal.id);
    const hasTarget = goal.target !== '' && goal.target != null;
    const progress = hasTarget
      ? calculatePlan({
        balance: toNumber(goal.target),
        committed: saved,
        monthly: goal.monthly,
        dueDate: goal.date,
        asOfDate,
        noPaymentStatus: 'No contribution',
        completedStatus: 'Reached'
      })
      : { remaining: 0, status: 'Set a target' };

    summary.goals[goal.id] = { saved, hasTarget, ...progress };
  }

  for (const debt of state.debts) {
    const balance = toNumber(debt.balance) * rateFor(debt.currency);
    const funded = committedForTarget('debt:' + debt.id);
    const progress = calculatePlan({
      balance,
      committed: funded,
      monthly: debt.monthly,
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
      'amount'
    ),
    savings: sumBy(state.goals, 'monthly'),
    debt: sumBy(state.debts, 'monthly'),
    discretionary: sumBy(
      state.expenses.filter(expense => expense.category === 'discretionary'),
      'amount'
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
  sum: sumBy,
  currencyRate,
  compute: calculateSummary
});
})();
