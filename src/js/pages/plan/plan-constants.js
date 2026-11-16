(() => {
  'use strict';

  window.HouseholdPlannerConstants = window.HouseholdPlannerConstants || {};
  window.HouseholdPlannerConstants.plan = Object.freeze({
    KIND_COLOR: Object.freeze({
      income: '--c2',
      essential: '--c1',
      discretionary: '--c4'
    }),
    KIND_ICON: Object.freeze({
      income: '<path d="M12 5v14M12 19l-5-5M12 19l5-5"/>',
      essential: '<path d="M4 11l8-7 8 7M6 10v9h12v-9"/>',
      discretionary: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/>'
    })
  });
})();
