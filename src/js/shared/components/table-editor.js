(() => {
  'use strict';

  /**
   * Reusable table editor component.
   *
   * Produces list/table UIs for data collections with delete controls, detail
   * toggles, and consistent option-population behavior across the app.
   */
  function createTableEditor({
    $,
    $$,
    h,
    calcEl,
    field,
    commit,
    detach,
    uid,
    getState,
    markDirty,
    tile
  }) {
    function fillOptions(select) {
      const row = select._row;
      const key = select._key;
      const currentValue = row[key] ?? '';
      select.innerHTML = '';
      const makeOption = option => h('option', { value: option.v }, option.t);

      for (const option of select._opts()) {
        if (option.g) {
          if (option.items.length) {
            select.append(h('optgroup', { label: option.g }, option.items.map(makeOption)));
          }
        } else {
          select.append(makeOption(option));
        }
      }

      select.value = currentValue;
      if (select.value !== currentValue) select.selectedIndex = 0;
    }

    const chevron = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

    function setOpen(row, isOpen) {
      row.classList.toggle('open', isOpen);
      const button = $('.chev', row);
      if (button) {
        button.setAttribute('aria-expanded', String(isOpen));
        button.setAttribute('aria-label', isOpen ? 'Hide details' : 'Show details');
      }
    }

    function tableView(options) {
      const state = getState();
      const role = column => (options.roles && options.roles[column.label]) || 'd';
      const tbody = h('tbody');
      const addRow = data => {
        const tableRow = h('tr', options.compact ? { class: 'compact' } : {});
        for (const column of options.cols) {
          const cell = h('td', {
            class: column.num || column.type === 'number' ? 'num' : '',
            'data-label': column.label,
            'data-m': role(column)
          });
          cell.append(column.calc ? calcEl(() => column.calc(data)) : field(column, data));
          tableRow.append(cell);
        }
        const detailsButton = h('button', {
          class: 'chev',
          type: 'button',
          'aria-expanded': 'false',
          'aria-label': 'Show details',
          onclick: () => setOpen(tableRow, !tableRow.classList.contains('open'))
        });
        detailsButton.innerHTML = chevron;
        tableRow.append(h('td', { class: 'exp' }, detailsButton));

        const deleteButton = h('button', {
          class: 'x',
          type: 'button',
          'aria-label': 'Delete this row',
          onclick: () => {
            if (!confirm('Delete this row? This cannot be undone.')) return;
            const currentState = getState();
            currentState[options.coll] = currentState[options.coll]
              .filter(item => item !== data);
            detach(options.coll, data.id);
            tableRow.remove();
            commit();
          }
        }, h('span', { class: 'xi' }, '\u00d7'), h('span', { class: 'xt' }, 'Delete this row'));
        tableRow.append(h('td', { class: 'act' }, deleteButton));

        if (options.filter) {
          tableRow._check = () => {
            if (!options.filter(data)) tableRow.remove();
          };
        }

        tbody.append(tableRow);
        return tableRow;
      };
      state[options.coll].filter(options.filter || (() => true)).forEach(addRow);

      const headerRow = h(
        'tr',
        {},
        options.cols.map(column => h('th', {
          class: column.num || column.type === 'number' ? 'num' : ''
        }, column.label)),
        h('th', {}, h('span', { style: 'position:absolute;left:-9999px' }, 'Delete'))
      );
      const table = h('table', {}, h('thead', {}, headerRow), tbody);
      if (options.cols.some(column => column.total)) {
        const totalCells = options.cols.map((column, index) => {
          const isNumeric = column.num || column.type === 'number';
          const isLabel = !column.total && index === 0;
          const cellClass = (isNumeric ? 'num' : '') + (isLabel ? ' tl' : '');
          const label = column.total ? column.label : false;
          const content = column.total
            ? calcEl(column.total)
            : index === 0 ? 'Total' : '';

          return h('td', { class: cellClass, 'data-label': label }, content);
        });
        table.append(h('tfoot', {}, h('tr', {}, totalCells, h('td'))));
      }

      const addButton = h('button', {
        class: 'add',
        type: 'button',
        onclick: () => {
          const currentState = getState();
          const row = Object.assign({ id: uid() }, options.blank());
          currentState[options.coll].push(row);
          markDirty();

          const tableRow = addRow(row);
          setOpen(tableRow, true);
          if (toggleButton) toggleButton.hidden = false;
          commit();

          const firstField = $('input,select', tableRow);
          if (firstField) firstField.focus();
        }
      }, options.addLabel);
      const hasDetailColumns = options.cols.some(column => role(column) === 'd');
      const toggleButton = hasDetailColumns ? h('button', {
        class: 'm-toggle',
        type: 'button',
        onclick: () => {
          const rows = $$('tbody tr', table);
          const allOpen = rows.length > 0 && rows.every(row => row.classList.contains('open'));
          rows.forEach(row => setOpen(row, !allOpen));
          toggleButton.textContent = allOpen ? 'Show all details' : 'Hide details';
        }
      }, 'Show all details') : null;

      if (toggleButton && !getState()[options.coll].filter(options.filter || (() => true)).length) {
        toggleButton.hidden = true;
      }

      const sheet = h('div', { class: 'sheet scroll' }, table);
      if (options.bare) return h('div', {}, toggleButton, sheet, addButton);

      return tile(
        options.span || 12,
        {},
        h('h2', {}, options.title),
        options.note ? h('p', { class: 'sub' }, options.note) : null,
        toggleButton,
        sheet,
        addButton
      );
    }

    return Object.freeze({ fillOptions, tableView });
  }

  window.HouseholdPlannerTableEditor = Object.freeze({ create: createTableEditor });
})();
