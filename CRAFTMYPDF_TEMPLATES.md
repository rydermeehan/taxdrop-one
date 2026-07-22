# CraftMyPDF Forms Router

> **Status: dark as of 2026-07-20.** `generate-forms` returns 404 unless
> `FORMS_PREFILL_ENABLED=1`. Step 2 now serves blank official forms via the
> catalog — see `FORMS_CATALOG.md`. Everything below still describes the working
> pre-fill path, kept for re-enablement.

`/api/form-schema` (availability + field list) and `/api/generate-forms` (render)
route on `state + county` via `api/_forms-registry.ts`. Adding a state is data
entry: build the template, add its `FormDef` (intake fields + `buildPayload` read
from the real placeholder names), set the env var below.

| State | Selector | Form | Env var | Status |
|-------|----------|------|---------|--------|
| TX | population ≥120k | Form 50-132 | `CRAFTMYPDF_TEMPLATE_50_132_OVER120K` = `47b77b2358c5b082` | LIVE |
| TX | population <120k | Form 50-132 | `CRAFTMYPDF_TEMPLATE_50_132_UNDER120K` = `dc977b235ab91110` | LIVE |
| CA | county = Alameda | (per-county) | `CRAFTMYPDF_TEMPLATE_CA_ALAMEDA` | pending |
| CA | county = Sacramento | (per-county) | `CRAFTMYPDF_TEMPLATE_CA_SACRAMENTO` | pending |
| CA | county = Los Angeles | (per-county) | `CRAFTMYPDF_TEMPLATE_CA_LOSANGELES` | pending |
| CA | county = San Francisco | (per-county) | `CRAFTMYPDF_TEMPLATE_CA_SANFRANCISCO` | pending |
| CA | county = Contra Costa | (per-county) | `CRAFTMYPDF_TEMPLATE_CA_CONTRACOSTA` | pending |
| GA | statewide | PT-311A | `CRAFTMYPDF_TEMPLATE_GA_PT311A` | pending |
| FL | statewide | DR-486 | `CRAFTMYPDF_TEMPLATE_FL_DR486` | pending |

Pending jurisdictions return `available:false` from `/api/form-schema`; the UI
shows the "get the form from your [authority]" instructions fallback — no dead
buttons. Set an env var via `vercel env` on the one.taxdrop.com project (then the
county-specific `FormDef` must also be added in the registry with its intake
fields + `buildPayload`).

## GA PT-311A — template exists but is NOT wired yet

A CraftMyPDF template for Georgia PT-311A **exists** — template ID
`fcf77b23ca89afc0` ("Georgia PT-311A_Appeal_of_Assessment_Form.pdf") — but it is
a **stub**: as of 2026-07-03 it binds only two placeholders (`property_address`,
`cad_owner_name`, both copied from the TX under-120k template). A real PT-311A
appeal needs map/parcel + account number, county + tax year, taxpayer mailing
address, **taxpayer's opinion of value**, **basis of appeal** (value / uniformity
/ taxability / exemption / covenant), and **appeal method** (Board of
Equalization / Hearing Officer / Arbitration).

Because a `buildPayload` can only map placeholders that actually exist in the
template, GA stays registered as **pending** (statewide) until the template is
fleshed out. To graduate GA to LIVE once the template is complete:

1. Finish the PT-311A template in CraftMyPDF — add the overlay text components
   with `{{ data.* }}` bindings for the fields above.
2. Add a `_forms-ga.ts` with the real `FormDef` (intake fields the homeowner
   supplies — opinion of value, basis of appeal, appeal method — plus a
   `buildPayload` mapping to the real placeholder names), and register it in
   `FORMS_REGISTRY.GA.resolve`.
3. Set `CRAFTMYPDF_TEMPLATE_GA_PT311A=fcf77b23ca89afc0` on the one.taxdrop.com
   Vercel project.

You can introspect any template's bound placeholders via
`GET https://api.craftmypdf.com/v1/get-template?template_id=<id>` and grepping the
returned `body` for `data.<field>` references.
