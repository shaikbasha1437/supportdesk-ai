/* AgentKit text utilities: tokenising, light stemming, sentence splitting, HTML/Markdown to text,
   and heading-aware chunking. Shared by every agent app in the series. UMD: works in browsers and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.AgentKit = root.AgentKit || {}).text = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const STOP = new Set(('a an and are as at be been being but by can could did do does doing for from had has have having he her here hers him his how i if in into is it its itself just me my myself no nor not of off on once only or other our ours out over own same she should so some such than that the their theirs them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves am also any all get got im ive id dont cant wont hi hello hey thanks thank please pls regards dear team support help need want would like know let us one way').split(' '));
  // Very small suffix stripper (Porter-flavoured). Good enough for BM25 on help-centre text.
  function stem(w) {
    if (w.length <= 3) return w;
    const rules = [['ational', 'ate'], ['ization', 'ize'], ['iveness', 'ive'], ['fulness', 'ful'], ['ousness', 'ous'], ['ements', 'e'], ['ement', 'e'], ['ations', 'ate'], ['ation', 'ate'], ['ities', 'ity'], ['ings', ''], ['ing', ''], ['edly', ''], ['ies', 'y'], ['ied', 'y'], ['sses', 'ss'], ['ness', ''], ['ments', ''], ['ment', ''], ['ers', 'er'], ['ed', ''], ['es', 'e'], ['s', '']];
    for (const [suf, rep] of rules) {
      if (w.endsWith(suf) && w.length - suf.length >= 3) {
        if (suf === 's' && (w.endsWith('ss') || w.endsWith('us') || w.endsWith('is'))) return w;
        let out = w.slice(0, -suf.length) + rep;
        if ((suf === 'ing' || suf === 'ed') && /([^aeiouslz])\1$/.test(out)) out = out.slice(0, -1);
        return dropE(out);
      }
    }
    return dropE(w);
  }
  function dropE(w) { return w.length > 4 && w.endsWith('e') && !w.endsWith('ee') ? w.slice(0, -1) : w; }
  function words(s) {
    return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9][a-z0-9'+#.-]*[a-z0-9]|[a-z0-9]/g) || [];
  }
  // Tokens for retrieval: lowercased, stop words removed, stemmed. Numbers kept (error codes, prices).
  function tokenize(s, opts) {
    const keepStop = opts && opts.keepStop;
    const out = [];
    for (let w of words(s)) {
      w = w.replace(/'s$/, '').replace(/'/g, '');
      if (!w || (!keepStop && STOP.has(w))) continue;
      out.push(/^\d/.test(w) ? w : stem(w));
    }
    return out;
  }
  function sentences(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\u00bf\u00a1])/).map((x) => x.trim()).filter(Boolean);
  }
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
  function decodeEntities(s) { return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] || m)); }
  // HTML to Markdown-ish text without a DOM (also used in tests). Keeps headings and list items.
  function htmlToText(html) {
    let s = String(html || '');
    const title = (s.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1];
    s = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|nav|footer|head)[\s\S]*?<\/\1>/gi, ' ');
    s = s.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (m, n, t) => '\n\n' + '#'.repeat(+n) + ' ' + t.replace(/<[^>]+>/g, '').trim() + '\n\n');
    s = s.replace(/<li[^>]*>/gi, '\n- ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|section|article|ul|ol|table|tr|blockquote|pre)>/gi, '\n\n').replace(/<\/t[dh]>/gi, ' | ');
    s = decodeEntities(s.replace(/<[^>]+>/g, ''));
    s = s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return { title: title ? decodeEntities(title.trim()) : '', text: s };
  }
  function stripMarkdown(s) {
    return String(s || '').replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*/g, '')).replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`~]{1,3}([^*_`~]+)[*_`~]{1,3}/g, '$1').replace(/^>\s?/gm, '').replace(/^\s*[-*+]\s+/gm, '- ').replace(/^\s*\|/gm, '').trim();
  }
  // Split into sections by Markdown headings. Returns [{heading, text}]
  function sections(md) {
    const out = [];
    let cur = { heading: '', text: [] };
    for (const line of String(md || '').split(/\r?\n/)) {
      const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) { if (cur.text.join('').trim() || cur.heading) out.push(cur); cur = { heading: m[2].trim(), level: m[1].length, text: [] }; } else cur.text.push(line);
    }
    out.push(cur);
    return out.map((x) => ({ heading: x.heading, level: x.level || 0, text: stripMarkdown(x.text.join('\n')).trim() })).filter((x) => x.text || x.heading);
  }
  /* Chunk a document: heading-aware, paragraphs packed up to maxWords, with a small sentence overlap
     between consecutive chunks of the same section. Each chunk keeps its heading path for context. */
  function chunkDocument(doc, opts) {
    const o = Object.assign({ maxWords: 140, minWords: 25, overlap: 1 }, opts || {});
    const secs = sections(doc.text);
    const chunks = [];
    let h1 = doc.title || '';
    secs.forEach((sec) => {
      if (sec.level === 1 && !doc.title) h1 = sec.heading;
      const heading = sec.level === 1 ? '' : sec.heading;
      const paras = sec.text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      let buf = [];
      let count = 0;
      const flush = (carry) => {
        if (!buf.length) return;
        const text = buf.join('\n\n');
        chunks.push({ heading, text });
        buf = carry ? [carry] : [];
        count = carry ? carry.split(/\s+/).length : 0;
      };
      for (const p of paras) {
        const pw = p.split(/\s+/).length;
        if (pw > o.maxWords) { // long paragraph: split on sentences
          for (const s of sentences(p)) {
            const sw = s.split(/\s+/).length;
            if (count + sw > o.maxWords && count >= o.minWords) { const last = o.overlap ? sentences(buf[buf.length - 1]).slice(-o.overlap).join(' ') : ''; flush(last); }
            if (buf.length && count < o.maxWords && !/\n$/.test(buf[buf.length - 1])) buf[buf.length - 1] += ' ' + s; else buf.push(s);
            count += sw;
          }
          continue;
        }
        if (count + pw > o.maxWords && count >= o.minWords) flush('');
        buf.push(p); count += pw;
      }
      flush('');
    });
    // Merge tiny trailing chunks into their neighbour from the same heading.
    const merged = [];
    for (const c of chunks) {
      const prev = merged[merged.length - 1];
      if (prev && prev.heading === c.heading && (c.text.split(/\s+/).length < o.minWords) && (prev.text.split(/\s+/).length + c.text.split(/\s+/).length) <= o.maxWords * 1.4) prev.text += '\n\n' + c.text;
      else merged.push(Object.assign({}, c));
    }
    return merged.map((c, i) => ({ id: doc.id + '#' + (i + 1), docId: doc.id, title: doc.title || h1 || 'Untitled', heading: c.heading, text: c.text, n: i + 1, words: c.text.split(/\s+/).length }));
  }
  function approxTokens(s) { return Math.max(1, Math.ceil(String(s || '').length / 4)); }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'doc'; }
  return { STOP, stem, words, tokenize, sentences, htmlToText, stripMarkdown, sections, chunkDocument, approxTokens, slug, decodeEntities };
});
