/* AgentKit in-browser embeddings: lazy-loads transformers.js and all-MiniLM-L6-v2 from a CDN
   on first use. Falls back cleanly (BM25 only) when offline or blocked. Browser only. */
(function (root) {
  'use strict';
  const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
  const MODEL = 'Xenova/all-MiniLM-L6-v2';
  let loading = null;
  function load(onProgress) {
    if (loading) return loading;
    loading = (async () => {
      const tf = await import(CDN);
      tf.env.allowLocalModels = false;
      const extractor = await tf.pipeline('feature-extraction', MODEL, { dtype: 'q8', progress_callback: (p) => { if (onProgress && p && p.status === 'progress') onProgress(p); } });
      return {
        model: MODEL,
        async embed(texts) { const out = await extractor(texts, { pooling: 'mean', normalize: true }); const dim = out.dims[out.dims.length - 1]; const data = out.data; return texts.map((_, i) => data.slice(i * dim, (i + 1) * dim)); }
      };
    })();
    loading.catch(() => { loading = null; });
    return loading;
  }
  (root.AgentKit = root.AgentKit || {}).embed = { load, CDN, MODEL };
})(typeof self !== 'undefined' ? self : this);
