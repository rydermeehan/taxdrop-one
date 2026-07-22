// Pure override-application logic for the TaxDrop One review flow.
// Extracted from report.ts so it can be unit-tested in isolation (see
// _overrides.test.mjs). No I/O, no deps — just draft + overrides → patched draft.
//
// Overrides carries:
//   - `excludeComps`: number[] — indices into the ORIGINAL `our.comps` to drop
//     from the evidence pack. The V3 pack recomputes its median-of-adjusted
//     requested value from whatever comps it's handed, so dropping a bad comp
//     genuinely moves the number.
//   - `notice`: corrected noticed value — patches the on-screen `result.notice`
//     AND the pack's `our.subject.total_market` (the pack derives reduction from
//     the subject value), then re-derives the savings figures.
//   - the rest are `result` field patches (`target`, `rationale`, …) merged onto
//     the on-screen summary.
//
// reduction/pct come straight from notice & target; taxSaved scales
// proportionally off the original (the tax rate lives in the frontend, so we
// scale the existing figure rather than recompute from a rate we don't hold).

type Dict = Record<string, unknown>;

// Street-segment key so the pack's engine-shape comps (full_address) and the
// on-screen summary's result.comps (titleCased addr) reconcile.
export function streetKey(v: unknown): string {
  return String(v || '')
    .toLowerCase()
    .split(',')[0]
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function applyOverrides(draftIn: unknown, overridesIn: unknown): unknown {
  const draftRaw = (draftIn || {}) as Dict;
  const overrides = (overridesIn || {}) as Dict;

  // SECURITY (must run BEFORE the no-overrides early return): `draft.our` is
  // CUSTOMER-authored (POSTed verbatim to /api/intake). The report renderer
  // injects `our.reportHtml` as RAW HTML (the WYSIWYG overlay), so a customer
  // could smuggle a stored-XSS payload through it; `reportNotes` is likewise
  // agent-only. Strip both off the draft ALWAYS — they may only ever come from
  // the sup-gated overrides column, re-attached further down. Belt-and-braces
  // with the intake-time strip, and it also scrubs drafts poisoned before that
  // strip existed.
  let draftOurClean = draftRaw.our;
  if (draftOurClean && typeof draftOurClean === 'object') {
    const { reportHtml: _dropDraftHtml, reportNotes: _dropDraftNotes, ...ourClean } = draftOurClean as Dict;
    void _dropDraftHtml; void _dropDraftNotes;
    draftOurClean = ourClean;
  }
  const draft = { ...draftRaw, our: draftOurClean } as Dict;

  if (!overrides || Object.keys(overrides).length === 0) return draft;

  // `notes` (internal reviewer notes) and `infoRequest` (send-back message) are
  // AGENT-ONLY — pull them out so they never spread onto the customer-facing
  // result (the approved report JSON is served to the customer).
  //
  // `reportNotes` is the OPPOSITE: a customer-facing note the reviewer wrote for
  // the evidence pack's cover Notes box. Pull it out of resultOverrides too (it
  // doesn't belong on the summary `result`), then attach it to `our` below so
  // the V3 pack can read it off `our.reportNotes` at render time.
  const { excludeComps, excludeSalesComps, notes, infoRequest, reportNotes, reportHtml, subject: subjectPatchRaw, ...resultOverrides } = overrides as
    { excludeComps?: number[]; excludeSalesComps?: number[]; notes?: unknown; infoRequest?: unknown; reportNotes?: unknown; reportHtml?: unknown; subject?: unknown } & Dict;
  void notes; void infoRequest;

  const origResult = (draft.result || {}) as Dict;
  const result = { ...origResult, ...resultOverrides };

  if (resultOverrides.target != null || resultOverrides.notice != null) {
    const notice = Number(result.notice);
    const target = Number(result.target);
    const oldReduction = Number(origResult.reduction) || 0;
    const oldTaxSaved = Number(origResult.taxSaved) || 0;
    if (Number.isFinite(notice) && Number.isFinite(target)) {
      const reduction = Math.max(notice - target, 0);
      result.reduction = reduction;
      result.pct = notice > 0 ? (reduction / notice) * 100 : 0;
      result.taxSaved = oldReduction > 0 ? oldTaxSaved * (reduction / oldReduction) : oldTaxSaved;
    }
  }

  let our = draft.our;   // already scrubbed of draft-borne reportHtml/reportNotes above

  // Subject corrections: a reviewer-supplied `subject` patch (e.g. corrected
  // living_sqft / year_built — bad CAD data that skews the pack's comp
  // adjustments) merges onto the pack's subject; a corrected `notice` also moves
  // the subject value the pack derives its reduction from.
  const subjectPatch = subjectPatchRaw && typeof subjectPatchRaw === 'object' ? (subjectPatchRaw as Dict) : null;
  if ((resultOverrides.notice != null || subjectPatch) && our && typeof our === 'object') {
    const src = our as Dict;
    const subject = { ...((src.subject || {}) as Dict), ...(subjectPatch || {}) };
    if (resultOverrides.notice != null) subject.total_market = Number(resultOverrides.notice);
    our = { ...src, subject };
  }

  if (Array.isArray(excludeComps) && excludeComps.length && our && typeof our === 'object') {
    const drop = new Set(excludeComps.map(Number));
    const src = our as Dict;
    const comps = (Array.isArray(src.comps) ? src.comps : []) as Dict[];

    const droppedStreets = new Set<string>();
    comps.forEach((c, i) => {
      if (drop.has(i)) {
        const k = streetKey(c.full_address || c.site_address || c.address);
        if (k) droppedStreets.add(k);
      }
    });

    our = {
      ...src,
      comps: comps.filter((_, i) => !drop.has(i)),
      // Indices shift after filtering; the pack re-derives best-match from the
      // comps it's given, so point it at the first surviving comp.
      best_match_comp_index: 0,
    };

    // Mirror exclusions onto the on-screen summary — POSITIVE matches only, so a
    // matching miss leaves the comp shown (no regression) rather than hiding the
    // wrong one.
    if (Array.isArray(result.comps) && droppedStreets.size) {
      result.comps = (result.comps as Dict[]).filter((rc) => !droppedStreets.has(streetKey(rc.addr)));
    }
  }

  // Sales-comp exclusions (Clear Capital). Same shape as excludeComps but for
  // the sales-comparison approach: indices into `our.sales_comps` the reviewer
  // unchecked. The report re-derives the sales-indicated value from whatever
  // sales comps survive, so dropping a bad sale moves the sales approach — and
  // can flip which approach wins the opinion of value.
  if (Array.isArray(excludeSalesComps) && excludeSalesComps.length && our && typeof our === 'object') {
    const dropS = new Set(excludeSalesComps.map(Number));
    const src = our as Dict;
    const sc = (Array.isArray(src.sales_comps) ? src.sales_comps : []) as Dict[];
    our = { ...src, sales_comps: sc.filter((_, i) => !dropS.has(i)) };
  }

  // Attach the reviewer's customer-facing report note to `our` so the V3 pack
  // renders it into the cover Notes box. Only when non-empty, so an untouched
  // review never stamps a stray property onto the draft.
  if (typeof reportNotes === 'string' && reportNotes.trim() && our && typeof our === 'object') {
    our = { ...(our as Dict), reportNotes: reportNotes.trim() };
  }

  // Attach the agent's WYSIWYG report overlay (full edited report HTML) to `our`
  // so the pack renders the hand-edited version verbatim for the agent preview
  // AND the customer copy. Authored only through the sup-gated save path, so it
  // is trusted HTML. Only when non-empty.
  if (typeof reportHtml === 'string' && reportHtml.trim() && our && typeof our === 'object') {
    our = { ...(our as Dict), reportHtml };
  }

  return { ...draft, result, our, reviewed: true };
}
