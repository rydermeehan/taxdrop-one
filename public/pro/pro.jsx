/* TaxDrop One — single consolidated interface (was TaxDrop Pro, renamed 2026-06-11).
   Address + CAD evidence PDF in → the best reduction out.
   We run every reduction strategy we model (county sales/equity medians, the
   lowest qualifying comps, TaxDrop's own generated equity comps, and a token
   settlement floor), then LEAD with the highest-savings value that beats the
   notice. The most defensible qualifying strategy is kept as the backup.
   Each strategy carries a defensibility rank (county indicators > single comp >
   generated comps); ties on savings break toward the more defensible one.
   CAD parsing reuses window.Analyzer + window.Extractor (the Evidence Analyzer
   engine). Our comps come from the engine via the same-origin cad-proxy. */
const { useState, useRef, useCallback, useEffect } = React;

const TAX_RATE = 2.2; // % effective; used only for the est-savings line
const TOKEN_PCT = 0.03; // 3% token settlement when nothing beats the notice
// Engine has a known stale-record bug: certain address normalizations
// (e.g. "5749 La Vista Ct, Dallas, TX" with no ZIP) resolve to a duplicate
// prior-year row while the same address WITH ZIP resolves to the canonical
// current-year row. We force the ZIP on every lookup and drop (never lead
// with) any pre-CURRENT_TAX_YEAR row the engine returns, degrading to the
// uploaded CAD packet instead of blocking. (2026-06-22 — Mike: "why did this
// use 2025?"; 2026-06-24 — stop dead-ending when only an old row exists.)
const CURRENT_TAX_YEAR = 2026;

// Resolve an address to "Street, City, State ZIP" via the Google Maps
// geocoder before sending it to the engine. Returns the input unchanged
// if it already has a ZIP or if the geocoder isn't loaded yet.
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

const THEME = {
  automatic: { main: "#1c6b47", grad: "linear-gradient(135deg,#1c6b47,#125239)", soft: "#e7f3ec", border: "#bfe0cd" },
  potential: { main: "#2f8f6b", grad: "linear-gradient(135deg,#2f8f6b,#1c6b47)", soft: "#e9f4ef", border: "#c8e4d6" },
  our: { main: "#a87722", grad: "linear-gradient(135deg,#b5852b,#8a611a)", soft: "#f6efdb", border: "#ecd9a6" },
  token: { main: "#5e6b64", grad: "linear-gradient(135deg,#647069,#454f49)", soft: "#eef1ef", border: "#d3ddd7" },
};

const TIER_TAG = { automatic: "AUTOMATIC WIN", potential: "POTENTIAL WIN", our: "OUR EVIDENCE", token: "NO CASE" };
const TIER_NAME = { automatic: "Locked-In Reduction", potential: "Strong Case", our: "TaxDrop-Backed Case", token: "Token Settlement" };

/* ───────── V3 per-comp adjustment math (must stay in sync with
   evidence-pack-v3.html computeAdjBreakdown). Mike's 2026-06-19
   directive: the value on /pro must match the value in the v3 PDF.
   Both pages now use this same per-comp logic to compute the
   adjusted property value, then take the median, then apply the
   3% threshold + 2nd-lowest fallback. */
function computeAdjBreakdownV3(s, c, sizeBaselinePsf) {
  const compSqft = c.living_sqft || 0;
  const compVal = c.total_market || 0;
  const subjSqft = s.living_sqft || 0;
  const rawPsf = (compSqft > 0 && compVal > 0) ? (compVal / compSqft) : 0;
  if (!rawPsf || !compSqft || !subjSqft) {
    return { rawPsf, totalAdjPsf: 0, finalPsf: rawPsf };
  }
  let running = rawPsf;

  // 1. GLA size (Mike's V4): (median imp $/SF ÷ 2) × (subj_sqft − comp_sqft)
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

  // 2. Age (Mike's V4): median_imp_psf × 0.35% × (subj_year − comp_year)
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

  // 3. Land value — capped at ±10% of comp PSF
  if (c.land_value && s.land_value && compSqft > 0) {
    const landDiffPerSqft = (c.land_value - s.land_value) / compSqft;
    const maxLandAdj = rawPsf * 0.10;
    const capped = Math.max(-maxLandAdj, Math.min(maxLandAdj, landDiffPerSqft));
    running -= capped;
  }

  // 4. Features — pool/garage/fp from c.adjustment_total
  const featureAdjPsf = compSqft > 0 ? (c.adjustment_total || 0) / compSqft : 0;
  running += featureAdjPsf;

  // 5. Single-comp cap at ±30%
  const maxSwing = rawPsf * 0.30;
  const cappedPsf = Math.max(rawPsf - maxSwing, Math.min(rawPsf + maxSwing, running));
  return { rawPsf, totalAdjPsf: cappedPsf - rawPsf, finalPsf: cappedPsf };
}

// Filter comps the same way v3 does — drop renovation outliers
// (effective-year delta >25 yr) and statistical outliers (>30% above
// median of remaining adjusted property values).
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
    // Pre-compute baseline imp psf from the post-renovation-filter set
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

// V3-style median + 3% threshold + 2nd-lowest fallback. Returns
// { value, strategy, median, secondLowest } so pro.jsx can label things.
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

/* ───────────────────────── decision engine ───────────────────────── */
// cad  = window.Analyzer.analyze(extracted)  (or null)
// our  = engine /api/evidence-pack/lookup response  (or null)
function decide(cad, our, address) {
  // Mike's 2026-06-20: "the values aren't in alignment" — root cause was a
  // CAD packet for a different property (738 Pinehill, notice $299K) being
  // mixed with the address-driven engine lookup (6101 Lake Shore Dr, notice
  // $1.59M). The CAD packet's notice was overriding the engine's notice and
  // the CAD comps were treated as the right property's evidence.
  //
  // Notice MUST come from the engine (address-driven). When the CAD packet's
  // assessed value differs materially from the engine notice (>25%), the
  // packet is almost certainly for a different property — discard it.
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
  // Surface the mismatch for the UI to render a warning banner.
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

  // ---- CAD medians (sales + equity, or a single generic median) ----
  // Use effectiveCad so a mismatched packet (different property) contributes
  // nothing — see the address/notice mismatch check at the top of decide().
  const cadMedians = [];
  if (effectiveCad) {
    if (effectiveCad.salesMedian != null) cadMedians.push({ key: "salesMedian", label: "Median market value", value: effectiveCad.salesMedian, source: "CAD sales evidence" });
    if (effectiveCad.equityMedian != null) cadMedians.push({ key: "equityMedian", label: "Median equity value", value: effectiveCad.equityMedian, source: "CAD equity evidence" });
    if (!cadMedians.length && effectiveCad.weightedMedian != null) cadMedians.push({ key: "median", label: "Median of comparables", value: effectiveCad.weightedMedian, source: "CAD evidence" });
  }
  const autoCandidates = cadMedians.filter((m) => notice != null && m.value < notice);
  const automaticValue = autoCandidates.length ? Math.min(...autoCandidates.map((m) => m.value)) : null;

  // ---- 2nd-lowest CAD comp (sales or equity, whichever lower) ----
  const secondLowest = effectiveCad && effectiveCad.secondLowest ? effectiveCad.secondLowest : null;
  const potentialValue = secondLowest && notice != null && secondLowest.value < notice ? secondLowest.value : null;

  // ---- our generated equity recommendation ----
  // Use the FULL v3 calculation (renovation/outlier filters + per-comp
  // adjustments + median anchor + 3% threshold + 2nd-lowest fallback) so
  // the value displayed on /pro matches the value in the v3 PDF exactly.
  // (Mike's 2026-06-19: "The value on the PDF is not the same as what's
  // on the page" — root cause was /pro used the API's raw median while v3
  // used a client-side adjusted median.)
  let ourMedian = null;
  let ourValue = null;
  let ourSecondLowest = null;
  if (our && our.subject && Array.isArray(our.comps)) {
    const v3 = computeV3Strategy(our.subject, our.comps);
    ourValue = v3.value;
    ourMedian = v3.value;       // alias for backward compat downstream
    ourSecondLowest = v3.secondLowest;
  }

  // ---- token ----
  const tokenValue = notice != null ? Math.round(notice * (1 - TOKEN_PCT)) : null;

  // ---- build the full strategy set (every angle we model, as a flat list) ----
  // defRank = defensibility (lower = stronger): county indicators > single comp > our comps.
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

  // Selection logic (Mike's 2026-06-19 directive after seeing 39% reduction
  // on 6101 Lake Shore Dr): the PRIMARY anchor MUST be our equity-comps
  // value (v3 methodology — median with 3% threshold + 2nd-lowest fallback,
  // with renovation/outlier filters applied upstream). CAD strategies stay
  // in the ladder as alternative angles but no longer override our anchor
  // just because they're aggressive — they're parsed from the CAD packet
  // without our outlier filters, so a CAD outlier could mistakenly pull the
  // primary recommendation to an indefensible value (e.g. $970K = 39%
  // off subject's $1.59M when our equity median says $1.39M = 13% off).
  //
  // Order of preference for primary:
  //   1. Our equity value (ourValue)
  //   2. Most defensible CAD strategy that beats the notice
  //   3. Token fallback
  const real = strategies.filter((s) => notice != null && s.value != null && s.value < notice);
  let primary, backup = null;
  const ourStrategy = real.find((s) => s.key === "ourReport");
  if (ourStrategy) {
    primary = ourStrategy;
    // Backup = the most-defensible CAD strategy that also beats the notice
    const cadReal = real.filter((s) => s.tier !== "our");
    if (cadReal.length) {
      backup = [...cadReal].sort((a, b) => a.defRank - b.defRank || a.value - b.value)[0];
    }
  } else if (real.length) {
    // No qualifying equity anchor — pick the most defensible CAD strategy
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

  // ---- rationale (lead with the biggest reduction; name the defensible backup) ----
  const backupLine = backup
    ? " Your most defensible fallback — the " + backup.name.toLowerCase() + " at " + fmt(backup.value) +
      " — stays ready in case the lead is challenged."
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
      " under your notice — and that's the evidence we build the protest around." + backupLine,
    token:
      "No strategy in the set beats your notice this cycle — every indicator lands above it. We pursue a token " +
      Math.round(TOKEN_PCT * 100) + "% courtesy reduction at the informal hearing: modest relief now, with the full case rebuilt next year.",
  }[tier];

  // ---- decision ladder (dynamic — every strategy we ran, recommended first) ----
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
      return "Recommended — the largest reduction the evidence supports (" + fmt(reduction) + " off your notice).";
    if (status === "backup")
      return "Most defensible fallback — the county's own indicator, held in reserve if the lead is challenged.";
    if (status === "available")
      return "Also below your notice (" + fmt(s.value) + ") — kept as an alternative angle.";
    if (status === "na")
      return "Skipped — real, evidence-backed reductions are on the table.";
    return s.name + " lands at " + fmt(s.value) + ", above your notice — no reduction here.";
  };
  const sortRank = { selected: 0, backup: 1, available: 2, failed: 3, na: 4 };
  // Show only strategies that are USED or ADVANTAGEOUS — selected, the
  // defensible backup, and other angles that actually beat the notice.
  // Hide rows that landed at/above the notice ("failed") and the token row
  // when real reductions are on the table ("na"). The decision math still
  // considers every angle; we just don't surface dead-ends in the UI.
  // (2026-06-11 — agent feedback on visual clutter.)
  const VISIBLE_STATUSES = new Set(["selected", "backup", "available"]);
  const ladder = allRows
    .map((s) => {
      const status = statusOf(s);
      return { key: s.key, tag: TIER_TAG[s.tier], name: s.name, value: s.value, reason: reasonOf(s, status), status, _v: s.value == null ? Infinity : s.value };
    })
    .filter((row) => VISIBLE_STATUSES.has(row.status) || row.status === "selected")
    .sort((a, b) => (sortRank[a.status] - sortRank[b.status]) || (a._v - b._v));

  // ---- medians cards (for the evidence section) ----
  const medianCards = cadMedians.slice();
  if (ourMedian != null) medianCards.push({ key: "ourReport", label: "TaxDrop equity report", value: ourMedian, source: "Generated comp set" });
  const winnerKey = primary.kind === "median" ? primary.mkey : null;
  medianCards.forEach((m) => { m.winner = m.key === winnerKey; });

  // ---- comps table ----
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
    dataQuality: effectiveCad ? effectiveCad.dataQuality || null : null,
  };
}

/* ───────────────────────── small UI atoms ───────────────────────── */
function Header() {
  return (
    <header style={{ position: "sticky", top: 0, zIndex: 30, background: "rgba(255,255,255,.86)", backdropFilter: "blur(10px)", borderBottom: "1px solid #e4ebe7" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", gap: 16 }}>
        <img src="assets/taxdrop-logo.png" alt="TaxDrop" style={{ height: 26, width: "auto", display: "block" }} />
        <span style={{ width: 1, height: 22, background: "#dde6e1" }}></span>
        <span style={{ fontWeight: 600, fontSize: 15.5, color: "#3a463f" }}>One</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13.5, color: "#8a958f", fontWeight: 500 }}>Tax Year 2026</span>
          <span style={{ width: 30, height: 30, borderRadius: 999, background: "#1c6b47", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>AG</span>
        </div>
      </div>
    </header>
  );
}

function StepNum({ n }) {
  return <span style={{ width: 24, height: 24, borderRadius: 999, background: "#1c6b47", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{n}</span>;
}

/* ───────────────────────── file upload constants ───────────────────────── */
// Per-file size cap. CAD evidence PDFs run 1-5 MB; an Excel roll-export
// add-on is typically <1 MB. 10 MB per file leaves headroom without letting
// someone drag a scanned 80-page PDF that the in-browser parser would choke
// on anyway. (2026-06-11 multi-file rollout on /pro.)
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
  // Raw parsed CAD evidence (the dict, not the analysis) — held so the
  // inline-export buttons can hand it off to the Evidence Analyzer via
  // sessionStorage without making the user re-drop the PDF.
  // (2026-06-11 inline export rollout.)
  const [cadRaw, setCadRaw] = useState(null);
  const [cadMethod, setCadMethod] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const addrRef = useRef(null);

  // Google Places autocomplete on the address field. The Maps script loads
  // async, so poll until google.maps.places is ready, then attach once.
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
  }, []);

  const pickFiles = (incoming) => {
    const list = Array.from(incoming || []).filter(Boolean);
    if (!list.length) return;
    // Validate each file: supported type AND under the 10 MB per-file cap.
    // Mix-and-match drops (PDF + Excel) are allowed; rejected files leave
    // the rest accepted so the user doesn't have to re-drop everything.
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
    // Append to existing selection so users can build the upload across
    // multiple drops (cover-letter PDF, then a comps spreadsheet).
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

  // CAD packet is optional — an address alone runs on the engine's own comps.
  // (When the engine has no comps for the county, the result falls to the
  // "fairly assessed" path rather than blocking.)
  const canAnalyze = !!address.trim() && status !== "analyzing";

  const analyze = useCallback(async () => {
    if (!address.trim()) return;
    setStatus("analyzing"); setStep(0); setError("");
    try {
      // 1) CAD evidence from the uploaded files (any mix of PDF, Excel, CSV)
      let cad = null;
      try {
        const ext = await window.Extractor.extractFromFiles(files);
        if (ext && ext.ok) {
          cad = window.Analyzer.analyze(ext.data);
          setCadRaw(ext.data);
          setCadMethod(ext.method || "");
        }
      } catch (e) { /* CAD parse failed — fall through with cad=null */ }
      setStep(1);

      // 2) our comps from the engine (same-origin proxy injects the key).
      // Force ZIP into the address before lookup — see ensureAddressZip
      // for the duplicate-record bug this defends against.
      let our = null;
      let staleYear = null;   // DB-path prior-year row we refuse to lead with
      let thinData = false;   // engine found the parcel but data is too sparse
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
            const isAttom = data.data_source === "ATTOM";
            const subjVal = Number(data.subject.total_market) || 0;
            const subjSqft = Number(data.subject.living_sqft) || 0;
            if (!isAttom && ty && ty < CURRENT_TAX_YEAR) {
              // DB-path prior-year row: a stale/duplicate record while a newer
              // one exists (the 5749 La Vista Ct, Dallas case). We never LEAD
              // with pre-CURRENT_TAX_YEAR DB numbers (Mike 2026-06-22, "why did
              // this use 2025?"), so drop it and keep going on the CAD packet.
              // This guard is DB-ONLY on purpose: an ATTOM fallback legitimately
              // returns the latest assessment year ATTOM has (often the prior
              // year), and gating that was dead-ending EVERY ATTOM-served county
              // — the 2026-06-24 regression behind "still not working".
              staleYear = ty;
            } else if (isAttom && (!subjVal || !subjSqft)) {
              // ATTOM found the parcel but has no usable value/size to anchor a
              // case — typical of rural/land parcels (1144 Private Road 1539,
              // Bridgeport: market $82K, no sqft, and nonsensical comps like a
              // 355-sqft home at $1.46M). Don't fabricate a reduction off junk
              // comps; route to the packet path instead. (2026-06-24.)
              thinData = true;
            } else {
              our = data;
            }
          }
        }
      } catch (e) { /* our lookup failed — fall through with our=null */ }
      setStep(2);

      if (!cad && !our) {
        setError(
          (staleYear || thinData)
            ? "We couldn't pull enough current data on file to build this " +
              "property's case automatically. Upload your county's " +
              CURRENT_TAX_YEAR + " evidence packet above and we'll build the " +
              "case straight from it."
            : "We couldn't read the evidence or find this property. Check the address and that the PDF is the county's evidence packet (not a scan)."
        );
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

  const reset = () => { setStatus("idle"); setStep(0); setResult(null); setError(""); };

  const isAnalyzing = status === "analyzing";
  const ctaDisabled = !canAnalyze;
  const ctaStyle = {
    marginTop: 24, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
    fontSize: 16, fontWeight: 700, color: "#fff", border: "none", borderRadius: 13, padding: 16,
    cursor: ctaDisabled ? "not-allowed" : "pointer",
    background: ctaDisabled ? "#b9cabf" : "linear-gradient(180deg,#23845a,#155e3c)",
    boxShadow: ctaDisabled ? "none" : "0 14px 30px -14px rgba(21,94,60,.75)",
  };
  const dropStyle = {
    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
    border: "2px dashed " + (dragging ? "#1c6b47" : "#cdd9d2"), background: dragging ? "#eef7f1" : "#f8fbf9",
    borderRadius: 16, padding: "30px 24px", transition: "all .15s",
  };

  const stepLabels = ["Reading the county evidence packet", "Extracting sales & equity comparables", "Running your full strategy set", "Selecting your highest-savings value"];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />
      <main style={{ flex: 1, width: "100%", maxWidth: 1120, margin: "0 auto", padding: "54px 28px 40px" }}>

        {/* HERO */}
        <section style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 38px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".16em", color: "#2f9468", textTransform: "uppercase", marginBottom: 14 }}>Property Tax · One</div>
          <h1 style={{ fontSize: 46, lineHeight: 1.04, fontWeight: 800, letterSpacing: "-.03em", margin: "0 0 16px" }}>One upload. Your strongest&nbsp;reduction.</h1>
          <p style={{ fontSize: 18, lineHeight: 1.5, color: "#5e6b64", margin: 0, fontWeight: 500 }}>Enter the property — and optionally drop the county's evidence packet — and we'll test every method — automatic wins, backup comps, our own report — and hand you the lowest defensible value to file.</p>
        </section>

        {/* INPUT CARD */}
        <section style={{ background: "#fff", border: "1px solid #e4ebe7", borderRadius: 22, boxShadow: "0 24px 60px -38px rgba(20,60,42,.4)", padding: 30, maxWidth: 880, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><StepNum n={1} /><span style={{ fontWeight: 700, fontSize: 15.5 }}>Property address</span></div>
          <div style={{ display: "flex", gap: 10, marginBottom: 26 }}>
            <input ref={addrRef} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city, state ZIP" spellCheck="false"
              style={{ flex: 1, minWidth: 0, fontFamily: "inherit", fontSize: 15.5, fontWeight: 500, color: "#18241f", background: "#f6f9f7", border: "1.5px solid #e4ebe7", borderRadius: 12, padding: "13px 15px", outline: "none" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><StepNum n={2} /><span style={{ fontWeight: 700, fontSize: 15.5 }}>CAD evidence packet</span><span style={{ fontSize: 12, fontWeight: 600, color: "#8a988f", background: "#eef3ee", padding: "3px 9px", borderRadius: 20 }}>Optional</span></div>

          <div onDragOver={(e) => { e.preventDefault(); if (!dragging) setDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setDragging(false); }} onDrop={onDrop} onClick={() => fileRef.current && fileRef.current.click()} style={dropStyle}>
            <input
              type="file"
              multiple
              accept=".pdf,.xlsx,.xlsm,.xls,.xlsb,.csv,.tsv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              ref={fileRef}
              onChange={(e) => { pickFiles(e.target.files); e.target.value = ""; }}
              style={{ display: "none" }}
            />
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e7f3ec", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1c6b47" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>
            </div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 5 }}>Drop CAD evidence — PDF, Excel, or CSV</div>
            <div style={{ fontSize: 14, color: "#5e6b64", marginBottom: 16, fontWeight: 500 }}>Drop one file or several at once (e.g. the cover-letter PDF plus a comparables spreadsheet). Up to 10 MB per file. No packet? We'll build the case from our own comps.</div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(180deg,#23845a,#155e3c)", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 18px", borderRadius: 11, boxShadow: "0 8px 20px -10px rgba(21,94,60,.7)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></svg>
              {files.length ? "Add more files" : "Choose files"}
            </span>
          </div>

          {/* Selected-file list (multi-file capable). Each row removable. */}
          {files.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map((f, idx) => (
                <div key={f.name + ":" + f.size + ":" + idx} style={{ display: "flex", alignItems: "center", gap: 13, background: "#f4faf6", border: "1.5px solid #cfe7d9", borderRadius: 13, padding: "12px 14px" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: "#1c6b47", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                    <div style={{ fontSize: 12, color: "#6f8278", fontWeight: 500 }}>{(f.size / 1024 / 1024).toFixed(f.size > 1024 * 1024 ? 1 : 2)} MB</div>
                  </div>
                  <button onClick={(e) => clearFile(e, idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#8a958f", padding: 6, display: "flex" }} aria-label="Remove">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
              {files.length > 1 && (
                <button onClick={(e) => clearFile(e)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#8a958f", fontSize: 12.5, fontWeight: 600, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, padding: "4px 6px" }}>
                  Clear all
                </button>
              )}
            </div>
          )}

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
              <React.Fragment>
                Find my best method
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </React.Fragment>
            )}
          </button>

          {isAnalyzing ? (
            <div style={{ marginTop: 22, borderTop: "1px solid #eef2f0", paddingTop: 20 }}>
              <div style={{ height: 6, borderRadius: 999, background: "#e7eeea", overflow: "hidden", marginBottom: 18 }}>
                <div style={{ width: Math.min((step + 1) / 4, 1) * 100 + "%", height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#1c6b47,#2bb0c4)", transition: "width .5s ease" }}></div>
              </div>
              {stepLabels.map((label, i) => {
                const done = i < step, active = i === step;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "5px 0" }}>
                    <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: done ? "#fff" : active ? "#1c6b47" : "#b6c2bb", background: done ? "#1c6b47" : active ? "#e7f3ec" : "#eef2f0", animation: active ? "pulseDot 1s ease-in-out infinite" : "" }}>{done ? "✓" : active ? "●" : ""}</span>
                    <span style={{ fontSize: 14.5, fontWeight: active || done ? 600 : 500, color: done || active ? "#18241f" : "#9aa6a0" }}>{label}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        {status === "done" && result ? <Result r={result} onReset={reset} address={address} cadRaw={cadRaw} cadMethod={cadMethod} /> : null}

        <footer style={{ maxWidth: 760, margin: "46px auto 0", textAlign: "center" }}>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: "#9aa6a0", fontWeight: 500, margin: 0 }}>Evidence is read in your browser for this session only. This analysis supports a Texas §41.43 protest filing — it isn't a USPAP appraisal, legal, or tax advice.</p>
        </footer>
      </main>
    </div>
  );
}

/* ───────────────────────── result view ───────────────────────── */
function Result({ r, onReset, address, cadRaw, cadMethod }) {
  const th = THEME[r.tier];
  // Render-time backstop against an all-identical comp set slipping through to
  // the table (engine guard already empties these; this covers stale cached
  // analyzer.js / future regressions). Victoria CAD, 2026-06-29.
  const compsDegenerate =
    Array.isArray(r.comps) && r.comps.length >= 2 &&
    new Set(r.comps.map((c) => Math.round(c.val))).size === 1;
  const showComps = r.comps.length && !compsDegenerate;
  const readNotice = (r.dataQuality && r.dataQuality.message) ||
    (compsDegenerate
      ? "Every comparable read back at the same value — the packet's comparable grid couldn't be read individually, so there's nothing to compare. Re-upload a clearer copy or check the packet before relying on this."
      : null);
  const stat = {
    selected: { label: "Recommended", bg: th.main, color: "#fff", icon: "✓" },
    backup: { label: "Defensible backup", bg: "#fbf3e2", color: "#a8772a", icon: "★" },
    available: { label: "Alternative", bg: "#eef4f0", color: "#3a8c63", icon: "•" },
    notneeded: { label: "Not needed", bg: "#f0f3f1", color: "#9aa6a0", icon: "–" },
    failed: { label: "Doesn't qualify", bg: "#f4eceb", color: "#b4564b", icon: "✕" },
    na: { label: "Skipped", bg: "#f0f3f1", color: "#9aa6a0", icon: "–" },
  };
  const SF = r.subjSqft;
  const [exporting, setExporting] = React.useState("");

  // Inline export: spawn an offscreen iframe of v2 or the analyzer with
  // ?export=pdf|docx. The embedded page auto-fires its own export and the
  // download triggers in this window (same-origin). For the analyzer we
  // also stash the parsed CAD evidence in sessionStorage so it can render
  // its results without making the user re-drop the PDF.
  // (2026-06-11 TaxDrop One inline-export rollout.)
  const HANDOFF_KEY = "taxdrop-analyzer-handoff";
  const triggerExport = (which, format) => {
    if (exporting) return;
    const id = which + ":" + format;
    setExporting(id);
    const addr = encodeURIComponent(address.trim());
    let url = "";
    if (which === "our") {
      url = "/test/evidence-pack-v3?address=" + addr + "&export=" + format;
    } else if (which === "cad" || which === "cad-county") {
      // analyzer requires the parsed evidence — stash it before opening.
      if (!cadRaw) {
        setExporting("");
        alert("We don't have the parsed CAD evidence to export — re-run the analysis on this address.");
        return;
      }
      try {
        // localStorage instead of sessionStorage — new windows opened via
        // window.open() get a fresh sessionStorage, so the analyzer couldn't
        // see anything we stashed there. localStorage is per-origin and
        // shared. Analyzer reads then clears it; a 10-min TTL is enforced
        // on the consumer side as a belt-and-suspenders for stale data.
        localStorage.setItem(HANDOFF_KEY, JSON.stringify({
          ts: Date.now(), data: cadRaw, method: cadMethod || "ai",
        }));
      } catch (_) { /* localStorage full / disabled — proceed; analyzer will show drop UI */ }
      const handoffMode = which === "cad-county" ? "county" : "full";
      url = "/evidence-analyzer?export=" + format + "&handoff=" + handoffMode;
    }
    // Open in a real popup window instead of a hidden iframe. Chrome 117+
    // blocks window.print() from iframes positioned outside the viewport
    // (left:-9999px), which was killing every PDF download. A real window
    // preserves the user-gesture chain, surfaces the print dialog reliably,
    // and lets the page close itself after print. Popups triggered by a
    // direct user click are not blocked by default popup-blockers.
    // (2026-06-22 fix: "the PDF download never processes — all failed".)
    const winName = "taxdrop-export-" + Date.now();
    const w = window.open(url, winName, "width=1024,height=900,scrollbars=yes,resizable=yes");
    if (!w) {
      setExporting("");
      alert("Pop-up blocked — please allow pop-ups for one.taxdrop.com so the PDF can open.");
      return;
    }
    // The export page fires window.print() itself once content is ready and
    // can close its own window afterward. Reset the button state once the
    // popup is gone (or after a generous safety window for slow networks).
    const safetyMs = format === "pdf" ? 60000 : 30000;
    const tick = setInterval(() => {
      if (w.closed) { clearInterval(tick); setExporting(""); }
    }, 500);
    setTimeout(() => { clearInterval(tick); setExporting(""); }, safetyMs);
  };

  const ExportButton = ({ which, format, label }) => {
    const id = which + ":" + format;
    const busy = exporting === id;
    const isPrimary = format === "pdf";
    const styles = isPrimary
      ? { background: "#fff", color: "#18241f", border: "1px solid rgba(255,255,255,0)" }
      : { background: "rgba(255,255,255,.10)", color: "#fff", border: "1px solid rgba(255,255,255,.32)" };
    return (
      <button onClick={() => triggerExport(which, format)} disabled={!!exporting}
        style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13.5,
                 borderRadius: 10, padding: "10px 14px", cursor: exporting ? "default" : "pointer",
                 opacity: exporting && !busy ? 0.55 : 1, ...styles }}>
        {busy ? "Generating…" : label}
      </button>
    );
  };

  return (
    <section style={{ maxWidth: 880, margin: "34px auto 0", animation: "fadeUp .5s ease both" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "0 0 16px", padding: "0 2px" }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: "#2f9468", margin: 0 }}>Recommendation</h2>
        <span style={{ fontSize: 13.5, color: "#8a958f", fontWeight: 500 }}>{r.address}</span>
        <button onClick={onReset} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#8a958f", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}>Start over</button>
      </div>

      {/* CAD-packet mismatch warning — Mike's 2026-06-20 fix for cross-
          property contamination (uploaded 738 Pinehill packet while
          entering 6101 Lake Shore Dr → packet rejected, recommendation
          based purely on the engine's address-driven equity comps). */}
      {r.cadMismatch ? (
        <div style={{ background: "#fff7e6", border: "1px solid #f3c97d", borderLeft: "4px solid #d68a14", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: "#5a3e0a", fontSize: 13.5, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ Uploaded CAD packet doesn't match this address</div>
          The packet you uploaded shows a noticed value of <b>{fmt(r.cadMismatch.cadAssessed)}</b>, but the engine sees <b>{fmt(r.cadMismatch.engineNotice)}</b> for the address above. Looks like the packet is for a different property — it's been ignored for this recommendation. Upload the matching CAD packet to enable the CAD-side strategies.
        </div>
      ) : null}

      {/* recommendation hero */}
      <div style={{ background: th.grad, borderRadius: 22, padding: "30px 30px 28px", boxShadow: "0 30px 60px -34px " + th.main }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em", color: th.main, background: "#fff", padding: "7px 15px", borderRadius: 999 }}>{TIER_NAME[r.tier]}</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", fontFamily: "ui-monospace,monospace", color: "#fff", background: "rgba(255,255,255,.18)", padding: "4px 9px", borderRadius: 6 }}>{TIER_TAG[r.tier]}</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: "34px 48px" }}>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.7)", marginBottom: 6 }}>{r.tier === "token" ? "Target settlement" : "File this value"}</div>
            <div style={{ fontSize: 58, lineHeight: .95, fontWeight: 800, letterSpacing: "-.03em", color: "#fff", fontVariantNumeric: "tabular-nums" }}>{fmt(r.target)}</div>
          </div>
          <div style={{ display: "flex", gap: 34, paddingBottom: 6 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,.7)", marginBottom: 5 }}>Your 2026 notice</div>
              <div style={{ fontSize: 21, fontWeight: 700, color: "rgba(255,255,255,.92)", textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,.45)", fontVariantNumeric: "tabular-nums" }}>{fmt(r.notice)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,.7)", marginBottom: 5 }}>Value reduction</div>
              <div style={{ fontSize: 21, fontWeight: 800, color: "#fff", fontVariantNumeric: "tabular-nums" }}>−{fmt(r.reduction)} <span style={{ fontWeight: 600, fontSize: 15, color: "rgba(255,255,255,.8)" }}>({r.pct.toFixed(1)}%)</span></div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)", borderRadius: 11, padding: "10px 15px" }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>Est. tax savings <strong style={{ fontWeight: 800 }}>~{fmt(r.taxSaved)}/yr</strong></span>
          </div>
        </div>
      </div>

      {/* Export packs — always-on so the agent can hand a customer BOTH the
          TaxDrop-built protest brief AND the CAD's own evidence analyzer pack,
          regardless of which strategy won the decision ladder. PDF + DOCX for
          each. Exports run inline via hidden iframes — no popup, no new tab. */}
      <div style={{ background: "#fff", border: "1px solid #e4ebe7", borderRadius: 16, padding: "18px 20px", marginTop: 16 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#3a8c63", marginBottom: 10 }}>Export Packets</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ background: th.grad, borderRadius: 12, padding: "14px 16px", color: "#fff" }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>TaxDrop Evidence Pack</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.78)", marginBottom: 12 }}>Our independent equity brief with comp table, baseline, and methodology.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <ExportButton which="our" format="pdf" label="PDF" />
              <ExportButton which="our" format="docx" label="DOCX" />
            </div>
          </div>
          {/* CAD analyzer card — only available when the user uploaded a CAD
              packet (cadRaw is the parsed evidence). Without it the analyzer
              has nothing to render, so we replace the card with a hint. */}
          {cadRaw ? (
            <div style={{ background: "#18241f", borderRadius: 12, padding: "14px 16px", color: "#fff" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 2 }}>CAD Evidence Analyzer Pack</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.72)", marginBottom: 12 }}>A breakdown of the county's own evidence with the lowest defensible value flagged.</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.55)", marginBottom: 6 }}>Agent prep (internal)</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <ExportButton which="cad" format="pdf" label="PDF" />
                <ExportButton which="cad" format="docx" label="DOCX" />
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.55)", marginBottom: 6 }}>Send to CAD (attachment)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <ExportButton which="cad-county" format="pdf" label="PDF" />
                <ExportButton which="cad-county" format="docx" label="DOCX" />
              </div>
            </div>
          ) : (
            <div style={{ background: "#f1f4f2", borderRadius: 12, padding: "14px 16px", color: "#3a463f", border: "1px dashed #c7d2cc" }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4, color: "#18241f" }}>CAD Evidence Analyzer Pack</div>
              <div style={{ fontSize: 12, color: "#6b766f", lineHeight: 1.5 }}>
                Upload the county's evidence PDF (Step 2) to enable the analyzer pack — it parses the county's own comp set and generates a separate agent-prep document plus a clean CAD-attachment version.
              </div>
            </div>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: "#8a958f", marginTop: 12, lineHeight: 1.5 }}>
          PDF opens your browser's print dialog (save as PDF). DOCX downloads directly. Both pull live engine data — no re-uploading the county PDF.
        </div>
      </div>

      {/* rationale */}
      <div style={{ background: "#fff", border: "1px solid #e4ebe7", borderRadius: 16, padding: "20px 22px", marginTop: 16, display: "flex", gap: 14 }}>
        <span style={{ flexShrink: 0, width: 4, borderRadius: 999, background: th.main, alignSelf: "stretch" }}></span>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "#3a463f", fontWeight: 500 }}>{r.rationale}</p>
      </div>

      {/* decision ladder */}
      <div style={{ marginTop: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5, padding: "0 2px" }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: "#1c6b47", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
          <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.01em", margin: 0 }}>How we picked it</h3>
        </div>
        <p style={{ margin: "0 0 16px", padding: "0 2px 0 33px", fontSize: 14, color: "#6f8278", fontWeight: 500 }}>We run every reduction strategy and lead with the one that saves you the most — your most defensible play stays ready as a backup.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {r.ladder.map((row) => {
            const s = stat[row.status];
            const sel = row.status === "selected";
            const dim = row.status === "failed" || row.status === "na" || row.status === "notneeded";
            return (
              <div key={row.key} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", borderRadius: 14, border: "1.5px solid " + (sel ? th.border : "#e8edea"), background: sel ? th.soft : "#fff", boxShadow: sel ? "0 12px 30px -20px " + th.main : "none" }}>
                <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: sel ? "#fff" : s.color, background: sel ? th.main : s.bg, marginTop: 1 }}>{s.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 9 }}>
                    <span style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-.01em", color: sel ? th.main : (dim ? "#8a958f" : "#18241f") }}>{row.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".09em", fontFamily: "ui-monospace,monospace", color: "#9aa6a0", background: "#eef2f0", padding: "2px 7px", borderRadius: 5 }}>{row.tag}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: s.bg, color: s.color }}>{s.label}</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13.5, lineHeight: 1.45, fontWeight: 500, color: dim ? "#9aa6a0" : "#5e6b64" }}>{row.reason}</div>
                </div>
                <div style={{ flexShrink: 0, fontWeight: 800, fontSize: 17, letterSpacing: "-.01em", fontVariantNumeric: "tabular-nums", alignSelf: "center", color: sel ? th.main : (dim ? "#b6bfba" : "#18241f") }}>{row.value != null ? fmt(row.value) : "—"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* evidence */}
      <div style={{ marginTop: 34 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 16, padding: "0 2px" }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: "#1c6b47", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>$</span>
          <h3 style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.01em", margin: 0 }}>The evidence behind it</h3>
        </div>

        {r.medianCards.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 18 }}>
            {r.medianCards.map((m, i) => {
              const d = m.value - r.notice; const below = d < 0;
              return (
                <div key={i} style={{ flex: 1, minWidth: 210, background: "#fff", border: "1.5px solid " + (m.winner ? th.border : "#e4ebe7"), borderRadius: 14, padding: "18px 18px 16px", boxShadow: m.winner ? "0 12px 30px -22px " + th.main : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#5e6b64" }}>{m.label}</span>
                    <span style={m.winner
                      ? { fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "#fff", background: th.main, padding: "3px 8px", borderRadius: 999 }
                      : { fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", color: below ? "#1c6b47" : "#b4564b", background: below ? "#e7f3ec" : "#f6eceb", padding: "3px 8px", borderRadius: 999 }}>{m.winner ? "CHOSEN" : (below ? "below" : "above")}</span>
                  </div>
                  <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-.02em", fontVariantNumeric: "tabular-nums", color: m.winner ? th.main : "#18241f" }}>{fmt(m.value)}</div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: below ? "#1c6b47" : "#b4564b", fontVariantNumeric: "tabular-nums" }}>{below ? "↓" : "↑"} {signed(d)} vs your notice</div>
                  <div style={{ fontSize: 12, color: "#9aa6a0", fontWeight: 500, marginTop: 8 }}>{m.source}</div>
                </div>
              );
            })}
          </div>
        ) : null}

        {showComps ? (
          <div style={{ background: "#fff", border: "1px solid #e4ebe7", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.3fr 1fr .9fr 1.1fr", background: "#18241f", color: "#fff", fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>
              <div style={{ padding: "11px 16px" }}>Comparable</div>
              <div style={{ padding: "11px 12px" }}>Type</div>
              <div style={{ padding: "11px 12px", textAlign: "right" }}>Indicated</div>
              <div style={{ padding: "11px 12px", textAlign: "right" }}>$/SF</div>
              <div style={{ padding: "11px 16px", textAlign: "right" }}>vs notice</div>
            </div>
            {r.comps.map((c, i) => {
              const d = c.val != null ? c.val - r.notice : null; const below = d != null && d < 0;
              return (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1.3fr 1fr .9fr 1.1fr", alignItems: "center", borderTop: i > 0 ? "1px solid #eef2f0" : "none", background: i % 2 ? "#fafcfb" : "#fff" }}>
                  <div style={{ padding: "13px 16px", fontWeight: 600, fontSize: 14 }}>{c.addr}{c.note ? <span style={{ fontSize: 11, fontWeight: 600, color: "#a87722", marginLeft: 6 }}>· {c.note}</span> : null}</div>
                  <div style={{ padding: "13px 12px", fontSize: 13.5, color: "#5e6b64", fontWeight: 500 }}>{c.type}</div>
                  <div style={{ padding: "13px 12px", textAlign: "right", fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{fmt(c.val)}</div>
                  <div style={{ padding: "13px 12px", textAlign: "right", fontSize: 13.5, color: "#5e6b64", fontVariantNumeric: "tabular-nums" }}>{c.val != null && SF ? "$" + Math.round(c.val / SF) + "/SF" : "—"}</div>
                  <div style={{ padding: "13px 16px", textAlign: "right", fontWeight: 700, fontSize: 13.5, fontVariantNumeric: "tabular-nums", color: d == null ? "#9aa6a0" : (below ? "#1c6b47" : "#b4564b") }}>{d == null ? "—" : (below ? "↓ " : "↑ ") + signed(d)}</div>
                </div>
              );
            })}
          </div>
        ) : null}

        {readNotice ? (
          <div style={{ background: "#fff4d6", border: "1px solid #e5b644", color: "#7a5800", borderRadius: 12, padding: "13px 16px", fontSize: 13.5, lineHeight: 1.5, marginTop: showComps ? 12 : 0 }}>
            <b>Heads up — part of this packet couldn't be read cleanly.</b>
            <div style={{ marginTop: 4 }}>{readNotice}</div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
