/* SupportDesk importers: knowledge-base files (Markdown, TXT, HTML, JSON, PDF via pdf.js in the app)
   and tickets (CSV or JSON). Pure parsing here; file reading happens in app.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../agentkit/text.js'));
  else (root.SD = root.SD || {}).importers = factory(root.AgentKit.text);
})(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';
  function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function docFromText(name, raw, type) {
    const base = String(name || 'Pasted text').replace(/\.[a-z0-9]+$/i, '');
    let text = String(raw || ''); let title = '';
    const t = type || (/\.html?$/i.test(name) ? 'html' : /\.md|\.markdown$/i.test(name) ? 'md' : 'txt');
    if (t === 'html') { const h = T.htmlToText(text); text = h.text; title = h.title; }
    if (!title) { const m = text.match(/^\s*#\s+(.+)$/m); title = m ? m[1].trim() : ''; }
    if (!title) { const first = text.trim().split('\n')[0] || ''; title = first.length > 3 && first.length < 90 ? first.replace(/^#+\s*/, '') : base.replace(/[-_]+/g, ' '); }
    if (!/^\s*#\s/m.test(text)) text = '# ' + title + '\n\n' + text;
    return { id: T.slug(title) + '-' + Math.random().toString(36).slice(2, 6), title, category: 'Imported', updated: new Date().toISOString().slice(0, 10), keywords: [], text: text.trim(), source: 'import', type: t, fileName: name || '' };
  }
  // Parse CSV with quotes, escaped quotes and newlines inside quoted cells.
  function parseCSV(src) {
    const rows = []; let row = []; let cell = ''; let q = false; const s = String(src || '').replace(/^\ufeff/, '');
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim()));
  }
  const PRI = ['low', 'normal', 'high', 'urgent'];
  const TIERS = ['free', 'team', 'business', 'enterprise'];
  function normTicket(o, i) {
    const g = (...ks) => { for (const k of ks) { const v = o[k]; if (v != null && String(v).trim()) return String(v).trim(); } return ''; };
    const body = g('body', 'message', 'description', 'text', 'content');
    const subject = g('subject', 'title', 'summary') || body.slice(0, 60) || 'No subject';
    if (!body && !g('subject', 'title')) return null;
    const cust = o.customer && typeof o.customer === 'object' ? o.customer : {};
    const tier = String(cust.tier || g('tier', 'plan')).toLowerCase();
    const pr = String(g('priority') || 'normal').toLowerCase();
    const tags = Array.isArray(o.tags) ? o.tags.map(String) : g('tags').split(/[;,|]/).map((x) => x.trim()).filter(Boolean);
    return {
      id: g('id', 'ticket_id', 'ticketId') || 'T-' + (9000 + i),
      created: g('created', 'created_at', 'date') || new Date().toISOString(),
      channel: (g('channel', 'source') || 'email').toLowerCase(),
      priority: PRI.includes(pr) ? pr : 'normal',
      customer: { name: String(cust.name || g('customer', 'name', 'customer_name', 'from_name') || 'Customer'), email: String(cust.email || g('email', 'customer_email', 'from') || ''), tier: TIERS.includes(tier) ? tier : 'team', vip: !!(cust.vip || /^(true|yes|1)$/i.test(g('vip'))) },
      subject: subject.slice(0, 200), body: body.slice(0, 20000), tags, imported: true
    };
  }
  function parseTickets(text, name) {
    const s = String(text || '').trim();
    let list;
    if (/\.json$/i.test(name || '') || /^[[{]/.test(s)) {
      const j = JSON.parse(s);
      list = Array.isArray(j) ? j : Array.isArray(j.tickets) ? j.tickets : [j];
    } else {
      const rows = parseCSV(s);
      if (rows.length < 2) throw new Error('The CSV needs a header row and at least one ticket.');
      const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
      list = rows.slice(1).map((r) => { const o = {}; head.forEach((h, i) => { o[h] = r[i]; }); return o; });
    }
    const out = list.map(normTicket).filter(Boolean);
    if (!out.length) throw new Error('No tickets found. Each ticket needs at least a subject or a body.');
    return out;
  }
  function csvCell(v) { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function toCSV(rows) { return rows.map((r) => r.map(csvCell).join(',')).join('\n'); }
  return { docFromText, parseCSV, parseTickets, normTicket, toCSV, uid };
});
