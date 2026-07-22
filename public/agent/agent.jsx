/* TaxDrop — Agent Analyzer (/agent). Stripped agent tool: address + evidence
   upload -> analyze -> assessment + exports. NO customer chrome (no intake
   accordion, no 50-132 form-fill, no email/review submit).

   The logic layer below (constants, JURISDICTIONS, computeV3Strategy, decide,
   export helpers) is copied VERBATIM from public/v2/app.jsx lines 1-670 so the
   numbers are identical to the customer app. Only the App component + render at
   the bottom are agent-specific. Keep the logic block in sync with app.jsx if
   decide()/computeV3Strategy change. (2026-07-17)
*/
const { useState, useRef, useCallback, useEffect } = React;

const TAX_RATE = 2.2; // % effective; used only for the est-savings line
const TOKEN_PCT = 0.03; // 3% token settlement when nothing beats the notice
const CURRENT_TAX_YEAR = 2026;

function ensureAddressZip(addr) {
  return new Promise((resolve) => {
    const raw = String(addr || "").trim();
    if (!raw) return resolve(raw);
    if (/\b\d{5}(-\d{4})?\b/.test(raw)) return resolve(raw);
    if (!(window.google && window.google.maps && window.google.maps.Geocoder)) {
      return resolve(raw);
    }
    const gc = new window.google.maps.Geocoder();
    gc.geocode({ address: raw, componentRestrictions: { country: "us" } }, (results, status) => {
      if (status === "OK" && results && results[0] && results[0].formatted_address) {
        resolve(results[0].formatted_address);
      } else {
        resolve(raw);
      }
    });
  });
}

const fmt = (n) => (n == null || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
const signed = (n) => (n < 0 ? "−" : "+") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
const titleCase = (s) =>
  (s || "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());

const TIER_TAG = { automatic: "AUTOMATIC WIN", potential: "POTENTIAL WIN", our: "OUR EVIDENCE", token: "NO CASE" };
const TIER_NAME = { automatic: "Locked-In Reduction", potential: "Strong Case", our: "TaxDrop-Backed Case", token: "Token Settlement" };

/* ───────── V3 per-comp adjustment math (kept in sync with /pro + the v3 PDF) ───────── */
function computeAdjBreakdownV3(s, c, sizeBaselinePsf) {
  const compSqft = c.living_sqft || 0;
  const compVal = c.total_market || 0;
  const subjSqft = s.living_sqft || 0;
  const rawPsf = (compSqft > 0 && compVal > 0) ? (compVal / compSqft) : 0;
  if (!rawPsf || !compSqft || !subjSqft) {
    return { rawPsf, totalAdjPsf: 0, finalPsf: rawPsf };
  }
  let running = rawPsf;

  let sizeAdjPsf = 0;
  if (sizeBaselinePsf > 0) {
    const sizeAdjDollars = (sizeBaselinePsf / 2) * (subjSqft - compSqft);
    sizeAdjPsf = sizeAdjDollars / compSqft;
    running += sizeAdjPsf;
  } else {
    const sizeDiffPct = (compSqft - subjSqft) / subjSqft;
    const glaAdj = sizeDiffPct * 0.10;
    sizeAdjPsf = -running * glaAdj;
    running += sizeAdjPsf;
  }

  const sYear = s.effective_year_built || s.year_built || 0;
  const cYear = c.effective_year_built || c.year_built || 0;
  if (sizeBaselinePsf > 0 && sYear > 0 && cYear > 0) {
    const yearDiff = sYear - cYear;
    const ageAdjPsf = sizeBaselinePsf * 0.0035 * yearDiff;
    running += ageAdjPsf;
  } else if (sYear > 0 && cYear > 0) {
    let yearDiff = cYear - sYear;
    yearDiff = Math.max(-15, Math.min(15, yearDiff));
    const ageAdj = -yearDiff * 0.003;
    running *= (1 + ageAdj);
  }

  if (c.land_value && s.land_value && compSqft > 0) {
    const landDiffPerSqft = (c.land_value - s.land_value) / compSqft;
    const maxLandAdj = rawPsf * 0.10;
    const capped = Math.max(-maxLandAdj, Math.min(maxLandAdj, landDiffPerSqft));
    running -= capped;
  }

  const featureAdjPsf = compSqft > 0 ? (c.adjustment_total || 0) / compSqft : 0;
  running += featureAdjPsf;

  const maxSwing = rawPsf * 0.30;
  const cappedPsf = Math.max(rawPsf - maxSwing, Math.min(rawPsf + maxSwing, running));
  return { rawPsf, totalAdjPsf: cappedPsf - rawPsf, finalPsf: cappedPsf };
}

function filterCompsV3(s, comps) {
  if (!comps || !comps.length) return [];
  let out = comps.slice();

  const subjEff = s.effective_year_built || s.year_built || 0;
  if (subjEff > 0) {
    out = out.filter((c) => {
      const cEff = c.effective_year_built || c.year_built || 0;
      if (!cEff) return true;
      return (cEff - subjEff) <= 25;
    });
  }

  if (out.length >= 3) {
    const impPsfs = out
      .map((c) => (c.improvement_value && c.living_sqft) ? c.improvement_value / c.living_sqft : 0)
      .filter((v) => v > 0).sort((a, b) => a - b);
    const baseline = impPsfs.length
      ? (impPsfs.length % 2 === 1
          ? impPsfs[Math.floor(impPsfs.length / 2)]
          : (impPsfs[impPsfs.length / 2 - 1] + impPsfs[impPsfs.length / 2]) / 2)
      : 0;

    const indicated = out.map((c) => {
      const cv = c.total_market || 0;
      const cs = c.living_sqft || 0;
      if (!cv || !cs) return null;
      const b = computeAdjBreakdownV3(s, c, baseline);
      return Math.round(cv + b.totalAdjPsf * cs);
    });
    const valid = indicated.filter((v) => v != null && v > 0).sort((a, b) => a - b);
    if (valid.length >= 3) {
      const med = valid.length % 2 === 1
        ? valid[Math.floor(valid.length / 2)]
        : (valid[valid.length / 2 - 1] + valid[valid.length / 2]) / 2;
      const cutoff = med * 1.30;
      out = out.filter((c, i) => {
        const v = indicated[i];
        return v == null || v <= cutoff;
      });
    }
  }
  return out;
}

function computeV3Strategy(s, comps) {
  const filtered = filterCompsV3(s, comps);
  if (!filtered.length) return { value: null, strategy: 'no_case', median: null, secondLowest: null };

  const subjVal = s.total_market || 0;
  if (!subjVal) return { value: null, strategy: 'no_case', median: null, secondLowest: null };

  const impPsfs = filtered
    .map((c) => (c.improvement_value && c.living_sqft) ? c.improvement_value / c.living_sqft : 0)
    .filter((v) => v > 0).sort((a, b) => a - b);
  const baseline = impPsfs.length
    ? (impPsfs.length % 2 === 1
        ? impPsfs[Math.floor(impPsfs.length / 2)]
        : (impPsfs[impPsfs.length / 2 - 1] + impPsfs[impPsfs.length / 2]) / 2)
    : 0;

  const indicated = filtered
    .map((c) => {
      const cv = c.total_market || 0;
      const cs = c.living_sqft || 0;
      if (!cv || !cs) return 0;
      const b = computeAdjBreakdownV3(s, c, baseline);
      return Math.round(cv + b.totalAdjPsf * cs);
    })
    .filter((v) => v > 0).sort((a, b) => a - b);
  if (!indicated.length) return { value: null, strategy: 'no_case', median: null, secondLowest: null };

  const median = indicated.length % 2 === 1
    ? indicated[Math.floor(indicated.length / 2)]
    : Math.round((indicated[indicated.length / 2 - 1] + indicated[indicated.length / 2]) / 2);

  const below = indicated.filter((v) => v < subjVal);
  const secondLowest = below.length >= 2 ? below[1] : (below.length === 1 ? below[0] : null);

  if (median < subjVal && (subjVal - median) / subjVal >= 0.03) {
    return { value: median, strategy: 'median', median, secondLowest };
  }
  if (secondLowest != null) {
    return { value: secondLowest, strategy: 'lowest_fallback', median, secondLowest };
  }
  return { value: null, strategy: 'no_case', median, secondLowest };
}

/* Jurisdiction copy for the step-by-step guide. Texas-only today; the
   appraisal-district name comes from the engine subject when present. */
/* ───────── Jurisdiction config (Layer A of JURISDICTION-ARCHITECTURE.md) ─────────
   The agnostic shell reads terminology / forms / statutes from here instead of
   TX literals, so the UI is state-aware by architecture. TX values are IDENTICAL
   to the previous hardcodes (no behavior change for the live TX product). CA/GA/FL
   entries are readiness config — they light up the day each state's engine data
   lands (data-gated; see the design doc). Legal facts sourced from that doc. */

// TX protest deadline is May 15 every year. Once this year's window closes the
// next one is May 15 of the following year, so we roll the displayed deadline
// forward automatically instead of hardcoding a date that goes stale. NOTE: this
// only moves the DISPLAYED filing window — CURRENT_TAX_YEAR stays put so the
// stale-year engine gate isn't tripped (the roll data is still the prior year's).
function txDeadline() {
  const now = new Date();
  const may15 = new Date(now.getFullYear(), 4, 15, 23, 59, 59); // month 4 = May
  return "May 15, " + (now > may15 ? now.getFullYear() + 1 : now.getFullYear());
}

const JURISDICTIONS = {
  TX: {
    id: "TX", stateName: "Texas",
    proceeding: "protest", proceedingTitle: "Notice of Protest", fileVerb: "File",
    authorityType: "appraisal district", authoritySuffix: "CAD",
    form: "Form 50-132", deadline: txDeadline(),
    boardShort: "ARB", boardLong: "Appraisal Review Board",
    statute: "Texas Tax Code §41.43", statuteShort: "Texas §41.43",
    hasFormFill: true, // /api/generate-forms fills the 50-132
  },
  CA: {
    id: "CA", stateName: "California",
    proceeding: "appeal", proceedingTitle: "Application for Changed Assessment", fileVerb: "Request",
    authorityType: "assessor's office", authoritySuffix: "County Assessor",
    form: "BOE-305-AH", deadline: "your county's window (Jul 2–Sep 15, or Nov 30 in some counties)",
    boardShort: "AAB", boardLong: "Assessment Appeals Board",
    statute: "Cal. Rev. & Tax Code §1610.8", statuteShort: "R&T §1610.8",
    hasFormFill: false,
  },
  GA: {
    id: "GA", stateName: "Georgia",
    proceeding: "appeal", proceedingTitle: "Appeal of Assessment", fileVerb: "Request",
    authorityType: "board of tax assessors", authoritySuffix: "Board of Tax Assessors",
    form: "PT-311A", deadline: "45 days after your assessment notice date",
    boardShort: "BOE", boardLong: "Board of Equalization",
    statute: "O.C.G.A. §48-5-311", statuteShort: "O.C.G.A. §48-5-311",
    hasFormFill: false,
  },
  FL: {
    id: "FL", stateName: "Florida",
    proceeding: "petition", proceedingTitle: "Petition to the Value Adjustment Board", fileVerb: "Request",
    authorityType: "property appraiser", authoritySuffix: "Property Appraiser",
    form: "DR-486", deadline: "25 days after your TRIM notice",
    boardShort: "VAB", boardLong: "Value Adjustment Board",
    statute: "Fla. Stat. §194.011", statuteShort: "Fla. Stat. §194.011",
    hasFormFill: false,
  },
};

// Normalize whatever the adapter/token gives us to a StateId. Defaults to TX
// (the only live-data state today), so the live product is unaffected.
function resolveStateId(raw) {
  const s = String(raw || "").trim().toUpperCase();
  if (JURISDICTIONS[s]) return s;
  if (/^TEX/.test(s)) return "TX";
  if (/^CAL/.test(s)) return "CA";
  if (/^GEO/.test(s)) return "GA";
  if (/^FLO/.test(s)) return "FL";
  return "TX";
}

// Pull a StateId out of a free-text address as the user types it (e.g.
// "…, Dallas, TX 75244" → "TX"). Returns null until a state is recognizable,
// so the intake explainer can show neutral copy before committing to one.
function stateFromAddress(addr) {
  const s = String(addr || "").toUpperCase();
  const m = s.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/); // 2-letter code before ZIP
  if (m && JURISDICTIONS[m[1]]) return m[1];
  if (/\bTEXAS\b/.test(s)) return "TX";
  if (/\bCALIFORNIA\b/.test(s)) return "CA";
  if (/\bGEORGIA\b/.test(s)) return "GA";
  if (/\bFLORIDA\b/.test(s)) return "FL";
  return null;
}

// Plain-language "how to get your county evidence" copy for the intake step —
// no statute citations. Terminology is driven by the JURISDICTIONS config so
// it stays state-correct (TX protest/appraisal district, CA appeal/assessor,
// GA appeal/board of tax assessors, FL petition/property appraiser). Falls
// back to neutral wording until the typed address reveals a state.
function evidenceHowTo(stateId) {
  const cfg = stateId && JURISDICTIONS[stateId];
  if (!cfg) {
    return "After you challenge your assessment, the county office that set your value must share the evidence behind it — usually its comparable-sales data. Request it through your county's online appeals portal, or ask the assessing office in writing for the evidence tied to your property. Drop whatever they send — cover letter, comps sheet, or the full PDF — here.";
  }
  return "After you file your " + cfg.proceeding + ", your " + cfg.authorityType +
    " must share the evidence behind your value — usually its comparable-sales" +
    (stateId === "TX" ? " and equity data" : " data") +
    ". Request it through your county's online " + cfg.proceeding +
    " portal, or ask the " + cfg.authorityType +
    " in writing for the evidence tied to your account. Drop whatever they send — cover letter, comps sheet, or the full PDF — here.";
}

// Resolve the full Jurisdiction for a lookup: pick the state's config and fill
// the county-specific authority name from the engine data. `stateHint` lets
// delivered mode pass the purchase's state (from the token) even before the
// adapter stamps it on the subject.
function deriveJurisdiction(our, stateHint) {
  const subj = (our && our.subject) || {};
  const stateId = resolveStateId(stateHint || subj.us_state || subj.state || subj.site_state);
  const cfg = JURISDICTIONS[stateId] || JURISDICTIONS.TX;

  const rawCounty =
    subj.county_name || subj.appraisal_district || subj.cad_name || subj.county || "";
  let authority = "your " + cfg.authorityType;
  if (rawCounty) {
    const name = titleCase(String(rawCounty))
      .replace(/\s+County$/i, "").replace(/\s+CAD$/i, "").trim();
    if (name) {
      authority = cfg.id === "TX" ? name + " CAD" : name + " " + cfg.authoritySuffix;
    }
  }

  return {
    ...cfg,
    authority,
    disclaimer: "This analysis supports a " + cfg.statuteShort + " " + cfg.proceeding +
      " filing — it isn't a USPAP appraisal, legal, or tax advice.",
  };
}

/* ───────────────────────── decision engine (verbatim from /pro) ───────────────────────── */
function decide(cad, our, address) {
  const engineNotice = (our && our.subject && Number(our.subject.total_market)) || null;
  const cadAssessed = (cad && cad.assessed != null) ? Number(cad.assessed) : null;
  let cadMismatch = false;
  if (cad && engineNotice && cadAssessed) {
    const denom = Math.max(cadAssessed, engineNotice);
    if (denom > 0 && Math.abs(cadAssessed - engineNotice) / denom > 0.25) {
      cadMismatch = true;
    }
  }
  const effectiveCad = cadMismatch ? null : cad;
  const cadMismatchInfo = cadMismatch ? {
    cadAssessed,
    engineNotice,
    cadAddress: (cad && (cad.address || cad.subjectAddress)) || null,
  } : null;

  const subjSqft =
    (effectiveCad && effectiveCad.subjectSqft) ||
    (our && our.subject && Number(our.subject.living_sqft)) ||
    null;
  const notice = engineNotice || cadAssessed || null;

  // Year the analyzed notice value actually comes from. The engine always
  // returns the freshest row it has for a parcel (every lookup query is
  // ORDER BY tax_year DESC LIMIT 1), so when this is < CURRENT_TAX_YEAR it
  // means the county's newer roll simply isn't ingested yet — not a stale
  // duplicate. We label honestly with this year rather than the platform year.
  const dataYear = (our && our.subject && Number(our.subject.tax_year)) || null;
  const noticeYear = dataYear || CURRENT_TAX_YEAR;
  // True when this run leans on a prior-year engine row with no current-year
  // packet to anchor it (county's current roll not ingested yet). Drives a
  // soft, non-blocking nudge to upload the current notice — the analysis still
  // runs and is labeled with its actual data year.
  const priorYearOnly = !cad && dataYear != null && dataYear < CURRENT_TAX_YEAR;

  const cadMedians = [];
  if (effectiveCad) {
    if (effectiveCad.salesMedian != null) cadMedians.push({ key: "salesMedian", label: "Median market value", value: effectiveCad.salesMedian, source: "CAD sales evidence" });
    if (effectiveCad.equityMedian != null) cadMedians.push({ key: "equityMedian", label: "Median equity value", value: effectiveCad.equityMedian, source: "CAD equity evidence" });
    if (!cadMedians.length && effectiveCad.weightedMedian != null) cadMedians.push({ key: "median", label: "Median of comparables", value: effectiveCad.weightedMedian, source: "CAD evidence" });
  }

  const secondLowest = effectiveCad && effectiveCad.secondLowest ? effectiveCad.secondLowest : null;

  let ourMedian = null;
  let ourSecondLowest = null;
  if (our && our.subject && Array.isArray(our.comps)) {
    const v3 = computeV3Strategy(our.subject, our.comps);
    ourMedian = v3.value;
    ourSecondLowest = v3.secondLowest;
  }

  const tokenValue = notice != null ? Math.round(notice * (1 - TOKEN_PCT)) : null;

  const strategies = [];
  cadMedians.forEach((m) => strategies.push({
    key: m.key, mkey: m.key, tier: "automatic", defRank: 0, kind: "median",
    name: m.label, value: m.value,
  }));
  if (secondLowest != null) strategies.push({
    key: "second", tier: "potential", defRank: 1, kind: "comp",
    name: "Second-lowest comparable", value: secondLowest.value,
  });
  if (ourMedian != null) strategies.push({
    key: "ourReport", mkey: "ourReport", tier: "our", defRank: 2, kind: "median",
    name: "TaxDrop equity comps", value: ourMedian,
  });

  const real = strategies.filter((s) => notice != null && s.value != null && s.value < notice);
  let primary, backup = null;
  const ourStrategy = real.find((s) => s.key === "ourReport");
  if (ourStrategy) {
    primary = ourStrategy;
    const cadReal = real.filter((s) => s.tier !== "our");
    if (cadReal.length) {
      backup = [...cadReal].sort((a, b) => a.defRank - b.defRank || a.value - b.value)[0];
    }
  } else if (real.length) {
    primary = [...real].sort((a, b) => a.defRank - b.defRank || a.value - b.value)[0];
    const others = real.filter((s) => s.key !== primary.key);
    if (others.length) backup = [...others].sort((a, b) => a.defRank - b.defRank || a.value - b.value)[0];
  } else {
    primary = { key: "token", tier: "token", defRank: 3, kind: "token", name: TIER_NAME.token, value: tokenValue };
  }

  const tier = primary.tier;
  const target = primary.value;
  const reduction = notice != null && target != null ? notice - target : 0;
  const pct = notice ? (reduction / notice) * 100 : 0;
  const taxSaved = reduction * (TAX_RATE / 100);
  // "Fairly assessed" gate. We don't push a protest when there's nothing real to
  // win: either no indicator beats the notice (token), or the best supportable
  // reduction is too small to be worth filing — under 1% of the notice OR under
  // ~$100/yr. (Token fabricates a nominal 3% courtesy number, so it never trips
  // the pct/$ tests on its own — catch it explicitly.) In all these cases we tell
  // the homeowner they're fairly assessed and offer save-for-next-year / refund.
  const fair = tier === "token" || pct < 1 || taxSaved < 100;
  const backupInfo = backup ? { key: backup.key, name: backup.name, value: backup.value, kind: backup.kind, tier: backup.tier, defRank: backup.defRank } : null;

  const backupLine = backup
    ? " Your most defensible fallback, the " + backup.name.toLowerCase() + " at " + fmt(backup.value) +
      ", stays ready in case the lead is challenged."
    : "";
  const rationale = {
    automatic:
      "Our highest-savings play here is the county's own " + primary.name.toLowerCase().replace("median ", "") +
      " at " + fmt(target) + " — " + fmt(reduction) + " under your notice. Texas §41.43 lets us take the lower of the county's indicators, so this one is automatic: present the packet and take the lower number." + backupLine,
    potential:
      "Our highest-savings play is the second-lowest comparable at " + fmt(target) + " — " + fmt(reduction) +
      " under your notice" + (secondLowest && secondLowest.shortAddr ? " (anchored to " + secondLowest.shortAddr + ")" : "") +
      ". We request that value directly." + backupLine,
    our:
      "Our highest-savings play is TaxDrop's independent equity comps at " + fmt(target) + " — " + fmt(reduction) +
      " under your notice, and the evidence we build the protest around." + backupLine,
    token:
      "No strategy in the set beats your notice this cycle — every indicator lands above it. We pursue a token " +
      Math.round(TOKEN_PCT * 100) + "% courtesy reduction at the informal hearing: modest relief now, with the full case rebuilt next year.",
  }[tier];

  // When the property is fairly assessed, the protest rationale is replaced with a
  // straight, reassuring read — no filing recommended this year.
  const fairRationale = tier === "token"
    ? "Good news — your property is fairly assessed. We tested every angle — the county's own indicators, the strongest backup comp, and our independent equity report — and none lands below your " + noticeYear + " notice of " + fmt(notice) + ". There's no protest worth filing this year. Save your report and we'll re-check automatically next season, when the roll resets."
    : "Good news — your property looks fairly assessed. The most we could support is " + fmt(target) + " — a reduction of just " + fmt(reduction) + " (about " + fmt(taxSaved) + "/yr). That's below the threshold where a protest is worth the time and risk, so we don't recommend filing this " + CURRENT_TAX_YEAR + " season.";

  const tokenRow = { key: "token", tier: "token", defRank: 3, kind: "token", name: TIER_NAME.token, value: tokenValue };
  const allRows = [...strategies, tokenRow];
  const statusOf = (s) => {
    if (s.key === primary.key) return "selected";
    if (backup && s.key === backup.key) return "backup";
    if (s.kind === "token") return primary.key === "token" ? "selected" : "na";
    return notice != null && s.value != null && s.value < notice ? "available" : "failed";
  };
  const reasonOf = (s, status) => {
    if (status === "selected" && s.kind === "token")
      return "No indicator beats your notice — we negotiate a " + Math.round(TOKEN_PCT * 100) + "% courtesy settlement at the informal.";
    if (status === "selected")
      return "The largest reduction the evidence supports — " + fmt(reduction) + " off your notice. We control these comps end-to-end, filtered for outliers, so they hold up under scrutiny.";
    if (status === "backup")
      return "Pulled straight from the county's own packet — the most credible single-comp anchor. Saves less, but the hardest number for the appraiser to dismiss. Hold it in reserve.";
    if (status === "available")
      return "Also below your notice (" + fmt(s.value) + ") — kept as an alternative angle.";
    if (status === "na")
      return "Skipped — real, evidence-backed reductions are on the table.";
    return s.name + " lands at " + fmt(s.value) + ", above your notice — no reduction here.";
  };
  const sortRank = { selected: 0, backup: 1, available: 2, failed: 3, na: 4 };
  const VISIBLE_STATUSES = new Set(["selected", "backup", "available"]);
  const ladder = allRows
    .map((s) => {
      const status = statusOf(s);
      return { key: s.key, tier: s.tier, defRank: s.defRank, kind: s.kind, tag: TIER_TAG[s.tier], name: s.name, value: s.value, reason: reasonOf(s, status), status, _v: s.value == null ? Infinity : s.value };
    })
    .filter((row) => VISIBLE_STATUSES.has(row.status) || row.status === "selected")
    .sort((a, b) => (sortRank[a.status] - sortRank[b.status]) || (a._v - b._v));

  const medianCards = cadMedians.slice();
  if (ourMedian != null) medianCards.push({ key: "ourReport", label: "TaxDrop equity report", value: ourMedian, source: "Generated comp set · outlier-filtered" });
  const winnerKey = primary.kind === "median" ? primary.mkey : null;
  medianCards.forEach((m) => { m.winner = m.key === winnerKey; });

  let rawComps = [];
  if (tier === "our" && our && Array.isArray(our.comps)) {
    rawComps = our.comps.slice(0, 6).map((c) => ({
      addr: titleCase(c.site_address || c.full_address || ""),
      type: "Equity (TaxDrop)",
      val: Number(c.total_market) || null,
      sqft: Number(c.living_sqft) || subjSqft,
    }));
  } else if (effectiveCad && Array.isArray(effectiveCad.sortedAsc)) {
    rawComps = effectiveCad.sortedAsc.slice(0, 8).map((c) => ({
      addr: c.shortAddr || c.address || c.id,
      type: c.salePrice != null ? "Sale (market)" : "Equity (assessed)",
      val: c.value,
      sqft: c.sqft || subjSqft,
      note: secondLowest && c.id === secondLowest.id && tier === "potential" ? "2nd-lowest — anchor" : "",
    }));
  }

  return {
    ok: target != null,
    tier, target, notice, reduction, pct, subjSqft, fair, dataYear, priorYearOnly,
    address, rationale: fair ? fairRationale : rationale,
    ladder, medianCards, comps: rawComps,
    taxSaved,
    cadMismatch: cadMismatchInfo,
    backupInfo,
    jurisdiction: deriveJurisdiction(our),
    // Subject passthrough for the redesigned report chrome (parcel, year built,
    // land/improvement, county) — read defensively; may be null for CAD-only runs.
    subject: (our && our.subject) ? our.subject : null,
    dataQuality: effectiveCad ? effectiveCad.dataQuality || null : null,
  };
}


/* ───────────────────────── file upload constants ───────────────────────── */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXT = /\.(pdf|xlsx|xlsm|xls|xlsb|csv|tsv)$/i;
const isSupportedFile = (f) =>
  SUPPORTED_EXT.test(f.name || "")
  || /pdf$/i.test(f.type || "")
  || /sheet|excel|spreadsheetml/i.test(f.type || "")
  || /csv$/i.test(f.type || "");


/* ═══════════════════════════ Agent tool (agent-specific UI) ═══════════════════════════
   Everything above is the shared logic layer copied from app.jsx. Below is the
   stripped agent surface: one screen, analyze + assessment + the four exports. */
const HANDOFF_KEY = "taxdrop-analyzer-handoff";
const C = { ink: "#16241c", sub: "#5d6f64", line: "#e2e8e2", bg: "#eef2ef", green: "#1d6b41", greenDeep: "#15512e", gold: "#8a6311" };

function StatTile({ label, value, accent, sub }) {
  return (
    <div style={{ background: "#fff", border: "1px solid " + C.line, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: C.sub, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: accent || C.ink, lineHeight: 1.1 }}>{value}</div>
      {sub ? <div style={{ fontSize: 12, color: C.sub, marginTop: 3 }}>{sub}</div> : null}
    </div>
  );
}

function AgentApp() {
  const [address, setAddress] = useState("");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | analyzing | done | error
  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [cadRaw, setCadRaw] = useState(null);
  const [cadMethod, setCadMethod] = useState("");
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");
  const [toast, setToast] = useState("");
  const fileRef = useRef(null);
  const addrRef = useRef(null);

  // Google Places autocomplete on the address field. Re-runs when the form
  // re-mounts (status → idle after "New analysis"), but tags the input node so
  // the same field is never wired twice — otherwise each analyze cycle attaches
  // a duplicate Autocomplete + leaks a .pac-container onto <body>.
  useEffect(() => {
    let cancelled = false, tries = 0, timer = null;
    const wire = () => {
      if (cancelled) return;
      const el = addrRef.current;
      if (!(window.google && window.google.maps && window.google.maps.places && el)) {
        if (tries++ < 60) timer = setTimeout(wire, 200);
        return;
      }
      if (el._acWired) return; // this input node already has an Autocomplete
      el._acWired = true;
      const ac = new window.google.maps.places.Autocomplete(el, { types: ["address"], componentRestrictions: { country: "us" }, fields: ["formatted_address"] });
      ac.addListener("place_changed", () => { const p = ac.getPlace(); if (p && p.formatted_address) setAddress(p.formatted_address); });
    };
    wire();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [status]);

  const pickFiles = (incoming) => {
    const list = Array.from(incoming || []).filter(Boolean);
    if (!list.length) return;
    const tooBig = list.filter((f) => f.size > MAX_FILE_BYTES);
    const unsupported = list.filter((f) => !isSupportedFile(f) && !tooBig.includes(f));
    const accepted = list.filter((f) => isSupportedFile(f) && f.size <= MAX_FILE_BYTES);
    const errors = [];
    if (tooBig.length) errors.push(tooBig.length === 1 ? `${tooBig[0].name} is ${(tooBig[0].size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB per file.` : `${tooBig.length} files are over the 10 MB per-file limit.`);
    if (unsupported.length) errors.push(`Unsupported file type: ${unsupported.map((f) => f.name).slice(0, 2).join(", ")}${unsupported.length > 2 ? "…" : ""}. Use PDF, Excel (.xlsx), or CSV.`);
    if (!accepted.length) { setError(errors.join(" ") || "No usable files in that drop."); return; }
    setError(errors.length ? errors.join(" ") : "");
    setFiles((prev) => {
      const byKey = new Map(prev.map((f) => [f.name + ":" + f.size, f]));
      accepted.forEach((f) => byKey.set(f.name + ":" + f.size, f));
      return Array.from(byKey.values());
    });
  };
  const onDrop = (e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files && e.dataTransfer.files.length) pickFiles(e.dataTransfer.files); };
  const clearFile = (e, idx) => { e && e.stopPropagation(); if (typeof idx === "number") setFiles((prev) => prev.filter((_, i) => i !== idx)); else setFiles([]); };

  const canAnalyze = !!address.trim() && status !== "analyzing";

  // Analysis pipeline: extract CAD -> engine lookup -> decide. Copied from the
  // customer computeDraft, minus the review/blob branches. Agents carry a sup
  // cookie, so cad-proxy authorizes the engine lookup with no token/entitlement.
  const computeDraft = useCallback(async (onStep) => {
    const stepFn = onStep || (() => {});
    let cad = null, cadRawLocal = null, cadMethodLocal = "";
    if (files.length) {
      try {
        const ext = await window.Extractor.extractFromFiles(files);
        if (ext && ext.ok) { cad = window.Analyzer.analyze(ext.data); cadRawLocal = ext.data; cadMethodLocal = ext.method || ""; }
      } catch (e) { /* CAD parse failed — fall through with cad=null */ }
    }
    stepFn(1);
    let our = null, engineStale = false;
    let lookupAddr = address.trim();
    try {
      lookupAddr = await ensureAddressZip(address.trim());
      const resp = await fetch("/api/cad-proxy?path=/api/evidence-pack/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: lookupAddr }) });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.subject) { const ty = Number(data.subject.tax_year); engineStale = !!(ty && ty < CURRENT_TAX_YEAR); our = data; }
      } else if (resp.status === 402 || resp.status === 403) {
        // Sup cookie should authorize this; a gate rejection means the agent isn't
        // logged in (or the cookie lapsed). Surface it instead of silently dropping comps.
        return { ok: false, error: "Engine lookup was blocked (" + resp.status + "). Your agent session may have expired — reload /agent and log in again." };
      }
    } catch (e) { /* lookup failed — fall through with our=null */ }
    if (engineStale && cad) our = null;
    stepFn(2);
    if (!cad && !our) return { ok: false, error: "Couldn't read the evidence or find this property. Check the address and that the PDF is the county's evidence packet (not a scan)." };
    const r = decide(cad, our, address.trim());
    stepFn(3);
    if (!r.ok || r.notice == null) return { ok: false, error: "Read the evidence but couldn't determine a noticed value. Try the standalone Evidence Analyzer for a manual review." };
    return { ok: true, r, cad, our, cadRaw: cadRawLocal, cadMethod: cadMethodLocal, lookupAddr };
  }, [address, files]);

  const analyze = useCallback(async () => {
    if (!address.trim()) return;
    setStatus("analyzing"); setStep(0); setError("");
    try {
      const d = await computeDraft(setStep);
      if (!d.ok) { setError(d.error); setStatus("error"); return; }
      await new Promise((res) => setTimeout(res, 250));
      setResult(d.r); setCadRaw(d.cadRaw); setCadMethod(d.cadMethod); setStatus("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setError("Something went wrong analyzing this property. Please try again."); setStatus("error"); }
  }, [address, computeDraft]);

  const reset = () => { setStatus("idle"); setStep(0); setResult(null); setError(""); setCadRaw(null); setCadMethod(""); setFiles([]); setAddress(""); setExporting(""); };
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  const hasCad = !!cadRaw && !cadRaw.demo;

  // Exports — identical plumbing/URLs to the customer app's triggerExport, minus
  // the "stored/approved report" branch (agents always export from the address).
  const triggerExport = (which, format) => {
    if (exporting) return;
    setExporting(which + ":" + format);
    const addr = encodeURIComponent((address || "").trim());
    let url = "";
    if (which === "our") {
      url = "/test/evidence-pack-v3?address=" + addr + "&export=" + format;
    } else if (which === "cad" || which === "cad-county") {
      if (!hasCad) { setExporting(""); showToast("Upload the county's evidence packet to export the analyzer pack."); return; }
      try { localStorage.setItem(HANDOFF_KEY, JSON.stringify({ ts: Date.now(), data: cadRaw, method: cadMethod || "ai" })); } catch (_) {}
      url = "/evidence-analyzer?export=" + format + "&handoff=" + (which === "cad-county" ? "county" : "full");
    }
    const w = window.open(url, "taxdrop-export-" + Date.now(), "width=1024,height=900,scrollbars=yes,resizable=yes");
    if (!w) { setExporting(""); showToast("Pop-up blocked — allow pop-ups so the file can open."); return; }
    const safety = format === "pdf" ? 60000 : 30000;
    const tick = setInterval(() => { if (w.closed) { clearInterval(tick); setExporting(""); } }, 500);
    setTimeout(() => { clearInterval(tick); setExporting(""); }, safety);
  };
  const countyAttach = () => triggerExport(hasCad ? "cad-county" : "our", "pdf");
  const busy = (id) => exporting === id;

  // Open the evidence packet in the pack's WYSIWYG edit mode (new tab). Unlike
  // triggerExport there is no export= param, so the pack lands in the editor
  // instead of auto-exporting; the agent edits, then exports from that tab.
  // Ephemeral — no persistence (the /agent tool has no stored review row).
  const openEditor = () => {
    const addr = (address || "").trim();
    if (!addr) { showToast("Enter an address and analyze it first."); return; }
    const url = "/test/evidence-pack-v3?address=" + encodeURIComponent(addr) + "&edit=1";
    const w = window.open(url, "taxdrop-edit-" + Date.now(), "width=1100,height=900,scrollbars=yes,resizable=yes");
    if (!w) { showToast("Pop-up blocked — allow pop-ups so the editor can open."); return; }
  };

  const r = result;
  const analyzing = status === "analyzing";
  const stepLabels = ["Reading the county evidence packet", "Extracting sales & equity comparables", "Running the full strategy set", "Selecting the highest-savings value"];
  const dropStyle = { cursor: "pointer", textAlign: "center", border: "1.5px dashed " + (dragging ? C.green : "#cdd9cd"), background: dragging ? "#eef7f1" : "#f7faf7", borderRadius: 12, padding: "28px 20px", transition: "all .15s" };
  const btnGreen = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "linear-gradient(135deg,#27764a,#15512e)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" };
  const btnGhost = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff", color: C.greenDeep, border: "1px solid #cdd9cd", borderRadius: 10, padding: "11px 16px", fontSize: 14.5, fontWeight: 700, cursor: "pointer" };

  const sel = r ? (r.ladder || []).find((x) => x.status === "selected") : null;
  const subj = r && r.subject ? r.subject : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* top bar */}
      <div style={{ background: "#16241c", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 800, letterSpacing: "-.01em" }}>TaxDrop</span>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#111", background: "#C4FF64", borderRadius: 4, padding: "3px 8px" }}>Agent Analyzer</span>
        </div>
        {r ? <button onClick={reset} style={{ background: "transparent", color: "#cfe6d8", border: "1px solid #3a5145", borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>New analysis</button> : null}
      </div>

      <main style={{ width: "100%", maxWidth: 960, margin: "0 auto", padding: "24px 18px 72px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 18 }}>
        {!r ? (
          <React.Fragment>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", margin: "4px 0 6px" }}>Analyze a property</h1>
              <p style={{ margin: 0, color: C.sub, fontSize: 15.5 }}>Enter the address and drop the county evidence packet. You'll get the assessment and every export — no intake steps, no forms.</p>
            </div>
            <div style={{ background: "#fff", border: "1px solid " + C.line, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 6 }}>Property address</label>
                <input ref={addrRef} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state ZIP" spellCheck="false"
                  style={{ width: "100%", fontSize: 15.5, padding: "12px 14px", border: "1px solid #cdd9cd", borderRadius: 10, outline: "none", fontFamily: "inherit" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 6 }}>County evidence (PDF, Excel, or CSV)</label>
                <div onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setDragging(false); }} onDrop={onDrop} onClick={() => fileRef.current && fileRef.current.click()} style={dropStyle}>
                  <input type="file" multiple ref={fileRef} onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: C.greenDeep }}>Drop files or click to upload</div>
                  <div style={{ fontSize: 12.5, color: C.sub, marginTop: 4 }}>Optional — an address alone runs on the engine's own comps.</div>
                </div>
                {files.length ? (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {files.map((f, idx) => (
                      <div key={f.name + ":" + f.size} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f2f6f2", border: "1px solid " + C.line, borderRadius: 8, padding: "8px 12px" }}>
                        <span style={{ fontSize: 13.5, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name} <span style={{ color: C.sub }}>· {(f.size / 1024 / 1024).toFixed(1)} MB</span></span>
                        <button onClick={(e) => clearFile(e, idx)} style={{ background: "none", border: "none", color: "#7c8a80", fontSize: 18, cursor: "pointer", padding: "0 6px" }} aria-label="Remove">×</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              {error ? <div style={{ background: "#fdecec", border: "1px solid #f3c0c0", color: "#8a2222", borderRadius: 8, padding: "10px 14px", fontSize: 13.5 }}>{error}</div> : null}
              <button onClick={analyze} disabled={!canAnalyze} style={{ ...btnGreen, padding: 15, fontSize: 16, marginTop: 2, cursor: canAnalyze ? "pointer" : "not-allowed", background: canAnalyze ? btnGreen.background : "#b9cabf" }}>
                {analyzing ? <React.Fragment><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,.5)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />{stepLabels[step] || "Analyzing…"}</React.Fragment> : "Analyze"}
              </button>
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            {/* subject / address */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.01em", margin: 0 }}>{titleCase(r.address || address)}</h1>
              {subj ? <span style={{ fontSize: 13, color: C.sub }}>{[subj.county ? titleCase(String(subj.county)) + " County" : null, subj.parcel_id ? "Parcel " + subj.parcel_id : null, subj.tax_year ? "TY " + subj.tax_year : ("TY " + (r.dataYear || CURRENT_TAX_YEAR))].filter(Boolean).join(" · ")}</span> : null}
            </div>

            {/* mismatch — surfaced, not hidden */}
            {r.cadMismatch ? (
              <div style={{ background: "#FFF7E6", border: "1px solid #F3C97D", borderLeft: "4px solid #D68A14", borderRadius: 10, padding: "12px 16px", color: "#5A3E0A", fontSize: 13.5, lineHeight: 1.5 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>⚠ Packet vs. record mismatch</div>
                Uploaded packet shows <b>{fmt(r.cadMismatch.cadAssessed)}</b>; the engine record for this address shows <b>{fmt(r.cadMismatch.engineNotice)}</b> (&gt;25% apart). The strategies below run on the engine record — <b>review the packet before relying on them.</b>
              </div>
            ) : null}
            {r.priorYearOnly ? (
              <div style={{ background: "#eef4ff", border: "1px solid #bcd0f3", borderLeft: "4px solid #3b6fd6", borderRadius: 10, padding: "12px 16px", color: "#22355e", fontSize: 13.5, lineHeight: 1.5 }}>
                Engine data is from <b>{r.dataYear}</b> — the county's {CURRENT_TAX_YEAR} roll isn't ingested yet. Upload the current-year packet for a {CURRENT_TAX_YEAR} read.
              </div>
            ) : null}
            {r.dataQuality ? (
              <div style={{ background: "#fdf6ec", border: "1px solid #ecd9b0", borderRadius: 10, padding: "11px 15px", color: "#6a4f16", fontSize: 13 }}>{r.dataQuality}</div>
            ) : null}

            {/* recommendation banner */}
            <div style={{ background: "#111", color: "#fff", borderRadius: 12, padding: "18px 22px" }}>
              <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#111", background: r.tier === "our" ? "#f3e6c4" : r.tier === "token" ? "#d3ddd7" : "#C4FF64", borderRadius: 4, padding: "3px 8px", marginBottom: 10 }}>{TIER_TAG[r.tier]}{sel ? " · " + sel.name : ""}</span>
              <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, fontWeight: 500 }}>{r.rationale}</p>
            </div>

            {/* stat tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <StatTile label="Noticed value" value={fmt(r.notice)} sub={"TY " + (r.dataYear || CURRENT_TAX_YEAR)} />
              <StatTile label="Recommended" value={fmt(r.target)} accent={r.tier === "our" ? C.gold : C.green} />
              <StatTile label="Reduction" value={r.reduction > 0 ? signed(-r.reduction) : "—"} accent={r.reduction > 0 ? C.green : C.sub} sub={r.reduction > 0 ? Math.round(r.pct * 10) / 10 + "% under notice" : "at/above notice"} />
              <StatTile label="Est. tax saved / yr" value={r.taxSaved > 0 ? fmt(r.taxSaved) : "—"} sub={"@ " + TAX_RATE + "% eff."} />
            </div>
            {r.fair ? <div style={{ background: "#eef4ef", border: "1px solid #cfe0d3", borderRadius: 10, padding: "11px 15px", color: "#2c5540", fontSize: 13.5 }}>Fairly assessed — no {(r.jurisdiction && r.jurisdiction.proceeding) || "protest"} worth filing recommended this cycle.</div> : null}

            {/* strategy ladder */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: C.sub, margin: "4px 0 8px" }}>Strategy set</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(r.ladder || []).map((row) => (
                  <div key={row.key} style={{ background: "#fff", border: "1px solid " + (row.status === "selected" ? "#bfe0cd" : C.line), borderLeft: "4px solid " + (row.status === "selected" ? C.green : row.status === "backup" ? "#b1851a" : "#cdd9cd"), borderRadius: 10, padding: "12px 15px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 14.5 }}>{row.name}</span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: row.status === "selected" ? C.green : C.ink }}>{fmt(row.value)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: C.sub }}>{row.status === "selected" ? "SELECTED" : row.status === "backup" ? "BACKUP" : "ALTERNATIVE"}</span>
                      <span style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.45 }}>{row.reason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* medians */}
            {(r.medianCards && r.medianCards.length) ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                {r.medianCards.map((m) => (
                  <div key={m.key} style={{ background: m.winner ? "#fdf9ef" : "#fff", border: "1px solid " + (m.winner ? "#e6cf94" : C.line), borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 4 }}>{m.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: m.winner ? C.gold : C.ink }}>{fmt(m.value)}</div>
                    <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3 }}>{m.source}</div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* comps */}
            {(r.comps && r.comps.length) ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: C.sub, margin: "4px 0 8px" }}>Comparables</div>
                <div style={{ overflowX: "auto", border: "1px solid " + C.line, borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, background: "#fff", minWidth: 480 }}>
                    <thead><tr style={{ background: "#f2f6f2", textAlign: "left" }}>
                      <th style={{ padding: "9px 12px", fontWeight: 700 }}>Address</th>
                      <th style={{ padding: "9px 12px", fontWeight: 700 }}>Type</th>
                      <th style={{ padding: "9px 12px", fontWeight: 700, textAlign: "right" }}>Value</th>
                      <th style={{ padding: "9px 12px", fontWeight: 700, textAlign: "right" }}>Sq ft</th>
                      <th style={{ padding: "9px 12px", fontWeight: 700, textAlign: "right" }}>$/sqft</th>
                    </tr></thead>
                    <tbody>
                      {r.comps.map((c, i) => (
                        <tr key={i} style={{ borderTop: "1px solid " + C.line }}>
                          <td style={{ padding: "9px 12px" }}>{titleCase(c.addr || "")}{c.note ? <span style={{ color: C.green, fontWeight: 700 }}> · {c.note}</span> : ""}</td>
                          <td style={{ padding: "9px 12px", color: C.sub }}>{c.type}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>{fmt(c.val)}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right" }}>{c.sqft ? Math.round(c.sqft).toLocaleString("en-US") : "—"}</td>
                          <td style={{ padding: "9px 12px", textAlign: "right" }}>{c.val && c.sqft ? "$" + Math.round(c.val / c.sqft) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* exports */}
            <div style={{ background: "#fff", border: "1px solid " + C.line, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: C.sub, marginBottom: 12 }}>Create the assessment</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                <button onClick={() => triggerExport("our", "pdf")} disabled={!!exporting} style={btnGreen}>{busy("our:pdf") ? "Generating…" : "Evidence packet (PDF)"}</button>
                <button onClick={() => triggerExport("our", "docx")} disabled={!!exporting} style={btnGhost}>{busy("our:docx") ? "Generating…" : "Evidence packet (DOCX)"}</button>
                <button onClick={openEditor} disabled={!!exporting} style={btnGhost}>✎ Customize &amp; export</button>
                <button onClick={() => triggerExport("cad", "pdf")} disabled={!!exporting || !hasCad} style={{ ...btnGhost, opacity: hasCad ? 1 : 0.5 }}>{busy("cad:pdf") ? "Generating…" : "CAD Analyzer Pack"}</button>
                <button onClick={countyAttach} disabled={!!exporting} style={btnGhost}>{busy("cad-county:pdf") || busy("our:pdf") ? "Generating…" : "County-facing attachment"}</button>
              </div>
              {!hasCad ? <div style={{ fontSize: 12, color: C.sub, marginTop: 10 }}>Upload the county's evidence packet to enable the CAD Analyzer Pack and the county-facing attachment from the packet's own comps.</div> : null}
            </div>
          </React.Fragment>
        )}
      </main>
      {toast ? <div style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", background: "#111", color: "#fff", fontSize: 14, padding: "11px 18px", borderRadius: 8, zIndex: 50 }}>{toast}</div> : null}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AgentApp />);
