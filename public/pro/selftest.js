/*
 * TaxDrop One — Agent test tools (agent-only).
 *
 * Drop-in: <script src="/pro/selftest.js"></script> on any agent page
 * (/review, /agent). Injects two floating buttons:
 *
 *   🧪 Test evidence upload   — runs the real upload pipeline (below).
 *   📄 Test property report    — seeds the deterministic 6101 Lake Shore Dr
 *        draft and opens the finished report exactly as it renders for a
 *        reviewer/customer (stored-draft path), so UI changes can be eyeballed
 *        against a known property without a live purchase or engine lookup.
 *
 * The evidence self-test, on click, runs the REAL end-to-end evidence pipeline —
 * the exact browser path that broke in the 2026-07 "No county evidence
 * uploaded" outage:
 *
 *   1. resolve the agent session jti          (GET /api/report)
 *   2. build a small valid PDF for 6101 Lake Shore Dr and upload it PRIVATE
 *      through the real client-upload handshake (POST /api/blob-upload)
 *   3. attach it to a reusable review record   (POST /api/intake)
 *   4. read it back through the sup-gated proxy (GET /api/evidence-download)
 *
 * A server-only health check would have stayed green through that outage, so
 * this deliberately exercises the browser upload. Idempotent: it always seeds
 * the same "6101 LAKE SHORE DR" record, so re-runs overwrite rather than pile up.
 */
(function () {
  "use strict";
  if (window.__tdEvidenceSelfTest) return; // guard against double-injection
  window.__tdEvidenceSelfTest = true;

  // Same-origin self-hosted bundle of @vercel/blob's `upload` (see
  // /public/vendor/). Must match what v2/index.html loads — testing the
  // esm.sh CDN path would test a code path the real app no longer uses.
  var BLOB_CLIENT = "/vendor/blob-client-2.6.1.js";
  var TEST_ADDRESS = "6101 LAKE SHORE DR";
  var TEST_FILENAME = "test-6101-lake-shore-evidence.pdf";

  // Never let a step hang forever — a stuck await used to leave the panel
  // spinning with no clue. Race every await against a timeout so failures are
  // always visible (and logged to the console for deeper debugging).
  function withTimeout(p, ms, label) {
    return Promise.race([
      Promise.resolve(p),
      new Promise(function (_, rej) {
        setTimeout(function () { rej(new Error((label || "step") + " timed out after " + Math.round(ms / 1000) + "s")); }, ms);
      }),
    ]);
  }

  async function loadUploader() {
    if (window.blobClientUpload) return window.blobClientUpload;
    var mod = await withTimeout(import(BLOB_CLIENT), 15000, "loading @vercel/blob");
    window.blobClientUpload = mod.upload;
    return mod.upload;
  }

  // Minimal, valid single-page PDF (Helvetica text) carrying the 6101 Lake Shore
  // evidence summary — so the seeded record has a real, openable packet. All
  // bytes are ASCII, so string length == byte length (offsets stay correct).
  function build6101Pdf(nonce) {
    var lines = [
      "TaxDrop One - Evidence Upload Self-Test",
      "",
      "Property: 6101 LAKE SHORE DR   Account 41341899",
      "Current appraised value: $1,594,000",
      "Requested value: $1,465,689",
      "",
      "Basis: 6017 LAKESIDE DR is indicated at $1,465,689, with an",
      "even-lower comp behind it - using the 2nd-lowest keeps it",
      "defensible rather than resting on one outlier.",
      "",
      "This is an automated pipeline test. Safe to delete.",
      "Run token: " + nonce,
    ];
    var escc = function (s) { return s.replace(/[\\()]/g, function (c) { return "\\" + c; }); };
    var content = "BT /F1 12 Tf 54 748 Td 15 TL\n";
    for (var i = 0; i < lines.length; i++) content += "(" + escc(lines[i]) + ") Tj T*\n";
    content += "ET";
    var objs = [
      "<</Type/Catalog/Pages 2 0 R>>",
      "<</Type/Pages/Kids[3 0 R]/Count 1>>",
      "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>",
      "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
      "<</Length " + content.length + ">>\nstream\n" + content + "\nendstream",
    ];
    var pdf = "%PDF-1.4\n";
    var offs = [];
    for (var j = 0; j < objs.length; j++) {
      offs.push(pdf.length);
      pdf += (j + 1) + " 0 obj\n" + objs[j] + "\nendobj\n";
    }
    var xref = pdf.length;
    pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n";
    for (var k = 0; k < offs.length; k++) pdf += ("0000000000" + offs[k]).slice(-10) + " 00000 n \n";
    pdf += "trailer\n<</Size " + (objs.length + 1) + "/Root 1 0 R>>\nstartxref\n" + xref + "\n%%EOF";
    return new File([pdf], TEST_FILENAME, { type: "application/pdf" });
  }

  // A compact, sane draft so the seeded record renders like a real case when the
  // agent opens it (values from the 6101 Lake Shore evidence packet).
  function testDraft() {
    var notice = 1594000, target = 1518000;
    // REAL property: 6101 Lake Shore Dr is in the Resort on Eagle Mountain Lake,
    // FORT WORTH — TARRANT county (not Dallas). Data + comps below are taken from
    // the actual Tarrant CAD 2026 evidence packet for parcel 41341899. Carry
    // county/state + per-property lat/lng + city/zip-qualified full_address so
    // the seeded case exercises the real paths: the console/report maps geocode
    // tight pins on Eagle Mountain Lake, and /api/form-schema resolves the
    // Tarrant 50-132 form. 7 comps so the agent has room to add/remove.
    var comp = function (addr, pid, mv, sf, yr, lat, lng, dist) {
      return { full_address: addr + ", FORT WORTH, TX 76179", site_address: addr, parcel_id: pid, total_market: mv, living_sqft: sf, year_built: yr, latitude: lat, longitude: lng, distance_mi: dist };
    };
    // Clear Capital sales-comp shape (matches the engine's normalized output).
    var sale = function (addr, price, date, sf, yr, dist) {
      return { address: addr + ", FORT WORTH, TX 76179", site_address: addr, sale_price: price, sale_date: date, living_sqft: sf, year_built: yr, distance_mi: dist, event_type: "Sale" };
    };
    return {
      result: { notice: notice, target: target, reduction: notice - target, taxSaved: Math.round((notice - target) * 0.022), method: "sales", winner: "our" },
      our: {
        strategy: "sales comparison",
        subject: { site_address: TEST_ADDRESS, full_address: TEST_ADDRESS + ", FORT WORTH, TX 76179", parcel_id: "41341899", county: "tarrant", county_name: "Tarrant", us_state: "TX", site_state: "TX", tax_year: 2026, living_sqft: 4491, year_built: 2007, lot_sqft: 27878, total_market: notice, latitude: 32.8903, longitude: -97.4626 },
        comps: [
          comp("6017 LAKESIDE DR",      "7302371",  1465689, 4507, 2005, 32.8890, -97.4610, 0.11),
          comp("12479 PALMER DR",       "42612932", 1494424, 4487, 2024, 32.8945, -97.4670, 0.43),
          comp("5901 THURMOND SAIL CT", "41342186", 1500000, 4453, 2021, 32.8918, -97.4595, 0.25),
          comp("7080 THE RESORT BLVD",  "42613467", 1518000, 4078, 2022, 32.8880, -97.4600, 0.24),
          comp("5908 HUDSON SAIL CIR",  "42613122", 1601000, 4516, 2021, 32.8925, -97.4655, 0.25),
          comp("5949 LAKESIDE DR",      "7302347",  1928253, 4408, 2006, 32.8888, -97.4640, 0.17),
          comp("6012 THURMOND SAIL CT", "41342283", 2139987, 4549, 2013, 32.8910, -97.4618, 0.08),
        ],
        // Illustrative Clear Capital MLS closed sales (self-test fixture only —
        // real customers get live CC data at intake). Tuned so the sales-
        // indicated value edges just below the equity median, demonstrating the
        // sales approach WINNING and becoming the opinion of value.
        sales_comps: [
          sale("6017 LAKESIDE DR",      1400000, "2025-03-24", 4507, 2005, 0.11),
          sale("5904 HUDSON SAIL CIR",  1470000, "2025-11-05", 4648, 2022, 0.27),
          sale("12479 PALMER DR",       1450000, "2024-12-10", 4487, 2024, 0.43),
          sale("5901 THURMOND SAIL CT", 1465000, "2025-02-18", 4453, 2021, 0.25),
          sale("6024 THURMOND SAIL CT", 1610000, "2025-06-27", 3890, 2016, 0.09),
        ],
      },
      cad: {}, cadRaw: { delivered: true }, cadMethod: "self-test", lookupAddr: TEST_ADDRESS + ", FORT WORTH, TX 76179",
    };
  }

  // ---- UI ---------------------------------------------------------------

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  var STEPS = [
    { key: "session", label: "Agent session" },
    { key: "upload", label: "Private upload (client handshake)" },
    { key: "attach", label: "Attach to review record" },
    { key: "readback", label: "Read back via proxy" },
  ];

  function openPanel() {
    var back = el("div", "position:fixed;inset:0;z-index:2147483000;background:rgba(15,20,17,.55);display:flex;align-items:center;justify-content:center;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;");
    var card = el("div", "background:#fff;color:#16241c;width:min(520px,92vw);border-radius:16px;box-shadow:0 24px 60px rgba(0,0,0,.35);padding:22px 22px 18px;");
    var h = el("div", "font-size:17px;font-weight:800;display:flex;align-items:center;gap:8px;", "🧪 Evidence upload self-test");
    var sub = el("div", "font-size:12.5px;color:#5c666f;margin:4px 0 16px;", "Runs the real upload → attach → read-back pipeline for " + TEST_ADDRESS + ".");
    card.appendChild(h); card.appendChild(sub);

    var rows = {};
    STEPS.forEach(function (s) {
      var row = el("div", "display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-top:1px solid #eef1ef;");
      var ic = el("div", "width:18px;flex:0 0 18px;text-align:center;font-size:14px;line-height:20px;color:#9aa4ac;", "○");
      var body = el("div", "flex:1;min-width:0;");
      var lbl = el("div", "font-size:13.5px;font-weight:600;line-height:20px;", s.label);
      var det = el("div", "font-size:12px;color:#7a838b;word-break:break-word;");
      body.appendChild(lbl); body.appendChild(det);
      row.appendChild(ic); row.appendChild(body); card.appendChild(row);
      rows[s.key] = { ic: ic, det: det };
    });

    var banner = el("div", "margin-top:14px;font-size:13.5px;font-weight:700;border-radius:10px;padding:11px 13px;display:none;");
    card.appendChild(banner);

    var foot = el("div", "display:flex;gap:8px;justify-content:flex-end;margin-top:16px;");
    var openBtn = el("button", "display:none;border:1px solid #d7ddd8;background:#f4f7f5;color:#16241c;font-weight:700;font-size:13px;border-radius:9px;padding:9px 14px;cursor:pointer;font-family:inherit;", "Open in review ↗");
    var closeBtn = el("button", "border:none;background:#16542f;color:#fff;font-weight:700;font-size:13px;border-radius:9px;padding:9px 16px;cursor:pointer;font-family:inherit;", "Close");
    foot.appendChild(openBtn); foot.appendChild(closeBtn); card.appendChild(foot);

    closeBtn.addEventListener("click", function () { back.remove(); });
    back.addEventListener("click", function (e) { if (e.target === back) back.remove(); });
    back.appendChild(card); document.body.appendChild(back);

    var api = {
      set: function (key, state, detail) {
        var r = rows[key]; if (!r) return;
        if (state === "run") { r.ic.textContent = "⏳"; r.ic.style.color = "#9aa4ac"; }
        else if (state === "ok") { r.ic.textContent = "✓"; r.ic.style.color = "#0B8F52"; }
        else if (state === "fail") { r.ic.textContent = "✗"; r.ic.style.color = "#c0392b"; }
        if (detail != null) r.det.textContent = detail;
      },
      finish: function (ok, recordJti) {
        banner.style.display = "block";
        if (ok) {
          banner.style.background = "#e7f7ee"; banner.style.color = "#0B6b3f";
          banner.textContent = "PASS — evidence uploads are working end-to-end.";
          if (recordJti) {
            openBtn.style.display = "inline-block";
            openBtn.addEventListener("click", function () {
              window.open("/review?jti=" + encodeURIComponent(recordJti), "_blank", "noopener");
            });
          }
        } else {
          banner.style.background = "#fdecea"; banner.style.color = "#a5281b";
          banner.textContent = "FAIL — see the failing step above. The error is also in the Vercel runtime logs.";
        }
      },
    };
    return api;
  }

  async function run(ui) {
    var nonce = Math.random().toString(36).slice(2, 10);
    // 1. session
    // Fixed, dedicated test namespace. The ?selftest=1 flag makes the server
    // force this jti for a valid agent regardless of any customer link cookie,
    // so the test never touches a real purchase record.
    var jti = "sup-selftest";
    ui.set("session", "run");
    try {
      console.log("[selftest] checking agent session via /api/report");
      var rr = await withTimeout(fetch("/api/report", { headers: { Accept: "application/json" } }), 12000, "session request");
      console.log("[selftest] /api/report status", rr.status);
      if (rr.status === 402 || rr.status === 403) throw new Error("not signed in as an agent — open /agent and sign in");
      ui.set("session", "ok", "agent authenticated");
    } catch (e) { console.error("[selftest] session failed", e); ui.set("session", "fail", String(e && e.message || e)); ui.finish(false); return; }

    // 2. upload (the real handshake that broke)
    ui.set("upload", "run");
    var file = build6101Pdf(nonce), blob;
    try {
      var upload = await loadUploader();
      var pathname = "one/reviews/" + jti + "/" + TEST_FILENAME;
      console.log("[selftest] uploading private blob", pathname);
      blob = await withTimeout(upload(pathname, file, { access: "private", handleUploadUrl: "/api/blob-upload?selftest=1" }), 30000, "upload");
      console.log("[selftest] upload ok", blob && blob.url);
      ui.set("upload", "ok", "private blob created (" + file.size + " bytes)");
    } catch (e) { console.error("[selftest] upload failed", e); ui.set("upload", "fail", String(e && e.message || e)); ui.finish(false); return; }

    // 3. attach to a reusable review record
    ui.set("attach", "run");
    var recordJti;
    try {
      var ir = await withTimeout(fetch("/api/intake?selftest=1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: TEST_ADDRESS,
          contact: { name: "Evidence Self-Test", email: "selftest@taxdrop.com" },
          evidence: [{ url: blob.url, filename: TEST_FILENAME, size: file.size }],
          draft: testDraft(),
        }),
      }), 15000, "intake");
      var id = await ir.json().catch(function () { return {}; });
      if (!ir.ok) throw new Error(id.message || id.error || ("intake " + ir.status));
      recordJti = id.jti;
      if (!recordJti) throw new Error("intake did not return a record jti");
      console.log("[selftest] attached to record", recordJti);
      ui.set("attach", "ok", "record " + recordJti);
    } catch (e) { console.error("[selftest] attach failed", e); ui.set("attach", "fail", String(e && e.message || e)); ui.finish(false); return; }

    // 4. read back through the sup-gated proxy
    ui.set("readback", "run");
    try {
      var dl = await withTimeout(fetch("/api/evidence-download?jti=" + encodeURIComponent(recordJti) + "&i=0"), 15000, "read-back");
      if (!dl.ok) throw new Error("download returned " + dl.status);
      var ct = dl.headers.get("content-type") || "";
      var bytes = (await dl.arrayBuffer()).byteLength;
      if (!/pdf/i.test(ct)) throw new Error("unexpected content-type: " + ct);
      if (!bytes) throw new Error("empty response");
      console.log("[selftest] read-back ok", ct, bytes);
      ui.set("readback", "ok", ct + " · " + bytes + " bytes");
    } catch (e) { console.error("[selftest] read-back failed", e); ui.set("readback", "fail", String(e && e.message || e)); ui.finish(false); return; }

    ui.finish(true, recordJti);
  }

  // Seed the deterministic 6101 Lake Shore Dr draft into the reusable self-test
  // record, then open the FULL agent review console for it (/review?jti=…) — not
  // the bare evidence-pack PDF. The console is what an agent actually works in:
  // comp keep/drop, reviewer edits, report notes, the embedded pack preview, and
  // the PDF/DOCX export links all live there. (Ryder 2026-07-21: "the agent test
  // report should be the full agent review page, not just the PDF.") We seed from
  // the stored draft rather than a live ?address= lookup so it's deterministic
  // and never 404s on address resolution.
  async function openTestReport(btn) {
    // Open the tab SYNCHRONOUSLY inside the click gesture so the browser doesn't
    // pop-up-block it — the seed below is async (upload + intake awaits), and any
    // window.open AFTER an await is treated as non-user-initiated and blocked.
    // No "noopener" here: we need the handle to navigate the tab once the record
    // is seeded. (Ryder 2026-07-21 — "always get pop-up blocked".)
    var w = window.open("about:blank", "_blank");
    if (!w) { alert("Couldn't open the test agent review:\n\npop-up blocked — allow pop-ups for this site, then try again"); return; }
    var orig = btn.textContent;
    btn.disabled = true; btn.textContent = "Preparing report…";
    try {
      // Seed a real county evidence packet too, so the review's "County evidence
      // packet" section is populated (intake REPLACES the evidence array, so
      // sending [] here used to wipe whatever the upload self-test attached).
      // Best-effort: if the upload fails, still seed the draft without evidence.
      var evidence = [];
      try {
        var upload = await loadUploader();
        var file = build6101Pdf(Math.random().toString(36).slice(2, 10));
        var pathname = "one/reviews/sup-selftest/" + TEST_FILENAME;
        var blob = await withTimeout(upload(pathname, file, { access: "private", handleUploadUrl: "/api/blob-upload?selftest=1" }), 30000, "seed upload");
        if (blob && blob.url) evidence = [{ url: blob.url, filename: TEST_FILENAME, size: file.size }];
      } catch (upErr) { console.warn("[report-preview] evidence seed failed (continuing without):", upErr); }

      var ir = await withTimeout(fetch("/api/intake?selftest=1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: TEST_ADDRESS,
          contact: { name: "Report Preview", email: "selftest@taxdrop.com" },
          evidence: evidence,
          draft: testDraft(),
        }),
      }), 15000, "seed report");
      if (ir.status === 402 || ir.status === 403) throw new Error("not signed in as an agent — open /agent and sign in first");
      var id = await ir.json().catch(function () { return {}; });
      if (!ir.ok) throw new Error(id.message || id.error || ("intake " + ir.status));
      var jti = id.jti || "sup-selftest";
      // Navigate the tab we already opened (synchronously, above).
      w.location.href = "/review?jti=" + encodeURIComponent(jti);
    } catch (e) {
      try { w.close(); } catch (_) {}
      console.error("[report-preview] failed", e);
      alert("Couldn't open the test agent review:\n\n" + (e && e.message || e));
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  }

  function injectButton() {
    if (document.getElementById("td-selftest-fab")) return;
    var btn = el("button", "position:fixed;right:16px;bottom:16px;z-index:2147482000;border:1px solid rgba(255,255,255,.18);background:#16542f;color:#fff;font-weight:700;font-size:13px;border-radius:999px;padding:10px 15px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28);font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;", "🧪 Test evidence upload");
    btn.id = "td-selftest-fab";
    btn.title = "Run the evidence upload pipeline self-test";
    btn.addEventListener("click", function () { run(openPanel()); });
    document.body.appendChild(btn);

    // Sibling FAB, stacked just above — opens the full agent review console for a
    // sample 6101 Lake Shore Dr case (seeded self-test row).
    var rbtn = el("button", "position:fixed;right:16px;bottom:60px;z-index:2147482000;border:1px solid rgba(255,255,255,.18);background:#0B6b3f;color:#fff;font-weight:700;font-size:13px;border-radius:999px;padding:10px 15px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28);font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;", "📄 Test agent review");
    rbtn.id = "td-report-preview-fab";
    rbtn.title = "Open the full agent review page for a sample 6101 Lake Shore Dr case";
    rbtn.addEventListener("click", function () { openTestReport(rbtn); });
    document.body.appendChild(rbtn);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectButton);
  else injectButton();
})();
