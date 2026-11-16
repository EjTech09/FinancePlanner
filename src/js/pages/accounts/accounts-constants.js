(() => {
  'use strict';

  window.HouseholdPlannerConstants = window.HouseholdPlannerConstants || {};
  const otherKind = window.HouseholdPlannerConstants.domain.COMMITMENT_OTHER_TARGET;
  const kind = Object.freeze({
    DEBT: 'debt',
    GOAL: 'goal',
    OTHER: otherKind,
    DEBT_PREFIX: 'debt:',
    GOAL_PREFIX: 'goal:'
  });
  window.HouseholdPlannerConstants.accounts = Object.freeze({
    COMMITMENT_KIND: kind,
    COMMITMENT_KIND_LABELS: Object.freeze({
      [kind.DEBT]: 'Debt',
      [kind.GOAL]: 'Goal',
      [kind.OTHER]: 'Other'
    })
  });
})();
