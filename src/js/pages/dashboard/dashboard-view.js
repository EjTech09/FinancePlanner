(() => {
  'use strict';

  /**
   * Dashboard overview page.
   *
   * Summarises the current month’s cash position, budget allocation, goal debt
   * progress, and per-person financial health from the model data.
   */
  window.HouseholdPlannerPages = window.HouseholdPlannerPages || {};
  window.HouseholdPlannerPages.dashboardView = (context, service) => {
     const {
       RING_CENTER, RING_RADIUS, RING_VIEWBOX_SIZE, RING_DASH_THRESHOLD
     } = window.HouseholdPlannerConstants.dashboard;
    const { MONEY_EPSILON } = window.HouseholdPlannerConstants.domain;
    const { state, CATS, money, num, sum, esc, cls, fmtDate, asOf, h, head, tile, hasData, startImport } = context;

    const dashView = startFromScratch => {
      const {
        R, inc, tot, left, top, over, pct, circumference, dash,
        goalsOn, onTrack, debtsOn, goalScale, debtScale, people, peopleScale
      } = service.summary();
      const segs = CATS.map(([key,, color]) =>
        `<i style="width:${R.budgeted[key] / top * 100}%;background:var(--${color})"></i>`
      ).join('') + `<i style="width:${Math.max(left, 0) / top * 100}%"></i>`;
      const leg = CATS.map(([key, name, color]) => {
        const isOverLimit = R.budgeted[key] > R.limit[key] + MONEY_EPSILON;
        const overage = isOverLimit ? ', over by ' + money(R.budgeted[key] - R.limit[key], 0) : '';
        return `<li><span class="dot" style="background:var(--${color})"></span><b>${name}</b><small class="${isOverLimit ? 'bad' : ''}">${money(R.budgeted[key], 0)} of ${money(R.limit[key], 0)} limit${overage}</small></li>`;
      }).join('');
      const goalRows = state.goals.map(g => {
        const r = R.goals[g.id];
        return `<div class="row"><div class="top"><span class="name">${esc(g.name)}</span><span class="pill ${cls(r.status)}">${esc(r.status)}</span></div>
          <div class="meta">${money(num(g.monthly), 0)} a month${r.required != null ? ', ' + money(r.required, 0) + ' needed for the date' : ''}. Saved ${money(r.saved, 0)} of ${g.target === '' ? 'no target' : money(num(g.target), 0)}.</div>
          <div class="bar thin"><i style="width:${num(g.monthly) / goalScale * 100}%;background:var(--c1)"></i></div>
          <div class="bar thin"><i style="width:${(r.required || 0) / goalScale * 100}%;background:var(--c3)"></i></div></div>`;
      }).join('') || '<p class="empty">No goals yet. Add one on the Plan page.</p>';
      const debtRows = state.debts.slice().sort((a, b) => num(a.priority) - num(b.priority)).map(debt => {
        const progress = R.debts[debt.id];
        return `<div class="row"><div class="top"><span class="name">${esc(debt.name)}</span><span class="pill ${cls(progress.status)}">${esc(progress.status)}</span></div>
          <div class="meta">${money(progress.bal, 0)} owed. ${money(progress.funded, 0)} covered, ${money(progress.unfunded, 0)} still to find. ${num(debt.monthly) > 0 ? money(num(debt.monthly), 0) + ' a month.' : 'No monthly payment yet.'}</div>
          <div class="bar"><i style="width:${progress.funded / debtScale * 100}%;background:var(--c2)"></i><i style="width:${progress.unfunded / debtScale * 100}%;background:var(--c3)"></i></div></div>`;
      }).join('') || '<p class="empty">No debts recorded.</p>';
      const personRows = people.map(person => `<div class="row"><div class="top"><span class="name">${esc(person.name)}</span><span class="meta">${money(person.net, 0)} after bills</span></div>
          <div class="meta">${money(person.committed, 0)} set aside, ${money(person.free, 0)} free to use.</div>
          <div class="bar"><i style="width:${Math.max(person.committed, 0) / peopleScale * 100}%;background:var(--c1)"></i><i style="width:${Math.max(person.free, 0) / peopleScale * 100}%;background:var(--c2)"></i></div></div>`).join('') || '<p class="empty">Add accounts to see cash by person.</p>';

      /* DOM construction */
      const el = h('div');
      el.append(head('Dashboard', 'As of ' + fmtDate(asOf) + '.'));
      const dashboard = h('div', { class: 'bento' });
      dashboard.innerHTML = `
        <section class="tile s-8 hero"><h2>${inc > 0 ? 'Where ' + money(inc, 0) + ' a month goes' : 'Add your income to begin'}</h2>
          <p class="sub">Each colour is a budget section. The grey part is income you have not allocated yet.</p>
          <div class="split" role="img" aria-label="Monthly income split by budget category">${segs}</div><ul class="legend">${leg}</ul></section>
        <section class="tile s-4 ring-tile ${over ? 'tint-red' : 'tint-green'}"><h2>Allocated</h2>
          <div class="ring-wrap"><svg viewBox="0 0 ${RING_VIEWBOX_SIZE} ${RING_VIEWBOX_SIZE}" role="img" aria-label="${pct.toFixed(0)} percent of income allocated"><circle class="ring-bg" cx="${RING_CENTER}" cy="${RING_CENTER}" r="${RING_RADIUS}"/><circle class="ring-fg" cx="${RING_CENTER}" cy="${RING_CENTER}" r="${RING_RADIUS}" stroke-dasharray="${dash} ${circumference}" transform="rotate(-90 ${RING_CENTER} ${RING_CENTER})"${dash < RING_DASH_THRESHOLD ? ' style="display:none"' : ''}/></svg>
            <div class="ring-c"><b>${pct.toFixed(0)}%</b><span>of income</span></div></div>
          <p class="ring-cap ${over ? 'bad' : 'ok'}">${over ? money(-left, 0) + ' over-allocated' : money(left, 0) + ' left unbudgeted'}</p></section>
        <section class="tile s-3 kpi"><div class="k-label">Savings rate</div><div class="k-val">${inc ? (R.budgeted.savings / inc * 100).toFixed(1) : '0.0'}%</div><div class="k-cap">of income goes to goals</div></section>
        <section class="tile s-3 kpi"><div class="k-label">Cash after bills</div><div class="k-val">${money(R.net, 0)}</div><div class="k-cap">across all accounts</div></section>
        <section class="tile s-3 kpi"><div class="k-label">Free to use</div><div class="k-val">${money(R.free, 0)}</div><div class="k-cap">not set aside for anything</div></section>
        <section class="tile s-3 kpi"><div class="k-label">Goals on track</div><div class="k-val">${onTrack} of ${goalsOn.length}</div><div class="k-cap">${debtsOn} of ${state.debts.length} debts on track</div></section>
        <section class="tile s-6"><h2>Goals</h2><p class="sub">Blue is what you put in each month. Orange is what the date needs.</p><div class="rows">${goalRows}</div></section>
        <section class="tile s-6"><h2>Debts</h2><p class="sub">${money(R.debtFunded, 0)} of ${money(R.debtTotal, 0)} is covered by money you have set aside.</p><div class="rows">${debtRows}</div></section>
        <section class="tile s-12"><h2>Cash by person</h2><p class="sub">Blue is set aside for something. Green is free to use.</p><div class="rows">${personRows}</div></section>`;
      if (!hasData()) {
        dashboard.innerHTML = '';
        dashboard.append(tile(
          12,
          { class: 'welcome' },
          h('h2', {}, 'Welcome'),
          h('p', { class: 'sub' }, 'Nothing is saved here yet. Import a JSON file you exported earlier, or start from scratch by adding the people who share this budget.'),
          h('div', { class: 'actions' },
            h('button', { class: 'btn', type: 'button', onclick: startImport }, 'Import JSON'),
            h('button', { class: 'btn plain', type: 'button', onclick: startFromScratch }, 'Start from scratch'))
        ));
      }

      el.append(dashboard);
      return el;
    };
    return dashView;
  };
})();
