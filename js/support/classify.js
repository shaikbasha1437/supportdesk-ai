/* SupportDesk classifier: deterministic, local and fast. Language, intent/category, sentiment,
   urgency, money amounts. Runs before (and independently of) any model, so ticket text can't
   steer the rules that use it. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../agentkit/text.js'));
  else (root.SD = root.SD || {}).classify = factory(root.AgentKit.text);
})(typeof self !== 'undefined' ? self : this, function (T) {
  'use strict';
  const LANGS = {
    en: { name: 'English', words: 'the and is to my i you it for not with how can what this have our we do' },
    es: { name: 'Spanish', words: 'el la los las de que y en un una por para con mi mis no es como puedo tambi\u00e9n necesito hola gracias nuestro' },
    fr: { name: 'French', words: 'le la les de des et en un une pour avec mon mes ne pas est je vous plus depuis bonjour merci pouvez nous' },
    de: { name: 'German', words: 'der die das und ist ich nicht mit ein eine mich kann zu den von was soll immer beim kommt bitte danke wir' },
    pt: { name: 'Portuguese', words: 'o a os as de que e em um uma para com meu minha n\u00e3o \u00e9 como posso tamb\u00e9m preciso ol\u00e1 obrigado n\u00f3s' },
    it: { name: 'Italian', words: 'il lo la gli le di che e in un una per con mio mia non \u00e8 come posso anche ho ciao grazie noi' }
  };
  const SETS = {}; Object.keys(LANGS).forEach((k) => { SETS[k] = new Set(LANGS[k].words.split(' ')); });
  function detectLanguage(text) {
    const s = String(text || '');
    if (/[\u3040-\u30ff]/.test(s)) return { code: 'ja', name: 'Japanese', confidence: 0.9 };
    if (/[\u4e00-\u9fff]/.test(s)) return { code: 'zh', name: 'Chinese', confidence: 0.9 };
    if (/[\u0400-\u04ff]/.test(s)) return { code: 'ru', name: 'Russian', confidence: 0.85 };
    if (/[\u0600-\u06ff]/.test(s)) return { code: 'ar', name: 'Arabic', confidence: 0.85 };
    if (/[\u0900-\u097f]/.test(s)) return { code: 'hi', name: 'Hindi', confidence: 0.85 };
    const w = s.toLowerCase().match(/[a-z\u00e0-\u00ff]+/g) || [];
    const counts = {};
    Object.keys(SETS).forEach((k) => { counts[k] = w.filter((x) => SETS[k].has(x)).length; });
    const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const top = best[0]; const total = w.length || 1;
    if (!counts[top] || (top !== 'en' && counts[top] <= counts.en)) return { code: 'en', name: 'English', confidence: 0.6 };
    return { code: top, name: LANGS[top].name, confidence: Math.min(0.99, 0.5 + (counts[top] - (counts[best[1]] || 0)) / total) };
  }
  // Small cross-lingual glossary so demo-mode retrieval works on non-English tickets.
  const GLOSSARY = {
    es: { factura: 'invoice', facturas: 'invoices', descargar: 'download', reembolso: 'refund', contrase\u00f1a: 'password', cuenta: 'account', cancelar: 'cancel', suscripci\u00f3n: 'subscription', pago: 'payment', tarjeta: 'card', iva: 'vat tax id', contabilidad: 'accounting invoices', error: 'error', iniciar: 'sign in', sesi\u00f3n: 'session', notificaciones: 'notifications', correo: 'email', archivo: 'file', subir: 'upload', cobro: 'charge', doble: 'twice' },
    fr: { facture: 'invoice', factures: 'invoices', t\u00e9l\u00e9charger: 'download', remboursement: 'refund', 'mot de passe': 'password', compte: 'account', annuler: 'cancel', abonnement: 'subscription', paiement: 'payment', carte: 'card', notifications: 'notifications', 'e-mail': 'email', courriel: 'email', re\u00e7ois: 'not getting arriving', connexion: 'sign in login', fichier: 'file', erreur: 'error', tva: 'vat' },
    de: { rechnung: 'invoice', rechnungen: 'invoices', herunterladen: 'download', erstattung: 'refund', r\u00fcckerstattung: 'refund', passwort: 'password', konto: 'account', k\u00fcndigen: 'cancel', abonnement: 'subscription', zahlung: 'payment', karte: 'card', anmelden: 'sign in login', anmeldung: 'sign in login', login: 'login', fehler: 'error', benachrichtigungen: 'notifications', datei: 'file', hochladen: 'upload', 'zwei-faktor': '2fa', mwst: 'vat' },
    pt: { fatura: 'invoice', faturas: 'invoices', baixar: 'download', reembolso: 'refund', senha: 'password', conta: 'account', cancelar: 'cancel', assinatura: 'subscription', pagamento: 'payment', cart\u00e3o: 'card', erro: 'error', entrar: 'sign in', notifica\u00e7\u00f5es: 'notifications', arquivo: 'file' },
    it: { fattura: 'invoice', fatture: 'invoices', scaricare: 'download', rimborso: 'refund', password: 'password', account: 'account', annullare: 'cancel', abbonamento: 'subscription', pagamento: 'payment', carta: 'card', errore: 'error', accedere: 'sign in', notifiche: 'notifications', file: 'file' }
  };
  function glossaryQuery(text, code) {
    const g = GLOSSARY[code]; if (!g) return '';
    const low = String(text || '').toLowerCase();
    const out = [];
    Object.keys(g).forEach((k) => { if (new RegExp('(^|[^a-z\u00e0-\u00ff])' + k.replace(/[-]/g, '\\-') + '($|[^a-z\u00e0-\u00ff])').test(low)) out.push(g[k]); });
    // keep error codes and product words as-is
    (low.match(/\b[a-z]{2,6}-?\d{2,4}\b/g) || []).forEach((c) => out.push(c));
    return out.join(' ');
  }
  const CATS = [
    { id: 'security', label: 'Security', intent: 'Security report', words: ['hacked', 'breach', 'unauthorized', 'unauthorised', 'compromised', 'suspicious', 'phishing', 'vulnerability', 'leaked', 'data leak', 'never been to', 'someone accessed', 'stolen', 'malware'] },
    { id: 'legal', label: 'Legal', intent: 'Legal request', words: ['lawyer', 'attorney', 'lawsuit', 'sue', 'legal action', 'court', 'subpoena', 'gdpr request', 'cease and desist', 'litigation', 'regulator', 'complaint with'] },
    { id: 'refunds', label: 'Refunds', intent: 'Refund request', words: ['refund', 'money back', 'reimburse', 'chargeback', 'charged twice', 'double charge', 'duplicate charge', 'reembolso', 'remboursement', 'erstattung'] },
    { id: 'billing', label: 'Billing', intent: 'Billing question', words: ['invoice', 'billing', 'charge', 'card', 'payment', 'vat', 'tax', 'pricing', 'price', 'plan', 'discount', 'seat', 'subscription', 'upgrade', 'downgrade', 'cancel', 'factura', 'facture', 'rechnung'] },
    { id: 'account', label: 'Account', intent: 'Account access', words: ['password', 'login', 'log in', 'sign in', 'locked', '2fa', 'two-factor', 'recovery code', 'sso', 'saml', 'okta', 'owner', 'email change', 'delete account', 'anmelden', 'contrase\u00f1a'] },
    { id: 'integrations', label: 'Integrations', intent: 'How-to', words: ['slack', 'github', 'google drive', 'zapier', 'webhook', 'api', 'jira', 'trello', 'asana', 'import', 'integration', 'scim', 'rate limit', '429', 'endpoint', 'pull request', 'pull requests'] },
    { id: 'privacy', label: 'Privacy & data', intent: 'Compliance question', words: ['privacy', 'compliance', 'data stored', 'where is data', 'in the eu', 'data residency', 'audit log', 'retention', 'retained', 'dpa', 'subprocessor'] },
    { id: 'troubleshooting', label: 'Troubleshooting', intent: 'Bug report', words: ['error', 'not working', 'broken', 'sync', 'not syncing', 'crash', 'upload', 'failed', 'not arriving', 'notifications', 'bug', 'e413', 'e415', 'doesnt work', "doesn't work", 'fehler', 'erreur'] },
    { id: 'feature', label: 'Feature request', intent: 'Feature request', words: ['feature request', 'please add', 'would be great if', 'do you have a', 'is there a', 'roadmap', 'gantt', 'wishlist'] },
    { id: 'out-of-scope', label: 'Out of scope', intent: 'Out of scope', words: ['write me', 'python script', 'scrape', 'homework', 'essay', 'laptop', 'weather', 'recipe', 'stock tips', 'crypto', 'dating'] }
  ];
  function has(low, w) { return w.includes(' ') || w.includes('-') || w.includes("'") ? low.includes(w) : new RegExp('\\b' + w + '\\b').test(low); }
  function categorize(text) {
    const low = String(text || '').toLowerCase();
    const scores = CATS.map((c) => ({ c, s: c.words.filter((w) => has(low, w)).length }));
    scores.sort((a, b) => b.s - a.s);
    if (!scores[0].s) return { id: 'general', label: 'General', intent: 'Question', certainty: 0.3, matched: [] };
    // Priority categories win on any hit.
    for (const id of ['security', 'legal', 'refunds']) { const x = scores.find((y) => y.c.id === id); if (x.s) return { id, label: x.c.label, intent: x.c.intent, certainty: Math.min(1, 0.6 + 0.15 * x.s), matched: x.c.words.filter((w) => has(low, w)) }; }
    const top = scores[0]; const second = scores[1].s;
    return { id: top.c.id, label: top.c.label, intent: top.c.intent, certainty: Math.min(1, 0.45 + 0.15 * (top.s - second) + 0.1 * top.s), matched: top.c.words.filter((w) => has(low, w)) };
  }
  const NEG = { useless: 3, unacceptable: 3, terrible: 3, awful: 3, worst: 3, ridiculous: 2.5, angry: 2.5, furious: 3, disgusting: 3, scam: 3, suck: 3, sucks: 3, hate: 2.5, horrible: 3, annoying: 1.5, frustrating: 1.5, frustrated: 1.5, disappointed: 1.5, broken: 1, again: 0.5, still: 0.5, unhappy: 1.5, fed: 1, waste: 2, pathetic: 3, incompetent: 3, never: 0.5, lawsuit: 1.5, 'fix it': 1.5 };
  const POS = { thanks: 1, thank: 1, great: 1.5, love: 2, awesome: 2, appreciate: 1.5, gracias: 1, merci: 1, danke: 1, happy: 1.5, excellent: 2, helpful: 1.5 };
  function sentiment(text) {
    const s = String(text || ''); const low = s.toLowerCase();
    let neg = 0; let pos = 0; const cues = [];
    Object.keys(NEG).forEach((w) => { if (has(low, w)) { neg += NEG[w]; if (NEG[w] >= 1) cues.push(w); } });
    Object.keys(POS).forEach((w) => { if (has(low, w)) pos += POS[w]; });
    const caps = (s.match(/\b[A-Z]{4,}\b/g) || []).filter((w) => !/^(HTTP|AUTH|SAML|SCIM|INV|VAT|GDPR|CCPA|IMPORTANT|SYSTEM|NOTE|API|PDF|CSV|JSON|SOC|ISO)/.test(w));
    if (caps.length) { neg += Math.min(3, caps.length); cues.push('ALL CAPS'); }
    const bangs = (s.match(/!{2,}/g) || []).length; if (bangs) { neg += 1.5 * bangs; cues.push('!!!'); }
    const score = Math.max(-1, Math.min(1, (pos - neg) / 6));
    const label = score <= -0.6 ? 'angry' : score <= -0.2 ? 'negative' : score >= 0.25 ? 'positive' : 'neutral';
    return { score: Math.round(score * 100) / 100, label, cues };
  }
  const URG = ['urgent', 'asap', 'immediately', 'right now', 'production', 'down', 'outage', 'whole team', 'blocked', 'deadline', 'by friday', 'cannot work', "can't work", 'emergency', 'hacked'];
  function urgency(text, priority) {
    const low = String(text || '').toLowerCase();
    const hits = URG.filter((w) => has(low, w));
    const base = { low: 0, normal: 1, high: 2, urgent: 3 }[priority] || 1;
    const lvl = Math.min(3, base + (hits.length >= 2 ? 1 : 0));
    return { level: ['low', 'normal', 'high', 'urgent'][lvl], cues: hits };
  }
  function amounts(text) {
    const out = [];
    const re = /(?:\$|usd\s?|us\$)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?|(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2}))?\s?(?:usd|dollars|\u20ac|eur|euros)\b/gi;
    let m; while ((m = re.exec(String(text || '')))) { const n = parseFloat(((m[1] || m[3]) || '0').replace(/,/g, '') + '.' + ((m[2] || m[4]) || '0')); if (n) out.push(n); }
    return out;
  }
  // Intent-aware query expansion: helps find the policy page for requests the docs can't name.
  const QX = { 'out-of-scope': 'what support can help with custom software development third-party products', security: 'security suspicious activity unauthorised access', legal: 'legal questions contracts' };
  function isVague(text) { return T.tokenize(text).length < 3; }
  function classify(ticket) {
    const text = (ticket.subject || '') + '\n' + (ticket.body || '');
    const lang = detectLanguage(ticket.body || text);
    const english = lang.code === 'en' ? text : text + ' ' + glossaryQuery(text, lang.code);
    const cat = categorize(english);
    const amt = amounts(text);
    return { language: lang, category: cat, sentiment: sentiment(text), urgency: urgency(text, ticket.priority), amounts: amt, maxAmount: amt.length ? Math.max.apply(null, amt) : 0, vague: isVague(text), query: lang.code === 'en' ? text + (QX[cat.id] ? ' ' + QX[cat.id] : '') : (glossaryQuery(text, lang.code) || text) };
  }
  return { classify, detectLanguage, categorize, sentiment, urgency, amounts, glossaryQuery, LANGS, CATS };
});
