(() => {
  'use strict';

  /**
   * Budget and planning page.
   *
   * Renders the income tracker, section allocation meters, and editable
   * lists for income, expenses, goals, and debt payments.
   */
  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.planView = (context, service) => {
    const PLAN_CONSTANTS = window.HouseholdPlannerConstants.plan;
    const DEFAULT_CURRENCY = window.HouseholdPlannerConstants.domain.DEFAULT_CURRENCY;
    const { MONEY_EPSILON } = window.HouseholdPlannerConstants.domain;
    const { state, D, sum, money, num, toMonthlyAmount, h, $, head, tile, bento, CATS, field, sRow, sCalc, sCol, userOpts, curOpts, rate, accountCurrency, nameOf, cls, esc, fmtDate, liv, itemList, expandable, totalsEl } = context;
    const { pctOf, byPriority } = service;
    const period = () => PLAN_CONSTANTS.PERIODS.find(([value]) => value === state.planPeriod) ||
      PLAN_CONSTANTS.PERIODS.find(([value]) => value === PLAN_CONSTANTS.DEFAULT_PERIOD);
    const frequency = item => PLAN_CONSTANTS.PERIODS.find(([value]) => value === item.frequency) ||
      PLAN_CONSTANTS.PERIODS.find(([value]) => value === PLAN_CONSTANTS.DEFAULT_PERIOD);
    const periodAmount = amount => num(amount) * period()[2];
    const periodUnit = () => period()[3];
    const frequencyUnit = item => frequency(item)[3];
    const frequencyControl = (item, actions) => {
      const select = h('select', { 'aria-label': 'Frequency' }, PLAN_CONSTANTS.PERIODS.map(
        ([value, label]) => h('option', { value }, label)
      ));
      select.value = frequency(item)[0];
      select.addEventListener('change', () => actions.setFrequency(item, select.value));
      return select;
    };
    const frequencyAmountRow = (item, key, label, suffix = '') => {
      const input = field(sCol(label, key, 'number'), item);
      const amountLabel = liv(() => {
        const text = label + ' per ' + frequencyUnit(item) + suffix;
        input.setAttribute('aria-label', text);
        return text;
      });
      return sRow(amountLabel, input);
    };

    /* ---------- Shared-state reads and derived values ---------- */
    const meterHtml = category => {
      const summary = D();
      const limit = summary.limit[category];
      const used = summary.budgeted[category];
      const left = limit - used;
      const over = left < -MONEY_EPSILON;
      const percentage = limit > 0
        ? Math.min(used / limit, 1) * 100
        : used > 0 ? 100 : 0;

      return `<div class="m-left ${over ? 'bad' : ''}"><b>${money(periodAmount(Math.abs(left)), 0)}</b><span>${over ? 'over the limit' : 'left to allocate'}</span></div>
        <div class="m-bar" role="img" aria-label="${money(periodAmount(used), 0)} allocated of ${money(periodAmount(limit), 0)}"><i class="${over ? 'over' : ''}" style="width:${percentage}%"></i></div>
        <div class="m-sub">Allocated ${money(periodAmount(used))} of ${money(periodAmount(limit))} per ${periodUnit()}</div>`;
    };
    const planView = actions => {
      const el = h('div', {}, head(
        'Plan',
        'Split your income across essentials, savings goals, debts and everyday spending. Choose how often you plan your budget.'
      ));
      const periodSelect = h('select', { 'aria-label': 'Budget period' }, PLAN_CONSTANTS.PERIODS.map(
        ([value, label]) => h('option', { value }, label)
      ));
      periodSelect.value = state.planPeriod;
      periodSelect.addEventListener('change', () => actions.setPeriod(periodSelect.value));
      const tracker = h('div', { class: 'tracker', 'data-calc': '' });
      const trackerRow = h('div', { class: 't-row' });
      const periodControl = h(
        'label',
        { class: 't-period' },
        h('span', {}, 'Period'),
        periodSelect
      );
      const split = h('div', { class: 'split', role: 'img', 'aria-label': 'Income split by section' });
      tracker.append(trackerRow, split);
      tracker._u = () => {
        const summary = D();
        const income = periodAmount(summary.income);
        const total = periodAmount(summary.totalBudgeted);
        const remaining = income - total;
        const scale = Math.max(income, total, 1);
        const isOverAllocated = remaining < -MONEY_EPSILON;
        const shares = sum(Object.values(state.alloc), value => value);
        const sharesTotalOneHundred = Math.abs(shares - 100) < 0.01;
        const segments = CATS.map(([key,, color]) =>
          `<i style="width:${periodAmount(summary.budgeted[key]) / scale * 100}%;background:var(--${color})"></i>`
        ).join('') + `<i style="width:${Math.max(remaining, 0) / scale * 100}%"></i>`;

        trackerRow.innerHTML = `<div><small>Income</small><b>${money(income, 0)}</b></div><div><small>Allocated</small><b>${money(total, 0)}</b></div>
          <div class="t-left ${isOverAllocated ? 'bad' : 'ok'}"><small>${isOverAllocated ? 'Over-allocated by' : 'Left to allocate'}</small><b>${money(Math.abs(remaining), 0)}</b></div>
          ${sharesTotalOneHundred ? '' : `<div class="bad t-warn">Shares add up to ${shares.toFixed(1)}%. They need to total 100%.</div>`}`;
        trackerRow.append(periodControl);
        split.innerHTML = segments;
      };
      tracker._u();
      el.append(tracker);

      const grid = h('div', { class: 'bento' });
      el.append(grid);

      grid.append(tile(
        6,
        {},
        h('h2', {}, 'Income'),
        h('p', { class: 'sub' }, `Per ${periodUnit()}. Pick a currency for each source and it is converted to NZD. Tap a source to edit it.`),
        incomeBody(actions)
      ));

      const allocationSummary = h('section', { class: 'tile s-6', 'data-calc': '' });
      allocationSummary._u = () => {
        const summary = D();
        const rows = CATS.map(([category, name, color]) => {
          const left = summary.limit[category] - summary.budgeted[category];
          const isOver = left < -MONEY_EPSILON;
          const limit = summary.limit[category];
          const used = summary.budgeted[category];
          const percentage = limit > 0
            ? Math.min(used / limit, 1) * 100
            : used > 0 ? 100 : 0;

          return `<div class="lrow"><span class="dot" style="background:var(--${color})"></span><span>${name}</span><span class="lbar"><i style="width:${percentage}%;background:${isOver ? 'var(--red)' : 'var(--' + color + ')'}"></i></span><b class="${isOver ? 'bad' : ''}">${money(periodAmount(Math.abs(left)), 0)}${isOver ? ' over' : ''}</b></div>`;
        }).join('') + '</div>';
        allocationSummary.innerHTML =
          '<h2>Left to allocate</h2>' +
          `<p class="sub">What each section can still take per ${periodUnit()}.</p>` +
          '<div class="rows">' + rows;
      };
      allocationSummary._u();
      grid.append(allocationSummary);

      const allocationTile = (category, title, subtitle, body, span) => {
        const shareInput = h('input', {
          type: 'number',
          step: 'any',
          value: state.alloc[category],
          'aria-label': title + ' share of income'
        });
        shareInput.addEventListener('input', () => {
          actions.updateAllocation(category, shareInput);
        });

        const meter = h('div', { class: 'meter', 'data-calc': '' });
        meter._u = () => {
          meter.innerHTML = meterHtml(category);
        };
        meter._u();

        const color = CATS.find(([key]) => key === category)[2];
        return tile(span, { style: '--sc:var(--' + color + ')' },
          h('div', { class: 'sec-head' }, h('h2', {}, title), h('label', { class: 'share' }, 'Share of income', shareInput, '%')),
          subtitle ? h('p', { class: 'sub' }, subtitle) : null,
          meter,
          body
        );
      };
      const expenses = (k, label) => expenseBody(k, label, actions);
      const prog = (saved, total) => {
        const percentage = total > 0 ? Math.min(saved / total, 1) * 100 : 0;
        return {
          html: `<span class="mini"><i style="width:${percentage}%"></i></span>${money(saved, 0)} (${percentage.toFixed(0)}%)`
        };
      };

      grid.append(allocationTile(
        'essential',
        'Essential expenses',
        'Rent, food, transport and other costs you cannot skip. Tap one to edit it.',
        expenses('essential', 'Add essential expense'),
        6
      ));
      grid.append(allocationTile(
        'discretionary',
        'Discretionary expenses',
        'Eating out, treats and anything you can trim. Tap one to edit it.',
        expenses('discretionary', 'Add discretionary expense'),
        6
      ));
      grid.append(allocationTile(
        'savings',
        'Savings goals',
        'Tap a goal to see everything and change its contribution amount. Money already set aside comes from the Accounts page.',
        goalsBody(actions),
        12
      ));
      grid.append(allocationTile(
        'debt',
        'Debt service',
        'Tap a debt to see everything and set its payment amount. Priority 1 is paid first.',
        debtsBody(actions),
        12
      ));
      return el;
    };

    const kindIcon = kind => `<span class="tx-ic" style="--tc:var(${PLAN_CONSTANTS.KIND_COLOR[kind]})"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PLAN_CONSTANTS.KIND_ICON[kind]}</svg></span>`;
    function moneyItem(row, kind, labels, collection, shareOfSection, actions) {
      const nameKey = kind === 'income' ? 'source' : 'name';
      const itemTitle = kind === 'income' ? 'income' : 'expense';
      const amountInNZD = () => num(row.amount) * rate(row.currency || DEFAULT_CURRENCY);
      const monthlyAmountInNZD = () => toMonthlyAmount(amountInNZD(), row.frequency);
      const isForeignCurrency = () => row.currency && row.currency !== DEFAULT_CURRENCY;
      const item = h('div', { class: 'acc-item', 'data-id': row.id });
      const header = h('button', { class: 'tx-row li', type: 'button', 'aria-expanded': 'false' },
        liv(() => kindIcon(kind), 'span', 'li-ic'),
        h('span', { class: 'tx-main' },
          liv(() => esc(row[nameKey] || labels.untitled), 'b'),
          liv(() => esc(nameOf('users', row.user) || 'No user'), 'small'),
          liv(() => `<span class="pill neu">${pctOf(monthlyAmountInNZD(), D().income).toFixed(0)}% of income</span>`, 'span')
        ),
        h('span', { class: 'tx-amt' },
          liv(() => money(amountInNZD()), 'b'),
          liv(() => isForeignCurrency()
            ? `${esc(row.currency)} ${num(row.amount).toLocaleString('en-NZ', { maximumFractionDigits: 2 })}`
            : 'per ' + frequencyUnit(row), 'small')
        ),
        h('span', { class: 'tx-chev', 'aria-hidden': 'true' }, '\u203a')
      );
      const editable = [
        sRow(labels.field, field(sCol(labels.field, nameKey, 'text', { ph: labels.ph }), row)),
        sRow('User', field(sCol('User', 'user', 'select', { opts: userOpts }), row))
      ];
      if (labels.currency) {
        editable.push(sRow('Currency', field(sCol('Currency', 'currency', 'select', { opts: curOpts }), row)));
      }
      editable.push(sRow('Frequency', frequencyControl(row, actions)));
      editable.push(frequencyAmountRow(row, 'amount', 'Amount', labels.currency ? '' : ' (NZD)'));

      const insights = [];
      if (labels.currency) insights.push(sCalc(
        liv(() => 'Amount in NZD per ' + frequencyUnit(row)),
        () => money(amountInNZD())
      ));
      insights.push(sCalc('Share of income', () => pctOf(monthlyAmountInNZD(), D().income).toFixed(1) + '%'));
      if (shareOfSection) {
        insights.push(sCalc(
          'Share of ' + labels.section,
          () => pctOf(monthlyAmountInNZD(), D().budgeted[kind]).toFixed(1) + '%'
        ));
      }

      const detail = h('div', { class: 'li-detail one', hidden: true },
        h('div', { class: 'fgroup' }, editable),
        labels.currency
          ? liv(() => isForeignCurrency()
            ? 'Converted to NZD using the exchange rates on the People and data page.'
            : '', 'p', 'hint')
          : null,
        h('div', { class: 'fgroup' }, insights),
        h('button', { class: 'btn danger full', type: 'button', onclick: () => {
          actions.deleteMoneyItem(row, collection, item, itemTitle);
        } }, labels.del));
      expandable(item, header, detail);
      return item;
    }
    const incItem = (row, actions) => moneyItem(row, 'income', {
      untitled: 'Untitled income',
      field: 'Source',
      ph: 'e.g. Salary',
      del: 'Delete income',
      currency: true
    }, 'income', false, actions);
    const expItem = (row, actions) => moneyItem(row, row.category, {
      untitled: 'Untitled expense',
      field: 'Expense',
      ph: 'e.g. Groceries',
      del: 'Delete expense',
      section: row.category === 'essential' ? 'essential expenses' : 'discretionary expenses'
    }, 'expenses', true, actions);
    function incomeBody(actions) {
      const { list, empty } = itemList('income', () => true, row => incItem(row, actions), 'No income yet. Add the first source.');
      return h(
        'div',
        {},
        h('div', { class: 'li-wrap' }, list, empty),
        totalsEl(() => [
          ['Total per ' + periodUnit(), money(periodAmount(D().income))],
          ['Sources', String(state.income.length)]
        ]),
        h('button', { class: 'add', type: 'button', onclick: () => actions.addIncome(list) }, 'Add income')
      );
    }
    function expenseBody(category, addLabel, actions) {
      const { list, empty } = itemList(
        'expenses',
        expense => expense.category === category,
        row => expItem(row, actions),
        'Nothing here yet. Add the first one.'
      );
      return h(
        'div',
        {},
        h('div', { class: 'li-wrap' }, list, empty),
        totalsEl(() => [
          ['Budgeted per ' + periodUnit(), money(periodAmount(D().budgeted[category]))],
          ['Share of income', pctOf(D().budgeted[category], D().income).toFixed(1) + '%'],
          ['Items', String(state.expenses.filter(expense => expense.category === category).length)]
        ]),
        h('button', { class: 'add', type: 'button', onclick: () => actions.addExpense(category, list) }, addLabel)
      );
    }

    function goalItem(goal, actions) {
      const goalSummary = () => D().goals[goal.id] || {
        saved: 0,
        hasTarget: false,
        status: '',
        remaining: 0,
        projected: null,
        required: null
      };
      const percentage = () => {
        const summary = goalSummary();
        return summary.hasTarget && num(goal.target) > 0
          ? Math.min(summary.saved / num(goal.target), 1) * 100
          : 0;
      };
      const item = h('div', { class: 'acc-item', 'data-id': goal.id });
      const header = h(
        'button',
        { class: 'tx-row li', type: 'button', 'aria-expanded': 'false' },
        liv(() => ring(percentage()), 'span', 'li-ringw'),
        h('span', { class: 'tx-main' },
          liv(() => esc(goal.name || 'Untitled goal'), 'b'),
          liv(() => {
            const summary = goalSummary();
            const savedText = summary.hasTarget
              ? 'Saved ' + money(summary.saved, 0) + ' of ' + money(num(goal.target), 0)
              : 'No target set';
            const reachedText = summary.projected
              ? ', reached ' + fmtDate(summary.projected)
              : '';
            return savedText + reachedText;
          }, 'small'),
          liv(() => {
            const status = goalSummary().status;
            return `<span class="pill ${cls(status)}" title="${esc(status)}">${esc(status)}</span>`;
          }, 'span')
        ),
        h('span', { class: 'tx-amt' },
          liv(() => money(num(goal.monthly)), 'b'),
          h('small', {}, 'per ' + frequencyUnit(goal))
        ),
        h('span', { class: 'tx-chev', 'aria-hidden': 'true' }, '\u203a')
      );
      const detail = h('div', { class: 'li-detail', hidden: true },
        h('div', { class: 'fgroup' },
          sRow('Goal', field(sCol('Goal', 'name', 'text', { ph: 'e.g. House deposit' }), goal)),
          sRow('User', field(sCol('User', 'user', 'select', { opts: userOpts }), goal)),
          sRow('Target (NZD)', field(sCol('Target (NZD)', 'target', 'number'), goal)),
          sRow('Target date', field(sCol('Target date', 'date', 'date'), goal)),
          sRow('Frequency', frequencyControl(goal, actions)),
          frequencyAmountRow(goal, 'monthly', 'Amount', ' (NZD)')
        ),
        h('div', { class: 'fgroup' },
          sCalc('Saved so far', () => {
            const summary = goalSummary();
            return summary.hasTarget
              ? progH(summary.saved, num(goal.target))
              : money(summary.saved);
          }),
          sCalc('Still to save', () => {
            const summary = goalSummary();
            return summary.hasTarget ? money(summary.remaining) : '\u2014';
          }),
          sCalc('Reached by', () => {
            const projected = goalSummary().projected;
            return projected ? fmtDate(projected) : '\u2014';
          }),
          sCalc('Needed per ' + periodUnit(), () => {
            const required = goalSummary().required;
            return required == null ? '\u2014' : money(periodAmount(required));
          }),
          sCalc('Status', () => {
            const status = goalSummary().status;
            return { t: status, cls: cls(status) };
          })
        ),
        h('button', { class: 'btn danger full', type: 'button', onclick: () => {
          actions.deleteGoal(goal, item);
        } }, 'Delete goal'));
      expandable(item, header, detail);
      return item;
    }
    function debtItem(debt, actions) {
      const debtSummary = () => D().debts[debt.id] || {
        bal: 0,
        funded: 0,
        unfunded: 0,
        status: '',
        projected: null,
        required: null
      };
      const percentage = () => {
        const summary = debtSummary();
        return summary.bal > 0 ? Math.min(summary.funded / summary.bal, 1) * 100 : 0;
      };
      const item = h('div', { class: 'acc-item', 'data-id': debt.id });
      const header = h(
        'button',
        { class: 'tx-row li', type: 'button', 'aria-expanded': 'false' },
        liv(() => ring(percentage()), 'span', 'li-ringw'),
        h('span', { class: 'tx-main' },
          liv(() => esc(debt.name || 'Untitled debt'), 'b'),
          liv(() => {
            const summary = debtSummary();
            const coverageText = summary.unfunded < MONEY_EPSILON
              ? 'fully covered' + (summary.funded - summary.bal > 0.5
                ? ', ' + money(summary.funded - summary.bal, 0) + ' extra set aside'
                : '')
              : money(summary.unfunded, 0) + ' still to find';
            const dueText = debt.due ? ', due ' + dueDate(debt.due) : '';
            return `${money(summary.bal, 0)} owed, ${coverageText}${dueText}`;
          }, 'small'),
          liv(() => {
            const status = debtSummary().status;
            return `<span class="pill ${cls(status)}" title="${esc(status)}">${esc(status)}</span>`;
          }, 'span')
        ),
        h('span', { class: 'tx-amt' },
          liv(() => money(num(debt.monthly)), 'b'),
          h('small', {}, 'per ' + frequencyUnit(debt))
        ),
        h('span', { class: 'tx-chev', 'aria-hidden': 'true' }, '\u203a')
      );
      const detail = h('div', { class: 'li-detail', hidden: true },
        h('div', { class: 'fgroup' },
          sRow('Debt', field(sCol('Debt', 'name', 'text', { ph: 'e.g. Car loan' }), debt)),
          sRow('Priority', field(sCol('Priority', 'priority', 'number'), debt)),
          sRow('Borrower', field(sCol('Borrower', 'borrower', 'select', { opts: userOpts }), debt)),
          sRow('Owed to', field(sCol('Owed to', 'creditor', 'text'), debt)),
          sRow('Due date', field(sCol('Due date', 'due', 'date'), debt)),
          sRow('Currency', field(sCol('Currency', 'currency', 'select', { opts: curOpts }), debt)),
          sRow('Starting balance', field(sCol('Starting balance', 'balance', 'number'), debt)),
          sRow('Frequency', frequencyControl(debt, actions)),
          frequencyAmountRow(debt, 'monthly', 'Payment', ' (NZD)')
        ),
        h('div', { class: 'fgroup' },
          sCalc('Balance (NZD)', () => money(debtSummary().bal)),
          sCalc('Covered so far', () => progH(debtSummary().funded, debtSummary().bal)),
          sCalc('Still to find', () => money(debtSummary().unfunded)),
          sCalc('Repaid by', () => {
            const summary = debtSummary();
            return summary.projected && summary.bal > 0
              ? fmtDate(summary.projected)
              : '\u2014';
          }),
          sCalc('Needed per ' + periodUnit(), () => {
            const required = debtSummary().required;
            return required == null ? '\u2014' : money(periodAmount(required));
          }),
          sCalc('Status', () => {
            const status = debtSummary().status;
            return { t: status, cls: cls(status) };
          })
        ),
        h('button', { class: 'btn danger full', type: 'button', onclick: () => {
          actions.deleteDebt(debt, item);
        } }, 'Delete debt'));
      expandable(item, header, detail);
      return item;
    }
    function goalsBody(actions) {
      const { list, empty } = itemList('goals', () => true, goal => goalItem(goal, actions), 'No goals yet. Add the first one.');
      return h(
        'div',
        {},
        h('div', { class: 'li-wrap' }, list, empty),
        totalsEl(() => [
          ['Target total', money(sum(state.goals, 'target'))],
          ['Saved so far', money(sum(Object.values(D().goals), 'saved'))],
          ['Total per ' + periodUnit(), money(periodAmount(D().budgeted.savings))]
        ]),
        h('button', { class: 'add', type: 'button', onclick: () => actions.addGoal(list) }, 'Add goal')
      );
    }
    function debtsBody(actions) {
      const list = h('div', { class: 'tx-card acc-list' });
      state.debts.slice().sort(byPriority).forEach(debt => list.append(debtItem(debt, actions)));
      const empty = liv(
        () => list.children.length ? '' : '<p class="empty">No debts recorded. Add the first one.</p>',
        'div'
      );
      return h(
        'div',
        {},
        h('div', { class: 'li-wrap' }, list, empty),
        totalsEl(() => {
          const summary = D();
          return [
            ['Owed (NZD)', money(summary.debtTotal)],
            ['Covered', money(summary.debtFunded)],
            ['Still to find', money(summary.debtUnfunded)],
            ['Total per ' + periodUnit(), money(periodAmount(summary.budgeted.debt))]
          ];
        }),
        h('button', { class: 'add', type: 'button', onclick: () => actions.addDebt(list) }, 'Add debt')
      );
    }

    const ring = p => `<span class="li-ring"><svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><circle class="rg-bg" cx="22" cy="22" r="18"/><circle class="rg-fg" cx="22" cy="22" r="18" stroke-dasharray="${(p / 100 * 113.1).toFixed(1)} 113.1" transform="rotate(-90 22 22)"${p < 0.5 ? ' style="display:none"' : ''}/></svg><b>${Math.round(p)}%</b></span>`;
    const progH = (saved, total) => {
      const percentage = total > 0 ? Math.min(saved / total, 1) * 100 : 0;
      return {
        html: `<span class="mini"><i style="width:${percentage}%"></i></span>${money(saved, 0)} (${percentage.toFixed(0)}%)`
      };
    };
    const dueDate = s => fmtDate(new Date(s + 'T00:00:00'));
    return {
      render: planView,
      incomeItem: incItem,
      expenseItem: expItem,
      goalItem,
      debtItem
    };
  };
})();
