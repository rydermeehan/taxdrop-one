/* =============================================================================
   Assessor Evidence Analyzer — analysis engine (pure JS, no dependencies)
   Exposed on window.Analyzer

   The engine is intentionally transparent and deterministic. AI is only used
   (elsewhere) to turn messy evidence text into the clean structured object this
   engine consumes; every dollar figure the user sees is computed here, in code
   they could audit — important for a tool people will quote to a tax board.
   ============================================================================= */
(function () {
  "use strict";

  const DEFAULT_TAX_RATE = 0.0118; // effective rate; user-editable in the UI
  let VW = "assessed value"; // value word, set per-analysis (TX: "appraised value")

  // ---- helpers --------------------------------------------------------------
  const money = (n) =>
    n == null || isNaN(n)
      ? "—"
      : "$" + Math.round(n).toLocaleString("en-US");

  const pct = (n) => (n == null || isNaN(n) ? "—" : (n * 100).toFixed(1) + "%");

  const medianOf = (arr) => {
    const a = arr.filter((n) => n != null && !isNaN(n)).sort((x, y) => x - y);
    const n = a.length;
    if (!n) return null;
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  };

  const monthsBetween = (a, b) => {
    if (!a || !b) return null;
    return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  };

  // thresholds for flagging a comparable as weak / dissimilar
  const TH = {
    sqftDiff: 0.15, // >15% size difference
    distance: 1.0, // > 1 mile away
    saleAgeMonths: 18, // sale older than 18 months before lien date
    netAdj: 0.10, // net adjustment > 10% of the comp's value = not a clean match
    yearGap: 10, // built 10+ years newer than the subject
    psfPremium: 0.02, // subject must sit >2% above the comps' median $/sqft to argue it
  };

  /* ---------------------------------------------------------------------------
     analyze(data)
     data = {
       subject:  { address, assessedValue, sqft, lienDate? },
       weightedMedian: Number,           // assessor's stated weighted median
       comps: [ { id, address, value, sqft, distanceMi, saleDate } ],
       taxRate: Number?                  // effective rate, optional
     }
     `value` per comp = the assessor's indicated/adjusted value for that comp.
  --------------------------------------------------------------------------- */
  function analyze(data) {
    const subject = data.subject || {};
    const assessed = num(subject.assessedValue);
    const taxRate = num(data.taxRate) || DEFAULT_TAX_RATE;
    const lien = parseDate(subject.lienDate);

    // terminology — Texas "protest" before the ARB vs California "appeal" before the AAB
    const state = (subject.state || "").toString().toUpperCase();
    const term = data.term || (state === "TX" ? "protest" : "appeal");
    VW = state === "TX" ? "appraised value" : "assessed value";
    const board = state === "TX" ? "Appraisal Review Board" : state === "CA" ? "Assessment Appeals Board" : "Appraisal Review Board / Board of Review";

    // normalize comps
    const _normComps = (data.comps || [])
      .map((c, i) => normalizeComp(c, i, subject, lien))
      .filter((c) => c.value != null);

    // ---- guard against mis-extracted comp values ----------------------------
    // The reader (AI or heuristic) occasionally maps the WRONG column into a
    // comp's `value` — most often the comparable's CAD Prop ID / parcel number
    // (Rockwall packet, 2026-06-29: PID 10746 read as "$10,746" on a $212,044
    // home), or a land-only figure. These land an order of magnitude below the
    // subject and poison the median + second-lowest logic, producing absurd
    // asks like "fight it down to $10,746." A real sales/equity indicated value
    // is, by construction, in the subject's ballpark — reject any comp whose
    // value can't plausibly be one. The 0.40 floor clears parcel-IDs (~5% of
    // subject) and land-only reads while never clipping a genuinely low comp
    // (real equity lows run ~75%+ of the subject's value).
    const COMP_VALUE_FLOOR_RATIO = 0.40;
    const droppedComps = [];
    let comps =
      assessed != null && assessed > 0
        ? _normComps.filter((c) => {
            if (c.value < assessed * COMP_VALUE_FLOOR_RATIO) {
              droppedComps.push(c);
              return false;
            }
            return true;
          })
        : _normComps;
    let dataQuality = droppedComps.length
      ? {
          droppedCount: droppedComps.length,
          keptCount: comps.length,
          message:
            (droppedComps.length === 1
              ? "1 comparable was"
              : droppedComps.length + " comparables were") +
            " dropped: the value read from the packet was far below your subject — usually a parcel ID or land-only figure picked up as a dollar amount. Check the figures against your packet before relying on this analysis.",
        }
      : null;

    // ---- guard against a degenerate (all-identical) comp set ----------------
    // A read where EVERY surviving comparable carries the SAME value gives the
    // panel nothing to compare — the rows look identical and "vs notice" is +$0
    // across the board. This happens when a reader echoes the subject's own
    // noticed value onto each comp row, or on hard-to-OCR commercial / sales
    // grids (Victoria CAD, 2026-06-29). Treat an all-identical comp set as an
    // unreliable read instead of presenting copies of one number as evidence.
    if (comps.length >= 2) {
      const distinctVals = new Set(comps.map((c) => Math.round(c.value)));
      if (distinctVals.size === 1) {
        const note =
          "Every comparable came back at the same value (" + money(comps[0].value) +
          ") — the packet's comparable values couldn't be read individually, so there is nothing to compare. Re-check the comparable grid in the packet before relying on this analysis.";
        droppedComps.push.apply(droppedComps, comps);
        comps = [];
        dataQuality = {
          droppedCount: droppedComps.length,
          keptCount: 0,
          sanitySuppressed: true,
          message: (dataQuality ? dataQuality.message + " " : "") + note,
        };
      }
    }

    const sortedAsc = [...comps].sort((a, b) => a.value - b.value);
    const lowest = sortedAsc[0] || null;
    const secondLowest = sortedAsc[1] || null;
    const highest = sortedAsc[sortedAsc.length - 1] || null;

    // The equity median is the median of the comparable indicated values. We compute
    // it ourselves (always truthful to the comps shown) and only defer to a median
    // stated in the packet when it falls in a sane range — never inventing a number.
    const compMedian = medianOf(comps.map((c) => c.value));
    let weightedMedian = compMedian;
    const stated = num(data.weightedMedian);
    if (stated != null && lowest && highest && stated >= lowest.value * 0.9 && stated <= highest.value * 1.1) {
      weightedMedian = Math.min(stated, compMedian); // favor the homeowner, stay at/under the true median
    }

    // The two stated CAD medians, when the packet breaks them out on separate
    // grids: a sales / market-value median and an equity / uniformity median.
    // EITHER below the noticed value is an automatic, district-conceded
    // reduction — and we take the LOWEST of whatever qualifies.
    const salesMedian = num(data.salesMedian);
    const equityMedian = num(data.equityMedian);
    const salesMedianWin = salesMedian != null && assessed != null && salesMedian < assessed;
    const equityMedianWin = equityMedian != null && assessed != null && equityMedian < assessed;
    const haveStatedGridMedian = salesMedian != null || equityMedian != null;

    // ---- unit-value ($/sqft) context — the basis of an unequal-appraisal claim
    const subjectSqft = num(subject.sqft);
    const subjectYear = num(subject.yearBuilt);
    const subjectCondRank = condRank(subject.condition);
    const subjectPsf = subjectSqft && assessed != null ? assessed / subjectSqft : null;

    // Comparable $/sqft median for an unequal-appraisal-by-the-foot argument.
    // Two guards keep it defensible:
    //   1) prefer a $/sqft median the district itself states (apples-to-apples).
    //   2) otherwise derive it from comps of SIMILAR SIZE only — smaller homes
    //      legitimately carry a higher $/sqft, so mixing in much larger comps
    //      would manufacture a reduction that wouldn't survive the board.
    const statedPsf = num(data.medianPsf);
    let medianPsf = null;
    if (statedPsf != null && statedPsf > 0) {
      medianPsf = statedPsf;
    } else if (subjectSqft) {
      const sizeBand = comps.filter(
        (c) =>
          c.psf != null && isFinite(c.psf) && c.psf > 0 && c.sqft &&
          Math.abs(c.sqft - subjectSqft) / subjectSqft <= 0.2
      );
      if (sizeBand.length >= 3) medianPsf = medianOf(sizeBand.map((c) => c.psf));
    }

    // ---- classify every comp ------------------------------------------------
    comps.forEach((c) =>
      classifyComp(c, { assessed, weightedMedian, subjectCondRank, subjectYear, medianPsf })
    );

    // ---- the recommendation logic (user's spec) -----------------------------
    const findings = [];
    const candidates = []; // defensible target values, each with provenance

    // RULE 1 — the CAD's stated median(s). Two winning angles: a sales/market
    // median and an equity/uniformity median. EITHER below the noticed value is
    // an automatic win; both feed the candidate set so the engine takes the
    // lowest. Falls back to the computed median of the comparables when the
    // packet doesn't break out separate grids.
    let medianWin = false;
    if (salesMedianWin) {
      medianWin = true;
      candidates.push({ value: salesMedian, kind: "salesMedian", label: "District's sales-comparable median", strength: "strong" });
      findings.push({
        tag: "Automatic win",
        tone: "win",
        title: "The district's sales median is below your " + VW,
        body:
          "The median of the district's own sale comparables is " + money(salesMedian) + " — " +
          money(assessed - salesMedian) + " under your " + VW + " of " + money(assessed) +
          ". Their own market evidence already supports a lower value, which makes this a strong, low-effort request.",
      });
    }
    if (equityMedianWin) {
      medianWin = true;
      candidates.push({ value: equityMedian, kind: "equityMedian", label: "District's equity (uniformity) median", strength: "strong" });
      findings.push({
        tag: "Automatic win",
        tone: "win",
        title: "The district's equity median is below your " + VW,
        body:
          "The median of the district's own equity (uniformity) comparables is " + money(equityMedian) + " — " +
          money(assessed - equityMedian) + " under your " + VW +
          ". Under Texas' equal-and-uniform standard (§41.43(b)(3)), your value should be brought at least to this median.",
      });
    }
    if (!haveStatedGridMedian && weightedMedian != null && assessed != null && weightedMedian < assessed) {
      medianWin = true;
      candidates.push({ value: weightedMedian, kind: "median", label: "Median of your comparables", strength: "strong" });
      findings.push({
        tag: "Automatic win",
        tone: "win",
        title: "The median of your comparables is below your " + VW,
        body:
          "The middle of the comparables in this packet lands at " + money(weightedMedian) + ", which is " +
          money(assessed - weightedMedian) + " under your " + VW + " of " + money(assessed) +
          ". Their own comparables value homes like yours below your number — the floor of your ask.",
      });
    }

    // RULE 2 — gravitate to the 2nd-lowest comp when it beats the assessment.
    // (2nd-lowest, not lowest, so the ask isn't resting on a single outlier.)
    let secondLowWin = false;
    if (secondLowest && assessed != null && secondLowest.value < assessed) {
      secondLowWin = true;
      candidates.push({
        value: secondLowest.value,
        kind: "secondLowest",
        label: "2nd-lowest comparable (" + (secondLowest.shortAddr || "Comp " + (secondLowest.rank + 1)) + ")",
        strength: "aggressive",
      });
      findings.push({
        tag: "Aggressive target",
        tone: "target",
        title: "The second-lowest comparable supports " + money(secondLowest.value),
        body:
          (secondLowest.shortAddr ? secondLowest.shortAddr + " " : "This comparable ") +
          "is indicated at " +
          money(secondLowest.value) +
          " — " +
          money(assessed - secondLowest.value) +
          " below your assessment. Using the second-lowest rather than the single lowest keeps the request defensible: it isn't a lone outlier, it's backed by at least one even-lower sale (" +
          money(lowest.value) +
          ").",
      });
    }

    // RULE 3 — call out the inflated comps that should be discounted.
    const inflated = comps.filter((c) => c.status === "challenge");
    const supportive = comps.filter((c) => c.status === "support");
    if (inflated.length) {
      findings.push({
        tag: "Challenge",
        tone: "challenge",
        title:
          inflated.length +
          (inflated.length === 1 ? " comparable is" : " comparables are") +
          " inflating your value and should be thrown out",
        body:
          "These come in above your " + VW + " and lean on the priciest, least-similar sales. Discounting them pulls the supportable range down toward the lower comps. Reasons to discount: " +
          summarizeFlags(inflated) +
          ".",
      });
    }

    // RULE 4 — unequal appraisal by the foot: the subject is valued at a higher
    // $/sqft than the median of the comparables. Re-rate it at their median.
    let psfWin = false;
    let psfIndicated = null;
    if (subjectPsf != null && medianPsf != null && subjectSqft && subjectPsf > medianPsf * (1 + TH.psfPremium)) {
      psfIndicated = Math.round(medianPsf * subjectSqft);
      if (assessed != null && psfIndicated < assessed) {
        psfWin = true;
        candidates.push({
          value: psfIndicated,
          kind: "psf",
          label: "Comparables' median $/sqft applied to your home",
          strength: "strong",
        });
        findings.push({
          tag: "Unequal appraisal",
          tone: "win",
          title: "You're taxed at a higher rate per square foot than your comparables",
          body:
            "Your home is valued at $" +
            Math.round(subjectPsf) +
            "/sqft, while the comparables in this packet sit at a median of $" +
            Math.round(medianPsf) +
            "/sqft. Appraised at that same per-foot rate, your " +
            subjectSqft.toLocaleString() +
            " sqft comes to " +
            money(psfIndicated) +
            " — " +
            money(assessed - psfIndicated) +
            " below your " + VW +
            ". Equal-and-uniform treatment means you shouldn't carry a premium rate your neighbors aren't.",
        });
      }
    }

    // RULE 5 — weight the most-similar comparables. A consultant doesn't average
    // everything; they lean on the handful of closest matches (size, age,
    // condition, distance, how hard the comp had to be adjusted).
    const similarityScore = (c) => {
      let s = 0, n = 0;
      if (c.sqftDiff != null) { s += Math.abs(c.sqftDiff) * 2; n++; }
      if (c.distanceMi != null) { s += Math.min(c.distanceMi, 5) / 5; n++; }
      if (c.ageMonths != null) { s += Math.min(c.ageMonths, 36) / 36; n++; }
      if (c.netAdjustment != null && c.value) { s += Math.min(Math.abs(c.netAdjustment) / c.value, 0.5) * 2; n++; }
      if (c.condRank != null && subjectCondRank != null) { s += Math.abs(c.condRank - subjectCondRank) / 3; n++; }
      if (c.yearBuilt != null && subjectYear != null) { s += Math.min(Math.abs(c.yearBuilt - subjectYear), 40) / 40; n++; }
      return n ? s / n : null; // null when we have nothing distinguishing to go on
    };
    let bestComps = [];
    let bestCompsMedian = null;
    let bestCompsWin = false;
    if (comps.length >= 3) {
      const scored = comps.map((c) => ({ c, s: similarityScore(c) })).filter((x) => x.s != null);
      if (scored.length >= 3) {
        scored.sort((a, b) => a.s - b.s);
        const take = Math.min(5, Math.max(3, Math.ceil(scored.length / 2)));
        bestComps = scored.slice(0, take).map((x) => x.c);
        bestCompsMedian = medianOf(bestComps.map((c) => c.value));
        if (bestCompsMedian != null && assessed != null && bestCompsMedian < assessed) {
          bestCompsWin = true;
          candidates.push({
            value: bestCompsMedian,
            kind: "bestComps",
            label: "Median of your most-similar comparables",
            strength: "strong",
          });
          findings.push({
            tag: "Best comparables",
            tone: "target",
            title: "Your closest comparables indicate " + money(bestCompsMedian),
            body:
              "Narrowing to the " +
              bestComps.length +
              " comparables most like your home (size, age, condition, distance, adjustment size), the median lands at " +
              money(bestCompsMedian) +
              " — " +
              money(assessed - bestCompsMedian) +
              " under your " + VW +
              ". These are the comps an appraiser should weight most; the less-similar ones only widen the range upward.",
          });
        }
      }
    }

    // RULE 0 — property-record errors the homeowner confirmed. The cheapest win:
    // if the district's record overstates the home (size, beds/baths, age,
    // condition), the value is built on bad facts and must be corrected.
    const district = data.district || {};
    const recordIssues = [];
    const dSqft = num(district.sqft), dBeds = num(district.beds), dBaths = num(district.baths), dYear = num(district.yearBuilt);
    const aBeds = num(subject.beds), aBaths = num(subject.baths);
    let sqftOver = false;
    if (dSqft && subjectSqft && dSqft - subjectSqft > Math.max(dSqft * 0.02, 20)) {
      sqftOver = true;
      recordIssues.push("the living area is on record as " + dSqft.toLocaleString() + " sqft but your home is " + subjectSqft.toLocaleString() + " sqft (" + (dSqft - subjectSqft).toLocaleString() + " sqft too high)");
    }
    if (dBeds && aBeds && dBeds > aBeds) recordIssues.push("the record shows " + dBeds + " bedrooms but your home has " + aBeds);
    if (dBaths && aBaths && dBaths > aBaths) recordIssues.push("the record shows " + dBaths + " bathrooms but your home has " + aBaths);
    if (dYear && subjectYear && subjectYear < dYear) recordIssues.push("the record shows it built in " + dYear + " but it was built in " + subjectYear + " (older)");
    const dCond = condRank(district.condition);
    if (dCond != null && subjectCondRank != null && dCond > subjectCondRank) {
      recordIssues.push("the record rates the condition higher (" + district.condition + ") than your home's actual condition (" + subject.condition + ")");
    }

    // value impact from an overstated living area, when the packet splits land vs improvements
    let recordIndicated = null;
    const impr = num(subject.improvementValue), land = num(subject.landValue);
    if (sqftOver && impr && dSqft) {
      const correctedImpr = impr * (subjectSqft / dSqft);
      recordIndicated = Math.round((land || 0) + correctedImpr);
      if (assessed != null && recordIndicated < assessed) {
        candidates.push({ value: recordIndicated, kind: "record", label: "Corrected for the overstated living area", strength: "strong" });
      } else {
        recordIndicated = null;
      }
    }

    const recordWin = recordIssues.length > 0;
    if (recordWin) {
      findings.unshift({
        tag: "Property record error",
        tone: "win",
        title: recordIssues.length === 1 ? "The district's record of your home is wrong" : "The district's record of your home has " + recordIssues.length + " errors",
        body:
          "Your value is built on facts that don't match your home: " + recordIssues.join("; ") + ". " +
          (recordIndicated != null ? "Correcting just the living area brings the value to about " + money(recordIndicated) + ". " : "") +
          "Get the record fixed and the value has to come down — bring proof (a survey, builder plan, prior appraisal, or photos).",
      });
    }

    // ---- the four reduction strategies (the user's playbook) ----------------
    // Each strategy that beats the noticed value is scored; we CHOOSE THE LOWEST
    // (biggest reduction) and request that — never below it.
    //   1) median sale/market value < assessed
    //   2) median equity value     < assessed
    //   3) 2nd-lowest comp in either table
    //   4) drop the highest comps that are justifiably not similar enough, then
    //      take the median of what remains
    const qualMedians = [];
    if (salesMedianWin) qualMedians.push(salesMedian);
    if (equityMedianWin) qualMedians.push(equityMedian);
    if (!haveStatedGridMedian && weightedMedian != null && assessed != null && weightedMedian < assessed) qualMedians.push(weightedMedian);
    let floorVal = qualMedians.length ? Math.max(...qualMedians) : null;

    // Strategy 4 — drop dissimilar high comps (above the raw median, with flags)
    // and re-take the median.
    const rawMedian = compMedian;
    let trimmedMedian = null;
    let trimmedRemoved = [];
    if (rawMedian != null) {
      const removableHigh = comps.filter((c) => c.value > rawMedian && c.flags && c.flags.length > 0);
      if (removableHigh.length) {
        const kept = comps.filter((c) => removableHigh.indexOf(c) === -1);
        const tm = medianOf(kept.map((c) => c.value));
        if (tm != null && tm < rawMedian) {
          trimmedMedian = tm;
          trimmedRemoved = removableHigh;
        }
      }
    }

    const strategies = [];
    const addStrat = (key, name, value, short, explain, extra) => {
      if (value != null && assessed != null && value < assessed) {
        strategies.push(Object.assign({ key, name, value, short, explain }, extra || {}));
      }
    };
    if (salesMedian != null) {
      addStrat("salesMedian", "Median sale price is below your value", salesMedian,
        "the district's sale-comparable median is " + money(salesMedian),
        "The median of the district's own SALE comparables is " + money(salesMedian) + " — " + money(assessed - salesMedian) + " under your " + VW + ". The most direct market-value reduction.");
    }
    if (equityMedian != null) {
      addStrat("equityMedian", "Median equity value is below your value", equityMedian,
        "the district's equity (uniformity) median is " + money(equityMedian),
        "The median of the district's own EQUITY comparables is " + money(equityMedian) + " — " + money(assessed - equityMedian) + " under your " + VW + ", under Texas' equal-and-uniform standard.");
    }
    if (!haveStatedGridMedian && weightedMedian != null) {
      addStrat("median", "Median of the comparables is below your value", weightedMedian,
        "the median of the comparables is " + money(weightedMedian),
        "The median of the comparables in the packet is " + money(weightedMedian) + " — " + money(assessed - weightedMedian) + " under your " + VW + ".");
    }
    if (secondLowest) {
      addStrat("secondLowest", "Second-lowest comparable", secondLowest.value,
        "the second-lowest comparable is indicated at " + money(secondLowest.value),
        (secondLowest.shortAddr || "A comparable") + " is indicated at " + money(secondLowest.value) + (lowest ? ", with an even-lower comp behind it (" + money(lowest.value) + ")" : "") + " — using the 2nd-lowest keeps it defensible rather than resting on one outlier.");
    }
    if (trimmedMedian != null) {
      const tn = trimmedRemoved.length;
      const tnoun = tn === 1 ? "1 higher comparable that isn't a fair match" : tn + " higher comparables that aren't a fair match";
      addStrat("trimmed", "Drop dissimilar high comps, then take the median", trimmedMedian,
        "setting aside " + tnoun + ", the median is " + money(trimmedMedian),
        "Setting aside " + tnoun + " (" + summarizeFlags(trimmedRemoved) + ") lowers the median to " + money(trimmedMedian) + ".",
        { removed: trimmedRemoved });
    }
    strategies.sort((a, b) => a.value - b.value);
    let bestStrategy = strategies.length ? strategies[0] : null;

    // The requested value = the best (lowest) strategy. We never request below it.
    let targetVal = bestStrategy ? bestStrategy.value : null;
    if (targetVal == null && floorVal != null) targetVal = floorVal;
    if (floorVal == null && targetVal != null) floorVal = targetVal;

    // ---- second backstop: recommendation-level $/sqft sanity ----------------
    // The per-comp value floor above catches parcel-IDs / land-only reads one
    // comp at a time. This is defense-in-depth at the RECOMMENDATION level: if
    // the value we're about to request implies a $/sqft wildly out of line with
    // the subject's own $/sqft, the underlying read isn't trustworthy — refuse
    // to emit a number rather than hand an agent a garbage ask. A real
    // reduction lands somewhat BELOW the subject's psf, never at a small
    // fraction of it (a 75%+ cut has no comparable support) nor multiples above.
    // Falls back to a value-vs-assessed ratio when subject sqft is unknown.
    if (targetVal != null && assessed != null && assessed > 0) {
      const RECO_PSF_LO = 0.25;
      const RECO_PSF_HI = 4.0;
      let outOfBand = false;
      let cmp = "";
      if (subjectPsf != null && subjectSqft) {
        const ratio = targetVal / subjectSqft / subjectPsf;
        outOfBand = ratio < RECO_PSF_LO || ratio > RECO_PSF_HI;
        cmp = "$" + Math.round(targetVal / subjectSqft) + "/sqft vs the subject's $" + Math.round(subjectPsf) + "/sqft";
      } else {
        outOfBand = targetVal / assessed < RECO_PSF_LO;
        cmp = money(targetVal) + " vs the subject's " + money(assessed);
      }
      if (outOfBand) {
        const msg =
          "The strongest figure we derived (" + cmp + ") is far out of line with the subject — a sign the packet was mis-read. No recommendation is shown; re-check the comparables against the packet before relying on this analysis.";
        targetVal = null;
        floorVal = null;
        bestStrategy = null;
        strategies.length = 0;
        dataQuality = dataQuality
          ? Object.assign({}, dataQuality, { sanitySuppressed: true, message: dataQuality.message + " " + msg })
          : { droppedCount: 0, keptCount: comps.length, sanitySuppressed: true, message: msg };
      }
    }

    const supportedValue = targetVal;

    const hasCase = targetVal != null && assessed != null && targetVal < assessed;

    // ---- savings ------------------------------------------------------------
    const reductionAtTarget = hasCase ? assessed - targetVal : 0;
    const reductionAtFloor = floorVal != null && assessed != null ? assessed - floorVal : 0;
    const savingsTarget = reductionAtTarget * taxRate;
    const savingsFloor = reductionAtFloor * taxRate;

    // ---- talking points (plain language, copy-ready) ------------------------
    const talkingPoints = buildTalkingPoints({
      assessed,
      weightedMedian,
      medianWin,
      secondLowest,
      secondLowWin,
      lowest,
      inflated,
      supportive,
      targetVal,
      floorVal,
      term,
      state,
      subjectPsf,
      medianPsf,
      psfWin,
      psfIndicated,
      subjectSqft,
      bestComps,
      bestCompsMedian,
      bestCompsWin,
      recordWin,
      recordIssues,
      recordIndicated,
    });

    // ---- appeal letter ------------------------------------------------------
    const letter = buildLetter({
      subject,
      assessed,
      targetVal,
      floorVal,
      weightedMedian,
      medianWin,
      secondLowest,
      secondLowWin,
      inflated,
      term,
      board,
      state,
      subjectPsf,
      medianPsf,
      psfWin,
      psfIndicated,
      bestComps,
      bestCompsMedian,
      bestCompsWin,
      recordWin,
      recordIssues,
      recordIndicated,
    });

    // ---- the client's hearing kit (how a pro would prep them) ---------------
    const playbook = buildPlaybook({
      subject,
      assessed,
      taxRate,
      targetVal,
      supportedValue,
      floorVal,
      weightedMedian,
      medianWin,
      secondLowest,
      secondLowWin,
      lowest,
      psfWin,
      subjectPsf,
      medianPsf,
      psfIndicated,
      bestComps,
      bestCompsWin,
      bestCompsMedian,
      inflated,
      supportive,
      comps,
      term,
      board,
      state,
      hasCase,
      recordWin,
      recordIssues,
      recordIndicated,
    });

    // ---- the ready-to-send, fact-based email to the appraisal district ------
    const settlementEmail = buildSettlementEmail({
      subject,
      assessed,
      targetVal,
      supportedValue,
      floorVal,
      valueWord: VW,
      term,
      board,
      state,
      hasCase,
      comps,
      strategies,
      bestStrategy,
      recordWin,
      recordIssues,
    });

    return {
      ok: true,
      hasCase,
      dataQuality,
      recordWin,
      recordIssues,
      recordIndicated,
      salesMedian,
      equityMedian,
      salesMedianWin,
      equityMedianWin,
      strategies,
      bestStrategy,
      settlementEmail,
      strength: playbook.strength,
      negotiation: playbook.negotiation,
      gameplan: playbook.gameplan,
      openingScript: playbook.openingScript,
      objections: playbook.objections,
      checklist: playbook.checklist,
      assessed,
      taxRate,
      term,
      board,
      state,
      address: subject.address || "",
      account: subject.account || null,
      supportedValue,
      valueWord: VW,
      weightedMedian,
      subjectSqft,
      subjectPsf,
      medianPsf,
      psfIndicated,
      bestComps,
      bestCompsMedian,
      floor: floorVal,
      target: targetVal,
      reductionAtTarget,
      reductionAtFloor,
      savingsTarget,
      savingsFloor,
      comps,
      sortedAsc,
      lowest,
      secondLowest,
      inflated,
      supportive,
      findings,
      talkingPoints,
      letter,
      candidates,
      fmt: { money, pct },
    };
  }

  // ---- per-comp normalization & classification ------------------------------
  function normalizeComp(c, i, subject, lien) {
    const value = num(c.value != null ? c.value : c.adjustedValue != null ? c.adjustedValue : c.indicatedValue);
    const sqft = num(c.sqft);
    const subjSqft = num(subject.sqft);
    const sqftDiff = sqft && subjSqft ? (sqft - subjSqft) / subjSqft : null;
    const distanceMi = num(c.distanceMi != null ? c.distanceMi : c.distance);
    const saleDate = parseDate(c.saleDate);
    const ageMonths = saleDate && lien ? Math.abs(monthsBetween(saleDate, lien)) : null;
    const addr = c.address || c.addr || "";
    const salePrice = num(c.salePrice);
    const netAdjustment = num(c.netAdjustment);
    const yearBuilt = num(c.yearBuilt);
    const condition = c.condition || null;

    // Unit value ($/sqft) ONLY from a raw basis: a rate the packet states, or the
    // comp's own sale price. Never from an already-adjusted "indicated value" —
    // that figure is sized to the subject, so dividing it by the comp's own area
    // is meaningless and would invent a false unit rate.
    let psf = num(c.psf);
    if (psf == null && sqft && salePrice != null) psf = salePrice / sqft;

    return {
      rank: i,
      id: c.id || "Comp " + (i + 1),
      address: addr,
      shortAddr: addr ? addr.split(",")[0] : "",
      value,
      sqft,
      sqftDiff,
      distanceMi,
      saleDate,
      saleDateRaw: c.saleDate || "",
      ageMonths,
      salePrice,
      netAdjustment,
      yearBuilt,
      condition,
      condRank: condRank(condition),
      psf,
      flags: [],
      status: "neutral",
    };
  }

  // ---- condition / renovation ranking --------------------------------------
  // Maps the many CAD descriptors (CDU, Cost & Design, Grade, Quality) onto a
  // single 1–4 "desirability" scale so a comp can be judged superior/inferior
  // to the subject. Returns null when nothing recognizable is present.
  function condRank(s) {
    if (!s) return null;
    const t = String(s).toLowerCase();
    if (/extensive|excellent|remodel|renovat/.test(t)) return 4;
    if (/partial|good|above average|updated/.test(t)) return 3;
    if (/average|moderate|fair|none\b|standard|typical/.test(t)) return 2;
    if (/poor|minimal|below average|unsound|low/.test(t)) return 1;
    return null;
  }

  function classifyComp(c, ctx) {
    const { assessed, weightedMedian, subjectCondRank, subjectYear, medianPsf } = ctx;
    const flags = [];

    // dissimilarity flags (strengthen a challenge, never used to drop a low comp)
    if (c.sqftDiff != null && Math.abs(c.sqftDiff) > TH.sqftDiff) {
      const pctDiff = Math.round(c.sqftDiff * 100);
      flags.push({
        type: "sqft",
        text: Math.abs(pctDiff) + "% " + (pctDiff > 0 ? "larger" : "smaller") + " than your home",
        short: (pctDiff > 0 ? "+" : "") + pctDiff + "% size",
      });
    }
    if (c.distanceMi != null && c.distanceMi > TH.distance) {
      flags.push({ type: "distance", text: c.distanceMi.toFixed(1) + " mi away", short: c.distanceMi.toFixed(1) + " mi" });
    }
    if (c.ageMonths != null && c.ageMonths > TH.saleAgeMonths) {
      flags.push({ type: "age", text: c.ageMonths + "-month-old sale", short: c.ageMonths + " mo old" });
    }
    // heavy net adjustment — the district had to move this comp a long way to make
    // it "comparable," which is itself proof it isn't a clean match.
    if (c.netAdjustment != null && c.value) {
      const adjPct = Math.abs(c.netAdjustment) / c.value;
      if (adjPct > TH.netAdj) {
        flags.push({
          type: "adj",
          text: "needed a " + money(Math.abs(c.netAdjustment)) + " adjustment (" + Math.round(adjPct * 100) + "%) to compare",
          short: Math.round(adjPct * 100) + "% adj",
        });
      }
    }
    // built materially newer than the subject
    if (c.yearBuilt != null && subjectYear != null && c.yearBuilt - subjectYear >= TH.yearGap) {
      flags.push({
        type: "year",
        text: "newer home (built " + c.yearBuilt + " vs your " + subjectYear + ")",
        short: "built " + c.yearBuilt,
      });
    }
    // superior condition / renovation level
    if (c.condRank != null && subjectCondRank != null && c.condRank > subjectCondRank) {
      flags.push({
        type: "cond",
        text: "superior condition/finish" + (c.condition ? " (" + c.condition + ")" : "") + " vs your home",
        short: "superior " + (c.condition ? String(c.condition).toLowerCase() : "condition"),
      });
    }
    // priced well above the comparables' median unit rate
    if (c.psf != null && medianPsf != null && c.psf > medianPsf * 1.1) {
      flags.push({
        type: "psf",
        text: "$" + Math.round(c.psf) + "/sqft vs the $" + Math.round(medianPsf) + "/sqft median",
        short: "$" + Math.round(c.psf) + "/sqft",
      });
    }

    c.flags = flags;

    // status: our position is to keep the value as LOW as possible.
    //  - support   : at/below the assessment — helps us, keep & emphasize.
    //  - challenge  : above the assessment AND materially dissimilar — argue to discount.
    //  - neutral    : above the assessment but a close match — shown and counted
    //                 in the median, but NOT something we argue to throw out.
    // We only ever ask the board to discount a comp when there's a concrete,
    // comp-specific reason (a flag). Asking to toss an otherwise-identical
    // neighbor just because its number is high reads as cherry-picking and
    // invites an easy rebuttal — so a flagless high comp stays neutral.
    if (assessed != null && c.value != null) {
      if (c.value > assessed) {
        c.status = c.flags.length > 0 ? "challenge" : "neutral";
      } else if (weightedMedian != null && c.value <= weightedMedian) {
        c.status = "support"; // below the median: our best ammo
      } else {
        c.status = "support"; // below assessed but above median: still helps
      }
    } else {
      c.status = "neutral";
    }

    // a below-assessment comp is never "bad" for us even if dissimilar
    if (c.status === "support") c.keepRegardless = true;
    return c;
  }

  function summarizeFlags(comps) {
    const bits = [];
    comps.forEach((c) => {
      const label = c.shortAddr || c.id;
      const reasons = [];
      if (c.value != null) reasons.push("indicated at " + money(c.value));
      c.flags.forEach((f) => reasons.push(f.text));
      bits.push(label + " (" + reasons.join(", ") + ")");
    });
    return bits.join("; ");
  }

  // ---- talking points -------------------------------------------------------
  function buildTalkingPoints(x) {
    const tp = [];
    if (x.recordWin) {
      tp.push(
        "The district's own record of my property is inaccurate — " +
          x.recordIssues.join("; ") +
          ". An assessment built on incorrect characteristics overstates my value" +
          (x.recordIndicated != null ? ", and correcting it brings the value to about " + money(x.recordIndicated) : "") +
          ". I can provide documentation."
      );
    }
    if (x.medianWin) {
      tp.push(
        "The median of the comparables in the district's evidence packet is " +
          money(x.floorVal) +
          " — below my " + VW + " of " +
          money(x.assessed) +
          ". By the district's own comparables, my value should be no higher than " +
          money(x.floorVal) +
          "."
      );
    }
    if (x.secondLowWin) {
      tp.push(
        "The comparables include " +
          (x.secondLowest.shortAddr || "a sale") +
          " indicated at " +
          money(x.secondLowest.value) +
          ", with a second sale even lower at " +
          money(x.lowest.value) +
          ". The weight of the most similar comparables sits well under my " + VW + "."
      );
    }
    if (x.psfWin) {
      tp.push(
        "My home is appraised at $" +
          Math.round(x.subjectPsf) +
          " per square foot, but the comparables in this packet have a median of $" +
          Math.round(x.medianPsf) +
          " per square foot. Applied to my " +
          (x.subjectSqft ? x.subjectSqft.toLocaleString() + " square feet" : "home") +
          ", the equal-and-uniform value is " +
          money(x.psfIndicated) +
          " — I'm being assessed at a higher rate per foot than comparable homes."
      );
    }
    if (x.bestCompsWin) {
      tp.push(
        "Limiting it to the " +
          x.bestComps.length +
          " comparables most like my home, the median indicated value is " +
          money(x.bestCompsMedian) +
          ". Those are the properties this appraisal should be weighted on."
      );
    }
    x.inflated.forEach((c) => {
      const why = c.flags.map((f) => f.text);
      tp.push(
        (c.shortAddr || c.id) +
          " at " +
          money(c.value) +
          " should be given little weight" +
          (why.length ? " — it is " + why.join(", ") + ", making it a poor match for my property." : ".")
      );
    });
    if (x.targetVal != null && x.assessed != null && x.targetVal < x.assessed) {
      tp.push(
        "Taking the supportable comparables together, a value of " +
          money(x.targetVal) +
          " is well documented — a reduction of " +
          money(x.assessed - x.targetVal) +
          " from the current " +
          money(x.assessed) +
          "."
      );
    }
    return tp;
  }

  // ---- appeal letter --------------------------------------------------------
  function buildLetter(x) {
    const addr = (x.subject && x.subject.address) || "[property address]";
    const board = x.board || "Appraisal Review Board";
    const action = x.term === "protest" ? "protest" : "appeal";
    const lines = [];
    lines.push("To the " + board + ",");
    lines.push("");
    lines.push(
      "I am filing this " + action + " to request a reduction of the " + VW + " for my property at " +
        addr +
        ". After reviewing the comparable evidence the district provided in support of the current value of " +
        money(x.assessed) +
        ", I believe the evidence itself supports a lower value."
    );
    lines.push("");
    if (x.recordWin) {
      lines.push(
        "Most directly, the district's record of my property contains factual errors: " +
          x.recordIssues.join("; ") +
          ". " +
          (x.recordIndicated != null ? "Correcting the living area alone indicates a value of approximately " + money(x.recordIndicated) + ". " : "") +
          "I am prepared to provide documentation, and the assessment should be corrected to reflect the property's true characteristics."
      );
      lines.push("");
    }
    if (x.medianWin) {
      lines.push(
        "First, the median of the comparables in the district's own evidence is " +
          money(x.floorVal) +
          " — already " +
          money(x.assessed - x.floorVal) +
          " below my current " + VW + ". Under the equal-and-uniform standard, my value should, at minimum, be brought in line with this median."
      );
      lines.push("");
    }
    if (x.secondLowWin) {
      lines.push(
        "Second, the most comparable sales indicate values as low as " +
          money(x.secondLowest.value) +
          ". These are similar in size, location, and recency, and represent the truest measure of my property's market value."
      );
      lines.push("");
    }
    if (x.psfWin) {
      lines.push(
        "The district's own comparables also show an unequal appraisal on a per-square-foot basis: my property is valued at approximately $" +
          Math.round(x.subjectPsf) +
          " per square foot against a comparable median of about $" +
          Math.round(x.medianPsf) +
          " per square foot. Applying that median rate to my home indicates a value of " +
          money(x.psfIndicated) +
          ", consistent with the equal-and-uniform requirement."
      );
      lines.push("");
    }
    if (x.bestCompsWin) {
      lines.push(
        "Weighting the comparables that most closely match my property in size, age, condition, and proximity, the median indicated value is " +
          money(x.bestCompsMedian) +
          ". The less-similar comparables in the packet required larger adjustments and should carry correspondingly less weight."
      );
      lines.push("");
    }
    if (x.inflated && x.inflated.length) {
      lines.push(
        "Several comparables in the packet should be given reduced weight: " +
          x.inflated
            .map((c) => (c.shortAddr || c.id) + " (" + money(c.value) + (c.flags.length ? ", " + c.flags.map((f) => f.short).join(", ") : "") + ")")
            .join("; ") +
          ". Each differs materially from my property and pulls the indicated value upward."
      );
      lines.push("");
    }
    lines.push(
      "On the basis of the evidence, I respectfully request the " + VW + " be reduced to " +
        money(x.targetVal) +
        (x.floorVal != null && x.floorVal !== x.targetVal ? ", and no higher than " + money(x.floorVal) + " in any event" : "") +
        ". Thank you for your consideration."
    );
    lines.push("");
    lines.push("Sincerely,");
    lines.push((x.subject && x.subject.ownerName) || "[Your name]");
    return lines.join("\n");
  }

  // ---- the ready-to-send settlement email ----------------------------------
  // Short, polite, fact-based — written so a homeowner with zero background can
  // send it as-is. Cites only figures from the district's own packet, requests
  // the lowest defensible value, and closes graciously. Returns null when the
  // evidence doesn't support any ask.
  function buildSettlementEmail(x) {
    if (!x.hasCase && !x.recordWin) return null;
    const isTX = x.state === "TX";
    const office = isTX ? "Appraisal District Staff" : "Assessor's Office";
    const board = x.board || "Appraisal Review Board";
    const addr = (x.subject && x.subject.address) || "[your property address]";
    const acct = (x.subject && x.subject.account) || null;
    const idLine = acct ? addr + " (account " + acct + ")" : addr;
    const acctSig = acct ? "Account " + acct : null;

    // No defensible number, but the record looks wrong → gentle record-review ask.
    if (!x.hasCase && x.recordWin) {
      return [
        "Dear " + office + ",",
        "",
        "As the designated agent for the owner of " + idLine + ", I'm requesting an informal review of the " +
          x.valueWord + " of " + money(x.assessed) + ".",
        "",
        "In reviewing the evidence, the property record appears to overstate the home: " +
          x.recordIssues.join("; ") + ". Correcting that should bring the value down, and I can " +
          "provide documentation (a survey, prior appraisal, builder plan, or photos).",
        "",
        "I'd appreciate the chance to resolve this informally. I know this is a busy season, so I " +
          "genuinely appreciate your time and consideration.",
        "",
        "Thank you,",
        "[Agent name], Designated Agent",
        acctSig,
      ].filter((l) => l !== null).join("\n");
    }

    // Basis = the strategies that beat the noticed value, lowest first, so the
    // request lines up with what's cited. Drawn only from the district's packet.
    const basis = (x.strategies || []).map((s) => s.short).filter(Boolean);
    if (x.recordWin) {
      basis.push("the property record appears to overstate the home (" + x.recordIssues.join("; ") + ")");
    }
    let basisText = basis.length
      ? basis.map((b, i) => (i === 0 ? b.charAt(0).toUpperCase() + b.slice(1) : b)).join("; ") + "."
      : "the comparable evidence in the district's own packet supports a lower value.";

    return [
      "Dear " + office + ",",
      "",
      "As the designated agent for the owner of " + idLine + ", I'm requesting an informal review of the " +
        x.valueWord + " of " + money(x.assessed) + " ahead of the hearing. Based on the comparable " +
        "evidence in the district's own packet, a lower value is well supported:",
      "",
      "Noticed value: " + money(x.assessed) + " → Requested: " + money(x.supportedValue != null ? x.supportedValue : x.targetVal),
      "Basis: " + basisText,
      "",
      "I'd appreciate the opportunity to resolve this informally and save the " + board + " time. I " +
        "know this is a busy season, so I genuinely appreciate your time and consideration.",
      "",
      "Thank you,",
      "[Agent name], Designated Agent",
      acctSig,
    ].filter((l) => l !== null).join("\n");
  }

  // ---- the client's hearing kit --------------------------------------------
  // Everything a consultant would coach a DIY client on before they walk in:
  // how strong the case is, what to open with, where to settle, how the hearing
  // runs, what to say when the appraiser pushes back, and what to bring.
  function buildPlaybook(x) {
    const isTX = x.state === "TX";
    const term = x.term || (isTX ? "protest" : "appeal");
    const board = x.board || "Appraisal Review Board";
    const filer = isTX ? "appraisal district" : "assessor's office";
    const addr = (x.subject && x.subject.address) || "[your property address]";
    const owner = (x.subject && x.subject.ownerName) || "[your name]";

    // ----- case strength -----------------------------------------------------
    let score = 0;
    const reasons = [];
    if (x.recordWin) { score += 2; reasons.push("the district's record of your home is factually wrong"); }
    if (x.medianWin) { score += 2; reasons.push("the district's own median sits below your " + VW); }
    if (x.psfWin) { score += 2; reasons.push("you're appraised at a higher $/sqft than comparable homes"); }
    if (x.bestCompsWin) { score += 1; reasons.push("your closest comparables indicate a lower value"); }
    if (x.secondLowWin && !x.medianWin) { score += 1; }
    if (x.inflated && x.inflated.length) { score += 1; reasons.push(x.inflated.length + " inflated comp" + (x.inflated.length === 1 ? "" : "s") + " you can discount"); }
    const ratio = x.comps && x.comps.length ? x.supportive.length / x.comps.length : 0;
    if (ratio >= 0.5) score += 1;

    let level, blurb;
    if (!x.hasCase) {
      if (x.recordWin) {
        level = "Worth a shot";
        blurb = "The comparables don't hand you a number, but the district's record of your home is wrong — that's your strongest path. Fix the record (bring proof) and the value has to come down.";
      } else {
        level = "Uphill";
        blurb = "This packet doesn't hand you a reduction. You can still " + term + " on property-record errors or your own evidence, but the district's numbers won't carry it for you.";
      }
    } else if (score >= 4) {
      level = "Strong";
      blurb = "The district's own evidence argues against its value. Walk in confident and lead with the numbers below.";
    } else if (score >= 2) {
      level = "Solid";
      blurb = "You have a real, evidence-backed case. Anchor low, stay factual, and hold to the comparables.";
    } else {
      level = "Worth a shot";
      blurb = "There's a defensible reduction here. Keep it simple and lean on your single strongest point.";
    }
    const strength = { level, score, reasons, blurb };

    // ----- negotiation range -------------------------------------------------
    let negotiation = null;
    if (x.hasCase) {
      // Open at the calculated (supported) value — we never request lower than
      // what our methods support. The settle CEILING is the district's own
      // median (floor), which is at or above the open; anything at or below it
      // still beats the noticed value. When they coincide, show one number.
      const opening = x.targetVal;
      const settle = x.floorVal != null && x.floorVal > opening ? x.floorVal : opening;
      const sameValue = settle === opening;
      const annualAt = (v) => (x.assessed != null && v != null ? (x.assessed - v) * (x.taxRate || 0) : null);
      negotiation = {
        opening,
        settle,
        sameValue,
        openingSavings: annualAt(opening),
        settleSavings: annualAt(settle),
        note: sameValue
          ? "A value of " + money(opening) + " is your defensible request — it's backed by the district's own comparables. Open there, and if the informal meeting won't beat your current " + VW + ", ask to take it to the formal " + board + " hearing."
          : "Open by asking for " + money(opening) + " — that's the value the district's own comparables support. Even settling at or below " + money(settle) + " (the district's own median) still beats your current " + VW + ", so treat that as your walk-away ceiling. If they won't get under it, ask to proceed to the formal " + board + " hearing.",
      };
    }

    // ----- hearing game plan -------------------------------------------------
    const deadlineText = isTX
      ? "File your " + term + " by May 15, or 30 days after the date on your Notice of Appraised Value — whichever is later."
      : "File your " + term + " within your county's window (commonly July 2–November 30; some counties close September 15). Check your county clerk's filing deadline.";
    const steps = [
      "File your " + term + " with the " + filer + " before the deadline (below) if you haven't already.",
      "You already have the district's evidence — that's what this analysis is built on. Print this report and the letter.",
      "Informal meeting first: most cases settle here. Hand the appraiser this report, ask for " + (x.hasCase ? money(x.targetVal) : "a reduction") + ", and walk them through the comparables.",
      "If you can't agree, take it to the formal " + board + " hearing — present the same evidence to the panel. Bring 3 copies.",
      "Get any agreed reduction in writing before you leave.",
    ];
    const gameplan = { steps, deadlineText, board, term, filer };

    // ----- opening statement script -----------------------------------------
    const lead = reasons.slice(0, 2);
    const openingScript =
      "Good morning. My name is " + owner + " and I own the property at " + addr + "" +
      (x.hasCase
        ? ". I'm " + (term === "protest" ? "protesting" : "appealing") + " my " + VW + " of " + money(x.assessed) +
          " and requesting it be reduced to " + money(x.targetVal) + ". The district's own evidence supports a lower value: " +
          (lead.length ? lead.join(", and ") + "." : "the comparables indicate a value below my current one.") +
          " I'd like to walk you through the comparables."
        : ". I'm " + (term === "protest" ? "protesting" : "appealing") + " my " + VW + " of " + money(x.assessed) +
          ". I'd like to review the comparables and my property record for any errors that would support a lower value.");

    // ----- objections & rebuttals -------------------------------------------
    const objections = [];
    if (x.recordWin) {
      objections.push({
        q: "“The property characteristics on file are correct.”",
        a: "They're not — " + x.recordIssues.join("; ") + ". I have documentation. The value is built on those incorrect facts and needs to be corrected.",
      });
    }
    if (x.medianWin) {
      objections.push({
        q: "“The current value is well supported by the evidence.”",
        a: "By your own evidence, the median of the comparables is " + money(x.floorVal) + " — below my " + VW + " of " + money(x.assessed) + ". Equal-and-uniform treatment means my value should be brought to that median at minimum.",
      });
    }
    if (x.inflated && x.inflated.length) {
      // Cite each high comp's ACTUAL difference (its flags) — never a generic
      // "larger/renovated/farther" claim that may not be true for that property.
      const specifics = x.inflated
        .slice(0, 3)
        .map((c) => (c.shortAddr || c.id) + " (" + c.flags.map((f) => f.text).join(", ") + ")")
        .join("; ");
      objections.push({
        q: "“These comparable sales justify the value.”",
        a: "A couple of them aren't close matches to my home, so they shouldn't carry the same weight: " + specifics + ". Looking at the comparables most like mine, the value lands around " + money(x.targetVal) + ".",
      });
    }
    if (x.psfWin) {
      objections.push({
        q: "“Your assessment is in line with the neighborhood.”",
        a: "Not per square foot: I'm appraised at about $" + Math.round(x.subjectPsf) + "/sqft while comparable homes here sit near $" + Math.round(x.medianPsf) + "/sqft. At that rate my value is " + money(x.psfIndicated) + ".",
      });
    }
    objections.push({
      q: "“Your home is in good/average condition.”",
      a: "My home hasn't had the updates several of these comparables have. That difference should pull my value down relative to them, not hold it up.",
    });
    objections.push({
      q: "“We can't change the value today.”",
      a: "I understand, and I appreciate you taking the time. If we can't settle on a number today, I'd like to keep my " + term + " open and bring this same evidence to the formal " + board + " hearing.",
    });

    // ----- what to bring -----------------------------------------------------
    const noticeName = isTX ? "Notice of Appraised Value" : "assessment notice";
    const checklist = [
      "This printed analysis and the draft " + term + " letter (bring 3 copies for a formal hearing)",
      "The " + filer + "'s evidence packet — the PDF you uploaded here",
      "Your " + noticeName + " for this year",
      "Photos of any condition issues — roof, foundation, dated kitchen/baths, deferred maintenance",
      "Repair estimates or quotes, if you have them (they support a lower value)",
      "Any lower recent sales of similar nearby homes you've found",
      "Government-issued ID and proof of ownership",
    ];

    return { strength, negotiation, gameplan, openingScript, objections, checklist };
  }

  // ---- tiny parsers ---------------------------------------------------------
  function num(v) {
    if (v == null) return null;
    if (typeof v === "number") return isNaN(v) ? null : v;
    const cleaned = String(v).replace(/[^0-9.\-]/g, "");
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }

  function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  /* ---------------------------------------------------------------------------
     Fallback heuristic parser — used when the AI extractor is unavailable or
     errors. It is deliberately forgiving: it scans for an assessed value, a
     weighted median, and any rows that look like "address … sqft … $value".
  --------------------------------------------------------------------------- */
  function parseHeuristic(text) {
    const out = { subject: {}, comps: [], weightedMedian: null };
    if (!text) return out;
    const lines = text.split(/\r?\n/);

    const findMoney = (s) => {
      const m = s.match(/\$?\s?([0-9]{2,3}(?:,[0-9]{3})+|[0-9]{5,7})(?:\.[0-9]+)?/);
      return m ? num(m[0]) : null;
    };

    // subject value & median (CAD label variants)
    for (const ln of lines) {
      if (/appraised\s+value|market\s+value|noticed\s+value|assessed|current\s+value|total\s+value/i.test(ln) &&
          !/subject\s+value\s+at\s+median/i.test(ln)) {
        const v = findMoney(ln);
        if (v && out.subject.assessedValue == null) out.subject.assessedValue = v;
      }
      if (/subject\s+value\s+at\s+median|weighted\s+median|^\s*median\b|median\s+(adjusted|indicated|value)/i.test(ln)) {
        const v = findMoney(ln);
        if (v) out.weightedMedian = v;
      }
      if (/\b(TX|Texas)\b/.test(ln) && !out.subject.state) out.subject.state = "TX";
      else if (/\b(CA|California)\b/.test(ln) && !out.subject.state) out.subject.state = "CA";
      if (/subject|parcel|property\s+address/i.test(ln) && !out.subject.address) {
        const a = ln.replace(/.*?(subject\s*(property)?\s*[:\-]?)/i, "").trim();
        if (a && /[0-9]/.test(a)) out.subject.address = a;
      }
      if (/living\s+area|gross\s+living|sq\.?\s?ft|sqft|square\s+f/i.test(ln) && out.subject.sqft == null && /subject|living|gross/i.test(ln)) {
        const m = ln.match(/([0-9],?[0-9]{3})\s*(sq|sf|s\.f)/i);
        if (m) out.subject.sqft = num(m[1]);
      }
    }

    // comp rows: a line with an address-ish token, an optional sqft, and a $value
    let idx = 0;
    for (const ln of lines) {
      if (/weighted|median|subject|assessed/i.test(ln)) continue;
      const val = findMoney(ln);
      const looksLikeComp =
        val != null &&
        (/comp/i.test(ln) || /^\s*[0-9]{2,6}\s+[A-Za-z]/.test(ln) || /\b[A-Za-z]+\s+(st|ave|rd|ln|dr|ct|way|blvd|pl|ter|cir)\b/i.test(ln));
      if (looksLikeComp) {
        const sqm = ln.match(/([0-9],?[0-9]{3})\s*(sq|sf|s\.f)/i);
        const dm = ln.match(/([0-9]+\.?[0-9]*)\s*mi/i);
        const dt = ln.match(/([0-9]{1,2}\/[0-9]{4})|([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/);
        const addrMatch = ln.match(/[0-9]{2,6}\s+[A-Za-z][A-Za-z0-9 .'\-]+?(?:st|ave|rd|ln|dr|ct|way|blvd|pl|ter|cir)\b/i);
        out.comps.push({
          id: "Comp " + (idx + 1),
          address: addrMatch ? addrMatch[0].trim() : "",
          value: val,
          sqft: sqm ? num(sqm[1]) : null,
          distanceMi: dm ? num(dm[1]) : null,
          saleDate: dt ? dt[0] : "",
        });
        idx++;
      }
    }
    return out;
  }

  window.Analyzer = { analyze, parseHeuristic, money, pct, DEFAULT_TAX_RATE };
})();
