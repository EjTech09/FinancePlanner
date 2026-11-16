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
  window.HouseholdPlannerPages.accountsView = (context, service) => {
    const DOMAIN = window.HouseholdPlannerConstants.domain;
    const ACCOUNT_CONSTANTS = window.HouseholdPlannerConstants.accounts;
    const COMMITMENT_KIND = ACCOUNT_CONSTANTS.COMMITMENT_KIND;
    const { MONEY_EPSILON } = DOMAIN;
    const { state, D, h, $, money, moneyCur, num, sum, esc, rate, accountCurrency, nameOf, cls, userOpts, accOpts, targetOpts, curOpts, sRow, sCalc, sCol, field, seg, bento, tile, head, kpiTile, txIcon, liv, itemList, expandable, totalsEl } = context;

    /* ---------- Shared-state reads and derived values ---------- */
    /**
     * Resolve the active account filter.
     *
     * The UI supports "all accounts", "accounts without a user", or a single user.
     * Invalid stored filters are safely reset back to "all".
     */
    /**
     * Build a single account row/card and its detail editor.
     *
     * The account card shows summary metrics and a compact editor for balance,
     * liabilities, and user/currency metadata.
     */
    function accItem(account, actions) {
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
            return `<span class="${free < -MONEY_EPSILON ? 'bad' : ''}">${money(free)}</span>`;
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
            onChange: (oldCurrency, newCurrency) =>
              service.convertAccountCommitments(account.id, oldCurrency, newCurrency)
          }), account)),
          sRow('Opening balance', field(sCol('Opening balance', 'balance', 'number'), account)),
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
          actions.deleteAccount(account);
        } }, 'Delete account'));
      expandable(item, header, detail);
      item._check = () => {
        if (!service.accMatch(account)) item.remove();
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
    function comItem(c, actions) {
      const kind = () => {
        if ((c.target || '').startsWith(COMMITMENT_KIND.DEBT_PREFIX)) return COMMITMENT_KIND.DEBT;
        if ((c.target || '').startsWith(COMMITMENT_KIND.GOAL_PREFIX)) return COMMITMENT_KIND.GOAL;
        return COMMITMENT_KIND.OTHER;
      };
      const what = () => {
        if (kind() === COMMITMENT_KIND.DEBT) {
          return nameOf('debts', c.target.slice(COMMITMENT_KIND.DEBT_PREFIX.length)) || 'Unknown debt';
        }
        if (kind() === COMMITMENT_KIND.GOAL) {
          return nameOf('goals', c.target.slice(COMMITMENT_KIND.GOAL_PREFIX.length)) || 'Unknown goal';
        }
        return c.label || 'Something else';
      };
      const kindLabels = ACCOUNT_CONSTANTS.COMMITMENT_KIND_LABELS;
      const item = h('div', { class: 'acc-item', 'data-id': c.id });
      const accountInput = field(sCol('Account', 'account', 'select', {
        opts: accOpts,
        onChange: (oldAccountId, newAccountId) =>
          service.convertCommitmentForAccount(c, oldAccountId, newAccountId)
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
        liv(() => txIcon(
          kind() === COMMITMENT_KIND.OTHER
            ? window.HouseholdPlannerConstants.transactions.TYPE.TRANSFER
            : kind()
        ), 'span', 'li-ic'),
        h('span', { class: 'tx-main' },
          liv(() => esc(what()), 'b'),
          liv(() => 'From ' + esc(nameOf('accounts', c.account) || 'no account'), 'small'),
          liv(() => `<span class="pill neu">${kindLabels[kind()]}</span>`, 'span')
        ),
        h('span', { class: 'tx-amt' },
          liv(() => moneyCur(
            (D().commitments[c.id] || {}).amount ?? num(c.amount),
            accountCurrency(c.account)
          ), 'b'),
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
          actions.deleteCommitment(c, item);
        } }, 'Delete this line'));
      expandable(item, header, detail);
      item._check = () => {
        if (!service.comMatch(c)) item.remove();
      };
      return item;
    }

    /**
     * Render the account summary tile and list editor.
     */
    function accountsTile(actions) {
      const { list, empty } = itemList('accounts', service.accMatch, account => accItem(account, actions), 'No accounts for this selection. Add one below.');
      return tile(
        12,
        {},
        h('h2', {}, 'Account balances'),
        h('p', { class: 'sub' }, 'Tap an account to see and edit everything. Opening balances are adjusted by transactions. Liabilities are bills due soon. Set aside is money already promised, listed in the next section.'),
        h('div', { class: 'li-wrap' }, list, empty),
        totalsEl(() => {
          const accounts = service.visibleAccounts()
            .map(account => D().accounts[account.id])
            .filter(Boolean);
          return [
            ['Balance (NZD)', money(sum(accounts, 'bal'))],
            ['After liabilities', money(sum(accounts, 'net'))],
            ['Set aside (NZD)', money(sum(accounts, 'committed'))],
            ['Free to use', money(sum(accounts, 'free'))]
          ];
        }),
        h('button', { class: 'add', type: 'button', onclick: () => actions.addAccount(list) }, 'Add account')
      );
    }
    /**
     * Render the set-aside commitments tile and editor.
     */
    function setAsideTile(actions) {
      const { list, empty } = itemList('commitments', service.comMatch, commitment => comItem(commitment, actions), 'Nothing set aside for this selection yet. Add a line below.');
      return tile(
        12,
        {},
        h('h2', {}, 'Money set aside'),
        h('p', { class: 'sub' }, 'Each amount uses its selected account currency. The combined total is shown in NZD. Tap a line to edit it.'),
        h('div', { class: 'li-wrap' }, list, empty),
        totalsEl(() => {
          const commitments = state.commitments.filter(service.comMatch);
          const totalInNZD = sum(commitments, commitment =>
            ((D().commitments[commitment.id] || {}).amount ?? num(commitment.amount)) *
            rate(accountCurrency(commitment.account))
          );
          return [
            ['Total set aside (NZD)', money(totalInNZD)],
            ['Lines', String(commitments.length)]
          ];
        }),
        h('button', { class: 'add', type: 'button', onclick: () => actions.addCommitment(list) }, 'Add a line')
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
    const accountsView = actions => {
      const selectedFilter = service.accFilter();
      const el = h('div', {}, head(
        'Accounts',
        'Balances include transaction activity and are converted to NZD with the rates below. Opening balances are the starting point. Use the filter to look at one person at a time.'
      ));
      const countAccounts = userId => state.accounts.filter(account => {
        if (userId === DOMAIN.FILTER_ALL) return true;
        if (userId === DOMAIN.FILTER_NONE) return !account.user;
        return account.user === userId;
      }).length;
      const filterItems = [
        [DOMAIN.FILTER_ALL, 'All', countAccounts(DOMAIN.FILTER_ALL)],
        ...state.users.map(user => [
          user.id,
          user.name || '(unnamed)',
          countAccounts(user.id)
        ])
      ];
      if (countAccounts(DOMAIN.FILTER_NONE)) {
        filterItems.push([DOMAIN.FILTER_NONE, 'No user', countAccounts(DOMAIN.FILTER_NONE)]);
      }
      const filter = seg(
        filterItems,
        selectedFilter,
        actions.setAccountFilter,
        'Filter by user'
      );
      el.append(h('div', { class: 'toolbar' }, filter));

      const selectedTotal = key => () => {
        const accounts = service.visibleAccounts()
          .map(account => D().accounts[account.id])
          .filter(Boolean);
        return money(sum(accounts, key), 0);
      };
      el.append(bento(
        kpiTile('Balance (NZD)', selectedTotal('bal'), 'all selected accounts'),
        kpiTile('After liabilities', selectedTotal('net'), 'balance less bills due'),
        kpiTile('Set aside', selectedTotal('committed'), 'promised to something'),
        kpiTile('Free to use', selectedTotal('free'), 'after liabilities and set aside'),
        accountsTile(actions), setAsideTile(actions)));
      return el;
    };
    return {
      render: accountsView,
      accountItem: accItem,
      commitmentItem: comItem
    };
  };
})();
