/* Boot: theme, index, share links, offline banner, service worker. */
(async function () {
  'use strict';
  const app = SD.app; const { $, toast } = SD.ui;
  const applyTheme = () => { const t = app.state.settings.theme; if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; };
  applyTheme();
  $('#theme-btn').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    app.state.settings.theme = dark ? 'light' : 'dark'; app.save(); applyTheme();
    toast((dark ? 'Light' : 'Dark') + ' theme.');
  });
  $('#about-btn').addEventListener('click', () => app.about());
  $('#mode-chip').addEventListener('click', () => app.go('#settings/model'));
  const net = () => { $('#offline-bar').hidden = navigator.onLine; };
  window.addEventListener('online', net); window.addEventListener('offline', net); net();
  // Shared config link: persona + rules only (never keys).
  const shared = SD.store.readShareHash(location.hash);
  history.replaceState(history.state, '', location.pathname + location.search + (shared || !location.hash ? '#inbox' : location.hash));
  await app.reindex();
  app.refresh();
  if (shared) {
    const ok = await app.ask({ title: 'Use shared settings?', text: ['This link carries someone\u2019s persona and escalation rules (no API keys, docs or tickets).', 'Apply them to your workspace? You can undo right after.'], ok: 'Apply' });
    if (ok) {
      const before = { s: Object.assign({}, app.state.settings), r: app.state.rules };
      Object.assign(app.state.settings, shared.settings); if (shared.rules) app.state.rules = SD.rules.normalize(shared.rules);
      app.save(); app.refresh();
      SD.ui.undoToast('Shared settings applied.', () => { app.state.settings = before.s; app.state.rules = before.r; app.save(); app.refresh(); });
    }
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
  }
})();
