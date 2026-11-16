(() => {
  'use strict';

  /**
   * Shared UI primitives for the app shell and page sections.
   *
   * Provides small wrappers for cards, headers, KPI tiles, segmented controls,
   * and calculation-backed elements that automatically re-render when data changes.
   */
  const ICONS = {
    dashboard: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
    plan: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    accounts: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h3"/>',
    transactions: '<path d="M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.3.1 3.9 1.6 4.5 4.3"/>'
  };

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
