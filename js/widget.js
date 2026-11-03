/* SupportDesk chat widget (runs inside widget.html). Always demo mode: no API keys on public pages. */
(async function () {
  'use strict';
  const q = new URLSearchParams(location.search);
  const embedded = q.get('embed') === '1' && window.parent !== window;
  const $ = (s) => document.querySelector(s);
  const color = /^#[0-9a-f]{3,8}$/i.test(q.get('color') || '') ? q.get('color') : '#4f46e5';
  document.documentElement.style.setProperty('--c', color);
  const title = (q.get('title') || 'Help').slice(0, 60);
  $('#w-title').textContent = title; document.title = title;
  if (embedded) $('#w-close').hidden = false;
  const close = () => { if (embedded) window.parent.postMessage({ type: 'supportdesk:close' }, '*'); };
  $('#w-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  // Knowledge base: ?kb=URL (JSON from "Export for widget"), else this browser's SupportDesk workspace, else the sample.
  let docs = SD.sampleKB; let settings = { product: 'Orbitask', greeting: 'Hi', signature: '' }; let rules = null;
  try {
    const raw = localStorage.getItem('supportdesk.state.v1');
    if (raw) { const st = JSON.parse(raw); docs = SD.sampleKB.filter((d) => !(st.removedSample || []).includes(d.id)).concat(st.docs || []); settings = Object.assign(settings, st.settings || {}); rules = st.rules || null; }
  } catch (e) { /* storage blocked in third-party frames: use the sample */ }
  const kbUrl = q.get('kb');
  const log = $('#log');
  const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
  const say = (who, text) => { const m = el('div', 'm ' + who); if (text != null) m.textContent = text; log.append(m); log.scrollTop = log.scrollHeight; return m; };
  if (kbUrl) {
    try { const r = await fetch(kbUrl); const j = await r.json(); const list = Array.isArray(j) ? j : j.docs; if (Array.isArray(list) && list.length) docs = list.filter((d) => d && d.title && d.text).map((d, i) => ({ id: String(d.id || 'doc-' + i), title: String(d.title), category: d.category || '', keywords: d.keywords || [], text: String(d.text) })); }
    catch (e) { say('bot', 'Could not load the help center from ' + kbUrl + ', so I\u2019m using the sample one.'); }
  }
  const agent = SD.pipeline.createAgent({ docs });
  const product = settings.product || 'Orbitask';
  say('bot', 'Hi! I\u2019m the ' + product + ' help assistant. Ask me anything about ' + product + '; I answer from the help center and link the articles.');
  const chips = $('#chips');
  ['How do I reset my password?', 'Change my credit card', 'Slack integration not posting'].forEach((t) => { const b = el('button', '', t); b.type = 'button'; b.addEventListener('click', () => ask(t)); chips.append(b); });
  let n = 0; let lastUser = '';
  function clean(text) {
    return String(text).split('\n').filter((l, i, a) => !(i === 0 && /^\S+\s.*,\s*$/.test(l)) && !(settings.signature && l.trim() === settings.signature.trim()) && !/^\u2014 /.test(l.trim()) && !/reply to this message/i.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function human(m, team) {
    const b = el('button', 'human', 'Talk to a human'); b.type = 'button';
    b.addEventListener('click', () => { b.disabled = true; say('bot', 'In a real deployment this would hand the chat to ' + (team ? 'the ' + team + ' team' : 'a teammate') + ' with a summary. This preview doesn\u2019t send anything.'); });
    m.append(el('div', 'note')); m.lastChild.append(b);
  }
  async function ask(text) {
    const t = String(text || '').trim(); if (!t) return;
    chips.hidden = true;
    say('me', t);
    const typing = say('bot', 'Looking that up\u2026'); typing.classList.add('typing');
    const ticket = { id: 'chat-' + (++n), subject: t.slice(0, 80), body: t, channel: 'chat', priority: 'normal', created: new Date().toISOString(), customer: { name: 'there', email: '', tier: 'team' } };
    let r = await agent.run(ticket, { settings: Object.assign({}, settings, { greeting: '', signature: '' }), rules, history: [] });
    if (r.kind === 'vague' && lastUser) { ticket.body = lastUser + '\n' + t; ticket.subject = lastUser.slice(0, 80); r = await agent.run(ticket, { settings: Object.assign({}, settings, { greeting: '', signature: '' }), rules, history: [] }); }
    lastUser = t;
    typing.remove();
    const m = say('bot');
    const a = r.decision.action;
    if (a === 'escalate' && r.kind !== 'answer') {
      m.textContent = 'That one needs a person. I\u2019ve written up a handoff for ' + (r.decision.team ? 'the ' + r.decision.team + ' team' : 'a teammate') + ' (preview: nothing is actually sent).';
    } else if (r.kind === 'vague') {
      m.textContent = 'Could you tell me a bit more? For example what you were trying to do, what happened, and any error message.';
    } else {
      clean(r.draft).split(/(\[\d+\])/).forEach((p) => { if (/^\[\d+\]$/.test(p)) m.append(el('span', 'cite', p)); else m.append(document.createTextNode(p)); });
      if (r.sources.length) {
        const s = el('div', 'src', 'Sources: ');
        r.sources.forEach((src, i) => { const b = el('button', '', '[' + (i + 1) + '] ' + src.title); b.type = 'button'; b.addEventListener('click', () => say('bot', src.title + (src.heading ? ' \u203a ' + src.heading : '') + '\n\n' + src.text)); s.append(i ? ' \u00b7 ' : '', b); });
        m.append(s);
      }
      if (a !== 'auto') m.append(el('div', 'note', a === 'escalate' ? 'This also needs a teammate (' + r.decision.reasons.filter((x) => x.action === 'escalate').map((x) => x.label.toLowerCase()).join(', ') + ').' : 'A teammate would normally double-check this answer.'));
    }
    human(m, r.decision.team);
    log.scrollTop = log.scrollHeight;
  }
  $('#w-form').addEventListener('submit', (e) => { e.preventDefault(); const i = $('#w-in'); const v = i.value; i.value = ''; ask(v); });
  if (!embedded && q.get('preview') !== '1') $('#w-in').focus({ preventScroll: true });
  window.addEventListener('message', (e) => { if (e.data && e.data.type === 'supportdesk:focus') $('#w-in').focus(); });
})();
