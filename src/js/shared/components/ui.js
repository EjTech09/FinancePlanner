(() => {
  'use strict';

  /**
   * Shared UI primitives for the app shell and page sections.
   *
   * Provides small wrappers for cards, headers, KPI tiles, segmented controls,
   * and calculation-backed elements that automatically re-render when data changes.
   */
  const ICONS = window.HouseholdPlannerConstants.ui.ICONS;

  function createUI({ h }) {
    const calcEl = calculateValue => {
      const calculationElement = h('span', { class: 'calc', 'data-calc': '' });
      calculationElement._u = () => {
        const result = calculateValue();
        if (result && typeof result === 'object') {
          if (result.html != null) calculationElement.innerHTML = result.html;
          else calculationElement.textContent = result.t;
          calculationElement.className = 'calc ' + (result.cls || '');
        } else {
          calculationElement.textContent = result ?? '';
          calculationElement.className = 'calc';
        }
      };
      calculationElement._u();
      return calculationElement;
    };

    const icon = iconName => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[iconName]}</svg>`;

    const tile = (columnSpan, attributes, ...children) => {
      const tileAttributes = Object.assign({}, attributes);
      tileAttributes.class = 'tile s-' + columnSpan + (tileAttributes.class ? ' ' + tileAttributes.class : '');
      return h('section', tileAttributes, ...children);
    };

    const head = (pageTitle, subtitle) => h(
      'header',
      { class: 'page-head' },
      h('h1', {}, pageTitle),
      subtitle ? h('p', { class: 'sub' }, subtitle) : null
    );


    const bento = (...children) => h('div', { class: 'bento' }, ...children);

    const segmentedControl = (options, selectedValue, onSelect, accessibleLabel) => h(
      'div',
      { class: 'seg', role: 'group', 'aria-label': accessibleLabel },
      options.map(([optionValue, optionLabel, optionCount]) => h(
        'button',
        {
          class: 'seg-b',
          type: 'button',
          'aria-pressed': String(optionValue === selectedValue),
          onclick: () => onSelect(optionValue)
        },
        optionLabel,
        optionCount != null ? h('span', { class: 'n' }, String(optionCount)) : null
      ))
    );
    const kpiTile = (kpiLabel, calculateValue, caption, columnSpan = 3) => tile(
      columnSpan,
      { class: 'kpi' },
      h('div', { class: 'k-label' }, kpiLabel),
      h('div', { class: 'k-val' }, calcEl(calculateValue)),
      caption
        ? h('div', { class: 'k-cap' }, typeof caption === 'function' ? calcEl(caption) : caption)
        : null
    );

    return Object.freeze({ calcEl, icon, tile, head, bento, segmentedControl, kpiTile });
  }

  window.HouseholdPlannerUI = Object.freeze({ create: createUI });
})();
