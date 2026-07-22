# Forms Catalog

Step 2 of one.taxdrop.com serves the **correct blank official form** for the
homeowner's jurisdiction. Routing lives in `api/_forms-catalog.ts` (SSOT), with
per-state records in `_forms-ca.ts`, `_forms-ga.ts`, `_forms-fl.ts` and TX filing
detail reused from `_tx-cads.ts`. Mirrored PDFs are in `public/forms/` — **8** in
total: TX 50-132, GA PT-311A, FL DR-486, and 5 California county forms (LA,
San Francisco, Sacramento, Alameda, Contra Costa).

## Coverage

| State | Form | Counties | Delivery | Fee |
|---|---|---|---|---|
| TX | Form 50-132 | 65 (from `_tx-cads.ts`) | mirror | free |
| GA | PT-311A (statewide) | 4: Fulton, Gwinnett, Chatham, DeKalb | mirror | free |
| FL | DR-486 (statewide, s.194.011(3) F.S.) | all 67 | mirror | ~$15/parcel |
| CA | per-county | 5: LA, SF, Sacramento, Alameda, Contra Costa | **official URL primary** | $30–$120 |

## Why CA is delivered differently

Alameda County deems an application filed on a **previous form revision invalid**,
and LA renumbers the state form as AAB-100. There is no safe generic California PDF,
so:
- `delivery: 'official'` — the county's own URL is the primary download button;
  our mirror is the fallback.
- An **uncovered** CA county gets `pdfPath: null` and a pointer to its own
  appeals board, rather than a form we can't verify the county accepts.

**The CA generic fallback serves no PDF at all.** For any California county
outside the 5 covered above, `CA_FORM_FALLBACK()` in `_forms-ca.ts` returns
`pdfPath: null` and `officialUrl: null` — there is nothing to download, only a
pointer to "your county assessment appeals board." This is deliberate, not a
gap to be filled with a generic form later: Alameda voids applications filed on
a prior form revision, and LA renumbers the form as AAB-100, so no single PDF
is safe to hand out statewide.

## Re-verification

`npm test` fails when a record goes stale: **6 months for CA**, 12 for TX/GA/FL.
When it fails, actually re-check the source — do not just bump `verifiedOn`.

Known re-check triggers:
- **FL DR-486 is marked "Provisional"** pending rule adoption; confirm R. 12/25
  has not been superseded.
- **Sacramento's official copy is rev 09 (05-20)** while peers are on rev 12 —
  the county, not our mirror, is behind.
- CAD names change (Brazoria renamed once); re-verify before May filing season.

## Deliberately unverified — do not fill in by guessing

- **Chatham County GA** online appeal portal — none found; confirm at 912-652-7271.
- **San Francisco** e-file portal URL — unpublished until 2026-07-22.
- **Alameda** 2026-27 window — Sep 15 inferred from the current notice + statute.

## Pre-fill

The CraftMyPDF pre-fill router (`generate-forms.ts`, `_forms-registry.ts`,
`_forms-tx.ts`) is retained but **dark**: it returns 404 unless
`FORMS_PREFILL_ENABLED=1`. See `CRAFTMYPDF_TEMPLATES.md`.
