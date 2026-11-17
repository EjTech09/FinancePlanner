(() => {
  'use strict';

  /**
   * Reusable table editor component.
   *
   * Produces list/table UIs for data collections with delete controls, detail
   * toggles, and consistent option-population behavior across the app.
   */
  function createTableEditor({
    $: querySelector,
    $$: querySelectorAll,
    h: createElement,
    calcEl: createCalculatedElement,
    field: createField,
    commit,
    detach: detachReferences,
    uid: generateUniqueId,
    getState,
    markDirty,
    tile: createTile
  }) {
    function fillOptions(selectElement) {
      const record = selectElement._row;
      const propertyName = selectElement._key;
      const currentValue = record[propertyName] ?? '';
      selectElement.innerHTML = '';
      const createOptionElement = optionDefinition =>
        createElement('option', { value: optionDefinition.v }, optionDefinition.t);

      for (const optionDefinition of selectElement._opts()) {
        if (optionDefinition.g) {
          if (optionDefinition.items.length) {
            selectElement.append(createElement(
              'optgroup',
              { label: optionDefinition.g },
              optionDefinition.items.map(createOptionElement)
            ));
          }
        } else {
          selectElement.append(createOptionElement(optionDefinition));
        }
      }

      selectElement.value = currentValue;
      if (selectElement.value !== currentValue) selectElement.selectedIndex = 0;
    }

    const DETAILS_CHEVRON_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

    function setOpen(tableRow, shouldOpen) {
      tableRow.classList.toggle('open', shouldOpen);
      const detailsButton = querySelector('.chev', tableRow);
      if (detailsButton) {
        detailsButton.setAttribute('aria-expanded', String(shouldOpen));
        detailsButton.setAttribute('aria-label', shouldOpen ? 'Hide details' : 'Show details');
      }
    }

    function tableView(tableConfig) {
      const currentState = getState();
      const getColumnRole = columnConfig =>
        (tableConfig.roles && tableConfig.roles[columnConfig.label]) || 'd';
      const tableBody = createElement('tbody');
      const appendRow = rowRecord => {
        const tableRow = createElement('tr', tableConfig.compact ? { class: 'compact' } : {});
        for (const columnConfig of tableConfig.cols) {
          const tableCell = createElement('td', {
            class: columnConfig.num || columnConfig.type === 'number' ? 'num' : '',
            'data-label': columnConfig.label,
            'data-m': getColumnRole(columnConfig)
          });
          tableCell.append(
            columnConfig.calc
              ? createCalculatedElement(() => columnConfig.calc(rowRecord))
              : createField(columnConfig, rowRecord)
          );
          tableRow.append(tableCell);
        }
        const detailsButton = createElement('button', {
          class: 'chev',
          type: 'button',
          'aria-expanded': 'false',
          'aria-label': 'Show details',
          onclick: () => setOpen(tableRow, !tableRow.classList.contains('open'))
        });
        detailsButton.innerHTML = DETAILS_CHEVRON_SVG;
        tableRow.append(createElement('td', { class: 'exp' }, detailsButton));

        const deleteButton = createElement('button', {
          class: 'x',
          type: 'button',
          'aria-label': 'Delete this row',
          onclick: () => {
            if (!confirm('Delete this row? This cannot be undone.')) return;
            const latestState = getState();
            latestState[tableConfig.coll] = latestState[tableConfig.coll]
              .filter(record => record !== rowRecord);
            detachReferences(tableConfig.coll, rowRecord.id);
            tableRow.remove();
            commit();
          }
        }, createElement('span', { class: 'xi' }, '\u00d7'), createElement('span', { class: 'xt' }, 'Delete this row'));
        tableRow.append(createElement('td', { class: 'act' }, deleteButton));

        if (tableConfig.filter) {
          tableRow._check = () => {
            if (!tableConfig.filter(rowRecord)) tableRow.remove();
          };
        }

        tableBody.append(tableRow);
        return tableRow;
      };
      currentState[tableConfig.coll]
        .filter(tableConfig.filter || (() => true))
        .forEach(appendRow);

      const headerRow = createElement(
        'tr',
        {},
        tableConfig.cols.map(columnConfig => createElement('th', {
          class: columnConfig.num || columnConfig.type === 'number' ? 'num' : ''
        }, columnConfig.label)),
        createElement('th', {}, createElement('span', { style: 'position:absolute;left:-9999px' }, 'Delete'))
      );
      const tableElement = createElement('table', {}, createElement('thead', {}, headerRow), tableBody);
      if (tableConfig.cols.some(columnConfig => columnConfig.total)) {
        const totalCells = tableConfig.cols.map((columnConfig, columnIndex) => {
          const isNumericColumn = columnConfig.num || columnConfig.type === 'number';
          const isFirstColumnLabel = !columnConfig.total && columnIndex === 0;
          const cellClass = (isNumericColumn ? 'num' : '') + (isFirstColumnLabel ? ' tl' : '');
          const totalLabel = columnConfig.total ? columnConfig.label : false;
          const cellContent = columnConfig.total
            ? createCalculatedElement(columnConfig.total)
            : columnIndex === 0 ? 'Total' : '';

          return createElement('td', { class: cellClass, 'data-label': totalLabel }, cellContent);
        });
        tableElement.append(createElement(
          'tfoot',
          {},
          createElement('tr', {}, totalCells, createElement('td'))
        ));
      }

      const addButton = createElement('button', {
        class: 'add',
        type: 'button',
        onclick: () => {
          const latestState = getState();
          const newRecord = Object.assign({ id: generateUniqueId() }, tableConfig.blank());
          latestState[tableConfig.coll].push(newRecord);
          markDirty();

          const tableRow = appendRow(newRecord);
          setOpen(tableRow, true);
          if (detailsToggleButton) detailsToggleButton.hidden = false;
          commit();

          const firstField = querySelector('input,select', tableRow);
          if (firstField) firstField.focus();
        }
      }, tableConfig.addLabel);
      const hasDetailColumns = tableConfig.cols.some(columnConfig => getColumnRole(columnConfig) === 'd');
      const detailsToggleButton = hasDetailColumns ? createElement('button', {
        class: 'm-toggle',
        type: 'button',
        onclick: () => {
          const tableRows = querySelectorAll('tbody tr', tableElement);
          const allRowsOpen = tableRows.length > 0 &&
            tableRows.every(tableRow => tableRow.classList.contains('open'));
          tableRows.forEach(tableRow => setOpen(tableRow, !allRowsOpen));
          detailsToggleButton.textContent = allRowsOpen ? 'Show all details' : 'Hide details';
        }
      }, 'Show all details') : null;

      if (
        detailsToggleButton &&
        !getState()[tableConfig.coll].filter(tableConfig.filter || (() => true)).length
      ) {
        detailsToggleButton.hidden = true;
      }

      const tableSheet = createElement('div', { class: 'sheet scroll' }, tableElement);
      if (tableConfig.bare) {
        return createElement('div', {}, detailsToggleButton, tableSheet, addButton);
      }

      return createTile(
        tableConfig.span || 12,
        {},
        createElement('h2', {}, tableConfig.title),
        tableConfig.note ? createElement('p', { class: 'sub' }, tableConfig.note) : null,
        detailsToggleButton,
        tableSheet,
        addButton
      );
    }

    return Object.freeze({ fillOptions, tableView });
  }

  window.HouseholdPlannerTableEditor = Object.freeze({ create: createTableEditor });
})();
