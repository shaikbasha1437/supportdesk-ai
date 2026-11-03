/* Review queue and Analytics views. */
(function () {
  'use strict';
  const app = SD.app; const { h, pct, money, ms } = SD.ui;
  const rq = { status: 'all', team: 'all' };
  function review(main) {
    const all = app.queue();
    const list = all.filter((t) => (rq.status === 'all' || app.status(t.id) === rq.status) && (rq.team === 'all' || (app.state.states[t.id] || {}).team === rq.team));
    main.append(h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('div', { class: 'grow' }, h('h1', {}, 'Review queue'), h('div', { class: 'small muted' }, 'Drafts the agent wasn\u2019t allowed or sure enough to send. Approve, edit, reject or reassign. Approving only marks the ticket resolved here; nothing is emailed.')),
      app.select([['all', 'All (' + all.length + ')'], ['needs_review', 'Needs review'], ['escalated', 'Escalated'], ['rejected', 'Draft rejected']], rq.status, { 'aria-label': 'Filter by status', id: 'rq-status', onchange: (e) => { rq.status = e.target.value; app.refresh(); } }),
      app.select([['all', 'All teams']].concat(SD.rules.TEAMS.map((t) => [t, t])), rq.team, { 'aria-label': 'Filter by team', id: 'rq-team', onchange: (e) => { rq.team = e.target.value; app.refresh(); } })));
    if (!list.length) {
      const processed = Object.keys(app.state.results).length;
      main.append(h('div', { class: 'panel empty' }, h('div', { class: 'big' }, '\u2705'), h('p', {}, all.length ? 'Nothing matches these filters.' : processed ? 'All caught up. Nothing is waiting for a human.' : 'Nothing here yet. Process the inbox first.'), processed ? null : h('button', { type: 'button', class: 'btn primary', onclick: () => { app.go('#inbox'); app.processAll(false); } }, 'Process all tickets')));
      return;
    }
    const grid = h('div', { class: 'grid', id: 'queue' });
    list.forEach((t) => {
      const r = app.state.results[t.id]; const st = app.state.states[t.id] || {}; const s = app.status(t.id);
      const main = r.decision.reasons.filter((x) => x.action === r.decision.action).slice(0, 3);
      grid.append(h('article', { class: 'panel qcard', 'data-id': t.id },
        h('div', { class: 'row' }, h('span', { class: 'mono small muted' }, t.id), app.statusChip(t.id), st.team ? app.chip(st.team, 'brand') : null, h('span', { class: 'grow' }), h('span', { class: 'small muted' }, (t.customer && t.customer.name) || '')),
        h('h3', { style: 'margin:0' }, h('a', { href: '#inbox/' + encodeURIComponent(t.id) }, t.subject)),
        h('div', { class: 'small' }, (main.length ? main : r.decision.reasons.slice(0, 2)).map((x) => h('div', {}, '\u2022 ' + x.label + (x.detail ? ': ' + x.detail.slice(0, 90) : '')))),
        app.meter(r.confidence),
        h('div', { class: 'reply' }, st.reply != null ? st.reply : r.draft),
        h('div', { class: 'actions', style: 'margin-top:0' },
          h('button', { type: 'button', class: 'btn sm ok', 'data-act': 'approve', onclick: () => app.approve(t.id) }, '\u2713 Approve'),
          h('button', { type: 'button', class: 'btn sm', 'data-act': 'edit', onclick: () => app.openTicketSheets.editReply(t, r) }, 'Edit'),
          s !== 'rejected' ? h('button', { type: 'button', class: 'btn sm danger', 'data-act': 'reject', onclick: () => app.openTicketSheets.rejectSheet(t) }, 'Reject') : null,
          h('button', { type: 'button', class: 'btn sm', 'data-act': 'reassign', onclick: () => app.openTicketSheets.reassignSheet(t, false) }, 'Reassign'),
          h('a', { class: 'btn sm ghost', href: '#inbox/' + encodeURIComponent(t.id) }, 'Open trace \u2192'))));
    });
    main.append(grid);
  }
  function kpi(v, k, id) { return h('div', { class: 'kpi', 'data-kpi': id || null }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, k)); }
  function bars(rows, max) { return rows.map(([label, n]) => h('div', { class: 'hbar' }, h('span', {}, label), h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round((n / (max || 1)) * 100) + '%' })), h('b', {}, n))); }
  function analytics(main) {
    const a = SD.analytics.summarize(app.tickets(), app.state.results, app.state.states, app.state.feedback);
    main.append(h('div', { style: 'margin-bottom:12px' }, h('h1', {}, 'Analytics'), h('div', { class: 'small muted' }, a.processed + ' of ' + a.total + ' tickets processed \u00b7 ' + a.demoCount + ' in demo mode, ' + a.liveCount + ' with a model')));
    if (!a.processed) { main.append(h('div', { class: 'panel empty' }, h('div', { class: 'big' }, '\ud83d\udcca'), h('p', {}, 'No data yet. Process the inbox to see deflection, escalation reasons, confidence, knowledge gaps, cost and latency.'), h('button', { type: 'button', class: 'btn primary', onclick: () => { app.go('#inbox'); app.processAll(false); } }, 'Process all tickets'))); return; }
    main.append(h('div', { class: 'kpis' },
      kpi(pct(a.deflection), 'Deflection (auto-resolved)', 'deflection'), kpi(pct(a.reviewRate), 'Sent to human review', 'review'), kpi(pct(a.escalationRate), 'Escalated to a team', 'escalation'), kpi(pct(a.avgConfidence), 'Average confidence', 'confidence'),
      kpi(String(a.injections), 'Injection attempts flagged', 'injections'), kpi(String(a.gaps.length), 'Knowledge gaps', 'gaps'), kpi(money(a.totalCost), 'Model cost (' + money(a.costPerTicket) + '/ticket)', 'cost'), kpi(ms(a.avgLatency), 'Avg latency (p95 ' + ms(a.p95Latency) + ')', 'latency')));
    const maxR = a.reasons.reduce((m, r) => Math.max(m, r[1]), 1);
    main.append(h('div', { class: 'grid' },
      h('section', { class: 'panel' }, h('h2', {}, 'Why tickets went to a human'), a.reasons.length ? bars(a.reasons, maxR) : h('p', { class: 'muted' }, 'Every processed ticket was auto-resolved.')),
      h('section', { class: 'panel' }, h('h2', {}, 'Outcomes'), bars([['Auto-resolved', a.auto], ['Human review', a.review], ['Escalated', a.escalated], ['Resolved by you', a.humanResolved], ['Drafts rejected', a.rejected]], a.processed), h('p', { class: 'small muted' }, 'Approved drafts: ' + a.approved + ' \u00b7 edited before approval: ' + a.edited + ' (' + pct(a.editRate) + ')')),
      h('section', { class: 'panel' }, h('h2', {}, 'By category'), h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Category'), h('th', {}, 'Tickets'), h('th', {}, 'Auto-resolved'))), h('tbody', {}, a.categories.map(([c, v]) => h('tr', {}, h('td', {}, c), h('td', {}, v.total), h('td', {}, pct(v.auto / v.total))))))),
      h('section', { class: 'panel', id: 'gaps' }, h('h2', {}, 'Knowledge gaps'), a.gaps.length ? h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Ticket'), h('th', {}, 'Why'), h('th', {}, 'Best match'))), h('tbody', {}, a.gaps.map((g) => { const t = app.ticket(g.ticketId); return h('tr', {}, h('td', {}, h('a', { href: '#inbox/' + encodeURIComponent(g.ticketId) }, g.ticketId), t ? h('div', { class: 'small muted' }, t.subject) : null), h('td', {}, g.why), h('td', { class: 'small' }, g.best)); }))) : h('p', { class: 'muted' }, 'None found. Mark one from a ticket if the docs should cover it.'), h('div', { class: 'actions' }, h('a', { class: 'btn sm', href: '#kb' }, 'Add an article \u2192'))),
      h('section', { class: 'panel' }, h('h2', {}, 'Cost and speed'), h('dl', { class: 'kv' }, h('dt', {}, 'Model tokens'), h('dd', {}, a.tokens.toLocaleString()), h('dt', {}, 'Total cost'), h('dd', {}, money(a.totalCost)), h('dt', {}, 'Cost per ticket'), h('dd', {}, money(a.costPerTicket)), h('dt', {}, 'Average latency'), h('dd', {}, ms(a.avgLatency)), h('dt', {}, 'p95 latency'), h('dd', {}, ms(a.p95Latency))), h('p', { class: 'small muted' }, 'Demo mode costs nothing and uses no tokens. Live costs use list prices you can edit in Settings \u203a Prices.'))));
  }
  app.views.review = { render: review };
  app.views.analytics = { render: analytics };
})();
