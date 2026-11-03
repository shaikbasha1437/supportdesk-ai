const test = require('node:test'); const assert = require('node:assert/strict');
const RU = require('../js/support/rules.js');
const P = require('../js/support/pipeline.js');
const KB = require('../js/data/kb.js');
const TICKETS = require('../js/data/tickets.js');
const agent = P.createAgent({ docs: KB });
const byId = (id) => TICKETS.find((t) => t.id === id);
const run = (t, rules) => agent.run(t, { history: TICKETS, rules });

// Every sample ticket gets the decision it was written to test.
for (const t of TICKETS) {
  test('decision: ' + t.id + ' \u2192 ' + t.expect.decision + (t.expect.reason ? ' (' + t.expect.reason + ')' : ''), async () => {
    const r = await run(t);
    assert.equal(r.decision.action, t.expect.decision, 'reasons: ' + r.decision.reasons.map((x) => x.rule).join(', '));
    if (t.expect.reason) assert.ok(r.decision.reasons.some((x) => x.rule === t.expect.reason), 'expected rule ' + t.expect.reason + ', got ' + r.decision.reasons.map((x) => x.rule).join(', '));
    if (r.decision.action !== 'auto') { assert.ok(r.handoff && r.handoff.summary && r.handoff.next); assert.ok(RU.TEAMS.includes(r.decision.team)); }
  });
}
test('refund limit is configurable', async () => {
  const t = byId('T-1004');
  const r1 = await run(t); assert.ok(r1.decision.reasons.some((x) => x.rule === 'refund-limit'));
  const cfg = RU.defaults(); cfg.rules.find((x) => x.id === 'refund-limit').limit = 100000;
  const r2 = await run(t, cfg); assert.ok(!r2.decision.reasons.some((x) => x.rule === 'refund-limit'));
  assert.ok(r2.decision.reasons.some((x) => x.rule === 'refund'));
});
test('disabled rules do not fire and actions can be changed', async () => {
  const t = byId('T-1008');
  const cfg = RU.defaults(); cfg.rules.find((x) => x.id === 'legal').action = 'review';
  const r = await run(t, cfg); const legal = r.decision.reasons.find((x) => x.rule === 'legal');
  assert.equal(legal.action, 'review');
  cfg.rules.find((x) => x.id === 'legal').enabled = false;
  const r2 = await run(t, cfg); assert.ok(!r2.decision.reasons.some((x) => x.rule === 'legal'));
});
test('team priority picks Security over Billing over Tier 1', () => {
  const ctx = { ticket: { id: 'X', subject: 'hacked', body: 'my account was hacked and I want a refund of $50', customer: { tier: 'team' }, created: '2026-11-01T00:00:00Z' }, cls: { category: { id: 'security' }, sentiment: { score: 0, cues: [] }, language: { code: 'en', name: 'English' }, maxAmount: 50 }, injection: { flagged: false }, sources: [{ relevance: 0.9 }], check: { policySafe: true, citationsOk: true, issues: [] }, confidence: 0.9, kind: 'answer', history: [] };
  const d = RU.decide(ctx, RU.defaults());
  assert.equal(d.action, 'escalate'); assert.equal(d.team, 'Security');
});
test('repeat contact uses email and a time window', () => {
  const t = byId('T-1019');
  assert.ok(RU.priorContacts(t, TICKETS, 7).length >= 1);
  assert.equal(RU.priorContacts(t, TICKETS.filter((x) => x.id === t.id), 7).length, 0);
});
test('normalize clamps numbers, keeps new defaults and ignores unknown teams', () => {
  const n = RU.normalize({ autoThreshold: 5, minConfidence: -1, rules: [{ id: 'vip', team: 'Hackers', action: 'delete', enabled: false }, { id: 'evil', enabled: true }] });
  assert.equal(n.autoThreshold, 1); assert.equal(n.minConfidence, 0);
  const vip = n.rules.find((r) => r.id === 'vip'); assert.equal(vip.team, 'Customer Success'); assert.equal(vip.action, 'review'); assert.equal(vip.enabled, false);
  assert.ok(!n.rules.some((r) => r.id === 'evil'));
  assert.equal(n.rules.length, RU.defaults().rules.length);
});
test('unsupported languages go to review, and adding the language removes that reason', async () => {
  const t = byId('T-1011');
  const r = await run(t); assert.ok(r.decision.reasons.some((x) => x.rule === 'language'));
  const cfg = RU.defaults(); cfg.supportedLanguages = ['en', 'es'];
  const r2 = await run(t, cfg); assert.ok(!r2.decision.reasons.some((x) => x.rule === 'language'));
});
