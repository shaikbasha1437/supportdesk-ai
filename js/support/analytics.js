/* SupportDesk analytics over pipeline results and human feedback. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.SD = root.SD || {}).analytics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* results: { [ticketId]: pipelineResult }, states: { [ticketId]: {status, ...} }, feedback: [] */
  function summarize(tickets, results, states, feedback) {
    const rs = tickets.map((t) => results[t.id]).filter(Boolean);
    const n = rs.length;
    const by = (f) => rs.filter(f).length;
    const auto = by((r) => r.decision.action === 'auto');
    const review = by((r) => r.decision.action === 'review');
    const esc = by((r) => r.decision.action === 'escalate');
    const reasons = {};
    rs.forEach((r) => r.decision.reasons.filter((x) => x.action === r.decision.action || r.decision.action !== 'auto').forEach((x) => { reasons[x.label] = (reasons[x.label] || 0) + 1; }));
    const cats = {};
    rs.forEach((r) => { const c = r.classification.category.label; cats[c] = cats[c] || { total: 0, auto: 0 }; cats[c].total++; if (r.decision.action === 'auto') cats[c].auto++; });
    const gaps = [];
    rs.forEach((r) => { if (r.kind === 'nodocs') gaps.push({ ticketId: r.ticketId, why: 'No relevant docs', best: r.allSources[0] ? r.allSources[0].title + ' (' + Math.round(r.allSources[0].relevance * 100) + '%)' : 'none' }); });
    (feedback || []).filter((f) => f.gap).forEach((f) => { if (!gaps.some((g) => g.ticketId === f.ticketId)) gaps.push({ ticketId: f.ticketId, why: 'Marked by a reviewer' + (f.note ? ': ' + f.note : ''), best: '' }); });
    const st = states || {};
    const humanResolved = tickets.filter((t) => st[t.id] && st[t.id].status === 'resolved' && st[t.id].by === 'human').length;
    const rejected = tickets.filter((t) => st[t.id] && st[t.id].status === 'rejected').length;
    const edited = (feedback || []).filter((f) => f.action === 'approve' && f.edited).length;
    const approved = (feedback || []).filter((f) => f.action === 'approve').length;
    const costs = rs.map((r) => r.cost).filter((c) => typeof c === 'number');
    const lat = rs.map((r) => r.latencyMs).filter((x) => typeof x === 'number');
    const tokens = rs.reduce((a, r) => a + (r.usage ? r.usage.input + r.usage.output : 0), 0);
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const pct = (x) => (n ? x / n : 0);
    const sorted = lat.slice().sort((a, b) => a - b);
    return {
      processed: n, total: tickets.length, auto, review, escalated: esc,
      deflection: pct(auto), escalationRate: pct(esc), reviewRate: pct(review),
      avgConfidence: avg(rs.map((r) => r.confidence)),
      reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]),
      categories: Object.entries(cats).sort((a, b) => b[1].total - a[1].total),
      gaps, humanResolved, rejected, approved, edited, editRate: approved ? edited / approved : 0,
      totalCost: costs.reduce((a, b) => a + b, 0), costPerTicket: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0, tokens,
      avgLatency: avg(lat), p95Latency: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
      liveCount: by((r) => r.mode === 'live'), demoCount: by((r) => r.mode === 'demo'),
      injections: by((r) => r.injection && r.injection.flagged)
    };
  }
  return { summarize };
});
