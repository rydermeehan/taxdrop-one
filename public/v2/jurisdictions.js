/* TaxDrop One — jurisdiction config (the "seam" from JURISDICTION-ARCHITECTURE.md).
 *
 * Standalone, ready-to-wire. NOT yet consumed by app.jsx — wiring is Phase 0
 * (have deriveJurisdiction() read from here; zero behavior change for TX). Kept
 * separate so the live tool stays untouched while GA gets prepped in parallel
 * with the GA/FL data ingest.
 *
 * To wire later:
 *   1. <script src="jurisdictions.js"></script> BEFORE app.jsx in index.html
 *   2. resolve by state (from the address) → window.TAXDROP_JURISDICTIONS[id]
 *   3. feed terminology/filing/capRule/strategyModules into the UI + engine call
 *
 * Shapes match JURISDICTION-ARCHITECTURE.md §3. ⚠ = verify annually / per county.
 */
(function () {
  // DeadlineRule resolves against the subject's notice_date at render time.
  const fixedDate = (monthDay) => ({ type: "fixedDate", monthDay });               // TX: "05-15"
  const daysAfterNotice = (days) => ({ type: "daysAfterNotice", days });           // GA: 45
  const windowRule = (open, close, perCounty) => ({ type: "window", openMonthDay: open, closeMonthDay: close, perCounty: !!perCounty });

  const JURISDICTIONS = {
    /* ───────────────────────── TEXAS (live reference) ───────────────────────── */
    TX: {
      id: "TX",
      stateName: "Texas",
      status: "live",                       // data + engine both live
      terminology: {
        proceeding: "protest",
        proceedingTitle: "Notice of Protest",
        authorityTemplate: "{county} CAD",  // e.g. "Dallas CAD"
        reviewBodyShort: "ARB",
        reviewBodyLong: "Appraisal Review Board",
        fileVerb: "File this value",
      },
      filing: {
        form: "Form 50-132",
        deadline: fixedDate("05-15"),       // or 30 days after notice delivered, whichever later
        statute: "Texas Tax Code §41.43",
        statuteShort: "Texas §41.43",
        correctionPath: "Texas Tax Code §25.25 (clerical / sqft corrections — longer window)",
      },
      // Taxes are billed on the capped (appraised) value, not market. The savings
      // line MUST use the taxable delta, not the market delta. (See capped-value
      // correctness item.)
      capRule: {
        type: "tx_homestead_10",
        marketField: "total_market",
        taxableField: "total_appraised",
        ratio: null,                        // TX is a 10%/yr cap, not a fixed ratio
        note: "Homestead value capped at 10%/yr (§23.23). If the target stays above the capped value, the protest yields no tax change this year.",
      },
      assessmentRatio: 1.0,                  // TX assesses at 100% of market
      exemptionRules: [
        { id: "tx_homestead", label: "General Residence Homestead", detectField: "is_homestead" },
        { id: "tx_over65", label: "Age 65 or Older", quiz: true },
        { id: "tx_disabled", label: "Disabled Person", quiz: true },
        { id: "tx_disabled_vet", label: "Disabled Veteran (§11.22 / §11.131 / §11.132)", quiz: true },
        { id: "tx_surviving_spouse", label: "Surviving Spouse (veteran / first responder)", quiz: true },
      ],
      strategyModules: ["cad_medians", "second_lowest_comp", "tx_equity_v3", "token"],
      dataSource: { id: "properties", status: "live", note: "TX CAD ingests in the `properties` table." },
      disclaimer: "This analysis supports a Texas §41.43 protest filing — it isn't a USPAP appraisal, legal, or tax advice.",
    },

    /* ───────────────────────── GEORGIA (prep — data not yet in prod) ─────────────────────────
       Built from the engine probe + O.C.G.A. The TX equity engine ports because
       GA "uniformity" (§48-5-311) ≈ the §41.43 equity argument. GA assesses at
       EXACTLY 40% of FMV (assessed_value = 0.40 × total_market). */
    GA: {
      id: "GA",
      stateName: "Georgia",
      status: "planned",                    // ⚠ data NOT loaded in prod `properties` yet (Fulton db_in_database:false on 2026-06-24)
      terminology: {
        proceeding: "appeal",
        proceedingTitle: "Property Tax Return / Appeal of Assessment",
        authorityTemplate: "{county} County Board of Tax Assessors",
        reviewBodyShort: "BOE",
        reviewBodyLong: "Board of Equalization",   // alt routes: arbitration, or hearing officer (non-homestead > $500k)
        fileVerb: "Request this value",
      },
      filing: {
        form: "PT-311A",
        deadline: daysAfterNotice(45),       // 45 days from the Annual Notice of Assessment date (notice date varies by county)
        statute: "O.C.G.A. §48-5-311",
        statuteShort: "O.C.G.A. §48-5-311",
        correctionPath: null,
        notable: "A successful appeal freezes the new value for ~2 additional years (3 total) under the 299(c) value freeze.",
      },
      // GA taxes on the 40% assessed value. ⚠ HB 581 (2025) added a statewide
      // floating homestead exemption capping homestead value growth to CPI —
      // but counties could OPT OUT by 2025-03-01, so verify per county.
      capRule: {
        type: "ga_floating_homestead",
        marketField: "total_market",
        taxableField: "assessed_value",      // = 0.40 × total_market
        ratio: 0.40,
        note: "GA assessed value is 40% of FMV; taxes bill on that. HB 581 floating homestead cap applies unless the county opted out (⚠ verify per county).",
      },
      assessmentRatio: 0.40,
      exemptionRules: [
        { id: "ga_homestead", label: "Standard Homestead", detectField: "is_homestead" /* ⚠ engine returns null for GA today */ },
        { id: "ga_floating_hs", label: "Statewide Floating Homestead (HB 581)", quiz: true, note: "⚠ county opt-out possible" },
        { id: "ga_senior_school", label: "Senior / School exemptions", quiz: true, note: "Highly county-variable" },
        { id: "ga_disabled_vet", label: "Disabled Veteran", quiz: true },
      ],
      // Uniformity reuses the TX equity engine on GA assessed/market comps; a
      // sales-comp module is a later add. No CAD-median/second-lowest (those are
      // TX-CAD-packet constructs).
      strategyModules: ["ga_uniformity", "token"],   // ga_uniformity ≈ tx_equity_v3 applied to GA comps
      dataSource: {
        id: "properties",
        status: "planned",
        note: "GA adapters (ingest/ga/{fulton,gwinnett,chatham,dekalb}) write to `properties` with source_state='GA', but NOT yet loaded in prod. DeKalb is values-only (no situs) → not address-matchable; Sacramento-style identity-only sources can't value. Fulton/Chatham are the viable starters.",
      },
      disclaimer: "This analysis supports a Georgia §48-5-311 assessment appeal — it isn't a USPAP appraisal, legal, or tax advice.",
    },
  };

  // Expose for the (future) wiring step without disturbing the current app.
  if (typeof window !== "undefined") window.TAXDROP_JURISDICTIONS = JURISDICTIONS;
  if (typeof module !== "undefined" && module.exports) module.exports = JURISDICTIONS;
})();
