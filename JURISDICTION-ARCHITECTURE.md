# TaxDrop One — Jurisdiction Architecture (design doc)

> **Status:** design only. No code changed by this doc. The goal is to lock the *seam*
> that makes One state/county-agnostic **by architecture**, while we stay **TX-by-content**
> until each new state's data + methodology are ready.
>
> **Priority states:** CA → GA → FL (expansion), with **TX as the live reference**.
>
> Read alongside [STRATEGY-RECOMMENDER-EXPLAINER.md](STRATEGY-RECOMMENDER-EXPLAINER.md)
> (the TX calculation/decision methodology this generalizes).

---

## 1. Principle & non-goals

**Principle:** *Agnostic shell, pluggable content.* The UI shell (recommendation hero, strategy
ladder, savings×confidence quadrant, step-by-step guide, evidence section, packet export) and the
*selection/ranking* logic stay generic. Everything state-specific — terminology, forms, deadlines,
statutes, cap math, exemptions, and **which valuation strategies run** — is supplied by a
`Jurisdiction` object resolved from the address.

**Non-goals (explicitly out of scope):**
- One universal valuation algorithm. CA breaks the TX equity-comp assumption (see §7); "agnostic
  engine" = *pluggable per-state strategy modules*, not a single formula.
- Rebuilding the TX tool. TX is solid and becomes the reference implementation unchanged.
- Building CA/GA/FL data ingestion here. This doc defines the *contract* those adapters fill.

**Hard constraint — data gating.** Today only **TX** has live data + a working engine on the One
endpoint (`/api/cad-proxy → /api/evidence-pack/lookup`). A real CA residential lookup currently
returns an empty subject. So business priority (CA, GA, FL) is gated by data availability, not by
this frontend. The seam lets us flip each state on the day its adapter + strategy module land.

---

## 2. The three layers (and their costs)

| Layer | Responsibility | Agnostic cost | Today |
|---|---|---|---|
| **A. Jurisdiction metadata** | terminology, authority name, form, deadline, statute, fee, cap rule, exemptions, which strategies run | **Low** (config) | hardcoded TX in `deriveJurisdiction` + copy |
| **B. Data adapter** | assessor record → one **normalized Subject** schema | **Medium**; gating dependency | TX CAD live; CA partial (separate track); GA/FL planned |
| **C. Strategy engine** | produce the ranked reduction strategies | **High / per-state** | TX equity-V3 + CAD medians + 2nd-lowest + token |

The UI and selection logic consume **(A) a `Jurisdiction`**, **(B) a normalized `Subject` + `Comp[]`**,
and **(C) a `Strategy[]`** — and never need to know the state.

---

## 3. The `Jurisdiction` contract

Resolved from the address by a **state→county router** (the CA enrollment-routing work already in
flight is exactly this resolver — extend it to all states). Pseudo-types, not implementation:

```ts
type StateId = "TX" | "CA" | "GA" | "FL";

interface Jurisdiction {
  id: StateId;
  stateName: string;                 // "Texas"
  county: string;                    // resolved from data, e.g. "Dallas"
  taxYear: number;                   // replaces global CURRENT_TAX_YEAR
  effectiveTaxRatePct: number;       // replaces global TAX_RATE; ideally per-county

  terminology: {
    proceeding: string;              // "protest" | "appeal" | "petition"
    proceedingTitle: string;         // "Notice of Protest" | "Application for Changed Assessment" | "VAB Petition"
    authority: string;               // "Dallas CAD" | "Los Angeles County Assessor" | "<County> Board of Tax Assessors" | "<County> Property Appraiser"
    reviewBodyShort: string;         // "ARB" | "AAB" | "BOE" | "VAB"
    reviewBodyLong: string;
    fileVerb: string;                // hero label, e.g. "File this value" / "Request this value"
  };

  filing: {
    form: string;                    // "Form 50-132" | "BOE-305-AH" | "PT-311A" | "DR-486"
    deadline: DeadlineRule;          // see below — NOT always a fixed calendar date
    statute: string;                 // "Texas Tax Code §41.43"
    statuteShort: string;            // "Texas §41.43"
    correctionPath?: string;         // e.g. TX §25.25 clerical-correction (longer window)
  };

  capRule: {
    type: "tx_homestead_10" | "ca_prop13" | "fl_soh" | "ga_floating_homestead" | "none";
    taxableField: SubjectField;      // which normalized field taxes are actually billed on
    marketField: SubjectField;       // the market/just value we reduce toward
    note: string;                    // shown when taxable < market (sets savings expectations)
  };

  exemptionRules: ExemptionRule[];   // per-state rule pack (§8)
  strategyModules: StrategyModuleId[]; // ordered; which engines run (§6)

  dataSource: { id: string; status: "live" | "partial" | "planned"; lookupPath: string };

  disclaimer: string;               // replaces the hardcoded "Texas §41.43 protest filing" footer
}

type DeadlineRule =
  | { type: "fixedDate"; monthDay: string }                 // TX: "05-15" (or +days-after-notice, whichever later)
  | { type: "daysAfterNotice"; days: number }               // GA: 45, FL: 25
  | { type: "window"; openMonthDay: string; closeMonthDay: string; perCounty?: true }; // CA: 07-02 → 09-15 or 11-30
```

> **Why deadlines are a rule, not a string:** today `deadline: "May 15, 2026"` is hardcoded. GA is
> *notice date + 45 days*, FL is *TRIM notice + 25 days*, CA is a *window* that differs by county.
> A `DeadlineRule` resolves against the subject's `notice_date` so the step-by-step guide is correct
> per property.

---

## 4. Normalized `Subject` schema (the adapter contract)

The TX engine already returns a rich schema (this is the seed). Adapters for other states **must map
into these canonical names**; fields the source can't provide are `null` and the UI degrades gracefully.

**Universal (every adapter should populate):**
`parcel_id, county, site_address, site_city, site_zip, marketValue, taxableValue, land_value,
improvement_value, living_sqft, year_built, notice_date, is_certified, was_protested`

> `marketValue` / `taxableValue` are **mapped per state** via `capRule.marketField` / `taxableField`:
> TX `total_market` / `total_appraised`; CA `market` / `assessed_value`; FL `just_value` / `assessed_value`.

**Feature block (powers the Feature Checker — universal concept, source-dependent fields):**
`living_sqft, lot_sqft, year_built, effective_year_built, year_remodeled, story_height, bedroom_count,
bathroom_count, half_bath_count, total_rooms, has_pool, has_garage, garage_spaces, has_carport,
carport_spaces, fireplace_count, grade, cdu_code, physical_condition, pct_good, exterior_wall,
foundation_type, heating_cooling, extra_features (human-readable)`

**Exemption signal (minimum):** `is_homestead` (bool). Richer exemption state is rare in rolls →
the Exemption Checker fills gaps with an eligibility quiz (§8).

**Comps:** `Comp[]` with the same feature fields plus `adjustments`, `adjustment_total`,
`adjusted_psf`, `adjusted_total_market` (TX equity engine output). CA/GA/FL strategy modules may
populate a different comp shape (e.g., **sales** comps with `sale_price`, `sale_date`).

---

## 5. What gets extracted from the current TX build

Concrete hardcodes to move behind `Jurisdiction` (file: `public/v2/app.jsx`). **No behavior change for
TX** — it just reads its values from a `TX` jurisdiction object instead of literals.

| Current (app.jsx) | Moves to |
|---|---|
| `TAX_RATE = 2.2` (L15) | `jurisdiction.effectiveTaxRatePct` (per county) |
| `CURRENT_TAX_YEAR = 2026` (L17) | `jurisdiction.taxYear` |
| `deriveJurisdiction()` returning TX form/deadline/board/statute (L198-216) | `JURISDICTIONS.TX` config + resolver |
| `"...CAD"` authority pattern (L205) | `terminology.authority` template per state |
| Footer "Texas §41.43 protest filing" (L823, L1254) | `jurisdiction.disclaimer` |
| Rationale/popup copy: "§41.43 lets us take the lower…" (L305, L859) | strategy-module copy (TX only) |
| "Your protest, step by step" + step copy (L1290, form/board refs) | `terminology.proceeding` + `filing.*` |
| `decide()` strategy construction (CAD medians, 2nd-lowest, equity, token) | `JURISDICTIONS.TX.strategyModules` (§6) |
| `TOKEN_PCT = 0.03` | TX strategy-module param (token is a TX construct) |

The router that picks the jurisdiction = **state→county** off the resolved address (extend the CA
routing track to all four states). Until a state's `dataSource.status === "live"`, the address resolves
to an "unsupported state" path (waitlist / hand-off), never a broken result.

---

## 6. Strategy module interface (layer C)

Each strategy module is a pure function feeding the **existing** ladder/quadrant. The shell and the
selection (`real = strategies that beat the basis; pick primary + backup by defRank`) stay generic.

```ts
interface StrategyModule {
  id: StrategyModuleId;
  appliesTo: StateId[];
  run(subject: Subject, comps: Comp[], j: Jurisdiction): Strategy[];
}
interface Strategy {
  key: string; tag: string; name: string;
  value: number;            // requested value
  defRank: number;          // defensibility (lower = stronger), for selection + quadrant x-axis
  kind: string;             // "median" | "comp" | "salescomp" | "baseyear" | "feature" | "exemption" | "token"
  reason: string; status?: string; popup?: { title: string; paras: string[] };
}
```

**Per-state module sets (initial):**

- **TX** (live): `cad_medians`, `second_lowest_comp`, `tx_equity_v3`, `token` — *unchanged from today.*
- **CA** (planned): `ca_prop8_salescomp` (decline-in-value via sales comps), `ca_base_year`
  (post-change-of-ownership over-assessment). **No equity/median module** (Prop 13).
- **GA** (planned): `ga_salescomp`, `ga_uniformity` (uniformity ≈ equity, a recognized GA ground),
  plus the `299c_freeze` note as a benefit callout.
- **FL** (planned): `fl_salescomp` (just value), `fl_cost_of_sale` (the ~15% cost-of-sale adjustment
  to just value), plus SOH/homestead checks.

Cross-cutting modules that are **state-agnostic** and reusable everywhere: `feature_correction`
(Feature Checker, §8) and `exemption` (Exemption Checker, §8).

---

## 7. Per-state matrix (priority order: CA → GA → FL, TX reference)

> ⚠ **Verify annually / per county.** Deadlines shift yearly; many caps/exemptions are county
> local-options or recent legislation. Treat this as the starting rule pack, not gospel.

| | **CA** (priority 1) | **GA** (priority 2) | **FL** (priority 3) | **TX** (reference, live) |
|---|---|---|---|---|
| Proceeding | **appeal** | **appeal** | **petition** | **protest** |
| Authority | County Assessor | County Board of Tax Assessors | County Property Appraiser | County Appraisal District (CAD) |
| Review body | Assessment Appeals Board (AAB) / county BOE | Board of Equalization (or arbitration / hearing officer) | Value Adjustment Board (VAB), special magistrate | Appraisal Review Board (ARB) |
| Form | **BOE-305-AH** (LA: own AAB app) | **PT-311A** | **DR-486** | **Form 50-132** |
| Deadline | window **Jul 2 – Sep 15** (notice-to-all counties) or **– Nov 30** (others; incl. LA) | **45 days** from notice date | **25 days** after TRIM notice (~mid-Sep) | **May 15** (or 30 days after notice) |
| Statute | Prop 13 / Prop 8; Rev & Tax Code §1603+ | O.C.G.A. **§48-5-311** | **Ch. 194** F.S. | Tax Code **§41.43** (+§25.25 corrections) |
| Valuation basis | **Prop 8 decline-in-value (market via sales comps)**; assessed = lesser of factored base-year or market | market + **uniformity** (equity-like) | **just value** (sales comps) | market **+ unequal appraisal (equity)** |
| Cap (taxable<market) | **Prop 13** base-year +≤2%/yr | **HB 581 floating homestead** (CPI cap, 2025; counties could opt out ⚠) + local caps | **Save Our Homes** 3%/CPI homestead; 10% non-homestead | **10% homestead** (§23.23) |
| Headline exemptions | Homeowners' **$7,000**; DV; **Prop 19** transfers | Standard homestead; senior/school (very county-variable); DV; HB581 | **$50k homestead** + SOH portability; senior; DV; widow(er); disability | Homestead (+$100k school); 65+; disabled; DV; surviving spouse |
| Engine fit | ⚠ **new methodology** (no equity) | partial reuse (uniformity ≈ equity) | new (sales-comp + COS) | ✅ current engine |
| Data status | partial (separate CA layer) | planned | planned | **live** |
| Notable angle | base-year reset after purchase; Prop 19 | **299(c)** 3-yr value freeze after a win | **15% cost-of-sale** deduction; PA must defend | §25.25 clerical corrections |

**Key implication:** CA (priority 1) is also the **biggest engineering lift** because its methodology is
furthest from TX. GA reuses the most (uniformity ≈ our equity argument). FL is a cleaner sales-comp
model. So *business priority* (CA→GA→FL) and *reuse* (GA→FL→CA) point in opposite directions — worth a
deliberate call on sequencing (see §9).

---

## 8. New features through the agnostic lens

All three are **generic shells + per-state rule packs**, and none touch the strategy selection.

- **Feature Checker** — most portable. Bind the UI to the normalized **feature block** (§4). Disputes
  produce a `feature_correction` strategy: sqft delta × indicated PSF; remove phantom pool/garage
  contributory value; condition (`cdu_code`/`pct_good`) dispute = the lightweight obsolescence path
  with optional photo/estimate upload to the packet. Works in any state the adapter populates features.
- **Exemption Checker** — generic shell + **per-state `ExemptionRule[]`**. From data: detect missing
  homestead (`is_homestead === false`). For the rest, a short eligibility quiz keyed to the state's
  rules (TX 65+/disabled/DV; CA Homeowners'/Prop 19/DV; GA senior/school/DV; FL $50k/senior/DV/
  widow(er)). Free value-add, **not** 25%-monetized.
- **Capped-value correctness** — universal principle: compare the target to `capRule.taxableField`,
  and base the savings line on the **taxable** change, not market. Cap math differs (TX 10% / CA
  Prop 13 / FL SOH / GA floating homestead) but the seam is one field mapping + one note.

```ts
interface ExemptionRule {
  id: string;                 // "tx_homestead" | "ca_homeowners" | "fl_homestead_50k" | ...
  label: string;
  detect?: (s: Subject) => "has" | "missing" | "unknown";   // from data when possible
  quiz?: QuizQuestion[];      // when not derivable from the roll
  estValue?: (s: Subject, j: Jurisdiction) => number;        // rough $ impact for display
  applyHint: string;          // how/where to file (free)
}
```

---

## 9. Phasing (respects priority **CA → GA → FL**, TX untouched)

**Phase 0 — Extract the seam (TX-only, zero behavior change).** Introduce `Jurisdiction` + a `TX`
config; point the v2 UI at it (the §5 table). Add the state→county resolver with a graceful
"unsupported state" path. *Safe refactor; this is the only thing worth doing immediately.*

**Phase 1 — Cross-cutting features on TX.** Ship Feature Checker, Exemption Checker, and the
capped-value fix against the TX jurisdiction. They're built generic from day one, proving the rule-pack
shape before any new state.

**Phase 2 — CA (priority 1).** Wire the CA data adapter (extend the in-flight CA assessment-data
layer) to the normalized Subject; build the `ca_prop8_salescomp` (+ `ca_base_year`) strategy module
and CA exemption pack. Flip `dataSource.status` to live per county (LA/SF/Sacramento first).

**Phase 3 — GA, then FL.** GA reuses uniformity (closest to our equity engine) — `ga_salescomp` +
`ga_uniformity` + 299(c) callout. FL adds `fl_salescomp` + `fl_cost_of_sale` + SOH checks. Each is a
data adapter + a strategy module + an exemption pack behind the same seam.

> **Sequencing note for discussion:** if speed-to-launch matters more than hitting CA first, GA/FL are
> *cheaper* (they reuse sales-comp/uniformity patterns) while CA needs a net-new methodology. One
> option: do **Phase 0–1 + CA data wiring** in parallel, but ship **GA or FL** as the first *new* state
> to validate the multi-state seam quickly, with CA close behind once its strategy module is ready.

---

## 10. Open decisions / things to confirm

1. **Sequencing call:** strict CA-first, or validate the seam on GA/FL (cheaper) while CA's strategy
   module is built? (Business vs. engineering-reuse tradeoff — §9.)
2. **CA data source:** confirm the in-flight CA assessment-data layer can fill the normalized Subject
   (esp. `marketValue` vs `assessed_value`, features) and which counties are live.
3. **Deadlines/caps are volatile:** GA HB 581 opt-outs and annual CA/FL dates need a maintained,
   per-county data table (not literals in code).
4. **Monetization per state:** the 25% contingency assumes a protest win; CA Prop 8 reductions are
   often *temporary* (re-reviewed annually) — confirm fee framing per state.
5. **Effective tax rate** should become per-county (it drives the headline savings number); today it's
   a single `2.2%`.

---

*Owner: Ryder Meehan. This doc defines the contract; it changes no shipped code.*
