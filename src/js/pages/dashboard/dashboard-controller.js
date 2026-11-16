(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.dashboard = context => {
    const service = window.HouseholdPlannerPages.dashboardService(context);
    const view = window.HouseholdPlannerPages.dashboardView(context, service);
    return () => view(service.startFromScratch);
  };
})();
