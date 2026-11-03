/* SupportDesk AI app core: state, indexing, the agent, model selection, routing and shared actions.
   Views live in js/views/*.js and register themselves on SD.app.views. */
(function (root) {
  'use strict';
  const { $, $$, h, toast, undoToast, sheet, ask } = SD.ui;
  const AK = root.AgentKit; const ST = SD.store;
  const PROVIDER_IDS = Object.keys(AK.llm.PROVIDERS);
  const keys = AK.keystore.createKeyStore({ prefix: 'supportdesk' });
  const app = { views: {}, keys, state: ST.load(), agent: SD.pipeline.createAgent({}), indexInfo: null, emb: { status: 'off', done: 0, total: 0, error: '' }, webllm: { status: 'idle', text: '' }, processing: null, route: { tab: 'inbox', param: '' } };
  root.SD.app = app;
  const S = () => app.state;

  // ---------- data ----------
  app.docs = () => SD.sampleKB.filter((d) => !S().removedSample.includes(d.id)).concat(S().docs);
  app.tickets = () => SD.sampleTickets.filter((t) => !S().removedTickets.includes(t.id)).concat(S().tickets).slice().sort((a, b) => String(b.created).localeCompare(String(a.created)));
  app.ticket = (id) => app.tickets().find((t) => t.id === id) || null;
  app.rules = () => SD.rules.normalize(S().rules);
  app.prices = () => Object.assign({}, AK.llm.PRICES, S().prices || {});
  app.knownKeys = () => PROVIDER_IDS.map((p) => keys.get(p)).filter(Boolean);
  app.status = (id) => { const s = S().states[id]; return s ? s.status : 'new'; };
  app.queue = () => app.tickets().filter((t) => ['needs_review', 'escalated', 'rejected'].includes(app.status(t.id)));
  app.STATUS = { new: 'New', auto_resolved: 'Auto-resolved', needs_review: 'Needs review', escalated: 'Escalated', resolved: 'Resolved', rejected: 'Draft rejected' };
  app.STATUS_CHIP = { new: 'info', auto_resolved: 'ok', needs_review: 'warn', escalated: 'stop', resolved: 'ok', rejected: '' };
  let saveTimer = null;
  app.save = (now) => {
    clearTimeout(saveTimer);
    const run = () => { const r = ST.save(S()); if (!r.ok && r.error) toast(r.error); };
    if (now) run(); else saveTimer = setTimeout(run, 150);
  };
  window.addEventListener('pagehide', () => app.save(true));

  // ---------- index ----------
  app.reindex = async () => {
    const t0 = performance.now();
    app.indexInfo = app.agent.index(app.docs());
    app.indexInfo.ms = Math.round(performance.now() - t0);
    if (S().settings.embeddings) await app.enableEmbeddings(true);
    return app.indexInfo;
  };
  let embedder = null;
  app.enableEmbeddings = async (quiet) => {
    if (!navigator.onLine && !embedder) { app.emb = { status: 'error', error: 'Smart search needs a connection the first time (to download the model).', done: 0, total: 0 }; app.refresh(); return; }
    app.emb = { status: 'loading', done: 0, total: 0, error: '', pct: 0 }; app.refresh();
    try {
      embedder = embedder || await AK.embed.load((p) => { app.emb.pct = Math.round(p.progress || 0); app.paintEmb(); });
      app.emb.status = 'indexing';
      const r = app.agent.retriever;
      await r.enableEmbeddings(embedder, (d, t) => { app.emb.done = d; app.emb.total = t; app.paintEmb(); });
      app.emb.status = 'ready';
      if (!quiet) toast('Smart search is on: ' + app.emb.total + ' chunks embedded.');
    } catch (e) {
      app.emb = { status: 'error', error: 'Could not load the embedding model: ' + (e.message || e) + '. Keyword search still works.', done: 0, total: 0 };
    }
    app.refresh();
  };
  app.paintEmb = () => { $$('[data-emb-status]').forEach((el) => { el.textContent = app.embLabel(); }); };
  app.embLabel = () => {
    const e = app.emb;
    if (!S().settings.embeddings) return 'Off (keyword search only)';
    if (e.status === 'loading') return 'Downloading model\u2026 ' + (e.pct || 0) + '%';
    if (e.status === 'indexing') return 'Embedding chunks\u2026 ' + e.done + '/' + e.total;
    if (e.status === 'ready') return 'On (hybrid keyword + meaning)';
    if (e.status === 'error') return e.error;
    return 'Starting\u2026';
  };

  // ---------- model ----------
  app.modelCfg = () => {
    const s = S().settings; const p = s.provider in AK.llm.PROVIDERS ? s.provider : 'openai'; const P = AK.llm.PROVIDERS[p];
    return { provider: p, model: (s.models && s.models[p]) || (p === 'compatible' && s.compatModel) || P.defaultModel, baseUrl: p === 'compatible' ? (s.baseUrl || P.baseUrl) : '', key: keys.get(p) };
  };
  app.llm = () => {
    const s = S().settings;
    if (s.mode === 'live') {
      const c = app.modelCfg(); const P = AK.llm.PROVIDERS[c.provider];
      if (P.needsKey && !c.key) return { error: 'Live mode needs your ' + P.label + ' API key. Add it in Settings \u203a AI model, or switch back to demo mode.' };
      return { label: P.label, model: c.model, secret: c.key, call: (msg) => AK.llm.call(c, msg, { prices: app.prices() }) };
    }
    if (s.mode === 'webllm') {
      const model = s.webllmModel || AK.webllm.MODELS[0].id;
      return { label: 'In-browser (WebLLM)', model, call: (msg) => AK.webllm.call({ model, onProgress: (p) => { app.webllm = { status: 'loading', text: p.text || '' }; $$('[data-webllm-status]').forEach((el) => { el.textContent = p.text || ''; }); } }, msg) };
    }
    return null;
  };
  app.modeLabel = () => {
    const s = S().settings;
    if (s.mode === 'live') { const c = app.modelCfg(); return 'Live \u00b7 ' + AK.llm.PROVIDERS[c.provider].label + ' \u00b7 ' + c.model; }
    if (s.mode === 'webllm') return 'In-browser model';
    return 'Demo mode \u00b7 no AI key';
  };
  app.paintMode = () => { const c = $('#mode-chip'); c.textContent = app.modeLabel(); c.className = 'mode-chip ' + (S().settings.mode === 'demo' ? 'demo' : 'live'); c.title = S().settings.mode === 'demo' ? 'Demo mode: local retrieval + extractive composer, no AI model. Click to add your own key.' : 'Replies are drafted by your model. Click to change.'; };

  // ---------- agent ----------
  const STATUS_OF = { auto: 'auto_resolved', review: 'needs_review', escalate: 'escalated' };
  app.process = async (t, opts) => {
    const llm = app.llm();
    if (llm && llm.error) { if (!(opts && opts.quiet)) toast(llm.error); throw Object.assign(new Error(llm.error), { config: true }); }
    const r = await app.agent.run(t, { history: app.tickets(), settings: S().settings, rules: S().rules, llm: llm || null, secretForCheck: llm && llm.secret });
    S().results[t.id] = AK.keystore.redact(r, app.knownKeys());
    S().states[t.id] = { status: STATUS_OF[r.decision.action], team: r.decision.team, reply: r.draft, at: r.at, by: r.decision.action === 'auto' ? 'agent' : '' };
    app.save();
    return r;
  };
  app.processAll = async (onlyNew) => {
    if (app.processing) return;
    const list = app.tickets().filter((t) => !onlyNew || !S().results[t.id]);
    if (!list.length) { toast('Every ticket has been processed. Use \u201cRe-run all\u201d to process them again.'); return; }
    const llm = app.llm();
    if (llm && llm.error) { toast(llm.error); return; }
    app.processing = { done: 0, total: list.length, errors: 0 };
    app.refresh();
    for (const t of list) {
      try { await app.process(t, { quiet: true }); } catch (e) { app.processing.errors++; if (e.config) break; }
      app.processing.done++;
      const bar = $('[data-progress]'); if (bar) { bar.style.width = Math.round((app.processing.done / app.processing.total) * 100) + '%'; }
      const lab = $('[data-progress-label]'); if (lab) lab.textContent = 'Processing ' + app.processing.done + ' of ' + app.processing.total + '\u2026';
      await new Promise((r) => setTimeout(r, 0));
    }
    const p = app.processing; app.processing = null;
    app.save(true);
    const q = app.queue().length;
    toast('Processed ' + p.done + ' ticket' + (p.done === 1 ? '' : 's') + (p.errors ? ' (' + p.errors + ' failed)' : '') + '. ' + q + ' waiting for a human.');
    app.refresh();
  };

  // ---------- human-in-the-loop ----------
  const snap = (id) => ({ st: JSON.parse(JSON.stringify(S().states[id] || null)), fb: S().feedback.length });
  const restore = (id, s) => { if (s.st) S().states[id] = s.st; else delete S().states[id]; S().feedback.length = s.fb; app.save(); app.refresh(); };
  app.approve = (id) => {
    const st = S().states[id]; const r = S().results[id]; if (!st || !r) return;
    const s = snap(id);
    const edited = (st.reply || '').trim() !== (r.draft || '').trim();
    S().states[id] = Object.assign({}, st, { status: 'resolved', by: 'human', at: new Date().toISOString() });
    S().feedback.push({ ticketId: id, action: 'approve', edited, at: new Date().toISOString() });
    app.save(); app.refresh();
    undoToast(id + ' marked resolved. Nothing was emailed: SupportDesk AI never sends mail.', () => restore(id, s));
  };
  app.reject = (id, reason, note, gap) => {
    const s = snap(id);
    S().states[id] = Object.assign({}, S().states[id], { status: 'rejected', rejectReason: reason, at: new Date().toISOString() });
    S().feedback.push({ ticketId: id, action: 'reject', reason, note, gap: !!gap, at: new Date().toISOString() });
    app.save(); app.refresh();
    undoToast('Draft for ' + id + ' rejected' + (gap ? ' and marked as a knowledge gap' : '') + '.', () => restore(id, s));
  };
  app.reassign = (id, team, note, escalate) => {
    const s = snap(id);
    const st = S().states[id] || {};
    S().states[id] = Object.assign({}, st, { team, status: escalate ? 'escalated' : (st.status === 'auto_resolved' || st.status === 'resolved' ? 'needs_review' : st.status), at: new Date().toISOString() });
    S().feedback.push({ ticketId: id, action: escalate ? 'escalate' : 'reassign', team, note, at: new Date().toISOString() });
    app.save(); app.refresh();
    undoToast(id + (escalate ? ' escalated to ' : ' reassigned to ') + team + '.', () => restore(id, s));
  };
  app.reopen = (id) => { const s = snap(id); S().states[id] = Object.assign({}, S().states[id], { status: 'needs_review', by: '' }); app.save(); app.refresh(); undoToast(id + ' is back in the review queue.', () => restore(id, s)); };
  app.toggleGap = (id, on) => {
    S().feedback = S().feedback.filter((f) => !(f.ticketId === id && f.action === 'gap'));
    if (on) S().feedback.push({ ticketId: id, action: 'gap', gap: true, at: new Date().toISOString() });
    app.save(); toast(on ? 'Marked as a knowledge gap. It shows up in Analytics.' : 'Knowledge gap mark removed.');
  };
  app.isGap = (id) => S().feedback.some((f) => f.ticketId === id && f.gap);
  app.deleteTicket = (id) => {
    const t = app.ticket(id); if (!t) return;
    const before = { tickets: S().tickets.slice(), removed: S().removedTickets.slice(), res: S().results[id], st: S().states[id] };
    if (SD.sampleTickets.some((x) => x.id === id)) S().removedTickets.push(id); else S().tickets = S().tickets.filter((x) => x.id !== id);
    delete S().results[id]; delete S().states[id];
    app.save(); if (app.route.param === id) location.hash = '#' + app.route.tab; else app.refresh();
    undoToast('Deleted ticket ' + id + '.', () => { S().tickets = before.tickets; S().removedTickets = before.removed; if (before.res) S().results[id] = before.res; if (before.st) S().states[id] = before.st; app.save(); app.refresh(); });
  };

  // ---------- routing ----------
  app.go = (hash) => { if (location.hash !== hash) location.hash = hash; else app.refresh(); };
  function parse() { const m = (location.hash || '#inbox').slice(1).split('/'); const tab = app.views[m[0]] ? m[0] : 'inbox'; return { tab, param: decodeURIComponent(m.slice(1).join('/') || '') }; }
  app.refresh = (keepScroll) => {
    const r = app.route = parse();
    $$('[data-tab]').forEach((a) => { const on = a.dataset.tab === r.tab; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const n = app.queue().length;
    ['#review-badge', '#review-badge-m'].forEach((s) => { const b = $(s); b.hidden = !n; b.textContent = n; });
    app.paintMode();
    const main = $('#view');
    const keep = {}; $$('[data-keep-scroll]', main).forEach((el) => { keep[el.dataset.keepScroll] = el.scrollTop; });
    const y = window.scrollY;
    const active = document.activeElement && document.activeElement.id;
    main.textContent = '';
    app.views[r.tab].render(main, r.param);
    $$('[data-keep-scroll]', main).forEach((el) => { if (keep[el.dataset.keepScroll]) el.scrollTop = keep[el.dataset.keepScroll]; });
    if (keepScroll !== false) window.scrollTo(0, y);
    if (active) { const el = document.getElementById(active); if (el && main.contains(el)) { el.focus(); if (el.setSelectionRange && el.value != null && el.type !== 'number') { try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) { /* ignore */ } } } }
  };
  let lastTab = '';
  window.addEventListener('hashchange', () => { const r = parse(); const changedTab = r.tab !== lastTab; lastTab = r.tab; app.refresh(!changedTab ? undefined : false); if (changedTab) { window.scrollTo(0, 0); } });

  // ---------- shared widgets ----------
  app.chip = (text, cls) => h('span', { class: 'chip ' + (cls || '') }, text);
  app.statusChip = (id) => { const s = app.status(id); return app.chip(app.STATUS[s], app.STATUS_CHIP[s]); };
  app.meter = (v, label) => h('div', { class: 'meter' }, h('span', { class: 'muted' }, label || 'Confidence'), h('div', { class: 'bar', role: 'img', 'aria-label': (label || 'Confidence') + ' ' + SD.ui.pct(v) }, h('i', { style: 'width:' + Math.round((v || 0) * 100) + '%;background:' + (v >= 0.65 ? 'var(--ok)' : v >= 0.35 ? 'var(--warn)' : 'var(--stop)') })), h('b', {}, SD.ui.pct(v)));
  app.field = (label, input, hint) => h('label', { class: 'f' }, label, hint ? h('span', { class: 'h' }, hint) : null, input);
  app.select = (opts, value, attrs) => h('select', attrs || {}, opts.map((o) => { const v = Array.isArray(o) ? o[0] : o; const l = Array.isArray(o) ? o[1] : o; return h('option', { value: v, selected: v === value }, l); }));
  app.ask = ask; app.sheet = sheet;
  app.about = () => sheet({
    id: 'about', title: 'About SupportDesk AI', wide: true,
    body: (b) => b.append(
      h('p', {}, 'SupportDesk AI is a customer support agent that reads your help docs, drafts answers to tickets with citations, checks its own work and decides whether to auto-resolve, ask a human to review, or escalate to a team with a handoff note.'),
      h('h3', {}, 'Demo mode vs live mode'),
      h('p', {}, 'Demo mode needs no key and works offline. It finds the right articles with keyword search (BM25), optionally adds meaning-based search with a small embedding model that runs in your browser, and writes replies by quoting the most relevant sentences. It is clearly not an AI model, and replies are marked as demo output.'),
      h('p', {}, 'Live mode uses your own key for OpenAI, Anthropic, Google Gemini, or any OpenAI-compatible endpoint such as Ollama, LM Studio or OpenRouter. Only the drafting step uses the model. Classification, the injection check, the self-check and the escalation rules always run locally, so ticket text can never change the rules.'),
      h('h3', {}, 'Privacy'),
      h('ul', {}, h('li', {}, 'There is no SupportDesk server. Docs, tickets and results stay in this browser (localStorage).'), h('li', {}, 'Your API key stays in this browser and is sent only to the provider you chose. It is never put in URLs, share links or exports.'), h('li', {}, '\u201cApprove\u201d and \u201cauto-resolve\u201d only mark tickets resolved here. Nothing is ever emailed or posted.')),
      h('h3', {}, 'Keyboard'),
      h('p', {}, 'Tab moves through controls; Esc closes any dialog; in the inbox, j and k move between tickets and r runs the agent on the open ticket.'),
      h('p', { class: 'small muted' }, 'Open source under the MIT license. Sample help center: \u201cOrbitask\u201d, a made-up project management app.'))
  });
  root.SD.app = app;
})(self);
