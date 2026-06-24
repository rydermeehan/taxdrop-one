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
function deriveJurisdiction(our) {
  const subj = (our && our.subject) || {};
  const rawCounty =
    subj.county_name || subj.appraisal_district || subj.cad_name || subj.county || "";
  let authority = "your appraisal district";
  if (rawCounty) {
    const name = titleCase(String(rawCounty)).replace(/\s+County$/i, "").replace(/\s+CAD$/i, "").trim();
    authority = name ? name + " CAD" : authority;
  }
  return {
    authority,
    form: "Form 50-132",
    deadline: "May 15, 2026",
    boardShort: "ARB",
    boardLong: "Appraisal Review Board",
    statute: "Texas Tax Code §41.43",
    statuteShort: "Texas §41.43",
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
    tier, target, notice, reduction, pct, subjSqft,
    address, rationale,
    ladder, medianCards, comps: rawComps,
    taxSaved: reduction * (TAX_RATE / 100),
    cadMismatch: cadMismatchInfo,
    backupInfo,
    jurisdiction: deriveJurisdiction(our),
  };
}

/* ───────── sample result for the /v2?demo mockup (matches the design example) ───────── */
const SAMPLE_RESULT = (() => {
  const notice = 988470, target = 968801, backupVal = 974900, SF = 3977;
  const reduction = notice - target;
  return {
    ok: true, tier: "our", target, notice, reduction, pct: (reduction / notice) * 100, subjSqft: SF,
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
    jurisdiction: { authority: "Dallas CAD", form: "Form 50-132", deadline: "May 15, 2026", boardShort: "ARB", boardLong: "Appraisal Review Board", statute: "Texas Tax Code §41.43", statuteShort: "Texas §41.43" },
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

// Smooth-scroll the header pill to the Refer-a-friend block. The block now
// renders on BOTH the intake and results pages, so #refer always resolves.
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
        {narrow ? null : <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", color: "#2c8350", background: "#eef3ee", border: "1px solid #d8e4db", borderRadius: 6, padding: "2px 7px" }}>V2 PREVIEW</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: narrow ? 10 : 18 }}>
        {narrow ? null : <span style={{ fontSize: 13, color: "#8a988f", fontWeight: 500, letterSpacing: ".01em" }}>Tax Year {CURRENT_TAX_YEAR}</span>}
        <a href="#refer" onClick={scrollToRefer} style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", textDecoration: "none", background: "#eef3ee", border: "1px solid #d8e4db", borderRadius: 30, padding: narrow ? "7px 13px" : "7px 15px", fontSize: 13, fontWeight: 700, color: "#1d6b41", cursor: "pointer" }}><span>🎁</span>{narrow ? "$15 off" : "Refer a friend — $15 off"}</a>
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
  const fileRef = useRef(null);
  const addrRef = useRef(null);

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

  useEffect(() => {
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
  }, [status]);

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

  const analyze = useCallback(async () => {
    if (!address.trim()) return;
    setStatus("analyzing"); setStep(0); setError("");
    try {
      let cad = null;
      if (files.length) {
        try {
          const ext = await window.Extractor.extractFromFiles(files);
          if (ext && ext.ok) {
            cad = window.Analyzer.analyze(ext.data);
            setCadRaw(ext.data);
            setCadMethod(ext.method || "");
          }
        } catch (e) { /* CAD parse failed — fall through with cad=null */ }
      }
      setStep(1);

      let our = null;
      let staleYearError = null;
      try {
        const lookupAddress = await ensureAddressZip(address.trim());
        const resp = await fetch("/api/cad-proxy?path=/api/evidence-pack/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: lookupAddress }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.subject) {
            const ty = Number(data.subject.tax_year);
            if (ty && ty < CURRENT_TAX_YEAR) {
              staleYearError = ty;
            } else {
              our = data;
            }
          }
        }
      } catch (e) { /* our lookup failed — fall through with our=null */ }
      if (staleYearError) {
        setError(
          "The engine returned " + staleYearError + " data for this property, but " +
          CURRENT_TAX_YEAR + " data is on file. This is a known stale-record issue " +
          "on the engine (duplicate row). Please report this address so we can dedupe."
        );
        setStatus("error");
        return;
      }
      setStep(2);

      if (!cad && !our) {
        setError("We couldn't read the evidence or find this property. Check the address and that the PDF is the county's evidence packet (not a scan).");
        setStatus("error");
        return;
      }

      const r = decide(cad, our, address.trim());
      setStep(3);
      await new Promise((res) => setTimeout(res, 350));
      if (!r.ok || r.notice == null) {
        setError("We read the evidence but couldn't determine your noticed value. Try the Evidence Analyzer for a manual review.");
        setStatus("error");
        return;
      }
      setResult(r);
      setStatus("done");
    } catch (e) {
      setError("Something went wrong analyzing this property. Please try again.");
      setStatus("error");
    }
  }, [address, files]);

  const reset = () => { setStatus("idle"); setStep(0); setResult(null); setError(""); setFiles([]); setCadRaw(null); };

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

  return (
    <div style={{ background: "#e9efe9", minHeight: "100vh" }}>
      <Header />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: narrow ? "0 16px 64px" : "0 24px 90px" }}>

        {showForm ? (
          <section style={{ textAlign: "center", padding: narrow ? "40px 0 28px" : "64px 0 40px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".16em", color: "#2c8350", marginBottom: 18 }}>PROPERTY TAX PROTEST · ONE</div>
            <h1 style={{ fontSize: narrow ? 34 : 58, lineHeight: 1.06, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 20px", color: "#16241c" }}>Win the lowest assessment<br />you can actually <span style={{ color: "#2c8350" }}>defend.</span></h1>
            <p style={{ maxWidth: 620, margin: "0 auto", fontSize: narrow ? 16 : 18, lineHeight: 1.55, color: "#5d6f64", fontWeight: 500 }}>Drop in your address and the county's evidence packet. We test every angle — their own numbers, the strongest backup comp, and our independent equity report — then hand you the biggest reduction that holds up at hearing, plus the step-by-step plan to win it.</p>
          </section>
        ) : null}

        {showForm ? (
          <section style={{ background: "#fff", border: "1px solid #e6ebe6", borderRadius: 20, boxShadow: "0 1px 2px rgba(20,40,28,.04),0 12px 34px rgba(20,40,28,.06)", padding: narrow ? "24px 20px" : "34px 36px", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <StepNum n={1} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#16241c" }}>Property address</span>
            </div>
            <input ref={addrRef} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state ZIP" spellCheck="false"
              style={{ width: "100%", display: "block", border: "1.5px solid #e2e8e2", background: "#f7faf7", borderRadius: 12, padding: "15px 18px", marginBottom: 30, fontSize: 16, fontWeight: 600, color: "#16241c", fontFamily: "inherit", outline: "none" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
              <StepNum n={2} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "#16241c" }}>CAD evidence packet</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#8a988f", background: "#eef3ee", padding: "3px 9px", borderRadius: 20 }}>Optional</span>
            </div>

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

            <button onClick={analyze} disabled={ctaDisabled} style={ctaStyle}>
              {isAnalyzing ? (
                <React.Fragment>
                  <span style={{ width: 16, height: 16, border: "2.5px solid rgba(255,255,255,.4)", borderTopColor: "#fff", borderRadius: 999, display: "inline-block", animation: "spin .7s linear infinite" }}></span>
                  Analyzing evidence…
                </React.Fragment>
              ) : (
                <React.Fragment>Find my best method <span style={{ fontSize: 17 }}>→</span></React.Fragment>
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
        ) : null}

        {showForm && !isAnalyzing ? (
          <p style={{ textAlign: "center", margin: "0 0 64px", fontSize: 13.5, color: "#7c8a80", fontWeight: 500 }}>
            Just reviewing the design?{" "}
            <span onClick={loadDemo} style={{ color: "#2c8350", fontWeight: 700, cursor: "pointer", borderBottom: "1px solid #bcd9c8" }}>Preview a sample recommendation →</span>
          </p>
        ) : null}

        {status === "done" && result ? <Result r={result} onReset={reset} address={result.address || address} cadRaw={cadRaw} cadMethod={cadMethod} /> : null}

        {/* Refer-a-friend also lives on the intake page so the header pill
            always has a target to scroll to. On the results page the same
            block is rendered inside <Result>, so it never doubles up. */}
        {showForm ? (
          <div style={{ marginTop: 8 }}>
            <ReferBlock />
            <p style={{ textAlign: "center", fontSize: 12.5, color: "#a4b0a7", lineHeight: 1.55, maxWidth: 620, margin: "0 auto" }}>Evidence is read in your browser for this session only. This analysis supports a Texas §41.43 protest filing — it isn't a USPAP appraisal, legal, or tax advice.</p>
          </div>
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
function Result({ r, onReset, address, cadRaw, cadMethod }) {
  const th = THEME[r.tier];
  const SF = r.subjSqft;
  const narrow = useNarrow(720);
  const [exporting, setExporting] = React.useState("");
  const [openPopup, setOpenPopup] = React.useState(null);
  const j = r.jurisdiction || {};
  const backup = r.backupInfo;

  const HANDOFF_KEY = "taxdrop-analyzer-handoff";
  const triggerExport = (which, format) => {
    if (exporting) return;
    const id = which + ":" + format;
    setExporting(id);
    const addr = encodeURIComponent((address || "").trim());
    let url = "";
    if (which === "our") {
      url = "/test/evidence-pack-v3?address=" + addr + "&export=" + format;
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
    <section style={{ paddingTop: 8, animation: "fadeUp .5s ease both" }}>

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

      {/* RECOMMENDATION HERO */}
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
                <div style={{ fontSize: 12, fontWeight: 600, color: "#ffffffaa", marginBottom: 7 }}>Your {CURRENT_TAX_YEAR} notice</div>
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

      {/* RATIONALE */}
      <section style={{ background: "#fff", border: "1px solid #e6ebe6", borderLeft: "4px solid " + th.main, borderRadius: 14, padding: "22px 26px", marginBottom: 64 }}>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#34433a", fontWeight: 500 }}>{r.rationale}</p>
      </section>

      <ProtestGuide r={r} j={j} backup={backup} />

      {/* COMPARE STRATEGIES */}
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

      {/* EVIDENCE */}
      <section style={{ marginBottom: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#1d6b41", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>$</div>
          <h2 style={{ margin: 0, fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em", color: "#16241c" }}>The evidence behind it</h2>
        </div>

        {r.medianCards.length ? (
          <div style={{ display: "grid", gridTemplateColumns: (narrow || r.medianCards.length <= 1) ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 18 }}>
            {r.medianCards.map((m, i) => {
              const d = m.value - r.notice; const below = d < 0;
              return (
                <div key={i} style={{ background: m.winner ? "#fdf9ef" : "#fff", border: m.winner ? "1.5px solid #e6cf94" : "1px solid #e6ebe6", borderRadius: 16, padding: "22px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: m.winner ? "#8a6311" : "#5d6f64" }}>{m.label}</span>
                    <span style={m.winner
                      ? { fontSize: 11, fontWeight: 800, letterSpacing: ".04em", color: "#fff", background: "#b1851a", padding: "4px 11px", borderRadius: 20 }
                      : { fontSize: 11, fontWeight: 700, color: below ? "#1d6b41" : "#b03f2c", background: below ? "#e3efe6" : "#fbeae6", padding: "4px 10px", borderRadius: 20 }}>{m.winner ? "CHOSEN" : (below ? "below notice" : "above notice")}</span>
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, color: m.winner ? "#8a6311" : "#16241c", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmt(m.value)}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: below ? "#1d6b41" : "#b03f2c", marginTop: 8 }}>{below ? "↓ " : "↑ "}{signed(d)} vs your notice</div>
                  <div style={{ fontSize: 12.5, color: m.winner ? "#b59a55" : "#9aa69d", marginTop: 4 }}>{m.source}</div>
                </div>
              );
            })}
          </div>
        ) : null}

        {r.comps.length ? (
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
      </section>

      {/* EXPORT PACKETS */}
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

      {/* REFER A FRIEND */}
      <ReferBlock />

      <p style={{ textAlign: "center", fontSize: 12.5, color: "#a4b0a7", lineHeight: 1.55, maxWidth: 620, margin: "0 auto" }}>Evidence is read in your browser for this session only. This analysis supports a {j.statuteShort || "Texas §41.43"} protest filing — it isn't a USPAP appraisal, legal, or tax advice.</p>
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

/* ───────── step-by-step protest guide (timeline) ───────── */
function ProtestGuide({ r, j, backup }) {
  const target = fmt(r.target);
  const step3 = backup
    ? <React.Fragment>At the informal, anchor to <strong style={{ color: "#8a6311" }}>{target}</strong>, backed by your strongest evidence. If the appraiser pushes back, fall to your defensible backup — the {backup.name.toLowerCase()} at <strong style={{ color: "#34433a" }}>{fmt(backup.value)}</strong> — rather than conceding the whole reduction.</React.Fragment>
    : <React.Fragment>At the informal, anchor to <strong style={{ color: "#8a6311" }}>{target}</strong>, backed by your evidence packet. Hold firm on the methodology — the value is built from the county's own indicators, adjusted to your home.</React.Fragment>;

  const steps = [
    { n: "1", title: "File your Notice of Protest",
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
      <SectionHead icon="→" title="Your protest, step by step" sub="Five moves from recommendation to a lower tax bill. Lead with the recommended value; keep the backup in your pocket." />
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
