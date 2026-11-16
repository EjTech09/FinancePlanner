(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.transactionsView = (context, service) => {
    const DOMAIN = window.HouseholdPlannerConstants.domain;
    const TRANSACTION_CONSTANTS = window.HouseholdPlannerConstants.transactions;
    const {
      state, num, fmtDate, money, esc, sum, h, $, $$, field, sRow, sCalc, sCol,
      accOpts, userOpts, tile, head, bento, kpiTile
    } = context;
    const { TYPES, TYPE_LABEL, txNZD, hasAmount } = service;

    const TX_IC = TRANSACTION_CONSTANTS.ICONS;
    const TYPE = TRANSACTION_CONSTANTS.TYPE;
    const txIcon = type => {
      const [color, path] = TX_IC[type] || TX_IC[TYPE.TRANSFER];
      return `<span class="tx-ic" style="--tc:var(${color})"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></span>`;
    };

    function txRowEl(transaction, onEdit) {
      const account = state.accounts.find(item => item.id === transaction.account);
      const currency = account ? account.currency : DOMAIN.DEFAULT_CURRENCY;
      const isIncome = transaction.type === TYPE.INCOME;
      const sign = transaction.type === TYPE.TRANSFER ? '' : (isIncome ? '+' : '\u2212');
      const subheading = [
        transaction.date
          ? fmtDate(new Date(transaction.date + 'T00:00:00'))
          : 'No date',
        account ? account.name : 'No account',
        service.categoryLabel(transaction),
        service.relatedLabel(transaction)
      ].filter(Boolean).join(', ');
      const originalAmount = currency !== DOMAIN.DEFAULT_CURRENCY && hasAmount(transaction)
        ? ', ' + currency + ' ' + num(transaction.amount).toLocaleString('en-NZ', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })
        : '';
      const row = h('button', {
        class: 'tx-row',
        type: 'button',
        'data-id': transaction.id,
        onclick: () => onEdit(transaction, false)
      });
      row.innerHTML = `${txIcon(transaction.type)}<span class="tx-main"><b>${esc(transaction.description || 'Untitled')}</b><small>${esc(subheading)}</small></span>
        <span class="tx-amt"><b class="${isIncome ? 'ok' : ''}">${hasAmount(transaction) ? sign + money(Math.abs(txNZD(transaction))) : '\u2014'}</b><small>${esc(TYPE_LABEL[transaction.type] || '')}${esc(originalAmount)}</small></span><span class="tx-chev" aria-hidden="true">\u203a</span>`;
      return row;
    }

    function txList(onEdit) {
      const wrap = h('div', { class: 'tx-list', 'data-calc': '' });
      wrap._u = () => {
        const selectedType = state.ui.txType || DOMAIN.FILTER_ALL;
        const transactions = state.transactions
          .filter(transaction => selectedType === DOMAIN.FILTER_ALL || transaction.type === selectedType)
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
          const income = group.transactions.filter(transaction => transaction.type === TYPE.INCOME);
          const outflows = group.transactions.filter(transaction =>
            [TYPE.EXPENSE, TYPE.DEBT, TYPE.GOAL].includes(transaction.type)
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
          const rows = h('div', { class: 'tx-card' }, group.transactions.map(tx => txRowEl(tx, onEdit)));
          wrap.append(h('div', { class: 'tx-group' }, header, rows));
        }
      };
      wrap._u();
      return wrap;
    }

    function createTransactionSheet(row, isNew, onClose, onDelete) {
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
        h('h2', { id: 'sheet-title' }, isNew ? 'New transaction' : 'Transaction'),
        h('button', { class: 'done', type: 'button', onclick: onClose }, 'Done')
      );
      const top = h('div', { class: 'sheet-top' }, grab, heading);
      panel.append(top);
      const transferRow = sRow('Transfer to', field(sCol('Transfer destination', 'transferTo', 'select', {
        opts: accOpts,
        onChange: () => service.updateBalanceImpact(row)
      }), row));
      const updateTransferRow = () => {
        transferRow.style.display = row.type === TYPE.TRANSFER ? '' : 'none';
      };
      updateTransferRow();
      transferRow.classList.add('transfer-row');
      [
        [
          sRow('Description', field(sCol('Description', 'description', 'text', { ph: 'What was it for?' }), row)),
          sRow('Amount', field(sCol('Amount (account currency)', 'amount', 'number', {
            onChange: () => service.updateBalanceImpact(row)
          }), row)),
          sRow('Date', field(sCol('Date', 'date', 'date'), row))
        ],
        [
          sRow('Type', field(sCol('Type', 'type', 'select', {
            opts: () => TYPES.map(([value, label]) => ({ v: value, t: label })),
            onChange: () => {
              service.updateRelated(row);
              updateTransferRow();
            }
          }), row)),
          sRow('Account', field(sCol('Account', 'account', 'select', {
            opts: accOpts,
            onChange: () => service.updateBalanceImpact(row)
          }), row)),
          sRow('User', field(sCol('User', 'user', 'select', { opts: userOpts }), row)),
          sRow('Category', field(sCol('Category', 'category', 'select', {
            opts: () => service.categoryOptions(row)
          }), row)),
          sRow('Map to', field(sCol('Map to', 'related', 'select', {
            opts: () => service.relatedOptions(row),
            onChange: () => {
              service.updateRelated(row);
              updateTransferRow();
            }
          }), row)),
          transferRow
        ],
        [
          sCalc('Currency', () =>
            (state.accounts.find(account => account.id === row.account) || {}).currency ||
            DOMAIN.DEFAULT_CURRENCY
          ),
          sCalc('Amount in NZD', () =>
            hasAmount(row) ? money(txNZD(row)) : '\u2014'
          )
        ]
      ].forEach(group => panel.append(h('div', { class: 'fgroup' }, group)));
      panel.append(h('button', {
        class: 'btn danger full',
        type: 'button',
        onclick: onDelete
      }, 'Delete transaction'));

      const onKey = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key === 'Tab') {
          const focusableElements = $$('input,select,button', panel)
            .filter(element => !element.disabled && element.offsetParent !== null);
          if (!focusableElements.length) return;

          const first = focusableElements[0];
          const last = focusableElements[focusableElements.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      };

      back.addEventListener('pointerdown', event => {
        if (event.target === back) onClose();
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
        if (distance > 110) onClose();
      };
      top.addEventListener('pointerup', endDrag);
      top.addEventListener('pointercancel', endDrag);

      back.append(panel);
      document.body.append(back);
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', onKey);
      requestAnimationFrame(() => {
        back.classList.add('in');
        (isNew ? $('.frow input', panel) : panel).focus();
      });

      return {
        close(immediate) {
          $$('[data-calc],[data-opts]', back).forEach(element => {
            element.removeAttribute('data-calc');
            element.removeAttribute('data-opts');
          });
          document.removeEventListener('keydown', onKey);
          document.body.style.overflow = '';
          if (immediate || matchMedia('(prefers-reduced-motion:reduce)').matches) {
            back.remove();
          } else {
            back.classList.remove('in');
            setTimeout(() => back.remove(), 320);
          }
        }
      };
    }

    function render(onAdd, onSelectType, onEdit) {
      const el = h('div', {}, head(
        'Transactions',
        'Record money in and out to update account balances. Link payments to debts, money set aside or planned expenses. Tap a transaction to edit it.'
      ));
      const selectedType = state.ui.txType || DOMAIN.FILTER_ALL;
      const countByType = type => type === DOMAIN.FILTER_ALL
        ? state.transactions.length
        : state.transactions.filter(transaction => transaction.type === type).length;
      const filterItems = [[DOMAIN.FILTER_ALL, 'All'], ...TYPES];
      const filters = h(
        'div',
        { class: 'fl-list', role: 'group', 'aria-label': 'Filter by type' },
        filterItems.map(([type, label]) => h('button', {
          class: 'fl-b',
          type: 'button',
          'aria-pressed': String(selectedType === type),
          onclick: () => onSelectType(type)
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
          onclick: () => onAdd(selectedType)
        }, 'Add transaction')
      );
      el.append(bento(
        kpiTile('Income', () => money(service.totalByType(TYPE.INCOME)), 'money in'),
        kpiTile('Expenses', () => money(service.totalByType(TYPE.EXPENSE)), 'everyday spending'),
        kpiTile('Debt payments', () => money(service.totalByType(TYPE.DEBT)), 'paid towards debts'),
        kpiTile('Goal contributions', () => money(service.totalByType(TYPE.GOAL)), 'put towards goals'),
        tile(8, { class: 'tx-list-tile' }, h('h2', {}, 'All transactions'), txList(onEdit)),
        side
      ));
      return el;
    }

    return { render, txIcon, createTransactionSheet };
  };
})();
