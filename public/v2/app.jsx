/* TaxDrop One — v2 preview (Strategy Recommender design, Claude Design import 2026-06-23).
   A redesigned skin for BOTH surfaces of the One tool — the address/upload intake
   and the recommendation results — mounted at /v2 so it can be reviewed alongside
   the live /pro without touching it.

   The decision engine (decide / computeV3Strategy / the V3 per-comp math) is copied
   verbatim from /pro/pro.jsx so the numbers are identical; only the presentation
   layer differs. decide() returns a few extra fields the new layout reads
   (jurisdiction, backupInfo, per-row defRank/kind).

   ?demo (or the "preview a sample recommendation" button) renders a canned result
   so the results page is reviewable without a live engine lookup. */
const { useState, useRef, useCallback, useEffect } = React;

const TAX_RATE = 2.2; // % effective; used only for the est-savings line
const TOKEN_PCT = 0.03; // 3% token settlement when nothing beats the notice
const CURRENT_TAX_YEAR = 2026;
const LOGO = "/pro/assets/taxdrop-logo.png";

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

/* Design palette (Claude Design "Strategy Recommender"): per-tier theme.
   Every tier — not just the gold "our" case — gets an intentional look. */
const THEME = {
  automatic: { main: "#1d6b41", deep: "#16542f", grad: "linear-gradient(135deg,#1d6b41,#16542f)", soft: "#e3efe6", softBorder: "#bfe0cd", chip: "#e3efe6", onSoft: "#1d6b41", shadow: "rgba(22,84,47,.30)" },
  potential: { main: "#1d6b41", deep: "#16542f", grad: "linear-gradient(135deg,#1d6b41,#16542f)", soft: "#e3efe6", softBorder: "#bfe0cd", chip: "#e3efe6", onSoft: "#1d6b41", shadow: "rgba(22,84,47,.30)" },
  our: { main: "#b1851a", deep: "#8a6311", grad: "linear-gradient(135deg,#b1851a 0%,#8a6311 100%)", soft: "#fdf9ef", softBorder: "#e6cf94", chip: "#f3e6c4", onSoft: "#8a6311", shadow: "rgba(138,99,18,.30)" },
  token: { main: "#5e6b64", deep: "#454f49", grad: "linear-gradient(135deg,#647069,#454f49)", soft: "#eef1ef", softBorder: "#d3ddd7", chip: "#eef1ef", onSoft: "#5e6b64", shadow: "rgba(69,79,73,.28)" },
};

const TIER_TAG = { automatic: "AUTOMATIC WIN", potential: "POTENTIAL WIN", our: "OUR EVIDENCE", token: "NO CASE" };
const TIER_NAME = { automatic: "Locked-In Reduction", potential: "Strong Case", our: "TaxDrop-Backed Case", token: "Token Settlement" };
const SOURCE_TAG = { our: "OUR EVIDENCE", comp: "CAD PACKET", automatic: "CAD PACKET", token: "FLOOR" };

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

/* ───────── sample result for the /v2?demo mockup (matches the design example) ───────── */
const SAMPLE_RESULT = (() => {
  const notice = 988470, target = 968801, backupVal = 974900, SF = 3977;
  const reduction = notice - target;
  return {
    ok: true, tier: "our", fair: false, target, notice, reduction, pct: (reduction / notice) * 100, subjSqft: SF,
    address: "5051 Forest Bend Rd, Dallas, TX 75244",
    rationale: "Our highest-savings play is TaxDrop's independent equity comps at " + fmt(target) + " — " + fmt(reduction) +
      " under your notice, and the evidence we build the protest around. Your most defensible fallback, the second-lowest comparable at " + fmt(backupVal) + ", stays ready in case the lead is challenged.",
    backupInfo: { key: "second", name: "Second-lowest comparable", value: backupVal, kind: "comp", tier: "potential", defRank: 1 },
    ladder: [
      { key: "ourReport", tier: "our", defRank: 2, kind: "median", tag: TIER_TAG.our, name: "TaxDrop equity comps", value: target, status: "selected",
        reason: "The largest reduction the evidence supports — " + fmt(reduction) + " off your notice. We control these comps end-to-end, filtered for outliers, so they hold up under scrutiny." },
      { key: "second", tier: "potential", defRank: 1, kind: "comp", tag: TIER_TAG.potential, name: "Second-lowest comparable", value: backupVal, status: "backup",
        reason: "Pulled straight from the county's own packet — the most credible single-comp anchor. Saves less, but the hardest number for the appraiser to dismiss. Hold it in reserve." },
    ],
    medianCards: [
      { key: "equityMedian", label: "Median equity value", value: notice, source: "CAD equity evidence", winner: false },
      { key: "ourReport", label: "TaxDrop equity report", value: target, source: "Generated comp set · outlier-filtered", winner: true },
    ],
    comps: [
      { addr: "4126 Allencrest Ln", type: "Equity (TaxDrop)", val: 1029910, sqft: SF },
      { addr: "4007 Allencrest Ln", type: "Equity (TaxDrop)", val: 1120680, sqft: SF },
      { addr: "4104 Calculus Dr", type: "Equity (TaxDrop)", val: 882180, sqft: SF },
      { addr: "4149 Mendenhall Dr", type: "Equity (TaxDrop)", val: 916580, sqft: SF },
      { addr: "4239 Boca Bay Dr", type: "Equity (TaxDrop)", val: 844650, sqft: SF },
    ],
    taxSaved: reduction * (TAX_RATE / 100),
    cadMismatch: null,
    subject: { parcel_id: "00000652000000000", county: "Dallas", living_sqft: SF, year_built: 1998, land_value: 260000, improvement_value: 728470, total_market: notice, tax_year: 2026 },
    jurisdiction: { ...JURISDICTIONS.TX, authority: "Dallas CAD", disclaimer: "This analysis supports a Texas §41.43 protest filing — it isn't a USPAP appraisal, legal, or tax advice." },
  };
})();

/* ───────────────────────── icons + atoms ───────────────────────── */
const ArrowUp = ({ s = 22, c = "#1d6b41", w = 2 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>
);
const FileIcon = ({ s = 16, c = "#fff", w = 2 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
);

// Narrow-viewport flag for responsive overrides. The design is desktop-first
// (fixed 2-col grids, 64px hero number); on phones we stack and shrink so the
// page never scrolls horizontally. (QA 2026-06-23)
function useNarrow(bp) {
  const get = () => (typeof window !== "undefined" ? window.innerWidth <= bp : false);
  const [narrow, setNarrow] = React.useState(get);
  React.useEffect(() => {
    const on = () => setNarrow(get());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [bp]);
  return narrow;
}

// ⚠️ REFERRAL PAUSED 2026-06-24 — scrollToRefer + ReferBlock are intentionally
// KEPT (currently unused) so the referral can be brought back with the same
// design. To re-enable: restore the header pill <a> in Header() and the two
// <ReferBlock /> renders (intake footer + end of Result). Do not delete.
// Smooth-scroll the header pill to the Refer-a-friend block.
function scrollToRefer(e) {
  if (e) e.preventDefault();
  const el = document.getElementById("refer");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Refer-a-friend promo — reusable so it can sit on both pages. The link is a
// copy-to-clipboard placeholder until a real referral system exists.
function ReferBlock() {
  const [copied, setCopied] = React.useState(false);
  const copyRefer = () => {
    const link = "taxdrop.one/r/SHARE15";
    try {
      // writeText() rejects ASYNCHRONOUSLY when permission is denied (e.g. no
      // user gesture / insecure context), so a sync try/catch misses it —
      // swallow the promise rejection too. (QA 2026-06-23)
      const res = navigator.clipboard && navigator.clipboard.writeText(link);
      if (res && typeof res.catch === "function") res.catch(() => {});
    } catch (_) { /* clipboard unavailable — no-op */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <section id="refer" style={{ position: "relative", overflow: "hidden", borderRadius: 20, background: "linear-gradient(135deg,#1d6b41,#16542f)", boxShadow: "0 12px 34px rgba(22,84,47,.22)", padding: "30px 34px", marginBottom: 48, display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
      <div style={{ position: "absolute", top: -70, right: -50, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.12),transparent 70%)", pointerEvents: "none" }}></div>
      <div style={{ position: "relative", flex: 1, minWidth: 300 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>🎁</span>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".13em", color: "#bfe6cd" }}>REFER A FRIEND</span>
        </div>
        <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em", color: "#fff", lineHeight: 1.2, marginBottom: 7 }}>Give $15 off, get $15 off.</div>
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: "#d3e6da", maxWidth: 460 }}>Share your link with a neighbor. They take <strong style={{ color: "#fff" }}>$15 off</strong> their TaxDrop fee, and you take <strong style={{ color: "#fff" }}>$15 off</strong> yours the moment they file.</p>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", background: "#ffffff1a", border: "1px solid #ffffff33", borderRadius: 11, padding: "12px 16px", fontSize: 14, fontWeight: 600, color: "#eaf2ec", letterSpacing: ".01em" }}>taxdrop.one/r/SHARE15</div>
        <button onClick={copyRefer} style={{ background: "#fff", color: "#16542f", border: "none", borderRadius: 11, padding: "13px 26px", fontSize: 14.5, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", boxShadow: "0 4px 14px rgba(0,0,0,.18)" }}>{copied ? "Copied ✓" : "Copy link"}</button>
      </div>
    </section>
  );
}

function Header() {
  const narrow = useNarrow(720);
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: narrow ? "13px 16px" : "16px 40px", background: "#ffffff", borderBottom: "1px solid #e2e8e2" }}>
      <div style={{ display: "flex", alignItems: "center", gap: narrow ? 10 : 14, minWidth: 0 }}>
        <img src={LOGO} alt="TaxDrop" style={{ height: narrow ? 26 : 30, width: "auto", display: "block" }} />
        <div style={{ width: 1, height: 18, background: "#dde4dd" }}></div>
        <span style={{ fontWeight: 600, fontSize: 15, color: "#41524799" }}>One</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: narrow ? 10 : 18 }}>
        <span style={{ fontSize: 13, color: "#8a988f", fontWeight: 500, letterSpacing: ".01em" }}>Tax Year {CURRENT_TAX_YEAR}</span>
        {/* Refer-a-friend pill removed 2026-06-24 (referral paused). Re-enable
            by restoring this <a> + the <ReferBlock/> renders below:
        <a href="#refer" onClick={scrollToRefer} style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", textDecoration: "none", background: "#eef3ee", border: "1px solid #d8e4db", borderRadius: 30, padding: narrow ? "7px 13px" : "7px 15px", fontSize: 13, fontWeight: 700, color: "#1d6b41", cursor: "pointer" }}><span>🎁</span>{narrow ? "$15 off" : "Refer a friend — $15 off"}</a>
        */}
      </div>
    </header>
  );
}

function StepNum({ n }) {
  return <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1d6b41", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{n}</div>;
}

function SectionHead({ icon, title, sub }) {
  return (
    <React.Fragment>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1d6b41", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>{icon}</div>
        <h2 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em", color: "#16241c" }}>{title}</h2>
      </div>
      {sub ? <p style={{ margin: "0 0 28px 42px", fontSize: 15, color: "#5d6f64", fontWeight: 500, lineHeight: 1.5 }}>{sub}</p> : null}
    </React.Fragment>
  );
}

/* ───────────────────────── file upload constants ───────────────────────── */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_EXT = /\.(pdf|xlsx|xlsm|xls|xlsb|csv|tsv)$/i;
const isSupportedFile = (f) =>
  SUPPORTED_EXT.test(f.name || "")
  || /pdf$/i.test(f.type || "")
  || /sheet|excel|spreadsheetml/i.test(f.type || "")
  || /csv$/i.test(f.type || "");

// Wait for the ES-module @vercel/blob client (index.html) before uploading.
function waitForBlobClient(maxMs = 10000) {
  if (window.blobClientUpload) return Promise.resolve(window.blobClientUpload);
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const done = () => {
      if (window.blobClientUpload) resolve(window.blobClientUpload);
      else reject(new Error("blob client not loaded"));
    };
    window.addEventListener("td-blob-ready", done, { once: true });
    const poll = () => {
      if (window.blobClientUpload) return resolve(window.blobClientUpload);
      if (Date.now() - t0 > maxMs) return reject(new Error("blob client not loaded"));
      setTimeout(poll, 50);
    };
    poll();
  });
}

/* ───────────────────────── app ───────────────────────── */
function App() {
  const [address, setAddress] = useState("");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | analyzing | done | error
  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState(null);
  const [cadRaw, setCadRaw] = useState(null);
  const [cadMethod, setCadMethod] = useState("");
  const [error, setError] = useState("");
  // The exact (ZIP-resolved) address the engine lookup used — this is the string
  // the report locked the property on, so the form must reuse it to pass the lock.
  const [lockAddr, setLockAddr] = useState("");
  // Paid-link mode: when the customer arrives via /r/<token>?address=…, the
  // property is fixed by the purchase. We pre-fill it and lock the field so they
  // can't search a second property on a single-property payment. The server-side
  // entitlement lock (cad-proxy, "first use wins") is the real guard; this just
  // removes the temptation/confusion of a free-text search bar. (2026-06-30)
  const [linked, setLinked] = useState(false);
  // Review-before-delivery flow (paid customers): instead of rendering the
  // report instantly, the submission goes into a review queue and the customer
  // waits for a reviewer to release it. `reviewStatus` is the server's view of
  // this purchase: unknown (still loading) | none (not submitted yet) |
  // submitted | in_review | approved. Sup/demo/direct visitors keep the instant
  // flow. (2026-07-01 — review gate)
  const [reviewStatus, setReviewStatus] = useState("none");
  const [jti, setJti] = useState("");
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [submitError, setSubmitError] = useState("");
  // Whether this browser holds a valid paid customer token → gets the review
  // flow. Detected server-side on mount (the token is HttpOnly, so JS can't read
  // it, and not every link carries ?address=). `booting` holds the UI until we
  // know, so a customer never flashes the instant form.
  const [reviewMode, setReviewMode] = useState(false);
  const [booting, setBooting] = useState(true);
  const [needsInfoMsg, setNeedsInfoMsg] = useState("");
  const fileRef = useRef(null);
  const addrRef = useRef(null);

  // Paid-link arrival: /r/<token>?address=… → pre-fill the address and lock the
  // field so the customer goes straight to uploading evidence. (Bubble mints the
  // link and URL-encodes the address it captured at checkout.)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const a = (p.get("address") || "").trim();
    if (a) { setAddress(a); setLinked(true); }
    // Strip the link token from the address bar so it doesn't linger in browser
    // history, screenshots, or copy-paste into support chats. The td_link cookie
    // (set by the /r/ middleware) carries auth for every API call, so a
    // token-less URL still works on refresh. We keep `?r=1` (arrived-via-link
    // marker — so a refresh stays in review/delivered mode) and `?address=` (so
    // the pre-fill survives a reload). Bare one.taxdrop.com/ has neither, so it
    // always shows the marketing form even if a td_link cookie lingers.
    // (2026-07-02 — root should never hijack to a stale report.)
    if (/^\/r(\/|$)/.test(window.location.pathname)) {
      window.history.replaceState({}, "", "/?r=1" + (a ? "&address=" + encodeURIComponent(a) : ""));
    }
  }, []);

  // ?demo → render the canned sample result immediately (mockup of the results page).
  useEffect(() => {
    if (/[?&]demo\b/.test(window.location.search)) {
      setResult(SAMPLE_RESULT);
      setAddress(SAMPLE_RESULT.address);
      setCadRaw({ demo: true });
      setStatus("done");
    }
  }, []);

  const loadDemo = () => {
    setResult(SAMPLE_RESULT);
    setAddress(SAMPLE_RESULT.address);
    setCadRaw({ demo: true });
    setStatus("done");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // On mount, ask the server where this visitor stands.
  //   402 (no valid token)  → NOT a paid customer → the instant/marketing tool.
  //   200 (token or sup)     → a paid customer → the REVIEW product: every
  //                            address search submits for review, never an
  //                            instant report.
  // `arrivedViaLink` only decides whether to AUTO-SHOW a stored *approved*
  // report: on a real /r/<token> arrival we render it; on bare one.taxdrop.com/
  // (a lingering cookie) we show the fresh intake form so a stale report never
  // resurrects — but review mode itself stays on, so searches still go to review.
  useEffect(() => {
    // ?demo bypasses the review flow (the sample-result effect handles it).
    if (/[?&]demo\b/.test(window.location.search)) { setBooting(false); return; }
    const q = new URLSearchParams(window.location.search);
    const arrivedViaLink = /^\/r(\/|$)/.test(window.location.pathname) || q.has("r") || !!q.get("address");
    let alive = true;
    (async () => {
      try {
        const resp = await fetch("/api/report", { headers: { "Accept": "application/json" } });
        if (resp.status === 402) { if (alive) setReviewMode(false); return; } // no token → instant tool
        const data = await resp.json().catch(() => ({}));
        if (!alive) return;
        setReviewMode(true); // token present → review product (searches submit for review)
        if (data.jti) setJti(data.jti);
        if (data.status === "approved" && data.report && data.report.result && arrivedViaLink) {
          setResult(data.report.result);
          setCadRaw(data.report.cadRaw || { delivered: true });
          setCadMethod(data.report.cadMethod || "");
          setLockAddr(data.report.lookupAddr || "");
          setStatus("done");
          setReviewStatus("approved");
        } else if (data.status === "approved" && arrivedViaLink) {
          // Approved but no renderable result (reviewer hand-built it) — show
          // holding, not the intake form (a re-submit would overwrite it).
          setReviewStatus("in_review");
        } else if (data.status === "needs_info") {
          // Sent back — intake form + the reviewer's request banner.
          setNeedsInfoMsg(data.message || "");
          setReviewStatus("needs_info");
        } else if (data.status === "submitted" || data.status === "in_review") {
          setReviewStatus(data.status); // holding — they're already in the queue
        } else {
          // status none, or approved-but-arrived-on-bare-root → fresh intake form.
          setReviewStatus("none");
        }
      } catch (e) {
        if (alive) setReviewMode(false); // fail open to the instant tool
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (linked) return; // address is fixed by the paid link — no search/autocomplete
    let ac = null, tries = 0, timer = null;
    const wire = () => {
      if (ac) return;
      if (!(window.google && window.google.maps && window.google.maps.places && addrRef.current)) {
        if (tries++ < 60) timer = setTimeout(wire, 200);
        return;
      }
      ac = new window.google.maps.places.Autocomplete(addrRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["formatted_address"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (place && place.formatted_address) setAddress(place.formatted_address);
      });
    };
    wire();
    return () => { if (timer) clearTimeout(timer); };
  }, [status, linked]);

  const pickFiles = (incoming) => {
    const list = Array.from(incoming || []).filter(Boolean);
    if (!list.length) return;
    const tooBig = list.filter((f) => f.size > MAX_FILE_BYTES);
    const unsupported = list.filter((f) => !isSupportedFile(f) && !tooBig.includes(f));
    const accepted = list.filter((f) => isSupportedFile(f) && f.size <= MAX_FILE_BYTES);

    const errors = [];
    if (tooBig.length) {
      errors.push(
        tooBig.length === 1
          ? `${tooBig[0].name} is ${(tooBig[0].size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB per file.`
          : `${tooBig.length} files are over the 10 MB per-file limit.`
      );
    }
    if (unsupported.length) {
      errors.push(
        `Unsupported file type: ${unsupported.map((f) => f.name).slice(0, 2).join(", ")}${unsupported.length > 2 ? "…" : ""}. Use PDF, Excel (.xlsx), or CSV.`
      );
    }

    if (!accepted.length) {
      setError(errors.join(" ") || "No usable files in that drop.");
      return;
    }
    setError(errors.length ? errors.join(" ") : "");
    setFiles((prev) => {
      const byKey = new Map(prev.map((f) => [f.name + ":" + f.size, f]));
      accepted.forEach((f) => byKey.set(f.name + ":" + f.size, f));
      return Array.from(byKey.values());
    });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) pickFiles(e.dataTransfer.files);
  };
  const clearFile = (e, idx) => {
    e && e.stopPropagation();
    if (typeof idx === "number") {
      setFiles((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setFiles([]);
    }
  };

  const canAnalyze = !!address.trim() && status !== "analyzing";

  // The full analysis pipeline (extract CAD → engine lookup → decide), shared by
  // the instant flow (`analyze`) and the review flow (`submitForReview`).
  // Returns the complete draft bundle; the caller decides whether to render it
  // or ship it to the review queue. `onStep` drives the progress UI.
  const computeDraft = useCallback(async (onStep) => {
    const step = onStep || (() => {});
    let cad = null, cadRawLocal = null, cadMethodLocal = "";
    if (files.length) {
      try {
        const ext = await window.Extractor.extractFromFiles(files);
        if (ext && ext.ok) {
          cad = window.Analyzer.analyze(ext.data);
          cadRawLocal = ext.data;
          cadMethodLocal = ext.method || "";
        }
      } catch (e) { /* CAD parse failed — fall through with cad=null */ }
    }
    step(1);

    let our = null;
    let engineStale = false;
    let lookupAddr = address.trim();
    try {
      lookupAddr = await ensureAddressZip(address.trim());
      const resp = await fetch("/api/cad-proxy?path=/api/evidence-pack/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: lookupAddr }),
      });
      if (resp.ok) {
        const data = await resp.json();
        // The engine always returns the freshest row it has for a parcel
        // (every lookup query is ORDER BY tax_year DESC LIMIT 1), so an
        // older tax_year here just means the county's current roll isn't
        // ingested yet — it's the latest available, not a stale duplicate.
        if (data && data.subject) {
          const ty = Number(data.subject.tax_year);
          engineStale = !!(ty && ty < CURRENT_TAX_YEAR);
          our = data;
        }
      }
    } catch (e) { /* our lookup failed — fall through with our=null */ }

    // When the engine only has a prior-year row (the county's current roll
    // isn't ingested yet) AND the homeowner uploaded their current county
    // evidence packet, that packet is the authoritative current-year source.
    // Drop the stale engine row so it can't (a) set the notice to a prior-year
    // value or (b) trip the >25% cad-mismatch guard and discard the real
    // packet. The analysis then runs solely on the uploaded CAD evidence.
    if (engineStale && cad) our = null;
    step(2);

    if (!cad && !our) {
      return { ok: false, error: "We couldn't read the evidence or find this property. Check the address and that the PDF is the county's evidence packet (not a scan)." };
    }
    const r = decide(cad, our, address.trim());
    step(3);
    if (!r.ok || r.notice == null) {
      return { ok: false, error: "We read the evidence but couldn't determine your noticed value. Try the Evidence Analyzer for a manual review." };
    }
    return { ok: true, r, cad, our, cadRaw: cadRawLocal, cadMethod: cadMethodLocal, lookupAddr };
  }, [address, files]);

  const analyze = useCallback(async () => {
    if (!address.trim()) return;
    setStatus("analyzing"); setStep(0); setError("");
    try {
      const d = await computeDraft(setStep);
      if (!d.ok) { setError(d.error); setStatus("error"); return; }
      await new Promise((res) => setTimeout(res, 350));
      setResult(d.r);
      setCadRaw(d.cadRaw);
      setCadMethod(d.cadMethod);
      setLockAddr(d.lookupAddr);
      setStatus("done");
    } catch (e) {
      setError("Something went wrong analyzing this property. Please try again.");
      setStatus("error");
    }
  }, [address, computeDraft]);

  // Upload evidence files straight to Blob (client-upload), namespaced to this
  // purchase's jti. Resolves jti on demand — the boot /api/report call may not
  // have finished before the customer submits. Failure is non-fatal; the parsed
  // CAD text still rides in draft.cad / draft.cadRaw.
  const uploadEvidence = useCallback(async () => {
    if (!files.length) return [];
    let uploadJti = jti;
    if (!uploadJti) {
      try {
        const resp = await fetch("/api/report", { headers: { Accept: "application/json" } });
        if (resp.ok) {
          const data = await resp.json().catch(() => ({}));
          if (data.jti) { uploadJti = data.jti; setJti(data.jti); }
        }
      } catch (e) { /* fall through — upload will no-op without jti */ }
    }
    if (!uploadJti) return [];
    const upload = await waitForBlobClient();
    const out = [];
    for (const f of files) {
      const pathname = "one/reviews/" + uploadJti + "/" + (f.name || "evidence");
      const blob = await upload(pathname, f, {
        access: "public",
        handleUploadUrl: "/api/blob-upload",
      });
      out.push({ url: blob.url, filename: f.name, size: f.size });
    }
    return out;
  }, [files, jti]);

  // Review flow: compute the draft, stash the evidence, and hand the whole
  // submission to the queue. The customer then sees the holding screen; a
  // reviewer releases it later (report.ts flips to `approved`).
  const submitForReview = useCallback(async () => {
    if (!address.trim()) return;
    if (!contact.email.trim()) { setSubmitError("Add your email so we can send your report."); return; }
    setStatus("analyzing"); setStep(0); setError(""); setSubmitError("");
    try {
      const d = await computeDraft(setStep);
      let evidence = [];
      try { evidence = await uploadEvidence(); }
      catch (e) { /* upload failed — submit anyway; reviewer can re-request files */ }

      const draft = d.ok
        ? { result: d.r, cad: d.cad, our: d.our, cadRaw: d.cadRaw, cadMethod: d.cadMethod, lookupAddr: d.lookupAddr }
        : null;
      const hasCountyEvidence = !!(d.ok && (d.cad || d.cadRaw)) || files.length > 0;
      const resp = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: (d.ok && d.lookupAddr) || address.trim(),
          contact,
          evidence,
          hasCountyEvidence,
          evidenceFilenames: files.map((f) => ({ filename: f.name, size: f.size })),
          draft,
          draftError: d.ok ? undefined : d.error,
        }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        setSubmitError(e.message || "We couldn't submit your report. Please try again.");
        setStatus("idle");
        return;
      }
      setReviewStatus("in_review");
      setStatus("submitted");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setSubmitError("Something went wrong submitting your report. Please try again.");
      setStatus("idle");
    }
  }, [address, contact, computeDraft, uploadEvidence]);

  const reset = () => { setStatus("idle"); setStep(0); setResult(null); setError(""); setFiles([]); setCadRaw(null); setLockAddr(""); };

  // TurboTax-style intake progress (reviewMode): one step open at a time, each
  // check-off persisted per-property so a returning customer resumes exactly
  // where they left off. Keyed by the locked/purchased address (a paid link is
  // locked to one property); falls back to a shared key for un-linked agent
  // sessions. Mirrors the delivered-report StepCard progress pattern.
  const intakeKey = "td_one_intake_progress_v2:" + (lockAddr || address || "guest");
  const [intakeDone, setIntakeDone] = useState([false, false, false, false]);
  const [intakeOpen, setIntakeOpen] = useState(0);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(intakeKey));
      if (s && Array.isArray(s.done)) {
        setIntakeDone(s.done);
        setIntakeOpen(typeof s.open === "number" ? s.open : (s.done.indexOf(false) === -1 ? -1 : s.done.indexOf(false)));
      }
    } catch (e) { /* storage disabled — start fresh */ }
  }, [intakeKey]);
  const persistIntake = (nextDone, nextOpen) => {
    setIntakeDone(nextDone); setIntakeOpen(nextOpen);
    try { localStorage.setItem(intakeKey, JSON.stringify({ done: nextDone, open: nextOpen })); } catch (e) {}
  };
  const toggleIntake = (i) => persistIntake(intakeDone, intakeOpen === i ? -1 : i);
  const markIntakeDone = (i) => { const nd = intakeDone.slice(); nd[i] = true; persistIntake(nd, nd.indexOf(false)); };

  const isAnalyzing = status === "analyzing";
  const showForm = status !== "done";
  const narrow = useNarrow(720);
  const ctaDisabled = !canAnalyze;
  const ctaStyle = {
    width: "100%", marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
    fontSize: 16, fontWeight: 700, color: "#fff", border: "none", borderRadius: 13, padding: 18, letterSpacing: ".01em",
    fontFamily: "inherit", cursor: ctaDisabled ? "not-allowed" : "pointer",
    background: ctaDisabled ? "#b9cabf" : "linear-gradient(135deg,#27764a,#15512e)",
    boxShadow: ctaDisabled ? "none" : "0 6px 18px rgba(22,84,47,.28)",
  };
  const dropStyle = {
    cursor: "pointer", textAlign: "center",
    border: "1.5px dashed " + (dragging ? "#1d6b41" : "#cdd9cd"), background: dragging ? "#eef7f1" : "#f7faf7",
    borderRadius: 14, padding: "38px 24px", transition: "all .15s",
  };

  const stepLabels = ["Reading the county evidence packet", "Extracting sales & equity comparables", "Running your full strategy set", "Selecting your highest-savings value"];

  // Lightweight jurisdiction for the intake (pre-analysis, so no county yet).
  // State comes from the typed/locked address; defaults to TX (the live-data
  // state, matching resolveStateId). Drives the "File your protest" step copy.
  const jIn = JURISDICTIONS[stateFromAddress(address) || "TX"];

  // In review mode the primary CTA submits to the queue instead of rendering.
  const primaryAction = reviewMode ? submitForReview : analyze;
  const primaryLabel = reviewMode ? "Submit for Tax Agent Review" : "Find my best method";
  const primaryDisabled = reviewMode
    ? (!address.trim() || !contact.email.trim() || status === "analyzing")
    : ctaDisabled;

  // --- Review-flow standalone views ----------------------------------------
  // While we don't yet know where this visitor stands, hold the page so a
  // customer never flashes the instant form before we learn their status.
  if (booting) {
    return (
      <div style={{ background: "#e9efe9", minHeight: "100vh" }}>
        <Header />
        <main style={{ maxWidth: 1080, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
          <span style={{ width: 26, height: 26, border: "3px solid #cfe0d5", borderTopColor: "#1d6b41", borderRadius: 999, display: "inline-block", animation: "spin .7s linear infinite" }}></span>
        </main>
      </div>
    );
  }

  // Submitted / in review → holding screen (not the report).
  if (reviewMode && (reviewStatus === "submitted" || reviewStatus === "in_review")) {
    return (
      <div style={{ background: "#e9efe9", minHeight: "100vh" }}>
        <Header />
        <main style={{ maxWidth: 640, margin: "0 auto", padding: narrow ? "40px 16px 64px" : "72px 24px 90px" }}>
          <section style={{ background: "#fff", border: "1px solid #e6ebe6", borderRadius: 20, boxShadow: "0 1px 2px rgba(20,40,28,.04),0 12px 34px rgba(20,40,28,.06)", padding: narrow ? "32px 22px" : "44px 40px", textAlign: "center" }}>
            <div style={{ width: 58, height: 58, borderRadius: 16, background: "#e3efe6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 22px", fontSize: 26 }}>✓</div>
            <h1 style={{ fontSize: narrow ? 26 : 32, lineHeight: 1.12, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 14px", color: "#16241c" }}>Your report is being prepared</h1>
            <p style={{ maxWidth: 460, margin: "0 auto 8px", fontSize: 16, lineHeight: 1.6, color: "#5d6f64", fontWeight: 500 }}>
              Thanks{contact.name ? ", " + contact.name.split(" ")[0] : ""}. A TaxDrop tax expert is reviewing the evidence for{" "}
              <strong style={{ color: "#16241c" }}>{address}</strong> and finalizing your strategy.
            </p>
            <p style={{ maxWidth: 460, margin: "0 auto 26px", fontSize: 16, lineHeight: 1.6, color: "#5d6f64", fontWeight: 500 }}>
              You'll get an email as soon as it's ready — typically within{" "}
              <strong style={{ color: "#16241c" }}>24–48 hours, Monday–Friday</strong>.
            </p>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#f1f8f3", border: "1px solid #cfe3d6", borderRadius: 20, padding: "8px 16px", fontSize: 13.5, fontWeight: 700, color: "#2c8350" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#2c8350", display: "inline-block", animation: "pulseDot 1.4s ease-in-out infinite" }}></span>
              In review
            </div>
            <p style={{ margin: "28px auto 0", fontSize: 12.5, color: "#a4b0a7", lineHeight: 1.55, maxWidth: 460 }}>
              Keep this link — it'll show your finished report here once it's released. Questions? Reply to your confirmation email.
            </p>
          </section>
        </main>
      </div>
    );
  }

  // Delivered / instant report → the redesigned guided case plan (its own dark
  // chrome, so it replaces the standard Header + form layout). The "fairly
  // assessed" outcome keeps the calmer Result view below (no protest to guide).
  if (status === "done" && result && !result.fair) {
    return (
      <ReportView r={result} onReset={reset} address={result.address || address}
        lockAddr={lockAddr} cadRaw={cadRaw} cadMethod={cadMethod} stored={reviewStatus === "approved"} />
    );
  }

  return (
    <div style={{ background: "#e9efe9", minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: narrow ? "0 16px 64px" : "0 24px 90px" }}>

        {showForm && reviewStatus === "needs_info" ? (
          <div style={{ margin: narrow ? "24px 0 0" : "36px 0 0", padding: "16px 20px", background: "#fdf6e8", border: "1px solid #ecdcae", borderRadius: 14, color: "#8a6311" }}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>We need a bit more to finish your report</div>
            <div style={{ fontSize: 14.5, lineHeight: 1.55, fontWeight: 500 }}>{needsInfoMsg || "Please add or replace your county evidence and re-submit."}</div>
          </div>
        ) : null}

        {showForm ? (
          <section style={{ textAlign: "center", padding: narrow ? "40px 0 28px" : "64px 0 40px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".16em", color: "#2c8350", marginBottom: 18 }}>{reviewMode ? "WELCOME TO TAXDROP ONE" : "ONE PLATFORM FOR LOWER PROPERTY TAXES"}</div>
            <h1 style={{ fontSize: narrow ? 34 : 58, lineHeight: 1.06, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 20px", color: "#16241c" }}>{reviewMode
              ? <React.Fragment>Let's start building your<br />winning <span style={{ color: "#2c8350" }}>case.</span></React.Fragment>
              : <React.Fragment>Win the lowest assessment<br />you can actually <span style={{ color: "#2c8350" }}>defend.</span></React.Fragment>}</h1>
            <p style={{ maxWidth: 620, margin: "0 auto", fontSize: narrow ? 17 : 19.5, lineHeight: 1.55, color: "#41524a", fontWeight: 500 }}>{reviewMode
              ? "You're in. Your report is locked to the property you enrolled — confirm your details, generate your pre-filled protest form, and submit. A TaxDrop expert finishes the rest and emails your finished report."
              : "Drop in your address and the county's evidence packet. We test every angle — their own numbers, the strongest backup comp, and our independent equity report — then hand you the biggest reduction that holds up at hearing, plus the step-by-step plan to win it."}</p>
          </section>
        ) : null}


        {showForm ? (reviewMode ? (
          <ReviewIntake
            narrow={narrow} jIn={jIn} address={address} setAddress={setAddress} addrRef={addrRef}
            linked={linked} lockAddr={lockAddr} files={files} dragging={dragging} setDragging={setDragging}
            dropStyle={dropStyle} fileRef={fileRef} pickFiles={pickFiles} onDrop={onDrop} clearFile={clearFile}
            error={error} status={status} contact={contact} setContact={setContact} submitError={submitError}
            isAnalyzing={isAnalyzing} step={step} stepLabels={stepLabels}
            primaryAction={primaryAction} primaryDisabled={primaryDisabled} primaryLabel={primaryLabel}
            ctaStyle={ctaStyle} done={intakeDone} open={intakeOpen} onToggle={toggleIntake} onMarkDone={markIntakeDone}
          />
        ) : (
          <section style={{ background: "#fff", border: "1px solid #e6ebe6", borderRadius: 20, boxShadow: "0 1px 2px rgba(20,40,28,.04),0 12px 34px rgba(20,40,28,.06)", padding: narrow ? "24px 20px" : "34px 36px", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <StepNum n={1} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#16241c" }}>Property address</span>
            </div>
            {linked ? (
              <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, border: "1.5px solid #cfe3d6", background: "#f1f8f3", borderRadius: 12, padding: "15px 18px", marginBottom: 12, fontSize: 16, fontWeight: 700, color: "#16241c" }}>
                <span style={{ flexShrink: 0, fontSize: 15 }}>🔒</span>
                <span style={{ flex: 1, minWidth: 0 }}>{address}</span>
                <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#2c8350", background: "#e3efe6", padding: "3px 9px", borderRadius: 20 }}>YOUR PROPERTY</span>
              </div>
            ) : (
              <input ref={addrRef} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state ZIP" spellCheck="false"
                style={{ width: "100%", display: "block", border: "1.5px solid #e2e8e2", background: "#f7faf7", borderRadius: 12, padding: "15px 18px", marginBottom: 30, fontSize: 16, fontWeight: 600, color: "#16241c", fontFamily: "inherit", outline: "none" }} />
            )}
            {linked ? (
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#7c8a80", fontWeight: 500 }}>This report is locked to the property you purchased. Follow the steps below to file and finish your report.</p>
            ) : null}
            {reviewMode ? <JurisChips jIn={jIn} /> : null}

            {/* STEP 2 — File your protest (paid flow only). The homeowner can't get
                the county's evidence until AFTER they file, so filing + the pre-filled
                form + "how to get your evidence" lead; the upload moves to step 3. */}
            {reviewMode ? (
              <React.Fragment>
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                  <StepNum n={2} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#16241c" }}>File your {jIn.proceedingTitle || "protest"}</span>
                </div>

                <div style={{ background: "#FFF8E1", border: "1px solid #C99700", borderRadius: 10, padding: "11px 15px", display: "flex", gap: 10, alignItems: "baseline", marginBottom: 16, fontSize: 13.5, color: "#7a5800", lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: "#C99700", flexShrink: 0, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>Deadline</span>
                  <span>{jIn.deadline || "see your notice"}. File first — the county only shares the evidence behind your value after you {jIn.fileVerb ? jIn.fileVerb.toLowerCase() : "file"}.</span>
                </div>

                <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 9, fontSize: 13.5, lineHeight: 1.6, color: "#5d6f64" }}>
                  <div style={{ display: "flex", gap: 10 }}><span style={{ fontWeight: 700, color: "#0B8F52", flexShrink: 0 }}>a.</span><span><strong>Fastest:</strong> file online through your {jIn.authorityType}'s {jIn.proceeding} portal.</span></div>
                  <div style={{ display: "flex", gap: 10 }}><span style={{ fontWeight: 700, color: "#0B8F52", flexShrink: 0 }}>b.</span><span><strong>Or by mail:</strong> print, sign, and post the form to the address on it — postmark by your deadline.</span></div>
                  <div style={{ display: "flex", gap: 10 }}><span style={{ fontWeight: 700, color: "#0B8F52", flexShrink: 0 }}>c.</span><span>After you file, you'll want to receive the {jIn.authorityType}'s evidence — which we also analyze for extra potential reductions. We'll show you exactly how to get it in the next step.</span></div>
                </div>

                <ProtestFormCard address={lockAddr || address} embedded fallback={
                  <div style={{ border: "1px solid #e6ebe6", borderRadius: 10, padding: "16px 18px" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#16241c" }}>{jIn.form} — {jIn.proceedingTitle} ({jIn.stateName})</div>
                    <div style={{ fontSize: 13.5, color: "#5d6f64", lineHeight: 1.6, marginTop: 3 }}>Get {jIn.form} from your {jIn.authorityType}, fill in your details, then sign and submit it.</div>
                  </div>
                } />

                <div style={{ marginBottom: 34 }} />
              </React.Fragment>
            ) : null}

            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <StepNum n={reviewMode ? 3 : 2} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#16241c" }}>County evidence packet</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#8a988f", background: "#eef3ee", padding: "3px 9px", borderRadius: 20 }}>Optional</span>
            </div>

            {reviewMode ? (
              <React.Fragment>
                <div style={{ fontSize: 13.5, color: "#4a574e", lineHeight: 1.55, marginBottom: 14 }}>
                  Add this once your {jIn.authorityType} sends its evidence back — you don't need it to submit now. We'll build your case from our own comparables, then re-check it the moment you add the packet.
                </div>
                <EvidenceHowTo stateId={stateFromAddress(address)} jIn={jIn} narrow={narrow} />
              </React.Fragment>
            ) : (
              <div style={{ fontSize: 13.5, color: "#5d6f64", lineHeight: 1.55, marginBottom: 14, background: "#f4f8f5", border: "1px solid #e6ebe6", borderRadius: 11, padding: "13px 16px" }}>
                <span style={{ fontWeight: 700, color: "#16241c" }}>How to get your county evidence:</span> {evidenceHowTo(stateFromAddress(address))}
              </div>
            )}

            <div onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setDragging(false); }} onDrop={onDrop} onClick={() => fileRef.current && fileRef.current.click()} style={dropStyle}>
              <input type="file" multiple
                accept=".pdf,.xlsx,.xlsm,.xls,.xlsb,.csv,.tsv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                ref={fileRef} onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
              <div style={{ width: 50, height: 50, borderRadius: 13, background: "#e3efe6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><ArrowUp s={22} /></div>
              <div style={{ fontSize: 17, fontWeight: 700, color: "#16241c", marginBottom: 6 }}>Drop the county's evidence — PDF, Excel, or CSV</div>
              <div style={{ fontSize: 14, color: "#7c8a80", marginBottom: 18, maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>Drop one file or several (e.g. the cover-letter PDF plus a comparables sheet). Up to 10&nbsp;MB each. No packet? We'll build the case from our own comps.</div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#27764a,#16542f)", color: "#fff", border: "none", borderRadius: 11, padding: "11px 22px", fontSize: 14, fontWeight: 700, boxShadow: "0 4px 12px rgba(22,84,47,.25)" }}><ArrowUp s={15} c="#fff" w={2.2} />{files.length ? "Add more files" : "Add files"}</span>
            </div>

            {files.length > 0 ? (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                {files.map((f, idx) => (
                  <div key={f.name + ":" + f.size + ":" + idx} style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid #e6ebe6", borderRadius: 12, padding: "13px 16px" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 9, background: "#eef3ee", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FileIcon c="#1d6b41" /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#16241c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                      <div style={{ fontSize: 12, color: "#8a988f", marginTop: 2 }}>{(f.size / 1024 / 1024).toFixed(f.size > 1024 * 1024 ? 1 : 2)} MB</div>
                    </div>
                    <button onClick={(e) => clearFile(e, idx)} style={{ background: "none", border: "none", color: "#a4b0a7", fontSize: 18, cursor: "pointer", fontFamily: "inherit", padding: "4px 8px" }} aria-label="Remove">×</button>
                  </div>
                ))}
              </div>
            ) : null}

            {error && status !== "analyzing" ? (
              <div style={{ marginTop: 16, padding: "13px 15px", background: "#fbeceb", border: "1px solid #f0c9c5", borderRadius: 11, color: "#9e2a2a", fontSize: 13.5, fontWeight: 500 }}>{error}</div>
            ) : null}

            {reviewMode ? (
              <div style={{ marginTop: 30 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                  <StepNum n={4} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#16241c" }}>Where to send your report</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <input value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} placeholder="Full name"
                    style={{ width: "100%", border: "1.5px solid #e2e8e2", background: "#f7faf7", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontWeight: 600, color: "#16241c", fontFamily: "inherit", outline: "none" }} />
                  <input value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} placeholder="Phone (optional)" inputMode="tel"
                    style={{ width: "100%", border: "1.5px solid #e2e8e2", background: "#f7faf7", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontWeight: 600, color: "#16241c", fontFamily: "inherit", outline: "none" }} />
                  <input value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} placeholder="Email — where we'll send your report" type="email"
                    style={{ gridColumn: narrow ? "auto" : "1 / -1", width: "100%", border: "1.5px solid #e2e8e2", background: "#f7faf7", borderRadius: 12, padding: "14px 16px", fontSize: 15, fontWeight: 600, color: "#16241c", fontFamily: "inherit", outline: "none" }} />
                </div>
                <p style={{ margin: "12px 2px 0", fontSize: 13, color: "#7c8a80", fontWeight: 500, lineHeight: 1.5 }}>
                  A TaxDrop tax expert reviews every report before it's sent. We'll email your finished report — typically within <strong style={{ color: "#16241c" }}>24–48 hours, Monday–Friday</strong>.
                </p>
                {submitError ? (
                  <div style={{ marginTop: 14, padding: "13px 15px", background: "#fbeceb", border: "1px solid #f0c9c5", borderRadius: 11, color: "#9e2a2a", fontSize: 13.5, fontWeight: 500 }}>{submitError}</div>
                ) : null}
              </div>
            ) : null}

            <button onClick={primaryAction} disabled={primaryDisabled} style={{ ...ctaStyle, cursor: primaryDisabled ? "not-allowed" : "pointer", background: primaryDisabled ? "#b9cabf" : "linear-gradient(135deg,#27764a,#15512e)", boxShadow: primaryDisabled ? "none" : "0 6px 18px rgba(22,84,47,.28)" }}>
              {isAnalyzing ? (
                <React.Fragment>
                  <span style={{ width: 16, height: 16, border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: 999, display: "inline-block", animation: "spin .7s linear infinite" }}></span>
                  {reviewMode ? "Preparing your report…" : "Analyzing evidence…"}
                </React.Fragment>
              ) : (
                <React.Fragment>{primaryLabel} <span style={{ fontSize: 17 }}>→</span></React.Fragment>
              )}
            </button>

            {isAnalyzing ? (
              <div style={{ marginTop: 22, borderTop: "1px solid #eef2f0", paddingTop: 20 }}>
                <div style={{ height: 6, borderRadius: 999, background: "#e7eeea", overflow: "hidden", marginBottom: 18 }}>
                  <div style={{ width: Math.min((step + 1) / 4, 1) * 100 + "%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#1d6b41,#2bb0c4)", transition: "width .5s ease" }}></div>
                </div>
                {stepLabels.map((label, i) => {
                  const done = i < step, active = i === step;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "5px 0" }}>
                      <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: done ? "#fff" : active ? "#1d6b41" : "#b6c2bb", background: done ? "#1d6b41" : active ? "#e3efe6" : "#eef2f0", animation: active ? "pulseDot 1s ease-in-out infinite" : "" }}>{done ? "✓" : active ? "●" : ""}</span>
                      <span style={{ fontSize: 14.5, fontWeight: active || done ? 600 : 500, color: done || active ? "#16241c" : "#9aa6a0" }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        )) : null}

        {showForm && !isAnalyzing ? (
          <p style={{ textAlign: "center", margin: "0 0 64px", fontSize: 13.5, color: "#7c8a80", fontWeight: 500 }}>
            Just reviewing the design?{" "}
            <span onClick={loadDemo} style={{ color: "#2c8350", fontWeight: 700, cursor: "pointer", borderBottom: "1px solid #bcd9c8" }}>Preview a sample recommendation →</span>
          </p>
        ) : null}

        {status === "done" && result ? <Result r={result} onReset={reset} address={result.address || address} lockAddr={lockAddr} cadRaw={cadRaw} cadMethod={cadMethod} stored={reviewStatus === "approved"} /> : null}

        {/* Refer-a-friend paused 2026-06-24 — ReferBlock kept for later. */}
        {showForm ? (
          <p style={{ textAlign: "center", fontSize: 12.5, color: "#a4b0a7", lineHeight: 1.55, maxWidth: 620, margin: "0 auto" }}>Evidence is read in your browser for this session only. This analysis supports a Texas §41.43 protest filing — it isn't a USPAP appraisal, legal, or tax advice.</p>
        ) : null}
      </main>
    </div>
  );
}

/* ───────── strategy explainer copy (the "How this strategy works" popups) ───────── */
function strategyExplainer(kind, tier) {
  if (kind === "comp") return {
    title: "How the second-lowest comp works",
    paras: [
      "Every packet has a lowest comp — and the appraiser dismisses it as an outlier on sight. So we don't anchor to it.",
      "We anchor to the second-lowest: the most aggressive value you can credibly defend with a single comparable — low enough to matter, solid enough to survive the \"that's an outlier\" pushback.",
      "And it comes straight from the county's own packet — the hardest number for them to argue with. That's what makes it your strongest reserve behind a bigger play.",
    ],
  };
  if (tier === "our") return {
    title: "How the TaxDrop equity report works",
    paras: [
      "We pull our own set of equity comparables and adjust each one to your home — size, age, land, and features — for a true apples-to-apples comparison.",
      "Then we filter out the outliers: a 1960 home with a 2020 remodel isn't comparable, and any comp skewing far above the median is dropped.",
      "From what's left we take the indicated value — and only call it a case if it clears a real 3% threshold, not statistical noise. The value shown is the exact value on your filed packet.",
    ],
  };
  if (kind === "token") return {
    title: "How a token settlement works",
    paras: [
      "When no indicator beats your notice, there's no reduction case to anchor to this cycle.",
      "We negotiate a modest 3% courtesy reduction at the informal — real relief now, with the full case rebuilt next year.",
    ],
  };
  return {
    title: "How the county-median strategy works",
    paras: [
      "The county's own packet prints a median of the comparables it chose — sales or equity. Those are evidence the appraisal district generated itself.",
      "Texas Tax Code §41.43 lets you request the lower of the county's own indicators, so when that median lands under your notice it's the most defensible number on the table.",
      "Because it's the county's own number, it's the hardest figure for the appraiser to dismiss.",
    ],
  };
}

// Savings chip is a RELATIVE ranking among the strategies on the table —
// the lead (biggest reduction) is "High", the rest scale against it — not an
// absolute dollar threshold. Matches the design's intent ("lead = High,
// smaller backup = Medium").
function savingsLevel(value, notice, topReduction) {
  if (notice == null || value == null || value >= notice) return "Low";
  const red = notice - value;
  const top = topReduction && topReduction > 0 ? topReduction : red;
  const ratio = red / top;
  if (ratio >= 0.9) return "High";
  if (ratio >= 0.55) return "Medium";
  return "Low";
}
function confidenceLevel(kind, tier) {
  if (tier === "automatic") return "High";
  if (kind === "comp") return "High";
  if (kind === "token") return "High";
  return "Medium";
}

/* ───────────────────────── result view ───────────────────────── */
/* ───────── pre-filled Notice of Protest (Form 50-132) ─────────
   Collects the owner fields the engine can't supply, then calls
   /api/generate-forms — which fills the population-correct CraftMyPDF
   template from the live county record and returns a print-and-sign PDF. */

/* ═══════ Post-purchase intake presentational helpers (reviewMode only) ═══════
   Pure presentational, driven by the flat `jIn` jurisdiction config so all copy
   stays state-correct (TX protest / CA appeal / GA appeal / FL petition). No
   data fetching, no effect on the submit flow. ══════════════════════════════ */

// Read-only "detected jurisdiction" chips under the locked address.
function JurisChips({ jIn }) {
  const chip = (k, v) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#16241c", background: "#f4f8f5", border: "1px solid #e6ebe6", padding: "6px 11px", borderRadius: 9 }}>
      <span style={{ color: "#7c8a80", fontWeight: 600, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".05em" }}>{k}</span>{v}
    </span>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 30 }}>
      {chip("State", jIn.stateName)}
      {chip("Filing", jIn.proceedingTitle)}
      {chip("Form", jIn.form)}
      <span style={{ fontSize: 12, color: "#a4b0a7", fontWeight: 500 }}>· detected from your address</span>
    </div>
  );
}

// Prominent, state-aware "how to get the county's evidence" card (intake step 3).
function EvidenceHowTo({ stateId, jIn, narrow }) {
  return (
    <div style={{ border: "1.5px solid #cfe3d6", background: "#fff", borderRadius: 14, padding: narrow ? "18px 18px" : "20px 22px", marginBottom: 16, boxShadow: "0 1px 2px rgba(20,40,28,.04),0 8px 22px rgba(20,40,28,.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9, fontSize: 15.5, fontWeight: 800, color: "#16241c" }}>
        <FileIcon c="#1d6b41" />
        How to get your {jIn.authorityType}'s evidence
      </div>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "#4a574e", fontWeight: 500 }}>{evidenceHowTo(stateId)}</p>
    </div>
  );
}

function ProtestFormCard({ address, embedded, fallback }) {
  const narrow = useNarrow(720);
  // Backend is the source of truth: undefined = loading, null = no filled form
  // for this jurisdiction yet, object = { form, outputFileName, fields }.
  const [schema, setSchema] = React.useState(undefined);
  const [values, setValues] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState("");

  React.useEffect(() => {
    let live = true;
    const addr = (address || "").trim();
    if (!addr) { setSchema(null); return; }
    setSchema(undefined);
    fetch("/api/form-schema", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: addr }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { if (live) setSchema(d && d.available ? d : null); })
      .catch(() => { if (live) setSchema(null); });
    return () => { live = false; };
  }, [address]);

  const fields = (schema && schema.fields) || [];
  const set = (k) => (e) => { const v = e.target.value; setValues((o) => ({ ...o, [k]: v })); };
  const ready = fields.filter((f) => f.required).every((f) => String(values[f.key] || "").trim());

  const generate = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr(""); setFileUrl("");
    try {
      const resp = await fetch("/api/generate-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: (address || "").trim(), inputs: values }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.file) {
        setErr(data.message || data.error || "We couldn't generate your form. Please try again.");
      } else {
        setFileUrl(data.file);
        window.open(data.file, "_blank", "noopener");
      }
    } catch (e) {
      setErr("Something went wrong generating your form. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (schema === undefined) return null;          // loading — don't flash the fallback
  if (schema === null) return fallback || null;   // no pre-filled form for this jurisdiction yet

  const inputStyle = { width: "100%", boxSizing: "border-box", border: "1.5px solid #d8e0d8", borderRadius: 10, padding: "12px 14px", fontSize: 14.5, fontFamily: "inherit", color: "#16241c", background: "#fff", outline: "none" };
  const field = (f) => (
    <div key={f.key}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: "#5d6f64", marginBottom: 6 }}>{f.label}{f.required ? null : <span style={{ color: "#a4b0a7", fontWeight: 600 }}> (optional)</span>}</label>
      <input value={values[f.key] || ""} onChange={set(f.key)} placeholder={f.placeholder || ""} style={inputStyle} />
    </div>
  );

  return (
    <section style={{ marginBottom: embedded ? 0 : 48, marginTop: embedded ? 16 : 0 }}>
      {embedded ? null : <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".13em", color: "#2c8350", marginBottom: 18 }}>YOUR {(schema.form || "FORM").toUpperCase()}</div>}
      <div style={{ background: "#fff", border: "1px solid #e6ebe6", borderRadius: embedded ? 10 : 18, padding: narrow ? "22px 20px" : (embedded ? "20px 22px" : "26px 28px"), maxWidth: embedded ? 720 : "none" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#16241c", marginBottom: 7 }}>Pre-filled {schema.form}</div>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.5, color: "#5d6f64" }}>We fill in your property address, account number, and appraisal district straight from the county record. Add your details below, then print, sign, and file it with your protest.</p>
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 14, marginBottom: 18 }}>
          {fields.map(field)}
        </div>
        {err ? <div style={{ fontSize: 13, color: "#b03f2c", marginBottom: 14 }}>{err}</div> : null}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <button onClick={generate} disabled={!ready || busy}
            style={{ borderRadius: 11, padding: "13px 28px", fontSize: 14.5, fontWeight: 800, fontFamily: "inherit", border: "none", cursor: (!ready || busy) ? "default" : "pointer", color: "#fff", background: (!ready || busy) ? "#b9cabf" : "linear-gradient(135deg,#27764a,#15512e)" }}>
            {busy ? "Generating…" : (schema.form === "Form 50-132" ? "Generate My Notice to Protest Form" : "Generate my " + schema.form)}
          </button>
          {fileUrl ? <a href={fileUrl} target="_blank" rel="noopener" style={{ fontSize: 14, fontWeight: 700, color: "#1d6b41" }}>Open PDF ↗</a> : null}
        </div>
        <p style={{ margin: "16px 0 0", fontSize: 12, color: "#9aa69d", lineHeight: 1.5 }}>You sign and file this yourself. The opinion-of-value and legal-description lines are left blank — write those in by hand before filing.</p>
      </div>
    </section>
  );
}

/* ═══════ Post-purchase intake — TurboTax-style step accordion (reviewMode) ═══════
   One step open at a time; every check-off turns the step green and is persisted
   per-property (via the parent's intakeKey), so a returning customer resumes where
   they left off. Reuses the same StepCard + DarkBtn atoms as the delivered report,
   so the intake and the report read as one guided flow. Copy stays state-correct
   via the flat `jIn` jurisdiction config. ═══════════════════════════════════════ */
function ReviewIntake(p) {
  const {
    narrow, jIn, address, setAddress, addrRef, linked, lockAddr,
    files, dragging, setDragging, dropStyle, fileRef, pickFiles, onDrop, clearFile, error, status,
    contact, setContact, submitError, isAnalyzing, step, stepLabels,
    primaryAction, primaryDisabled, primaryLabel, ctaStyle,
    done, open, onToggle, onMarkDone,
  } = p;

  const body = { fontSize: 14.5, lineHeight: 1.65, color: "#3A4148", fontWeight: 500 };
  const fileWord = jIn.fileVerb ? jIn.fileVerb.toLowerCase() : "file";
  const fieldStyle = { width: "100%", boxSizing: "border-box", border: "1.5px solid #cdd9cd", background: "#f7faf7", borderRadius: 12, padding: "14px 16px", fontSize: 15.5, fontWeight: 600, color: "#16241c", fontFamily: "inherit", outline: "none" };

  const s1Summary = linked
    ? "Locked to the property you purchased — confirm it's the right one."
    : "The property we'll build your case around.";
  const s2Summary = "File your " + (jIn.proceedingTitle || "protest") + " before " + (jIn.deadline || "the deadline") + " — filing is what unlocks the county's evidence.";
  const s3Summary = "Optional — add the " + jIn.authorityType + "'s evidence packet once it arrives and we'll push for an even lower value.";
  const s4Summary = "Where to send your finished report. A TaxDrop tax agent reviews every case before it goes out.";

  // County filing portal for step 2, item (a). /api/form-schema resolves the
  // county from the locked address and returns its curated filing record
  // (efileUrl/website, from _tx-cads.ts). undefined = still loading (plain text,
  // no link yet); null = county not in the registry → fall back to an
  // address-scoped web search, never a guessed URL. Own fetch (ProtestFormCard
  // keeps its own) — a cheap extra call on a low-volume paid flow.
  const [filing, setFiling] = React.useState(undefined);
  React.useEffect(() => {
    const addr = (lockAddr || address || "").trim();
    if (!addr) { setFiling(undefined); return; }
    let live = true;
    setFiling(undefined);
    fetch("/api/form-schema", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: addr }) })
      .then((r) => r.json().catch(() => ({})))
      .then((d) => { if (live) setFiling(d && typeof d === "object" ? (d.filing || null) : null); })
      .catch(() => { if (live) setFiling(null); });
    return () => { live = false; };
  }, [lockAddr, address]);

  const linkStyle = { color: "#1d6b41", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2 };
  const whose = (filing && filing.cadName) ? filing.cadName + "'s" : ("your " + jIn.authorityType + "'s");
  const portalWord = jIn.proceeding + " portal";
  let filingItemA;
  if (filing === undefined) {
    filingItemA = <React.Fragment><strong style={{ color: "#16241c" }}>Fastest:</strong> file online through your {jIn.authorityType}'s {portalWord}.</React.Fragment>;
  } else if (filing && filing.efileUrl) {
    filingItemA = <React.Fragment><strong style={{ color: "#16241c" }}>Fastest:</strong> file online at {whose} <a href={filing.efileUrl} target="_blank" rel="noopener" style={linkStyle}>{portalWord} ↗</a>.</React.Fragment>;
  } else if (filing && filing.website) {
    filingItemA = <React.Fragment><strong style={{ color: "#16241c" }}>Fastest:</strong> file online at {whose} <a href={filing.website} target="_blank" rel="noopener" style={linkStyle}>website ↗</a> — look for “Online {titleCase(jIn.proceeding)}”.</React.Fragment>;
  } else {
    const q = encodeURIComponent((String(lockAddr || address || "").replace(/,?\s*USA$/i, "").trim() || jIn.authorityType) + " appraisal district online " + jIn.proceeding);
    filingItemA = <React.Fragment><strong style={{ color: "#16241c" }}>Fastest:</strong> file online through your {jIn.authorityType}'s {jIn.proceeding} portal — <a href={"https://www.google.com/search?q=" + q} target="_blank" rel="noopener" style={linkStyle}>find your district's portal ↗</a>.</React.Fragment>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>

      {/* STEP 1 — Property address */}
      <StepCard num="1" done={done[0]} open={open === 0} onToggle={() => onToggle(0)}
        title="Property address" summary={s1Summary}>
        {linked ? (
          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, border: "1.5px solid #cfe3d6", background: "#f1f8f3", borderRadius: 12, padding: "15px 18px", marginBottom: 14, fontSize: 16, fontWeight: 700, color: "#16241c" }}>
            <span style={{ flexShrink: 0, fontSize: 15 }}>🔒</span>
            <span style={{ flex: 1, minWidth: 0 }}>{address}</span>
            <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#1d6b41", background: "#e3efe6", padding: "3px 9px", borderRadius: 20 }}>YOUR PROPERTY</span>
          </div>
        ) : (
          <input ref={addrRef} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state ZIP" spellCheck="false"
            style={{ ...fieldStyle, marginBottom: 14 }} />
        )}
        {linked ? (
          <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "#5d6f64", fontWeight: 500 }}>This report is locked to the property you purchased. Follow the steps below to file and finish your report.</p>
        ) : null}
        <JurisChips jIn={jIn} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <DarkBtn onClick={() => { if (address.trim()) onMarkDone(0); }}>{linked ? "Yes, this is my property →" : "Continue →"}</DarkBtn>
          <span style={{ fontSize: 13.5, color: "#8a988f", fontWeight: 500 }}>Not right? Contact us at <a href="mailto:admin@taxdrop.com" style={{ color: "#5d6f64", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2 }}>admin@taxdrop.com</a></span>
        </div>
      </StepCard>

      {/* STEP 2 — File your protest */}
      <StepCard num="2" done={done[1]} open={open === 1} onToggle={() => onToggle(1)}
        title={"File your " + (jIn.proceedingTitle || "protest")} summary={s2Summary}>
        <div style={{ background: "#FFF8E1", border: "1px solid #C99700", borderRadius: 10, padding: "12px 16px", display: "flex", gap: 10, alignItems: "baseline", marginBottom: 16, fontSize: 14, color: "#6b4d00", lineHeight: 1.55 }}>
          <span style={{ fontWeight: 800, color: "#9a7400", flexShrink: 0, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>Deadline</span>
          <span>{jIn.deadline || "see your notice"}. File first — the county only shares the evidence behind your value after you {fileWord}.</span>
        </div>
        <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 11, ...body }}>
          <div style={{ display: "flex", gap: 10 }}><span style={{ fontWeight: 800, color: "#0B8F52", flexShrink: 0 }}>a.</span><span>{filingItemA}</span></div>
          <div style={{ display: "flex", gap: 10 }}><span style={{ fontWeight: 800, color: "#0B8F52", flexShrink: 0 }}>b.</span><span><strong style={{ color: "#16241c" }}>Or by mail:</strong> print, sign, and post the form to the address on it — postmark by your deadline.</span></div>
          <div style={{ display: "flex", gap: 10 }}><span style={{ fontWeight: 800, color: "#0B8F52", flexShrink: 0 }}>c.</span><span>After you file, request the {jIn.authorityType}'s evidence — that's the packet you add in step 3.</span></div>
        </div>
        <ProtestFormCard address={lockAddr || address} embedded fallback={
          <div style={{ border: "1px solid #e6ebe6", borderRadius: 10, padding: "16px 18px" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#16241c" }}>{jIn.form} — {jIn.proceedingTitle} ({jIn.stateName})</div>
            <div style={{ fontSize: 14, color: "#3A4148", lineHeight: 1.6, marginTop: 3 }}>Get {jIn.form} from your {jIn.authorityType}, fill in your details, then sign and submit it.</div>
          </div>
        } />
        <DarkBtn onClick={() => onMarkDone(1)}>I've filed my {jIn.proceeding} →</DarkBtn>
      </StepCard>

      {/* STEP 3 — County evidence packet (optional) */}
      <StepCard num="3" done={done[2]} open={open === 2} onToggle={() => onToggle(2)}
        title="County evidence packet" summary={s3Summary}>
        <div style={{ ...body, marginBottom: 14 }}>
          Add this once your {jIn.authorityType} sends its evidence back — you don't need it to submit now. We'll build your case from our own comparables, then re-check it the moment you add the packet.
        </div>
        <EvidenceHowTo stateId={stateFromAddress(address)} jIn={jIn} narrow={narrow} />
        <div onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setDragging(false); }} onDrop={onDrop} onClick={() => fileRef.current && fileRef.current.click()} style={dropStyle}>
          <input type="file" multiple
            accept=".pdf,.xlsx,.xlsm,.xls,.xlsb,.csv,.tsv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            ref={fileRef} onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
          <div style={{ width: 50, height: 50, borderRadius: 13, background: "#e3efe6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><ArrowUp s={22} /></div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#16241c", marginBottom: 6 }}>Drop the county's evidence — PDF, Excel, or CSV</div>
          <div style={{ fontSize: 14, color: "#3A4148", marginBottom: 18, maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.55 }}>Drop one file or several (e.g. the cover-letter PDF plus a comparables sheet). Up to 10&nbsp;MB each. No packet? We'll build the case from our own comps.</div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#27764a,#16542f)", color: "#fff", border: "none", borderRadius: 11, padding: "11px 22px", fontSize: 14.5, fontWeight: 700, boxShadow: "0 4px 12px rgba(22,84,47,.25)" }}><ArrowUp s={15} c="#fff" w={2.2} />{files.length ? "Add more files" : "Add files"}</span>
        </div>
        {files.length > 0 ? (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {files.map((f, idx) => (
              <div key={f.name + ":" + f.size + ":" + idx} style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid #e6ebe6", borderRadius: 12, padding: "13px 16px" }}>
                <div style={{ width: 38, height: 38, borderRadius: 9, background: "#eef3ee", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FileIcon c="#1d6b41" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: "#16241c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                  <div style={{ fontSize: 12.5, color: "#5d6f64", marginTop: 2 }}>{(f.size / 1024 / 1024).toFixed(f.size > 1024 * 1024 ? 1 : 2)} MB</div>
                </div>
                <button onClick={(e) => clearFile(e, idx)} style={{ background: "none", border: "none", color: "#7c8a80", fontSize: 18, cursor: "pointer", fontFamily: "inherit", padding: "4px 8px" }} aria-label="Remove">×</button>
              </div>
            ))}
          </div>
        ) : null}
        {error && status !== "analyzing" ? (
          <div style={{ marginTop: 16, padding: "13px 15px", background: "#fbeceb", border: "1px solid #f0c9c5", borderRadius: 11, color: "#9e2a2a", fontSize: 14, fontWeight: 500 }}>{error}</div>
        ) : null}
        <DarkBtn onClick={() => onMarkDone(2)}>{files.length ? "Evidence added →" : "I'll add it later →"}</DarkBtn>
      </StepCard>

      {/* STEP 4 — Where to send your report + submit */}
      <StepCard num="4" done={done[3]} open={open === 3} onToggle={() => onToggle(3)}
        title="Where to send your report" summary={s4Summary}>
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 12 }}>
          <input value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} placeholder="Full name" style={fieldStyle} />
          <input value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} placeholder="Phone (optional)" inputMode="tel" style={fieldStyle} />
          <input value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} placeholder="Email — where we'll send your report" type="email" style={{ ...fieldStyle, gridColumn: narrow ? "auto" : "1 / -1" }} />
        </div>
        <p style={{ margin: "12px 2px 0", fontSize: 14, color: "#3A4148", fontWeight: 500, lineHeight: 1.55 }}>
          A TaxDrop tax agent reviews every report before it's sent. We'll email your finished report — typically within <strong style={{ color: "#16241c" }}>24–48 hours, Monday–Friday</strong>.
        </p>
        {submitError ? (
          <div style={{ marginTop: 14, padding: "13px 15px", background: "#fbeceb", border: "1px solid #f0c9c5", borderRadius: 11, color: "#9e2a2a", fontSize: 14, fontWeight: 500 }}>{submitError}</div>
        ) : null}
        <button onClick={primaryAction} disabled={primaryDisabled} style={{ ...ctaStyle, cursor: primaryDisabled ? "not-allowed" : "pointer", background: primaryDisabled ? "#b9cabf" : "linear-gradient(135deg,#27764a,#15512e)", boxShadow: primaryDisabled ? "none" : "0 6px 18px rgba(22,84,47,.28)" }}>
          {isAnalyzing ? (
            <React.Fragment>
              <span style={{ width: 16, height: 16, border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: 999, display: "inline-block", animation: "spin .7s linear infinite" }}></span>
              Preparing your report…
            </React.Fragment>
          ) : (
            <React.Fragment>{primaryLabel} <span style={{ fontSize: 17 }}>→</span></React.Fragment>
          )}
        </button>
        {isAnalyzing ? (
          <div style={{ marginTop: 22, borderTop: "1px solid #eef2f0", paddingTop: 20 }}>
            <div style={{ height: 6, borderRadius: 999, background: "#e7eeea", overflow: "hidden", marginBottom: 18 }}>
              <div style={{ width: Math.min((step + 1) / 4, 1) * 100 + "%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#1d6b41,#2bb0c4)", transition: "width .5s ease" }}></div>
            </div>
            {stepLabels.map((label, i) => {
              const d = i < step, active = i === step;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "5px 0" }}>
                  <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: d ? "#fff" : active ? "#1d6b41" : "#b6c2bb", background: d ? "#1d6b41" : active ? "#e3efe6" : "#eef2f0", animation: active ? "pulseDot 1s ease-in-out infinite" : "" }}>{d ? "✓" : active ? "●" : ""}</span>
                  <span style={{ fontSize: 14.5, fontWeight: active || d ? 600 : 500, color: d || active ? "#16241c" : "#9aa6a0" }}>{label}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </StepCard>

    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Redesigned customer report — "Property Report v2" (guided case plan).
   Replaces the analytical recommendation view for real (non-fair) reports with
   an action-first, jurisdiction-aware plan: case-strategy banner → the numbers →
   why you're overpaying → four worked steps (File → Evidence → Negotiate →
   Hearing). Driven entirely by the live `r` object (no static sample data).
   ═══════════════════════════════════════════════════════════════════════════ */

const REPORT_PROGRESS_KEY = "td_one_report_progress_v2";

// Verb that fronts the case-strategy sentence, keyed off the proceeding type.
const PROCEEDING_VERB = { protest: "Protest", appeal: "Appeal", petition: "Petition" };

// Per-state specifics the flat JURISDICTIONS config doesn't carry — the pieces
// of the step copy that are genuinely state-shaped (who reviews informally, how
// you appear at a hearing, how the settlement is recorded). Values not present
// fall back to TX phrasing so a new state never renders blanks.
const REPORT_EXTRAS = {
  TX: {
    reviewer: "a district appraiser",
    settleTitle: "How Settle & Waiver works",
    settleVerb: "sign a settlement agreement and waive your right to a hearing for this year",
    boardKind: "a panel of citizens — not the appraisal district",
    affidavitLabel: "By affidavit — no attendance",
    affidavit: "Sign the affidavit before a notary and submit it with your evidence before the hearing. The board rules on paper — you never appear.",
    inPerson: "Bring 4 printed copies of your evidence — one per panelist, one for the appraiser.",
    remote: "Texas districts offer telephone and web-conference hearings — request one when your hearing is scheduled, and submit evidence in advance.",
    findDate: "the board mails a hearing notice at least 15 days ahead with your date, time, and joining instructions — reschedule once, free, if the time doesn't work.",
  },
  CA: {
    reviewer: "an Assessor's office reviewer",
    settleTitle: "How stipulations work",
    settleVerb: "sign a stipulation and your appeal is withdrawn for this year",
    boardKind: "an independent panel — not the Assessor's office",
    affidavitLabel: "In writing — where offered",
    affidavit: "Ask the Clerk of the Board about appearing by sworn written declaration — you submit evidence in advance instead of attending.",
    inPerson: "Bring 5 printed copies of your evidence — one per member, one for the Assessor's rep.",
    remote: "Many California boards offer video and phone hearings — request one when your hearing is scheduled, and submit evidence in advance.",
    findDate: "the Clerk of the Board mails a hearing notice ahead of time with your date, time, and joining instructions. One reschedule is typically allowed.",
  },
  GA: {
    reviewer: "a Board of Assessors appraiser",
    settleTitle: "How amended notices work",
    settleVerb: "accept a 30-day amended notice — and a value set on appeal is typically frozen for two more years",
    boardKind: "a panel of trained citizens — not the assessors' office",
    affidavitLabel: "In writing — limited",
    affidavit: "Most Georgia counties expect attendance, but you may submit a sworn written statement with your evidence if you can't appear — ask the Clerk.",
    inPerson: "Bring 4 printed copies of your evidence — one per panelist, one for the appraiser.",
    remote: "Many Georgia counties offer phone and video hearings on request — ask when your hearing is scheduled, and submit evidence in advance.",
    findDate: "the Clerk mails a hearing notice ahead of time with your date, time, and joining instructions. One reschedule is usually allowed with cause.",
  },
  FL: {
    reviewer: "the property appraiser's office",
    settleTitle: "How a settlement works",
    settleVerb: "accept the appraiser's adjustment and withdraw your petition for this year",
    boardKind: "an independent board with a special magistrate — not the property appraiser",
    affidavitLabel: "In writing — where offered",
    affidavit: "Ask the VAB clerk about submitting written evidence in lieu of appearing — rules vary by county.",
    inPerson: "Bring copies of your evidence for the magistrate and the appraiser's rep.",
    remote: "Many Florida VABs offer telephone hearings on request — ask when your hearing is scheduled.",
    findDate: "the VAB clerk mails a hearing notice at least 25 days ahead with your date, time, and joining instructions.",
  },
};

function medianOf(arr) {
  const a = arr.filter((v) => v != null && !isNaN(v)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// Everything the report needs, computed once from the live `r`.
function buildReport(r) {
  const j = r.jurisdiction || {};
  const stateId = j.id || "TX";
  const ex = REPORT_EXTRAS[stateId] || REPORT_EXTRAS.TX;
  const subj = r.subject || {};

  const notice = r.notice, target = r.target;
  const reduction = r.reduction || 0;
  const pct = r.pct || 0;
  const taxSaved = r.taxSaved || 0;
  const SF = r.subjSqft || Number(subj.living_sqft) || 0;

  const comps = (Array.isArray(r.comps) ? r.comps : []).filter((c) => c && c.val != null);
  const n = comps.length;
  const compPsfs = comps
    .map((c) => (c.val && (c.sqft || SF) ? c.val / (c.sqft || SF) : null))
    .filter((v) => v != null);
  const medianPsf = compPsfs.length ? medianOf(compPsfs) : (target && SF ? target / SF : null);
  const medianVal = comps.length ? medianOf(comps.map((c) => c.val)) : null;
  const subjPsf = notice && SF ? notice / SF : null;
  const gapPct = subjPsf && medianPsf ? ((subjPsf - medianPsf) / medianPsf) * 100 : null;
  // Ceiling to accept at a hearing before walking — the county's own kept median
  // (or our backup anchor). Falls back to the requested value when neither exists.
  const fallbackVal = (r.backupInfo && r.backupInfo.value) || medianVal || target;

  const county = titleCase(String(subj.county_name || subj.county || "").replace(/\s+county$/i, "")).trim();
  const parcelId = subj.parcel_id || subj.account_number || subj.apn || subj.geo_id || "";
  const parcelLabel = stateId === "CA" ? "APN" : (stateId === "TX" ? "parcel" : "parcel");
  const metaParts = [];
  if (county) metaParts.push(county + " County");
  if (parcelId) metaParts.push(parcelLabel + " " + parcelId);
  if (SF) metaParts.push(SF.toLocaleString("en-US") + " sqft");
  if (subj.year_built) metaParts.push("built " + subj.year_built);
  const meta = metaParts.join(" · ");

  const verb = PROCEEDING_VERB[j.proceeding] || "Protest";
  const psf = (v) => (v ? "$" + Math.round(v) + "/sqft" : "—");
  const authority = j.authority || ("your " + (j.authorityType || "appraisal district"));

  // ── Case-strategy sentence ──
  const banner = n
    ? verb + " your " + fmt(notice) + " " + (j.proceeding === "protest" ? "notice" : "assessment") +
      " using " + n + " comparable home" + (n === 1 ? "" : "s") + " at a " + psf(medianPsf) +
      " median — requesting " + fmt(target) + ", a " + fmt(reduction) + " reduction (" + pct.toFixed(1) +
      "%) worth ~" + fmt(taxSaved) + "/yr."
    : verb + " your " + fmt(notice) + " " + (j.proceeding === "protest" ? "notice" : "assessment") +
      " down to " + fmt(target) + " — a " + fmt(reduction) + " reduction (" + pct.toFixed(1) +
      "%) worth ~" + fmt(taxSaved) + "/yr.";

  const noun = j.proceeding === "protest" ? "notice" : "assessment";
  const equalLaw = stateId === "CA"
    ? "Assessments must reflect fair market value — comparable evidence like this is exactly what the board weighs."
    : "Similar homes must be valued alike — so the county's own numbers make your case.";

  // ── Deadline strip ──
  const deadlineStrip = {
    bold: (j.proceeding === "protest" ? "Filing deadline: " : "Filing window: ") + (j.deadline || "your county's window"),
    rest: "Your exact deadline is printed on your " + noun + " — always go by that date. Missing it forfeits this year's " + j.proceeding + ".",
  };

  // ── Email script (informal settlement) ──
  const emailSubject = "Informal review request — " + (parcelId ? parcelLabel + " " + parcelId + ", " : "") +
    (r.address || "") + " (" + (r.dataYear || CURRENT_TAX_YEAR) + " " + j.proceeding + ")";
  const emailP1 = "I've filed a " + (r.dataYear || CURRENT_TAX_YEAR) + " " + j.proceeding + " for " +
    (r.address || "this property") + " and would like to resolve it informally. My " + noun + " of " + fmt(notice) +
    (subjPsf ? " works out to " + psf(subjPsf) + ", while " : ", while ") + n + " comparable home" + (n === 1 ? "" : "s") +
    " on the " + (stateId === "TX" ? "district's" : "county's") + " own rolls — same class, similar size and age — carry a median of " +
    psf(medianPsf) + " (evidence attached).";
  const emailP2 = "Applying the " + (stateId === "TX" ? "district's" : "county's") + " own median to my home supports a value of " +
    fmt(target) + ", and I'm requesting that adjustment. I'm happy to settle at a number consistent with the attached evidence.";
  const emailText = "Subject: " + emailSubject + "\n\nHello,\n\n" + emailP1 + "\n\n" + emailP2 +
    "\n\nThank you,\n[Your name] · [Phone]";

  // ── Hearing script ──
  const strongTwo = comps
    .filter((c) => c.val != null && c.val < notice)
    .sort((a, b) => a.val - b.val)
    .slice(0, 2);
  const hs = [
    { t: "Introduce yourself", b: "“Good morning. My name is [your name], and I own the home at " + (r.address || "my property") + ". I'm representing myself today, and I have a short packet of evidence — this will take about five minutes.”" },
    { t: "State your ask", b: "“I'm requesting a reduction of my " + noun + " from " + fmt(notice) + " to " + fmt(target) + ".”" },
    { t: "Present the comparison", b: "“My packet lists " + (n || "several") + " comparable homes from the county's own records — same classification, similar size and age, near my home. Their median value is " + psf(medianPsf) + " per square foot" + (subjPsf ? ", while mine is assessed at " + psf(subjPsf) + " — the highest of the group." : ".") + "”" },
  ];
  if (strongTwo.length) {
    hs.push({
      t: "Highlight the strongest comps",
      b: "“The strongest comparables are " + strongTwo.map((c) => c.addr).join(" and ") +
        " — both valued well below my " + noun + ", by the county's own numbers.”",
    });
  }
  hs.push({ t: "Present the math", b: "“Applying that " + psf(medianPsf) + " median to my " + (SF ? SF.toLocaleString("en-US") + " square feet" : "home") + " comes to " + fmt(target) + " — the value I'm requesting today.”" });
  hs.push({ t: "If they question the comps", b: "“These are the assessor's own current values, not old sale prices — so they reflect the same market as my " + noun + ".”" });
  hs.push({ t: "Close", b: "“Unless there are questions, I'll close: the county's own records support " + fmt(target) + ", and I respectfully ask the panel to set my value there. Thank you.”" });
  hs.push({ t: "Your fallback — don't read aloud", b: "The panel may propose a middle number. Accept anything at or below " + fmt(fallbackVal) + " — still a real reduction. The decision is mailed and binding." });
  const hearingText = "HEARING SCRIPT — " + (r.address || "") + "\n\n" +
    hs.map((s, i) => (i + 1) + ". " + s.t + ": " + s.b).join("\n\n");

  return {
    j, stateId, ex, subj, notice, target, reduction, pct, taxSaved, SF, comps, n,
    medianPsf, medianVal, subjPsf, gapPct, fallbackVal, meta, county, parcelId, parcelLabel,
    verb, noun, authority, banner, equalLaw, deadlineStrip,
    emailSubject, emailP1, emailP2, emailText, hearingSteps: hs, hearingText, psf,
    dataYear: r.dataYear || CURRENT_TAX_YEAR,
  };
}

/* ───────── dark top bar (report chrome) ───────── */
function ReportTopBar({ narrow }) {
  return (
    <header style={{ background: "#111111", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", padding: narrow ? "0 16px" : "0 24px", height: 52 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", background: "#fff", borderRadius: 6, padding: "5px 8px" }}>
          <img src={LOGO} alt="TaxDrop" style={{ height: 22, width: "auto", display: "block" }} />
        </span>
        <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.25)" }}></span>
        <span style={{ fontWeight: 600, fontSize: 15, color: "#fff" }}>One</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {narrow ? null : <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.85)" }}>Tax Year {CURRENT_TAX_YEAR}</span>}
        <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", background: "#C4FF64", color: "#111", borderRadius: 4, padding: "4px 9px", textTransform: "uppercase" }}>Report ready</span>
      </div>
    </header>
  );
}

/* ───────── property strip + progress ───────── */
function PropertyStrip({ b, address, doneCount, narrow, onReset, showReset }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: narrow ? "12px 16px" : "13px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
        <span style={{ fontWeight: 800, fontSize: narrow ? 15.5 : 18, letterSpacing: "-0.01em", color: "#111" }}>{address}</span>
        {b.meta ? <span style={{ fontSize: 13.5, color: "#3A4148" }}>{b.meta}</span> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 120, height: 6, background: "#E5E7EB", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#0B8F52", borderRadius: 999, transition: "width 300ms ease", width: (doneCount / 4 * 100) + "%" }}></div>
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#0C593E", fontVariantNumeric: "tabular-nums" }}>{doneCount} of 4 steps</span>
        </div>
        {showReset ? <span onClick={onReset} style={{ fontSize: 12.5, fontWeight: 600, color: "#8a988f", borderBottom: "1px solid #c7d2c7", cursor: "pointer" }}>Start over</span> : null}
      </div>
    </div>
  );
}

/* ───────── stat card ───────── */
function StatCard({ label, value, sub, emphasize, strong }) {
  return (
    <div style={{ background: "#fff", border: emphasize ? "1.5px solid #111" : "1px solid #E5E7EB", borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: emphasize ? "#0C593E" : "#3A4148", marginBottom: 7 }}>{label}</div>
      <div style={{ fontWeight: 800, fontSize: 22, color: strong ? "#0C593E" : "#111", fontVariantNumeric: "tabular-nums" }}>{value}{sub ? <span style={{ fontSize: 14, color: "#3A4148", fontWeight: 700 }}>{sub}</span> : null}</div>
    </div>
  );
}

/* ───────── accordion step shell ───────── */
function StepCard({ num, done, open, title, summary, onToggle, children }) {
  const numBg = done ? "#0B8F52" : (open ? "#111" : "#F4F6F8");
  const numColor = done ? "#fff" : (open ? "#fff" : "#1A1A1A");
  return (
    <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: open ? "1.5px solid #111" : "1px solid #E5E7EB", boxShadow: open ? "0 8px 24px rgba(17,17,17,0.08)" : "none" }}>
      <button onClick={onToggle} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", display: "flex", alignItems: "center", gap: 15, width: "100%", padding: "16px 20px" }}>
        <span style={{ width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15.5, flexShrink: 0, background: numBg, color: numColor }}>{done ? "✓" : num}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontWeight: 800, fontSize: 17, color: "#1A1A1A" }}>{title}</span>
          <span style={{ display: "block", fontSize: 14, color: "#3A4148", marginTop: 2 }}>{summary}</span>
        </span>
        <span style={{ color: "#5C666F", fontSize: 14, transition: "transform 200ms ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
      </button>
      {open ? <div style={{ padding: "4px 20px 22px", borderTop: "1px solid #F4F6F8" }}>{children}</div> : null}
    </div>
  );
}

/* ───────── small helpers used inside steps ───────── */
function CopyPanel({ title, onCopy, children }) {
  return (
    <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#F4F6F8", borderBottom: "1px solid #E5E7EB", gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3A4148" }}>{title}</span>
        <button onClick={onCopy} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", background: "#111", color: "#fff", fontWeight: 600, fontSize: 13, padding: "6px 12px", borderRadius: 6 }}>Copy</button>
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  );
}

const GreenBtn = ({ onClick, disabled, children }) => (
  <button onClick={onClick} disabled={disabled} style={{ all: "unset", boxSizing: "border-box", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, background: "#0B8F52", color: "#fff", fontWeight: 600, fontSize: 14.5, padding: "9px 16px", borderRadius: 7 }}>{children}</button>
);
const GhostBtn = ({ onClick, disabled, href, children }) => {
  const style = { boxSizing: "border-box", textDecoration: "none", display: "inline-block", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1, background: "#fff", color: "#0C593E", border: "1px solid #C3C9CF", fontWeight: 600, fontSize: 14.5, padding: "9px 16px", borderRadius: 7 };
  if (href) return <a href={href} target="_blank" rel="noopener" style={style}>{children}</a>;
  return <button onClick={onClick} disabled={disabled} style={{ all: "unset", ...style }}>{children}</button>;
};
const DarkBtn = ({ onClick, children }) => (
  <button onClick={onClick} style={{ all: "unset", boxSizing: "border-box", cursor: "pointer", marginTop: 18, background: "#111", color: "#fff", fontWeight: 600, fontSize: 15, padding: "11px 20px", borderRadius: 7 }}>{children}</button>
);

/* ───────── the redesigned report ───────── */
function ReportView({ r, onReset, address, lockAddr, cadRaw, cadMethod, stored }) {
  const narrow = useNarrow(720);
  const b = React.useMemo(() => buildReport(r), [r]);
  const j = b.j;

  // Read-quality backstop (carried over from the prior report view): never show a
  // wall of identical comps, and surface any packet-parse warning. The engine
  // guard (analyzer.js) already empties an all-identical comp set; this protects
  // the UI against a stale analyzer or a future regression. (Victoria CAD, 2026-06-29.)
  const compsDegenerate =
    Array.isArray(b.comps) && b.comps.length >= 2 &&
    new Set(b.comps.map((c) => Math.round(c.val))).size === 1;
  const showComps = b.comps.length && !compsDegenerate;
  const readNotice = (r.dataQuality && r.dataQuality.message) ||
    (compsDegenerate
      ? "Every comparable read back at the same value — the packet's comparable grid couldn't be read individually. Re-upload a clearer copy or check the packet before relying on this."
      : null);

  // Progress (persisted, mirrors the mockup).
  const [done, setDone] = React.useState(() => {
    try { const s = JSON.parse(localStorage.getItem(REPORT_PROGRESS_KEY)); if (s && Array.isArray(s.done)) return s.done; } catch (e) {}
    return [false, false, false, false];
  });
  const [open, setOpen] = React.useState(() => {
    try { const s = JSON.parse(localStorage.getItem(REPORT_PROGRESS_KEY)); if (s && typeof s.open === "number") return s.open; } catch (e) {}
    return 0;
  });
  const persist = (nextDone, nextOpen) => {
    setDone(nextDone); setOpen(nextOpen);
    try { localStorage.setItem(REPORT_PROGRESS_KEY, JSON.stringify({ done: nextDone, open: nextOpen })); } catch (e) {}
  };
  const toggle = (i) => persist(done, open === i ? -1 : i);
  const markDone = (i) => { const nd = done.slice(); nd[i] = true; persist(nd, nd.indexOf(false)); };
  const doneCount = done.filter(Boolean).length;
  const allDone = doneCount === 4;

  // Toast.
  const [toast, setToast] = React.useState(null);
  const toastTimer = React.useRef(null);
  const showToast = (m) => { clearTimeout(toastTimer.current); setToast(m); toastTimer.current = setTimeout(() => setToast(null), 2600); };
  React.useEffect(() => () => clearTimeout(toastTimer.current), []);
  const copyText = (text, ok) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast(ok), () => showToast("Couldn't copy automatically — select the text instead."));
    } else { showToast("Couldn't copy automatically — select the text instead."); }
  };

  // Exports (same machinery as the analytical view).
  const [exporting, setExporting] = React.useState("");
  const HANDOFF_KEY = "taxdrop-analyzer-handoff";
  const hasCad = cadRaw && !cadRaw.demo;
  const triggerExport = (which, format) => {
    if (exporting) return;
    setExporting(which + ":" + format);
    const addr = encodeURIComponent((address || "").trim());
    let url = "";
    if (which === "our") {
      url = stored ? "/test/evidence-pack-v3?review=1&export=" + format : "/test/evidence-pack-v3?address=" + addr + "&export=" + format;
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
  const busy = (id) => exporting === id;

  const statCols = narrow ? "repeat(2, 1fr)" : "repeat(4, 1fr)";
  const mainPad = narrow ? "18px 14px 64px" : "28px 24px 80px";
  const maxW = 920;

  // County-facing attachment: the real analyzer county pack when a CAD packet is
  // present, else our own evidence pack (both defensible to hand the appraiser).
  const countyAttach = () => triggerExport(hasCad ? "cad-county" : "our", "pdf");

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: "#1A1A1A", minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F4F6F8" }}>
      <ReportTopBar narrow={narrow} />
      <PropertyStrip b={b} address={r.address || address} doneCount={doneCount} narrow={narrow} onReset={onReset} showReset={!stored && !!onReset} />

      <main style={{ width: "100%", maxWidth: maxW, margin: "0 auto", padding: mainPad, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 22 }}>

        {/* Case strategy banner */}
        <section style={{ background: "#111", color: "#fff", borderRadius: 12, padding: narrow ? "18px 18px" : "22px 26px" }}>
          <span style={{ display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#111", background: "#C4FF64", borderRadius: 4, padding: "4px 9px", marginBottom: 12 }}>Case strategy</span>
          <p style={{ fontWeight: 700, fontSize: narrow ? 18 : 21, lineHeight: 1.45, letterSpacing: "-0.01em", margin: 0 }}>{b.banner}</p>
        </section>

        {/* Notice strips */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 16px", fontSize: 14.5, color: "#3A4148", display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ color: "#0B8F52", fontSize: 12 }}>►</span>
            <span><strong>{b.deadlineStrip.bold}</strong> — {b.deadlineStrip.rest}</span>
          </div>
          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 16px", fontSize: 14.5, color: "#3A4148", display: "flex", gap: 10, alignItems: "baseline" }}>
            <span style={{ color: "#0B8F52", fontSize: 12 }}>►</span>
            <span>{stored
              ? <React.Fragment><strong>Expert-reviewed</strong> — a licensed TaxDrop agent signed off on this case before it reached you.</React.Fragment>
              : <React.Fragment><strong>County's own numbers</strong> — every value here comes from the {b.stateId === "TX" ? "appraisal district's" : "county's"} own records, not sale prices.</React.Fragment>}</span>
          </div>
        </div>

        {/* Data-quality / mismatch / prior-year notices */}
        {r.cadMismatch ? (
          <div style={{ background: "#FFF7E6", border: "1px solid #F3C97D", borderLeft: "4px solid #D68A14", borderRadius: 10, padding: "12px 16px", color: "#5A3E0A", fontSize: 13.5, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ Uploaded packet doesn't match this address</div>
            The packet shows {fmt(r.cadMismatch.cadAssessed)}, but the record for this address shows {fmt(r.cadMismatch.engineNotice)} — it's been set aside for this report.
          </div>
        ) : null}
        {r.priorYearOnly ? (
          <div style={{ background: "#EEF4FB", border: "1px solid #BCD6F0", borderLeft: "4px solid #3B7DC4", borderRadius: 10, padding: "12px 16px", color: "#244966", fontSize: 13.5, lineHeight: 1.5 }}>
            <strong>Based on your {b.dataYear} county data.</strong> The {CURRENT_TAX_YEAR} roll isn't published yet, so this uses the most recent values on file.
          </div>
        ) : null}

        {/* Stat row */}
        <section style={{ display: "grid", gridTemplateColumns: statCols, gap: 10 }}>
          <StatCard label={b.noun === "notice" ? "Noticed value" : "Assessed value"} value={fmt(b.notice)} />
          <StatCard label="Recommended ask" value={fmt(b.target)} emphasize strong />
          <StatCard label="Reduction" value={fmt(b.reduction)} />
          <StatCard label="Est. tax saved" value={fmt(b.taxSaved)} sub="/yr" emphasize />
        </section>

        {/* Why you may be overpaying */}
        {b.subjPsf && b.medianPsf ? (
          <section style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: narrow ? "20px 20px" : "22px 26px" }}>
            <h2 style={{ fontWeight: 800, fontSize: 18, margin: "0 0 4px" }}>Why you may be overpaying</h2>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "#3A4148", margin: "0 0 16px", maxWidth: 720 }}>
              This year the {b.stateId === "TX" ? "county" : "assessor"} set your value at <strong>{b.psf(b.subjPsf)}</strong>. But on the {b.stateId === "TX" ? "county's" : "county's"} own books, {b.n} comparable home{b.n === 1 ? "" : "s"} in your area carry a median of just <strong>{b.psf(b.medianPsf)}</strong>. {b.equalLaw} Applying their median to your home supports a value of <strong>{fmt(b.target)}</strong>.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: statCols, gap: 10 }}>
              <div style={{ background: "#F4F6F8", borderRadius: 8, padding: "12px 14px" }}><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3A4148", marginBottom: 4 }}>Your rate</div><div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{b.psf(b.subjPsf)}</div></div>
              <div style={{ background: "#F4F6F8", borderRadius: 8, padding: "12px 14px" }}><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3A4148", marginBottom: 4 }}>Neighbors' median</div><div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{b.psf(b.medianPsf)}</div></div>
              <div style={{ background: "#F4F6F8", borderRadius: 8, padding: "12px 14px" }}><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3A4148", marginBottom: 4 }}>Gap</div><div style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{b.gapPct != null ? b.gapPct.toFixed(1) + "% high" : "—"}</div></div>
              <div style={{ background: "#F0FFF5", borderRadius: 8, padding: "12px 14px" }}><div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C593E", marginBottom: 4 }}>Supported value</div><div style={{ fontSize: 18, fontWeight: 700, color: "#0C593E", fontVariantNumeric: "tabular-nums" }}>{fmt(b.target)}</div></div>
            </div>
          </section>
        ) : null}

        {/* All-done banner */}
        {allDone ? (
          <section style={{ background: "#DFFFEA", border: "1.5px solid #0B8F52", borderRadius: 12, padding: "18px 22px", display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 34, height: 34, borderRadius: 8, background: "#0B8F52", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>✓</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#0C593E" }}>You're set — every step is prepared.</div>
              <div style={{ fontSize: 14.5, color: "#3A4148", marginTop: 2 }}>Keep this report handy through settlement and (if needed) your hearing.</div>
            </div>
          </section>
        ) : null}

        {/* Steps */}
        <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 style={{ fontWeight: 800, fontSize: 18, margin: "6px 0 0" }}>Your {j.proceeding}, step by step <span style={{ fontWeight: 400, fontSize: 14, color: "#3A4148" }}>· work through them in order</span></h2>

          {/* STEP 1 — File */}
          <StepCard num="1" done={done[0]} open={open === 0} onToggle={() => toggle(0)}
            title={"File your " + (j.proceedingTitle || "protest")}
            summary={(j.form ? j.form + " for " + b.authority + ". " : "") + "Deadline: " + (j.deadline || "see your notice") + "."}>
            <div style={{ background: "#FFF8E1", border: "1px solid #C99700", borderRadius: 8, padding: "11px 15px", display: "flex", gap: 10, alignItems: "baseline", margin: "16px 0 14px", fontSize: 14.5, color: "#3A4148", maxWidth: 720 }}>
              <span style={{ fontWeight: 700, color: "#C99700", flexShrink: 0, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>Deadline</span>
              <span>{b.deadlineStrip.bold}. {b.deadlineStrip.rest}</span>
            </div>
            <ProtestFormCard address={lockAddr || address} embedded fallback={
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "16px 18px", maxWidth: 720 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5 }}>{j.form} — {j.proceedingTitle} ({j.stateName})</div>
                <div style={{ fontSize: 14, color: "#3A4148", lineHeight: 1.6, marginTop: 3 }}>Get {j.form} from {b.authority}. Fill in your name{b.parcelId ? ", " + b.parcelLabel + " " + b.parcelId : ""}, and your requested value {fmt(b.target)} — then sign and submit.</div>
              </div>
            } />
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 9, maxWidth: 720 }}>
              <div style={{ display: "flex", gap: 11, fontSize: 14.5, lineHeight: 1.6, color: "#3A4148" }}><span style={{ fontWeight: 700, color: "#0B8F52", flexShrink: 0 }}>a.</span><span><strong>Fastest:</strong> file online through {b.authority}'s appeals portal — register with your {b.parcelLabel} number and upload the signed form.</span></div>
              <div style={{ display: "flex", gap: 11, fontSize: 14.5, lineHeight: 1.6, color: "#3A4148" }}><span style={{ fontWeight: 700, color: "#0B8F52", flexShrink: 0 }}>b.</span><span><strong>Or by mail:</strong> print, sign, and post it to the address on the form — postmark by your deadline.</span></div>
              <div style={{ display: "flex", gap: 11, fontSize: 14.5, lineHeight: 1.6, color: "#3A4148" }}><span style={{ fontWeight: 700, color: "#0B8F52", flexShrink: 0 }}>c.</span><span>You'll get a confirmation and, later, an informal review offer — that's step 3.</span></div>
            </div>
            <DarkBtn onClick={() => markDone(0)}>I've filed — next: my evidence →</DarkBtn>
          </StepCard>

          {/* STEP 2 — Evidence */}
          <StepCard num="2" done={done[1]} open={open === 1} onToggle={() => toggle(1)}
            title="Review, then submit the evidence"
            summary={(showComps ? b.comps.length + " comps from the county's own books. " : "Your evidence pack. ") + "Download as PDF, or DOCX to refine."}>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#3A4148", margin: "16px 0 12px", maxWidth: 720 }}>These are the {b.stateId === "TX" ? "district's" : "county's"} <strong>own assessed values</strong> for comparable homes — not sale prices, so they're hard for the county to dispute. Your requested value follows their median.</p>
            {readNotice ? (
              <div style={{ background: "#FFF8E1", border: "1px solid #C99700", borderRadius: 8, padding: "11px 15px", fontSize: 14, lineHeight: 1.55, color: "#7a5800", maxWidth: 720, marginBottom: showComps ? 12 : 0 }}>
                <strong>Heads up — part of this packet couldn't be read cleanly.</strong> {readNotice}
              </div>
            ) : null}
            {showComps ? (
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 84px 116px 72px", gap: 12, alignItems: "center", padding: "9px 16px", background: "#F4F6F8", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#3A4148", minWidth: 480 }}>
                  <span></span><span>Address</span><span style={{ textAlign: "right" }}>Sqft</span><span style={{ textAlign: "right" }}>Value</span><span style={{ textAlign: "right" }}>Per sqft</span>
                </div>
                {b.comps.map((c, i) => {
                  const sf = c.sqft || b.SF;
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "22px 1fr 84px 116px 72px", gap: 12, alignItems: "center", padding: "11px 16px", borderTop: "1px solid #F4F6F8", fontSize: 14.5, minWidth: 480 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: "#111", color: "#fff", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{String.fromCharCode(65 + i)}</span>
                      <span style={{ fontWeight: 500 }}>{c.addr}{c.note ? <span style={{ fontSize: 11, fontWeight: 600, color: "#a87722", marginLeft: 6 }}>· {c.note}</span> : null}</span>
                      <span style={{ textAlign: "right", color: "#3A4148", fontVariantNumeric: "tabular-nums" }}>{sf ? Math.round(sf).toLocaleString("en-US") : "—"}</span>
                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(c.val)}</span>
                      <span style={{ textAlign: "right", fontWeight: 600, color: "#0C593E", fontVariantNumeric: "tabular-nums" }}>{c.val && sf ? "$" + Math.round(c.val / sf) : "—"}</span>
                    </div>
                  );
                })}
                <div style={{ display: "grid", gridTemplateColumns: "22px 1fr 84px 116px 72px", gap: 12, alignItems: "center", padding: "11px 16px", borderTop: "1.5px solid #E5E7EB", background: "#F0FFF5", fontSize: 14.5, fontWeight: 700, minWidth: 480 }}>
                  <span></span><span>Median</span><span></span><span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(b.medianVal)}</span><span style={{ textAlign: "right", color: "#0C593E", fontVariantNumeric: "tabular-nums" }}>{b.medianPsf ? "$" + Math.round(b.medianPsf) : "—"}</span>
                </div>
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <GreenBtn onClick={() => triggerExport("our", "pdf")} disabled={!!exporting}>{busy("our:pdf") ? "Generating…" : "Download evidence packet (PDF)"}</GreenBtn>
              <GhostBtn onClick={() => triggerExport("our", "docx")} disabled={!!exporting}>{busy("our:docx") ? "Generating…" : "Editable version (DOCX)"}</GhostBtn>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "#3A4148", margin: "12px 0 0", maxWidth: 720 }}>Looks right? Upload the PDF with your {j.proceeding} (or in your appeals portal). Want to add photos of needed repairs or drop a comp? Edit the DOCX first — every extra flaw you document helps.</p>
            <DarkBtn onClick={() => markDone(1)}>Evidence submitted — next: negotiate →</DarkBtn>
          </StepCard>

          {/* STEP 3 — Informal settlement */}
          <StepCard num="3" done={done[2]} open={open === 2} onToggle={() => toggle(2)}
            title="Informal settlement negotiations"
            summary={"Most " + j.proceeding + "s end here. Email script, county-facing evidence, and tactics included."}>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#3A4148", margin: "16px 0 14px", maxWidth: 720 }}>After you file, {b.ex.reviewer} reviews your case and can settle by email or phone — no hearing needed. Your leverage: the evidence uses <strong>their own assessed values</strong>. Send the email below with the county-facing evidence attached, then let them respond.</p>

            <div style={{ maxWidth: 800 }}>
              <CopyPanel title="Email script — copy & paste" onCopy={() => copyText(b.emailText, "Email copied — paste it to the appraiser.")}>
                <div style={{ fontSize: 14.5, lineHeight: 1.7, color: "#1A1A1A" }}>
                  <div style={{ color: "#3A4148", marginBottom: 10 }}><strong style={{ color: "#1A1A1A" }}>Subject:</strong> {b.emailSubject}</div>
                  <p style={{ margin: "0 0 10px" }}>Hello,</p>
                  <p style={{ margin: "0 0 10px" }}>{b.emailP1}</p>
                  <p style={{ margin: "0 0 10px" }}>{b.emailP2}</p>
                  <p style={{ margin: 0 }}>Thank you,<br />[Your name] · [Phone]</p>
                </div>
              </CopyPanel>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <GreenBtn onClick={countyAttach} disabled={!!exporting}>{busy("cad-county:pdf") || busy("our:pdf") ? "Generating…" : "Download county-facing attachment (PDF)"}</GreenBtn>
              <span style={{ fontSize: 13.5, color: "#3A4148" }}>Your comps + a one-page explanation, written for the appraiser.</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 12, marginTop: 16, maxWidth: 800 }}>
              <div style={{ background: "#F0FFF5", border: "1px solid #DFFFEA", borderRadius: 10, padding: "15px 17px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C593E", marginBottom: 7 }}>{b.ex.settleTitle}</div>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "#3A4148", margin: 0 }}>If you accept the offer, you {b.ex.settleVerb}. It's final — so only agree at or below your fallback of {fmt(b.fallbackVal)}. Above that, decline politely and keep your hearing date.</p>
              </div>
              <div style={{ background: "#F4F6F8", border: "1px solid #E5E7EB", borderRadius: 10, padding: "15px 17px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#3A4148", marginBottom: 7 }}>Negotiation tactics</div>
                <ul style={{ fontSize: 14, lineHeight: 1.6, color: "#3A4148", margin: 0, paddingLeft: 18 }}>
                  <li><strong>Anchor first</strong> at {fmt(b.target)} — let them counter.</li>
                  <li><strong>Stay on equity</strong>: their values, not your opinion.</li>
                  <li><strong>Silence is fine</strong> — don't bid against yourself.</li>
                  <li><strong>Get offers in writing</strong> before signing anything.</li>
                </ul>
              </div>
            </div>
            <DarkBtn onClick={() => markDone(2)}>Settled or heading to hearing →</DarkBtn>
          </StepCard>

          {/* STEP 4 — Formal hearing */}
          <StepCard num="4" done={done[3]} open={open === 3} onToggle={() => toggle(3)}
            title="Formal hearing (if it comes to that)"
            summary={"Only 10–15% of cases get here. If yours does, you'll walk in prepared."}>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: "#3A4148", margin: "16px 0 14px", maxWidth: 720 }}>The {j.boardLong} ({j.boardShort}) is {b.ex.boardKind}. Hearings run about 15 minutes, and homeowners represent themselves all the time. You have three ways to appear:</p>

            <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(3, 1fr)", gap: 10, maxWidth: 800 }}>
              {[[b.ex.affidavitLabel, b.ex.affidavit], ["In person", b.ex.inPerson], ["By phone or video", b.ex.remote]].map((a, i) => (
                <div key={i} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C593E", marginBottom: 6 }}>{a[0]}</div>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#3A4148", margin: 0 }}>{a[1]}</p>
                </div>
              ))}
            </div>

            <div style={{ background: "#F4F6F8", border: "1px solid #E5E7EB", borderRadius: 10, padding: "13px 16px", marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "#3A4148", maxWidth: 800 }}><strong>Finding your date:</strong> {b.ex.findDate}</div>

            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <GreenBtn onClick={() => triggerExport("our", "pdf")} disabled={!!exporting}>{busy("our:pdf") ? "Generating…" : "Download hearing evidence (PDF)"}</GreenBtn>
              <GhostBtn href="https://onenotary.com">Need a notary? OneNotary.com ↗</GhostBtn>
            </div>

            <div style={{ maxWidth: 800, marginTop: 16 }}>
              <CopyPanel title="Your hearing script — word for word" onCopy={() => copyText(b.hearingText, "Script copied — keep it on your phone.")}>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {b.hearingSteps.map((s, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0C593E", marginBottom: 4 }}>{i + 1} · {s.t}</div>
                      <div style={{ fontSize: 14.5, lineHeight: 1.65 }}>{s.b}</div>
                    </div>
                  ))}
                </div>
              </CopyPanel>
            </div>
            <DarkBtn onClick={() => markDone(3)}>I'm ready — finish ✓</DarkBtn>
          </StepCard>
        </section>

        <p style={{ fontSize: 13, lineHeight: 1.6, color: "#3A4148", textAlign: "center", margin: "6px auto 0", maxWidth: 620 }}>Evidence is read in your browser for this session only. {j.disclaimer || "This analysis isn't a USPAP appraisal, legal, or tax advice."} Values are drawn from the {b.stateId === "TX" ? "appraisal district's" : "county's"} own records.</p>
      </main>

      {toast ? (
        <div style={{ position: "fixed", left: "50%", bottom: 28, transform: "translateX(-50%)", background: "#111", color: "#fff", fontSize: 14.5, padding: "11px 18px", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 50 }}>{toast}</div>
      ) : null}
    </div>
  );
}

function Result({ r, onReset, address, lockAddr, cadRaw, cadMethod, stored }) {
  const th = THEME[r.tier];
  const SF = r.subjSqft;
  const narrow = useNarrow(720);
  const [exporting, setExporting] = React.useState("");
  const [openPopup, setOpenPopup] = React.useState(null);
  const j = r.jurisdiction || {};
  const backup = r.backupInfo;
  const isFair = !!r.fair;

  // Render-time backstop: never display a wall of identical comparables. The
  // engine guard (analyzer.js) already empties an all-identical comp set, but
  // this protects the UI even with a stale cached analyzer.js or a future
  // regression — if every comp that reached us shares one value, suppress the
  // table and show the read-quality notice instead. (Victoria CAD, 2026-06-29.)
  const compsDegenerate =
    Array.isArray(r.comps) && r.comps.length >= 2 &&
    new Set(r.comps.map((c) => Math.round(c.val))).size === 1;
  const showComps = r.comps.length && !compsDegenerate;
  const readNotice = (r.dataQuality && r.dataQuality.message) ||
    (compsDegenerate
      ? "Every comparable read back at the same value — the packet's comparable grid couldn't be read individually, so there's nothing to compare. Re-upload a clearer copy or check the packet before relying on this."
      : null);

  // TODO(wiring): no real refund flow exists in this UI yet. Placeholder routes a
  // refund request to support; swap for the real endpoint/checkout once it's built.
  const REFUND_EMAIL = "support@taxdrop.com";
  const onRefund = () => {
    const subject = "TaxDrop One refund request — " + (address || "");
    const body = "My property came back fairly assessed for " + CURRENT_TAX_YEAR +
      ", so no protest is recommended. I'd like a refund.\n\nProperty: " + (address || "");
    window.location.href = "mailto:" + REFUND_EMAIL +
      "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  };

  const HANDOFF_KEY = "taxdrop-analyzer-handoff";
  const triggerExport = (which, format) => {
    if (exporting) return;
    const id = which + ":" + format;
    setExporting(id);
    const addr = encodeURIComponent((address || "").trim());
    let url = "";
    if (which === "our") {
      // Delivered reports render the pack from the stored, approved draft so the
      // PDF/DOCX matches exactly what was reviewed — not a fresh live lookup.
      url = stored
        ? "/test/evidence-pack-v3?review=1&export=" + format
        : "/test/evidence-pack-v3?address=" + addr + "&export=" + format;
    } else if (which === "cad" || which === "cad-county") {
      if (!cadRaw || cadRaw.demo) {
        setExporting("");
        alert(cadRaw && cadRaw.demo
          ? "This is the design preview — run a real address with a CAD packet to export the analyzer pack."
          : "We don't have the parsed CAD evidence to export — re-run the analysis on this address.");
        return;
      }
      try {
        localStorage.setItem(HANDOFF_KEY, JSON.stringify({
          ts: Date.now(), data: cadRaw, method: cadMethod || "ai",
        }));
      } catch (_) { /* localStorage full / disabled — proceed; analyzer shows drop UI */ }
      const handoffMode = which === "cad-county" ? "county" : "full";
      url = "/evidence-analyzer?export=" + format + "&handoff=" + handoffMode;
    }
    const winName = "taxdrop-export-" + Date.now();
    const w = window.open(url, winName, "width=1024,height=900,scrollbars=yes,resizable=yes");
    if (!w) {
      setExporting("");
      alert("Pop-up blocked — please allow pop-ups for one.taxdrop.com so the PDF can open.");
      return;
    }
    const safetyMs = format === "pdf" ? 60000 : 30000;
    const tick = setInterval(() => {
      if (w.closed) { clearInterval(tick); setExporting(""); }
    }, 500);
    setTimeout(() => { clearInterval(tick); setExporting(""); }, safetyMs);
  };

  const ExportButton = ({ which, format, label, light, dark }) => {
    const id = which + ":" + format;
    const busy = exporting === id;
    const isPrimary = format === "pdf";
    const styles = isPrimary
      ? { background: "#fff", color: dark ? "#1d3023" : (light || "#8a6311"), border: "none" }
      : (dark
          ? { background: "#2f4536", color: "#fff", border: "1px solid #3e5746" }
          : { background: "#ffffff22", color: "#fff", border: "1px solid #ffffff44" });
    return (
      <button onClick={() => triggerExport(which, format)} disabled={!!exporting}
        style={{ borderRadius: 10, padding: "11px 24px", fontSize: 13.5, fontWeight: isPrimary ? 800 : 700, fontFamily: "inherit", cursor: exporting ? "default" : "pointer", opacity: exporting && !busy ? 0.55 : 1, ...styles }}>
        {busy ? "Generating…" : label}
      </button>
    );
  };

  const cards = r.ladder.filter((row) => ["selected", "backup", "available"].includes(row.status));
  const ladderKeys = new Set(r.ladder.map((x) => x.key));
  const consideredMedians = (r.medianCards || []).filter((m) => !ladderKeys.has(m.key) && r.notice != null && m.value >= r.notice);

  // ── Quadrant points (savings × confidence) ──
  const confidenceX = (kind, tier) => {
    if (kind === "token") return 0.88;
    if (tier === "automatic") return 0.62;
    if (kind === "comp") return 0.73;
    if (tier === "our") return 0.46;
    return 0.58;
  };
  const plotted = [];
  cards.forEach((row) => plotted.push({ name: shortName(row.name), value: row.value, status: row.status, kind: row.kind, tier: row.tier, red: r.notice != null && row.value != null ? r.notice - row.value : 0 }));
  consideredMedians.forEach((m) => plotted.push({ name: shortName(m.label), value: m.value, status: "considered", kind: "median", tier: "automatic", red: 0 }));
  if (r.tier !== "token") plotted.push({ name: "Token 3%", value: r.notice != null ? Math.round(r.notice * (1 - TOKEN_PCT)) : null, status: "token", kind: "token", tier: "token", red: 0 });
  // Token is a floor reference, not a real evidence-backed reduction — exclude it
  // from the savings scale so its nominal 3% can't dominate the y-axis.
  const maxRed = Math.max(r.reduction || 0, ...plotted.filter((p) => p.status !== "token").map((p) => (p.red > 0 ? p.red : 0)), 1);
  const dotStyle = (p) => {
    if (p.status === "selected") return { size: 24, bg: th.main, label: th.deep, sub: "#b59a55" };
    if (p.status === "backup") return { size: 19, bg: "#1d6b41", label: "#1d6b41", sub: "#6a9a7e" };
    if (p.status === "available") return { size: 17, bg: "#1d6b41", label: "#1d6b41", sub: "#6a9a7e" };
    if (p.status === "token") return { size: 13, bg: "#fff", label: "#9aa69d", sub: "#9aa69d", dashed: true };
    return { size: 14, bg: "#c4cdc6", label: "#9aa69d", sub: "#b3bdb6" };
  };
  const yOf = (p) => {
    if (p.status === "token") return 0.2;            // pinned low — it's the floor
    return p.red > 0 ? 0.22 + 0.72 * (p.red / maxRed) : 0.1;
  };

  const Chip = ({ children, bg, color }) => (
    <span style={{ fontSize: 11.5, fontWeight: 700, color, background: bg, padding: "4px 11px", borderRadius: 20 }}>{children}</span>
  );

  return (
    <section style={{ paddingTop: narrow ? 28 : 52, animation: "fadeUp .5s ease both" }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".16em", color: "#2c8350" }}>RECOMMENDATION</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#5d6f64" }}>{r.address}</span>
        </div>
        <span onClick={onReset} style={{ fontSize: 13, fontWeight: 600, color: "#8a988f", borderBottom: "1px solid #c7d2c7", cursor: "pointer" }}>Start over</span>
      </div>

      {r.cadMismatch ? (
        <div style={{ background: "#fff7e6", border: "1px solid #f3c97d", borderLeft: "4px solid #d68a14", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#5a3e0a", fontSize: 13.5, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ Uploaded CAD packet doesn't match this address</div>
          The packet you uploaded shows a noticed value of <b>{fmt(r.cadMismatch.cadAssessed)}</b>, but the engine sees <b>{fmt(r.cadMismatch.engineNotice)}</b> for the address above. Looks like the packet is for a different property — it's been ignored for this recommendation. Upload the matching CAD packet to enable the CAD-side strategies.
        </div>
      ) : null}

      {r.priorYearOnly ? (
        <div style={{ background: "#eef4fb", border: "1px solid #bcd6f0", borderLeft: "4px solid #3b7dc4", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#244966", fontSize: 13.5, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Based on your {r.dataYear} county data</div>
          Your county's {CURRENT_TAX_YEAR} roll isn't published yet, so this analysis uses the most recent values on file ({r.dataYear}). For a {CURRENT_TAX_YEAR}-current read, upload your {CURRENT_TAX_YEAR} notice or evidence packet above and we'll re-run it on that.
        </div>
      ) : null}

      {/* RECOMMENDATION HERO */}
      {isFair ? <FairHero r={r} narrow={narrow} /> : (
      <section style={{ position: "relative", overflow: "hidden", borderRadius: 22, background: th.grad, boxShadow: "0 16px 46px " + th.shadow, padding: narrow ? "26px 22px" : "36px 38px", color: "#fff", marginBottom: 18 }}>
        <div style={{ position: "absolute", top: -90, right: -60, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.16),transparent 70%)", pointerEvents: "none" }}></div>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 26, flexWrap: "wrap" }}>
            <span style={{ background: "#fff", color: th.deep, fontSize: 13, fontWeight: 800, padding: "6px 14px", borderRadius: 30, letterSpacing: ".01em" }}>{TIER_NAME[r.tier]}</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", color: "#ffffffcc", border: "1px solid #ffffff55", padding: "5px 10px", borderRadius: 6 }}>{TIER_TAG[r.tier]}</span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: narrow ? 20 : 48 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".13em", color: "#ffffffbb", marginBottom: 8 }}>{r.tier === "token" ? "TARGET SETTLEMENT" : "FILE THIS VALUE"}</div>
              <div style={{ fontSize: narrow ? 42 : 64, fontWeight: 800, lineHeight: .92, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmt(r.target)}</div>
            </div>
            <div style={{ display: "flex", gap: narrow ? 24 : 42, paddingBottom: 6 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ffffffaa", marginBottom: 7 }}>Your {r.dataYear || CURRENT_TAX_YEAR} notice</div>
                <div style={{ fontSize: 21, fontWeight: 700, color: "#ffffffcc", textDecoration: "line-through", textDecorationColor: "#ffffff66", fontVariantNumeric: "tabular-nums" }}>{fmt(r.notice)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ffffffaa", marginBottom: 7 }}>Value reduction</div>
                <div style={{ fontSize: 21, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>−{fmt(r.reduction)} <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffffbb" }}>({r.pct.toFixed(1)}%)</span></div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#ffffff22", border: "1px solid #ffffff33", borderRadius: 30, padding: "9px 18px", fontSize: 14, fontWeight: 700 }}>$ Est. tax savings ~{fmt(r.taxSaved)}/yr</div>
            {backup ? (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#ffffff14", border: "1px solid #ffffff2a", borderRadius: 30, padding: "9px 18px", fontSize: 14, fontWeight: 600, color: "#ffffffe0" }}>★ Defensible backup ready — {fmt(backup.value)}</div>
            ) : null}
          </div>
        </div>
      </section>
      )}

      {/* RATIONALE */}
      <section style={{ background: "#fff", border: "1px solid #e6ebe6", borderLeft: "4px solid " + (isFair ? "#1d6b41" : th.main), borderRadius: 14, padding: "22px 26px", marginBottom: isFair ? 28 : 64 }}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#34433a", fontWeight: 500 }}>{r.rationale}</p>
      </section>

      {isFair ? (
        <FairNextSteps narrow={narrow} exporting={exporting} onSaveReport={() => triggerExport("our", "pdf")} onRefund={onRefund} />
      ) : null}

      {!isFair ? <ProtestGuide r={r} j={j} backup={backup} /> : null}

      {/* COMPARE STRATEGIES */}
      {!isFair ? (
      <section style={{ marginBottom: 64 }}>
        <SectionHead icon="◇" title="Compare every strategy" sub={<React.Fragment>Each angle balances <strong style={{ color: "#34433a" }}>potential savings</strong> against <strong style={{ color: "#34433a" }}>chance of success</strong>. We lead with the play that saves the most while staying defensible — and keep the safest qualifier in reserve.</React.Fragment>} />

        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 18, alignItems: "stretch" }}>

          {/* QUADRANT */}
          <div style={{ background: "#fff", border: "1px solid #e6ebe6", borderRadius: 18, padding: "24px 26px 20px", boxShadow: "0 1px 2px rgba(20,40,28,.03)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", color: "#8a988f", marginBottom: 18 }}>SAVINGS × CONFIDENCE</div>
            <div style={{ position: "relative", padding: "0 0 30px 30px" }}>
              <div style={{ position: "absolute", left: -4, top: 0, bottom: 30, width: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ transform: "rotate(-90deg)", whiteSpace: "nowrap", fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", color: "#8a988f" }}>POTENTIAL SAVINGS →</span>
              </div>
              <div style={{ position: "relative", height: 300, borderLeft: "1.5px solid #dde5dd", borderBottom: "1.5px solid #dde5dd", background: "linear-gradient(135deg,rgba(177,133,26,.07),transparent 62%)" }}>
                <div style={{ position: "absolute", top: 0, right: 0, width: "48%", height: "52%", background: "radial-gradient(ellipse at top right,rgba(177,133,26,.16),transparent 72%)", borderTopRightRadius: 4 }}></div>
                <div style={{ position: "absolute", top: 10, right: 12, fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", color: "#b1851a", textAlign: "right" }}>BEST<br />BALANCE</div>
                <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: "#eef2ee" }}></div>
                <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: "#eef2ee" }}></div>

                {plotted.map((p, i) => {
                  const d = dotStyle(p);
                  const x = confidenceX(p.kind, p.tier);
                  const yFrac = yOf(p);
                  return (
                    <div key={i} style={{ position: "absolute", left: (x * 100) + "%", bottom: (yFrac * 100) + "%", transform: "translate(-50%,50%)", textAlign: "center" }}>
                      <div style={{ width: d.size, height: d.size, borderRadius: "50%", background: d.bg, border: d.dashed ? "2px dashed #c4cdc6" : "3px solid #fff", boxShadow: p.status === "selected" ? "0 3px 10px rgba(138,99,18,.45),0 0 0 4px rgba(177,133,26,.18)" : (d.dashed ? "none" : "0 3px 9px rgba(22,84,47,.4)"), margin: "0 auto" }}></div>
                      <div style={{ marginTop: 6, fontSize: 10.5, fontWeight: 800, color: d.label, whiteSpace: "nowrap" }}>{p.name}</div>
                      {p.red > 0 ? <div style={{ fontSize: 9.5, fontWeight: 600, color: d.sub }}>−{fmt(p.red)}</div> : (p.status === "considered" ? <div style={{ fontSize: 9.5, fontWeight: 600, color: d.sub }}>over notice</div> : null)}
                    </div>
                  );
                })}
              </div>
              <div style={{ textAlign: "center", marginTop: 9, fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", color: "#8a988f" }}>CHANCE OF SUCCESS →</div>
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6, paddingTop: 14, borderTop: "1px solid #eef2ee" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#5d6f64" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: th.main }}></span>Recommended</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#5d6f64" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#1d6b41" }}></span>Backup</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, color: "#5d6f64" }}><span style={{ width: 10, height: 10, borderRadius: "50%", background: "#c4cdc6" }}></span>Considered</span>
            </div>
          </div>

          {/* LADDER */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {cards.map((row) => {
              const sel = row.status === "selected";
              const isBackup = row.status === "backup";
              const cth = THEME[row.tier];
              const open = openPopup === row.key;
              const exp = strategyExplainer(row.kind, row.tier);
              const badge = sel ? "Recommended" : (isBackup ? "Defensible backup" : "Alternative");
              const badgeBg = sel ? cth.chip : "#e3efe6";
              const badgeColor = sel ? cth.onSoft : "#1d6b41";
              const srcKey = row.kind === "comp" ? "comp" : row.tier;
              return (
                <div key={row.key} style={{ position: "relative", background: sel ? cth.soft : "#fff", border: sel ? "1.5px solid " + cth.softBorder : "1px solid #e6ebe6", borderRadius: 16, padding: "20px 22px", boxShadow: sel ? "0 4px 16px rgba(177,133,26,.10)" : "none" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: sel ? cth.main : "#eef3ee", color: sel ? "#fff" : "#1d6b41", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{sel ? "✓" : "★"}</div>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#16241c" }}>{row.name}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", color: sel ? "#b59a55" : "#9aa69d" }}>{SOURCE_TAG[srcKey] || SOURCE_TAG[row.tier]}</span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: sel ? cth.deep : "#16241c", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{fmt(row.value)}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, margin: "12px 0 10px", flexWrap: "wrap" }}>
                    <Chip bg={badgeBg} color={badgeColor}>{badge}</Chip>
                    <Chip bg="#eef3ee" color="#34433a">Savings · {savingsLevel(row.value, r.notice, r.reduction)}</Chip>
                    <Chip bg="#eef3ee" color="#34433a">Confidence · {confidenceLevel(row.kind, row.tier)}</Chip>
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: 13.5, lineHeight: 1.5, color: "#5d6f64" }}>{row.reason}</p>
                  <button onClick={() => setOpenPopup(open ? null : row.key)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: sel ? cth.onSoft : "#1d6b41", cursor: "pointer" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", border: "1.5px solid " + (sel ? cth.main : "#1d6b41"), fontSize: 10, fontStyle: "italic", fontWeight: 800 }}>i</span>
                    How this strategy works
                  </button>
                  {open ? (
                    <div style={{ position: "absolute", zIndex: 30, left: 18, right: 18, top: "100%", marginTop: 10, background: "#1d3023", color: "#eaf2ec", borderRadius: 14, padding: "20px 22px", boxShadow: "0 18px 44px rgba(20,40,28,.34)" }}>
                      <div style={{ position: "absolute", left: 40, top: -7, width: 14, height: 14, background: "#1d3023", transform: "rotate(45deg)" }}></div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{exp.title}</span>
                        <button onClick={() => setOpenPopup(null)} style={{ background: "none", border: "none", color: "#86988c", fontSize: 18, lineHeight: 1, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>×</button>
                      </div>
                      {exp.paras.map((p, pi) => (
                        <p key={pi} style={{ margin: pi === exp.paras.length - 1 ? 0 : "0 0 10px", fontSize: 13, lineHeight: 1.6, color: "#c4d2c9" }}>{p}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {consideredMedians.map((m, i) => (
              <div key={"cm" + i} style={{ background: "#fafbfa", border: "1px solid #ebefeb", borderRadius: 16, padding: "16px 22px", opacity: .85 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#7c8a80" }}>{m.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#9aa69d", fontVariantNumeric: "tabular-nums" }}>{fmt(m.value)}</span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#9aa69d" }}>Considered but doesn't beat your notice — not filed.</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {/* EVIDENCE */}
      <section style={{ marginBottom: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1d6b41", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>$</div>
          <h2 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em", color: "#16241c" }}>{isFair ? "What we checked" : "The evidence behind it"}</h2>
        </div>

        {r.medianCards.length ? (
          <div style={{ display: "grid", gridTemplateColumns: (narrow || r.medianCards.length <= 1) ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 18 }}>
            {r.medianCards.map((m, i) => {
              const d = m.value - r.notice; const below = d < 0;
              // No "CHOSEN" highlight when fairly assessed — we're not filing a value.
              const winner = m.winner && !isFair;
              return (
                <div key={i} style={{ background: winner ? "#fdf9ef" : "#fff", border: winner ? "1.5px solid #e6cf94" : "1px solid #e6ebe6", borderRadius: 16, padding: "22px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: winner ? "#8a6311" : "#5d6f64" }}>{m.label}</span>
                    <span style={winner
                      ? { fontSize: 11, fontWeight: 800, letterSpacing: ".04em", color: "#fff", background: "#b1851a", padding: "4px 11px", borderRadius: 20 }
                      : { fontSize: 11, fontWeight: 700, color: below ? "#1d6b41" : "#b03f2c", background: below ? "#e3efe6" : "#fbeae6", padding: "4px 10px", borderRadius: 20 }}>{winner ? "CHOSEN" : (below ? "below notice" : "above notice")}</span>
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, color: winner ? "#8a6311" : "#16241c", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmt(m.value)}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: below ? "#1d6b41" : "#b03f2c", marginTop: 8 }}>{below ? "↓ " : "↑ "}{signed(d)} vs your notice</div>
                  <div style={{ fontSize: 12.5, color: winner ? "#b59a55" : "#9aa69d", marginTop: 4 }}>{m.source}</div>
                </div>
              );
            })}
          </div>
        ) : null}

        {showComps ? (
          <div style={{ background: "#fff", border: "1px solid #e6ebe6", borderRadius: 16, overflow: "hidden", overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1.1fr .9fr 1.1fr", minWidth: 540, background: "#1d3a27", color: "#dfeae3", fontSize: 11, fontWeight: 700, letterSpacing: ".07em", padding: "14px 22px" }}>
              <span>COMPARABLE</span><span>TYPE</span><span style={{ textAlign: "right" }}>INDICATED</span><span style={{ textAlign: "right" }}>$/SF</span><span style={{ textAlign: "right" }}>VS NOTICE</span>
            </div>
            {r.comps.map((c, i) => {
              const d = c.val != null ? c.val - r.notice : null; const below = d != null && d < 0;
              const sf = c.sqft || SF;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.4fr 1.1fr .9fr 1.1fr", minWidth: 540, padding: "15px 22px", borderBottom: i < r.comps.length - 1 ? "1px solid #f0f3f0" : "none", fontSize: 14, alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "#16241c" }}>{c.addr}{c.note ? <span style={{ fontSize: 11, fontWeight: 600, color: "#a87722", marginLeft: 6 }}>· {c.note}</span> : null}</span>
                  <span style={{ color: "#7c8a80" }}>{c.type}</span>
                  <span style={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(c.val)}</span>
                  <span style={{ textAlign: "right", color: "#7c8a80" }}>{c.val != null && sf ? "$" + Math.round(c.val / sf) + "/SF" : "—"}</span>
                  <span style={{ textAlign: "right", fontWeight: 700, color: d == null ? "#9aa69d" : (below ? "#1d6b41" : "#b03f2c") }}>{d == null ? "—" : (below ? "↓ " : "↑ ") + signed(d)}</span>
                </div>
              );
            })}
          </div>
        ) : null}

        {readNotice ? (
          <div style={{ background: "#fff4d6", border: "1px solid #e5b644", color: "#7a5800", borderRadius: 14, padding: "14px 18px", fontSize: 13.5, lineHeight: 1.5, marginTop: showComps ? 14 : 0 }}>
            <b>Heads up — part of this packet couldn't be read cleanly.</b>
            <div style={{ marginTop: 4 }}>{readNotice}</div>
          </div>
        ) : null}
      </section>

      {/* EXPORT PACKETS — protest-filing packets; hidden when fairly assessed. */}
      {!isFair ? (
      <section style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".13em", color: "#2c8350", marginBottom: 18 }}>EXPORT PACKETS</div>
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 18 }}>
          <div style={{ background: "linear-gradient(135deg,#b1851a,#8a6311)", borderRadius: 18, padding: "24px 26px", color: "#fff", boxShadow: "0 10px 28px rgba(138,99,18,.22)" }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 7 }}>TaxDrop Evidence Pack</div>
            <p style={{ margin: "0 0 20px", fontSize: 13.5, lineHeight: 1.5, color: "#ffffffd0" }}>Our independent equity brief — comp table, baseline, and methodology. The document you file.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <ExportButton which="our" format="pdf" label="PDF" light="#8a6311" />
              <ExportButton which="our" format="docx" label="DOCX" />
            </div>
          </div>

          {cadRaw && !cadRaw.demo ? (
            <div style={{ background: "#1d3023", borderRadius: 18, padding: "24px 26px", color: "#fff" }}>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 7 }}>CAD Evidence Analyzer Pack</div>
              <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.5, color: "#c4d2c9" }}>A breakdown of the county's own evidence with the lowest defensible value flagged.</p>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", color: "#86988c", marginBottom: 9 }}>AGENT PREP (INTERNAL)</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <ExportButton which="cad" format="pdf" label="PDF" dark />
                <ExportButton which="cad" format="docx" label="DOCX" dark />
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", color: "#86988c", marginBottom: 9 }}>SEND TO CAD (ATTACHMENT)</div>
              <div style={{ display: "flex", gap: 10 }}>
                <ExportButton which="cad-county" format="pdf" label="PDF" dark />
                <ExportButton which="cad-county" format="docx" label="DOCX" dark />
              </div>
            </div>
          ) : cadRaw && cadRaw.demo ? (
            <div style={{ background: "#1d3023", borderRadius: 18, padding: "24px 26px", color: "#fff", opacity: .92 }}>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 7 }}>CAD Evidence Analyzer Pack</div>
              <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.5, color: "#c4d2c9" }}>A breakdown of the county's own evidence with the lowest defensible value flagged. <em style={{ color: "#9bb3a4" }}>(Preview — enabled after a real CAD upload.)</em></p>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", color: "#86988c", marginBottom: 9 }}>AGENT PREP (INTERNAL)</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <ExportButton which="cad" format="pdf" label="PDF" dark />
                <ExportButton which="cad" format="docx" label="DOCX" dark />
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".1em", color: "#86988c", marginBottom: 9 }}>SEND TO CAD (ATTACHMENT)</div>
              <div style={{ display: "flex", gap: 10 }}>
                <ExportButton which="cad-county" format="pdf" label="PDF" dark />
                <ExportButton which="cad-county" format="docx" label="DOCX" dark />
              </div>
            </div>
          ) : (
            <div style={{ background: "#f1f4f2", borderRadius: 18, padding: "24px 26px", color: "#3a463f", border: "1px dashed #c7d2cc" }}>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6, color: "#16241c" }}>CAD Evidence Analyzer Pack</div>
              <p style={{ margin: 0, fontSize: 13, color: "#6b766f", lineHeight: 1.5 }}>Upload the county's evidence PDF (Step 2) to enable the analyzer pack — it parses the county's own comp set and generates a separate agent-prep document plus a clean CAD-attachment version.</p>
            </div>
          )}
        </div>
        <p style={{ margin: "16px 0 0", fontSize: 12.5, color: "#9aa69d", lineHeight: 1.5 }}>PDF opens your browser's print dialog (save as PDF). DOCX downloads directly. Both pull live engine data — no re-uploading the county PDF.</p>
      </section>
      ) : null}

      {/* PRE-FILLED FORM — the official filing, generated from the live county
          record. Print-and-sign; hidden when fairly assessed. The card asks the
          backend (/api/form-schema) whether a filled form exists for this
          jurisdiction; pending states render nothing here (no fallback), keeping
          today's "render nothing when no form" behavior in the report view. */}
      {!isFair ? <ProtestFormCard address={lockAddr || address} /> : null}

      {/* REFER A FRIEND — paused 2026-06-24. Component kept (ReferBlock) so the
          design can be brought back by re-adding <ReferBlock /> here. */}

      <p style={{ textAlign: "center", fontSize: 12.5, color: "#a4b0a7", lineHeight: 1.55, maxWidth: 620, margin: "0 auto" }}>{isFair
        ? "Evidence is read in your browser for this session only. We checked your property against the county's own indicators and our independent comps — this isn't a USPAP appraisal, legal, or tax advice."
        : <React.Fragment>Evidence is read in your browser for this session only. {j.disclaimer || "This analysis supports a Texas §41.43 protest filing — it isn't a USPAP appraisal, legal, or tax advice."}</React.Fragment>}</p>
    </section>
  );
}

// Trim long strategy labels for the compact quadrant dots.
function shortName(name) {
  return String(name || "")
    .replace("TaxDrop equity comps", "TaxDrop equity")
    .replace("Second-lowest comparable", "2nd-lowest comp")
    .replace("Median equity value", "CAD median")
    .replace("Median market value", "CAD median")
    .replace("Median of comparables", "CAD median");
}

/* ───────── fairly-assessed hero (shown instead of the protest hero) ─────────
   Calm, reassuring read for properties where no protest is worth filing:
   nothing beats the notice, or the best supportable reduction is under 1% / $100/yr. */
function FairHero({ r, narrow }) {
  const isToken = r.tier === "token";
  const best = isToken ? 0 : r.reduction;   // token's nominal 3% isn't a real reduction
  const bestTax = isToken ? 0 : r.taxSaved;
  const proc = (r.jurisdiction && r.jurisdiction.proceeding) || "protest";
  return (
    <section style={{ position: "relative", overflow: "hidden", borderRadius: 22, background: "linear-gradient(135deg,#1d6b41,#16542f)", boxShadow: "0 16px 46px rgba(22,84,47,.30)", padding: narrow ? "26px 22px" : "36px 38px", color: "#fff", marginBottom: 18 }}>
      <div style={{ position: "absolute", top: -90, right: -60, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,.16),transparent 70%)", pointerEvents: "none" }}></div>
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
          <span style={{ background: "#fff", color: "#16542f", fontSize: 13, fontWeight: 800, padding: "6px 14px", borderRadius: 30, letterSpacing: ".01em" }}>Fairly Assessed</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".14em", color: "#ffffffcc", border: "1px solid #ffffff55", padding: "5px 10px", borderRadius: 6 }}>NO {proc.toUpperCase()} NEEDED</span>
        </div>

        <div style={{ fontSize: narrow ? 27 : 38, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: 26 }}>Your property is fairly assessed.</div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: narrow ? 22 : 46 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".13em", color: "#ffffffbb", marginBottom: 8 }}>YOUR {r.dataYear || CURRENT_TAX_YEAR} ASSESSED VALUE</div>
            <div style={{ fontSize: narrow ? 40 : 56, fontWeight: 800, lineHeight: .92, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmt(r.notice)}</div>
          </div>
          <div style={{ paddingBottom: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#ffffffaa", marginBottom: 7 }}>Most we could support</div>
            <div style={{ fontSize: 21, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{best > 0 ? "−" + fmt(best) : "$0"} <span style={{ fontSize: 14, fontWeight: 600, color: "#ffffffbb" }}>{best > 0 ? "(~" + fmt(bestTax) + "/yr)" : "(no reduction)"}</span></div>
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#ffffff22", border: "1px solid #ffffff33", borderRadius: 30, padding: "9px 18px", fontSize: 14, fontWeight: 700 }}>✓ No {proc} recommended for {CURRENT_TAX_YEAR}</span>
        </div>
      </div>
    </section>
  );
}

/* ───────── fairly-assessed next steps (replaces the protest guide / exports) ─────────
   Two no-cost options. Handlers are placeholders — wire to the real save/refund
   flows once they exist (see onRefund TODO in Result; save = evidence-pack PDF). */
function FairNextSteps({ narrow, exporting, onSaveReport, onRefund }) {
  const card = { background: "#fff", border: "1px solid #e6ebe6", borderRadius: 16, padding: "22px 24px", display: "flex", flexDirection: "column" };
  const btn = (primary) => ({ marginTop: "auto", alignSelf: "flex-start", borderRadius: 10, padding: "11px 22px", fontSize: 14, fontWeight: 800, fontFamily: "inherit", cursor: "pointer", border: primary ? "none" : "1.5px solid #1d6b41", background: primary ? "#1d6b41" : "#fff", color: primary ? "#fff" : "#1d6b41" });
  return (
    <section style={{ marginBottom: 64 }}>
      <SectionHead icon="→" title="What now?" sub="Nothing to file this year. Two options — neither costs you anything." />
      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: 18 }}>
        <div style={card}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#16241c", marginBottom: 7 }}>Save your report for next year</div>
          <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.5, color: "#5d6f64" }}>Keep this analysis on file. We'll re-check your assessment when the {CURRENT_TAX_YEAR + 1} roll lands — values move, and next year may be different.</p>
          <button onClick={onSaveReport} disabled={!!exporting} style={{ ...btn(true), opacity: exporting ? 0.6 : 1 }}>{exporting ? "Saving…" : "Save my report"}</button>
        </div>
        <div style={card}>
          <div style={{ fontSize: 17, fontWeight: 800, color: "#16241c", marginBottom: 7 }}>Get a refund now</div>
          <p style={{ margin: "0 0 18px", fontSize: 13.5, lineHeight: 1.5, color: "#5d6f64" }}>No savings, no fee — that's the deal. If you'd rather not wait for next year, request a full refund and we'll take care of it.</p>
          <button onClick={onRefund} style={btn(false)}>Request a refund</button>
        </div>
      </div>
    </section>
  );
}

/* ───────── step-by-step protest guide (timeline) ───────── */
function ProtestGuide({ r, j, backup }) {
  const target = fmt(r.target);
  const step3 = backup
    ? <React.Fragment>At the informal, anchor to <strong style={{ color: "#8a6311" }}>{target}</strong>, backed by your strongest evidence. If the appraiser pushes back, fall to your defensible backup — the {backup.name.toLowerCase()} at <strong style={{ color: "#34433a" }}>{fmt(backup.value)}</strong> — rather than conceding the whole reduction.</React.Fragment>
    : <React.Fragment>At the informal, anchor to <strong style={{ color: "#8a6311" }}>{target}</strong>, backed by your evidence packet. Hold firm on the methodology — the value is built from the county's own indicators, adjusted to your home.</React.Fragment>;

  const steps = [
    { n: "1", title: "File your " + j.proceedingTitle,
      body: <React.Fragment>Submit your {j.form} to {j.authority} by <strong style={{ color: "#34433a" }}>{j.deadline}</strong> (or within the window on your notice). Check both <em>market value too high</em> and <em>unequal appraisal</em> to keep every angle open.</React.Fragment> },
    { n: "2", title: "Attach your evidence packet",
      body: <React.Fragment>Send the <strong style={{ color: "#34433a" }}>TaxDrop Evidence Pack</strong> with your filing and request an informal review. Everything the appraiser needs — comps, methodology, and your indicated value — sits in one document.</React.Fragment> },
    { n: "3", gold: true, title: "Lead with your strongest value", badge: "Open at " + target, body: step3 },
    { n: "4", title: "Escalate to the " + j.boardShort + " only if needed",
      body: <React.Fragment>If the informal stalls, take the same packet to the {j.boardLong}. Under <strong style={{ color: "#34433a" }}>{j.statute}</strong>, the board must weigh the county's own indicators against your evidence — your numbers come straight from theirs.</React.Fragment> },
    { n: "✓", done: true, title: "Lock in your reduction",
      body: <React.Fragment>Accept the settlement and your new assessed value carries to your tax bill — about <strong style={{ color: "#1d6b41" }}>{fmt(r.taxSaved)} less per year</strong> at the current effective rate.</React.Fragment> },
  ];

  return (
    <section style={{ marginBottom: 64 }}>
      <SectionHead icon="→" title={"Your " + j.proceeding + ", step by step"} sub="Five moves from recommendation to a lower tax bill. Lead with the recommended value; keep the backup in your pocket." />
      <div style={{ position: "relative", paddingLeft: 42 }}>
        <div style={{ position: "absolute", left: 14, top: 14, bottom: 14, width: 2, background: "#dce5dc" }}></div>
        {steps.map((s, i) => (
          <div key={i} style={{ position: "relative", marginBottom: i < steps.length - 1 ? 18 : 0 }}>
            <div style={{ position: "absolute", left: -42, top: 0, width: 30, height: 30, borderRadius: "50%", background: s.gold ? "#b1851a" : (s.done ? "#1d6b41" : "#fff"), border: "2px solid " + (s.gold ? "#b1851a" : "#1d6b41"), color: s.gold || s.done ? "#fff" : "#1d6b41", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>{s.n}</div>
            <div style={{ background: s.gold ? "#fdf9ef" : "#fff", border: "1px solid " + (s.gold ? "#ecdcae" : "#e6ebe6"), borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 2px rgba(20,40,28,.03)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 7 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#16241c" }}>{s.title}</span>
                {s.badge ? <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", background: "#b1851a", padding: "3px 10px", borderRadius: 20, letterSpacing: ".01em" }}>{s.badge}</span> : null}
              </div>
              <div style={{ fontSize: 14.5, lineHeight: 1.55, color: "#5d6f64" }}>{s.body}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
