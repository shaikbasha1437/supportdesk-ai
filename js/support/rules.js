/* SupportDesk escalation rules. Pure functions over the classifier/retrieval/self-check results.
   Settings come only from the app (never from ticket text). Outcome: auto-resolve, human review,
   or escalate to a team with reasons and a handoff note. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SD = root.SD || {}).rules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TEAMS = ['Tier 1 Support', 'Tier 2 Support', 'Billing', 'Security', 'Legal', 'Customer Success', 'Product'];
  function defaults() {
    return {
      autoThreshold: 0.65,
      minConfidence: 0.35,
      noDocsThreshold: 0.25,
      supportedLanguages: ['en'],
      rules: [
        { id: 'injection', label: 'Prompt-injection attempt in ticket', enabled: true, action: 'review', team: 'Tier 2 Support' },
        { id: 'security', label: 'Security or data issue', enabled: true, action: 'escalate', team: 'Security', keywords: ['hacked', 'breach', 'unauthorized', 'unauthorised', 'compromised', 'data leak', 'leaked', 'stolen', 'phishing', 'vulnerability'] },
        { id: 'legal', label: 'Legal keywords', enabled: true, action: 'escalate', team: 'Legal', keywords: ['lawyer', 'attorney', 'lawsuit', 'sue', 'legal action', 'court', 'subpoena', 'cease and desist', 'litigation', 'regulator'] },
        { id: 'refund-limit', label: 'Refund over limit', enabled: true, action: 'escalate', team: 'Billing', limit: 500 },
        { id: 'refund', label: 'Any refund or money request', enabled: true, action: 'review', team: 'Billing' },
        { id: 'angry', label: 'Angry customer', enabled: true, action: 'escalate', team: 'Tier 2 Support', threshold: -0.6 },
        { id: 'negative', label: 'Unhappy customer', enabled: true, action: 'review', team: 'Tier 1 Support', threshold: -0.2 },
        { id: 'vip', label: 'VIP or Enterprise customer', enabled: true, action: 'review', team: 'Customer Success' },
        { id: 'repeat', label: 'Repeated contact', enabled: true, action: 'escalate', team: 'Tier 2 Support', count: 1, days: 7 },
        { id: 'no-docs', label: 'No relevant docs found', enabled: true, action: 'escalate', team: 'Product' },
        { id: 'language', label: 'Language not in supported list', enabled: true, action: 'review', team: 'Tier 1 Support' },
        { id: 'out-of-scope', label: 'Out-of-scope request', enabled: true, action: 'review', team: 'Tier 1 Support' },
        { id: 'vague', label: 'Too vague to answer', enabled: true, action: 'review', team: 'Tier 1 Support' },
        { id: 'unsafe', label: 'Draft failed the self-check', enabled: true, action: 'review', team: 'Tier 1 Support' },
        { id: 'low-confidence', label: 'Confidence below minimum', enabled: true, action: 'escalate', team: 'Tier 1 Support' }
      ]
    };
  }
  // Merge a saved config with defaults so new rules appear and unknown fields are dropped.
  function normalize(cfg) {
    const d = defaults(); const c = cfg || {};
    const num = (v, lo, hi, dv) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dv; };
    const out = { autoThreshold: num(c.autoThreshold, 0, 1, d.autoThreshold), minConfidence: num(c.minConfidence, 0, 1, d.minConfidence), noDocsThreshold: num(c.noDocsThreshold, 0, 1, d.noDocsThreshold), supportedLanguages: Array.isArray(c.supportedLanguages) && c.supportedLanguages.length ? c.supportedLanguages.filter((x) => /^[a-z]{2}$/.test(x)) : d.supportedLanguages };
    const saved = new Map((c.rules || []).map((r) => [r.id, r]));
    out.rules = d.rules.map((r) => {
      const s = saved.get(r.id) || {};
      const m = Object.assign({}, r);
      if (typeof s.enabled === 'boolean') m.enabled = s.enabled;
      if (s.action === 'review' || s.action === 'escalate') m.action = s.action;
      if (TEAMS.includes(s.team)) m.team = s.team;
      if ('limit' in r) m.limit = num(s.limit, 0, 1e7, r.limit);
      if ('threshold' in r) m.threshold = num(s.threshold, -1, 1, r.threshold);
      if ('count' in r) m.count = num(s.count, 1, 50, r.count);
      if ('days' in r) m.days = num(s.days, 1, 365, r.days);
      if (r.keywords && Array.isArray(s.keywords)) m.keywords = s.keywords.map((k) => String(k).toLowerCase().trim()).filter(Boolean).slice(0, 60);
      return m;
    });
    return out;
  }
  function kwHit(text, list) { const low = String(text || '').toLowerCase(); return (list || []).filter((k) => (k.includes(' ') ? low.includes(k) : new RegExp('\\b' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(low))); }
  function priorContacts(ticket, history, days) {
    const t0 = Date.parse(ticket.created || '') || Date.now();
    const email = ticket.customer && ticket.customer.email && ticket.customer.email.toLowerCase();
    if (!email) return [];
    return (history || []).filter((h) => h.id !== ticket.id && h.customer && String(h.customer.email).toLowerCase() === email && (() => { const t = Date.parse(h.created || ''); return t && t < t0 && t0 - t <= days * 864e5; })());
  }
  /* ctx: { ticket, cls, injection, sources, check, confidence, kind, history } */
  function decide(ctx, cfgIn) {
    const cfg = normalize(cfgIn);
    const R = new Map(cfg.rules.map((r) => [r.id, r]));
    const text = (ctx.ticket.subject || '') + '\n' + (ctx.ticket.body || '');
    const reasons = [];
    const fire = (id, detail) => { const r = R.get(id); if (r && r.enabled) reasons.push({ rule: id, label: r.label, action: r.action, team: r.team, detail }); };
    const cls = ctx.cls;
    if (ctx.injection && ctx.injection.flagged) fire('injection', ctx.injection.findings.map((f) => f.label).join('; '));
    const sec = kwHit(text, R.get('security').keywords); if (sec.length || cls.category.id === 'security') fire('security', sec.length ? 'Mentions: ' + sec.join(', ') : 'Classified as a security issue');
    const leg = kwHit(text, R.get('legal').keywords); if (leg.length) fire('legal', 'Mentions: ' + leg.join(', '));
    const refundish = cls.category.id === 'refunds';
    const rl = R.get('refund-limit');
    if (refundish && cls.maxAmount > rl.limit) fire('refund-limit', '$' + cls.maxAmount.toLocaleString('en-US') + ' is over the $' + rl.limit.toLocaleString('en-US') + ' limit');
    else if (refundish) fire('refund', cls.maxAmount ? '$' + cls.maxAmount.toLocaleString('en-US') + ' requested' : 'Refund requested');
    if (cls.sentiment.score <= R.get('angry').threshold) fire('angry', 'Sentiment ' + cls.sentiment.score + (cls.sentiment.cues.length ? ' (' + cls.sentiment.cues.slice(0, 4).join(', ') + ')' : ''));
    else if (cls.sentiment.score <= R.get('negative').threshold) fire('negative', 'Sentiment ' + cls.sentiment.score);
    const c = ctx.ticket.customer || {};
    if (c.vip || c.tier === 'enterprise') fire('vip', (c.tier === 'enterprise' ? 'Enterprise plan' : 'VIP') + ' customer');
    const rp = R.get('repeat');
    const prior = priorContacts(ctx.ticket, ctx.history, rp.days);
    if (prior.length >= rp.count) fire('repeat', prior.length + ' earlier ticket' + (prior.length > 1 ? 's' : '') + ' in ' + rp.days + ' days (' + prior.map((p) => p.id).join(', ') + ')');
    if (ctx.kind === 'vague') fire('vague', 'Not enough detail to answer');
    else if (ctx.kind === 'nodocs') fire('no-docs', 'Best match relevance ' + (ctx.sources[0] ? ctx.sources[0].relevance.toFixed(2) : '0') + ' < ' + cfg.noDocsThreshold);
    if (!cfg.supportedLanguages.includes(cls.language.code)) fire('language', cls.language.name + ' is not in the supported list');
    if (cls.category.id === 'out-of-scope') fire('out-of-scope', 'Outside what support covers');
    if (ctx.check && (!ctx.check.policySafe || !ctx.check.citationsOk)) fire('unsafe', ctx.check.issues.map((i) => i.label).join('; '));
    if (ctx.confidence < cfg.minConfidence && ctx.kind !== 'vague' && ctx.kind !== 'nodocs') fire('low-confidence', 'Confidence ' + ctx.confidence.toFixed(2) + ' < ' + cfg.minConfidence);
    let action = 'auto';
    if (reasons.some((r) => r.action === 'escalate')) action = 'escalate';
    else if (reasons.length || ctx.confidence < cfg.autoThreshold) action = 'review';
    if (action === 'review' && !reasons.length) reasons.push({ rule: 'threshold', label: 'Below auto-resolve threshold', action: 'review', team: 'Tier 1 Support', detail: 'Confidence ' + ctx.confidence.toFixed(2) + ' < ' + cfg.autoThreshold });
    const order = ['Security', 'Legal', 'Billing', 'Tier 2 Support', 'Product', 'Customer Success', 'Tier 1 Support'];
    const pool = reasons.filter((r) => r.action === action);
    const team = action === 'auto' ? null : (pool.map((r) => r.team).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] || 'Tier 1 Support');
    return { action, reasons, team, prior: prior.map((p) => p.id), config: { autoThreshold: cfg.autoThreshold, minConfidence: cfg.minConfidence } };
  }
  const NEXT = {
    security: 'Verify identity, review sign-in and export logs, and force sign-out of other sessions if confirmed.',
    legal: 'Do not reply with commitments. Legal to review the cancellation history and the data request deadline.',
    'refund-limit': 'Check eligibility under the refund policy (14-day window for new annual plans) and approve or decline.',
    refund: 'Confirm the duplicate or eligibility in Billing, then approve the refund.',
    angry: 'Personal reply from a senior agent; acknowledge the repeat problem and give a concrete next step.',
    repeat: 'Read the earlier tickets before replying; this customer has already tried the standard steps.',
    'no-docs': 'Answer from product knowledge and consider writing a help article (knowledge gap).',
    injection: 'Treat the ticket text with care; reply only to the genuine question.',
    vip: 'Check the account owner and any contract terms before sending.',
    language: 'Reply in the customer\u2019s language.',
    'low-confidence': 'Write the answer manually; the agent wasn\u2019t sure.'
  };
  function handoff(ctx, decision) {
    const t = ctx.ticket; const c = t.customer || {}; const cls = ctx.cls;
    const facts = [];
    if (cls.maxAmount) facts.push('Amount mentioned: $' + cls.maxAmount.toLocaleString('en-US'));
    const codes = (String(t.body).match(/\b(INV-\d+|[A-Z]{2,5}-\d{3}|E\d{3}|HTTP \d{3}|\d{3} Too Many Requests|v?\d+\.\d+\.\d+)\b/g) || []);
    if (codes.length) facts.push('References: ' + Array.from(new Set(codes)).join(', '));
    if (decision.prior && decision.prior.length) facts.push('Earlier tickets: ' + decision.prior.join(', '));
    if (ctx.injection && ctx.injection.flagged) facts.push('Ticket contains instructions aimed at the AI. They were ignored.');
    const main = decision.reasons.find((r) => r.action === decision.action) || decision.reasons[0];
    return {
      team: decision.team,
      summary: c.name + ' (' + (c.tier || 'unknown plan') + (c.vip ? ', VIP' : '') + ') via ' + t.channel + ': ' + cls.category.intent.toLowerCase() + ' about \u201c' + t.subject + '\u201d. Sentiment ' + cls.sentiment.label + ', urgency ' + cls.urgency.level + ', language ' + cls.language.name + '.',
      reasons: decision.reasons.map((r) => r.label + (r.detail ? ': ' + r.detail : '')),
      facts,
      tried: ctx.sources.length ? 'Searched the help center; best matches: ' + ctx.sources.slice(0, 3).map((s, i) => '[' + (i + 1) + '] ' + s.chunk.title + ' (' + Math.round(s.relevance * 100) + '%)').join(', ') + '. A draft reply is attached.' : 'Searched the help center; nothing relevant found.',
      next: (main && NEXT[main.rule]) || 'Review the draft, edit if needed, then send.'
    };
  }
  return { TEAMS, defaults, normalize, decide, handoff, priorContacts };
});
