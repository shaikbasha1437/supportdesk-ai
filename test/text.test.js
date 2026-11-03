const test = require('node:test'); const assert = require('node:assert/strict');
const T = require('../js/agentkit/text.js');
const P = require('../js/support/pipeline.js');
const KB = require('../js/data/kb.js');

test('chunks keep their section heading and stay within the size budget', () => {
  const text = '# Doc\n\n## Alpha\n\n' + 'This is a sentence with eight words in it. '.repeat(60) + '\n\n## Beta\n\nA short closing section about beta settings that has a few words.';
  const c = T.chunkDocument({ id: 'd', title: 'Doc', text });
  assert.ok(c.length >= 4);
  c.forEach((x) => assert.ok(x.text.split(/\s+/).length <= 140 + 25, 'chunk too long'));
  assert.equal(c[0].heading, 'Alpha');
  assert.equal(c[c.length - 1].heading, 'Beta');
  assert.match(c[0].id, /^d#\d+$/);
});
test('text without punctuation is still cut into bounded chunks', () => {
  const c = T.chunkDocument({ id: 'p', title: 'PDF', text: '# PDF\n\n' + 'word '.repeat(1000) });
  assert.ok(c.length >= 6);
  c.forEach((x) => assert.ok(x.text.split(/\s+/).length <= 165));
});
test('numbered lists and tables keep their line breaks so steps stay separate', () => {
  const c = T.chunkDocument({ id: 'l', title: 'L', text: '# L\n\n## Steps\n\n1. Open settings\n2. Click billing\n3. Save\n\n| Plan | Price |\n| --- | --- |\n| Team | $8 |' });
  assert.match(c[0].text, /1\. Open settings\n2\. Click billing/);
  assert.match(c[0].text, /Plan \| Price \|\nTeam \| \$8 \|/);
  assert.doesNotMatch(c[0].text, /---/);
});
test('the sample knowledge base produces sensible chunks', () => {
  const chunks = P.buildChunks(KB);
  assert.equal(KB.length, 28);
  assert.ok(chunks.length >= 60, 'expected at least 60 chunks, got ' + chunks.length);
  const ids = new Set(chunks.map((c) => c.id)); assert.equal(ids.size, chunks.length, 'chunk ids are unique');
  KB.forEach((d) => assert.ok(chunks.some((c) => c.docId === d.id), d.id + ' has chunks'));
});
test('HTML import strips scripts and keeps headings and entities', () => {
  const r = T.htmlToText('<html><head><title>Billing FAQ</title><script>alert(1)</script><style>p{}</style></head><body><h1>Billing</h1><p>Cards &amp; invoices</p><ul><li>One</li><li>Two</li></ul></body></html>');
  assert.equal(r.title, 'Billing FAQ');
  assert.doesNotMatch(r.text, /alert|p\{\}/);
  assert.match(r.text, /# Billing/);
  assert.match(r.text, /Cards & invoices/);
  assert.match(r.text, /- One/);
});
test('stemming joins inflected forms and tokenize drops stop words', () => {
  assert.equal(T.stem('charged'), T.stem('charge'));
  assert.equal(T.stem('charges'), T.stem('charge'));
  const toks = T.tokenize('How do I reset the passwords?');
  assert.ok(toks.includes(T.stem('reset')));
  assert.ok(!toks.includes('the'));
});
