const test = require('node:test'); const assert = require('node:assert/strict');
const KS = require('../js/agentkit/keystore.js');
const S = require('../js/support/store.js');
const P = require('../js/support/pipeline.js');
const KB = require('../js/data/kb.js');
const TICKETS = require('../js/data/tickets.js');
const KEYS = ['sk-proj-' + 'a'.repeat(40), 'sk-ant-api03-' + 'b'.repeat(40), 'AIza' + 'c'.repeat(35), 'my-ollama-token-123456'];
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), dump: () => [...m.entries()] }; };
const noKeys = (s) => KEYS.forEach((k) => assert.ok(!s.includes(k), 'leaked ' + k.slice(0, 10)));

test('key store keeps keys per provider in local or session storage only', () => {
  const local = mem(); const session = mem();
  const ks = KS.createKeyStore({ prefix: 'supportdesk', local, session });
  ks.set('openai', KEYS[0], 'local'); ks.set('anthropic', KEYS[1], 'session');
  assert.equal(ks.get('openai'), KEYS[0]); assert.equal(ks.where('openai'), 'local');
  assert.equal(ks.get('anthropic'), KEYS[1]); assert.equal(ks.where('anthropic'), 'session');
  assert.equal(local.getItem('supportdesk.key.anthropic'), null);
  ks.set('openai', KEYS[0], 'session'); assert.equal(local.getItem('supportdesk.key.openai'), null, 'switching mode removes the other copy');
  ks.clearAll(['openai', 'anthropic']); assert.equal(ks.get('openai'), ''); assert.equal(ks.get('anthropic'), '');
});
test('redact drops key fields and masks key-shaped strings anywhere', () => {
  const r = KS.redact({ apiKey: KEYS[0], nested: { 'x-api-key': KEYS[1], note: 'my key is ' + KEYS[2] }, list: ['Bearer ' + 'z'.repeat(30), KEYS[3]] }, [KEYS[3]]);
  noKeys(JSON.stringify(r)); assert.equal(r.apiKey, undefined); assert.match(r.nested.note, /\[redacted\]/);
});
test('keys never appear in saved state, workspace exports, conversation exports or share links', async () => {
  const agent = P.createAgent({ docs: KB });
  const st = S.blank(); st.tickets = TICKETS.slice(0, 5).concat([{ id: 'T-K', subject: 'Key', body: 'Here is my key ' + KEYS[0] + ' can you test it?', customer: { name: 'K', email: 'k@example.com', tier: 'free' }, channel: 'email', priority: 'normal', created: '2026-11-01T00:00:00Z', tags: [] }]);
  for (const t of st.tickets) st.results[t.id] = await agent.run(t, { history: st.tickets });
  st.settings = Object.assign(st.settings, { mode: 'live', provider: 'compatible', baseUrl: 'https://openrouter.ai/api/v1', apiKey: KEYS[0], key: KEYS[1], signature: 'Thanks! ' + KEYS[2] });
  const storage = mem(); S.save(st, storage); noKeys(JSON.stringify(storage.dump()));
  noKeys(JSON.stringify(S.exportWorkspace(st, KEYS)));
  noKeys(JSON.stringify(S.exportConversations(st.tickets, st.results, st.states, KEYS)));
  const link = S.shareLink('https://shaikbasha1437.github.io/supportdesk-ai/#settings', st.settings, null, KEYS);
  noKeys(link); noKeys(Buffer.from(decodeURIComponent(link.split('#config=')[1]), 'base64').toString('utf8'));
  assert.ok(!/openrouter|mode|provider/.test(Buffer.from(decodeURIComponent(link.split('#config=')[1]), 'base64').toString('utf8')), 'share link carries only persona and rules');
});
test('share links round-trip persona and rules, and drop unknown fields', () => {
  const s = S.defaultSettings(); s.signature = '\u2014 Ana from Support';
  const link = S.shareLink('https://example.com/app/', s, { autoThreshold: 0.7 }, []);
  const back = S.readShareHash('#' + link.split('#')[1]);
  assert.equal(back.settings.signature, '\u2014 Ana from Support'); assert.equal(back.rules.autoThreshold, 0.7);
  const evil = '#config=' + encodeURIComponent(Buffer.from(JSON.stringify({ s: { apiKey: KEYS[0], baseUrl: 'https://evil.example', tone: 'calm' } })).toString('base64'));
  const e = S.readShareHash(evil); assert.equal(e.settings.tone, 'calm'); assert.equal(e.settings.baseUrl, undefined); assert.equal(e.settings.apiKey, undefined);
  assert.equal(S.readShareHash('#config=%%%'), null);
});
test('conversation exports are marked as not sent', async () => {
  const agent = P.createAgent({ docs: KB }); const t = TICKETS[0];
  const out = S.exportConversations([t], { [t.id]: await agent.run(t, { history: TICKETS }) }, {}, []);
  assert.equal(out[0].sent, false); assert.ok(out[0].reply);
});
test('workspace import rejects foreign files and re-redacts settings', () => {
  assert.throws(() => S.importWorkspace({ app: 'other' }), /isn.t a SupportDesk AI export/);
  const b = S.importWorkspace({ app: 'supportdesk-ai', docs: [{ id: 'd' }], settings: { apiKey: KEYS[0], tone: 'warm' } });
  assert.equal(b.docs.length, 1); assert.equal(b.settings.tone, 'warm'); assert.equal(b.settings.apiKey, undefined);
});
