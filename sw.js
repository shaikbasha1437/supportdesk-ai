/* SupportDesk AI service worker: network-first for app files, per-file cache, versioned, offline fallback.
   Bump CACHE on each release; old caches are removed on activate. Demo mode works fully offline. */
const CACHE = 'supportdesk-ai-v2';
const ASSETS = [
  './', './index.html', './widget.html', './demo.html', './embed.js', './styles.css', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './vendor/pdfjs/pdf.min.mjs', './vendor/pdfjs/pdf.worker.min.mjs',
  './js/agentkit/embed.js','./js/agentkit/guard.js','./js/agentkit/keystore.js','./js/agentkit/llm.js','./js/agentkit/modal.js','./js/agentkit/retrieval.js','./js/agentkit/text.js','./js/agentkit/webllm.js','./js/app.js','./js/data/kb.js','./js/data/kb1.js','./js/data/kb2.js','./js/data/tickets.js','./js/main.js','./js/support/analytics.js','./js/support/classify.js','./js/support/compose.js','./js/support/importers.js','./js/support/pipeline.js','./js/support/rules.js','./js/support/store.js','./js/ui.js','./js/views/inbox.js','./js/views/insights.js','./js/views/knowledge.js','./js/views/settings.js','./js/views/widgettab.js','./js/widget.js'
];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  // Cache each file on its own so one failed request can't break install.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((a) => c.add(new Request(a, { cache: 'reload' })).catch(() => {})))));
});
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('supportdesk-ai-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Only our own files. Model APIs, CDNs and local LLM servers are never cached or touched.
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res && res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })
    .then((r) => r || (req.mode === 'navigate' ? caches.match(/widget\.html/.test(req.url) ? './widget.html' : './index.html').then((i) => i || caches.match('./')) : undefined))
    .then((r) => r || Response.error())));
});
