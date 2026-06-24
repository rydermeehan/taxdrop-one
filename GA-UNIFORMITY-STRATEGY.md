# `ga_uniformity` — Georgia strategy module (spec)

> **Status:** design / queued. No code yet. The Georgia analog of the TX equity
> engine in [STRATEGY-RECOMMENDER-EXPLAINER.md](STRATEGY-RECOMMENDER-EXPLAINER.md).
> Consumes the same normalized `Subject` + `Comp[]` and emits the same `Strategy[]`
> the ladder/quadrant already render (see [JURISDICTION-ARCHITECTURE.md](JURISDICTION-ARCHITECTURE.md) §6).
>
> **Blocked on data:** GA rows aren't in prod `properties` yet (Fulton
> `db_in_database:false`, 2026-06-24). This spec is ready to implement the moment
> Fulton/Chatham load.

---

## 1. The headline: GA uniformity ≈ TX equity, so the math ports almost unchanged

Georgia's appeal ground under **O.C.G.A. §48-5-311** includes **uniformity** — your
assessment may not exceed the assessed values of comparable properties. That is the
same shape as the TX §41.43(b)(3) "median of comparables, appropriately adjusted"
argument our V3 engine already implements. The engine probe confirmed GA comps come
back **assessed/market-style** (`total_market` + `assessed_value` + full feature set,
**no** `sale_price`, **no** pre-computed adjustments) — i.e. TX equity comps minus the
engine's `adjustment_total`.

So `ga_uniformity` is **`computeV3Strategy` run on GA comps**, with one wrapper concern:
the **40% assessment ratio**.

---

## 2. The one real difference: the 40% assessment ratio

GA assesses at **exactly 40% of fair market value**: `assessed_value = 0.40 × total_market`
(verified across Fulton/Chatham/DeKalb). Taxes bill on that 40% assessed value (minus
exemptions) × the county millage.

Because the 40% ratio is applied **uniformly by statute**, the math is clean:

```
run V3 on comps' total_market  →  indicated FMV          (reuse, unchanged)
assessed_target = 0.40 × indicated_FMV                   (apply ratio at the end)
```

Working in FMV then multiplying by 0.40 is mathematically identical to working in
assessed terms, so **we reuse `computeAdjBreakdownV3` / `filterCompsV3` /
`computeV3Strategy` verbatim** and only convert at the display/savings boundary.

- **Notice (shown):** FMV = `subject.total_market`; assessed = `subject.assessed_value` (0.40×).
- **Target (shown):** indicated FMV, **and** its 40% assessed equivalent.
- **Savings:** `(subject.assessed_value − target_assessed) × county_millage`. Uses
  `capRule.taxableField = "assessed_value"` and a GA per-county millage (not the TX 2.2%).
  Exemptions are a flat offset that largely cancels in the delta — fine for the estimate.

> **Edge case (v2):** GA uniformity is technically argued on assessed values, so if a
> county applies the 40% ratio *inconsistently* across parcels, the uniformity bite is at
> the assessed level directly. v1 assumes a uniform 40% (true by statute); flag ratio
> outliers later.

---

## 3. Reuse map — what carries over, what changes

| V3 piece | GA reuse | Note |
|---|---|---|
| `computeAdjBreakdownV3` (size/age/land/features, ±30% cap) | ✅ as-is | operates on FMV; GA comps have `living_sqft`, `year_built`, `land_value`, `improvement_value` |
| `c.adjustment_total` (pool/garage/fireplace) | ⚠ defaults to 0 | GA comps lack it → features unadjusted in v1. v2: compute from `has_pool`/`garage_spaces`/`fireplace_count` via a GA feature table (analog of `TX_FEATURE_ADJUSTMENTS`) |
| `filterCompsV3` renovation filter (eff-year Δ>25y) | ✅ degrades | skips comps with null `effective_year_built` (`if (!cEff) return true`) — depends on what the GA ingest populates |
| `filterCompsV3` statistical filter (>30% over median) | ✅ as-is | pure FMV |
| `computeV3Strategy` (median + 3% threshold + 2nd-lowest fallback) | ✅ as-is | the 3% threshold + fallback are policy, state-agnostic |
| Comp selection (subdivision/nbhd/school_district/sqft) | ⚠ data-dependent | Fulton GIS has subdivision; `nbhd_code` may be sparse → widen to county. Quality = whatever the ingest writes |

---

## 4. Module contract

```
ga_uniformity.run(subject, comps, jurisdiction) -> Strategy[]
```

1. `v3 = computeV3Strategy(subject, comps)`   // FMV math, unchanged
2. `notice = subject.total_market`
3. If `v3.value == null` (no case) → return only the token floor.
4. Else build:
   - **primary** — `{ key:"ga_uniformity", kind:"median", tier:"our", defRank:0,`
     `name:"Uniformity equity comps", value:v3.value, ... }`
     (in GA, the uniformity median built from the county's own digest values is the
     most defensible play → `defRank 0`)
   - **backup** — `{ key:"ga_second", kind:"comp", tier:"potential", defRank:1,`
     `name:"Second-lowest comparable", value:v3.secondLowest }`
   - **token** — 3% courtesy floor (informal/BTA settlement), shown only if nothing beats notice.

Selection (primary beats notice → lead; most-defensible qualifier → backup) is the same
generic logic the TX `decide()` already uses; GA just supplies a different
`strategyModules` set (`["ga_uniformity","token"]` — **no** CAD-median / packet-derived
strategies, since GA has no CAD evidence-packet flow).

**Quadrant/ladder:** unchanged. `defRank` drives the x-axis (confidence), reduction drives
the y-axis — identical to TX.

---

## 5. Display deltas vs TX (frontend, from `jurisdictions.js` GA)

- Wording: "appeal" / "Board of Tax Assessors" / "Board of Equalization", form **PT-311A**,
  deadline **45 days after the notice date**, statute **O.C.G.A. §48-5-311**.
- Hero shows the FMV target **and** the 40% assessed equivalent.
- Add a selling-point chip: a successful appeal **freezes the value ~2 extra years**
  (the **299(c)** freeze) — GA-specific, no TX analog.
- No "CAD evidence pack" upload step (TX-only); GA leads with our uniformity brief.

---

## 6. Dependencies before this ships

1. **GA data in prod `properties`** (Fulton/Chatham ingested; `db_in_database:true`).
2. **The county-gate** (ATTOM only when county not covered) — see the gate patch handed off
   separately; once GA rows exist, GA stops hitting ATTOM and flows through `ga_uniformity`.
3. **GA per-county millage** for the savings line (`capRule.taxableField = assessed_value`).
4. Confirm GA ingest populates enough comp-selection fields (subdivision / sqft / `improvement_value`)
   for a usable comp set.

---

*Owner: Ryder Meehan. Spec only — changes no shipped code.*
