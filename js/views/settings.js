/* Settings: AI model (demo / your key / in-browser), persona, languages, escalation rules, prices, data. */
(function () {
  'use strict';
  const app = SD.app; const AK = AgentKit; const { $, h, toast, undoToast, sheet, money, ms } = SD.ui;
  const P = AK.llm.PROVIDERS;
  let lastParam = null; let draftKey = ''; let showKey = false; let testOut = null;
  const S = () => app.state.settings;
  const setS = (k, v, rerender) => { S()[k] = v; app.save(); app.paintMode(); if (rerender) app.refresh(); };
  const saveRules = (cfg, quiet) => { app.state.rules = SD.rules.normalize(cfg); app.save(); if (!quiet) flash(); };
  function flash() { const el = $('#saved-flag'); if (el) { el.textContent = 'Saved'; clearTimeout(flash.t); flash.t = setTimeout(() => { el.textContent = ''; }, 1500); } }
  const host = (u) => { try { return new URL(u).host; } catch (e) { return u; } };
  function modelSection() {
    const s = S(); const c = app.modelCfg(); const prov = P[c.provider];
    const sec = h('section', { class: 'panel ssec', id: 's-model' }, h('h2', {}, 'AI model'));
    const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'How replies are written' }, [['demo', 'Demo (no key)'], ['live', 'Your API key'], ['webllm', 'In-browser model']].map(([v, l]) => h('label', {}, h('input', { type: 'radio', name: 'mode', value: v, checked: s.mode === v, onchange: () => { setS('mode', v, true); toast(v === 'demo' ? 'Demo mode: no AI model, no key.' : v === 'live' ? 'Live mode: replies will be drafted by ' + prov.label + '.' : 'In-browser model selected.'); } }), l)));
    sec.append(seg);
    if (s.mode === 'demo') sec.append(h('div', { class: 'notice', style: 'margin-top:12px' }, h('b', {}, 'Demo mode. '), 'No AI model and no key. The agent finds articles with keyword search (plus optional smart search) and writes replies by quoting them, with citations. Everything works offline. Replies are labelled as demo output.'));
    if (s.mode === 'live') {
      const provSel = app.select(Object.keys(P).map((k) => [k, P[k].label]), c.provider, { id: 'provider', onchange: (e) => { draftKey = ''; testOut = null; setS('provider', e.target.value, true); } });
      const dl = h('datalist', { id: 'model-list' }, prov.models.map((m) => h('option', { value: m })));
      const model = h('input', { type: 'text', id: 'model', list: 'model-list', value: c.model, autocomplete: 'off', spellcheck: 'false', onchange: (e) => { const m = Object.assign({}, S().models); m[c.provider] = e.target.value.trim() || prov.defaultModel; setS('models', m, true); } });
      sec.append(h('div', { class: 'cols', style: 'margin-top:12px' }, app.field('Provider', provSel), app.field('Model', h('div', {}, model, dl), (() => { const pr = AK.llm.priceFor(c.model, app.prices()); return pr ? '$' + pr.in + ' in / $' + pr.out + ' out per 1M tokens' : 'Price unknown: add it under Prices to see costs.'; })())));
      if (c.provider === 'compatible') {
        const base = h('input', { type: 'url', id: 'base-url', value: c.baseUrl, spellcheck: 'false', onchange: (e) => setS('baseUrl', e.target.value.trim(), true) });
        sec.append(app.field('Base URL', base, 'The endpoint that serves /chat/completions.'), h('div', { class: 'row', style: 'margin:-4px 0 12px' }, h('span', { class: 'small muted' }, 'Presets:'), AK.llm.PRESETS.map((p) => h('button', { type: 'button', class: 'btn sm', onclick: () => { const m = Object.assign({}, S().models); m.compatible = p.model; S().models = m; setS('baseUrl', p.baseUrl, true); } }, p.label))),
          h('div', { class: 'notice warn small', style: 'margin-bottom:12px' }, h('b', {}, 'Local servers: '), 'Ollama must allow this site: start it with OLLAMA_ORIGINS=' + location.origin + ' ollama serve. In LM Studio, turn on \u201cEnable CORS\u201d in the server settings. Chrome may ask to let this site reach devices on your local network; allow it. HTTPS pages can reach http://localhost but not other http:// addresses.'));
      }
      const where = app.keys.where(c.provider);
      const keyIn = h('input', { type: showKey ? 'text' : 'password', id: 'api-key', autocomplete: 'off', spellcheck: 'false', placeholder: where ? 'Saved \u2022\u2022\u2022\u2022 (type to replace)' : prov.keyHint, value: draftKey, oninput: (e) => { draftKey = e.target.value; } });
      const remember = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Where to keep the key' }, [['local', 'Remember in this browser'], ['session', 'This tab only']].map(([v, l]) => h('label', {}, h('input', { type: 'radio', name: 'keymode', value: v, checked: (s.keyMode || 'local') === v, onchange: () => { setS('keyMode', v); const k = app.keys.get(c.provider); if (k) { app.keys.set(c.provider, k, v); toast(v === 'session' ? 'Key moved to this tab only. It is forgotten when you close the tab.' : 'Key will be remembered in this browser.'); app.refresh(); } } }), l)));
      sec.append(app.field('API key' + (prov.needsKey ? '' : ' (optional)'), h('div', { class: 'row' }, h('div', { class: 'grow' }, keyIn), h('button', { type: 'button', class: 'btn sm', 'aria-pressed': String(showKey), onclick: () => { showKey = !showKey; app.refresh(); } }, showKey ? 'Hide' : 'Show')), prov.keyUrl ? h('span', {}, 'Get one at ', h('a', { href: prov.keyUrl, target: '_blank', rel: 'noopener noreferrer' }, host(prov.keyUrl)), '. Use a key with a spending limit.') : 'Leave empty for local servers that don\u2019t need one.'),
        h('div', { class: 'row', style: 'margin-bottom:12px' }, remember),
        h('div', { class: 'actions', style: 'margin-top:0' },
          h('button', { type: 'button', class: 'btn primary', id: 'save-key', onclick: () => { if (!draftKey.trim()) { toast('Type a key first.'); return; } app.keys.set(c.provider, draftKey.trim(), s.keyMode || 'local'); draftKey = ''; showKey = false; app.refresh(); toast(prov.label + ' key saved ' + ((s.keyMode || 'local') === 'session' ? 'for this tab only.' : 'in this browser.')); } }, 'Save key'),
          where ? h('button', { type: 'button', class: 'btn danger', id: 'remove-key', onclick: () => { app.keys.clear(c.provider); app.refresh(); toast(prov.label + ' key removed from this browser.'); } }, 'Remove key') : null,
          h('button', { type: 'button', class: 'btn', id: 'test-conn', onclick: testConnection }, 'Test connection'),
          h('span', { class: 'small muted' }, where ? 'Key saved ' + (where === 'session' ? 'for this tab only' : 'in this browser') : prov.needsKey ? 'No key saved' : '')),
        testOut ? h('div', { class: 'notice ' + (testOut.ok ? 'ok' : 'stop'), id: 'test-out', style: 'margin-top:10px' }, testOut.text) : null,
        h('div', { class: 'notice', id: 'key-notice', style: 'margin-top:12px' }, h('b', {}, '\ud83d\udd12 Where your key goes. '), 'It is stored only in this browser (' + ((s.keyMode || 'local') === 'session' ? 'sessionStorage: gone when this tab closes' : 'localStorage on this device') + ') and sent only to ' + host(c.provider === 'compatible' ? c.baseUrl : prov.baseUrl) + ' when a reply is drafted. It is never put in URLs, share links or exports, and SupportDesk has no server. Anyone who can use this browser profile could read it, so remove it on shared computers.'),
        c.provider === 'anthropic' ? h('p', { class: 'small muted' }, 'Anthropic calls from a web page need the \u201canthropic-dangerous-direct-browser-access\u201d header, which SupportDesk sends. The name is Anthropic\u2019s reminder that the key is visible to this page.') : null,
        h('p', { class: 'small muted' }, 'Only the drafting step uses the model. Classification, the injection check, the self-check and the escalation rules run locally, so ticket text can\u2019t talk the model out of them. If a call fails, the demo composer writes the draft and the trace says so.'));
    }
    if (s.mode === 'webllm') {
      const box = h('div', { id: 'webllm-box', style: 'margin-top:12px' }, h('p', { class: 'small muted' }, 'Checking WebGPU\u2026'));
      sec.append(box);
      AK.webllm.support().then((sp) => {
        box.textContent = '';
        if (!sp.ok) { box.append(h('div', { class: 'notice warn' }, sp.reason + ' Tickets fall back to the demo composer until a model loads.')); return; }
        const sel = app.select(AK.webllm.MODELS.map((m) => [m.id, m.label]), s.webllmModel || AK.webllm.MODELS[0].id, { id: 'webllm-model', onchange: (e) => setS('webllmModel', e.target.value) });
        box.append(app.field('Model', sel, 'Runs on your GPU. Downloaded once from the MLC CDN and cached by the browser. Small models write weaker replies than hosted ones.'),
          h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', id: 'webllm-load', onclick: async (e) => { e.target.disabled = true; try { await AK.webllm.load(sel.value, (p) => { $$set('[data-webllm-status]', p.text || ''); }); $$set('[data-webllm-status]', 'Ready. Process tickets to use it.'); } catch (err) { $$set('[data-webllm-status]', 'Could not load: ' + err.message); } e.target.disabled = false; } }, 'Download and load'), h('span', { class: 'small', 'data-webllm-status': '' }, app.webllm.text || '')));
      });
    }
    return sec;
  }
  function $$set(sel, text) { document.querySelectorAll(sel).forEach((el) => { el.textContent = text; }); }
  async function testConnection() {
    const llm = app.llm();
    if (!llm) { testOut = { ok: false, text: 'Pick \u201cYour API key\u201d first.' }; app.refresh(); return; }
    if (llm.error) { testOut = { ok: false, text: llm.error }; app.refresh(); return; }
    const b = $('#test-conn'); if (b) { b.disabled = true; b.textContent = 'Testing\u2026'; }
    try {
      const r = await llm.call({ system: 'You are a connection test.', messages: [{ role: 'user', content: 'Reply with the single word OK.' }], maxTokens: 30, temperature: 0 });
      testOut = { ok: true, text: '\u2713 Connected to ' + llm.label + ' \u00b7 ' + (r.model || llm.model) + ' replied \u201c' + String(r.text).trim().slice(0, 40) + '\u201d \u00b7 ' + r.usage.input + ' in / ' + r.usage.output + ' out tokens \u00b7 ' + money(r.cost) + ' \u00b7 ' + ms(r.latencyMs) };
    } catch (e) { testOut = { ok: false, text: '\u2717 ' + e.message }; }
    app.refresh();
  }
  function personaSection() {
    const s = S();
    const F = [['product', 'Product name'], ['agentName', 'Assistant name'], ['tone', 'Tone and persona', 'Used in live mode prompts.'], ['greeting', 'Greeting word'], ['opener', 'First line'], ['closing', 'Closing line'], ['signature', 'Signature'], ['policies', 'Policies the agent must follow', 'Sent to the model in live mode. Hard rules (no refund promises, no secrets) are also enforced by the local self-check.', true]];
    return h('section', { class: 'panel ssec', id: 's-persona' }, h('h2', {}, 'Persona and replies'),
      h('div', { class: 'cols' }, F.slice(0, 7).map(([k, l, hint]) => app.field(l, h('input', { type: 'text', id: 'p-' + k, value: s[k] || '', oninput: (e) => { S()[k] = e.target.value; app.save(); flash(); } }), hint))),
      app.field(F[7][1], h('textarea', { id: 'p-policies', rows: 3, value: s.policies || '', oninput: (e) => { S().policies = e.target.value; app.save(); flash(); } }), F[7][2]),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn sm', onclick: () => { const before = {}; const d = SD.store.defaultSettings(); F.forEach(([k]) => { before[k] = S()[k]; S()[k] = d[k]; }); app.save(); app.refresh(); undoToast('Persona reset to defaults.', () => { Object.assign(S(), before); app.save(); app.refresh(); }); } }, 'Reset persona'), h('span', { class: 'small muted' }, 'Changes apply the next time a ticket is processed.')));
  }
  function languagesSection() {
    const cfg = app.rules();
    return h('section', { class: 'panel ssec', id: 's-languages' }, h('h2', {}, 'Languages'),
      h('p', { class: 'small muted' }, 'Tickets in a language that isn\u2019t ticked go to human review. In demo mode replies are in English with a short note in the customer\u2019s language; live models reply in the customer\u2019s language.'),
      h('div', { class: 'row' }, Object.keys(SD.classify.LANGS).map((code) => h('label', { class: 'switch', style: 'margin-right:12px' }, h('input', { type: 'checkbox', 'data-lang': code, checked: cfg.supportedLanguages.includes(code), onchange: (e) => { const c = app.rules(); const set = new Set(c.supportedLanguages); if (e.target.checked) set.add(code); else set.delete(code); if (!set.size) { e.target.checked = true; toast('Keep at least one language.'); return; } c.supportedLanguages = Array.from(set); saveRules(c); } }), SD.classify.LANGS[code].name))));
  }
  function rulesSection() {
    const cfg = app.rules();
    const num = (k, label, hint) => app.field(label, h('input', { type: 'number', id: 'r-' + k, min: 0, max: 1, step: 0.05, value: cfg[k], onchange: (e) => { const c = app.rules(); c[k] = Number(e.target.value); saveRules(c); } }), hint);
    const upd = (id, f) => { const c = app.rules(); const r = c.rules.find((x) => x.id === id); f(r); saveRules(c); };
    const rows = cfg.rules.map((r) => h('tr', { 'data-rule': r.id },
      h('td', {}, h('input', { type: 'checkbox', 'aria-label': 'Enable ' + r.label, checked: r.enabled, onchange: (e) => upd(r.id, (x) => { x.enabled = e.target.checked; }) })),
      h('td', {}, h('b', {}, r.label), r.keywords ? h('textarea', { rows: 2, class: 'small', 'aria-label': r.label + ' keywords', style: 'margin-top:4px;min-height:52px', value: r.keywords.join(', '), onchange: (e) => upd(r.id, (x) => { x.keywords = e.target.value.split(',').map((k) => k.trim()).filter(Boolean); }) }) : null,
        'limit' in r ? h('div', { class: 'row small', style: 'margin-top:4px' }, 'Over $', h('input', { type: 'number', min: 0, step: 50, value: r.limit, 'aria-label': 'Refund limit in dollars', onchange: (e) => upd(r.id, (x) => { x.limit = Number(e.target.value); }) })) : null,
        'threshold' in r ? h('div', { class: 'row small', style: 'margin-top:4px' }, 'Sentiment \u2264', h('input', { type: 'number', min: -1, max: 1, step: 0.1, value: r.threshold, 'aria-label': r.label + ' threshold', onchange: (e) => upd(r.id, (x) => { x.threshold = Number(e.target.value); }) })) : null,
        'count' in r ? h('div', { class: 'row small', style: 'margin-top:4px' }, '\u2265', h('input', { type: 'number', min: 1, max: 50, value: r.count, 'aria-label': 'Earlier tickets', onchange: (e) => upd(r.id, (x) => { x.count = Number(e.target.value); }) }), 'earlier tickets in', h('input', { type: 'number', min: 1, max: 365, value: r.days, 'aria-label': 'Days', onchange: (e) => upd(r.id, (x) => { x.days = Number(e.target.value); }) }), 'days') : null),
      h('td', {}, app.select([['review', 'Human review'], ['escalate', 'Escalate']], r.action, { 'aria-label': r.label + ' action', onchange: (e) => upd(r.id, (x) => { x.action = e.target.value; }) })),
      h('td', {}, app.select(SD.rules.TEAMS, r.team, { 'aria-label': r.label + ' team', onchange: (e) => upd(r.id, (x) => { x.team = e.target.value; }) }))));
    return h('section', { class: 'panel ssec', id: 's-rules' }, h('h2', {}, 'Escalation rules'),
      h('div', { class: 'notice', style: 'margin-bottom:12px' }, 'Rules are set here only. Ticket text is treated as untrusted data: instructions inside a ticket (\u201cignore your rules\u201d, \u201cdon\u2019t escalate\u201d) are flagged and can never change these settings.'),
      h('div', { class: 'cols' }, num('autoThreshold', 'Auto-resolve at confidence \u2265', 'Below this, drafts go to human review.'), num('minConfidence', 'Escalate below confidence', 'Very unsure answers go straight to a team.')),
      num('noDocsThreshold', 'No relevant docs below relevance', 'When the best article scores under this, the ticket is a knowledge gap.'),
      h('div', { style: 'overflow:auto' }, h('table', { class: 't rules' }, h('thead', {}, h('tr', {}, h('th', {}, 'On'), h('th', {}, 'Rule'), h('th', {}, 'Action'), h('th', {}, 'Team'))), h('tbody', {}, rows))),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', onclick: async () => { if (await app.ask({ title: 'Re-run all tickets with these rules?', text: 'Every ticket is processed again. Reviews you already did are replaced.', ok: 'Re-run all' })) { app.go('#inbox'); app.processAll(false); } } }, 'Re-run all tickets'), h('button', { type: 'button', class: 'btn sm', onclick: () => { const before = app.state.rules; app.state.rules = null; app.save(); app.refresh(); undoToast('Rules reset to defaults.', () => { app.state.rules = before; app.save(); app.refresh(); }); } }, 'Reset rules')));
  }
  function pricesSection() {
    const pr = app.prices(); const ids = Object.keys(pr);
    const c = app.modelCfg(); if (!pr[c.model] && S().mode === 'live') ids.unshift(c.model);
    return h('section', { class: 'panel ssec', id: 's-prices' }, h('h2', {}, 'Prices'),
      h('p', { class: 'small muted' }, 'US$ per 1 million tokens, used to show cost per reply. List prices checked 3 Nov 2026; edit them if your rate differs. Local and in-browser models cost $0.'),
      h('div', { style: 'overflow:auto;max-height:340px' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, h('th', {}, 'Model'), h('th', {}, 'Input'), h('th', {}, 'Output'))), h('tbody', {}, ids.map((id) => { const p = pr[id] || { in: '', out: '' }; const set = (k, v) => { const all = Object.assign({}, app.state.prices); all[id] = Object.assign({}, pr[id] || { in: 0, out: 0 }, { [k]: Number(v) || 0 }); app.state.prices = all; app.save(); flash(); }; return h('tr', {}, h('td', { class: 'mono' }, id), h('td', {}, h('input', { type: 'number', min: 0, step: 0.01, value: p.in, 'aria-label': id + ' input price', style: 'width:100px', onchange: (e) => set('in', e.target.value) })), h('td', {}, h('input', { type: 'number', min: 0, step: 0.01, value: p.out, 'aria-label': id + ' output price', style: 'width:100px', onchange: (e) => set('out', e.target.value) }))); })))),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn sm', onclick: () => { const before = app.state.prices; app.state.prices = {}; app.save(); app.refresh(); undoToast('Prices reset to list prices.', () => { app.state.prices = before; app.save(); app.refresh(); }); } }, 'Reset prices')));
  }
  function dataSection() {
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', class: 'visually-hidden', id: 'ws-file', onchange: async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; let next; try { next = SD.store.importWorkspace(JSON.parse(await f.text())); } catch (err) { toast(err.message || 'Could not read that file.'); return; } if (!(await app.ask({ title: 'Replace this workspace?', text: 'Docs, tickets, results, settings and rules are replaced by the file. Your saved API keys are kept (exports never contain them).', ok: 'Replace' }))) return; const before = app.state; app.state = next; app.save(true); await app.reindex(); app.refresh(); undoToast('Workspace imported.', async () => { app.state = before; app.save(true); await app.reindex(); app.refresh(); }); } });
    return h('section', { class: 'panel ssec', id: 's-data' }, h('h2', {}, 'Data and privacy'),
      h('ul', { class: 'small' }, h('li', {}, 'Everything is stored in this browser. There is no SupportDesk server and no analytics.'), h('li', {}, 'Exports and share links never include API keys; they are scrubbed even if pasted into a text field.'), h('li', {}, 'Nothing is ever emailed or posted. \u201cApprove\u201d only changes a ticket\u2019s status.')),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn', id: 'export-ws', onclick: () => { SD.ui.download('supportdesk-workspace.json', JSON.stringify(SD.store.exportWorkspace(app.state, app.knownKeys()), null, 1)); toast('Workspace downloaded (no API keys).'); } }, 'Export workspace'),
        h('label', { for: 'ws-file', class: 'btn', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } } }, 'Import workspace'), fileIn,
        h('button', { type: 'button', class: 'btn', id: 'share-link', onclick: async () => { const url = SD.store.shareLink(location.href, S(), app.state.rules, app.knownKeys()); const ok = await SD.ui.copy(url); toast(ok ? 'Link copied. It contains your persona and rules only: no key, docs or tickets.' : 'Copy failed.'); } }, 'Copy share link'),
        h('button', { type: 'button', class: 'btn danger', id: 'forget-keys', onclick: () => { app.keys.clearAll(Object.keys(P)); app.refresh(); toast('All API keys removed from this browser.'); } }, 'Remove all keys'),
        h('button', { type: 'button', class: 'btn danger', id: 'reset-all', onclick: async () => { if (!(await app.ask({ title: 'Reset everything?', text: 'Imported docs, tickets, results, reviews, settings and rules go back to the sample workspace. API keys are kept; remove them separately.', ok: 'Reset', danger: true }))) return; const before = app.state; app.state = SD.store.blank(); app.save(true); await app.reindex(); app.refresh(); undoToast('Workspace reset.', async () => { app.state = before; app.save(true); await app.reindex(); app.refresh(); }); } }, 'Reset everything')));
  }
  function render(main, param) {
    main.append(h('div', { class: 'row', style: 'margin-bottom:12px' }, h('h1', { class: 'grow' }, 'Settings'), h('span', { class: 'small', id: 'saved-flag', role: 'status', style: 'color:var(--ok)' })));
    const nav = h('nav', { class: 'snav', 'aria-label': 'Settings sections' }, [['model', 'AI model'], ['persona', 'Persona'], ['languages', 'Languages'], ['rules', 'Escalation rules'], ['prices', 'Prices'], ['data', 'Data and privacy']].map(([id, l]) => h('a', { href: '#settings/' + id, onclick: (e) => { e.preventDefault(); history.replaceState(history.state, '', '#settings/' + id); const el = document.getElementById('s-' + id); if (el) el.scrollIntoView({ behavior: 'smooth' }); } }, l)));
    main.append(h('div', { class: 'settings' }, nav, h('div', {}, modelSection(), personaSection(), languagesSection(), rulesSection(), pricesSection(), dataSection())));
    if (param !== lastParam) { lastParam = param; if (param) setTimeout(() => { const el = document.getElementById('s-' + param); if (el) el.scrollIntoView(); }, 0); }
  }
  app.views.settings = { render };
})();
