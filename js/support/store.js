/* SupportDesk persistence (localStorage), redacted exports and share links. API keys are kept by
   AgentKit.keystore under their own names and are never part of state, exports or share links. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../agentkit/keystore.js'));
  else (root.SD = root.SD || {}).store = factory(root.AgentKit.keystore);
})(typeof self !== 'undefined' ? self : this, function (KS) {
  'use strict';
  const KEY = 'supportdesk.state.v1';
  function defaultSettings() {
    return {
      product: 'Orbitask', agentName: 'Orbi, the Orbitask support assistant', tone: 'friendly, concise and professional', greeting: 'Hi', opener: 'Thanks for reaching out.',
      closing: 'If that doesn\u2019t solve it, just reply to this message and a teammate will take a look.', signature: '\u2014 The Orbitask Support Team',
      policies: 'Never promise refunds; billing approves them. Never share other customers\u2019 data. Security and legal issues always go to a human.',
      mode: 'demo', provider: 'openai', models: {}, baseUrl: '', keyMode: 'local', embeddings: false, webllmModel: '', theme: 'auto', widgetColor: '#4f46e5', widgetTitle: 'Orbitask Help'
    };
  }
  function blank() { return { v: 1, docs: [], removedSample: [], tickets: [], removedTickets: [], results: {}, states: {}, feedback: [], settings: defaultSettings(), rules: null, prices: {} }; }
  function load(storage) {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    try { const raw = s && s.getItem(KEY); if (!raw) return blank(); const j = JSON.parse(raw); const b = blank(); return Object.assign(b, j, { settings: Object.assign(defaultSettings(), j.settings || {}) }); } catch (e) { return blank(); }
  }
  function save(state, storage) {
    const s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!s) return { ok: false };
    const clean = KS.redact(state);
    try { s.setItem(KEY, JSON.stringify(clean)); return { ok: true, bytes: JSON.stringify(clean).length }; } catch (e) { return { ok: false, error: 'Browser storage is full. Remove some imported documents or export and reset.' }; }
  }
  // Full workspace export (docs, tickets, results, settings). Always redacted.
  function exportWorkspace(state, knownKeys) {
    return KS.redact({ app: 'supportdesk-ai', exportedAt: new Date().toISOString(), note: 'API keys are never included in exports.', docs: state.docs, removedSample: state.removedSample, tickets: state.tickets, removedTickets: state.removedTickets, results: state.results, states: state.states, feedback: state.feedback, settings: state.settings, rules: state.rules, prices: state.prices }, knownKeys);
  }
  function importWorkspace(obj) {
    if (!obj || obj.app !== 'supportdesk-ai') throw new Error('That file isn\u2019t a SupportDesk AI export.');
    const b = blank();
    ['docs', 'removedSample', 'tickets', 'removedTickets', 'feedback'].forEach((k) => { if (Array.isArray(obj[k])) b[k] = obj[k]; });
    ['results', 'states', 'prices'].forEach((k) => { if (obj[k] && typeof obj[k] === 'object') b[k] = obj[k]; });
    b.settings = Object.assign(defaultSettings(), KS.redact(obj.settings || {}));
    b.rules = obj.rules || null;
    return b;
  }
  // Conversations (ticket + final reply + decision) for hand-off to other tools.
  function exportConversations(tickets, results, states, knownKeys) {
    return KS.redact(tickets.filter((t) => results[t.id]).map((t) => { const r = results[t.id]; const s = states[t.id] || {}; return { ticket: { id: t.id, subject: t.subject, body: t.body, customer: t.customer, channel: t.channel, priority: t.priority, created: t.created }, reply: s.reply || r.draft, status: s.status || r.decision.action, decision: r.decision.action, team: s.team || r.decision.team, reasons: r.decision.reasons.map((x) => x.label), confidence: r.confidence, sources: r.sources.map((x) => x.title), mode: r.mode, model: r.model, usage: r.usage, cost: r.cost, latencyMs: r.latencyMs, handoff: r.handoff, sent: false }; }), knownKeys);
  }
  function b64e(s) { return typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'); }
  function b64d(s) { return typeof atob !== 'undefined' ? decodeURIComponent(escape(atob(s))) : Buffer.from(s, 'base64').toString('utf8'); }
  // Share link carries only persona settings and rules. Mode/provider/model/baseUrl stay local too.
  const SHARE_FIELDS = ['product', 'agentName', 'tone', 'greeting', 'opener', 'closing', 'signature', 'policies', 'widgetColor', 'widgetTitle'];
  function shareLink(baseUrl, settings, rules, knownKeys) {
    const s = {}; SHARE_FIELDS.forEach((k) => { if (settings[k] != null) s[k] = settings[k]; });
    const payload = KS.redact({ s, r: rules || null }, knownKeys);
    return baseUrl.split('#')[0] + '#config=' + encodeURIComponent(b64e(JSON.stringify(payload)));
  }
  function readShareHash(hash) {
    const m = String(hash || '').match(/#config=([^&]+)/);
    if (!m) return null;
    try { const j = JSON.parse(b64d(decodeURIComponent(m[1]))); const s = {}; SHARE_FIELDS.forEach((k) => { if (j.s && typeof j.s[k] === 'string') s[k] = j.s[k].slice(0, 3000); }); return { settings: KS.redact(s), rules: j.r || null }; } catch (e) { return null; }
  }
  return { KEY, blank, load, save, defaultSettings, exportWorkspace, importWorkspace, exportConversations, shareLink, readShareHash, SHARE_FIELDS };
});
