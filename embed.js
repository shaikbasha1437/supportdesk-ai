/* SupportDesk AI chat widget loader. Paste on any page:
   <script src="https://shaikbasha1437.github.io/supportdesk-ai/embed.js" data-title="Help" data-color="#4f46e5" defer></script>
   Optional: data-kb="https://your-site/kb.json" (from "Export for widget"), data-position="left". */
(function () {
  'use strict';
  var s = document.currentScript || document.querySelector('script[src*="embed.js"]');
  if (!s || window.__supportdeskWidget) return;
  window.__supportdeskWidget = true;
  var base = new URL('.', s.src).href; var origin = new URL(base).origin;
  var d = s.dataset; var color = /^#[0-9a-f]{3,8}$/i.test(d.color || '') ? d.color : '#4f46e5';
  var side = d.position === 'left' ? 'left' : 'right';
  var title = d.title || 'Help';
  var btn = document.createElement('button');
  btn.type = 'button'; btn.setAttribute('aria-label', 'Open ' + title + ' chat'); btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';
  btn.style.cssText = 'position:fixed;bottom:20px;' + side + ':20px;z-index:2147483000;width:58px;height:58px;border-radius:50%;border:0;background:' + color + ';color:#fff;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer;display:grid;place-items:center';
  var frame = null; var open = false;
  function size() {
    if (!frame) return;
    var small = window.innerWidth < 520;
    frame.style.cssText = 'position:fixed;z-index:2147483001;border:0;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.3);' + (small ? 'inset:0;width:100%;height:100%;border-radius:0' : 'bottom:90px;' + side + ':20px;width:380px;height:min(600px,calc(100vh - 110px));border-radius:16px') + (open ? '' : ';display:none');
  }
  function show(v) {
    open = v;
    if (v && !frame) {
      frame = document.createElement('iframe');
      frame.title = title + ' chat';
      frame.src = base + 'widget.html?embed=1&title=' + encodeURIComponent(title) + '&color=' + encodeURIComponent(color) + (d.kb ? '&kb=' + encodeURIComponent(d.kb) : '');
      document.body.appendChild(frame);
      frame.addEventListener('load', function () { if (open) { frame.focus(); frame.contentWindow.postMessage({ type: 'supportdesk:focus' }, origin); } });
    }
    size();
    btn.setAttribute('aria-expanded', String(v)); btn.setAttribute('aria-label', (v ? 'Close ' : 'Open ') + title + ' chat');
    if (v && frame.contentWindow) { frame.focus(); try { frame.contentWindow.postMessage({ type: 'supportdesk:focus' }, origin); } catch (e) { /* not loaded yet */ } }
    if (!v) btn.focus();
  }
  btn.addEventListener('click', function () { show(!open); });
  window.addEventListener('message', function (e) { if (e.origin === origin && e.data && e.data.type === 'supportdesk:close') show(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) show(false); });
  window.addEventListener('resize', size);
  function mount() { document.body.appendChild(btn); }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
