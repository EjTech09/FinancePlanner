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
    const { state, h, head, tableView, tile, themeSeg, bento, startImport } = context;

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
        h('div', { style: 'margin-top:16px' }, themeSeg())
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
        categoriesTile,
        appearanceTile,
        dataTile
      ));
      return el;
    };
    return dataView;
  };
})();
