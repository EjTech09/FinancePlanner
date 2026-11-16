(() => {
  'use strict';

  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.accounts = context => {
    const { $, commit, save, render, markDirty } = context;
    const service = window.HouseholdPlannerPages.accountsService(context);
    const view = window.HouseholdPlannerPages.accountsView(context, service);
    const actions = {
      deleteAccount(account) {
        if (!confirm('Delete this account? Money set aside from it will be removed too.')) return;
        service.deleteAccount(account);
        commit();
        render();
      },
      deleteCommitment(commitment, item) {
        if (!confirm('Delete this line? This cannot be undone.')) return;
        service.deleteCommitment(commitment);
        item.remove();
        commit();
      },
      addAccount(list) {
        const account = service.createAccount();
        markDirty();
        const item = view.accountItem(account, actions);
        list.append(item);
        item._open(true);
        commit();
        const firstField = $('input', item);
        if (firstField) firstField.focus();
      },
      addCommitment(list) {
        const commitment = service.createCommitment();
        markDirty();
        const item = view.commitmentItem(commitment, actions);
        list.append(item);
        item._open(true);
        commit();
        const firstField = $('select,input', item);
        if (firstField) firstField.focus();
      },
      setAccountFilter(userId) {
        service.setAccountFilter(userId);
        save();
        render();
      }
    };

    return { render: () => view.render(actions) };
  };
})();
