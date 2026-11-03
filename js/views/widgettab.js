/* Chat widget tab: live preview plus a copy-paste embed snippet served from this site. */
(function () {
  'use strict';
  const app = SD.app; const { h, toast } = SD.ui;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  function render(main) {
    const s = app.state.settings;
    const base = new URL('.', location.href).href;
    const snippet = () => '<script src="' + base + 'embed.js"\n  data-title="' + esc(s.widgetTitle || 'Help') + '"\n  data-color="' + esc(s.widgetColor || '#4f46e5') + '"' + (s.widgetKb ? '\n  data-kb="' + esc(s.widgetKb) + '"' : '') + '\n  defer></script>';
    const src = () => 'widget.html?preview=1&title=' + encodeURIComponent(s.widgetTitle || 'Help') + '&color=' + encodeURIComponent(s.widgetColor || '#4f46e5') + (s.widgetKb ? '&kb=' + encodeURIComponent(s.widgetKb) : '');
    const frame = h('iframe', { class: 'widget-frame', id: 'widget-preview', title: 'Chat widget preview', src: src() });
    const pre = h('pre', { class: 'box', id: 'snippet', style: 'max-height:none' }, snippet());
    const upd = () => { pre.textContent = snippet(); app.save(); };
    let reloadT = null; const reload = () => { clearTimeout(reloadT); reloadT = setTimeout(() => { frame.src = src(); }, 400); };
    main.append(h('div', { style: 'margin-bottom:12px' }, h('h1', {}, 'Chat widget'), h('div', { class: 'small muted' }, 'A help chat for your own site. It answers from the knowledge base with citations and hands off to a human when the rules say so.')),
      h('div', { class: 'widget-wrap' },
        h('div', {},
          h('section', { class: 'panel', style: 'margin-bottom:14px' }, h('h2', {}, 'Look'),
            h('div', { class: 'cols' }, app.field('Title', h('input', { type: 'text', id: 'w-title', value: s.widgetTitle || '', oninput: (e) => { s.widgetTitle = e.target.value; upd(); reload(); } })), app.field('Accent colour', h('input', { type: 'color', id: 'w-color', value: s.widgetColor || '#4f46e5', style: 'height:38px;width:100%', oninput: (e) => { s.widgetColor = e.target.value; upd(); reload(); } }))),
            app.field('Knowledge base URL (optional)', h('input', { type: 'url', id: 'w-kb', placeholder: 'https://your-site.example/supportdesk-kb.json', value: s.widgetKb || '', onchange: (e) => { s.widgetKb = e.target.value.trim(); upd(); reload(); } }), 'Use \u201cExport for widget\u201d on the Knowledge tab, host the file with CORS allowed (GitHub Pages does), and paste its URL. Without it the widget uses the sample help center.')),
          h('section', { class: 'panel', style: 'margin-bottom:14px' }, h('div', { class: 'row', style: 'margin-bottom:6px' }, h('h2', { class: 'grow', style: 'margin:0' }, 'Embed snippet'), h('button', { type: 'button', class: 'btn sm primary', id: 'copy-snippet', onclick: async () => toast((await SD.ui.copy(pre.textContent)) ? 'Snippet copied. Paste it before </body> on your site.' : 'Copy failed. Select the text instead.') }, 'Copy')), pre,
            h('p', { class: 'small muted' }, 'Paste before </body>. It adds a chat button in the corner that opens the widget in a frame. Esc, the \u00d7 button or the chat button close it. ', h('a', { href: 'demo.html', target: '_blank', rel: 'noopener' }, 'See it on a demo page \u2197'))),
          h('div', { class: 'notice warn small' }, h('b', {}, 'Demo mode only. '), 'The embedded widget never uses an API key: putting a key in a public page would expose it to every visitor. For AI-written answers on a real site, put the model call behind your own server. \u201cTalk to a human\u201d in this preview does not send anything.')),
        h('div', {}, frame)));
  }
  app.views.widget = { render };
})();
