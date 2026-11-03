/* AgentKit retrieval: BM25 keyword index plus optional dense embeddings, fused with
   reciprocal-rank fusion. The embedder is injected (transformers.js in the browser, a stub in tests). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./text.js'));
  else (root.AgentKit = root.AgentKit || {}).retrieval = factory(root.AgentKit.text);
})(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';
  function expand(tokens, synonyms) {
    if (!synonyms) return tokens;
    const out = tokens.slice();
    for (const t of tokens) (synonyms[t] || []).forEach((s) => T.tokenize(s).forEach((x) => out.push(x)));
    return out;
  }
  function createBM25(chunks, opts) {
    const o = Object.assign({ k1: 1.2, b: 0.75, titleBoost: 2, headingBoost: 1.5 }, opts || {});
    const docs = chunks.map((c) => {
      const tf = new Map();
      const add = (toks, w) => toks.forEach((t) => tf.set(t, (tf.get(t) || 0) + w));
      add(T.tokenize(c.text), 1);
      add(T.tokenize(c.title), o.titleBoost);
      add(T.tokenize(c.heading), o.headingBoost);
      (c.keywords || []).forEach((k) => add(T.tokenize(k), o.titleBoost));
      let len = 0; tf.forEach((v) => { len += v; });
      return { c, tf, len };
    });
    const N = docs.length || 1;
    const avg = docs.reduce((a, d) => a + d.len, 0) / N || 1;
    const df = new Map();
    docs.forEach((d) => d.tf.forEach((v, t) => df.set(t, (df.get(t) || 0) + 1)));
    const idf = (t) => { const n = df.get(t) || 0; return Math.log(1 + (N - n + 0.5) / (n + 0.5)); };
    function search(query, k, sopts) {
      const so = sopts || {};
      const qt = expand(T.tokenize(query), so.synonyms);
      const uniq = Array.from(new Set(qt));
      const scored = [];
      for (const d of docs) {
        let s = 0; const hits = [];
        for (const t of uniq) {
          const f = d.tf.get(t); if (!f) continue;
          s += idf(t) * (f * (o.k1 + 1)) / (f + o.k1 * (1 - o.b + o.b * d.len / avg));
          hits.push(t);
        }
        if (s > 0) scored.push({ chunk: d.c, score: s, hits });
      }
      scored.sort((a, b) => b.score - a.score);
      // A query-relative ceiling: the score a chunk would get if it matched every query term once.
      const maxIdf = Math.log(1 + (N + 0.5) / 0.5);
      const ceiling = uniq.reduce((a, t) => a + (df.has(t) ? idf(t) : Math.min(maxIdf, idf(t) * 0.6)), 0) || 1;
      const coverage = (h) => h.length / (uniq.length || 1);
      return scored.slice(0, k || 5).map((r) => Object.assign(r, { norm: Math.min(1, r.score / ceiling), coverage: coverage(r.hits) }));
    }
    return { search, size: docs.length, vocab: df.size, idf };
  }
  function cosine(a, b) { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na * nb) || 1); }
  /* Retriever with optional embeddings. embedder: { embed(texts[]) -> Promise<Float32Array[]> }.
     Results merge by docId (best chunk per article first) so citations point to distinct articles. */
  function createRetriever(chunks, opts) {
    const o = opts || {};
    const bm = createBM25(chunks, o.bm25);
    let vecs = null; let embedder = null;
    async function enableEmbeddings(emb, onProgress) {
      const out = [];
      const B = 16;
      for (let i = 0; i < chunks.length; i += B) {
        const part = await emb.embed(chunks.slice(i, i + B).map((c) => (c.title + '. ' + (c.heading ? c.heading + '. ' : '') + c.text).slice(0, 1200)));
        part.forEach((v) => out.push(v));
        onProgress && onProgress(Math.min(chunks.length, i + B), chunks.length);
      }
      embedder = emb; vecs = out; // switch to hybrid only once every chunk has a vector
      return vecs.length;
    }
    async function search(query, k, sopts) {
      const kk = k || 4;
      const kw = bm.search(query, 30, sopts);
      let fused = kw.map((r, i) => Object.assign({}, r, { rrf: 1 / (60 + i), dense: null }));
      if (vecs && embedder) {
        const [qv] = await embedder.embed([query]);
        const dense = chunks.map((c, i) => ({ chunk: c, sim: cosine(qv, vecs[i]) })).sort((a, b) => b.sim - a.sim).slice(0, 30);
        const byId = new Map(fused.map((r) => [r.chunk.id, r]));
        dense.forEach((d, i) => {
          const r = byId.get(d.chunk.id);
          if (r) { r.rrf += 1 / (60 + i); r.dense = d.sim; } else { const n = { chunk: d.chunk, score: 0, norm: 0, coverage: 0, hits: [], rrf: 1 / (60 + i), dense: d.sim }; fused.push(n); byId.set(d.chunk.id, n); }
        });
        fused.sort((a, b) => b.rrf - a.rrf);
      }
      const seen = new Set(); const out = [];
      for (const r of fused) {
        if (seen.has(r.chunk.docId) && !(sopts && sopts.allowSameDoc)) continue;
        seen.add(r.chunk.docId);
        // Relevance in 0..1: keyword strength, lifted by semantic similarity when we have it.
        const kwRel = Math.min(1, 0.55 * r.norm + 0.45 * r.coverage);
        r.relevance = r.dense == null ? kwRel : Math.max(kwRel, Math.min(1, (r.dense - 0.2) / 0.5));
        out.push(r);
        if (out.length >= kk) break;
      }
      return out;
    }
    return { search, bm25: bm, enableEmbeddings, get hasEmbeddings() { return !!vecs; }, chunks };
  }
  return { createBM25, createRetriever, cosine, expand };
});
