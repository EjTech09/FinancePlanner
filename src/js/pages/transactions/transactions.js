(() => {
  'use strict';

  /**
   * Transactions page and editing sheet.
   *
   * Manages the list of account transactions, the per-type grouping, and the
   * slide-up sheet used to create or edit individual entries.
   */
  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.transactions = context => {
    const { state, rate, num, fmtDate, money, esc, sum, h, $, $$, uid, field, sRow, sCalc, sCol, accOpts, userOpts, accountCurrency, commit, save, render, detach, tile, head, bento, kpiTile } = context;
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
    const TX_IC = {
      income: ['--green', '<path d="M12 5v14M12 19l-5-5M12 19l5-5"/>'],
      expense: ['--orange', '<path d="M12 19V5M12 5l-5 5M12 5l5 5"/>'],
      debt: ['--red', '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 10h18"/>'],
      goal: ['--blue', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>'],
      transfer: ['--indigo', '<path d="M5 9h13M18 9l-3-3M18 9l-3 3M19 15H6M6 15l3-3M6 15l3 3"/>']
    };
    const txIcon = type => {
      const [color, path] = TX_IC[type] || TX_IC.transfer;
      return `<span class="tx-ic" style="--tc:var(${color})"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></span>`;
    };
    const hasAmount = transaction => !(transaction.amount === '' || transaction.amount == null);
    function txRowEl(transaction) {
      const account = state.accounts.find(item => item.id === transaction.account);
      const currency = account ? account.currency : 'NZD';
      const isIncome = transaction.type === 'income';
      const sign = transaction.type === 'transfer' ? '' : (isIncome ? '+' : '\u2212');
      const subheading = [
        transaction.date
          ? fmtDate(new Date(transaction.date + 'T00:00:00'))
          : 'No date',
        account ? account.name : 'No account'
      ].join(', ');
      const originalAmount = currency !== 'NZD' && hasAmount(transaction)
        ? ', ' + currency + ' ' + num(transaction.amount).toLocaleString('en-NZ', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
        : '';
      const row = h('button', {
        class: 'tx-row',
        type: 'button',
        'data-id': transaction.id,
        onclick: () => openTxSheet(transaction, false)
      });
      row.innerHTML = `${txIcon(transaction.type)}<span class="tx-main"><b>${esc(transaction.description || 'Untitled')}</b><small>${esc(subheading)}</small></span>
        <span class="tx-amt"><b class="${isIncome ? 'ok' : ''}">${hasAmount(transaction) ? sign + money(Math.abs(txNZD(transaction))) : '\u2014'}</b><small>${esc(TYPE_LABEL[transaction.type] || '')}${esc(originalAmount)}</small></span><span class="tx-chev" aria-hidden="true">\u203a</span>`;
      return row;
    }
    function txList() {
      const wrap = h('div', { class: 'tx-list', 'data-calc': '' });
      wrap._u = () => {
        const selectedType = state.ui.txType || 'all';
        const transactions = state.transactions
          .filter(transaction => selectedType === 'all' || transaction.type === selectedType)
          .slice()
          .sort((first, second) =>
            (second.date || '9999-99-99').localeCompare(first.date || '9999-99-99')
          );
        wrap.innerHTML = '';
        if (!transactions.length) {
          const message = state.transactions.length
            ? 'No transactions of this type.'
            : 'No transactions yet. Add the first one.';
          wrap.append(h('p', { class: 'empty' }, message));
          return;
        }

        const groups = [];
        for (const transaction of transactions) {
          const month = transaction.date ? transaction.date.slice(0, 7) : 'none';
          let group = groups[groups.length - 1];
          if (!group || group.month !== month) {
            group = { month, transactions: [] };
            groups.push(group);
          }
          group.transactions.push(transaction);
        }

        for (const group of groups) {
          const income = group.transactions.filter(transaction => transaction.type === 'income');
          const outflows = group.transactions.filter(transaction =>
            ['expense', 'debt', 'goal'].includes(transaction.type)
          );
          const net = sum(income, txNZD) - sum(outflows, txNZD);
          const label = group.month === 'none'
            ? 'No date'
            : new Date(group.month + '-01T00:00:00').toLocaleDateString('en-NZ', {
              month: 'long',
              year: 'numeric'
            });
          const netLabel = 'Net ' + (net < 0 ? '\u2212' : '+') + money(Math.abs(net));
          const header = h(
            'div',
            { class: 'tx-month' },
            h('span', {}, label),
            h('span', { class: net < 0 ? 'bad' : '' }, netLabel)
          );
          const rows = h('div', { class: 'tx-card' }, group.transactions.map(txRowEl));
          wrap.append(h('div', { class: 'tx-group' }, header, rows));
        }
      };
      wrap._u();
      return wrap;
    }

    /* ---------- slide-up sheet ---------- */
    let sheet = null;
    function closeSheet(immediate) {
      if (!sheet) return;
      const currentSheet = sheet;
      sheet = null;

      $$('[data-calc],[data-opts]', currentSheet.back).forEach(element => {
        element.removeAttribute('data-calc');
        element.removeAttribute('data-opts');
      });
      document.removeEventListener('keydown', currentSheet.onKey);
      document.body.style.overflow = '';

      if (immediate || matchMedia('(prefers-reduced-motion:reduce)').matches) {
        currentSheet.back.remove();
      } else {
        currentSheet.back.classList.remove('in');
        setTimeout(() => currentSheet.back.remove(), 320);
      }

      if (currentSheet.isNew && currentSheet.isBlank(currentSheet.row)) {
        state[currentSheet.coll] = state[currentSheet.coll]
          .filter(row => row !== currentSheet.row);
      }
      commit();
      const transactionButton = $(`.tx-row[data-id="${currentSheet.row.id}"]`);
      if (transactionButton) transactionButton.focus();
    }
    function openFormSheet(cfg) {
      closeSheet(true);
      const { row, coll, isNew } = cfg;
      const newItemState = { value: isNew };
      const back = h('div', { class: 'sheet-back' });
      const panel = h('div', {
        class: 'sheet-panel',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'sheet-title',
        tabindex: '-1'
      });
      const grab = h('div', { class: 'sheet-grab' });
      const heading = h(
        'div',
        { class: 'sheet-head' },
        h('h2', { id: 'sheet-title' }, isNew ? cfg.newTitle : cfg.title),
        h('button', { class: 'done', type: 'button', onclick: () => closeSheet() }, 'Done')
      );
      const top = h('div', { class: 'sheet-top' }, grab, heading);
      panel.append(top);
      if (cfg.summary) panel.append(cfg.summary);
      cfg.groups.forEach(group => panel.append(h('div', { class: 'fgroup' }, group)));
      panel.append(h('button', {
        class: 'btn danger full',
        type: 'button',
        onclick: () => {
          if (!confirm(cfg.confirmText)) return;
          state[coll] = state[coll].filter(item => item !== row);
          detach(coll, row.id);
          newItemState.value = false;
          closeSheet();
        }
      }, cfg.deleteLabel));

      const onKey = e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeSheet();
          return;
        }
        if (e.key === 'Tab') {
          const focusableElements = $$('input,select,button', panel)
            .filter(element => !element.disabled && element.offsetParent !== null);
          if (!focusableElements.length) return;

          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      back.addEventListener('pointerdown', event => {
        if (event.target === back) closeSheet();
      });
      let sy = null;
      top.addEventListener('pointerdown', event => {
        if (event.target.closest('button')) return;
        sy = event.clientY;
        try {
          top.setPointerCapture(event.pointerId);
        } catch (error) {}
        panel.style.transition = 'none';
      });
      top.addEventListener('pointermove', event => {
        if (sy == null) return;
        panel.style.transform = `translate(-50%,${Math.max(0, event.clientY - sy)}px)`;
      });
      const endDrag = event => {
        if (sy == null) return;
        const distance = Math.max(0, event.clientY - sy);
        sy = null;
        panel.style.transition = '';
        panel.style.transform = '';
        if (distance > 110) closeSheet();
      };
      top.addEventListener('pointerup', endDrag);
      top.addEventListener('pointercancel', endDrag);

      back.append(panel);
      document.body.append(back);
      document.body.style.overflow = 'hidden';
      sheet = {
        back,
        onKey,
        row,
        coll,
        isBlank: cfg.isBlank,
        get isNew() {
          return newItemState.value;
        }
      };
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(() => {
        back.classList.add('in');
        (isNew ? $('.frow input', panel) : panel).focus();
      });
    }
    function openTxSheet(row, isNew) {
      openFormSheet({
        row,
        isNew,
        coll: 'transactions',
        title: 'Transaction',
        newTitle: 'New transaction',
        deleteLabel: 'Delete transaction',
        confirmText: 'Delete this transaction? This cannot be undone.',
        isBlank: r => !r.description && !hasAmount(r) && !r.related,
        groups: [
          [
            sRow('Description', field(sCol('Description', 'description', 'text', { ph: 'What was it for?' }), row)),
            sRow('Amount', field(sCol('Amount (account currency)', 'amount', 'number'), row)),
            sRow('Date', field(sCol('Date', 'date', 'date'), row))
          ],
          [
            sRow('Type', field(sCol('Type', 'type', 'select', {
              opts: () => TYPES.map(([value, label]) => ({ v: value, t: label }))
            }), row)),
            sRow('Account', field(sCol('Account', 'account', 'select', { opts: accOpts }), row)),
            sRow('User', field(sCol('User', 'user', 'select', { opts: userOpts }), row)),
            sRow('Related item', field(sCol('Related item', 'related', 'text', {
              ph: 'Expense, debt or goal name'
            }), row))
          ],
          [
            sCalc('Currency', () =>
              (state.accounts.find(account => account.id === row.account) || {}).currency || 'NZD'
            ),
            sCalc('Amount in NZD', () =>
              hasAmount(row) ? money(txNZD(row)) : '\u2014'
            )
          ]
        ]
      });
    }

    const txView = () => {
      const el = h('div', {}, head(
        'Transactions',
        'A record of money in and out. It is for tracking only and does not change balances or the budget. Tap a transaction to see and edit the details.'
      ));
      const selectedType = state.ui.txType || 'all';
      const totalByType = type => () => money(
        sum(state.transactions.filter(transaction => transaction.type === type), txNZD)
      );
      const countByType = type => type === 'all'
        ? state.transactions.length
        : state.transactions.filter(transaction => transaction.type === type).length;
      const addTransaction = () => {
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
        openTxSheet(transaction, true);
      };
      const filterItems = [['all', 'All'], ...TYPES];
      const filters = h(
        'div',
        { class: 'fl-list', role: 'group', 'aria-label': 'Filter by type' },
        filterItems.map(([type, label]) => h('button', {
          class: 'fl-b',
          type: 'button',
          'aria-pressed': String(selectedType === type),
          onclick: () => {
            state.ui.txType = type;
            save();
            render();
          }
        },
        h('span', {}, label),
        h('span', { class: 'n' }, String(countByType(type)))))
      );
      const side = tile(
        4,
        { class: 'tx-side' },
        h('h2', {}, 'Show'),
        filters,
        h('button', {
          class: 'btn full',
          type: 'button',
          onclick: addTransaction
        }, 'Add transaction')
      );
      el.append(bento(
        kpiTile('Income', totalByType('income'), 'money in'),
        kpiTile('Expenses', totalByType('expense'), 'everyday spending'),
        kpiTile('Debt payments', totalByType('debt'), 'paid towards debts'),
        kpiTile('Goal contributions', totalByType('goal'), 'put towards goals'),
        tile(8, { class: 'tx-list-tile' }, h('h2', {}, 'All transactions'), txList()),
        side
      ));
      return el;
    };
    return { render: txView, txIcon };
  };
})();
