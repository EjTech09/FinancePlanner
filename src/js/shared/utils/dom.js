(() => {
  'use strict';

  /**
   * Small DOM utilities used across the app.
   *
   * Centralises element creation, ID generation, safe HTML escaping, and common
   * money/date formatting helpers so pages can share a consistent rendering API.
   */
  let nextGeneratedId = 0;
  const generateUniqueId = () => 'i' + Date.now().toString(36) + (nextGeneratedId++).toString(36);
  const querySelector = (selector, rootElement = document) => rootElement.querySelector(selector);
  const querySelectorAll = (selector, rootElement = document) => [...rootElement.querySelectorAll(selector)];

  const formatMoney = (amount, fractionDigits = 2) => new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: window.HouseholdPlannerConstants.domain.DEFAULT_CURRENCY,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(amount);

  const formatMoneyInCurrency = (amount, currency) => new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: /^[A-Z]{3}$/.test(currency || '')
      ? currency
      : window.HouseholdPlannerConstants.domain.DEFAULT_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
  
  const formatDate = dateValue => dateValue.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  function createElement(tagName, attributes, ...children) {
    const createdElement = document.createElement(tagName);
    for (const attributeName in attributes || {}) {
      const attributeValue = attributes[attributeName];
      if (attributeName === 'class') createdElement.className = attributeValue;
      else if (attributeName.startsWith('on')) createdElement.addEventListener(attributeName.slice(2), attributeValue);
      else if (attributeValue !== false && attributeValue != null) {
        createdElement.setAttribute(attributeName, attributeValue === true ? '' : attributeValue);
      }
    }
    for (const childNode of children.flat()) {
      if (childNode == null || childNode === false) continue;
      createdElement.append(childNode.nodeType ? childNode : document.createTextNode(childNode));
    }
    return createdElement;
  }

  window.HouseholdPlannerDom = Object.freeze({
    uid: generateUniqueId,
    $: querySelector,
    $$: querySelectorAll,
    money: formatMoney,
    moneyCur: formatMoneyInCurrency,
    esc: escapeHtml,
    fmtDate: formatDate,
    h: createElement
  });
})();
