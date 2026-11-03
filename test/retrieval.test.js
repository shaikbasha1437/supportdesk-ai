const test = require('node:test'); const assert = require('node:assert/strict');
const R = require('../js/agentkit/retrieval.js');
const P = require('../js/support/pipeline.js');
const CL = require('../js/support/classify.js');
const G = require('../js/agentkit/guard.js');
const KB = require('../js/data/kb.js');
const TICKETS = require('../js/data/tickets.js');
const retriever = R.createRetriever(P.buildChunks(KB));

test('there are at least 20 varied sample tickets', () => {
  assert.ok(TICKETS.length >= 20);
  const ch = new Set(TICKETS.map((t) => t.channel)); assert.ok(ch.size >= 3, 'several channels');
  const pr = new Set(TICKETS.map((t) => t.priority)); assert.ok(pr.size >= 3, 'several priorities');
  TICKETS.forEach((t) => { assert.ok(t.customer && t.customer.name, t.id + ' customer'); assert.ok(Array.isArray(t.tags), t.id + ' tags'); });
});
// Retrieval quality: every sample ticket with an expected article finds it in the top 2.
for (const t of TICKETS.filter((x) => x.expect.articles.length)) {
  test('retrieval: ' + t.id + ' "' + t.subject + '" finds ' + t.expect.articles.join(' or '), async () => {
    const cls = CL.classify(t);
    const res = await retriever.search(G.sanitize(cls.query), 4, { synonyms: P.SYN });
    const top = res.slice(0, 2).map((r) => r.chunk.docId);
    assert.ok(t.expect.articles.some((a) => top.includes(a)), 'top 2 were ' + top.join(', '));
  });
}
test('results are deduplicated per article and sorted by relevance', async () => {
  const res = await retriever.search('reset password forgot link', 4, { synonyms: P.SYN });
  const docs = res.map((r) => r.chunk.docId);
  assert.equal(new Set(docs).size, docs.length);
  for (let i = 1; i < res.length; i++) assert.ok(res[i - 1].relevance >= res[i].relevance);
  assert.ok(res[0].relevance > 0 && res[0].relevance <= 1);
});
test('a question the docs do not cover scores low relevance', async () => {
  const res = await retriever.search('gantt chart timeline dependencies view', 4, { synonyms: P.SYN });
  assert.ok(!res.length || res[0].relevance < 0.3, 'relevance ' + (res[0] && res[0].relevance));
});
test('dense embeddings are merged by rank fusion once every chunk has a vector', async () => {
  const chunks = P.buildChunks(KB.slice(0, 4));
  const r = R.createRetriever(chunks);
  const fake = { embed: async (texts) => texts.map((t) => { const v = new Float32Array(8); for (const w of t.toLowerCase().split(/\W+/)) v[w.length % 8] += 1; return v; }) };
  assert.equal(r.hasEmbeddings, false);
  const n = await r.enableEmbeddings(fake);
  assert.equal(n, chunks.length); assert.equal(r.hasEmbeddings, true);
  const res = await r.search('change my plan', 3);
  assert.ok(res.length > 0 && res[0].dense != null);
});
