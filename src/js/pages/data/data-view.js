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
    const { h, head, tableView, tile, themeSeg, bento, startImport } = context;

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
        blank: () => ({ name: '', type: 'Individual' }),
        cols: [
          { label: 'Name', key: 'name', type: 'text' },
          {
            label: 'Type',
            key: 'type',
            type: 'select',
            opts: () => [
              { v: 'Individual', t: 'Individual' },
              { v: 'Joint', t: 'Joint' }
            ]
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
        appearanceTile,
        dataTile
      ));
      return el;
    };
    return dataView;
  };
})();
