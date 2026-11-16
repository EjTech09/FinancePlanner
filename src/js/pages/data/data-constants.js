(() => {
  'use strict';

  const personTypes = Object.freeze([
    Object.freeze(['Individual', 'Individual']),
    Object.freeze(['Joint', 'Joint'])
  ]);
  window.HouseholdPlannerConstants = window.HouseholdPlannerConstants || {};
  window.HouseholdPlannerConstants.data = Object.freeze({
    PERSON_TYPES: personTypes,
    DEFAULT_PERSON_TYPE: personTypes[0][0],
    EXPORT_FILENAME: 'household-planner-data.json'
  });
})();
