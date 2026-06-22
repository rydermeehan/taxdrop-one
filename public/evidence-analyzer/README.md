# Assessor Evidence Analyzer

Customer-facing tool for **DIY protest-package** customers, served at
**https://studio.taxdrop.com/evidence-analyzer**. The homeowner drops in the
evidence PDF their appraisal district sent; the tool reads every comparable,
flags inflated comps, and returns the lowest defensible value to ask for — plus
talking points and a ready-to-send protest/appeal letter.

Implemented from the Claude Design handoff bundle (`Assessor Evidence
Analyzer.html`). Brand follows the TaxDrop system (emerald gradient, Space
Grotesk + Inter).

## Where it lives (part of the `video-studio` Vercel project)

| Path | Role |
|------|------|
| `public/evidence-analyzer/` | This static page (copied to `dist/` on build) |
| `api/evidence-read.ts` | OpenRouter-backed AI reader (`/api/evidence-read`) |
| `vercel.json` | `/evidence-analyzer` → `/evidence-analyzer/index.html` rewrite |

`<base href="/evidence-analyzer/">` in `index.html` keeps all relative
asset/script/logo paths resolving under the subpath.

## How it works

1. **Extract** (`extract.js`) — pulls text from the PDF in-browser (pdf.js), then
   POSTs it to `/api/evidence-read` to structure the messy CAD format into JSON.
   If the reader is unavailable, it silently falls back to a transparent
   rule-based parser (`Analyzer.parseHeuristic`).
2. **Analyze** (`analyzer.js`) — pure deterministic JS. Median of the comparables
   as the safe floor (computed, never invented); gravitate to the 2nd-lowest comp
   when it beats the assessment; toss inflated comps (with the why); honest "no
   easy win" when nothing in the packet helps. TX → "protest"/ARB/"appraised
   value"; CA → "appeal"/AAB/"assessed value". Every dollar figure is computed
   here — the AI only reads.
3. **Present** (`results.jsx`, `app.jsx`) — hero recommendation + editable-rate
   savings, findings, comp-by-comp table, talking points, copy-ready letter.

## Config

Set `OPENROUTER_API_KEY` (and optionally `EVIDENCE_READER_MODEL`, default
`anthropic/claude-sonnet-4.5`) in the `video-studio` Vercel project env. Without
it, `/api/evidence-read` returns 503 and the UI uses the rule-based fallback.

## Deploy

Through the sanctioned `taxdrop/deploy.sh prod ui` flow (deploys video-studio) —
never `vercel deploy --prod` directly. See the `taxdrop_deploy_workflow` memory.

## Notes

- PDF only; no OCR for scanned/image-only PDFs.
- Multi-subject packets → analyzes the first subject.
- Supports a protest/appeal; not legal or tax advice.
