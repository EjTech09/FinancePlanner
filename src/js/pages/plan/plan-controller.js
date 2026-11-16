(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.plan = context => {
    const { $, commit, markDirty, render } = context;
    const service = window.HouseholdPlannerPages.planService(context);
    const view = window.HouseholdPlannerPages.planView(context, service);
    const appendItem = (list, item) => {
      list.append(item);
      item._open(true);
      commit();
      const firstField = $('input', item);
      if (firstField) firstField.focus();
    };
    const actions = {
      updateAllocation(category, input) {
        service.updateAllocation(category, input);
        commit();
      },
      setPeriod(period) {
        service.setPeriod(period);
        commit();
        render();
      },
      deleteMoneyItem(row, collection, item, itemTitle) {
        if (!confirm('Delete this ' + itemTitle + '? This cannot be undone.')) return;
        service.deleteMoneyItem(row, collection);
        item.remove();
        commit();
      },
      addIncome(list) {
        const row = service.createIncome();
        markDirty();
        appendItem(list, view.incomeItem(row, actions));
      },
      addExpense(category, list) {
        const row = service.createExpense(category);
        markDirty();
        appendItem(list, view.expenseItem(row, actions));
      },
      deleteGoal(goal, item) {
        if (!confirm('Delete this goal? Money set aside for it will be kept as "something else".')) return;
        service.deleteGoal(goal);
        item.remove();
        commit();
      },
      deleteDebt(debt, item) {
        if (!confirm('Delete this debt? Money set aside for it will be kept as "something else".')) return;
        service.deleteDebt(debt);
        item.remove();
        commit();
      },
      addGoal(list) {
        const goal = service.createGoal();
        markDirty();
        appendItem(list, view.goalItem(goal, actions));
      },
      addDebt(list) {
        const debt = service.createDebt();
        markDirty();
        appendItem(list, view.debtItem(debt, actions));
      }
    };

    return () => view.render(actions);
  };
})();
