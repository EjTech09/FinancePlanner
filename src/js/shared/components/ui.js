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
    const calcEl = fn => {
      const element = h('span', { class: 'calc', 'data-calc': '' });
      element._u = () => {
        const result = fn();
        if (result && typeof result === 'object') {
          if (result.html != null) element.innerHTML = result.html;
          else element.textContent = result.t;
          element.className = 'calc ' + (result.cls || '');
        } else {
          element.textContent = result ?? '';
          element.className = 'calc';
        }
      };
      element._u();
      return element;
    };
    const icon = name => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
    const tile = (span, attrs, ...kids) => {
      const attributes = Object.assign({}, attrs);
      attributes.class = 'tile s-' + span + (attributes.class ? ' ' + attributes.class : '');
      return h('section', attributes, ...kids);
    };
    const head = (title, subtitle) => h(
      'header',
      { class: 'page-head' },
      h('h1', {}, title),
      subtitle ? h('p', { class: 'sub' }, subtitle) : null
    );
    const bento = (...children) => h('div', { class: 'bento' }, ...children);
    const seg = (items, value, onPick, label) => h(
      'div',
      { class: 'seg', role: 'group', 'aria-label': label },
      items.map(([itemValue, text, count]) => h(
        'button',
        {
          class: 'seg-b',
          type: 'button',
          'aria-pressed': String(itemValue === value),
          onclick: () => onPick(itemValue)
        },
        text,
        count != null ? h('span', { class: 'n' }, String(count)) : null
      ))
    );
    const kpiTile = (label, value, caption, span = 3) => tile(
      span,
      { class: 'kpi' },
      h('div', { class: 'k-label' }, label),
      h('div', { class: 'k-val' }, calcEl(value)),
      caption
        ? h('div', { class: 'k-cap' }, typeof caption === 'function' ? calcEl(caption) : caption)
        : null
    );

    return Object.freeze({ calcEl, icon, tile, head, bento, seg, kpiTile });
  }

  window.HouseholdPlannerUI = Object.freeze({ create: createUI });
})();
