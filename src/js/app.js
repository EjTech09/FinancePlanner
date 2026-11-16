const {
  num,
  sum,
  currencyRate,
  compute
} = window.HouseholdPlannerModel;

(() => {
'use strict';
const KEY = 'household-planner-v1';
let storageOK = true;
try {
  localStorage.setItem('__t', '1');
  localStorage.removeItem('__t');
} catch (e) {
  storageOK = false;
}

const THEME_KEY = 'household-planner-theme';
let theme = 'auto';
try {
  if (storageOK) {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') theme = savedTheme;
  }
} catch (e) {}

function applyTheme() {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

function setTheme(nextTheme) {
  theme = nextTheme;
  try {
    if (storageOK) {
      if (nextTheme === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, nextTheme);
    }
  } catch (e) {}

  applyTheme();
  render();
}

applyTheme();

let _n = 0;
const uid = () => 'i' + Date.now().toString(36) + (_n++).toString(36);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (amount, digits = 2) => new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: 'NZD',
  minimumFractionDigits: digits,
  maximumFractionDigits: digits
}).format(amount);
const moneyCur = (amount, currency) => new Intl.NumberFormat('en-NZ', {
  style: 'currency',
  currency: ['NZD', 'PHP', 'USD'].includes(currency) ? currency : 'NZD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(amount);
const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));
const fmtDate = date => date.toLocaleDateString('en-NZ', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const child of kids.flat()) {
    if (child == null || child === false) continue;
    e.append(child.nodeType ? child : document.createTextNode(child));
  }
  return e;
}

/* ---------- data ---------- */
function blank() {
  return {
    users: [],
    income: [],
    alloc: { essential: 50, savings: 20, debt: 10, discretionary: 20 },
    expenses: [],
    goals: [],
    debts: [],
    accounts: [],
    fx: { php: 36, usd: 1.8, phpUpdatedAt: null, usdUpdatedAt: null },
    commitments: [],
    transactions: [],
    ui: { tab: 'dashboard', accUser: 'all' }
  };
}
function normalize(data) {
  const defaults = blank();
  const dataBuild = Number(data.ui && data.ui.build) || 0;

  for (const key of Object.keys(defaults)) {
    if (data[key] == null) data[key] = defaults[key];
  }

  const collections = [
    'users', 'income', 'expenses', 'goals',
    'debts', 'accounts', 'commitments', 'transactions'
  ];
  for (const collection of collections) {
    if (!Array.isArray(data[collection])) data[collection] = [];
  }

  data.income.forEach(income => {
    if (!income.currency) income.currency = 'NZD';
  });

  data.alloc = Object.assign({}, defaults.alloc, data.alloc);
  if (data.ui && (data.ui.tab === 'goals' || data.ui.tab === 'debts')) {
    data.ui.tab = 'plan';
  }
  data.fx = Object.assign({}, defaults.fx, data.fx);
  data.ui = Object.assign({}, defaults.ui, data.ui);

  if (dataBuild < 3) {
    data.commitments.forEach(commitment => {
      const account = data.accounts.find(item => item.id === commitment.account);
      const currency = account && account.currency || 'NZD';
      if (commitment.amount !== '' && commitment.amount != null) {
        commitment.amount = num(commitment.amount) / currencyRate(currency, data.fx);
      }
    });
  }

  return data;
}
let state, legacy = false;
(function load() {
  try {
    if (storageOK) {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const savedData = JSON.parse(raw);
        state = normalize(savedData);
        legacy = !(savedData.ui && savedData.ui.build) && hasData();
        return;
      }
    }
  } catch (e) {}

  state = blank();
})();
let savedAt = null;
function save() {
  if (!storageOK) return;
  try {
    state.ui.build = 3;
    localStorage.setItem(KEY, JSON.stringify(state));
    savedAt = new Date();
  } catch (e) {
    storageOK = false;
    renderNav();
  }
}

/* ---------- calculations ---------- */
const today = new Date();
const asOf = new Date(today.getFullYear(), today.getMonth(), today.getDate());
const rate = currency => currencyRate(currency, state.fx);
const accountCurrency = accountId =>
  (state.accounts.find(account => account.id === accountId) || {}).currency || 'NZD';
let fxStatusText = 'Fetching the latest available PHP/NZD and USD/NZD rates...';
let fxRefreshing = false;
async function refreshExchangeRates(automatic = false) {
  const activeInput = document.activeElement;
  const rateInputs = ['PHP per 1 NZD', 'NZD per 1 USD'];
  const editingRate = rateInputs.some(label =>
    $('input[aria-label="' + label + '"]') === activeInput
  );
  if (fxRefreshing || (automatic && editingRate)) return;

  fxRefreshing = true;
  fxStatusText = 'Fetching the latest available PHP/NZD and USD/NZD rates...';
  updateFxStatus();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error('Exchange-rate service returned HTTP ' + response.status);

    const data = await response.json();
    const usdToNzd = Number(data.rates && data.rates.NZD);
    const usdToPhp = Number(data.rates && data.rates.PHP);
    const phpPerNzd = usdToPhp / usdToNzd;
    const updatedAt = new Date(Number(data.time_last_update_unix) * 1000);
    const hasValidRates = Number.isFinite(usdToNzd) && usdToNzd > 0 &&
      Number.isFinite(usdToPhp) && usdToPhp > 0 &&
      Number.isFinite(phpPerNzd);
    if (data.result !== 'success' || !hasValidRates || !Number.isFinite(updatedAt.getTime())) {
      throw new Error('Exchange-rate service returned invalid PHP/NZD or USD/NZD data');
    }

    state.fx.php = phpPerNzd;
    state.fx.usd = usdToNzd;
    state.fx.phpUpdatedAt = updatedAt.toISOString();
    state.fx.usdUpdatedAt = updatedAt.toISOString();
    fxStatusText = `Latest rates: PHP/NZD ${phpPerNzd.toFixed(5)} and USD/NZD ${usdToNzd.toFixed(5)}. Provider data updated ${updatedAt.toLocaleString('en-NZ')}.`;
    commit();

    const refreshedRates = [
      ['PHP per 1 NZD', phpPerNzd],
      ['NZD per 1 USD', usdToNzd]
    ];
    refreshedRates.forEach(([label, value]) => {
      const input = $('input[aria-label="' + label + '"]');
      if (input && document.activeElement !== input) input.value = String(value);
    });
  } catch (error) {
    console.error('Unable to refresh the PHP/NZD and USD/NZD exchange rates:', error);
    fxStatusText = `Could not refresh exchange rates. Using saved rates: PHP/NZD ${num(state.fx.php).toFixed(5)} and USD/NZD ${num(state.fx.usd).toFixed(5)}.`;
  } finally {
    clearTimeout(timeout);
    fxRefreshing = false;
    updateFxStatus();
  }
}
function updateFxStatus() {
  const status = $('#fx-status');
  if (status) status.textContent = fxStatusText;
  const button = $('#fx-refresh');
  if (button) button.disabled = fxRefreshing;
}
let dirty = true, cache = null;
function D() {
  if (!dirty && cache) return cache;
  cache = compute(state, asOf);
  dirty = false;
  return cache;
}
const CATS = [
  ['essential', 'Essential expenses', 'c1'],
  ['savings', 'Savings', 'c2'],
  ['debt', 'Debt service', 'c3'],
  ['discretionary', 'Discretionary expenses', 'c4']
];
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
  { v: 'other', t: 'Something else' },
  {
    g: 'Debts',
    items: state.debts.map(debt => ({ v: 'debt:' + debt.id, t: debt.name || '(unnamed)' }))
  },
  {
    g: 'Goals',
    items: state.goals.map(goal => ({ v: 'goal:' + goal.id, t: goal.name || '(unnamed)' }))
  }
];
const curOpts = () => ['NZD', 'PHP', 'USD'].map(currency => ({ v: currency, t: currency }));

/* ---------- table plumbing ---------- */
function fillOptions(sel) {
  const row = sel._row;
  const key = sel._key;
  const currentValue = row[key] ?? '';
  sel.innerHTML = '';
  const makeOption = option => h('option', { value: option.v }, option.t);

  for (const option of sel._opts()) {
    if (option.g) {
      if (option.items.length) {
        sel.append(h('optgroup', { label: option.g }, option.items.map(makeOption)));
      }
    } else {
      sel.append(makeOption(option));
    }
  }

  sel.value = currentValue;
  if (sel.value !== currentValue) sel.selectedIndex = 0;
}
function calcEl(fn) {
  const s = h('span', { class: 'calc', 'data-calc': '' });
  s._u = () => {
    const result = fn();
    if (result && typeof result === 'object') {
      if (result.html != null) s.innerHTML = result.html;
      else s.textContent = result.t;
      s.className = 'calc ' + (result.cls || '');
    } else {
      s.textContent = result ?? '';
      s.className = 'calc';
    }
  };
  s._u();
  return s;
}
function commit() {
  dirty = true;
  save();
  refresh();
}
function refresh() {
  dirty = true;
  $$('select[data-opts]').forEach(fillOptions);
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
    fillOptions(el);
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
function detach(collection, id) {
  if (collection === 'accounts') {
    state.commitments = state.commitments.filter(commitment => commitment.account !== id);
    state.transactions.forEach(transaction => {
      if (transaction.account === id) transaction.account = '';
    });
  }
  if (collection === 'debts') {
    state.commitments.forEach(commitment => {
      if (commitment.target === 'debt:' + id) commitment.target = 'other';
    });
  }
  if (collection === 'goals') {
    state.commitments.forEach(commitment => {
      if (commitment.target === 'goal:' + id) commitment.target = 'other';
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
const CHEV = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function setOpen(row, isOpen) {
  row.classList.toggle('open', isOpen);
  const button = $('.chev', row);
  if (button) {
    button.setAttribute('aria-expanded', String(isOpen));
    button.setAttribute('aria-label', isOpen ? 'Hide details' : 'Show details');
  }
}
function tableView(o) {
  const role = column => (o.roles && o.roles[column.label]) || 'd';
  const tbody = h('tbody');
  const addRow = data => {
    const tableRow = h('tr', o.compact ? { class: 'compact' } : {});
    for (const column of o.cols) {
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
    detailsButton.innerHTML = CHEV;
    tableRow.append(h('td', { class: 'exp' }, detailsButton));

    const deleteButton = h('button', {
      class: 'x',
      type: 'button',
      'aria-label': 'Delete this row',
      onclick: () => {
        if (!confirm('Delete this row? This cannot be undone.')) return;
        state[o.coll] = state[o.coll].filter(item => item !== data);
        detach(o.coll, data.id);
        tableRow.remove();
        commit();
      }
    }, h('span', { class: 'xi' }, '\u00d7'), h('span', { class: 'xt' }, 'Delete this row'));
    tableRow.append(h('td', { class: 'act' }, deleteButton));

    if (o.filter) {
      tableRow._check = () => {
        if (!o.filter(data)) tableRow.remove();
      };
    }

    tbody.append(tableRow);
    return tableRow;
  };
  state[o.coll].filter(o.filter || (() => true)).forEach(addRow);

  const headerRow = h(
    'tr',
    {},
    o.cols.map(column => h('th', {
      class: column.num || column.type === 'number' ? 'num' : ''
    }, column.label)),
    h('th', {}, h('span', { style: 'position:absolute;left:-9999px' }, 'Delete'))
  );
  const table = h('table', {}, h('thead', {}, headerRow), tbody);
  if (o.cols.some(c => c.total)) {
    const totalCells = o.cols.map((column, index) => {
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
      const row = Object.assign({ id: uid() }, o.blank());
      state[o.coll].push(row);
      dirty = true;

      const tableRow = addRow(row);
      setOpen(tableRow, true);
      if (toggleButton) toggleButton.hidden = false;
      commit();

      const firstField = $('input,select', tableRow);
      if (firstField) firstField.focus();
    }
  }, o.addLabel);
  const hasDetailColumns = o.cols.some(column => role(column) === 'd');
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

  if (toggleButton && !state[o.coll].filter(o.filter || (() => true)).length) {
    toggleButton.hidden = true;
  }

  const sheet = h('div', { class: 'sheet scroll' }, table);
  if (o.bare) return h('div', {}, toggleButton, sheet, addButton);

  return tile(
    o.span || 12,
    {},
    h('h2', {}, o.title),
    o.note ? h('p', { class: 'sub' }, o.note) : null,
    toggleButton,
    sheet,
    addButton
  );
}
function updateFoot() {}

/* ---------- views ---------- */
const ICONS = {
  dashboard: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  plan: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  accounts: '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M3 10h18M7 15h3"/>',
  transactions: '<path d="M7 4v14M7 18l-3-3M7 18l3-3M17 20V6M17 6l-3 3M17 6l3 3"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.2c2.3.1 3.9 1.6 4.5 4.3"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
function tile(span, attrs, ...kids) {
  const attributes = Object.assign({}, attrs);
  attributes.class = 'tile s-' + span + (attributes.class ? ' ' + attributes.class : '');
  return h('section', attributes, ...kids);
}
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
const themeSeg = () => seg([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], theme, setTheme, 'Appearance');
const kpiTile = (label, value, caption, span = 3) => tile(
  span,
  { class: 'kpi' },
  h('div', { class: 'k-label' }, label),
  h('div', { class: 'k-val' }, calcEl(value)),
  caption
    ? h('div', { class: 'k-cap' }, typeof caption === 'function' ? calcEl(caption) : caption)
    : null
);

const dashView = () => {
  const R = D();
  const inc = R.income;
  const tot = R.totalBudgeted;
  const left = inc - tot;
  const top = Math.max(inc, tot, 1);
  const over = left < -0.005;
  const pct = inc > 0 ? tot / inc * 100 : 0;
  const circumference = 2 * Math.PI * 48;
  const dash = Math.min(pct, 100) / 100 * circumference;
  const segs = CATS.map(([key,, color]) =>
    `<i style="width:${R.budgeted[key] / top * 100}%;background:var(--${color})"></i>`
  ).join('') + `<i style="width:${Math.max(left, 0) / top * 100}%"></i>`;
  const leg = CATS.map(([key, name, color]) => {
    const isOverLimit = R.budgeted[key] > R.limit[key] + 0.005;
    const overage = isOverLimit ? ', over by ' + money(R.budgeted[key] - R.limit[key], 0) : '';
    return `<li><span class="dot" style="background:var(--${color})"></span><b>${name}</b><small class="${isOverLimit ? 'bad' : ''}">${money(R.budgeted[key], 0)} of ${money(R.limit[key], 0)} limit${overage}</small></li>`;
  }).join('');
  const goalsOn = state.goals.filter(goal => R.goals[goal.id].hasTarget);
  const onTrack = goalsOn.filter(goal => /^(On track|Reached)/.test(R.goals[goal.id].status)).length;
  const debtsOn = state.debts.filter(debt =>
    /^(On track|Fully funded)/.test(R.debts[debt.id].status)
  ).length;
  const goalScale = Math.max(
    1,
    ...state.goals.map(goal => Math.max(num(goal.monthly), R.goals[goal.id].required || 0))
  );
  const goalRows = state.goals.map(g => {
    const r = R.goals[g.id];
    return `<div class="row"><div class="top"><span class="name">${esc(g.name)}</span><span class="pill ${cls(r.status)}">${esc(r.status)}</span></div>
      <div class="meta">${money(num(g.monthly), 0)} a month${r.required != null ? ', ' + money(r.required, 0) + ' needed for the date' : ''}. Saved ${money(r.saved, 0)} of ${g.target === '' ? 'no target' : money(num(g.target), 0)}.</div>
      <div class="bar thin"><i style="width:${num(g.monthly) / goalScale * 100}%;background:var(--c1)"></i></div>
      <div class="bar thin"><i style="width:${(r.required || 0) / goalScale * 100}%;background:var(--c3)"></i></div></div>`;
  }).join('') || '<p class="empty">No goals yet. Add one on the Plan page.</p>';
  const debtScale = Math.max(1, ...state.debts.map(debt => R.debts[debt.id].bal));
  const debtRows = state.debts.slice().sort((a, b) => num(a.priority) - num(b.priority)).map(debt => {
    const progress = R.debts[debt.id];
    return `<div class="row"><div class="top"><span class="name">${esc(debt.name)}</span><span class="pill ${cls(progress.status)}">${esc(progress.status)}</span></div>
      <div class="meta">${money(progress.bal, 0)} owed. ${money(progress.funded, 0)} covered, ${money(progress.unfunded, 0)} still to find. ${num(debt.monthly) > 0 ? money(num(debt.monthly), 0) + ' a month.' : 'No monthly payment yet.'}</div>
      <div class="bar"><i style="width:${progress.funded / debtScale * 100}%;background:var(--c2)"></i><i style="width:${progress.unfunded / debtScale * 100}%;background:var(--c3)"></i></div></div>`;
  }).join('') || '<p class="empty">No debts recorded.</p>';
  const people = state.users.map(user => {
    const accounts = state.accounts
      .filter(account => account.user === user.id)
      .map(account => R.accounts[account.id]);
    return {
      name: user.name,
      net: sum(accounts, 'net'),
      committed: sum(accounts, 'committed'),
      free: sum(accounts, 'free'),
      accountCount: accounts.length
    };
  }).filter(person => person.accountCount);
  const peopleScale = Math.max(1, ...people.map(person => Math.max(person.net, 0)));
  const personRows = people.map(person => `<div class="row"><div class="top"><span class="name">${esc(person.name)}</span><span class="meta">${money(person.net, 0)} after bills</span></div>
      <div class="meta">${money(person.committed, 0)} set aside, ${money(person.free, 0)} free to use.</div>
      <div class="bar"><i style="width:${Math.max(person.committed, 0) / peopleScale * 100}%;background:var(--c1)"></i><i style="width:${Math.max(person.free, 0) / peopleScale * 100}%;background:var(--c2)"></i></div></div>`).join('') || '<p class="empty">Add accounts to see cash by person.</p>';
  const el = h('div');
  el.append(head('Dashboard', 'As of ' + fmtDate(asOf) + '.'));
  const dashboard = h('div', { class: 'bento' });
  dashboard.innerHTML = `
    <section class="tile s-8 hero"><h2>${inc > 0 ? 'Where ' + money(inc, 0) + ' a month goes' : 'Add your income to begin'}</h2>
      <p class="sub">Each colour is a budget section. The grey part is income you have not allocated yet.</p>
      <div class="split" role="img" aria-label="Monthly income split by budget category">${segs}</div><ul class="legend">${leg}</ul></section>
    <section class="tile s-4 ring-tile ${over ? 'tint-red' : 'tint-green'}"><h2>Allocated</h2>
      <div class="ring-wrap"><svg viewBox="0 0 120 120" role="img" aria-label="${pct.toFixed(0)} percent of income allocated"><circle class="ring-bg" cx="60" cy="60" r="48"/><circle class="ring-fg" cx="60" cy="60" r="48" stroke-dasharray="${dash} ${circumference}" transform="rotate(-90 60 60)"${dash < 0.5 ? ' style="display:none"' : ''}/></svg>
        <div class="ring-c"><b>${pct.toFixed(0)}%</b><span>of income</span></div></div>
      <p class="ring-cap ${over ? 'bad' : 'ok'}">${over ? money(-left, 0) + ' over-allocated' : money(left, 0) + ' left unbudgeted'}</p></section>
    <section class="tile s-3 kpi"><div class="k-label">Savings rate</div><div class="k-val">${inc ? (R.budgeted.savings / inc * 100).toFixed(1) : '0.0'}%</div><div class="k-cap">of income goes to goals</div></section>
    <section class="tile s-3 kpi"><div class="k-label">Cash after bills</div><div class="k-val">${money(R.net, 0)}</div><div class="k-cap">across all accounts</div></section>
    <section class="tile s-3 kpi"><div class="k-label">Free to use</div><div class="k-val">${money(R.free, 0)}</div><div class="k-cap">not set aside for anything</div></section>
    <section class="tile s-3 kpi"><div class="k-label">Goals on track</div><div class="k-val">${onTrack} of ${goalsOn.length}</div><div class="k-cap">${debtsOn} of ${state.debts.length} debts on track</div></section>
    <section class="tile s-6"><h2>Goals</h2><p class="sub">Blue is what you put in each month. Orange is what the date needs.</p><div class="rows">${goalRows}</div></section>
    <section class="tile s-6"><h2>Debts</h2><p class="sub">${money(R.debtFunded, 0)} of ${money(R.debtTotal, 0)} is covered by money you have set aside.</p><div class="rows">${debtRows}</div></section>
    <section class="tile s-12"><h2>Cash by person</h2><p class="sub">Blue is set aside for something. Green is free to use.</p><div class="rows">${personRows}</div></section>`;
  if (!hasData()) {
    dashboard.innerHTML = '';
    dashboard.append(tile(
      12,
      { class: 'welcome' },
      h('h2', {}, 'Welcome'),
      h('p', { class: 'sub' }, 'Nothing is saved here yet. Import a JSON file you exported earlier, or start from scratch by adding the people who share this budget.'),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', type: 'button', onclick: startImport }, 'Import JSON'),
        h('button', {
          class: 'btn plain',
          type: 'button',
          onclick: () => {
            state.ui.tab = 'data';
            save();
            render();
          }
        }, 'Start from scratch'))
    ));
  }

  el.append(dashboard);
  return el;
};

const meterHtml = category => {
  const summary = D();
  const limit = summary.limit[category];
  const used = summary.budgeted[category];
  const left = limit - used;
  const over = left < -0.005;
  const percentage = limit > 0
    ? Math.min(used / limit, 1) * 100
    : used > 0 ? 100 : 0;

  return `<div class="m-left ${over ? 'bad' : ''}"><b>${money(Math.abs(left), 0)}</b><span>${over ? 'over the limit' : 'left to allocate'}</span></div>
    <div class="m-bar" role="img" aria-label="${money(used, 0)} allocated of ${money(limit, 0)}"><i class="${over ? 'over' : ''}" style="width:${percentage}%"></i></div>
    <div class="m-sub">Allocated ${money(used)} of ${money(limit)}</div>`;
};
const planView = () => {
  const el = h('div', {}, head(
    'Plan',
    'Split your monthly income across essentials, savings goals, debts and everyday spending. Every section shows what you can still allocate.'
  ));
  const tracker = h('div', { class: 'tracker', 'data-calc': '' });
  tracker._u = () => {
    const summary = D();
    const income = summary.income;
    const total = summary.totalBudgeted;
    const remaining = income - total;
    const scale = Math.max(income, total, 1);
    const isOverAllocated = remaining < -0.005;
    const shares = sum(Object.values(state.alloc), value => value);
    const sharesTotalOneHundred = Math.abs(shares - 100) < 0.01;
    const segments = CATS.map(([key,, color]) =>
      `<i style="width:${summary.budgeted[key] / scale * 100}%;background:var(--${color})"></i>`
    ).join('') + `<i style="width:${Math.max(remaining, 0) / scale * 100}%"></i>`;

    tracker.innerHTML = `<div class="t-row"><div><small>Income</small><b>${money(income, 0)}</b></div><div><small>Allocated</small><b>${money(total, 0)}</b></div>
      <div class="t-left ${isOverAllocated ? 'bad' : 'ok'}"><small>${isOverAllocated ? 'Over-allocated by' : 'Left to allocate'}</small><b>${money(Math.abs(remaining), 0)}</b></div>
      ${sharesTotalOneHundred ? '' : `<div class="bad t-warn">Shares add up to ${shares.toFixed(1)}%. They need to total 100%.</div>`}</div>
      <div class="split" role="img" aria-label="Income split by section">${segments}</div>`;
  };
  tracker._u();
  el.append(tracker);

  const grid = h('div', { class: 'bento' });
  el.append(grid);

  grid.append(tile(
    6,
    {},
    h('h2', {}, 'Income'),
    h('p', { class: 'sub' }, 'Per month. Pick a currency for each source and it is converted to NZD. Tap a source to edit it.'),
    incomeBody()
  ));

  const allocationSummary = h('section', { class: 'tile s-6', 'data-calc': '' });
  allocationSummary._u = () => {
    const summary = D();
    const rows = CATS.map(([category, name, color]) => {
      const left = summary.limit[category] - summary.budgeted[category];
      const isOver = left < -0.005;
      const limit = summary.limit[category];
      const used = summary.budgeted[category];
      const percentage = limit > 0
        ? Math.min(used / limit, 1) * 100
        : used > 0 ? 100 : 0;

      return `<div class="lrow"><span class="dot" style="background:var(--${color})"></span><span>${name}</span><span class="lbar"><i style="width:${percentage}%;background:${isOver ? 'var(--red)' : 'var(--' + color + ')'}"></i></span><b class="${isOver ? 'bad' : ''}">${money(Math.abs(left), 0)}${isOver ? ' over' : ''}</b></div>`;
    }).join('') + '</div>';
    allocationSummary.innerHTML =
      '<h2>Left to allocate</h2>' +
      '<p class="sub">What each section can still take this month.</p>' +
      '<div class="rows">' + rows;
  };
  allocationSummary._u();
  grid.append(allocationSummary);

  const allocationTile = (category, title, subtitle, body, span) => {
    const shareInput = h('input', {
      type: 'number',
      step: 'any',
      value: state.alloc[category],
      'aria-label': title + ' share of income'
    });
    shareInput.addEventListener('input', () => {
      state.alloc[category] = shareInput.value === '' ? 0 : parseFloat(shareInput.value);
      commit();
    });

    const meter = h('div', { class: 'meter', 'data-calc': '' });
    meter._u = () => {
      meter.innerHTML = meterHtml(category);
    };
    meter._u();

    const color = CATS.find(([key]) => key === category)[2];
    return tile(span, { style: '--sc:var(--' + color + ')' },
      h('div', { class: 'sec-head' }, h('h2', {}, title), h('label', { class: 'share' }, 'Share of income', shareInput, '%')),
      subtitle ? h('p', { class: 'sub' }, subtitle) : null,
      meter,
      body
    );
  };
  const expenses = (k, label) => expenseBody(k, label);
  const G = goal => D().goals[goal.id];
  const Dd = debt => D().debts[debt.id];
  const prog = (saved, total) => {
    const percentage = total > 0 ? Math.min(saved / total, 1) * 100 : 0;
    return {
      html: `<span class="mini"><i style="width:${percentage}%"></i></span>${money(saved, 0)} (${percentage.toFixed(0)}%)`
    };
  };

  grid.append(allocationTile(
    'essential',
    'Essential expenses',
    'Rent, food, transport and other costs you cannot skip. Tap one to edit it.',
    expenses('essential', 'Add essential expense'),
    6
  ));
  grid.append(allocationTile(
    'discretionary',
    'Discretionary expenses',
    'Eating out, treats and anything you can trim. Tap one to edit it.',
    expenses('discretionary', 'Add discretionary expense'),
    6
  ));
  grid.append(allocationTile(
    'savings',
    'Savings goals',
    'Tap a goal to see everything and change its monthly amount. Money already set aside comes from the Accounts page.',
    goalsBody(),
    12
  ));
  grid.append(allocationTile(
    'debt',
    'Debt service',
    'Tap a debt to see everything and set its monthly payment. Priority 1 is paid first.',
    debtsBody(),
    12
  ));
  return el;
};

const accFilter = () => {
  const filter = state.ui.accUser || 'all';
  const isKnownUser = state.users.some(user => user.id === filter);
  return filter === 'all' || filter === 'none' || isKnownUser ? filter : 'all';
};
const accMatch = account => {
  const filter = accFilter();
  if (filter === 'all') return true;
  if (filter === 'none') return !account.user;
  return account.user === filter;
};
const comMatch = commitment => {
  const account = state.accounts.find(item => item.id === commitment.account);
  return account ? accMatch(account) : true;
};
const visAcc = () => state.accounts.filter(accMatch);
/* ---------- accounts: lists whose rows expand in place ---------- */
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
function accItem(account) {
  const accountSummary = () => D().accounts[account.id] || {
    bal: 0,
    net: 0,
    committed: 0,
    free: 0,
    status: ''
  };
  const item = h('div', { class: 'acc-item', 'data-id': account.id });
  const currencyChip = h('span', { 'data-calc': '' });
  currencyChip._u = () => {
    currencyChip.className = 'li-chip cur-' + (account.currency || 'none');
    currencyChip.textContent = account.currency || '\u2014';
  };
  currencyChip._u();

  const header = h(
    'button',
    { class: 'tx-row li', type: 'button', 'aria-expanded': 'false' },
    currencyChip,
    h('span', { class: 'tx-main' },
      liv(() => esc(account.name || 'Untitled account'), 'b'),
      liv(() => `${esc(nameOf('users', account.user) || 'No user')}, ${money(accountSummary().net)} after liabilities`, 'small'),
      liv(() => {
        const status = accountSummary().status;
        return `<span class="pill ${cls(status)}" title="${esc(status)}">${esc(status)}</span>`;
      }, 'span')
    ),
    h('span', { class: 'tx-amt' },
      liv(() => {
        const free = accountSummary().free;
        return `<span class="${free < -0.005 ? 'bad' : ''}">${money(free)}</span>`;
      }, 'b'),
      h('small', {}, 'free to use')
    ),
    h('span', { class: 'tx-chev', 'aria-hidden': 'true' }, '\u203a')
  );
  const detail = h('div', { class: 'li-detail', hidden: true },
    h('div', { class: 'fgroup' },
      sRow('Account', field(sCol('Account', 'name', 'text', { ph: 'e.g. Everyday account' }), account)),
      sRow('User', field(sCol('User', 'user', 'select', { opts: userOpts }), account)),
      sRow('Currency', field(sCol('Currency', 'currency', 'select', {
        opts: curOpts,
        onChange: (oldCurrency, newCurrency) => {
          const from = rate(oldCurrency);
          const to = rate(newCurrency);
          if (from > 0 && to > 0) {
            state.commitments
              .filter(commitment =>
                commitment.account === account.id &&
                commitment.amount !== '' &&
                commitment.amount != null
              )
              .forEach(commitment => {
                commitment.amount = num(commitment.amount) * from / to;
              });
          }
        }
      }), account)),
      sRow('Balance', field(sCol('Balance', 'balance', 'number'), account)),
      sRow('Liabilities due', field(sCol('Liabilities due', 'liabilities', 'number'), account))
    ),
    h('div', { class: 'fgroup' },
      sCalc('Balance (NZD)', () => money(accountSummary().bal)),
      sCalc('After liabilities', () => money(accountSummary().net)),
      sCalc('Set aside (NZD)', () => money(accountSummary().committed)),
      sCalc('Free to use', () => money(accountSummary().free)),
      sCalc('Status', () => {
        const status = accountSummary().status;
        return { t: status, cls: cls(status) };
      })
    ),
    h('button', { class: 'btn danger full', type: 'button', onclick: () => {
      if (!confirm('Delete this account? Money set aside from it will be removed too.')) return;
      state.accounts = state.accounts.filter(row => row !== account);
      detach('accounts', account.id);
      commit();
      render();
    } }, 'Delete account'));
  expandable(item, header, detail);
  item._check = () => {
    if (!accMatch(account)) item.remove();
  };
  return item;
}
function comItem(c) {
  const kind = () => {
    if ((c.target || '').startsWith('debt:')) return 'debt';
    if ((c.target || '').startsWith('goal:')) return 'goal';
    return 'other';
  };
  const what = () => {
    if (kind() === 'debt') return nameOf('debts', c.target.slice(5)) || 'Unknown debt';
    if (kind() === 'goal') return nameOf('goals', c.target.slice(5)) || 'Unknown goal';
    return c.label || 'Something else';
  };
  const KIND = { debt: 'Debt', goal: 'Goal', other: 'Other' };
  const item = h('div', { class: 'acc-item', 'data-id': c.id });
  const accountInput = field(sCol('Account', 'account', 'select', {
    opts: accOpts,
    onChange: (oldAccountId, newAccountId) => {
      const oldRate = rate(accountCurrency(oldAccountId));
      const newRate = rate(accountCurrency(newAccountId));
      if (c.amount !== '' && c.amount != null && oldRate > 0 && newRate > 0) {
        c.amount = num(c.amount) * oldRate / newRate;
      }
    }
  }), c);
  const amountLabel = liv(
    () => `Amount (${esc(accountCurrency(c.account))})`,
    'span',
    'fl'
  );
  const amountInput = field(sCol('Amount (account currency)', 'amount', 'number'), c);
  const header = h(
    'button',
    { class: 'tx-row li', type: 'button', 'aria-expanded': 'false' },
    liv(() => txIcon(kind() === 'other' ? 'transfer' : kind()), 'span', 'li-ic'),
    h('span', { class: 'tx-main' },
      liv(() => esc(what()), 'b'),
      liv(() => 'From ' + esc(nameOf('accounts', c.account) || 'no account'), 'small'),
      liv(() => `<span class="pill neu">${KIND[kind()]}</span>`, 'span')
    ),
    h('span', { class: 'tx-amt' },
      liv(() => moneyCur(num(c.amount), accountCurrency(c.account)), 'b'),
      h('small', {}, 'set aside')
    ),
    h('span', { class: 'tx-chev', 'aria-hidden': 'true' }, '\u203a')
  );
  const detail = h('div', { class: 'li-detail one', hidden: true },
    h('div', { class: 'fgroup' },
      sRow('Account', accountInput),
      sRow('Set aside for', field(sCol('Set aside for', 'target', 'select', { opts: targetOpts }), c)),
      sRow('Note', field(sCol('Note (if something else)', 'label', 'text', { ph: 'e.g. Holiday fund' }), c)),
      h('label', { class: 'frow' }, amountLabel, amountInput)
    ),
    h('button', { class: 'btn danger full', type: 'button', onclick: () => {
      if (!confirm('Delete this line? This cannot be undone.')) return;
      state.commitments = state.commitments.filter(row => row !== c);
      item.remove();
      commit();
    } }, 'Delete this line'));
  expandable(item, header, detail);
  item._check = () => {
    if (!comMatch(c)) item.remove();
  };
  return item;
}
const KIND_COLOR = { income: '--c2', essential: '--c1', discretionary: '--c4' };
const KIND_ICON = { income: '<path d="M12 5v14M12 19l-5-5M12 19l5-5"/>', essential: '<path d="M4 11l8-7 8 7M6 10v9h12v-9"/>', discretionary: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/>' };
const kindIcon = kind => `<span class="tx-ic" style="--tc:var(${KIND_COLOR[kind]})"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${KIND_ICON[kind]}</svg></span>`;
const pctOf = (amount, total) => total > 0 ? num(amount) / total * 100 : 0;
function moneyItem(row, kind, labels, collection, shareOfSection) {
  const nameKey = kind === 'income' ? 'source' : 'name';
  const itemTitle = kind === 'income' ? 'income' : 'expense';
  const amountInNZD = () => num(row.amount) * rate(row.currency || 'NZD');
  const isForeignCurrency = () => row.currency && row.currency !== 'NZD';
  const item = h('div', { class: 'acc-item', 'data-id': row.id });
  const header = h('button', { class: 'tx-row li', type: 'button', 'aria-expanded': 'false' },
    liv(() => kindIcon(kind), 'span', 'li-ic'),
    h('span', { class: 'tx-main' },
      liv(() => esc(row[nameKey] || labels.untitled), 'b'),
      liv(() => esc(nameOf('users', row.user) || 'No user'), 'small'),
      liv(() => `<span class="pill neu">${pctOf(amountInNZD(), D().income).toFixed(0)}% of income</span>`, 'span')
    ),
    h('span', { class: 'tx-amt' },
      liv(() => money(amountInNZD()), 'b'),
      liv(() => isForeignCurrency()
        ? `${esc(row.currency)} ${num(row.amount).toLocaleString('en-NZ', { maximumFractionDigits: 2 })}`
        : 'a month', 'small')
    ),
    h('span', { class: 'tx-chev', 'aria-hidden': 'true' }, '\u203a')
  );
  const editable = [
    sRow(labels.field, field(sCol(labels.field, nameKey, 'text', { ph: labels.ph }), row)),
    sRow('User', field(sCol('User', 'user', 'select', { opts: userOpts }), row))
  ];
  if (labels.currency) {
    editable.push(sRow('Currency', field(sCol('Currency', 'currency', 'select', { opts: curOpts }), row)));
  }
  editable.push(sRow(labels.amount, field(sCol(labels.amount, 'amount', 'number'), row)));

  const insights = [];
  if (labels.currency) insights.push(sCalc('Amount in NZD', () => money(amountInNZD())));
  insights.push(sCalc('Share of income', () => pctOf(amountInNZD(), D().income).toFixed(1) + '%'));
  if (shareOfSection) {
    insights.push(sCalc(
      'Share of ' + labels.section,
      () => pctOf(amountInNZD(), D().budgeted[kind]).toFixed(1) + '%'
    ));
  }

  const detail = h('div', { class: 'li-detail one', hidden: true },
    h('div', { class: 'fgroup' }, editable),
    labels.currency
      ? liv(() => isForeignCurrency()
        ? 'Converted to NZD using the exchange rates on the Accounts page.'
        : '', 'p', 'hint')
      : null,
    h('div', { class: 'fgroup' }, insights),
    h('button', { class: 'btn danger full', type: 'button', onclick: () => {
      if (!confirm('Delete this ' + itemTitle + '? This cannot be undone.')) return;
      state[collection] = state[collection].filter(item => item !== row);
      item.remove();
      commit();
    } }, labels.del));
  expandable(item, header, detail);
  return item;
}
const incItem = row => moneyItem(row, 'income', {
  untitled: 'Untitled income',
  field: 'Source',
  ph: 'e.g. Salary',
  del: 'Delete income',
  currency: true,
  amount: 'Monthly amount'
}, 'income', false);
const expItem = row => moneyItem(row, row.category, {
  untitled: 'Untitled expense',
  field: 'Expense',
  ph: 'e.g. Groceries',
  del: 'Delete expense',
  amount: 'Monthly (NZD)',
  section: row.category === 'essential' ? 'essential expenses' : 'discretionary expenses'
}, 'expenses', true);
function incomeBody() {
  const { list, empty } = itemList('income', () => true, incItem, 'No income yet. Add the first source.');
  const add = () => {
    const income = {
      id: uid(),
      source: '',
      user: '',
      amount: '',
      currency: 'NZD'
    };
    state.income.push(income);
    dirty = true;

    const item = incItem(income);
    list.append(item);
    item._open(true);
    commit();

    const firstField = $('input', item);
    if (firstField) firstField.focus();
  };
  return h(
    'div',
    {},
    h('div', { class: 'li-wrap' }, list, empty),
    totalsEl(() => [
      ['Total monthly income', money(D().income)],
      ['Sources', String(state.income.length)]
    ]),
    h('button', { class: 'add', type: 'button', onclick: add }, 'Add income')
  );
}
function expenseBody(category, addLabel) {
  const { list, empty } = itemList(
    'expenses',
    expense => expense.category === category,
    expItem,
    'Nothing here yet. Add the first one.'
  );
  const add = () => {
    const expense = { id: uid(), name: '', category, user: '', amount: '' };
    state.expenses.push(expense);
    dirty = true;

    const item = expItem(expense);
    list.append(item);
    item._open(true);
    commit();

    const firstField = $('input', item);
    if (firstField) firstField.focus();
  };
  return h(
    'div',
    {},
    h('div', { class: 'li-wrap' }, list, empty),
    totalsEl(() => [
      ['Budgeted', money(D().budgeted[category])],
      ['Share of income', pctOf(D().budgeted[category], D().income).toFixed(1) + '%'],
      ['Items', String(state.expenses.filter(expense => expense.category === category).length)]
    ]),
    h('button', { class: 'add', type: 'button', onclick: add }, addLabel)
  );
}

function goalItem(goal) {
  const goalSummary = () => D().goals[goal.id] || {
    saved: 0,
    hasTarget: false,
    status: '',
    remaining: 0,
    projected: null,
    required: null
  };
  const percentage = () => {
    const summary = goalSummary();
    return summary.hasTarget && num(goal.target) > 0
      ? Math.min(summary.saved / num(goal.target), 1) * 100
      : 0;
  };
  const item = h('div', { class: 'acc-item', 'data-id': goal.id });
  const header = h(
    'button',
    { class: 'tx-row li', type: 'button', 'aria-expanded': 'false' },
    liv(() => ring(percentage()), 'span', 'li-ringw'),
    h('span', { class: 'tx-main' },
      liv(() => esc(goal.name || 'Untitled goal'), 'b'),
      liv(() => {
        const summary = goalSummary();
        const savedText = summary.hasTarget
          ? 'Saved ' + money(summary.saved, 0) + ' of ' + money(num(goal.target), 0)
          : 'No target set';
        const reachedText = summary.projected
          ? ', reached ' + fmtDate(summary.projected)
          : '';
        return savedText + reachedText;
      }, 'small'),
      liv(() => {
        const status = goalSummary().status;
        return `<span class="pill ${cls(status)}" title="${esc(status)}">${esc(status)}</span>`;
      }, 'span')
    ),
    h('span', { class: 'tx-amt' },
      liv(() => money(num(goal.monthly)), 'b'),
      h('small', {}, 'a month')
    ),
    h('span', { class: 'tx-chev', 'aria-hidden': 'true' }, '\u203a')
  );
  const detail = h('div', { class: 'li-detail', hidden: true },
    h('div', { class: 'fgroup' },
      sRow('Goal', field(sCol('Goal', 'name', 'text', { ph: 'e.g. House deposit' }), goal)),
      sRow('User', field(sCol('User', 'user', 'select', { opts: userOpts }), goal)),
      sRow('Target (NZD)', field(sCol('Target (NZD)', 'target', 'number'), goal)),
      sRow('Target date', field(sCol('Target date', 'date', 'date'), goal)),
      sRow('Monthly (NZD)', field(sCol('Monthly (NZD)', 'monthly', 'number'), goal))
    ),
    h('div', { class: 'fgroup' },
      sCalc('Saved so far', () => {
        const summary = goalSummary();
        return summary.hasTarget
          ? progH(summary.saved, num(goal.target))
          : money(summary.saved);
      }),
      sCalc('Still to save', () => {
        const summary = goalSummary();
        return summary.hasTarget ? money(summary.remaining) : '\u2014';
      }),
      sCalc('Reached by', () => {
        const projected = goalSummary().projected;
        return projected ? fmtDate(projected) : '\u2014';
      }),
      sCalc('Needed monthly', () => {
        const required = goalSummary().required;
        return required == null ? '\u2014' : money(required);
      }),
      sCalc('Status', () => {
        const status = goalSummary().status;
        return { t: status, cls: cls(status) };
      })
    ),
    h('button', { class: 'btn danger full', type: 'button', onclick: () => {
      if (!confirm('Delete this goal? Money set aside for it will be kept as "something else".')) return;
      state.goals = state.goals.filter(row => row !== goal);
      detach('goals', goal.id);
      item.remove();
      commit();
    } }, 'Delete goal'));
  expandable(item, header, detail);
  return item;
}
function debtItem(debt) {
  const debtSummary = () => D().debts[debt.id] || {
    bal: 0,
    funded: 0,
    unfunded: 0,
    status: '',
    projected: null,
    required: null
  };
  const percentage = () => {
    const summary = debtSummary();
    return summary.bal > 0 ? Math.min(summary.funded / summary.bal, 1) * 100 : 0;
  };
  const item = h('div', { class: 'acc-item', 'data-id': debt.id });
  const header = h(
    'button',
    { class: 'tx-row li', type: 'button', 'aria-expanded': 'false' },
    liv(() => ring(percentage()), 'span', 'li-ringw'),
    h('span', { class: 'tx-main' },
      liv(() => esc(debt.name || 'Untitled debt'), 'b'),
      liv(() => {
        const summary = debtSummary();
        const coverageText = summary.unfunded < 0.005
          ? 'fully covered' + (summary.funded - summary.bal > 0.5
            ? ', ' + money(summary.funded - summary.bal, 0) + ' extra set aside'
            : '')
          : money(summary.unfunded, 0) + ' still to find';
        const dueText = debt.due ? ', due ' + dueDate(debt.due) : '';
        return `${money(summary.bal, 0)} owed, ${coverageText}${dueText}`;
      }, 'small'),
      liv(() => {
        const status = debtSummary().status;
        return `<span class="pill ${cls(status)}" title="${esc(status)}">${esc(status)}</span>`;
      }, 'span')
    ),
    h('span', { class: 'tx-amt' },
      liv(() => money(num(debt.monthly)), 'b'),
      h('small', {}, 'a month')
    ),
    h('span', { class: 'tx-chev', 'aria-hidden': 'true' }, '\u203a')
  );
  const detail = h('div', { class: 'li-detail', hidden: true },
    h('div', { class: 'fgroup' },
      sRow('Debt', field(sCol('Debt', 'name', 'text', { ph: 'e.g. Car loan' }), debt)),
      sRow('Priority', field(sCol('Priority', 'priority', 'number'), debt)),
      sRow('Borrower', field(sCol('Borrower', 'borrower', 'select', { opts: userOpts }), debt)),
      sRow('Owed to', field(sCol('Owed to', 'creditor', 'text'), debt)),
      sRow('Due date', field(sCol('Due date', 'due', 'date'), debt)),
      sRow('Currency', field(sCol('Currency', 'currency', 'select', { opts: curOpts }), debt)),
      sRow('Balance', field(sCol('Balance', 'balance', 'number'), debt)),
      sRow('Monthly payment (NZD)', field(sCol('Monthly payment (NZD)', 'monthly', 'number'), debt))
    ),
    h('div', { class: 'fgroup' },
      sCalc('Balance (NZD)', () => money(debtSummary().bal)),
      sCalc('Covered so far', () => progH(debtSummary().funded, debtSummary().bal)),
      sCalc('Still to find', () => money(debtSummary().unfunded)),
      sCalc('Repaid by', () => {
        const summary = debtSummary();
        return summary.projected && summary.bal > 0
          ? fmtDate(summary.projected)
          : '\u2014';
      }),
      sCalc('Needed monthly', () => {
        const required = debtSummary().required;
        return required == null ? '\u2014' : money(required);
      }),
      sCalc('Status', () => {
        const status = debtSummary().status;
        return { t: status, cls: cls(status) };
      })
    ),
    h('button', { class: 'btn danger full', type: 'button', onclick: () => {
      if (!confirm('Delete this debt? Money set aside for it will be kept as "something else".')) return;
      state.debts = state.debts.filter(row => row !== debt);
      detach('debts', debt.id);
      item.remove();
      commit();
    } }, 'Delete debt'));
  expandable(item, header, detail);
  return item;
}
const byPriority = (first, second) => {
  const firstPriority = first.priority === '' || first.priority == null
    ? 999
    : num(first.priority);
  const secondPriority = second.priority === '' || second.priority == null
    ? 999
    : num(second.priority);
  return firstPriority - secondPriority;
};
function goalsBody() {
  const { list, empty } = itemList('goals', () => true, goalItem, 'No goals yet. Add the first one.');
  const add = () => {
    const goal = { id: uid(), name: '', user: '', target: '', date: '', monthly: '' };
    state.goals.push(goal);
    dirty = true;

    const item = goalItem(goal);
    list.append(item);
    item._open(true);
    commit();

    const firstField = $('input', item);
    if (firstField) firstField.focus();
  };
  return h(
    'div',
    {},
    h('div', { class: 'li-wrap' }, list, empty),
    totalsEl(() => [
      ['Target total', money(sum(state.goals, 'target'))],
      ['Saved so far', money(sum(Object.values(D().goals), 'saved'))],
      ['Monthly total', money(sum(state.goals, 'monthly'))]
    ]),
    h('button', { class: 'add', type: 'button', onclick: add }, 'Add goal')
  );
}
function debtsBody() {
  const list = h('div', { class: 'tx-card acc-list' });
  state.debts.slice().sort(byPriority).forEach(debt => list.append(debtItem(debt)));
  const empty = liv(
    () => list.children.length ? '' : '<p class="empty">No debts recorded. Add the first one.</p>',
    'div'
  );
  const add = () => {
    const debt = {
      id: uid(),
      name: '',
      priority: '',
      borrower: '',
      creditor: '',
      due: '',
      currency: 'NZD',
      balance: '',
      monthly: ''
    };
    state.debts.push(debt);
    dirty = true;

    const item = debtItem(debt);
    list.append(item);
    item._open(true);
    commit();

    const firstField = $('input', item);
    if (firstField) firstField.focus();
  };
  return h(
    'div',
    {},
    h('div', { class: 'li-wrap' }, list, empty),
    totalsEl(() => {
      const summary = D();
      return [
        ['Owed (NZD)', money(summary.debtTotal)],
        ['Covered', money(summary.debtFunded)],
        ['Still to find', money(summary.debtUnfunded)],
        ['Monthly total', money(sum(state.debts, 'monthly'))]
      ];
    }),
    h('button', { class: 'add', type: 'button', onclick: add }, 'Add debt')
  );
}

function accountsTile() {
  const { list, empty } = itemList('accounts', accMatch, accItem, 'No accounts for this selection. Add one below.');
  const add = () => {
    const filter = accFilter();
    const account = {
      id: uid(),
      name: '',
      user: filter !== 'all' && filter !== 'none' ? filter : '',
      currency: 'NZD',
      balance: '',
      liabilities: ''
    };
    state.accounts.push(account);
    dirty = true;

    const item = accItem(account);
    list.append(item);
    item._open(true);
    commit();

    const firstField = $('input', item);
    if (firstField) firstField.focus();
  };
  return tile(
    12,
    {},
    h('h2', {}, 'Account balances'),
    h('p', { class: 'sub' }, 'Tap an account to see and edit everything. Liabilities are bills due soon. Set aside is money already promised, listed in the next section.'),
    h('div', { class: 'li-wrap' }, list, empty),
    totalsEl(() => {
      const accounts = visAcc()
        .map(account => D().accounts[account.id])
        .filter(Boolean);
      return [
        ['Balance (NZD)', money(sum(accounts, 'bal'))],
        ['After liabilities', money(sum(accounts, 'net'))],
        ['Set aside (NZD)', money(sum(accounts, 'committed'))],
        ['Free to use', money(sum(accounts, 'free'))]
      ];
    }),
    h('button', { class: 'add', type: 'button', onclick: add }, 'Add account')
  );
}
function setAsideTile() {
  const { list, empty } = itemList('commitments', comMatch, comItem, 'Nothing set aside for this selection yet. Add a line below.');
  const add = () => {
    const visibleAccounts = visAcc();
    const filter = accFilter();
    const commitment = {
      id: uid(),
      account: filter !== 'all' && visibleAccounts.length ? visibleAccounts[0].id : '',
      target: 'other',
      label: '',
      amount: ''
    };
    state.commitments.push(commitment);
    dirty = true;

    const item = comItem(commitment);
    list.append(item);
    item._open(true);
    commit();

    const firstField = $('select,input', item);
    if (firstField) firstField.focus();
  };
  return tile(
    12,
    {},
    h('h2', {}, 'Money set aside'),
    h('p', { class: 'sub' }, 'Each amount uses its selected account currency. The combined total is shown in NZD. Tap a line to edit it.'),
    h('div', { class: 'li-wrap' }, list, empty),
    totalsEl(() => {
      const commitments = state.commitments.filter(comMatch);
      const totalInNZD = sum(
        commitments,
        commitment => num(commitment.amount) * rate(accountCurrency(commitment.account))
      );
      return [
        ['Total set aside (NZD)', money(totalInNZD)],
        ['Lines', String(commitments.length)]
      ];
    }),
    h('button', { class: 'add', type: 'button', onclick: add }, 'Add a line')
  );
}

const accountsView = () => {
  const selectedFilter = accFilter();
  const el = h('div', {}, head(
    'Accounts',
    'Balances stay in each account\u2019s own currency and are converted to NZD with the rates below. Use the filter to look at one person at a time.'
  ));
  const countAccounts = userId => state.accounts.filter(account => {
    if (userId === 'all') return true;
    if (userId === 'none') return !account.user;
    return account.user === userId;
  }).length;
  const filterItems = [
    ['all', 'All', countAccounts('all')],
    ...state.users.map(user => [
      user.id,
      user.name || '(unnamed)',
      countAccounts(user.id)
    ])
  ];
  if (countAccounts('none')) {
    filterItems.push(['none', 'No user', countAccounts('none')]);
  }
  const fxInput = (key, label) => {
    const input = h('input', {
      type: 'number',
      step: 'any',
      value: state.fx[key],
      'aria-label': label
    });
    input.addEventListener('input', () => {
      state.fx[key] = input.value === '' ? 0 : parseFloat(input.value);
      state.fx[key + 'UpdatedAt'] = null;
      fxStatusText = `Using the manually entered ${key === 'php' ? 'PHP/NZD' : 'USD/NZD'} rate.`;
      updateFxStatus();
      commit();
    });
    return h('label', {}, label, input);
  };
  const filter = seg(
    filterItems,
    selectedFilter,
    userId => {
      state.ui.accUser = userId;
      save();
      render();
    },
    'Filter by user'
  );
  const exchangeRates = h(
    'div',
    { class: 'fx' },
    fxInput('php', 'PHP per 1 NZD'),
    fxInput('usd', 'NZD per 1 USD'),
    h('button', {
      id: 'fx-refresh',
      class: 'btn plain',
      type: 'button',
      onclick: () => refreshExchangeRates()
    }, 'Refresh exchange rates'),
    h('span', {
      id: 'fx-status',
      class: 'fx-status',
      role: 'status',
      'aria-live': 'polite'
    }, fxStatusText),
    h('span', { class: 'fx-status' }, 'Rates are the provider’s latest published values (typically updated daily), not streaming market quotes.')
  );
  el.append(h('div', { class: 'toolbar' }, filter, exchangeRates));

  const selectedTotal = key => () => {
    const accounts = visAcc()
      .map(account => D().accounts[account.id])
      .filter(Boolean);
    return money(sum(accounts, key), 0);
  };
  el.append(bento(
    kpiTile('Balance (NZD)', selectedTotal('bal'), 'all selected accounts'),
    kpiTile('After liabilities', selectedTotal('net'), 'balance less bills due'),
    kpiTile('Set aside', selectedTotal('committed'), 'promised to something'),
    kpiTile('Free to use', selectedTotal('free'), 'after liabilities and set aside'),
    accountsTile(), setAsideTile()));
  return el;
};

const TYPES = [
  ['income', 'Income'],
  ['expense', 'Expense'],
  ['debt', 'Debt payment'],
  ['goal', 'Goal contribution'],
  ['transfer', 'Transfer']
];
const TYPE_LABEL = Object.fromEntries(TYPES);
const txNZD = transaction => {
  const account = state.accounts.find(item => item.id === transaction.account);
  return num(transaction.amount) * (account ? rate(account.currency) : 1);
};
const TX_IC = {
  income: ['--green', '<path d="M12 5v14M12 19l-5-5M12 19l5-5"/>'],
  expense: ['--orange', '<path d="M12 19V5M12 5l-5 5M12 5l5 5"/>'],
  debt: ['--red', '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 10h18"/>'],
  goal: ['--blue', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>'],
  transfer: ['--indigo', '<path d="M5 9h13M18 9l-3-3M18 9l-3 3M19 15H6M6 15l3-3M6 15l3 3"/>']
};
const txIcon = type => {
  const [color, path] = TX_IC[type] || TX_IC.transfer;
  return `<span class="tx-ic" style="--tc:var(${color})"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></span>`;
};
const hasAmount = transaction => !(transaction.amount === '' || transaction.amount == null);
function txRowEl(transaction) {
  const account = state.accounts.find(item => item.id === transaction.account);
  const currency = account ? account.currency : 'NZD';
  const isIncome = transaction.type === 'income';
  const sign = transaction.type === 'transfer' ? '' : (isIncome ? '+' : '\u2212');
  const subheading = [
    transaction.date
      ? fmtDate(new Date(transaction.date + 'T00:00:00'))
      : 'No date',
    account ? account.name : 'No account'
  ].join(', ');
  const originalAmount = currency !== 'NZD' && hasAmount(transaction)
    ? ', ' + currency + ' ' + num(transaction.amount).toLocaleString('en-NZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    : '';
  const row = h('button', {
    class: 'tx-row',
    type: 'button',
    'data-id': transaction.id,
    onclick: () => openTxSheet(transaction, false)
  });
  row.innerHTML = `${txIcon(transaction.type)}<span class="tx-main"><b>${esc(transaction.description || 'Untitled')}</b><small>${esc(subheading)}</small></span>
    <span class="tx-amt"><b class="${isIncome ? 'ok' : ''}">${hasAmount(transaction) ? sign + money(Math.abs(txNZD(transaction))) : '\u2014'}</b><small>${esc(TYPE_LABEL[transaction.type] || '')}${esc(originalAmount)}</small></span><span class="tx-chev" aria-hidden="true">\u203a</span>`;
  return row;
}
function txList() {
  const wrap = h('div', { class: 'tx-list', 'data-calc': '' });
  wrap._u = () => {
    const selectedType = state.ui.txType || 'all';
    const transactions = state.transactions
      .filter(transaction => selectedType === 'all' || transaction.type === selectedType)
      .slice()
      .sort((first, second) =>
        (second.date || '9999-99-99').localeCompare(first.date || '9999-99-99')
      );
    wrap.innerHTML = '';
    if (!transactions.length) {
      const message = state.transactions.length
        ? 'No transactions of this type.'
        : 'No transactions yet. Add the first one.';
      wrap.append(h('p', { class: 'empty' }, message));
      return;
    }

    const groups = [];
    for (const transaction of transactions) {
      const month = transaction.date ? transaction.date.slice(0, 7) : 'none';
      let group = groups[groups.length - 1];
      if (!group || group.month !== month) {
        group = { month, transactions: [] };
        groups.push(group);
      }
      group.transactions.push(transaction);
    }

    for (const group of groups) {
      const income = group.transactions.filter(transaction => transaction.type === 'income');
      const outflows = group.transactions.filter(transaction =>
        ['expense', 'debt', 'goal'].includes(transaction.type)
      );
      const net = sum(income, txNZD) - sum(outflows, txNZD);
      const label = group.month === 'none'
        ? 'No date'
        : new Date(group.month + '-01T00:00:00').toLocaleDateString('en-NZ', {
          month: 'long',
          year: 'numeric'
        });
      const netLabel = 'Net ' + (net < 0 ? '\u2212' : '+') + money(Math.abs(net));
      const header = h(
        'div',
        { class: 'tx-month' },
        h('span', {}, label),
        h('span', { class: net < 0 ? 'bad' : '' }, netLabel)
      );
      const rows = h('div', { class: 'tx-card' }, group.transactions.map(txRowEl));
      wrap.append(h('div', { class: 'tx-group' }, header, rows));
    }
  };
  wrap._u();
  return wrap;
}

/* ---------- slide-up sheet ---------- */
let sheet = null;
function closeSheet(immediate) {
  if (!sheet) return;
  const currentSheet = sheet;
  sheet = null;

  $$('[data-calc],[data-opts]', currentSheet.back).forEach(element => {
    element.removeAttribute('data-calc');
    element.removeAttribute('data-opts');
  });
  document.removeEventListener('keydown', currentSheet.onKey);
  document.body.style.overflow = '';

  if (immediate || matchMedia('(prefers-reduced-motion:reduce)').matches) {
    currentSheet.back.remove();
  } else {
    currentSheet.back.classList.remove('in');
    setTimeout(() => currentSheet.back.remove(), 320);
  }

  if (currentSheet.isNew && currentSheet.isBlank(currentSheet.row)) {
    state[currentSheet.coll] = state[currentSheet.coll]
      .filter(row => row !== currentSheet.row);
  }
  commit();
  const transactionButton = $(`.tx-row[data-id="${currentSheet.row.id}"]`);
  if (transactionButton) transactionButton.focus();
}
function openFormSheet(cfg) {
  closeSheet(true);
  const { row, coll, isNew } = cfg;
  const newItemState = { value: isNew };
  const back = h('div', { class: 'sheet-back' });
  const panel = h('div', {
    class: 'sheet-panel',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'sheet-title',
    tabindex: '-1'
  });
  const grab = h('div', { class: 'sheet-grab' });
  const heading = h(
    'div',
    { class: 'sheet-head' },
    h('h2', { id: 'sheet-title' }, isNew ? cfg.newTitle : cfg.title),
    h('button', { class: 'done', type: 'button', onclick: () => closeSheet() }, 'Done')
  );
  const top = h('div', { class: 'sheet-top' }, grab, heading);
  panel.append(top);
  if (cfg.summary) panel.append(cfg.summary);
  cfg.groups.forEach(group => panel.append(h('div', { class: 'fgroup' }, group)));
  panel.append(h('button', {
    class: 'btn danger full',
    type: 'button',
    onclick: () => {
      if (!confirm(cfg.confirmText)) return;
      state[coll] = state[coll].filter(item => item !== row);
      detach(coll, row.id);
      newItemState.value = false;
      closeSheet();
    }
  }, cfg.deleteLabel));

  const onKey = e => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSheet();
      return;
    }
    if (e.key === 'Tab') {
      const focusableElements = $$('input,select,button', panel)
        .filter(element => !element.disabled && element.offsetParent !== null);
      if (!focusableElements.length) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  back.addEventListener('pointerdown', event => {
    if (event.target === back) closeSheet();
  });
  let sy = null;
  top.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;
    sy = event.clientY;
    try {
      top.setPointerCapture(event.pointerId);
    } catch (error) {}
    panel.style.transition = 'none';
  });
  top.addEventListener('pointermove', event => {
    if (sy == null) return;
    panel.style.transform = `translate(-50%,${Math.max(0, event.clientY - sy)}px)`;
  });
  const endDrag = event => {
    if (sy == null) return;
    const distance = Math.max(0, event.clientY - sy);
    sy = null;
    panel.style.transition = '';
    panel.style.transform = '';
    if (distance > 110) closeSheet();
  };
  top.addEventListener('pointerup', endDrag);
  top.addEventListener('pointercancel', endDrag);

  back.append(panel);
  document.body.append(back);
  document.body.style.overflow = 'hidden';
  sheet = {
    back,
    onKey,
    row,
    coll,
    isBlank: cfg.isBlank,
    get isNew() {
      return newItemState.value;
    }
  };
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => {
    back.classList.add('in');
    (isNew ? $('.frow input', panel) : panel).focus();
  });
}
const sRow = (label, ctrl) => h('label', { class: 'frow' }, h('span', { class: 'fl' }, label), ctrl);
const sCalc = (label, fn) => h('div', { class: 'frow' }, h('span', { class: 'fl' }, label), calcEl(fn));
const sCol = (label, key, type, extra) => Object.assign({ label, key, type }, extra);
function openTxSheet(row, isNew) {
  openFormSheet({
    row,
    isNew,
    coll: 'transactions',
    title: 'Transaction',
    newTitle: 'New transaction',
    deleteLabel: 'Delete transaction',
    confirmText: 'Delete this transaction? This cannot be undone.',
    isBlank: r => !r.description && !hasAmount(r) && !r.related,
    groups: [
      [
        sRow('Description', field(sCol('Description', 'description', 'text', { ph: 'What was it for?' }), row)),
        sRow('Amount', field(sCol('Amount (account currency)', 'amount', 'number'), row)),
        sRow('Date', field(sCol('Date', 'date', 'date'), row))
      ],
      [
        sRow('Type', field(sCol('Type', 'type', 'select', {
          opts: () => TYPES.map(([value, label]) => ({ v: value, t: label }))
        }), row)),
        sRow('Account', field(sCol('Account', 'account', 'select', { opts: accOpts }), row)),
        sRow('User', field(sCol('User', 'user', 'select', { opts: userOpts }), row)),
        sRow('Related item', field(sCol('Related item', 'related', 'text', {
          ph: 'Expense, debt or goal name'
        }), row))
      ],
      [
        sCalc('Currency', () =>
          (state.accounts.find(account => account.id === row.account) || {}).currency || 'NZD'
        ),
        sCalc('Amount in NZD', () =>
          hasAmount(row) ? money(txNZD(row)) : '\u2014'
        )
      ]
    ]
  });
}

/* goals and debts as lists */
const ring = p => `<span class="li-ring"><svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><circle class="rg-bg" cx="22" cy="22" r="18"/><circle class="rg-fg" cx="22" cy="22" r="18" stroke-dasharray="${(p / 100 * 113.1).toFixed(1)} 113.1" transform="rotate(-90 22 22)"${p < 0.5 ? ' style="display:none"' : ''}/></svg><b>${Math.round(p)}%</b></span>`;
const progH = (saved, total) => {
  const percentage = total > 0 ? Math.min(saved / total, 1) * 100 : 0;
  return {
    html: `<span class="mini"><i style="width:${percentage}%"></i></span>${money(saved, 0)} (${percentage.toFixed(0)}%)`
  };
};
const dueDate = s => fmtDate(new Date(s + 'T00:00:00'));
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
const txView = () => {
  const el = h('div', {}, head(
    'Transactions',
    'A record of money in and out. It is for tracking only and does not change balances or the budget. Tap a transaction to see and edit the details.'
  ));
  const selectedType = state.ui.txType || 'all';
  const totalByType = type => () => money(
    sum(state.transactions.filter(transaction => transaction.type === type), txNZD)
  );
  const countByType = type => type === 'all'
    ? state.transactions.length
    : state.transactions.filter(transaction => transaction.type === type).length;
  const addTransaction = () => {
    const transaction = {
      id: uid(),
      date: new Date().toISOString().slice(0, 10),
      user: '',
      account: '',
      type: selectedType !== 'all' ? selectedType : 'expense',
      related: '',
      description: '',
      amount: ''
    };
    state.transactions.push(transaction);
    commit();
    openTxSheet(transaction, true);
  };
  const filterItems = [['all', 'All'], ...TYPES];
  const filters = h(
    'div',
    { class: 'fl-list', role: 'group', 'aria-label': 'Filter by type' },
    filterItems.map(([type, label]) => h('button', {
      class: 'fl-b',
      type: 'button',
      'aria-pressed': String(selectedType === type),
      onclick: () => {
        state.ui.txType = type;
        save();
        render();
      }
    },
    h('span', {}, label),
    h('span', { class: 'n' }, String(countByType(type)))))
  );
  const side = tile(
    4,
    { class: 'tx-side' },
    h('h2', {}, 'Show'),
    filters,
    h('button', {
      class: 'btn full',
      type: 'button',
      onclick: addTransaction
    }, 'Add transaction')
  );
  el.append(bento(
    kpiTile('Income', totalByType('income'), 'money in'),
    kpiTile('Expenses', totalByType('expense'), 'everyday spending'),
    kpiTile('Debt payments', totalByType('debt'), 'paid towards debts'),
    kpiTile('Goal contributions', totalByType('goal'), 'put towards goals'),
    tile(8, { class: 'tx-list-tile' }, h('h2', {}, 'All transactions'), txList()),
    side
  ));
  return el;
};

const dataView = () => {
  const storageMessage = storageOK
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
    state = blank();
    legacy = false;
    state.ui.tab = 'data';
    dirty = true;
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

      state = normalize(importedData);
      legacy = false;
      state.ui.tab = 'dashboard';
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
function startImport() {
  importInput.click();
}
function hasData() {
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
  return collections.some(collection => state[collection].length);
}

/* ---------- shell ---------- */
const TABS = [
  ['dashboard', 'Dashboard', dashView, 'dashboard', 'Dashboard'],
  ['plan', 'Plan', planView, 'plan', 'Plan'],
  ['accounts', 'Accounts', accountsView, 'accounts', 'Accounts'],
  ['transactions', 'Transactions', txView, 'transactions', 'Activity'],
  ['data', 'People and data', dataView, 'people', 'People']
];
function renderNav() {
  const nav = $('#nav');
  nav.innerHTML = '';
  nav.append(h('div', { class: 'brand' }, 'Household planner'));
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
  const saveStatus = storageOK ? 'Saved on this device' : 'Not saving';
  nav.append(h(
    'div',
    { class: 'nav-foot' },
    themeSeg(),
    h('span', {}, saveStatus)
  ));
}
function render() {
  dirty = true;
  const main = $('#main');
  main.innerHTML = '';
  if (!storageOK) {
    main.append(h(
      'div',
      { class: 'banner', role: 'status' },
      'Saving is blocked here, so changes will be lost when you close this page. Download the file and open it in your browser to save.'
    ));
  }
  if (legacy) {
    const clearLegacyData = () => {
      if (!confirm('Clear all saved data from this browser? Export a copy first if you want to keep it.')) {
        return;
      }
      state = blank();
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
