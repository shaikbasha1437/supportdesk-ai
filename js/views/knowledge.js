/* Knowledge base: import (Markdown, text, HTML, PDF, pasted text), chunks, index status, delete, re-index. */
(function () {
  'use strict';
  const app = SD.app; const { $, h, toast, undoToast, sheet, pct, ms } = SD.ui;
  const ui = { q: '', test: '' };
  let lastParam = '';
  const MAX = 15 * 1024 * 1024;
  let pdfjs = null;
  async function pdfText(file) {
    if (!pdfjs) {
      pdfjs = await import(new URL('vendor/pdfjs/pdf.min.mjs', document.baseURI).href);
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.mjs', document.baseURI).href;
    }
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const out = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i); const tc = await page.getTextContent();
      let line = ''; const lines = [];
      tc.items.forEach((it) => { line += it.str; if (it.hasEOL) { lines.push(line); line = ''; } else if (it.str && !/\s$/.test(it.str)) line += ' '; });
      if (line) lines.push(line);
      out.push(lines.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n'));
    }
    try { doc.destroy(); } catch (e) { /* ignore */ }
    return out.join('\n\n');
  }
  async function importFiles(files) {
    const list = Array.from(files || []); if (!list.length) return;
    const added = []; const skipped = [];
    const status = $('#kb-import-status'); if (status) status.textContent = 'Importing ' + list.length + ' file' + (list.length === 1 ? '' : 's') + '\u2026';
    for (const f of list) {
      try {
        if (f.size > MAX) { skipped.push(f.name + ' (over 15 MB)'); continue; }
        let d;
        if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') { const text = await pdfText(f); if (text.trim().split(/\s+/).length < 5) { skipped.push(f.name + ' (no text layer; scanned PDFs need OCR first)'); continue; } d = SD.importers.docFromText(f.name, text, 'txt'); d.type = 'pdf'; }
        else if (/\.(md|markdown|txt|text|html?|csv)$/i.test(f.name) || /^text\//.test(f.type)) d = SD.importers.docFromText(f.name, await f.text());
        else { skipped.push(f.name + ' (unsupported type)'); continue; }
        if (!d.text.replace(/^#.*$/m, '').trim()) { skipped.push(f.name + ' (empty)'); continue; }
        d.bytes = f.size; app.state.docs.push(d); added.push(d);
      } catch (e) { skipped.push(f.name + ' (' + (e.message || 'could not read') + ')'); }
    }
    if (added.length) { app.save(); await app.reindex(); }
    app.refresh();
    if (added.length) undoToast('Imported ' + added.length + ' document' + (added.length === 1 ? '' : 's') + (skipped.length ? '; skipped ' + skipped.length : '') + '. Re-run tickets to use them.', async () => { const ids = new Set(added.map((d) => d.id)); app.state.docs = app.state.docs.filter((d) => !ids.has(d.id)); app.save(); await app.reindex(); app.refresh(); });
    if (skipped.length) toast('Skipped: ' + skipped.join('; '), { ms: 9000 });
  }
  app.importFiles = importFiles;
  function pasteSheet() {
    let title, url, fmt, ta, err;
    sheet({ id: 'paste-doc', title: 'Paste text or a web page', wide: true, isDirty: () => ta && (ta.value.trim() !== '' || title.value.trim() !== ''),
      body: (b) => {
        title = h('input', { type: 'text', id: 'paste-title', placeholder: 'Optional: taken from the text if empty' });
        url = h('input', { type: 'url', id: 'paste-url', placeholder: 'https://help.example.com/article (kept as a label only)' });
        fmt = app.select([['auto', 'Detect'], ['md', 'Markdown'], ['html', 'HTML'], ['txt', 'Plain text']], 'auto', { id: 'paste-format' });
        ta = h('textarea', { id: 'paste-text', rows: 12, placeholder: 'Paste the article here' });
        err = h('div', { class: 'small', role: 'alert', style: 'color:var(--stop);min-height:1.2em' });
        b.append(h('div', { class: 'notice', style: 'margin-bottom:12px' }, 'Browsers can\u2019t read other websites directly, so SupportDesk doesn\u2019t fetch URLs. Open the page, select all, copy and paste here. Pasting the HTML source works too.'),
          h('div', { class: 'cols' }, app.field('Title', title), app.field('Format', fmt)), app.field('Source URL', url), app.field('Text', ta), err);
      },
      actions: [{ id: 'save', label: 'Add to knowledge base', cls: 'primary', fn: async (api) => {
        const raw = ta.value.trim(); if (!raw) { err.textContent = 'Paste some text first (or press Cancel).'; ta.focus(); return; }
        const type = fmt.value === 'auto' ? (/^\s*</.test(raw) && /<\/(p|div|h\d|li|body)>/i.test(raw) ? 'html' : /^#|\n#{1,3}\s/.test(raw) ? 'md' : 'txt') : fmt.value;
        const d = SD.importers.docFromText(title.value.trim() || 'Pasted text', raw, type);
        if (title.value.trim()) { d.title = title.value.trim(); d.text = d.text.replace(/^\s*#\s+.+$/m, '# ' + d.title); }
        if (url.value.trim()) d.url = url.value.trim();
        app.state.docs.push(d); app.save();
        await api.close(); await app.reindex(); app.refresh();
        undoToast('Added \u201c' + d.title + '\u201d (' + app.agent.chunks.filter((c) => c.docId === d.id).length + ' chunks).', async () => { app.state.docs = app.state.docs.filter((x) => x.id !== d.id); app.save(); await app.reindex(); app.refresh(); });
      } }], cancelLabel: 'Cancel' });
  }
  app.pasteDoc = pasteSheet;
  function docSheet(d) {
    const chunks = app.agent.chunks.filter((c) => c.docId === d.id);
    sheet({ id: 'doc', title: d.title, wide: true,
      body: (b) => b.append(h('div', { class: 'row small muted' }, app.chip(d.source === 'sample' ? 'sample' : (d.type || 'import'), d.source === 'sample' ? '' : 'brand'), d.category, '\u00b7 updated ' + d.updated, '\u00b7 ' + chunks.length + ' chunks', d.url ? h('a', { href: d.url, target: '_blank', rel: 'noopener noreferrer' }, 'source') : null),
        h('p', { class: 'small muted' }, 'Chunks are the passages the agent searches and cites. Each is about 25\u2013140 words and keeps its section heading.'),
        chunks.map((c) => h('div', { class: 'chunk', 'data-chunk': c.id }, h('div', { class: 'h' }, h('span', { class: 'mono' }, c.id), c.heading ? h('span', {}, '\u203a ' + c.heading) : null, h('span', { class: 'grow' }), h('span', {}, c.text.split(/\s+/).length + ' words')), h('p', {}, c.text)))),
      actions: [{ id: 'delete', label: 'Delete document', cls: 'danger', fn: (api) => api.close().then(() => removeDoc(d)) }] });
  }
  async function removeDoc(d) {
    const sample = d.source === 'sample';
    const idx = app.state.docs.findIndex((x) => x.id === d.id);
    if (sample) app.state.removedSample.push(d.id); else app.state.docs.splice(idx, 1);
    app.save(); await app.reindex(); app.refresh();
    undoToast('Deleted \u201c' + d.title + '\u201d.', async () => { if (sample) app.state.removedSample = app.state.removedSample.filter((x) => x !== d.id); else app.state.docs.splice(Math.max(0, idx), 0, d); app.save(); await app.reindex(); app.refresh(); });
  }
  function render(main, param) {
    const info = app.indexInfo || { docs: 0, chunks: 0, vocab: 0 };
    const docs = app.docs();
    main.append(h('div', { class: 'row', style: 'margin-bottom:12px' },
      h('div', { class: 'grow' }, h('h1', {}, 'Knowledge base'), h('div', { class: 'small muted' }, 'The help articles the agent searches and cites. Everything stays in this browser.')),
      h('button', { type: 'button', class: 'btn', id: 'paste-doc', onclick: pasteSheet }, 'Paste text / web page'),
      h('button', { type: 'button', class: 'btn', id: 'reindex', onclick: async () => { const r = await app.reindex(); app.refresh(); toast('Re-indexed ' + r.docs + ' documents into ' + r.chunks + ' chunks in ' + ms(r.ms) + '.'); } }, 'Re-index')));
    const embOn = app.state.settings.embeddings;
    main.append(h('section', { class: 'panel', id: 'index-status', style: 'margin-bottom:14px' },
      h('div', { class: 'kpis', style: 'margin-bottom:8px' }, h('div', { class: 'kpi' }, h('div', { class: 'v', 'data-kpi': 'docs' }, String(info.docs)), h('div', { class: 'k' }, 'Documents')), h('div', { class: 'kpi' }, h('div', { class: 'v', 'data-kpi': 'chunks' }, String(info.chunks)), h('div', { class: 'k' }, 'Chunks')), h('div', { class: 'kpi' }, h('div', { class: 'v' }, String(info.vocab)), h('div', { class: 'k' }, 'Indexed terms')), h('div', { class: 'kpi' }, h('div', { class: 'v' }, '\u2713'), h('div', { class: 'k' }, 'Keyword index (BM25) ready' + (info.ms != null ? ' \u00b7 ' + ms(info.ms) : '')))),
      h('label', { class: 'switch' }, h('input', { type: 'checkbox', id: 'emb-toggle', checked: embOn, onchange: async (e) => { app.state.settings.embeddings = e.target.checked; app.save(); if (e.target.checked) { await app.enableEmbeddings(); } else { app.emb = { status: 'off' }; await app.reindex(); app.refresh(); } } }), h('b', {}, 'Smart search'), h('span', { class: 'small muted' }, ' also match by meaning with all-MiniLM-L6-v2 running in your browser (about 23 MB, downloaded once from the Hugging Face CDN)')),
      h('div', { class: 'small', style: 'margin-top:4px' }, 'Status: ', h('span', { 'data-emb-status': '' }, app.embLabel()))));
    const fileIn = h('input', { type: 'file', id: 'kb-files', multiple: true, accept: '.md,.markdown,.txt,.text,.html,.htm,.pdf,text/markdown,text/plain,text/html,application/pdf', class: 'visually-hidden', onchange: (e) => { importFiles(e.target.files); e.target.value = ''; } });
    const drop = h('div', { class: 'drop', id: 'dropzone' }, h('div', { style: 'font-size:28px' }, '\ud83d\udcc4'), h('p', { style: 'margin:4px 0' }, h('b', {}, 'Drop files here'), ' or ', h('label', { for: 'kb-files', class: 'btn sm primary', style: 'display:inline-flex', tabindex: '0', onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } } }, 'Choose files')), h('div', { class: 'small' }, 'Markdown, text, HTML or PDF \u00b7 many at once \u00b7 up to 15 MB each'), h('div', { class: 'small', id: 'kb-import-status', role: 'status' }), fileIn);
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => importFiles(e.dataTransfer.files));
    main.append(drop);
    // search tester
    const out = h('div', { id: 'kb-test-out' });
    const runTest = async () => { out.textContent = ''; if (!ui.test.trim()) return; const res = await app.agent.retriever.search(ui.test, 5, { synonyms: SD.pipeline.SYN }); if (!res.length) { out.append(h('p', { class: 'small muted' }, 'No matches. This would be a knowledge gap.')); return; } res.forEach((r) => out.append(h('div', { class: 'src' }, h('div', { class: 'h' }, h('span', { class: 'grow' }, r.chunk.title + (r.chunk.heading ? ' \u203a ' + r.chunk.heading : '')), h('div', { class: 'bar', style: 'max-width:120px' }, h('i', { style: 'width:' + Math.round(r.relevance * 100) + '%' })), h('span', { class: 'small' }, pct(r.relevance))), h('div', { class: 'small muted' }, r.chunk.text.slice(0, 180) + (r.chunk.text.length > 180 ? '\u2026' : ''))))); };
    main.append(h('section', { class: 'panel', style: 'margin:14px 0' }, h('h2', {}, 'Try a search'), h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); runTest(); } }, h('input', { type: 'search', id: 'kb-test', class: 'grow', style: 'width:auto', placeholder: 'e.g. how do I change my card', value: ui.test, oninput: (e) => { ui.test = e.target.value; } }), h('button', { type: 'submit', class: 'btn' }, 'Search')), out));
    if (ui.test) runTest();
    // documents
    const q = ui.q.toLowerCase();
    const shown = docs.filter((d) => !q || (d.title + ' ' + d.category + ' ' + d.text).toLowerCase().includes(q));
    const counts = {}; app.agent.chunks.forEach((c) => { counts[c.docId] = (counts[c.docId] || 0) + 1; });
    const tbody = h('tbody', {}, shown.map((d) => h('tr', { 'data-doc': d.id }, h('td', {}, h('button', { type: 'button', class: 'btn ghost sm', style: 'padding-left:0;text-align:left', onclick: () => docSheet(d) }, d.title), h('div', { class: 'small muted' }, d.fileName || d.url || '')), h('td', {}, app.chip(d.source === 'sample' ? 'sample' : (d.type || 'import'), d.source === 'sample' ? '' : 'brand')), h('td', {}, d.category), h('td', {}, String(counts[d.id] || 0)), h('td', {}, String(d.text.split(/\s+/).length)), h('td', {}, d.updated), h('td', {}, h('button', { type: 'button', class: 'btn sm danger', 'aria-label': 'Delete ' + d.title, onclick: () => removeDoc(d) }, 'Delete')))));
    main.append(h('section', { class: 'panel' }, h('div', { class: 'row', style: 'margin-bottom:8px' }, h('h2', { class: 'grow', style: 'margin:0' }, 'Documents (' + docs.length + ')'), app.state.removedSample.length ? h('button', { type: 'button', class: 'btn sm', onclick: async () => { app.state.removedSample = []; app.save(); await app.reindex(); app.refresh(); toast('Sample articles restored.'); } }, 'Restore sample articles') : null, h('button', { type: 'button', class: 'btn sm', onclick: () => { SD.ui.download('supportdesk-kb.json', JSON.stringify({ app: 'supportdesk-ai-kb', docs: docs.map((d) => ({ id: d.id, title: d.title, category: d.category, updated: d.updated, keywords: d.keywords, text: d.text })) }, null, 1)); toast('Downloaded ' + docs.length + ' documents. Host the file and point the chat widget at it.'); } }, 'Export for widget'), h('input', { type: 'search', id: 'kb-q', style: 'width:220px', placeholder: 'Filter documents', 'aria-label': 'Filter documents', value: ui.q, oninput: (e) => { ui.q = e.target.value; app.refresh(); } })),
      h('div', { style: 'overflow:auto' }, h('table', { class: 't', id: 'doc-table' }, h('thead', {}, h('tr', {}, ['Title', 'Type', 'Category', 'Chunks', 'Words', 'Updated', ''].map((x) => h('th', {}, x)))), tbody)), shown.length ? null : h('p', { class: 'muted' }, 'No documents match.')));
    if (!param) lastParam = '';
    else if (param !== lastParam) { lastParam = param; const d = docs.find((x) => x.id === param); if (d && !SD.ui.stack.isOpen('doc')) setTimeout(() => docSheet(d), 0); }
  }
  // Dropping files anywhere on the Knowledge tab imports them.
  window.addEventListener('dragover', (e) => { if (app.route.tab === 'kb') e.preventDefault(); });
  window.addEventListener('drop', (e) => { if (app.route.tab !== 'kb') return; e.preventDefault(); if (!e.target.closest || !e.target.closest('#dropzone')) importFiles(e.dataTransfer.files); });
  app.views.kb = { render };
})();
