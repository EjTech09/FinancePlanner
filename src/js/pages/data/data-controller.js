(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.data = context => {
    const DATA_CONSTANTS = window.HouseholdPlannerConstants.data;
    const { state, h, save, render } = context;
    const service = window.HouseholdPlannerPages.dataService(context);
    const view = window.HouseholdPlannerPages.dataView(context, service);

    const exportJson = () => {
      const data = new Blob([JSON.stringify(state, null, 2)], {
        type: 'application/json'
      });
      const link = h('a', {
        href: URL.createObjectURL(data),
        download: DATA_CONSTANTS.EXPORT_FILENAME
      });
      document.body.append(link);
      link.click();
      link.remove();
    };

    const clearData = () => {
      if (!confirm('Delete all data on this device? Export a copy first if you want to keep it.')) {
        return;
      }
      service.clearData();
      save();
      render();
    };

    return () => view({ exportJson, clearData });
  };
})();
