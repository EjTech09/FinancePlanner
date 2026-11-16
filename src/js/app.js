const {
  num,
  sum,
  currencyRate,
  compute
} = window.HouseholdPlannerModel;
const {
  uid,
  $,
  $$,
  money,
  moneyCur,
  esc,
  fmtDate,
  h
} = window.HouseholdPlannerDom;

(() => {
'use strict';
const APP_CONSTANTS = window.HouseholdPlannerConstants.app;
const DOMAIN_CONSTANTS = window.HouseholdPlannerConstants.domain;

/**
 * App bootstrap and state coordinator.
 *
 * This module creates the persisted app state, manages the current tab, exposes
 * shared calculations and helpers, and renders the selected page. Page-specific
 * logic lives in the HouseholdPlannerPages registry, while the rest of the app
 * provides reusable UI/table/data helpers.
 */
const persistence = window.HouseholdPlannerPersistence.create();
let theme = persistence.loadTheme(APP_CONSTANTS.THEME_STORAGE_KEY);
const {
  calcEl,
  icon,
  tile,
  head,
  bento,
  seg,
  kpiTile
} = window.HouseholdPlannerUI.create({ h });

function applyTheme() {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

function setTheme(nextTheme) {
  theme = nextTheme;
  persistence.saveTheme(APP_CONSTANTS.THEME_STORAGE_KEY, nextTheme);
  applyTheme();
  render();
}

applyTheme();

const loadedState = persistence.load(APP_CONSTANTS.STORAGE_KEY, hasData);
let state = loadedState.state;
let legacy = loadedState.legacy;
function save() {
  if (!persistence.available) return;
  state.ui.build = 3;
  persistence.save(APP_CONSTANTS.STORAGE_KEY, state, renderNav);
}

/* ---------- calculations ---------- */
const today = new Date();
const asOf = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const rate = currency => currencyRate(currency, state.fx);
const accountCurrency = accountId =>
  (state.accounts.find(account => account.id === accountId) || {}).currency ||
  DOMAIN_CONSTANTS.DEFAULT_CURRENCY;
const exchangeRates = window.HouseholdPlannerExchangeRates.create({
  getState: () => state,
  commit,
  query: $
});
const refreshExchangeRates = automatic => exchangeRates.refresh(automatic);
let dirty = true, cache = null;
function D() {
  if (!dirty && cache) return cache;
  cache = compute(state, asOf);
  dirty = false;
  return cache;
}
const CATS = APP_CONSTANTS.BUDGET_CATEGORIES;
const cls = status =>
  /^(Behind|Over|Liabilities)/.test(status) ? 'bad' :
    /^(No |Set a)/.test(status) ? 'warn' :
      'ok';
const nameOf = (collection, id) =>
  (state[collection].find(item => item.id === id) || {}).name || '';
const userOpts = () => [
  { v: '', t: 'None' },
  ...state.users.map(user => ({ v: user.id, t: user.name || '(unnamed)' }))
];
const accOpts = () => [
  { v: '', t: 'None' },
  ...state.accounts.map(account => ({ v: account.id, t: account.name || '(unnamed)' }))
];
const targetOpts = () => [
  { v: DOMAIN_CONSTANTS.COMMITMENT_OTHER_TARGET, t: 'Something else' },
  {
    g: 'Debts',
    items: state.debts.map(debt => ({ v: 'debt:' + debt.id, t: debt.name || '(unnamed)' }))
  },
  {
    g: 'Goals',
    items: state.goals.map(goal => ({ v: 'goal:' + goal.id, t: goal.name || '(unnamed)' }))
  }
];
const curOpts = () => DOMAIN_CONSTANTS.CURRENCIES.map(currency => ({ v: currency, t: currency }));

/* ---------- table plumbing ---------- */
function commit() {
  dirty = true;
  save();
  refresh();
}
function refresh() {
  dirty = true;
  $$('select[data-opts]').forEach(tableEditor.fillOptions);
  $$('[data-calc]').forEach(el => el._u());
  $$('tbody tr').forEach(row => row._check && row._check());
  $$('.acc-item').forEach(item => item._check && item._check());
  updateFoot();
}
function field(col, row) {
  let el;
  if (col.type === 'select') {
    el = h('select', { 'data-opts': '', 'aria-label': col.label });
    el._row = row;
    el._key = col.key;
    el._opts = col.opts;
    tableEditor.fillOptions(el);
  } else {
    el = h('input', { type: col.type, 'aria-label': col.label, placeholder: col.ph || false });
    if (col.type === 'number') {
      el.step = 'any';
      el.setAttribute('inputmode', 'decimal');
    }
    el.value = row[col.key] ?? '';
  }
  if (col.w) el.style.minWidth = col.w + 'px';
  el.addEventListener('input', () => {
    const previous = row[col.key];
    row[col.key] = col.type === 'number' ? (el.value === '' ? '' : parseFloat(el.value)) : el.value;
    if (col.onChange) col.onChange(previous, row[col.key], row);
    commit();
  });
  return el;
}

//Purpose: Detach references to a deleted item from the state, based on the collection and ID provided.
function detach(collection, id) {
  if (collection === 'accounts') {
    const commitmentIds = new Set(
      state.commitments
        .filter(commitment => commitment.account === id)
        .map(commitment => commitment.id)
    );
    state.commitments = state.commitments.filter(commitment => commitment.account !== id);
    state.transactions.forEach(transaction => {
      if (
        (transaction.related || '').startsWith('commitment:') &&
        commitmentIds.has(transaction.related.slice('commitment:'.length))
      ) {
        transaction.related = '';
      }
      if (
        transaction.account === id ||
        transaction.transferTo === id ||
        (Array.isArray(transaction.balanceImpact) &&
          transaction.balanceImpact.some(impact => impact.account === id))
      ) {
        transaction.account = '';
        transaction.transferTo = '';
        transaction.balanceImpact = [];
      }
    });
  }
  if (collection === 'debts') {
    state.commitments.forEach(commitment => {
      if (commitment.target === 'debt:' + id) {
        commitment.target = DOMAIN_CONSTANTS.COMMITMENT_OTHER_TARGET;
      }
    });
    state.transactions.forEach(transaction => {
      if (transaction.related === 'debt:' + id) transaction.related = '';
    });
  }
  if (collection === 'goals') {
    state.commitments.forEach(commitment => {
      if (commitment.target === 'goal:' + id) {
        commitment.target = DOMAIN_CONSTANTS.COMMITMENT_OTHER_TARGET;
      }
    });
  }
  if (collection === 'users') {
    const userCollections = ['income', 'expenses', 'goals', 'accounts', 'transactions'];
    for (const key of userCollections) {
      state[key].forEach(row => {
        if (row.user === id) row.user = '';
      });
    }
    state.debts.forEach(debt => {
      if (debt.borrower === id) debt.borrower = '';
    });
  }
}
const tableEditor = window.HouseholdPlannerTableEditor.create({
  $,
  $$,
  h,
  calcEl,
  field,
  commit,
  detach,
  uid,
  getState: () => state,
  markDirty: () => { dirty = true; },
  tile
});
const tableView = tableEditor.tableView;
function updateFoot() {}
const themeSeg = () => seg([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], theme, setTheme, 'Appearance');
const sRow = (label, ctrl) => h('label', { class: 'frow' }, h('span', { class: 'fl' }, label), ctrl);
const sCalc = (label, fn) => h('div', { class: 'frow' }, h('span', { class: 'fl' }, label), calcEl(fn));
const sCol = (label, key, type, extra) => Object.assign({ label, key, type }, extra);

//Purpose: Create a totals element that displays calculated totals based on the provided getTotals function.
function totalsEl(getTotals) {
  const totals = h('div', { class: 'li-total', 'data-calc': '' });
  totals._u = () => {
    totals.innerHTML = getTotals()
      .map(([label, value]) => `<div><small>${label}</small><b>${value}</b></div>`)
      .join('');
  };
  totals._u();
  return totals;
}

const markDirty = () => { dirty = true; };
const setLegacy = value => { legacy = value; };
const replaceState = nextState => {
  Object.keys(state).forEach(key => delete state[key]);
  Object.assign(state, nextState);
};
const pageContext = {
  state, D, CATS, cls, nameOf, userOpts, accOpts, targetOpts, curOpts,
  rate, accountCurrency, num, sum, money, moneyCur, esc, fmtDate, asOf,
  h, $, $$, uid, calcEl, icon, tile, head, bento, seg, kpiTile,
  tableView, field, detach, commit, save, render, hasData, startImport,
  persistence, themeSeg, markDirty, replaceState, setLegacy,
  liv, itemList, expandable, totalsEl, sRow, sCalc, sCol,
  refreshExchangeRates, exchangeRates
};
const transactionPage = window.HouseholdPlannerPages.transactions(pageContext);
const planPage = window.HouseholdPlannerPages.plan(pageContext);
const accountPage = window.HouseholdPlannerPages.accounts(Object.assign({}, pageContext, {
  txIcon: transactionPage.txIcon
}));
const dashboardPage = window.HouseholdPlannerPages.dashboard(pageContext);
const dataPage = window.HouseholdPlannerPages.data(pageContext);

const pageRenderers = {
  [APP_CONSTANTS.PAGE_ID.DASHBOARD]: dashboardPage,
  [APP_CONSTANTS.PAGE_ID.PLAN]: planPage,
  [APP_CONSTANTS.PAGE_ID.ACCOUNTS]: accountPage.render,
  [APP_CONSTANTS.PAGE_ID.TRANSACTIONS]: transactionPage.render,
  [APP_CONSTANTS.PAGE_ID.DATA]: dataPage
};
const TABS = APP_CONSTANTS.NAV_TABS.map(([id, label, page, icon, shortLabel]) =>
  [id, label, pageRenderers[page], icon, shortLabel]
);

/* ---------- shared list components ---------- */
function liv(render, tag, className) {
  const element = h(tag || 'span', { class: className || '', 'data-calc': '' });
  element._u = () => {
    element.innerHTML = render();
  };
  element._u();
  return element;
}
function itemList(collection, filter, makeItem, emptyMessage) {
  const list = h('div', { class: 'tx-card acc-list' });
  state[collection].filter(filter).forEach(row => list.append(makeItem(row)));
  const empty = liv(
    () => list.children.length ? '' : `<p class="empty">${emptyMessage}</p>`,
    'div'
  );
  return { list, empty };
}
function expandable(item, header, detail) {
  const setOpen = isOpen => {
    const shouldOpen = isOpen == null
      ? header.getAttribute('aria-expanded') !== 'true'
      : isOpen;
    header.setAttribute('aria-expanded', String(shouldOpen));
    detail.hidden = !shouldOpen;
    item.classList.toggle('open', shouldOpen);
  };
  header.addEventListener('click', () => setOpen());
  item._open = setOpen;
  item.append(header, detail);
}




/* ---------- import ---------- */
const importInput = h('input', {
  type: 'file',
  accept: 'application/json,.json',
  hidden: true,
  'aria-label': 'Import JSON file'
});
importInput.addEventListener('change', () => {
  const file = importInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const importedData = JSON.parse(reader.result);
      if (
        typeof importedData !== 'object'
        || importedData === null
        || !Array.isArray(importedData.accounts)
      ) {
        throw new Error('bad');
      }
      if (hasData() && !confirm('Replace everything here with the contents of this file?')) {
        return;
      }

      replaceState(persistence.normalize(importedData));
      legacy = false;
      state.ui.tab = APP_CONSTANTS.PAGE_ID.DASHBOARD;
      dirty = true;
      save();
      render();
      window.scrollTo(0, 0);
    } catch (error) {
      alert('That file could not be read. Choose a JSON file exported from this page.');
    }
  };
  reader.readAsText(file);
  importInput.value = '';
});
document.body.append(importInput);

//Purpose: Render the dashboard overview page, which summarizes the current month’s cash position, budget allocation, goal debt progress, and per-person financial health from the model data.
function startImport() {
  importInput.click();
}

//Purpose: Check if there is any data in the state, including users, income, expenses, goals, debts, accounts, commitments, or transactions.
function hasData(data = state) {
  const collections = [
    'users',
    'income',
    'expenses',
    'goals',
    'debts',
    'accounts',
    'commitments',
    'transactions'
  ];
  return collections.some(collection => data[collection].length);
}

/* ---------- shell ---------- */

// Navigation metadata is centralized; this binds each tab to its page renderer.
//Purpose: Render the navigation buttons for each tab, highlighting the currently selected tab and allowing users to switch between tabs while saving the state and re-rendering the content.
function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = '';
  nav.append(h('div', { class: 'brand' }, 'Household planner'));

  //Purpose: Render the navigation buttons for each tab, highlighting the currently selected tab and allowing users to switch between tabs while saving the state and re-rendering the content.
  for (const [id, label, , iconName, shortLabel] of TABS) {
    const button = h('button', {
      type: 'button',
      'aria-current': state.ui.tab === id ? 'page' : false,
      onclick: () => {
        state.ui.tab = id;
        save();
        render();
        window.scrollTo(0, 0);
      }
    });
    button.innerHTML = icon(iconName);
    button.append(
      h('span', { class: 'lbl-long' }, label),
      h('span', { class: 'lbl-short' }, shortLabel)
    );
    nav.append(button);
  }
  const saveStatus = persistence.available ? 'Saved on this device' : 'Not saving';
  nav.append(h(
    'div',
    { class: 'nav-foot' },
    themeSeg(),
    h('span', {}, saveStatus)
  ));
}

//Purpose: Render the main content area based on the current state and selected tab, including banners for saving status and legacy data.
function render() {
  dirty = true;
  const main = $('#main');
  main.innerHTML = '';
  if (!persistence.available) {
    main.append(h(
      'div',
      { class: 'banner', role: 'status' },
      'Saving is blocked here, so changes will be lost when you close this page. Download the file and open it in your browser to save.'
    ));
  }

  //Purpose: If legacy data is detected, show a banner prompting the user to either clear it or keep it, with appropriate actions for each choice.
  if (legacy) {
    const clearLegacyData = () => {
      if (!confirm('Clear all saved data from this browser? Export a copy first if you want to keep it.')) {
        return;
      }
      replaceState(persistence.blank());
      legacy = false;
      dirty = true;
      save();
      render();
    };
    const keepLegacyData = () => {
      legacy = false;
      save();
      render();
    };

    //Purpose: If legacy data is detected, show a banner prompting the user to either clear it or keep it, with appropriate actions for each choice.
    main.append(h(
      'div',
      { class: 'banner legacy', role: 'status' },
      h('b', {}, 'Saved data found. '),
      'This browser still has data saved by an earlier version of this page. Keep it, or clear it to start empty?',
      h(
        'div',
        { class: 'b-actions' },
        h('button', {
          class: 'btn danger',
          type: 'button',
          onclick: clearLegacyData
        }, 'Clear it'),
        h('button', {
          class: 'btn plain',
          type: 'button',
          onclick: keepLegacyData
        }, 'Keep it')
      )
    ));
  }

  const selectedTab = TABS.find(tab => tab[0] === state.ui.tab) || TABS[0];
  main.append(selectedTab[2]());
  renderNav();
}
render();
refreshExchangeRates(true);
setInterval(() => refreshExchangeRates(true), 15 * 60 * 1000);
})();
