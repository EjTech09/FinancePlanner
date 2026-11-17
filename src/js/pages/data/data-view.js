(() => {
  'use strict';

  /**
   * Data-management screen.
   *
   * Lets the user manage people, review the app's saved data, import/export JSON,
   * clear local state, and switch the overall appearance theme.
   */
  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.dataView = (context, service) => {
    const DATA_CONSTANTS = window.HouseholdPlannerConstants.data;
    const {
      state, h, head, tableView, tile, themeSegmentedControl, bento, startImport, exchangeRates
    } = context;

    const dataView = actions => {
      const el = h('div', {}, head('People and data', service.storageMessage()));
      const peopleTable = tableView({
        title: 'People',
        note: 'Everyone who owns accounts, debts, goals or expenses. These names fill the User dropdowns.',
        compact: true,
        roles: { 'Name': 't', 'Type': 'k' },
        coll: 'users',
        addLabel: 'Add person',
        span: 7,
        blank: () => ({ name: '', type: DATA_CONSTANTS.DEFAULT_PERSON_TYPE }),
        cols: [
          { label: 'Name', key: 'name', type: 'text' },
          {
            label: 'Type',
            key: 'type',
            type: 'select',
            opts: () => DATA_CONSTANTS.PERSON_TYPES.map(([value, label]) => ({
              v: value,
              t: label
            }))
          }
        ]
      });
      const appearanceTile = tile(
        5,
        {},
        h('h2', {}, 'Appearance'),
        h('p', { class: 'sub' }, 'Auto follows your device. Light and Dark stay as you set them.'),
        h('div', { style: 'margin-top:16px' }, themeSegmentedControl())
      );
      const categoryInput = h('input', {
        type: 'text',
        placeholder: 'e.g. Childcare',
        'aria-label': 'New transaction category'
      });
      const categoryList = h('div', { class: 'li-wrap tx-card' },
        state.transactionCategories.length
          ? state.transactionCategories.map(category => h(
            'div',
            { class: 'frow' },
            h('span', { class: 'fl' }, category.name),
            h('button', {
              class: 'btn danger',
              type: 'button',
              onclick: () => actions.removeTransactionCategory(category)
            }, 'Remove')
          ))
          : h('p', { class: 'empty' }, 'No transaction categories yet.')
      );
      const categoriesTile = tile(
        7,
        {},
        h('h2', {}, 'Transaction categories'),
        h('p', { class: 'sub' }, 'Manage the categories available on each transaction. Removing a category leaves existing transactions uncategorized.'),
        h('div', { class: 'frow' }, categoryInput, h('button', {
          class: 'btn',
          type: 'button',
          onclick: () => {
            if (actions.addTransactionCategory(categoryInput.value)) categoryInput.value = '';
          }
        }, 'Add category')),
        categoryList
      );
      const exchangeRateCode = h('input', {
        type: 'text',
        maxlength: '3',
        placeholder: 'e.g. JPY',
        'aria-label': 'New currency code',
        autocomplete: 'off'
      });
      const exchangeRateValue = h('input', {
        type: 'number',
        min: '0',
        step: 'any',
        placeholder: 'e.g. 0.009',
        'aria-label': 'NZD per 1 new currency'
      });
      const exchangeRateList = h(
        'div',
        { class: 'fx-list' },
        Object.keys(state.fx.rates).map(currency => {
          const input = h('input', {
            type: 'number',
            min: '0',
            step: 'any',
            value: state.fx.rates[currency],
            'aria-label': `NZD per 1 ${currency}`,
            'data-fx-currency': currency
          });
          input.addEventListener('input', () => actions.updateExchangeRate(currency, input));
          const inUse = service.currencyUsage(currency) > 0;
          return h(
            'div',
            { class: 'fx-row' },
            h('span', { class: 'fx-currency' }, currency),
            h('label', {}, `NZD per 1 ${currency}`, input),
            h('button', {
              class: 'btn danger',
              type: 'button',
              disabled: inUse,
              title: inUse ? 'Reassign every record using this currency first.' : false,
              'aria-label': `Remove ${currency} exchange rate`,
              onclick: () => actions.removeExchangeRate(currency)
            }, 'Remove')
          );
        })
      );
      const rateCodeAndValue = h('div', { class: 'fx-add' },
        h('label', {}, 'Currency code', exchangeRateCode),
        h('label', {}, 'NZD per 1 unit', exchangeRateValue),
        h('button', {
          class: 'btn',
          type: 'button',
          onclick: () => {
            if (actions.addExchangeRate(exchangeRateCode.value, exchangeRateValue.value)) {
              exchangeRateCode.value = '';
              exchangeRateValue.value = '';
            }
          }
        }, 'Add exchange rate')
      );
      const exchangeRatesTile = tile(
        12,
        {},
        h('h2', {}, 'Exchange rates'),
        h('p', { class: 'sub' }, 'NZD is the base currency. Add a three-letter currency code and how many NZD one unit is worth. Rates are used throughout accounts, income, and debts. Reassign existing records before removing a rate.'),
        exchangeRateList,
        rateCodeAndValue,
        h('div', { class: 'fx-actions' },
          h('button', {
            id: 'fx-refresh',
            class: 'btn plain',
            type: 'button',
            onclick: () => actions.refreshExchangeRates()
          }, 'Refresh PHP and USD rates'),
          h('span', {
            id: 'fx-status',
            class: 'fx-status',
            role: 'status',
            'aria-live': 'polite'
          }, exchangeRates.statusText),
          h('span', { class: 'fx-status' }, 'Provider rates are the latest published values (typically updated daily), not streaming market quotes. Other currencies are set manually.')
        )
      );
      const dataTile = tile(
        12,
        {},
        h('h2', {}, 'Your data'),
        h('p', { class: 'sub' }, 'Export a copy to back up or move to another device. Importing replaces what is here now.'),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn', type: 'button', onclick: actions.exportJson }, 'Export JSON'),
          h('button', { class: 'btn plain', type: 'button', onclick: startImport }, 'Import JSON'),
          h('button', { class: 'btn danger', type: 'button', onclick: actions.clearData }, 'Clear everything')
        )
      );
      el.append(bento(
        peopleTable,
        exchangeRatesTile,
        categoriesTile,
        appearanceTile,
        dataTile
      ));
      return el;
    };
    return dataView;
  };
})();
