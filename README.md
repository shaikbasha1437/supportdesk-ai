# SupportDesk AI

A customer support agent that reads your help docs, drafts cited answers to tickets, checks its own work and hands anything risky to a human, with the reason and a hand-off note.

**Live app:** https://shaikbasha1437.github.io/supportdesk-ai/ · **Widget demo:** https://shaikbasha1437.github.io/supportdesk-ai/demo.html

It runs entirely in your browser. There is no server: your documents, tickets and settings stay in this browser's storage. It opens in **demo mode**, which needs no API key and works offline.

## What it does

| Area | What you get |
| --- | --- |
| **Inbox** | 27 sample tickets (billing, login, bugs, refunds, legal, security, VIP, angry, vague, Spanish, prompt-injection). Create tickets, import CSV/JSON, run one or all, export conversations (JSON/CSV). |
| **Agent trace** | Each run shows every step: sanitize & guard → classify → retrieve (scores, sources) → draft with inline `[n]` citations → self-check (claims supported, policy, citations) → decide. |
| **Decision** | *Auto-resolve*, *Needs review* or *Escalate*, with the rules that fired, the team, and a hand-off note (summary, what was tried, suggested next step). |
| **Review queue** | Edit, approve, reject (reason + note), reassign to a team, mark knowledge gaps. Approving marks the ticket resolved. **Nothing is emailed**; the app says so. |
| **Knowledge base** | 28 sample articles. Import Markdown, TXT, HTML or PDF (drag and drop many files at once), or paste text from a URL. See every chunk, index status, delete and re-index, try searches. |
| **Rules** | Confidence thresholds plus rules for refunds over a limit, legal, security, VIP, angry customers, repeat contacts, unsupported languages, no docs, and injection. Each can be switched off or changed. |
| **Analytics** | Deflection, review and escalation rates, top escalation reasons, confidence, results by category, knowledge gaps, cost and latency. |
| **Settings** | Model and key, persona (name, tone, greeting, signature, policies), languages, rules, prices, data (export/import workspace, share settings link, reset). |
| **Chat widget** | A live preview and a copy-paste `<script>` snippet for your own site. |

Usability: every dialog closes with ×, Cancel, Esc, a click outside, or the browser Back button. Unsaved edits ask before they are thrown away; required fields never block cancelling. Deletes, resets and other destructive actions show an Undo toast. Light and dark themes; works on phones; keyboard shortcuts in the inbox (`j`/`k` to move, `r` to run).

## Demo mode vs live mode

| | Demo mode (default) | Live mode (your key) | In-browser model (WebLLM) |
| --- | --- | --- | --- |
| Key needed | No | Yes (except local servers) | No |
| Drafting | Extractive: picks the best sentences and steps from the retrieved articles and cites them | Your model writes the reply from the same sources, with citations | A small model downloaded into the browser (WebGPU) |
| Classification, guard, rules, self-check | Local | **Still local**: the model only writes the draft | Local |
| Works offline | Yes | No | After download |
| Cost | Free | Shown per reply (tokens × your price table) | Free |

Every reply in demo mode is labelled **demo mode**. Live providers:

- **OpenAI** (Chat Completions, Bearer key)
- **Anthropic** (Messages API with the `anthropic-dangerous-direct-browser-access: true` header, which Anthropic requires for calls from a browser)
- **Google Gemini** (`generateContent`, key in the `x-goog-api-key` header, never in the URL)
- **Any OpenAI-compatible endpoint**: Ollama, LM Studio, OpenRouter, vLLM and others. Pick a preset or type a base URL.

Each reply shows its model, token usage, cost and latency. Prices are editable in Settings (checked November 2026; verify on each provider's pricing page).

**Local servers:** the browser blocks calls to them unless they allow this site. For Ollama, start it with `OLLAMA_ORIGINS=https://shaikbasha1437.github.io ollama serve`. In LM Studio, turn on *Enable CORS* in the server settings. Your browser may also ask you to allow access to your local network.

Retrieval is BM25 with synonyms and stemming. You can also switch on **semantic search** (all-MiniLM-L6-v2 via transformers.js, about 23 MB, downloaded once). It is fused with BM25 by reciprocal-rank fusion.

## Privacy and keys

- Your API key is kept **only in this browser**: in localStorage, or in sessionStorage if you choose "this tab only". It is sent only to the provider you picked, directly from your browser.
- Keys are **never** put in URLs, share links, workspace exports, conversation exports or saved state. Everything that leaves the app first goes through a redactor that drops key fields and masks key-shaped strings (tests check this).
- "Share settings link" carries only persona text and rules, never the provider, base URL or key.
- Settings → Data → **Forget keys** removes stored keys. **Reset everything** clears the workspace (with Undo).
- The chat widget always runs in demo mode and never uses a key.
- Nothing is sent to customers. "Send" and "Approve" only mark tickets as resolved in this browser.

## Security: prompt injection

Ticket text is untrusted. Before anything else, the guard strips invisible characters and checks for override attempts, role changes, system-prompt probing, demands for privileged actions, "don't involve a human", data exfiltration, encoded payloads and hidden HTML comments. A flagged ticket always goes to a person. The ticket is fenced in `<ticket>` tags (with any closing tags inside it neutralised) and the model is told to treat it as data. Rules and decisions are computed in code, outside the model, so no ticket text can change them.

## Architecture

```
index.html ─ js/main.js ─ js/app.js (state, routing, actions) ─ js/views/* (inbox, review+analytics, knowledge, widget, settings)
                               │
       js/support/   pipeline.js  classify → retrieve → draft → self-check → decide
                     classify.js  category, intent, sentiment, language, amounts, vagueness
                     compose.js   extractive composer + self-check + confidence
                     rules.js     configurable escalation rules, teams, hand-off notes
                     store.js     storage, redacted exports, share links
                     importers.js MD/TXT/HTML/PDF docs, CSV/JSON tickets
                     analytics.js
       js/agentkit/  reusable across projects
                     text.js      tokenizing, stemming, HTML → text, heading-aware chunking
                     retrieval.js BM25 + optional embeddings (RRF)
                     embed.js     transformers.js loader
                     llm.js       OpenAI / Anthropic / Gemini / OpenAI-compatible request builders, parsing, cost
                     webllm.js    in-browser model loader with fallback
                     guard.js     injection detection, sanitizing, fencing
                     keystore.js  browser-only key storage + redaction
                     modal.js     dialog stack tied to browser history
       widget.html + js/widget.js   chat widget (demo mode only)
       embed.js                     floating button + iframe for other sites
       sw.js                        offline support
```

Confidence = 0.5 × retrieval relevance + 0.3 × share of claims supported by the sources + 0.2 × certainty (no hedging, no unsupported numbers). By default a reply is auto-resolved at 0.65 or above when no rule fires.

Offline: the service worker caches each file under a versioned cache, serves network-first, and falls back to the cache when offline, so demo mode keeps working without a connection.

## Embed the widget

```html
<script src="https://shaikbasha1437.github.io/supportdesk-ai/embed.js"
        data-title="Orbitask Help" data-color="#4f46e5" data-position="right"
        data-kb="https://example.com/my-kb.json" defer></script>
```

`data-kb` is optional: export your knowledge base from the Knowledge tab ("Export for widget") and host the JSON file anywhere that allows CORS. Without it, the widget uses the sample articles (or your workspace when opened on this site).

## Run locally and test

```bash
python3 -m http.server 8000   # then open http://localhost:8000/
npm test                      # 101 Node tests, no dependencies
```

The tests cover chunking, retrieval quality (every sample ticket finds its article), every sample ticket's decision, escalation rules, injection detection, provider request builders and error handling with a mocked `fetch`, cost math, key redaction in exports and share links, CSV/JSON import, analytics and the dialog/history stack.

## Limits

- Demo mode quotes the docs; it does not paraphrase or translate. Non-English tickets get an English reply with a note, and go to review.
- Retrieval works best on articles with clear headings. Scanned PDFs (images) have no text to extract.
- Everything lives in this browser's storage (a few MB). Export your workspace to keep a copy or move it.
- Live mode calls the provider straight from your browser with your key. Use a key with a spending limit, and don't use this on a shared computer unless you choose "this tab only".
- The chat widget runs in demo mode only, so it never exposes a key on a public site.
- The sample company "Orbitask" and its customers are made up.

## License

MIT
