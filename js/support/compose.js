/* SupportDesk demo composer and self-check. The composer is extractive: it quotes the most relevant
   lines from the retrieved articles, in order, with [n] citations, inside a templated reply. The
   self-check grades any reply (demo or model-written) for grounding, citations and policy safety. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../agentkit/text.js'));
  else (root.SD = root.SD || {}).compose = factory(root.AgentKit.text);
})(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';
  const L10N = {
    es: { hi: 'Hola', note: '(Respuesta en ingl\u00e9s generada en modo demo. Un compa\u00f1ero la revisar\u00e1 y la traducir\u00e1 si hace falta.)' },
    fr: { hi: 'Bonjour', note: '(R\u00e9ponse en anglais g\u00e9n\u00e9r\u00e9e en mode d\u00e9mo. Un coll\u00e8gue la relira et la traduira si besoin.)' },
    de: { hi: 'Hallo', note: '(Antwort auf Englisch im Demo-Modus erstellt. Ein Kollege pr\u00fcft und \u00fcbersetzt sie bei Bedarf.)' },
    pt: { hi: 'Ol\u00e1', note: '(Resposta em ingl\u00eas gerada no modo demo. Um colega vai rev\u00ea-la e traduzi-la se necess\u00e1rio.)' },
    it: { hi: 'Ciao', note: '(Risposta in inglese generata in modalit\u00e0 demo. Un collega la rivedr\u00e0 e la tradurr\u00e0 se serve.)' }
  };
  // Break a chunk into quotable units: list items, table rows (as "a: b"), or sentences.
  function units(chunk) {
    const out = []; let group = 0; let inList = false; let header = null;
    String(chunk.text).split('\n').forEach((line) => {
      const l = line.trim();
      if (!l) { inList = false; header = null; return; }
      if (/\|/.test(l)) {
        const cells = l.split('|').map((x) => x.trim()).filter(Boolean);
        if (cells.every((c) => /^:?-{3,}:?$/.test(c))) return;
        if (!header) { header = cells; return; }
        out.push({ text: cells.length === 2 ? cells[0] + ': ' + cells[1] + (header[1] ? ' (' + header[1].toLowerCase() + ')' : '') : cells[0] + ': ' + cells.slice(1).map((c, i) => (header[i + 1] ? header[i + 1] + ' ' : '') + c).join(', '), kind: 'row', group: chunk.id + 'table-' + header.join('|') });
        return;
      }
      header = null;
      const li = l.match(/^(-|\d+\.)\s+(.*)$/);
      if (li) { if (!inList) { group++; inList = true; } out.push({ text: li[2], kind: li[1] === '-' ? 'bullet' : 'step', group: chunk.id + 'list' + group }); return; }
      inList = false;
      group++;
      T.sentences(l).forEach((s) => out.push({ text: s, kind: 'sentence', group: chunk.id + 'p' + group }));
    });
    const htoks = T.tokenize(chunk.heading || '');
    return out.map((u, i) => Object.assign(u, { i, toks: T.tokenize(u.text), htoks }));
  }
  function scoreUnits(us, qset, idf) {
    us.forEach((u) => {
      const seen = new Set(); let s = 0;
      u.toks.forEach((t) => { if (qset.has(t) && !seen.has(t)) { seen.add(t); s += idf ? idf(t) : 1; } });
      (u.htoks || []).forEach((t) => { if (qset.has(t) && !seen.has(t)) { seen.add(t); s += 0.5 * (idf ? idf(t) : 1); } });
      u.score = s / (1 + 0.015 * u.toks.length);
    });
    return us;
  }
  function pick(us, max) {
    const best = Math.max(0, ...us.map((u) => u.score));
    if (!best) return [];
    let chosen = us.filter((u) => u.score >= best * 0.3).sort((a, b) => b.score - a.score).slice(0, max);
    // Sentences that lean on the previous one ("Then ...", "This ...") bring it along.
    chosen.slice().forEach((u) => { if (u.kind === 'sentence' && /^(wait|then|this|that|it|they|these|those|each|both|after that|if it still|otherwise)\b/i.test(u.text)) { const prev = us[u.i - 1]; if (prev && prev.group === u.group && !chosen.includes(prev)) chosen.push(prev); } });
    // Steps are only useful together: pull in the whole numbered list.
    const groups = new Set(chosen.filter((u) => u.kind === 'step' || u.kind === 'row').map((u) => u.group));
    us.forEach((u) => { if (groups.has(u.group) && !chosen.includes(u)) chosen.push(u); });
    // When a full list of steps is included, keep at most two other sentences around it.
    if (groups.size) { const extra = chosen.filter((u) => u.kind === 'sentence').sort((a, b) => b.score - a.score); extra.slice(2).forEach((u) => chosen.splice(chosen.indexOf(u), 1)); }
    return chosen.sort((a, b) => a.i - b.i);
  }
  function render(picked, n) {
    const blocks = []; let cur = null; let step = 0;
    picked.forEach((u) => {
      const t = u.text.replace(/\s+/g, ' ').trim();
      const list = u.kind !== 'sentence';
      if (!cur || cur.list !== list || (list && cur.group !== u.group)) { cur = { list, group: u.group, lines: [] }; blocks.push(cur); step = 0; }
      if (list) cur.lines.push((u.kind === 'step' ? (++step) + '. ' : '- ') + t);
      else if (cur.lines.length) cur.lines[0] += ' ' + t; else cur.lines.push(t);
    });
    const out = blocks.map((b) => b.lines.join('\n'));
    if (out.length) out[out.length - 1] += ' [' + n + ']';
    return out.join('\n\n');
  }
  function firstName(c) { return ((c && c.name) || 'there').split(/\s+/)[0]; }
  const TEAM_LINE = { security: 'our security team', legal: 'our legal and billing leads', billing: 'our billing team', refunds: 'our billing team' };
  /* Compose a demo reply. ctx: { ticket, cls, sources: [{chunk, relevance}], idf, settings, kind } */
  function composeDemo(ctx) {
    const { ticket, cls, sources } = ctx; const st = ctx.settings || {};
    const qset = new Set(T.tokenize(cls.query || (ticket.subject + ' ' + ticket.body)));
    const lang = cls.language.code; const l10n = L10N[lang];
    const out = [];
    out.push((l10n ? l10n.hi : (st.greeting || 'Hi')) + ' ' + firstName(ticket.customer) + ',');
    const used = [];
    const cat = cls.category.id;
    const empathy = cls.sentiment.label === 'angry' ? 'I\u2019m really sorry about this. I understand how frustrating it is to keep running into the same problem, and I want to get it sorted for you.' : cls.sentiment.label === 'negative' ? 'Sorry for the trouble, and thanks for your patience.' : (st.opener || 'Thanks for reaching out.');
    out.push(empathy);
    if (ctx.kind === 'vague') {
      out.push('I\u2019d like to help, but I need a little more detail first. Could you tell me:\n- what you were trying to do,\n- what happened instead (including any error message or code),\n- and whether it happens on the web, desktop or mobile app?');
    } else if (ctx.kind === 'nodocs') {
      out.push('I couldn\u2019t find an answer to this in our help center, so I\u2019ve passed your question to a teammate who can give you an accurate answer.');
    } else {
      if (cat === 'security' || cat === 'legal') out.push('I\u2019ve flagged this for ' + TEAM_LINE[cat] + ', who handle these requests directly and will contact you shortly.' + (cat === 'security' ? ' In the meantime, here are steps from our help center you can take right away:' : ''));
      else if (cat === 'out-of-scope') out.push('That request is outside what Orbitask support can help with, so I can\u2019t assist with it here. Here\u2019s what we do cover:');
      const top = sources[0] ? sources[0].relevance : 0;
      let firstBest = 0;
      sources.forEach((s, idx) => {
        if (idx > 0 && (s.relevance < Math.max(0.3, top * 0.6) || used.length >= 2)) return;
        if (cat === 'legal' && idx > 0) return;
        // Quote from the whole article (all its chunks), not just the best-matching chunk.
        const parts = (ctx.chunksFor && ctx.chunksFor(s.chunk.docId)) || [s.chunk];
        const us = scoreUnits([].concat(...parts.map((c) => units(c).map((u) => Object.assign(u, { best: c.id === s.chunk.id })))).map((u, i) => Object.assign(u, { i })), qset, ctx.idf);
        us.forEach((u) => { if (u.best) u.score *= 1.6; });
        const picked = pick(us, idx === 0 ? 4 : 2);
        if (idx > 0 && picked.length && firstBest && Math.max(...picked.map((u) => u.score)) < firstBest * 0.6) return;
        if (idx === 0) firstBest = Math.max(0, ...picked.map((u) => u.score));
        if (!picked.length) return;
        used.push(idx);
        out.push(render(picked, idx + 1));
      });
      if (cat === 'refunds') out.push('Any refund is confirmed by a teammate before it\u2019s issued, and you\u2019ll get an email when it\u2019s done.');
    }
    if (l10n) out.push(l10n.note);
    out.push(cat === 'security' || cat === 'legal' || ctx.kind === 'nodocs' ? 'A teammate will follow up with you directly. You don\u2019t need to do anything else for now.' : (st.closing || 'If that doesn\u2019t solve it, just reply to this message and a teammate will take a look.'));
    out.push(st.signature || '\u2014 The Orbitask Support Team');
    return { text: out.join('\n\n'), cited: used.map((i) => i + 1) };
  }
  const BOILER = /^(hi|hello|hola|bonjour|hallo|thanks|thank you|sorry|i\u2019m really sorry|i'm really sorry|if that|\u2014|--|regards|best|cheers|i\u2019ve flagged|i've flagged|i\u2019ve passed|i've passed|i couldn\u2019t|i couldn't|i\u2019d like|i'd like|that request|here\u2019s what|any refund|\(|- what|- and|in the meantime|i understand|i want to|a teammate will|you don\u2019t need|un compa|un coll|ein koll|um colega|un collega)/i;
  const POLICY = [
    { id: 'promise-refund', label: 'Promises a refund or credit', re: /\b(i|we)('ve| have| will|'ll)? (already )?(issued|processed|approved|refunded|credited|will refund|will issue)\b|\byour refund (has been|is being|was) (issued|processed|approved)\b|\bi('ve| have) (refunded|credited)\b/i },
    { id: 'claims-action', label: 'Claims an account action was taken', re: /\bi('ve| have) (deleted|disabled|reset|turned off|removed|changed|upgraded|downgraded|cancell?ed) (your|the)\b/i },
    { id: 'guarantee', label: 'Makes a guarantee', re: /\b(guarantee[ds]?|100% sure|definitely will never)\b/i },
    { id: 'secrets', label: 'Asks for or includes secrets', re: /\b(send|share|reply with|give) (me |us )?(your )?(password|card number|2fa code|recovery codes?|api token)\b|\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/i },
    { id: 'prompt-leak', label: 'Reveals instructions or system prompt', re: /\b(system prompt|my instructions|i was instructed|as an ai language model|developer message)\b/i },
    { id: 'other-customers', label: 'Mentions other customers\u2019 data', re: /\b(other customers?|another customer)('s)? (emails?|data|accounts?) (are|is|include)\b/i },
    { id: 'legal-advice', label: 'Gives legal advice', re: /\b(legally|you should sue|this is (not )?illegal|under the law you)\b/i }
  ];
  function selfCheck(reply, sources, opts) {
    const o = opts || {};
    const text = String(reply || '');
    const issues = [];
    const cites = (text.match(/\[(\d+)\]/g) || []).map((x) => +x.slice(1, -1));
    const badCites = cites.filter((n) => n < 1 || n > sources.length);
    if (badCites.length) issues.push({ id: 'bad-citation', label: 'Cites a source that wasn\u2019t retrieved: [' + badCites.join('], [') + ']' });
    const vocab = new Set(); sources.forEach((s) => T.tokenize((s.articleText || s.chunk.text) + ' ' + s.chunk.title + ' ' + (s.chunk.heading || '')).forEach((t) => vocab.add(t)));
    const ticketVocab = new Set(T.tokenize(o.ticketText || ''));
    const claims = [];
    text.split(/\n+/).forEach((para) => T.sentences(para).forEach((s) => { const clean = s.replace(/\[\d+\]/g, '').trim(); if (!BOILER.test(clean.replace(/^[-\d.\s]+/, '')) && T.tokenize(clean).length >= 4) claims.push(clean); }));
    const graded = claims.map((c) => { const toks = T.tokenize(c); const hit = toks.filter((t) => vocab.has(t) || ticketVocab.has(t)).length; return { text: c, support: hit / toks.length }; });
    const groundedRatio = graded.length ? graded.filter((g) => g.support >= 0.6).length / graded.length : (o.kind === 'vague' || o.kind === 'nodocs' ? 1 : 0);
    POLICY.forEach((p) => { if (p.re.test(text)) issues.push({ id: p.id, label: p.label }); });
    const needsCite = sources.length && !['vague', 'nodocs'].includes(o.kind);
    if (needsCite && !cites.length) issues.push({ id: 'no-citation', label: 'Doesn\u2019t cite any source' });
    if (o.key && o.key.length >= 8 && text.includes(o.key)) issues.push({ id: 'key-leak', label: 'Contains an API key' });
    const policySafe = !issues.some((i) => !['no-citation', 'bad-citation'].includes(i.id));
    return { groundedRatio: Math.round(groundedRatio * 100) / 100, grounded: groundedRatio >= 0.7, claims: graded, citations: Array.from(new Set(cites)), citationsOk: !badCites.length && (!needsCite || cites.length > 0), policySafe, issues };
  }
  function confidence(parts) {
    const r = parts.relevance || 0; const g = parts.groundedRatio || 0; const c = parts.certainty || 0;
    let v = 0.5 * r + 0.3 * g + 0.2 * c;
    if (parts.kind === 'vague') v = Math.min(v, 0.3);
    if (parts.kind === 'nodocs') v = Math.min(v, 0.2);
    if (!parts.policySafe) v -= 0.25;
    if (!parts.citationsOk) v -= 0.15;
    return Math.max(0, Math.min(1, Math.round(v * 100) / 100));
  }
  return { units, composeDemo, selfCheck, confidence, POLICY, L10N };
});
