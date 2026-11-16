(() => {
  'use strict';

  /**
   * Data-management screen.
   *
   * Lets the user manage people, review the app's saved data, import/export JSON,
   * clear local state, and switch the overall appearance theme.
   */
  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.data = context => {
    const { state, persistence, h, head, tableView, tile, themeSeg, bento, startImport, replaceState, setLegacy, markDirty, save, render } = context;
    const dataView = () => {
      const storageMessage = persistence.available
        ? 'Everything you type is saved in this browser on this device. Nothing is sent anywhere.'
        : 'Saving is switched off in this view. Open the file directly in your browser to keep your changes.';
      const el = h('div', {}, head('People and data', storageMessage));
      const exportJson = () => {
        const data = new Blob([JSON.stringify(state, null, 2)], {
          type: 'application/json'
        });
        const link = h('a', {
          href: URL.createObjectURL(data),
          download: 'household-planner-data.json'
        });
        document.body.append(link);
        link.click();
        link.remove();
      };
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
      const clearData = () => {
        if (!confirm('Delete all data on this device? Export a copy first if you want to keep it.')) {
          return;
        }
        replaceState(persistence.blank());
        setLegacy(false);
        state.ui.tab = 'data';
        markDirty();
        save();
        render();
      };
      const dataTile = tile(
        12,
        {},
        h('h2', {}, 'Your data'),
        h('p', { class: 'sub' }, 'Export a copy to back up or move to another device. Importing replaces what is here now.'),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn', type: 'button', onclick: exportJson }, 'Export JSON'),
          h('button', { class: 'btn plain', type: 'button', onclick: startImport }, 'Import JSON'),
          h('button', { class: 'btn danger', type: 'button', onclick: clearData }, 'Clear everything')
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
