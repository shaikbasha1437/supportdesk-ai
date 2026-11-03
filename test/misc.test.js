const test = require('node:test'); const assert = require('node:assert/strict');
const I = require('../js/support/importers.js');
const A = require('../js/support/analytics.js');
const M = require('../js/agentkit/modal.js');
const P = require('../js/support/pipeline.js');
const KB = require('../js/data/kb.js');
const TICKETS = require('../js/data/tickets.js');

test('CSV parser handles quotes, commas, newlines and a BOM', () => {
  const rows = I.parseCSV('\ufeffsubject,body\n"Hi, there","Line 1\nLine ""2"""\nx,y\n');
  assert.deepEqual(rows[0], ['subject', 'body']);
  assert.deepEqual(rows[1], ['Hi, there', 'Line 1\nLine "2"']);
  assert.deepEqual(rows[2], ['x', 'y']);
  assert.equal(I.parseCSV(I.toCSV(rows)).length, 3);
});
test('tickets import from CSV and JSON with flexible column names', () => {
  const csv = I.parseTickets('title,message,email,name,priority\nCan\u2019t log in,I forgot my password,a@b.co,Ana,high\n,,,,\n', 'x.csv');
  assert.equal(csv.length, 1);
  const t = csv[0]; assert.equal(t.subject, 'Can\u2019t log in'); assert.equal(t.body, 'I forgot my password'); assert.equal(t.customer.email, 'a@b.co'); assert.equal(t.priority, 'high'); assert.ok(t.id);
  const js = I.parseTickets(JSON.stringify({ tickets: [{ subject: 'A', body: 'B' }, { subject: 'C', description: 'D' }] }), 'x.json');
  assert.equal(js.length, 2); assert.equal(js[1].body, 'D');
});
test('documents import from Markdown, HTML and text', () => {
  const md = I.docFromText('guide.md', '# Guide\n\nSome text.'); assert.equal(md.title, 'Guide'); assert.equal(md.type, 'md');
  const h = I.docFromText('page.html', '<title>Page</title><h1>Hello</h1><p>World</p>'); assert.equal(h.title, 'Page'); assert.match(h.text, /World/); assert.doesNotMatch(h.text, /<p>/);
  const t = I.docFromText('notes.txt', 'Plain notes'); assert.ok(t.title); assert.match(t.text, /Plain notes/); assert.ok(t.id);
});
test('analytics: deflection, escalation reasons, confidence, cost', async () => {
  const agent = P.createAgent({ docs: KB }); const results = {};
  for (const t of TICKETS) results[t.id] = await agent.run(t, { history: TICKETS });
  const s = A.summarize(TICKETS, results, {}, [{ ticketId: TICKETS[0].id, gap: true }]);
  assert.equal(s.processed, TICKETS.length);
  assert.equal(s.auto + s.review + s.escalated, TICKETS.length);
  assert.ok(s.deflection > 0.2 && s.deflection < 0.6, 'deflection ' + s.deflection);
  assert.ok(s.reasons.length >= 5); assert.ok(s.reasons.some(([label]) => /injection/i.test(label)));
  assert.equal(s.injections >= 1, true); assert.ok(s.gaps.length >= 1);
  assert.ok(s.avgConfidence > 0 && s.avgConfidence < 1);
});

function fakeHistory() {
  const entries = [{ state: null }]; let i = 0; const listeners = [];
  const H = { get state() { return entries[i].state; }, pushState(s) { entries.splice(i + 1); entries.push({ state: s }); i++; }, go(n) { i = Math.max(0, Math.min(entries.length - 1, i + n)); setTimeout(() => listeners.forEach((f) => f()), 0); }, back() { H.go(-1); } };
  return { H, on: (f) => listeners.push(f), get index() { return i; } };
}
const sheet = (id, dirty) => { const s = { id, shown: false, show() { s.shown = true; }, hide() { s.shown = false; }, isDirty: () => !!(dirty && dirty.v) }; return s; };
test('modal stack: closing from a button pops its history entry', async () => {
  const f = fakeHistory(); const st = M.createModalStack({ history: f.H }); f.on(st.onPopState);
  const a = sheet('a'); st.open(a); assert.equal(f.index, 1); assert.ok(a.shown);
  await st.close('a'); assert.equal(f.index, 0); assert.ok(!a.shown); assert.equal(st.size, 0);
});
test('modal stack: browser Back closes the top sheet only', async () => {
  const f = fakeHistory(); const st = M.createModalStack({ history: f.H }); f.on(st.onPopState);
  const a = sheet('a'); const b = sheet('b'); st.open(a); st.open(b);
  f.H.back(); await new Promise((r) => setTimeout(r, 5));
  assert.ok(a.shown); assert.ok(!b.shown); assert.equal(st.size, 1);
});
test('modal stack: unsaved changes ask before closing, from buttons and from Back', async () => {
  let answer = false; let asked = 0;
  const f = fakeHistory(); const st = M.createModalStack({ history: f.H, confirm: () => { asked++; return answer; } }); f.on(st.onPopState);
  const dirty = { v: true }; const a = sheet('a', dirty); st.open(a);
  assert.equal(await st.requestClose('a'), false); assert.ok(a.shown);
  f.H.back(); await new Promise((r) => setTimeout(r, 5)); assert.ok(a.shown, 'Back kept the sheet'); assert.equal(f.index, 1, 'history entry restored');
  answer = true; assert.equal(await st.requestClose('a'), true); assert.ok(!a.shown); assert.equal(asked, 3);
  dirty.v = false; const b = sheet('b', dirty); st.open(b); assert.equal(await st.requestClose('b'), true); assert.equal(asked, 3, 'clean sheets close without asking');
});
