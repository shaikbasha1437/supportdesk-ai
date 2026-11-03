/* Inbox: ticket list, ticket detail with the agent trace, and human-in-the-loop actions. */
(function () {
  'use strict';
  const app = SD.app; const { $, $$, h, toast, sheet, pct, money, ms, when } = SD.ui;
  const ui = { q: '', status: 'all' };
  const CH = { email: '\u2709\ufe0f', chat: '\ud83d\udcac', web: '\ud83c\udf10', phone: '\ud83d\udcde', social: '\ud83d\udce3', api: '\u2699\ufe0f' };
  const SENT = { negative: 'stop', positive: 'ok', neutral: '' };
  const clsCache = new Map();
  const quick = (t) => { const k = t.id + '|' + t.body.length; if (!clsCache.has(k)) clsCache.set(k, SD.classify.classify(t)); return clsCache.get(k); };
  function matches(t) {
    const s = app.status(t.id);
    if (ui.status !== 'all' && (ui.status === 'open' ? !['new', 'needs_review', 'escalated', 'rejected'].includes(s) : s !== ui.status)) return false;
    if (!ui.q) return true;
    const hay = (t.id + ' ' + t.subject + ' ' + t.body + ' ' + (t.customer && t.customer.name) + ' ' + (t.customer && t.customer.email) + ' ' + (t.tags || []).join(' ')).toLowerCase();
    return ui.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  }
  function item(t, on) {
    const s = app.status(t.id); const c = quick(t);
    return h('button', { type: 'button', class: 'titem' + (on ? ' on' : ''), 'data-id': t.id, 'aria-current': on ? 'true' : null, onclick: () => app.go('#inbox/' + encodeURIComponent(t.id)) },
      h('div', { class: 'l1' }, h('span', { class: 'dot ' + s, title: app.STATUS[s] }), h('span', { class: 'mono' }, t.id), h('span', {}, (CH[t.channel] || '\u2709\ufe0f') + ' ' + t.channel), h('span', { class: 'grow' }), h('span', {}, when(t.created))),
      h('div', { class: 'subj' }, t.subject),
      h('div', { class: 'l3' }, h('span', { class: 'small muted' }, (t.customer && t.customer.name) || 'Customer'), app.statusChip(t.id), t.priority !== 'normal' ? app.chip(t.priority, t.priority === 'urgent' || t.priority === 'high' ? 'stop' : '') : null, c.sentiment.label !== 'neutral' ? app.chip(c.sentiment.label, SENT[c.sentiment.label]) : null, t.customer && (t.customer.vip || t.customer.tier === 'enterprise') ? app.chip(t.customer.vip ? 'VIP' : 'Enterprise', 'brand') : null));
  }
  function paintList(list, cur) {
    const tickets = app.tickets().filter(matches);
    list.textContent = '';
    if (!tickets.length) list.append(h('div', { class: 'empty' }, h('div', { class: 'big' }, '\ud83d\udced'), h('p', {}, ui.q || ui.status !== 'all' ? 'No tickets match these filters.' : 'No tickets yet. Create one or import a CSV.')));
    tickets.forEach((t) => list.append(item(t, t.id === cur)));
    const c = $('#inbox-count'); if (c) c.textContent = tickets.length + ' of ' + app.tickets().length;
  }
  function render(main, id) {
    const st = app.state; const any = Object.keys(st.results).length;
    const proc = app.processing;
    main.append(h('div', { class: 'row', style: 'margin-bottom:10px' },
      h('div', { class: 'grow' }, h('h1', {}, 'Inbox'), h('div', { class: 'small muted' }, 'Tickets are processed in your browser. ', st.settings.mode === 'demo' ? h('span', {}, 'Demo mode: replies quote your docs; no AI model or key. ', h('a', { href: '#settings/model' }, 'Use your own key')) : h('span', {}, 'Live mode: replies drafted by ' + app.modeLabel().replace(/^Live \u00b7 /, '') + '.'))),
      h('div', { class: 'row' },
        h('button', { type: 'button', class: 'btn primary', id: 'process-all', disabled: !!proc, onclick: () => app.processAll(any > 0) }, proc ? 'Processing\u2026' : any ? 'Process new tickets' : 'Process all tickets'),
        any ? h('button', { type: 'button', class: 'btn', disabled: !!proc, onclick: async () => { if (await app.ask({ title: 'Re-run every ticket?', text: 'The agent will process all ' + app.tickets().length + ' tickets again with your current docs, settings and rules. Reviews you already did are replaced by the new results.', ok: 'Re-run all' })) app.processAll(false); } }, 'Re-run all') : null,
        h('button', { type: 'button', class: 'btn', id: 'new-ticket', onclick: newTicket }, '+ New ticket'),
        h('button', { type: 'button', class: 'btn', id: 'import-tickets', onclick: importTickets }, 'Import'),
        h('button', { type: 'button', class: 'btn', onclick: exportMenu }, 'Export'))));
    if (proc) main.append(h('div', { class: 'panel', style: 'margin-bottom:12px' }, h('div', { 'data-progress-label': '' }, 'Processing ' + proc.done + ' of ' + proc.total + '\u2026'), h('div', { class: 'progress' }, h('i', { 'data-progress': '', style: 'width:' + Math.round(proc.done / proc.total * 100) + '%' }))));
    if (!any && !proc) main.append(h('div', { class: 'notice', style: 'margin-bottom:12px' }, h('b', {}, 'Start here: '), 'press \u201cProcess all tickets\u201d. The agent classifies each ticket, finds help articles, drafts a cited reply, checks it, and auto-resolves, sends it to the Review queue, or escalates it to a team. Nothing is emailed; resolving only changes the status here.'));
    const t = id ? app.ticket(id) : null;
    const list = h('div', { class: 'list', id: 'ticket-list', 'data-keep-scroll': 'tl', role: 'list' });
    const q = h('input', { type: 'search', id: 'inbox-q', placeholder: 'Search tickets', 'aria-label': 'Search tickets', value: ui.q, oninput: (e) => { ui.q = e.target.value; paintList(list, id); } });
    const sel = app.select([['all', 'All'], ['open', 'Open'], ['new', 'New'], ['auto_resolved', 'Auto-resolved'], ['needs_review', 'Needs review'], ['escalated', 'Escalated'], ['rejected', 'Draft rejected'], ['resolved', 'Resolved']], ui.status, { 'aria-label': 'Filter by status', id: 'inbox-status', onchange: (e) => { ui.status = e.target.value; paintList(list, id); } });
    const listcol = h('section', { class: 'listcol', 'aria-label': 'Tickets' }, h('div', { class: 'toolbar' }, q, sel), h('div', { class: 'small muted', id: 'inbox-count', style: 'margin:-4px 0 6px' }), list);
    const detail = h('section', { class: 'detail panel', 'aria-label': 'Ticket detail', id: 'detail' });
    main.append(h('div', { class: 'inbox' + (t ? ' has-detail' : '') }, listcol, detail));
    paintList(list, id);
    if (t) renderDetail(detail, t); else detail.append(h('div', { class: 'empty' }, h('div', { class: 'big' }, '\ud83d\udcec'), h('p', {}, id ? 'Ticket ' + id + ' was not found.' : 'Pick a ticket to see the agent\u2019s reasoning step by step.')));
  }

  // ---------- detail ----------
  function renderDetail(el, t) {
    const r = app.state.results[t.id]; const st = app.state.states[t.id] || {}; const c = (r && r.classification) || quick(t);
    const cust = t.customer || {};
    el.append(h('button', { type: 'button', class: 'btn ghost back', onclick: () => app.go('#inbox') }, '\u2190 All tickets'),
      h('div', { class: 'row' }, h('h2', { class: 'grow', style: 'margin:0' }, t.subject), app.statusChip(t.id)),
      h('div', { class: 'tmeta' }, app.chip(t.id), app.chip((CH[t.channel] || '') + ' ' + t.channel), app.chip(cust.name + (cust.email ? ' \u00b7 ' + cust.email : '')), app.chip(cust.tier || 'plan unknown', cust.tier === 'enterprise' ? 'brand' : ''), cust.vip ? app.chip('VIP', 'brand') : null, app.chip('priority: ' + t.priority, t.priority === 'urgent' || t.priority === 'high' ? 'stop' : ''), app.chip('sentiment: ' + c.sentiment.label, SENT[c.sentiment.label]), app.chip(c.language.name), (t.tags || []).map((x) => app.chip('#' + x)), app.chip(when(t.created))),
      h('div', { class: 'tbody', 'aria-label': 'Ticket message' }, t.body));
    const acts = h('div', { class: 'actions', style: 'margin:-2px 0 14px' },
      h('button', { type: 'button', class: 'btn ' + (r ? '' : 'primary'), id: 'run-agent', onclick: async (e) => { e.target.disabled = true; e.target.textContent = 'Running\u2026'; try { await app.process(t); } catch (err) { if (!err.config) toast('The agent failed: ' + err.message); } app.refresh(); } }, r ? '\u21bb Re-run agent' : '\u25b6 Run agent'),
      h('button', { type: 'button', class: 'btn danger', onclick: () => app.deleteTicket(t.id) }, 'Delete ticket'));
    el.append(acts);
    if (!r) { el.append(h('p', { class: 'muted' }, 'Not processed yet. Run the agent to see classification, retrieved articles, the draft reply, the self-check and the decision.')); return; }
    const left = h('div', {}); const right = h('div', {});
    el.append(h('div', { class: 'cols' }, left, right));
    // decision + reply
    const a = r.decision.action;
    const label = st.status === 'resolved' ? 'Resolved by you' : st.status === 'rejected' ? 'Draft rejected \u2014 a human should reply' : a === 'auto' ? 'Auto-resolved' : a === 'review' ? 'Needs human review' : 'Escalated to ' + (st.team || r.decision.team);
    left.append(h('div', { class: 'decision ' + (st.status === 'resolved' ? 'auto' : st.status === 'rejected' ? 'review' : a), id: 'decision' }, h('span', { class: 'grow' }, label + (st.team && st.status !== 'resolved' && a !== 'escalate' && a !== 'auto' ? ' \u00b7 ' + st.team : '')), app.meter(r.confidence)));
    left.append(h('div', { class: 'small muted', style: 'margin:-4px 0 8px' }, (r.mode === 'demo' ? '\ud83e\uddea Demo mode \u00b7 extractive composer, no AI model' : '\u26a1 ' + r.model) + ' \u00b7 ' + (r.usage ? r.usage.input + ' in / ' + r.usage.output + ' out tokens \u00b7 ' + money(r.cost) + (r.cost == null ? ' (price unknown)' : '') : '0 tokens \u00b7 $0') + ' \u00b7 ' + ms(r.latencyMs)));
    if (r.llmError) left.append(h('div', { class: 'notice warn', style: 'margin-bottom:8px' }, 'The model call failed, so the demo composer wrote this draft: ' + r.llmError));
    const reply = st.reply != null ? st.reply : r.draft;
    left.append(h('h3', {}, st.reply != null && st.reply.trim() !== r.draft.trim() ? 'Reply (edited by you)' : 'Draft reply'), replyEl(reply, r));
    const open = ['needs_review', 'escalated', 'rejected'].includes(st.status);
    const row = h('div', { class: 'actions' });
    if (open) {
      row.append(h('button', { type: 'button', class: 'btn ok', 'data-act': 'approve', onclick: () => app.approve(t.id) }, '\u2713 Approve & mark sent'),
        h('button', { type: 'button', class: 'btn', 'data-act': 'edit', onclick: () => editReply(t, r) }, 'Edit'),
        st.status !== 'rejected' ? h('button', { type: 'button', class: 'btn danger', 'data-act': 'reject', onclick: () => rejectSheet(t) }, 'Reject') : null,
        h('button', { type: 'button', class: 'btn', 'data-act': 'reassign', onclick: () => reassignSheet(t, false) }, 'Reassign'),
        st.status === 'needs_review' ? h('button', { type: 'button', class: 'btn', 'data-act': 'escalate', onclick: () => reassignSheet(t, true) }, 'Escalate') : null);
    } else {
      row.append(h('button', { type: 'button', class: 'btn', 'data-act': 'reopen', onclick: () => app.reopen(t.id) }, 'Reopen for review'), h('button', { type: 'button', class: 'btn', 'data-act': 'escalate', onclick: () => reassignSheet(t, true) }, 'Escalate'));
    }
    left.append(row);
    left.append(h('label', { class: 'switch small', style: 'margin-top:10px' }, h('input', { type: 'checkbox', checked: app.isGap(t.id), onchange: (e) => app.toggleGap(t.id, e.target.checked) }), 'Mark as knowledge gap (the docs should cover this)'));
    left.append(h('p', { class: 'small muted' }, st.status === 'auto_resolved' ? 'Auto-resolved means the agent was confident enough to answer on its own. Here that only marks the ticket resolved; nothing is emailed.' : 'Approving only marks the ticket resolved in this browser. SupportDesk AI never sends email or messages.'));
    if (r.handoff) left.append(handoffEl(r.handoff, st.team));
    right.append(h('h3', {}, 'Agent trace'), traceEl(r));
  }
  function replyEl(text, r) {
    const box = h('div', { class: 'reply', id: 'reply' });
    String(text).split(/(\[\d+\])/).forEach((part) => {
      const m = part.match(/^\[(\d+)\]$/);
      if (m && r.sources[Number(m[1]) - 1]) { const s = r.sources[Number(m[1]) - 1]; box.append(h('button', { type: 'button', class: 'cite', title: s.title, 'aria-label': 'Source ' + m[1] + ': ' + s.title, onclick: () => sourceSheet(s, Number(m[1])) }, m[1])); } else box.append(part);
    });
    return box;
  }
  function sourceSheet(s, n) {
    const doc = app.docs().find((d) => d.id === s.docId);
    sheet({ id: 'source', title: '[' + n + '] ' + s.title, body: (b) => b.append(h('div', { class: 'small muted' }, (s.heading ? s.heading + ' \u00b7 ' : '') + 'relevance ' + pct(s.relevance)), h('div', { class: 'chunk' }, h('p', {}, s.text))), actions: doc ? [{ label: 'Open article', fn: (api) => api.close().then(() => app.go('#kb/' + encodeURIComponent(doc.id))) }] : [] });
  }
  function handoffEl(ho, team) {
    const text = 'Handoff to ' + (team || ho.team) + '\n' + ho.summary + '\nWhy: ' + ho.reasons.join('; ') + (ho.facts.length ? '\nFacts: ' + ho.facts.join('; ') : '') + '\nTried: ' + ho.tried + '\nNext step: ' + ho.next;
    return h('div', { class: 'handoff', id: 'handoff' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, 'Handoff note for ' + (team || ho.team)), h('button', { type: 'button', class: 'btn sm', onclick: async () => toast((await SD.ui.copy(text)) ? 'Handoff note copied.' : 'Copy failed. Select the text instead.') }, 'Copy')),
      h('div', {}, ho.summary), h('ul', {}, ho.reasons.map((x) => h('li', {}, x))), ho.facts.length ? h('div', { class: 'small' }, h('b', {}, 'Facts: '), ho.facts.join(' \u00b7 ')) : null, h('div', { class: 'small' }, h('b', {}, 'Tried: '), ho.tried), h('div', { class: 'small' }, h('b', {}, 'Next step: '), ho.next));
  }
  const ICON = { classify: '1', guard: '2', retrieve: '3', draft: '4', check: '5', decide: '6' };
  function traceEl(r) {
    const ol = h('ol', { class: 'trace', id: 'trace' });
    r.steps.forEach((s) => {
      const li = h('li', { class: s.status, 'data-step': s.id }, h('span', { class: 'ic', 'aria-hidden': 'true' }, s.status === 'ok' ? '\u2713' : s.status === 'stop' ? '!' : ICON[s.id]), h('div', { class: 'st' }, s.label, h('span', { class: 'ms' }, ms(s.ms))), h('div', { class: 'sum' }, s.summary));
      const d = stepDetail(s, r); if (d) li.append(h('details', {}, h('summary', {}, 'Details'), d));
      ol.append(li);
    });
    return ol;
  }
  function kv(pairs) { return h('dl', { class: 'kv' }, pairs.filter((p) => p[1] != null && p[1] !== '').map((p) => [h('dt', {}, p[0]), h('dd', {}, String(p[1]))])); }
  function stepDetail(s, r) {
    const d = s.data || {};
    if (s.id === 'classify') return kv([['Intent', d.category.intent], ['Category', d.category.label], ['Certainty', pct(d.category.certainty)], ['Sentiment', d.sentiment.label + ' (' + d.sentiment.score + ')' + (d.sentiment.cues.length ? ': ' + d.sentiment.cues.join(', ') : '')], ['Urgency', d.urgency.level + (d.urgency.cues && d.urgency.cues.length ? ': ' + d.urgency.cues.join(', ') : '')], ['Language', d.language.name], ['Amounts', (d.amounts || []).map((x) => '$' + x).join(', ')], ['Search query', r.classification.query]]);
    if (s.id === 'guard') return d.findings && d.findings.length ? h('div', {}, h('p', { class: 'small' }, 'Score ' + d.score + '. Ticket text is fenced as untrusted data; it cannot change rules or settings.'), d.findings.map((f) => h('div', { class: 'src' }, h('b', {}, f.label), f.match ? h("pre", { class: "box" }, f.match) : null))) : h('p', { class: 'small muted' }, 'Checked for override phrases, role-play, fake system tags, hidden comments, encoded text and invisible characters.');
    if (s.id === 'retrieve') return h('div', {}, (d.length ? d : []).map((x, i) => { const used = r.sources.findIndex((y) => y.id === x.id); return h('div', { class: 'src' }, h('div', { class: 'h' }, used >= 0 ? app.chip('[' + (used + 1) + '] cited source', 'brand') : app.chip('not used'), h('span', { class: 'grow' }, x.title + (x.heading ? ' \u203a ' + x.heading : ''))), h('div', { class: 'row', style: 'margin-top:4px' }, h('div', { class: 'bar' }, h('i', { style: 'width:' + Math.round(x.relevance * 100) + '%' })), h('span', { class: 'small' }, pct(x.relevance) + ' \u00b7 BM25 ' + x.bm25 + (x.dense != null ? ' \u00b7 dense ' + x.dense : ''))), x.hits && x.hits.length ? h('div', { class: 'small muted' }, 'Matched: ' + x.hits.slice(0, 10).join(', ')) : null); }), d.length ? null : h('p', { class: 'small muted' }, 'Nothing matched.'));
    if (s.id === 'draft') return d.prompt ? h('div', {}, h('div', { class: 'small' }, 'System prompt'), h('pre', { class: 'box' }, d.prompt.system), h('div', { class: 'small' }, 'User message (ticket fenced as untrusted)'), h('pre', { class: 'box' }, d.prompt.user)) : h('p', { class: 'small muted' }, 'Demo composer: picks the sentences, list steps and table rows from the cited articles that best match the ticket, then adds a greeting, citations and your signature. No model, no network.');
    if (s.id === 'check') return h('div', {}, (d.issues || []).length ? h('ul', { class: 'small' }, d.issues.map((i) => h('li', {}, i.label))) : h('p', { class: 'small' }, 'No policy issues: no promised refunds, claimed actions, guarantees, secrets or leaked instructions.'), (d.claims || []).length ? h('div', {}, h('div', { class: 'small muted' }, 'Claim support (share of words found in the cited articles):'), d.claims.slice(0, 12).map((c) => h('div', { class: 'small', style: 'margin:3px 0' }, (c.support >= 0.6 ? '\u2713 ' : '\u2717 ') + Math.round(c.support * 100) + '% \u00b7 ' + c.text.slice(0, 140)))) : null);
    if (s.id === 'decide') return h('div', {}, d.reasons.length ? d.reasons.map((x) => h('div', { class: 'src' }, h('div', { class: 'h' }, app.chip(x.action, x.action === 'escalate' ? 'stop' : 'warn'), h('span', { class: 'grow' }, x.label), app.chip(x.team)), x.detail ? h('div', { class: 'small muted' }, x.detail) : null)) : h('p', { class: 'small' }, 'No rule fired and confidence ' + pct(r.confidence) + ' \u2265 auto-resolve threshold ' + pct(d.config.autoThreshold) + '.'), h('p', { class: 'small' }, h('a', { href: '#settings/rules' }, 'Edit escalation rules')));
    return null;
  }

  // ---------- sheets ----------
  function editReply(t, r) {
    const st = app.state.states[t.id]; const orig = st.reply != null ? st.reply : r.draft;
    let ta;
    sheet({ id: 'edit', title: 'Edit reply \u00b7 ' + t.id, wide: true, isDirty: () => ta && ta.value !== orig,
      body: (b) => { ta = h('textarea', { id: 'edit-text', rows: 14, 'aria-label': 'Reply text', style: 'min-height:280px' }); ta.value = orig; b.append(h('p', { class: 'small muted' }, 'Keep citations like [1] so reviewers can check sources. Saving keeps the ticket in review; approve it afterwards.'), ta); },
      actions: [{ id: 'save', label: 'Save reply', cls: 'primary', fn: (api) => { app.state.states[t.id].reply = ta.value; app.save(); api.close(); app.refresh(); toast('Reply saved.'); } }, { id: 'save-approve', label: 'Save & approve', cls: 'ok', fn: (api) => { app.state.states[t.id].reply = ta.value; api.close().then(() => app.approve(t.id)); } }], cancelLabel: 'Cancel' });
  }
  function rejectSheet(t) {
    let reason, note, gap;
    sheet({ id: 'reject', title: 'Reject draft \u00b7 ' + t.id, isDirty: () => note && note.value.trim() !== '',
      body: (b) => { reason = app.select(['Wrong or incomplete answer', 'Docs are missing this', 'Tone is off', 'Policy issue', 'Should have escalated', 'Other'], 'Wrong or incomplete answer', { id: 'reject-reason' }); note = h('textarea', { id: 'reject-note', rows: 3, placeholder: 'Optional: what should change?' }); gap = h('input', { type: 'checkbox', id: 'reject-gap' }); reason.addEventListener('change', () => { if (reason.value === 'Docs are missing this') gap.checked = true; }); b.append(app.field('Reason', reason), app.field('Note', note, 'Feedback is stored with the ticket and counted in Analytics.'), h('label', { class: 'switch' }, gap, 'Mark as knowledge gap')); },
      actions: [{ id: 'confirm', label: 'Reject draft', cls: 'danger-ok', fn: (api) => { const v = [reason.value, note.value.trim(), gap.checked]; api.close().then(() => app.reject(t.id, v[0], v[1], v[2])); } }], cancelLabel: 'Cancel' });
  }
  function reassignSheet(t, escalate) {
    const cur = (app.state.states[t.id] || {}).team || 'Tier 1 Support';
    let team, note;
    sheet({ id: 'reassign', title: (escalate ? 'Escalate ' : 'Reassign ') + t.id, isDirty: () => team && (team.value !== cur || note.value.trim() !== ''),
      body: (b) => { team = app.select(SD.rules.TEAMS, cur, { id: 'reassign-team' }); note = h('textarea', { id: 'reassign-note', rows: 3, placeholder: 'Optional note for the team' }); b.append(app.field('Team', team), app.field('Note', note)); },
      actions: [{ id: 'confirm', label: escalate ? 'Escalate' : 'Reassign', cls: 'primary', fn: (api) => { const v = [team.value, note.value.trim()]; api.close().then(() => app.reassign(t.id, v[0], v[1], escalate)); } }], cancelLabel: 'Cancel' });
  }
  function newTicket() {
    const f = {};
    let err;
    const blankish = () => Object.keys(f).every((k) => (f[k].type === 'checkbox' ? !f[k].checked : f[k].tagName === 'SELECT' ? f[k].value === f[k].dataset.def : !f[k].value.trim()));
    const save = async (api, run) => {
      const subject = f.subject.value.trim(); const body = f.body.value.trim();
      if (!subject && !body) { err.textContent = 'Add a subject or a message to create the ticket (or press Cancel).'; f.subject.focus(); return; }
      const t = SD.importers.normTicket({ id: 'T-' + (2000 + app.state.tickets.length + 1) + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(), subject, body: body || subject, name: f.name.value.trim() || 'Customer', email: f.email.value.trim(), tier: f.tier.value, vip: f.vip.checked ? 'yes' : '', channel: f.channel.value, priority: f.priority.value, tags: f.tags.value, created: new Date().toISOString() }, 0);
      t.imported = false; t.custom = true;
      app.state.tickets.push(t); app.save();
      await api.close();
      app.go('#inbox/' + encodeURIComponent(t.id));
      if (run) { try { await app.process(t); } catch (e) { /* toast shown */ } app.refresh(); }
      toast('Ticket ' + t.id + ' created.');
    };
    sheet({ id: 'new-ticket', title: 'New ticket', wide: true, isDirty: () => !blankish(),
      body: (b) => {
        const sel = (k, opts, v) => { f[k] = app.select(opts, v, { id: 'nt-' + k }); f[k].dataset.def = v; return f[k]; };
        f.name = h('input', { type: 'text', id: 'nt-name', autocomplete: 'off', placeholder: 'Ada Lovelace' }); f.email = h('input', { type: 'email', id: 'nt-email', autocomplete: 'off', placeholder: 'ada@example.com' });
        f.subject = h('input', { type: 'text', id: 'nt-subject', placeholder: 'Can\u2019t connect Slack' }); f.body = h('textarea', { id: 'nt-body', rows: 6, placeholder: 'What the customer wrote' }); f.tags = h('input', { type: 'text', id: 'nt-tags', placeholder: 'slack, integrations' }); f.vip = h('input', { type: 'checkbox', id: 'nt-vip' });
        err = h('div', { class: 'small', style: 'color:var(--stop);min-height:1.2em', role: 'alert' });
        b.append(h('form', { novalidate: true, onsubmit: (e) => e.preventDefault() },
          h('div', { class: 'cols' }, app.field('Customer name', f.name), app.field('Email', f.email, 'Used to spot repeat contacts.')),
          h('div', { class: 'cols' }, app.field('Plan', sel('tier', [['free', 'Free'], ['team', 'Team'], ['business', 'Business'], ['enterprise', 'Enterprise']], 'team')), app.field('Channel', sel('channel', ['email', 'chat', 'web', 'phone', 'social'], 'email'))),
          h('div', { class: 'cols' }, app.field('Priority', sel('priority', ['low', 'normal', 'high', 'urgent'], 'normal')), app.field('Tags', f.tags, 'Comma-separated')),
          h('label', { class: 'switch', style: 'margin-bottom:12px' }, f.vip, 'VIP customer'),
          app.field('Subject', f.subject), app.field('Message', f.body), err));
      },
      actions: [{ id: 'create-run', label: 'Create & run agent', cls: 'primary', fn: (api) => save(api, true) }, { id: 'create', label: 'Create', fn: (api) => save(api, false) }], cancelLabel: 'Cancel' });
  }
  const EXAMPLE = 'id,subject,body,customer_name,email,tier,channel,priority,tags\nT-5001,Export to CSV?,"How do I export my tasks to a spreadsheet?",Sam Lee,sam@example.com,team,email,normal,export\nT-5002,Charged twice,"I see two charges of $24 this month. Please refund one.",Rae Kim,rae@example.com,business,chat,high,billing';
  function importTickets() {
    let ta, file, info, parsed = null;
    const preview = () => { try { parsed = ta.value.trim() ? SD.importers.parseTickets(ta.value, file.dataset.name || '') : null; info.textContent = parsed ? parsed.length + ' ticket' + (parsed.length === 1 ? '' : 's') + ' ready to import.' : ''; info.style.color = ''; } catch (e) { parsed = null; info.textContent = e.message; info.style.color = 'var(--stop)'; } };
    sheet({ id: 'import-tickets', title: 'Import tickets', wide: true, isDirty: () => ta && ta.value.trim() !== '',
      body: (b) => {
        file = h('input', { type: 'file', id: 'import-file', accept: '.csv,.json,text/csv,application/json', onchange: async () => { const fl = file.files[0]; if (!fl) return; file.dataset.name = fl.name; ta.value = await fl.text(); preview(); } });
        ta = h('textarea', { id: 'import-text', rows: 9, class: 'mono', placeholder: 'Paste CSV or JSON here', oninput: preview });
        info = h('div', { class: 'small', role: 'status', style: 'min-height:1.3em' });
        b.append(h('p', { class: 'small muted' }, 'CSV with a header row, or JSON (an array of tickets). Recognised columns: id, subject, body (or message), customer_name, email, tier, vip, channel, priority, tags, created.'), app.field('File', file), app.field('Or paste', ta), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn sm', onclick: () => { ta.value = EXAMPLE; preview(); } }, 'Use example CSV'), info));
      },
      actions: [{ id: 'confirm', label: 'Import', cls: 'primary', fn: (api) => {
        preview(); if (!parsed) { info.textContent = info.textContent || 'Choose a file or paste tickets first.'; info.style.color = 'var(--stop)'; return; }
        const ids = new Set(app.tickets().map((t) => t.id)); let n = 0;
        parsed.forEach((t) => { while (ids.has(t.id)) t.id += '-b'; ids.add(t.id); app.state.tickets.push(t); n++; });
        app.save(); api.close().then(() => { app.refresh(); SD.ui.undoToast('Imported ' + n + ' ticket' + (n === 1 ? '' : 's') + '.', () => { const drop = new Set(parsed.map((t) => t.id)); app.state.tickets = app.state.tickets.filter((t) => !drop.has(t.id)); app.save(); app.refresh(); }); });
      } }], cancelLabel: 'Cancel' });
  }
  function exportMenu() {
    sheet({ id: 'export', title: 'Export conversations',
      body: (b) => b.append(h('p', {}, 'Download every processed ticket with its final reply, decision, team, reasons, sources, model, tokens, cost and latency. API keys are never included.'), h('p', { class: 'small muted' }, 'Exports mark every reply as \u201csent: false\u201d because SupportDesk AI never sends anything.')),
      actions: [
        { id: 'json', label: 'JSON', cls: 'primary', fn: () => { const rows = SD.store.exportConversations(app.tickets(), app.state.results, app.state.states, app.knownKeys()); if (!rows.length) return toast('Process some tickets first.'); SD.ui.download('supportdesk-conversations.json', JSON.stringify(rows, null, 2)); toast('Downloaded ' + rows.length + ' conversations.'); } },
        { id: 'csv', label: 'CSV', fn: () => { const rows = SD.store.exportConversations(app.tickets(), app.state.results, app.state.states, app.knownKeys()); if (!rows.length) return toast('Process some tickets first.'); const head = ['id', 'subject', 'customer', 'email', 'status', 'decision', 'team', 'confidence', 'reasons', 'sources', 'reply', 'mode', 'model', 'cost_usd', 'latency_ms']; SD.ui.download('supportdesk-conversations.csv', SD.importers.toCSV([head].concat(rows.map((r) => [r.ticket.id, r.ticket.subject, r.ticket.customer && r.ticket.customer.name, r.ticket.customer && r.ticket.customer.email, r.status, r.decision, r.team || '', Math.round(r.confidence * 100) / 100, r.reasons.join('; '), r.sources.join('; '), r.reply, r.mode, r.model, r.cost == null ? '' : r.cost, r.latencyMs]))), 'text/csv'); toast('Downloaded ' + rows.length + ' conversations.'); } }
      ] });
  }
  // keyboard: j/k to move, r to run
  document.addEventListener('keydown', (e) => {
    if (app.route.tab !== 'inbox' || SD.ui.stack.top() || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (e.key === 'j' || e.key === 'k') { const ids = $$('.titem').map((x) => x.dataset.id); if (!ids.length) return; const i = ids.indexOf(app.route.param); const n = e.key === 'j' ? Math.min(ids.length - 1, i + 1) : Math.max(0, i - 1); app.go('#inbox/' + encodeURIComponent(ids[i < 0 ? 0 : n])); e.preventDefault(); }
    if (e.key === 'r' && app.route.param) { const b = $('#run-agent'); if (b) { b.click(); e.preventDefault(); } }
  });
  app.views.inbox = { render };
  app.openTicketSheets = { newTicket, importTickets, rejectSheet, reassignSheet, editReply };
})();
