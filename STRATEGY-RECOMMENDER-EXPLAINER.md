# TaxDrop One — Strategy Recommender Explainer

A handoff doc for design work. This describes **what the recommender does**, **the inputs it operates on**, and **the rules that pick the winning strategy** — without describing the UI. Design the UI from this; don't reverse-engineer it from the current screen.

---

## 1. The job, in one sentence

Given an address + (optionally) a CAD evidence packet PDF, produce the single requested value most likely to deliver the largest defensible reduction at hearing, plus a ranked ladder of every alternative angle we considered.

We don't pick "the safest" number. We **lead with the biggest reduction the evidence will hold up** and keep the safest qualifying angle in reserve as the named backup.

---

## 2. Inputs

Two independent data sources, both keyed off the user's address:

| Source | What it gives us | When it's present |
|---|---|---|
| **Engine** (`/api/evidence-pack/lookup`) | Subject record (sqft, year built, land value, etc.) + the **address-driven notice** (current assessed value) + a curated list of equity comps we generated ourselves | Always — anchors every recommendation |
| **CAD packet** (uploaded PDF, parsed by the Evidence Analyzer engine) | The county's own indicators: sales median, equity median, raw comp table, and the second-lowest comp on the page | Optional — only when the user has the packet |

**Critical guard — CAD/engine mismatch.** If a CAD packet's noticed value differs from the engine's notice by **>25%**, we assume the user uploaded a packet for the wrong property and **discard the entire CAD packet** for this run. The notice always comes from the engine (address-driven); never from the uploaded PDF.

---

## 3. The strategies we model

We run every angle in parallel and rank them. There are **four kinds**:

### A. CAD medians (most defensible)
The county's own packet typically prints one or two median lines:
- **Sales median** — median of the sales comps the CAD chose
- **Equity median** — median of the equity comps the CAD chose

These are the strongest possible evidence because they come from the CAD itself. Texas Tax Code §41.43 lets us request the lower of the county's own indicators.

### B. Second-lowest CAD comp (single comp anchor)
The lowest comp on a packet is often dismissed as an outlier; the **second-lowest** is the most aggressive value we can credibly anchor to with a single comp. Pulled from the CAD packet directly.

### C. TaxDrop equity report (our own comps)
We generate our own equity comp set from the engine and run the **V3 calculation** (see §4) to produce an indicated value. This is the angle we control end-to-end — and it's what we'd build the protest around if there's no CAD packet.

### D. Token settlement
If nothing beats the notice, we negotiate a **3% courtesy reduction** at the informal. Always available as the floor; never preferred when a real reduction exists.

Each strategy carries a **defensibility rank** (0 = strongest):
- `0` — CAD medians (county's own indicators)
- `1` — Single-comp anchor (second-lowest)
- `2` — Our equity report
- `3` — Token

---

## 4. The V3 calculation (how the equity report becomes a number)

For our own comps, raw median is not enough — we have to adjust each comp to the subject before taking a median, and we have to filter outliers. This logic is **the same** on `/pro` and on the v3 evidence-pack PDF (Mike's rule: the value on the screen must match the value on the PDF).

### Step 1 — Filter comps
Drop two categories from the set:
1. **Renovation outliers** — any comp whose effective-year-built is more than **25 years newer** than the subject. (A 1960 home with a 2020 effective year is not comparable to a true 1960 home.)
2. **Statistical outliers** — once renovation outliers are gone, compute a provisional median and drop any comp whose adjusted value lands **>30% above that median**.

### Step 2 — Per-comp adjustment (Mike's V4 math)
For each surviving comp, adjust the comp's value to what it would be worth at the subject's spec:

| Adjustment | Formula |
|---|---|
| **Size (GLA)** | `(median_improvement_psf ÷ 2) × (subject_sqft − comp_sqft)` |
| **Age** | `median_improvement_psf × 0.35% × (subject_year − comp_year)` |
| **Land** | difference in land value per sqft, **capped at ±10%** of the comp's raw PSF |
| **Features** | pool/garage/fireplace adjustments (provided by the engine as `adjustment_total`) |

Final cap: the total adjustment is constrained to **±30%** of the comp's raw PSF — no single comp can swing more than that.

### Step 3 — Pick the value (median anchor + threshold + fallback)
With the adjusted property values sorted ascending:

```
1.  If median < subject AND (subject − median) / subject ≥ 3%   →  use median
2.  Else if at least one comp lands below subject               →  use the 2nd-lowest below-subject (or lowest if only one)
3.  Else                                                         →  no_case
```

The **3% threshold** keeps us from "winning" by tiny noise. The **2nd-lowest fallback** lets us still get a number when the median doesn't cross the threshold but real lower comps exist — without anchoring to a single outlier.

---

## 5. Choosing the winner

After all four strategy types run, we have a flat list of strategies, each with a `value` and a `defRank`. The selection logic:

```
real = strategies that beat the notice (i.e., value < notice)

1. If our equity report (V3) qualifies (real)
   → primary = our equity report
   → backup  = the most-defensible CAD strategy that also qualifies

2. Else if any CAD strategy qualifies
   → primary = most defensible (lowest defRank), tie-break by lower value
   → backup  = next most defensible from the remaining qualifiers

3. Else
   → primary = token 3% settlement, no backup
```

**Why our equity report leads even when a CAD median is lower:** the CAD packet is parsed without our renovation/outlier filters. A CAD outlier could mistakenly pull the lead recommendation to an indefensible value (one real incident: $970K = 39% off a $1.59M subject, while our equity median said $1.39M = 13% off — defensible and still strong). The CAD strategies stay on the ladder as alternative angles; they just don't override our anchor by default.

---

## 6. What the recommender returns

A single object (the shape the UI is built around — design accordingly):

```js
{
  ok: boolean,                  // false if no target at all (rare — usually means engine returned nothing)
  tier: "automatic" | "potential" | "our" | "token",
  fair: boolean,                // true → "fairly assessed", no protest worth filing (see §6.1)
  target: number,               // the requested value we lead with
  notice: number,               // current assessed value (from engine)
  reduction: number,            // notice − target
  pct: number,                  // reduction as % of notice
  rationale: string,            // human sentence explaining the lead and naming the backup
  ladder: [                     // every strategy we ran, sorted: selected → backup → available → (failed/na hidden)
    { tag, name, value, reason, status }
  ],
  medianCards: [                // medians shown in the evidence section
    { label, value, source, winner: boolean }
  ],
  comps: [                      // comp table — our comps if tier=our, else CAD comps
    { addr, type, val, sqft, note? }
  ],
  taxSaved: number,             // reduction × 2.2% effective rate (display-only)
  cadMismatch: null | {         // when set: render a warning, the CAD packet was discarded
    cadAssessed, engineNotice, cadAddress
  }
}
```

### The four tiers
The `tier` field is the **type of recommendation**, not the magnitude. Design treats them as visual themes:

| Tier | When | Plain meaning |
|---|---|---|
| `automatic` | A CAD median is the primary | "The county's own evidence already says you're over-assessed — this is automatic" |
| `potential` | The 2nd-lowest CAD comp is the primary | "There's a strong single-comp anchor in the county's packet" |
| `our` | Our equity report is the primary (most common) | "We built the case ourselves from independent comps" |
| `token` | Nothing beats the notice | "No reduction case this cycle; we negotiate a 3% courtesy at the informal" |

### 6.1 The "fairly assessed" gate (`fair`)

Independent of `tier`, we set `fair: true` when there's no protest worth filing:

```
fair = tier === "token"      // nothing beats the notice at all
     || pct < 1              // best supportable reduction is under 1% of the notice
     || taxSaved < 100       // …or under ~$100/yr at the effective rate
```

(Token fabricates a nominal 3% courtesy figure, so it never trips the `pct`/`$`
tests on its own — it's caught explicitly.)

When `fair` is true the UI **does not recommend a protest**. It replaces the
recommendation hero, step-by-step protest guide, strategy comparison, and filing
export packets with a calm "Your property is fairly assessed" read and two no-cost
options: **save the report for next year**, or **request a refund now**. The
evidence section is kept (re-titled "What we checked") as proof of the analysis.

This supersedes the old token behavior, which used to push a 3% courtesy filing.

### Ladder statuses
For each strategy we ran:
- `selected` — the lead (`target`)
- `backup` — named fallback (the most-defensible qualifier other than the lead)
- `available` — also beats the notice, kept as an alternative angle
- `failed` / `na` — **hidden from the UI** (agent feedback: clutter)

---

## 7. Things the design should respect

These are constraints from real incidents, not preferences:

1. **The notice must come from the engine.** Never display a notice pulled from the CAD packet. If the packet conflicts (>25%), the UI must show the mismatch banner and run as if no packet was uploaded.
2. **The value on the screen must match the value on the PDF export.** Same calculation, same number. Both call `computeV3Strategy`.
3. **Always name the backup.** When a primary exists, the rationale and ladder must surface the defensible fallback — agents and homeowners both need to know what holds if the lead is challenged.
4. **Don't show dead-ends.** Strategies that land at or above the notice are hidden; the token row is hidden when real reductions exist.
5. **Token / trivial savings → "fairly assessed."** When nothing beats the notice (token) or the best supportable reduction is under 1% / ~$100/yr, the result is `fair: true`: we tell the homeowner they're fairly assessed and offer save-for-next-year or a refund — we do **not** push a protest (see §6.1). This replaced the old 3% courtesy-filing behavior.
6. **CAD-bound output (the document we hand the CAD)** has a separate threshold: if the supportable reduction is **< $200**, we don't send a copy-and-send request — we send a "no realistic opportunity" explainer instead. This applies to the Evidence Analyzer's county-mode export, not to the /pro recommendation UI.

---

## 8. Code pointers (for grounding)

- `pro.jsx:37–90` — `computeAdjBreakdownV3` (per-comp adjustment math)
- `pro.jsx:95–139` — `filterCompsV3` (renovation + statistical outlier filters)
- `pro.jsx:143–184` — `computeV3Strategy` (median + 3% threshold + 2nd-lowest fallback)
- `pro.jsx:189–404` — `decide` (full recommender entry point — CAD/engine mismatch check, strategy construction, selection logic, ladder, return shape)
- `test/evidence-pack-v3.html` — the consultant-style PDF export; identical V3 math
- `evidence-analyzer/results.jsx` — CAD-bound document components (county-only); the `<$200` explainer logic lives here
