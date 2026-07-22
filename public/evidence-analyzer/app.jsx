const { useState, useRef, useCallback, useEffect } = React;

// sessionStorage handoff key — TaxDrop One writes the already-parsed
// evidence here before opening the analyzer in a hidden iframe so the
// user doesn't have to re-upload the PDF to export the analyzer pack.
const HANDOFF_KEY = "taxdrop-analyzer-handoff";

function App() {
  const [text, setText] = useState("");
  const [stage, setStage] = useState("input"); // input | loading | verify | results | error
  const [result, setResult] = useState(null);
  const [method, setMethod] = useState(null);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [toast, setToast] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1700);
  };
  const copy = (s) => {
    navigator.clipboard && navigator.clipboard.writeText(s);
    flash("Copied — paste it into your protest");
  };

  const handleExtract = (ext) => {
    if (!ext.ok) {
      setError(ext.error || "We couldn't read that evidence.");
      setStage("error");
      return;
    }
    // Straight to the analysis — no data entry asked of the homeowner.
    const r = window.Analyzer.analyze(ext.data);
    setResult(r);
    setMethod(ext.method);
    setStage("results");
  };

  // text / paste path
  const run = useCallback(async (raw) => {
    const src = (raw != null ? raw : text).trim();
    if (!src) return;
    setStage("loading");
    setError("");
    try {
      handleExtract(await window.Extractor.extract(src));
    } catch (e) {
      setError("Something went wrong reading the evidence. Try pasting the text directly.");
      setStage("error");
    }
  }, [text]);

  const SUPPORTED_EXT = /\.(pdf|xlsx|xlsm|xls|xlsb|csv|tsv|txt|md)$/i;
  const isSupportedFile = (f) =>
    SUPPORTED_EXT.test(f.name || "")
    || /pdf$/i.test(f.type || "")
    || /sheet|excel|spreadsheetml/i.test(f.type || "")
    || /csv$/i.test(f.type || "");

  // file path — accepts PDF, Excel (.xlsx/.xls/.xlsm), CSV/TSV, plain text;
  // multi-file: every dropped file is read in-browser and concatenated before
  // the AI reader sees it. (2026-06-11 multi-file + Excel rollout.)
  const runFiles = async (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    const accepted = list.filter(isSupportedFile);
    if (!accepted.length) {
      setFileName("");
      setError("That file type isn't supported. Drop a PDF, Excel (.xlsx), or CSV — the formats your appraisal district sends.");
      setStage("error");
      return;
    }
    setFileName(
      accepted.length === 1
        ? accepted[0].name
        : accepted.length + " files: " + accepted.map((f) => f.name).slice(0, 2).join(", ")
          + (accepted.length > 2 ? " +" + (accepted.length - 2) + " more" : "")
    );
    setStage("loading");
    setError("");
    try {
      handleExtract(await window.Extractor.extractFromFiles(accepted));
    } catch (e) {
      setError("Something went wrong reading those files. If a PDF is scanned/image-only, we can't read the text.");
      setStage("error");
    }
  };
  // Back-compat single-file shim — kept so any older callers don't break.
  const runFile = (file) => runFiles(file ? [file] : []);

  const loadSample = () => {
    setText(window.SAMPLE_EVIDENCE);
    setFileName("");
    run(window.SAMPLE_EVIDENCE);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length) {
      runFiles(dt.files);
    }
  };

  const reset = () => {
    setStage("input");
    setResult(null);
    setError("");
    setFileName("");
  };

  // Export the analysis as a PDF via the browser's print-to-PDF. The print
  // stylesheet hides the chrome and renders the results as a clean, branded
  // document with selectable text (better for a tax board than a raster image).
  // Two exports: a "county copy" (facts + the request only — no marketing or
  // internal coaching, safe to hand the appraiser) and a full "owner/agent"
  // copy (the whole playbook). The print mode is a body class the stylesheet
  // keys off of.
  const exportPdf = (mode) => {
    const prev = document.title;
    const cls = mode === "county" ? "print-county" : "print-full";
    const acct = (result && result.account) || "";
    const addr = (result && result.address) || "";
    // The print dialog uses document.title as the default PDF filename.
    // Filename per Mike's 2026-06-20 directive:
    //   county mode → `CAD-Evidence-Review-{Address}` (the CAD-bound attachment)
    //   full mode   → `TD-{PID}-{Address}-Analysis` (the internal agent prep)
    const safeAddr = (addr || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const safePid = (acct || '').toString().replace(/[^A-Za-z0-9]+/g, '');
    document.title = mode === "county"
      ? `CAD-Evidence-Review-${safeAddr}`
      : (safePid ? `TD-${safePid}-${safeAddr}-Analysis` : `TD-${safeAddr}-Analysis`);
    document.body.classList.add(cls);
    window.print();
    setTimeout(() => {
      document.body.classList.remove(cls);
      document.title = prev;
    }, 600);
  };

  // DOCX export — clones the live DOM and wraps it in an HTML document that
  // Word can open. Uses html-docx-js when available (added to index.html for
  // the One-driven inline export flow), falls back to a `.doc` HTML blob
  // that Word still opens cleanly. Mirrors v2's exportDocx() pattern so the
  // user gets the same artifact shape whether they export from Pro, v2, or
  // the analyzer. (2026-06-11 inline exports from /pro.)
  const exportDocx = (mode) => {
    try {
      const cls = mode === "county" ? "print-county" : "print-full";
      const acct = (result && result.account) || "";
      const addr = (result && result.address) || "";
      document.body.classList.add(cls);
      const clone = document.documentElement.cloneNode(true);
      // Strip chrome that doesn't belong in the export
      [".nav", ".dz-actions", ".btn-download", ".btn-download-alt", ".toast", ".dropzone", ".thinking"]
        .forEach((sel) => clone.querySelectorAll(sel).forEach((el) => el.remove()));
      const html = "<!DOCTYPE html><html>" + clone.innerHTML + "</html>";
      let blob, ext;
      if (window.htmlDocx && typeof window.htmlDocx.asBlob === "function") {
        blob = window.htmlDocx.asBlob(html);
        ext = "docx";
      } else {
        const wordHtml = html.replace(
          "<html>",
          '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">'
        );
        blob = new Blob(["﻿" + wordHtml], { type: "application/msword" });
        ext = "doc";
      }
      // Filenames mirror the print-flow naming in exportPdf above.
      const safeAddr = (addr || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const safePid = (acct || '').toString().replace(/[^A-Za-z0-9]+/g, '');
      const base = mode === "county"
        ? `CAD-Evidence-Review-${safeAddr}`
        : (safePid ? `TD-${safePid}-${safeAddr}-Analysis` : `TD-${safeAddr}-Analysis`);
      const filename = base.replace(/[^A-Za-z0-9\-]+/g, "-").slice(0, 120) + "." + ext;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setTimeout(() => document.body.classList.remove(cls), 800);
    } catch (err) {
      console.error("DOCX export failed:", err);
      alert("DOCX export failed: " + (err && err.message ? err.message : String(err)));
    }
  };

  // Handoff + auto-export wiring. When TaxDrop One opens this page in a
  // popup window with ?export=pdf|docx (and a stashed evidence payload in
  // localStorage), the analyzer skips its file-drop UI, restores the prior
  // analysis, fires the export automatically, and closes the popup. Storage
  // is localStorage (not sessionStorage) because new windows get a fresh
  // sessionStorage and wouldn't see anything stashed by the parent.
  // (2026-06-22 fix: hidden-iframe print stopped working; switched to
  // popup window, which requires localStorage for the handoff to survive.)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const exportMode = (params.get("export") || "").toLowerCase();
      const handoffMode = (params.get("handoff") || params.get("mode") || "full").toLowerCase();
      // Prefer localStorage (popup flow); fall back to sessionStorage so any
      // old links still in flight from before the switch keep working.
      let raw = null;
      try { raw = localStorage.getItem(HANDOFF_KEY); } catch (_) {}
      if (!raw) {
        try { raw = sessionStorage.getItem(HANDOFF_KEY); } catch (_) {}
      }
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload && payload.data && (Date.now() - (payload.ts || 0)) < 10 * 60 * 1000) {
          // Reuse the regular analysis path so the result shape matches
          // exactly what a normal file-drop would have produced.
          const r = window.Analyzer.analyze(payload.data);
          setResult(r);
          setMethod(payload.method || "ai");
          setStage("results");
          if (exportMode === "pdf" || exportMode === "docx") {
            const which = handoffMode === "county" ? "county" : "full";
            // Wait for the React render to settle before printing.
            setTimeout(() => {
              if (exportMode === "pdf") exportPdf(which);
              else exportDocx(which);
              // Close the popup after the export has had time to start. PDF
              // print() blocks JS until the dialog is dismissed, so this
              // line runs when the user finishes (or cancels) the dialog.
              setTimeout(() => { try { window.close(); } catch (_) {} }, 800);
            }, 600);
          }
        }
        try { localStorage.removeItem(HANDOFF_KEY); } catch (_) {}
        try { sessionStorage.removeItem(HANDOFF_KEY); } catch (_) {}
      }
    } catch (_) {
      /* handoff is best-effort; fall back to the normal drop-zone flow */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inputView = stage === "input" || stage === "loading" || stage === "error";

  return (
    <React.Fragment>
      <nav className="nav">
        <div className="nav-in">
          <img className="logo" src="assets/taxdrop-logo.png" alt="TaxDrop" />
          <span className="divider" />
          <span className="tool-name">Evidence Analyzer</span>
          <span className="spacer" />
          {stage === "results" &&
          <React.Fragment>
              <button className="btn-download" onClick={() => exportPdf("county")}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2.5v7m0 0L5 6.5m3 3l3-3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 11v1.5A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V11" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                County copy
              </button>
              <button className="btn-download-alt" onClick={() => exportPdf("full")}>
                My notes
              </button>
              <button className="restart" onClick={reset}>
                Analyze another
              </button>
            </React.Fragment>
          }
        </div>
      </nav>

      <div className="app">
        {inputView &&
        <React.Fragment>
            <div className="intro">
              <span className="eyebrow">ASSESSOR EVIDENCE ANALYSIS</span>
              <h1>Let's review the county's evidence.</h1>
              <p>Upload the evidence packet your appraisal district sent. We'll read every comparable, identify anything fishy, and identify your best approach for reduction — plus the talking points to make your case.



            </p>
            </div>

            <div
            className={"dropzone" + (drag ? " drag" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}>
            
              {stage === "loading" ?
            <div className="thinking">
                  <div className="spinner" />
                  <div className="t">Reading your evidence{fileName ? " — " + fileName : ""}…</div>
                  <div className="steps">finding the median · weighing every comparable · building your case</div>
                </div> :

            <React.Fragment>
                  <div className="dz-head">
                    <div className="dz-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                        <path d="M12 15.5V4m0 0L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="dz-title">Drop your CAD evidence here</div>
                    <div className="dz-desc">
                      Upload the <b>Evidence packet</b> your county sent — PDF, Excel, or CSV. Drop one file or several
                      at once (e.g. the cover letter plus a comparables spreadsheet) and we'll read them together. If
                      you haven't received their evidence yet, you may need to request it.
                    </div>
                  </div>

                  {stage === "error" && <div className="errbox">{error}</div>}

                  <div className="dz-actions">
                    <label className="btn btn-primary">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 11V3m0 0L5 6m3-3l3 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M3 11v1.5A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V11" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                      Choose files
                      <input
                        ref={fileRef}
                        type="file"
                        multiple
                        accept=".pdf,.xlsx,.xlsm,.xls,.xlsb,.csv,.tsv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                        style={{ display: "none" }}
                        onChange={(e) => runFiles(e.target.files)}
                      />
                    </label>
                    <span className="drag-hint">or drag one or more files anywhere in this box</span>
                  </div>
                </React.Fragment>
            }
            </div>

            {stage !== "loading" && (
              <div className="disclaimer disclaimer-below">
                Your evidence is read in your browser for this session only. This analysis supports your protest —
                it isn't legal or tax advice.
              </div>
            )}
          </React.Fragment>
        }

        {stage === "results" && result && <ResultsView result={result} method={method} onCopy={copy} />}

        <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
      </div>
    </React.Fragment>);

}

/* Results wrapper holds the editable tax-rate control and stitches the
   sub-components together. */
function ResultsView({ result, method, onCopy }) {
  const [rate, setRate] = useState((result.taxRate * 100).toFixed(2));
  const [r, setR] = useState(result);

  const applyRate = (val) => {
    setRate(val);
    const n = parseFloat(val) / 100;
    if (isNaN(n) || n <= 0) return;
    const nr = Object.assign({}, r);
    nr.taxRate = n;
    nr.savingsTarget = nr.reductionAtTarget * n;
    nr.savingsFloor = nr.reductionAtFloor * n;
    setR(nr);
  };

  const valueLabel = r.valueWord ? r.valueWord.replace(/\b\w/, (c) => c.toUpperCase()) : "Assessed value";

  return (
    <div className="results">
      <div className="print-head">
        <img src="assets/taxdrop-logo.png" alt="TaxDrop" />
        <div className="ph-meta">
          <div className="ph-title">Property Tax Evidence Analysis</div>
          {r.address ? <div className="ph-sub">{r.address}</div> : null}
        </div>
      </div>

      <div className="ctrlbar owner-only">
        <div className="ctrl">
          <label>{valueLabel}</label>
          <span className="subj num">{fmtMoney(r.assessed)}</span>
        </div>
        <div className="ctrl">
          <label>Effective tax rate</label>
          <input className="rate-input num" value={rate} onChange={(e) => applyRate(e.target.value)} inputMode="decimal" />
          <span style={{ color: "var(--gray-500)", fontSize: 13 }}>%</span>
        </div>
        <div className="spacer" />
        <div className="method-tag">
          <span className="d" />
          {method === "ai" ? "Read by AI" : method === "ai-vision" ? "Read by AI · page images" : "Read by rules"}
        </div>
      </div>

      <DataQualityBanner dq={r.dataQuality} />

      {/* County copy only: a plain, un-branded, facts-only document.
          When the packet doesn't support a real reduction, CountySummary/Comps
          render nothing and CountyNoOpportunity prints an explainer instead. */}
      <CountySummary r={r} />
      <CountyComps r={r} />
      <CountyNoOpportunity r={r} />

      <div className="owner-only"><BestStrategy r={r} /></div>
      <div className="owner-only"><Hero r={r} /></div>
      <div className="owner-only"><Strategy r={r} /></div>
      <div className="owner-only"><SettlementEmail text={r.settlementEmail} onCopy={onCopy} /></div>
      <div className="owner-only"><Findings findings={r.findings} /></div>
      <div className="owner-only"><CompTable r={r} /></div>
      <div className="owner-only"><GamePlan r={r} /></div>
      <div className="owner-only"><OpeningScript text={r.openingScript} onCopy={onCopy} /></div>
      <div className="owner-only"><TalkingPoints points={r.talkingPoints} onCopy={onCopy} /></div>
      <div className="owner-only"><Objections items={r.objections} /></div>
      <div className="owner-only"><Checklist items={r.checklist} /></div>
    </div>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);