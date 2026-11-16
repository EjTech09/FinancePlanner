(() => {
  'use strict';

  const currency = Object.freeze({
    BASE: 'NZD'
  });
  window.HouseholdPlannerConstants = window.HouseholdPlannerConstants || {};
  window.HouseholdPlannerConstants.domain = Object.freeze({
    FILTER_ALL: 'all',
    FILTER_NONE: 'none',
    MONEY_EPSILON: 0.005,
    CURRENCY: currency,
    DEFAULT_CURRENCY: currency.BASE,
    COMMITMENT_OTHER_TARGET: 'other'
  });
})();
