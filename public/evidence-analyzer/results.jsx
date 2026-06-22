/* Results view components for the Assessor Evidence Analyzer.
   Exposes Hero, Findings, CompTable, TalkingPoints, Letter on window. */
const { useState } = React;

const money = (n) => (n == null || isNaN(n) ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

/* ---- hero recommendation -------------------------------------------------- */
function Hero({ r }) {
  const term = r.term || "appeal";
  const board = r.board || "Appraisal Review Board";
  const vw = r.valueWord || "assessed value";
  if (!r.hasCase) {
    return (
      <div className="nocase">
        <h2>This packet doesn't hand you an easy reduction — but don't give up</h2>
        <p>
          Nothing in this evidence values your property below your current {vw} of {money(r.assessed)}: the median and
          the comparables all land at or above it. That doesn't mean you can't {term} — it means the win won't come
          from this document. Check your property record for errors (square footage, condition, bed/bath count, lot
          size), or bring your own lower sales to the hearing.
        </p>
        {r.recordWin && (
          <p className="nocase-record">
            <b>Your strongest path:</b> the district's record of your home is wrong — {r.recordIssues.join("; ")}. Fix
            that (bring proof) and the value has to come down.
          </p>
        )}
      </div>
    );
  }
  const floorShown = r.floor != null && r.floor !== r.target;
  return (
    <div className="hero">
      <div className="eyebrow">Fight your {vw} down to</div>
      <div className="hero-grid">
        <div>
          <div className="ask-val num">{money(r.target)}</div>
          <div className="ask-from">
            down from <s className="num">{money(r.assessed)}</s> &nbsp;·&nbsp; a{" "}
            <b className="num">{money(r.reductionAtTarget)}</b> cut
          </div>
        </div>
        <div className="hero-right">
          <div className="lbl">Estimated tax you'd save / year</div>
          <div className="save num">{money(r.savingsTarget)}</div>
          <div className="save-sub num">at {(r.taxRate * 100).toFixed(2)}% effective rate</div>
        </div>
      </div>
      {floorShown && (
        <div className="hero-floor">
          <span className="pill pill-win">Safe floor</span>
          <span>
            Even a cautious {board} should land at <b className="num">{money(r.floor)}</b> — their own median.
          </span>
        </div>
      )}
    </div>
  );
}

/* ---- findings ------------------------------------------------------------- */
function Findings({ findings }) {
  if (!findings.length) return null;
  return (
    <div>
      <div className="section-label">Why — the case in the evidence</div>
      {findings.map((f, i) => (
        <div className={"finding " + f.tone} key={i}>
          <div className="dot" />
          <div>
            <div className="tag">{f.tag}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- comps table ---------------------------------------------------------- */
function CompTable({ r }) {
  const vals = r.comps.map((c) => c.value).filter((v) => v != null);
  const lo = Math.min(...vals, r.target || Infinity);
  const hi = Math.max(...vals, r.assessed || -Infinity);
  const span = Math.max(hi - lo, 1);
  const posOf = (v) => ((v - lo) / span) * 100;

  const label = { support: "Helps you", challenge: "Toss — too high", neutral: "Neutral" };

  return (
    <div>
      <div className="section-label">Comparable-by-comparable breakdown</div>
      <div className="comps">
        {r.sortedAsc.map((c) => (
          <div className={"comp-row " + c.status} key={c.id}>
            <div className="comp-main">
              <span className="comp-addr">{c.shortAddr || c.id}</span>
              <span className="comp-meta num">
                {c.sqft ? c.sqft.toLocaleString() + " sqft" : ""}
                {c.psf != null ? "  ·  $" + Math.round(c.psf) + "/sqft" : ""}
                {c.distanceMi != null ? "  ·  " + c.distanceMi.toFixed(1) + " mi" : ""}
                {c.yearBuilt != null ? "  ·  built " + c.yearBuilt : ""}
                {c.saleDateRaw ? "  ·  " + c.saleDateRaw : ""}
              </span>
              {c.status === "challenge" && c.flags.length > 0 && (
                <div className="comp-flags">
                  {c.flags.map((fl, i) => (
                    <span className="flag-chip" key={i}>
                      {fl.short}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="comp-right">
              <span className="comp-val num">{money(c.value)}</span>
              <span className={"status-badge " + c.status}>{label[c.status]}</span>
            </div>
            <div className="comp-scale">
              <span
                style={{
                  width: Math.max(posOf(c.value), 2) + "%",
                  background: c.status === "challenge" ? "var(--error)" : c.status === "support" ? "var(--emerald)" : "var(--gray-500)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- talking points ------------------------------------------------------- */
function TalkingPoints({ points, onCopy }) {
  if (!points.length) return null;
  return (
    <div>
      <div className="section-label">Talking points — say these to the board</div>
      <div className="tp-card">
        {points.map((p, i) => (
          <div className="tp-item" key={i}>
            <div className="tp-num">{i + 1}</div>
            <div className="tp-text">{p}</div>
            <button className="copy-mini" onClick={() => onCopy(p)}>
              Copy
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- Best strategy for reduction (top of the report) ---------------------- */
function BestStrategy({ r }) {
  const s = r.bestStrategy;
  if (!s) return null;
  const cut = r.assessed != null ? r.assessed - s.value : null;
  const pctOff = r.assessed ? Math.round((cut / r.assessed) * 100) : null;
  const others = (r.strategies || []).filter((x) => x.key !== s.key);
  return (
    <div>
      <div className="section-label">Best strategy for reduction</div>
      <div className="bs-card">
        <div className="bs-top">
          <div>
            <div className="bs-name">{s.name}</div>
            <div className="bs-explain">{s.explain}</div>
          </div>
          <div className="bs-figure">
            <div className="bs-val num">{money(s.value)}</div>
            {cut != null ? (
              <div className="bs-cut num">
                a {money(cut)} cut{pctOff != null ? " · " + pctOff + "%" : ""}
              </div>
            ) : null}
          </div>
        </div>
        {others.length ? (
          <div className="bs-others">
            <span className="bs-others-label">Also supported (we chose the lowest):</span>{" "}
            {others.map((o, i) => (
              <span className="bs-chip" key={o.key}>
                {o.name} {money(o.value)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ---- helper: does the CAD packet support a realistic reduction? ------------ */
// "Realistic" = a reduction worth printing a county-bound document for. Mike's
// 2026-06-20 directive: if the packet doesn't beat the noticed value by at
// least ~$200, swap the report content for a no-opportunity explainer instead
// of a copy-and-send email/letter that the CAD will dismiss out of hand.
const NO_OPP_REDUCTION_FLOOR = 200;
function _countyReduction(r) {
  if (!r) return 0;
  const req = r.supportedValue != null ? r.supportedValue : r.target;
  if (req == null || r.assessed == null) return 0;
  return Math.max(0, Math.round(r.assessed - req));
}
function _hasRealCountyOpportunity(r) {
  if (!r || !r.hasCase) return false;
  return _countyReduction(r) >= NO_OPP_REDUCTION_FLOOR;
}

/* ---- county copy: plain factual summary (no marketing / no coaching) ------ */
function CountySummary({ r }) {
  if (!_hasRealCountyOpportunity(r)) return null;
  const vw = r.valueWord || "assessed value";
  // Basis = the strategies that beat the noticed value (lowest first), so the
  // requested value lines up with the first/strongest one shown.
  const facts = (r.strategies || []).map((s) => s.explain).filter(Boolean);
  const req = r.supportedValue != null ? r.supportedValue : r.target;
  return (
    <div className="county-only county-summary">
      <div className="cs-head">Property Tax Protest — Evidence Summary</div>
      <div className="cs-rows">
        <div className="cs-row">
          <span className="cs-k">Property</span>
          <span className="cs-v">{(r.address || "—") + (r.account ? "  ·  Account " + r.account : "")}</span>
        </div>
        <div className="cs-row">
          <span className="cs-k">Current {vw}</span>
          <span className="cs-v num">{money(r.assessed)}</span>
        </div>
        <div className="cs-row cs-req">
          <span className="cs-k">Requested value</span>
          <span className="cs-v num">{money(req)}</span>
        </div>
      </div>
      {facts.length ? (
        <div className="cs-narr">
          <div className="cs-narr-label">Basis</div>
          <ul>
            {facts.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ---- county copy: plain comparable table (no bars, no advocacy badges) ---- */
function CountyComps({ r }) {
  if (!_hasRealCountyOpportunity(r)) return null;
  const comps = r.sortedAsc || r.comps || [];
  if (!comps.length) return null;
  const psf = (v) => (v != null ? "$" + Math.round(v) : "—");
  const dist = (c) => (c.distanceMi != null ? c.distanceMi.toFixed(1) + " mi" : "—");
  return (
    <div className="county-only county-comps">
      <div className="cc-title">Comparable properties (from the district's evidence)</div>
      <table className="cc-table">
        <thead>
          <tr>
            <th>Address</th>
            <th className="r">Living area</th>
            <th className="r">$/sqft</th>
            <th className="r">Distance</th>
            <th className="r">Year built</th>
            <th className="r">CAD value</th>
          </tr>
        </thead>
        <tbody>
          <tr className="cc-subject">
            <td>{(r.address || "Subject") + " — subject"}</td>
            <td className="r">{r.subjectSqft ? r.subjectSqft.toLocaleString() : "—"}</td>
            <td className="r">{psf(r.subjectPsf)}</td>
            <td className="r">—</td>
            <td className="r">—</td>
            <td className="r">{money(r.assessed)}</td>
          </tr>
          {comps.map((c, i) => (
            <tr key={c.id || i}>
              <td>{c.shortAddr || c.address || c.id}</td>
              <td className="r">{c.sqft ? c.sqft.toLocaleString() : "—"}</td>
              <td className="r">{psf(c.psf)}</td>
              <td className="r">{dist(c)}</td>
              <td className="r">{c.yearBuilt != null ? c.yearBuilt : "—"}</td>
              <td className="r">{money(c.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---- county copy: no-opportunity explainer -------------------------------- */
// Shown in the CAD-bound document when the packet doesn't support a reduction
// big enough to be worth taking to the district. Replaces the copy-and-send
// email/summary so we never hand the CAD a request the evidence won't back.
function CountyNoOpportunity({ r }) {
  if (_hasRealCountyOpportunity(r)) return null;
  const vw = r.valueWord || "assessed value";
  const term = r.term || "protest";
  const board = r.board || "appraisal district";
  const cut = _countyReduction(r);
  return (
    <div className="county-only county-summary">
      <div className="cs-head">CAD Evidence Review — No Realistic Reduction Found</div>
      <div className="cs-rows">
        <div className="cs-row">
          <span className="cs-k">Property</span>
          <span className="cs-v">{(r.address || "—") + (r.account ? "  ·  Account " + r.account : "")}</span>
        </div>
        <div className="cs-row">
          <span className="cs-k">Current {vw}</span>
          <span className="cs-v num">{money(r.assessed)}</span>
        </div>
      </div>
      <div className="cs-narr">
        <div className="cs-narr-label">Summary</div>
        <p>
          We reviewed the comparable sales and equity data the {board} provided in this evidence packet. After
          adjusting for size, age, condition, and location, the packet does not support a value low enough to
          justify a {term} on this packet alone
          {cut > 0 ? ` (the supportable reduction works out to roughly ${money(cut)}, below the threshold we'd take to a hearing).` : "."}
        </p>
        <p>
          That doesn't mean the {vw} is necessarily correct — but the case won't come from this document. The
          stronger paths from here are: (1) check the property record for factual errors (square footage,
          condition, bed/bath, year built, lot size) and request a correction, or (2) bring independent
          comparable sales — listings, MLS pulls, or recent sales — that fall below the noticed value.
        </p>
        <p>
          We are not sending a copy-and-send reduction request on this packet because the evidence the {board}
          relied on does not support one.
        </p>
      </div>
    </div>
  );
}

/* ---- ready-to-send email to the appraisal district ------------------------ */
function SettlementEmail({ text, onCopy }) {
  if (!text) return null;
  return (
    <div>
      <div className="section-label">Email to send your appraisal district</div>
      <div className="email-card">
        <div className="email-head">
          <span className="t">Reduction request — copy &amp; send</span>
          <button className="copy-mini" onClick={() => onCopy(text)}>
            Copy email
          </button>
        </div>
        <div className="email-body">{text}</div>
        <div className="email-foot">
          Fact-based and ready to send — add your agent name/ID and address it to your appraisal-district
          contact.
        </div>
      </div>
    </div>
  );
}

/* ---- appeal letter -------------------------------------------------------- */
function Letter({ text, onCopy }) {
  return (
    <div>
      <div className="section-label">Ready-to-send appeal letter</div>
      <div className="letter-card">
        <div className="letter-head">
          <span className="t">Draft appeal letter</span>
          <button className="copy-mini" onClick={() => onCopy(text)}>
            Copy letter
          </button>
        </div>
        <div className="letter-body">{text}</div>
      </div>
    </div>
  );
}

/* ---- case strength + negotiation range ------------------------------------ */
function Strategy({ r }) {
  const s = r.strength;
  const n = r.negotiation;
  if (!s) return null;
  const cls = "s-" + s.level.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <div>
      <div className="section-label">Your case at a glance</div>
      <div className="strategy">
        <div className={"strength " + cls}>
          <span className="st-badge">{s.level} case</span>
          <p>{s.blurb}</p>
        </div>
        {n && (
          <div className="negotiate">
            {n.sameValue ? (
              <div className="neg-row neg-row-single">
                <div className="neg-cell">
                  <div className="neg-lbl">Defensible request</div>
                  <div className="neg-val num">{money(n.opening)}</div>
                  {n.openingSavings ? <div className="neg-sub num">≈ {money(n.openingSavings)}/yr saved</div> : null}
                </div>
              </div>
            ) : (
              <div className="neg-row">
                <div className="neg-cell">
                  <div className="neg-lbl">Open by asking for</div>
                  <div className="neg-val num">{money(n.opening)}</div>
                  {n.openingSavings ? <div className="neg-sub num">≈ {money(n.openingSavings)}/yr saved</div> : null}
                </div>
                <div className="neg-arrow">→</div>
                <div className="neg-cell">
                  <div className="neg-lbl">Settle at or below</div>
                  <div className="neg-val num">{money(n.settle)}</div>
                  {n.settleSavings ? <div className="neg-sub num">≈ {money(n.settleSavings)}/yr saved</div> : null}
                </div>
              </div>
            )}
            <p className="neg-note">{n.note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- hearing game plan ---------------------------------------------------- */
function GamePlan({ r }) {
  const g = r.gameplan;
  if (!g) return null;
  return (
    <div>
      <div className="section-label">How your hearing will go</div>
      <div className="gameplan">
        <ol className="gp-steps">
          {g.steps.map((s, i) => (
            <li key={i}>
              <span className="gp-n">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <div className="gp-deadline">
          <b>Deadline —</b> {g.deadlineText}
        </div>
      </div>
    </div>
  );
}

/* ---- opening statement script --------------------------------------------- */
function OpeningScript({ text, onCopy }) {
  if (!text) return null;
  return (
    <div>
      <div className="section-label">What to say first</div>
      <div className="script-card">
        <div className="script-head">
          <span className="t">Your opening statement — read it to the appraiser</span>
          <button className="copy-mini" onClick={() => onCopy(text)}>
            Copy
          </button>
        </div>
        <div className="script-body">“{text}”</div>
      </div>
    </div>
  );
}

/* ---- objections & rebuttals ----------------------------------------------- */
function Objections({ items }) {
  if (!items || !items.length) return null;
  return (
    <div>
      <div className="section-label">If they push back</div>
      <div className="obj-card">
        {items.map((o, i) => (
          <div className="obj-item" key={i}>
            <div className="obj-line obj-q">
              <span className="obj-tag">They say</span>
              <span>{o.q}</span>
            </div>
            <div className="obj-line obj-a">
              <span className="obj-tag obj-tag-a">You say</span>
              <span>{o.a}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- what to bring -------------------------------------------------------- */
function Checklist({ items }) {
  if (!items || !items.length) return null;
  return (
    <div>
      <div className="section-label">Bring this to your hearing</div>
      <div className="checklist">
        {items.map((c, i) => (
          <div className="check-item" key={i}>
            <span className="check-box" />
            <span>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  Hero,
  Findings,
  CompTable,
  TalkingPoints,
  Letter,
  SettlementEmail,
  CountySummary,
  CountyComps,
  CountyNoOpportunity,
  BestStrategy,
  Strategy,
  GamePlan,
  OpeningScript,
  Objections,
  Checklist,
  fmtMoney: money,
});
