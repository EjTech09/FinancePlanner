(() => {
  'use strict';

  /**
   * Small DOM utilities used across the app.
   *
   * Centralises element creation, ID generation, safe HTML escaping, and common
   * money/date formatting helpers so pages can share a consistent rendering API.
   */
  let nextId = 0;
  const uid = () => 'i' + Date.now().toString(36) + (nextId++).toString(36);
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
    const element = document.createElement(tag);
    for (const key in attrs || {}) {
      const value = attrs[key];
      if (key === 'class') element.className = value;
      else if (key.startsWith('on')) element.addEventListener(key.slice(2), value);
      else if (value !== false && value != null) {
        element.setAttribute(key, value === true ? '' : value);
      }
    }
    for (const child of kids.flat()) {
      if (child == null || child === false) continue;
      element.append(child.nodeType ? child : document.createTextNode(child));
    }
    return element;
  }

  window.HouseholdPlannerDom = Object.freeze({
    uid,
    $,
    $$,
    money,
    moneyCur,
    esc,
    fmtDate,
    h
  });
})();
