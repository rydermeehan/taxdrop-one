# CAD API Key Remediation Implementation Plan

> **For agentic workers:** Ops/security refactor across deployed surfaces + production auth. Not classic TDD — verification is deploy + curl + page-load, shown per task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Get the `savings-engine-database` API key out of all browser-shipped and hardcoded locations, route every caller's key through the server-side `cad-proxy` (or env), then rotate the key and retire the exposed one — with zero downtime.

**Architecture:** The key currently lives in ~35 places: 2 server files (env-injectable), 5 deployed HTML pages (shipped to browsers, call the engine directly), ~20 local dev scripts, and 1 git mirror. The fix moves every browser/serverless caller to hit same-origin `/api/cad-proxy?path=…` (which injects the key from `TAXDROP_CAD_API_KEY` env, server-side), then rotates. `cad-proxy` passes non-report paths through unauthenticated on non-SaaS hosts, so the public `studio.taxdrop.com/diy` tool keeps working with no behavior change — the key just leaves the browser.

**Tech Stack:** Vercel (video-studio + savings-engine-database projects), TypeScript serverless, static HTML/JS, `taxdrop/deploy.sh` (the ONLY sanctioned deploy entrypoint).

## Global Constraints

- **Never** run `vercel deploy --prod` directly. Deploy UI with `taxdrop/deploy.sh prod ui`, engine with `taxdrop/deploy.sh prod hybrid`.
- The **old key stays valid until the final task.** Every intermediate deploy must keep every live caller working.
- Old key literal (being removed): `«retired-key»`.
- Engine validates `X-API-Key` against `TAXDROP_API_KEY` (customer) or `TAXDROP_ADMIN_KEY` (admin, also passes customer paths) — `taxdrop-engine/cad-data/vercel-api/api/index.py:370` `_key_is_valid`.
- `cad-proxy` REPORT_PATHS (gated on all hosts) = `/api/evidence-pack/lookup`, `/api/attom-sales/lookup`, `/api/clear-capital/lookup`. The client pages use `/api/lookup`, `/api/generate-report`, `/api/chat`, `/api/cad-status`, `/api/staticmap`, `/api/streetview`, `/api/js` — none gated → safe to proxy openly on studio.
- Engine base being replaced in clients: `https://savings-engine-database.vercel.app`.

## Decisions confirmed before execution

1. **DIY stays public + free.** Proxying does not gate it; behavior is unchanged, key just moves server-side. (Confirm this is intended — the DIY tool giving free engine lookups is a pre-existing product choice, not changed here.)
2. **Local scripts read the key from `$TAXDROP_CAD_API_KEY`** (shell env) instead of a hardcoded literal. After rotation, the operator exports the new key locally. (Alternative: leave scripts hardcoded and skip retiring the old key — rejected, defeats the rotation.)
3. **Engine auth changes** (Phase 4) are done via `vercel env` on the `savings-engine-database` project + `deploy.sh prod hybrid`. Operator confirms go-ahead before the old key is retired.

---

## Phase 1 — Server callers to env (safe; old key still works)

### Task 1: `cad-proxy.ts` + `_forms-common.ts` read key from env, fail closed

**Files:**
- Modify: `ralph/video-studio/api/cad-proxy.ts:9`
- Modify: `ralph/video-studio/api/_forms-common.ts` (the `CAD_API_KEY` export)

**Interfaces:**
- Produces: both modules export/use `API_KEY`/`CAD_API_KEY` sourced only from `process.env.TAXDROP_CAD_API_KEY`.

- [ ] **Step 1: Set the env var FIRST (so nothing breaks on deploy)**

```bash
cd ralph/video-studio
printf '«retired-key»' | vercel env add TAXDROP_CAD_API_KEY production
# (repeat for preview + development if those environments are used)
```
Expected: "Added Environment Variable TAXDROP_CAD_API_KEY to video-studio".

- [ ] **Step 2: cad-proxy.ts — remove literal, fail closed**

Replace line 9:
```ts
const API_KEY = process.env.TAXDROP_CAD_API_KEY || '«retired-key»';
```
with:
```ts
const API_KEY = process.env.TAXDROP_CAD_API_KEY || '';
```
And at the top of the handler, before the upstream fetch, add a guard:
```ts
if (!API_KEY) return res.status(503).json({ error: 'upstream_key_not_configured' });
```

- [ ] **Step 3: _forms-common.ts — remove literal, fail closed**

Replace:
```ts
export const CAD_API_KEY = process.env.TAXDROP_CAD_API_KEY || '«retired-key»';
```
with:
```ts
const CAD_API_KEY_RAW = process.env.TAXDROP_CAD_API_KEY || '';
export const CAD_API_KEY = CAD_API_KEY_RAW;
```
(Callers of `CAD_API_KEY` already exist; leaving the export name intact avoids touching them. If any caller should hard-fail, it already sends an empty key → engine 401, which is visible.)

- [ ] **Step 4: Deploy + verify the live lookup still works**

```bash
taxdrop/deploy.sh prod ui
# then, unauth internal path still open on studio via proxy:
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://studio.taxdrop.com/api/cad-proxy?path=/api/lookup" -H "Content-Type: application/json" -d '{"address":"5051 Forest Bend Rd, Dallas, TX 75244"}'
```
Expected: `200` (proxy injected the env key). If `503` → env var not set; re-do Step 1.

- [ ] **Step 5: Commit**
```bash
git add ralph/video-studio/api/cad-proxy.ts ralph/video-studio/api/_forms-common.ts
git commit -m "security: source TAXDROP_CAD_API_KEY from env, drop hardcoded fallback"
```

---

## Phase 2 — De-key the 5 client pages (route through cad-proxy)

For each page, the transform is mechanical:
- Delete the `API_KEY` / `TAXDROP_INTERNAL_KEY` literal (and its `saveApiKey(...)` seed if present).
- Change the request base from `https://savings-engine-database.vercel.app` to same-origin `/api/cad-proxy?path=`, moving the engine path into the `path` query param and appending other query params after it.
- Drop the `X-API-Key` header.

### Task 2: `diy.html` (public tool — highest care)

**Files:** Modify `ralph/video-studio/public/diy.html:735-741, 939-941`

- [ ] **Step 1:** Replace the request helper. `fetch(API + '/api/lookup', { method, headers:{'Content-Type','X-API-Key'}, body })` becomes `fetch('/api/cad-proxy?path=/api/lookup', { method, headers:{'Content-Type':'application/json'}, body })`. Remove `const API_KEY = '…'`. Keep `const API` only if used for non-key assets (staticmap/streetview/js) — those can remain direct if they carry no key; if they carry the key, route them through the proxy too.
- [ ] **Step 2:** `grep -n "«retired-key»\|X-API-Key" diy.html` → expect no matches.
- [ ] **Step 3:** Deploy `taxdrop/deploy.sh prod ui`; load `https://studio.taxdrop.com/diy`, run a known address, confirm a result renders and DevTools shows the key nowhere in source/network.
- [ ] **Step 4:** Commit.

### Task 3: `report.html`, `database-test.html`, `test.html` (same engine pattern)

**Files:** Modify each of `ralph/video-studio/public/{report,database-test,test}.html`

- [ ] **Step 1:** Same transform. These add `/api/generate-report`, `/api/chat` — route those through the proxy identically (non-report paths, stay open). Remove the `TAXDROP_INTERNAL_KEY` literal and the `saveApiKey('…')` seed in `report.html:2405`.
- [ ] **Step 2:** `grep -n "«retired-key»\|X-API-Key" report.html database-test.html test.html` → no matches.
- [ ] **Step 3:** Deploy; load each page, exercise lookup + report generation, confirm working and key-free.
- [ ] **Step 4:** Commit.

### Task 4: `cad-status.html`

**Files:** Modify `ralph/video-studio/public/cad-status.html:1064-1110`

- [ ] **Step 1:** Change `API_BASE` from the engine URL to same-origin; rewrite `api(path)` to `fetch('/api/cad-proxy?path=' + encodeURIComponent(path), {...opts})` and drop the `X-API-Key` header. Endpoints `/api/cad-status`, `/api/cad-status/pia-sent` are non-report → open on studio.
- [ ] **Step 2:** `grep -n "«retired-key»\|X-API-Key" cad-status.html` → no matches.
- [ ] **Step 3:** Deploy; load `cad-status.html` (password "sup"), confirm the status board loads and PIA-sent POST works.
- [ ] **Step 4:** Commit.

---

## Phase 3 — Local scripts + git mirror

### Task 5: Local dev scripts read key from `$TAXDROP_CAD_API_KEY`

**Files:** the ~20 `.sh`/`.py`/`.html` under `taxdrop/savings-engine/`, `taxdrop-engine/legacy-savings-engine/`, and repo-root `scripts/` + `*.py` that embed the literal (full list from `grep -rl «retired-key»`).

- [ ] **Step 1:** In each script, replace the hardcoded literal with an env read: shell `"${TAXDROP_CAD_API_KEY:?set TAXDROP_CAD_API_KEY}"`, Python `os.environ["TAXDROP_CAD_API_KEY"]`. These are dev-only (not deployed) but must not carry the retired key.
- [ ] **Step 2:** `grep -rl "«retired-key»" .` (excluding node_modules/.git) → only the mirror (Task 6) remains.
- [ ] **Step 3:** Commit.

### Task 6: `taxdrop-one-export/api/cad-proxy.ts` mirror

**Files:** Modify `taxdrop-one-export/api/cad-proxy.ts`

- [ ] **Step 1:** Apply the same env-source + fail-closed change as Task 1 (this is the git source-of-truth mirror; not the live deploy but kept in sync).
- [ ] **Step 2:** `grep -rl "«retired-key»" .` (excl node_modules/.git) → **zero matches**.
- [ ] **Step 3:** Commit.

---

## Phase 4 — Rotate the key, retire the old one (operator-gated)

### Task 7: Bridge in the new key (both valid)

- [ ] **Step 1:** Generate: `NEWKEY=$(openssl rand -base64 32 | tr -d '/+=' )` (URL-safe). Record it securely.
- [ ] **Step 2:** Engine gets it as the admin bridge (admin key also passes customer paths):
```bash
cd taxdrop-engine/cad-data/vercel-api
printf '%s' "$NEWKEY" | vercel env add TAXDROP_ADMIN_KEY production
taxdrop/deploy.sh prod hybrid
```
- [ ] **Step 3:** Verify BOTH keys work:
```bash
for K in "$NEWKEY" "«retired-key»"; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://savings-engine-database.vercel.app/api/lookup" -H "X-API-Key: $K" -H "Content-Type: application/json" -d '{"address":"5051 Forest Bend Rd, Dallas, TX 75244"}'
done
```
Expected: `200` for both.

### Task 8: Point callers at the new key

- [ ] **Step 1:** `vercel env rm TAXDROP_CAD_API_KEY production` then re-add with `$NEWKEY` on video-studio; `taxdrop/deploy.sh prod ui`.
- [ ] **Step 2:** Operator exports `TAXDROP_CAD_API_KEY=$NEWKEY` in their shell for local scripts.
- [ ] **Step 3:** Verify the live proxy path still returns `200` (now using the new key end-to-end).

### Task 9: Retire the old key

- [ ] **Step 1:** Engine: `vercel env rm TAXDROP_API_KEY production` then re-add with `$NEWKEY`; `vercel env rm TAXDROP_ADMIN_KEY production` (drop the bridge, or set it to a distinct admin secret); `taxdrop/deploy.sh prod hybrid`.
- [ ] **Step 2:** Verify the OLD key is now **rejected** and the new key works:
```bash
curl -s -o /dev/null -w "old=%{http_code}\n" -X POST "https://savings-engine-database.vercel.app/api/lookup" -H "X-API-Key: «retired-key»" -H "Content-Type: application/json" -d '{"address":"x"}'
curl -s -o /dev/null -w "new=%{http_code}\n" -X POST "https://savings-engine-database.vercel.app/api/lookup" -H "X-API-Key: $NEWKEY" -H "Content-Type: application/json" -d '{"address":"5051 Forest Bend Rd, Dallas, TX 75244"}'
```
Expected: `old=401`, `new=200`.
- [ ] **Step 3:** Smoke test the live surfaces: `one.taxdrop.com/agent` (with sup login) analyze, `studio.taxdrop.com/diy` lookup. Both work.

## Rollback

- Phases 1–3 each deploy independently; revert the commit + redeploy the affected project to roll back.
- Phase 4: the old key stays valid until Task 9. If anything breaks after Task 8, re-add the old key as `TAXDROP_ADMIN_KEY` on the engine and redeploy hybrid — instant restore.

## Verification summary (per phase)

- P1: `curl` proxy lookup → 200; no literal in the 2 TS files.
- P2: each page loads + works on studio; DevTools shows no key; `grep` clean.
- P3: `grep -rl «retired-key»` → zero (after Task 6).
- P4: old key → 401, new key → 200; live surfaces smoke-tested.
