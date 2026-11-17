const {
  num: parseNumber,
  toMonthlyAmount: convertToMonthlyAmount,
  sum: sumValues,
  currencyRate: getCurrencyRate,
  compute: computeHouseholdSummary
} = window.HouseholdPlannerModel;
const {
  uid: generateUniqueId,
  $: querySelector,
  $$: querySelectorAll,
  money: formatMoney,
  moneyCur: formatMoneyInCurrency,
  esc: escapeHtml,
  fmtDate: formatDate,
  h: createElement
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
  calcEl: createCalculatedElement,
  icon: renderIcon,
  tile: createTile,
  head: createPageHeader,
  bento: createBentoLayout,
  segmentedControl,
  kpiTile: createKpiTile
} = window.HouseholdPlannerUI.create({ h: createElement });

function applyTheme() {
  const rootElement = document.documentElement;
  if (theme === 'auto') rootElement.removeAttribute('data-theme');
  else rootElement.setAttribute('data-theme', theme);
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
const currentDate = new Date();
const asOfDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
const getRate = currency => getCurrencyRate(currency, state.fx);
const accountCurrency = accountId =>
  (state.accounts.find(account => account.id === accountId) || {}).currency ||
  DOMAIN_CONSTANTS.DEFAULT_CURRENCY;
const exchangeRates = window.HouseholdPlannerExchangeRates.create({
  getState: () => state,
  commit,
  query: querySelector
});
const refreshExchangeRates = automatic => exchangeRates.refresh(automatic);
let dirty = true, calculationCache = null;
function getDerivedData() {
  if (!dirty && calculationCache) return calculationCache;
  calculationCache = computeHouseholdSummary(state, asOfDate);
  dirty = false;
  return calculationCache;
}
const budgetCategories = APP_CONSTANTS.BUDGET_CATEGORIES;
const getStatusClass = status =>
  /^(Behind|Over|Liabilities)/.test(status) ? 'bad' :
    /^(No |Set a)/.test(status) ? 'warn' :
      'ok';
const getRecordName = (collectionName, recordId) =>
  (state[collectionName].find(record => record.id === recordId) || {}).name || '';
const getUserOptions = () => [
  { v: '', t: 'None' },
  ...state.users.map(user => ({ v: user.id, t: user.name || '(unnamed)' }))
];
const getAccountOptions = () => [
  { v: '', t: 'None' },
  ...state.accounts.map(account => ({ v: account.id, t: account.name || '(unnamed)' }))
];
const getTargetOptions = () => [
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
const getCurrencyOptions = () => [
  DOMAIN_CONSTANTS.DEFAULT_CURRENCY,
  ...Object.keys(state.fx.rates)
].map(currency => ({ v: currency, t: currency }));

/* ---------- table plumbing ---------- */
function commit() {
  dirty = true;
  save();
  refresh();
}
function refresh() {
  dirty = true;
  querySelectorAll('select[data-opts]').forEach(tableEditor.fillOptions);
  querySelectorAll('[data-calc]').forEach(calculatedElement => calculatedElement._u());
  querySelectorAll('tbody tr').forEach(row => row._check && row._check());
  querySelectorAll('.acc-item').forEach(item => item._check && item._check());
  updateFoot();
}
function field(columnConfig, record) {
  let inputElement;
  if (columnConfig.type === 'select') {
    inputElement = createElement('select', { 'data-opts': '', 'aria-label': columnConfig.label });
    inputElement._row = record;
    inputElement._key = columnConfig.key;
    inputElement._opts = columnConfig.opts;
    tableEditor.fillOptions(inputElement);
  } else {
    inputElement = createElement('input', { type: columnConfig.type, 'aria-label': columnConfig.label, placeholder: columnConfig.ph || false });
    if (columnConfig.type === 'number') {
      inputElement.step = 'any';
      inputElement.setAttribute('inputmode', 'decimal');
    }
    inputElement.value = record[columnConfig.key] ?? '';
  }
  if (columnConfig.w) inputElement.style.minWidth = columnConfig.w + 'px';
  inputElement.addEventListener('input', () => {
    const previousValue = record[columnConfig.key];
    record[columnConfig.key] = columnConfig.type === 'number'
      ? (inputElement.value === '' ? '' : parseFloat(inputElement.value))
      : inputElement.value;
    if (columnConfig.onChange) {
      columnConfig.onChange(previousValue, record[columnConfig.key], record);
    }
    commit();
  });
  return inputElement;
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
  $: querySelector,
  $$: querySelectorAll,
  h: createElement,
  calcEl: createCalculatedElement,
  field,
  commit,
  detach,
  uid: generateUniqueId,
  getState: () => state,
  markDirty: () => { dirty = true; },
  tile: createTile
});
const tableView = tableEditor.tableView;
function updateFoot() {}
const themeSegmentedControl = () => segmentedControl([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], theme, setTheme, 'Appearance');
const createFormRow = (label, control) => createElement('label', { class: 'frow' }, createElement('span', { class: 'fl' }, label), control);
const createCalculationRow = (label, calculateValue) => createElement('div', { class: 'frow' }, createElement('span', { class: 'fl' }, label), createCalculatedElement(calculateValue));
const createTableColumn = (label, propertyName, inputType, additionalOptions) =>
  Object.assign({ label, key: propertyName, type: inputType }, additionalOptions);

//Purpose: Create a totals element that displays calculated totals based on the provided getTotals function.
function createTotalsElement(calculateTotals) {
  const totalsElement = createElement('div', { class: 'li-total', 'data-calc': '' });
  totalsElement._u = () => {
    totalsElement.innerHTML = calculateTotals()
      .map(([label, value]) => `<div><small>${label}</small><b>${value}</b></div>`)
      .join('');
  };
  totalsElement._u();
  return totalsElement;
}

const markDirty = () => { dirty = true; };
const setLegacy = legacyValue => { legacy = legacyValue; };
const replaceState = nextState => {
  Object.keys(state).forEach(key => delete state[key]);
  Object.assign(state, nextState);
};
const pageContext = {
  state,
  D: getDerivedData,
  CATS: budgetCategories,
  cls: getStatusClass,
  nameOf: getRecordName,
  userOpts: getUserOptions,
  accOpts: getAccountOptions,
  targetOpts: getTargetOptions,
  curOpts: getCurrencyOptions,
  rate: getRate,
  accountCurrency,
  num: parseNumber,
  toMonthlyAmount: convertToMonthlyAmount,
  sum: sumValues,
  money: formatMoney,
  moneyCur: formatMoneyInCurrency,
  esc: escapeHtml,
  fmtDate: formatDate,
  asOf: asOfDate,
  h: createElement,
  $: querySelector,
  $$: querySelectorAll,
  uid: generateUniqueId,
  calcEl: createCalculatedElement,
  icon: renderIcon,
  tile: createTile,
  head: createPageHeader,
  bento: createBentoLayout,
  segmentedControl,
  kpiTile: createKpiTile,
  tableView, field, detach, commit, save, render, hasData, startImport,
  persistence, themeSegmentedControl, markDirty, replaceState, setLegacy,
  liv: createLiveValueElement,
  itemList: createItemList,
  expandable,
  totalsEl: createTotalsElement,
  sRow: createFormRow,
  sCalc: createCalculationRow,
  sCol: createTableColumn,
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
const NAVIGATION_TABS = APP_CONSTANTS.NAV_TABS.map(([id, label, page, iconName, shortLabel]) =>
  [id, label, pageRenderers[page], iconName, shortLabel]
);

/* ---------- shared list components ---------- */
function createLiveValueElement(renderValue, tagName, className) {
  const liveElement = createElement(tagName || 'span', { class: className || '', 'data-calc': '' });
  liveElement._u = () => {
    liveElement.innerHTML = renderValue();
  };
  liveElement._u();
  return liveElement;
}
function createItemList(collectionName, filterRecords, createItem, emptyMessage) {
  const itemListElement = createElement('div', { class: 'tx-card acc-list' });
  state[collectionName].filter(filterRecords).forEach(record => itemListElement.append(createItem(record)));
  const emptyStateElement = createLiveValueElement(
    () => itemListElement.children.length ? '' : `<p class="empty">${emptyMessage}</p>`,
    'div'
  );
  return { list: itemListElement, empty: emptyStateElement };
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
const importFileInput = createElement('input', {
  type: 'file',
  accept: 'application/json,.json',
  hidden: true,
  'aria-label': 'Import JSON file'
});
importFileInput.addEventListener('change', () => {
  const selectedFile = importFileInput.files[0];
  if (!selectedFile) return;

  const fileReader = new FileReader();
  fileReader.onload = () => {
    try {
      const importedData = JSON.parse(fileReader.result);
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
    } catch (parseError) {
      alert('That file could not be read. Choose a JSON file exported from this page.');
    }
  };
  fileReader.readAsText(selectedFile);
  importFileInput.value = '';
});
document.body.append(importFileInput);

//Purpose: Render the dashboard overview page, which summarizes the current month’s cash position, budget allocation, goal debt progress, and per-person financial health from the model data.
function startImport() {
  importFileInput.click();
}

//Purpose: Check if there is any data in the state, including users, income, expenses, goals, debts, accounts, commitments, or transactions.
function hasData(dataState = state) {
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
  return collections.some(collectionName => dataState[collectionName].length);
}

/* ---------- shell ---------- */

// Navigation metadata is centralized; this binds each tab to its page renderer.
//Purpose: Render the navigation buttons for each tab, highlighting the currently selected tab and allowing users to switch between tabs while saving the state and re-rendering the content.
function renderNav() {
  const navigationElement = querySelector('#nav');
  navigationElement.innerHTML = '';
  navigationElement.append(createElement('div', { class: 'brand' }, 'Household planner'));

  //Purpose: Render the navigation buttons for each tab, highlighting the currently selected tab and allowing users to switch between tabs while saving the state and re-rendering the content.
  for (const [id, label, , iconName, shortLabel] of NAVIGATION_TABS) {
    const navigationButton = createElement('button', {
      type: 'button',
      'aria-current': state.ui.tab === id ? 'page' : false,
      onclick: () => {
        state.ui.tab = id;
        save();
        render();
        window.scrollTo(0, 0);
      }
    });
    navigationButton.innerHTML = renderIcon(iconName);
    navigationButton.append(
      createElement('span', { class: 'lbl-long' }, label),
      createElement('span', { class: 'lbl-short' }, shortLabel)
    );
    navigationElement.append(navigationButton);
  }
  const saveStatus = persistence.available ? 'Saved on this device' : 'Not saving';
  navigationElement.append(createElement(
    'div',
    { class: 'nav-foot' },
    themeSegmentedControl(),
    createElement('span', {}, saveStatus)
  ));
}

//Purpose: Render the main content area based on the current state and selected tab, including banners for saving status and legacy data.
function render() {
  dirty = true;
  const mainElement = querySelector('#main');
  mainElement.innerHTML = '';
  if (!persistence.available) {
    mainElement.append(createElement(
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
    mainElement.append(createElement(
      'div',
      { class: 'banner legacy', role: 'status' },
      createElement('b', {}, 'Saved data found. '),
      'This browser still has data saved by an earlier version of this page. Keep it, or clear it to start empty?',
      createElement(
        'div',
        { class: 'b-actions' },
        createElement('button', {
          class: 'btn danger',
          type: 'button',
          onclick: clearLegacyData
        }, 'Clear it'),
        createElement('button', {
          class: 'btn plain',
          type: 'button',
          onclick: keepLegacyData
        }, 'Keep it')
      )
    ));
  }

  const selectedTab = NAVIGATION_TABS.find(tab => tab[0] === state.ui.tab) || NAVIGATION_TABS[0];
  mainElement.append(selectedTab[2]());
  renderNav();
}
render();
refreshExchangeRates(true);
setInterval(() => refreshExchangeRates(true), 15 * 60 * 1000);
})();
