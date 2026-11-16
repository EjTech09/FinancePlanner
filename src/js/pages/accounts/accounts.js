(() => {
  'use strict';

  /**
   * Accounts page controller.
   *
   * This view manages the account list, the "money set aside" commitments, and the
   * exchange-rate overrides used to convert balances into NZD for reporting. The
   * surrounding app injects all shared rendering helpers through the `context`
   * object, which keeps this page focused on page-specific state and UX.
   */
  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.accounts = context => {
    const { state, D, h, $, $$, uid, money, moneyCur, num, sum, esc, fmtDate, rate, accountCurrency, nameOf, cls, userOpts, accOpts, targetOpts, curOpts, sRow, sCalc, sCol, calcEl, field, detach, commit, save, render, markDirty, seg, refreshExchangeRates, exchangeRates, bento, tile, head, kpiTile, txIcon, liv, itemList, expandable, totalsEl } = context;

    /**
     * Resolve the active account filter.
     *
     * The UI supports "all accounts", "accounts without a user", or a single user.
     * Invalid stored filters are safely reset back to "all".
     */
    const accFilter = () => {
      const filter = state.ui.accUser || 'all';
      const isKnownUser = state.users.some(user => user.id === filter);
      return filter === 'all' || filter === 'none' || isKnownUser ? filter : 'all';
    };
    /**
     * Determine whether an account should be visible in the current user filter.
     */
    const accMatch = account => {
      const filter = accFilter();
      if (filter === 'all') return true;
      if (filter === 'none') return !account.user;
      return account.user === filter;
    };

    /**
     * Determine whether a commitment belongs to the same filtered account view.
     */
    const comMatch = commitment => {
      const account = state.accounts.find(item => item.id === commitment.account);
      return account ? accMatch(account) : true;
    };

    /**
     * Return the accounts currently visible in the active filter.
     */
    const visAcc = () => state.accounts.filter(accMatch);

    /**
     * Build a single account row/card and its detail editor.
     *
     * The account card shows summary metrics and a compact editor for balance,
     * liabilities, and user/currency metadata.
     */
    function accItem(account) {
      const accountSummary = () => D().accounts[account.id] || {
        bal: 0,
        net: 0,
        committed: 0,
        free: 0,
        status: ''
      };
      const item = h('div', { class: 'acc-item', 'data-id': account.id });
      const currencyChip = h('span', { 'data-calc': '' });
      currencyChip._u = () => {
        currencyChip.className = 'li-chip cur-' + (account.currency || 'none');
        currencyChip.textContent = account.currency || '\u2014';
      };
      currencyChip._u();

      const header = h(
        'button',
        { class: 'tx-row li', type: 'button', 'aria-expanded': 'false' },
        currencyChip,
        h('span', { class: 'tx-main' },
          liv(() => esc(account.name || 'Untitled account'), 'b'),
          liv(() => `${esc(nameOf('users', account.user) || 'No user')}, ${money(accountSummary().net)} after liabilities`, 'small'),
          liv(() => {
            const status = accountSummary().status;
            return `<span class="pill ${cls(status)}" title="${esc(status)}">${esc(status)}</span>`;
          }, 'span')
        ),
        h('span', { class: 'tx-amt' },
          liv(() => {
            const free = accountSummary().free;
            return `<span class="${free < -0.005 ? 'bad' : ''}">${money(free)}</span>`;
          }, 'b'),
          h('small', {}, 'free to use')
        ),
        h('span', { class: 'tx-chev', 'aria-hidden': 'true' }, '\u203a')
      );
      const detail = h('div', { class: 'li-detail', hidden: true },
        h('div', { class: 'fgroup' },
          sRow('Account', field(sCol('Account', 'name', 'text', { ph: 'e.g. Everyday account' }), account)),
          sRow('User', field(sCol('User', 'user', 'select', { opts: userOpts }), account)),
          sRow('Currency', field(sCol('Currency', 'currency', 'select', {
            opts: curOpts,
            onChange: (oldCurrency, newCurrency) => {
              const from = rate(oldCurrency);
              const to = rate(newCurrency);
              if (from > 0 && to > 0) {
                state.commitments
                  .filter(commitment =>
                    commitment.account === account.id &&
                    commitment.amount !== '' &&
                    commitment.amount != null
                  )
                  .forEach(commitment => {
                    commitment.amount = num(commitment.amount) * from / to;
                  });
              }
            }
          }), account)),
          sRow('Balance', field(sCol('Balance', 'balance', 'number'), account)),
          sRow('Liabilities due', field(sCol('Liabilities due', 'liabilities', 'number'), account))
        ),
        h('div', { class: 'fgroup' },
          sCalc('Balance (NZD)', () => money(accountSummary().bal)),
          sCalc('After liabilities', () => money(accountSummary().net)),
          sCalc('Set aside (NZD)', () => money(accountSummary().committed)),
          sCalc('Free to use', () => money(accountSummary().free)),
          sCalc('Status', () => {
            const status = accountSummary().status;
            return { t: status, cls: cls(status) };
          })
        ),
        h('button', { class: 'btn danger full', type: 'button', onclick: () => {
          if (!confirm('Delete this account? Money set aside from it will be removed too.')) return;
          state.accounts = state.accounts.filter(row => row !== account);
          detach('accounts', account.id);
          commit();
          render();
        } }, 'Delete account'));
      expandable(item, header, detail);
      item._check = () => {
        if (!accMatch(account)) item.remove();
      };
      return item;
    }
    /**
     * Build a single set-aside commitment row/card.
     *
     * Each row links a commitment to an account, a target (debt/goal/other), and a
     * label/amount. The amount is stored in the account's currency, while the totals
     * section converts it to NZD for aggregate reporting.
     */
    function comItem(c) {
      const kind = () => {
        if ((c.target || '').startsWith('debt:')) return 'debt';
        if ((c.target || '').startsWith('goal:')) return 'goal';
        return 'other';
      };
      const what = () => {
        if (kind() === 'debt') return nameOf('debts', c.target.slice(5)) || 'Unknown debt';
        if (kind() === 'goal') return nameOf('goals', c.target.slice(5)) || 'Unknown goal';
        return c.label || 'Something else';
      };
      const KIND = { debt: 'Debt', goal: 'Goal', other: 'Other' };
      const item = h('div', { class: 'acc-item', 'data-id': c.id });
      const accountInput = field(sCol('Account', 'account', 'select', {
        opts: accOpts,
        onChange: (oldAccountId, newAccountId) => {
          const oldRate = rate(accountCurrency(oldAccountId));
          const newRate = rate(accountCurrency(newAccountId));
          if (c.amount !== '' && c.amount != null && oldRate > 0 && newRate > 0) {
            c.amount = num(c.amount) * oldRate / newRate;
          }
        }
      }), c);
      const amountLabel = liv(
        () => `Amount (${esc(accountCurrency(c.account))})`,
        'span',
        'fl'
      );
      const amountInput = field(sCol('Amount (account currency)', 'amount', 'number'), c);
      const header = h(
        'button',
        { class: 'tx-row li', type: 'button', 'aria-expanded': 'false' },
        liv(() => txIcon(kind() === 'other' ? 'transfer' : kind()), 'span', 'li-ic'),
        h('span', { class: 'tx-main' },
          liv(() => esc(what()), 'b'),
          liv(() => 'From ' + esc(nameOf('accounts', c.account) || 'no account'), 'small'),
          liv(() => `<span class="pill neu">${KIND[kind()]}</span>`, 'span')
        ),
        h('span', { class: 'tx-amt' },
          liv(() => moneyCur(num(c.amount), accountCurrency(c.account)), 'b'),
          h('small', {}, 'set aside')
        ),
        h('span', { class: 'tx-chev', 'aria-hidden': 'true' }, '\u203a')
      );
      const detail = h('div', { class: 'li-detail one', hidden: true },
        h('div', { class: 'fgroup' },
          sRow('Account', accountInput),
          sRow('Set aside for', field(sCol('Set aside for', 'target', 'select', { opts: targetOpts }), c)),
          sRow('Note', field(sCol('Note (if something else)', 'label', 'text', { ph: 'e.g. Holiday fund' }), c)),
          h('label', { class: 'frow' }, amountLabel, amountInput)
        ),
        h('button', { class: 'btn danger full', type: 'button', onclick: () => {
          if (!confirm('Delete this line? This cannot be undone.')) return;
          state.commitments = state.commitments.filter(row => row !== c);
          item.remove();
          commit();
        } }, 'Delete this line'));
      expandable(item, header, detail);
      item._check = () => {
        if (!comMatch(c)) item.remove();
      };
      return item;
    }

    /**
     * Render the account summary tile and list editor.
     */
    function accountsTile() {
      const { list, empty } = itemList('accounts', accMatch, accItem, 'No accounts for this selection. Add one below.');
      const add = () => {
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
        markDirty();

        const item = accItem(account);
        list.append(item);
        item._open(true);
        commit();

        const firstField = $('input', item);
        if (firstField) firstField.focus();
      };
      return tile(
        12,
        {},
        h('h2', {}, 'Account balances'),
        h('p', { class: 'sub' }, 'Tap an account to see and edit everything. Liabilities are bills due soon. Set aside is money already promised, listed in the next section.'),
        h('div', { class: 'li-wrap' }, list, empty),
        totalsEl(() => {
          const accounts = visAcc()
            .map(account => D().accounts[account.id])
            .filter(Boolean);
          return [
            ['Balance (NZD)', money(sum(accounts, 'bal'))],
            ['After liabilities', money(sum(accounts, 'net'))],
            ['Set aside (NZD)', money(sum(accounts, 'committed'))],
            ['Free to use', money(sum(accounts, 'free'))]
          ];
        }),
        h('button', { class: 'add', type: 'button', onclick: add }, 'Add account')
      );
    }
    /**
     * Render the set-aside commitments tile and editor.
     */
    function setAsideTile() {
      const { list, empty } = itemList('commitments', comMatch, comItem, 'Nothing set aside for this selection yet. Add a line below.');
      const add = () => {
        const visibleAccounts = visAcc();
        const filter = accFilter();
        const commitment = {
          id: uid(),
          account: filter !== 'all' && visibleAccounts.length ? visibleAccounts[0].id : '',
          target: 'other',
          label: '',
          amount: ''
        };
        state.commitments.push(commitment);
        markDirty();

        const item = comItem(commitment);
        list.append(item);
        item._open(true);
        commit();

        const firstField = $('select,input', item);
        if (firstField) firstField.focus();
      };
      return tile(
        12,
        {},
        h('h2', {}, 'Money set aside'),
        h('p', { class: 'sub' }, 'Each amount uses its selected account currency. The combined total is shown in NZD. Tap a line to edit it.'),
        h('div', { class: 'li-wrap' }, list, empty),
        totalsEl(() => {
          const commitments = state.commitments.filter(comMatch);
          const totalInNZD = sum(
            commitments,
            commitment => num(commitment.amount) * rate(accountCurrency(commitment.account))
          );
          return [
            ['Total set aside (NZD)', money(totalInNZD)],
            ['Lines', String(commitments.length)]
          ];
        }),
        h('button', { class: 'add', type: 'button', onclick: add }, 'Add a line')
      );
    }

    /**
     * Assemble the full accounts dashboard view.
     *
     * This is the root render function for the page and is responsible for:
     * - showing the summary KPIs for the selected user subset,
     * - rendering the filter controls,
     * - exposing the exchange-rate editing UI,
     * - composing the account and set-aside tiles.
     */
    const accountsView = () => {
      const selectedFilter = accFilter();
      const el = h('div', {}, head(
        'Accounts',
        'Balances stay in each account\u2019s own currency and are converted to NZD with the rates below. Use the filter to look at one person at a time.'
      ));
      const countAccounts = userId => state.accounts.filter(account => {
        if (userId === 'all') return true;
        if (userId === 'none') return !account.user;
        return account.user === userId;
      }).length;
      const filterItems = [
        ['all', 'All', countAccounts('all')],
        ...state.users.map(user => [
          user.id,
          user.name || '(unnamed)',
          countAccounts(user.id)
        ])
      ];
      if (countAccounts('none')) {
        filterItems.push(['none', 'No user', countAccounts('none')]);
      }
      const fxInput = (key, label) => {
        const input = h('input', {
          type: 'number',
          step: 'any',
          value: state.fx[key],
          'aria-label': label
        });
        input.addEventListener('input', () => {
          state.fx[key] = input.value === '' ? 0 : parseFloat(input.value);
          state.fx[key + 'UpdatedAt'] = null;
          exchangeRates.setStatus(`Using the manually entered ${key === 'php' ? 'PHP/NZD' : 'USD/NZD'} rate.`);
          commit();
        });
        return h('label', {}, label, input);
      };
      const filter = seg(
        filterItems,
        selectedFilter,
        userId => {
          state.ui.accUser = userId;
          save();
          render();
        },
        'Filter by user'
      );
      const exchangeRateControls = h(
        'div',
        { class: 'fx' },
        fxInput('php', 'PHP per 1 NZD'),
        fxInput('usd', 'NZD per 1 USD'),
        h('button', {
          id: 'fx-refresh',
          class: 'btn plain',
          type: 'button',
          onclick: () => refreshExchangeRates()
        }, 'Refresh exchange rates'),
        h('span', {
          id: 'fx-status',
          class: 'fx-status',
          role: 'status',
          'aria-live': 'polite'
        }, exchangeRates.statusText),
        h('span', { class: 'fx-status' }, 'Rates are the provider’s latest published values (typically updated daily), not streaming market quotes.')
      );
      el.append(h('div', { class: 'toolbar' }, filter, exchangeRateControls));

      const selectedTotal = key => () => {
        const accounts = visAcc()
          .map(account => D().accounts[account.id])
          .filter(Boolean);
        return money(sum(accounts, key), 0);
      };
      el.append(bento(
        kpiTile('Balance (NZD)', selectedTotal('bal'), 'all selected accounts'),
        kpiTile('After liabilities', selectedTotal('net'), 'balance less bills due'),
        kpiTile('Set aside', selectedTotal('committed'), 'promised to something'),
        kpiTile('Free to use', selectedTotal('free'), 'after liabilities and set aside'),
        accountsTile(), setAsideTile()));
      return el;
    };
    return { render: accountsView };
  };
})();
