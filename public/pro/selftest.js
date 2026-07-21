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

  var BLOB_CLIENT = "https://esm.sh/@vercel/blob@2.6.1/client";
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
    var notice = 1594000, target = 1465689;
    var comp = function (addr, mv, sf, yr) {
      return { full_address: addr, site_address: addr, total_market: mv, living_sqft: sf, year_built: yr, distance_mi: 0.2 };
    };
    return {
      result: { notice: notice, target: target, reduction: notice - target, taxSaved: Math.round((notice - target) * 0.022), method: "sales", winner: "our" },
      our: {
        strategy: "sales comparison",
        subject: { site_address: TEST_ADDRESS, parcel_id: "41341899", county_name: "Travis", tax_year: 2026, living_sqft: 4491, total_market: notice },
        comps: [
          comp("6017 LAKESIDE DR", 1465689, 4507, 2005),
          comp("12479 PALMER DR", 1494424, 4487, 2024),
          comp("7080 THE RESORT BLVD", 1518000, 4078, 2022),
        ],
      },
      cad: {}, cadRaw: { delivered: true }, cadMethod: "self-test", lookupAddr: TEST_ADDRESS,
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
  // record, then open the finished report the way a reviewer/customer sees it
  // (stored-draft render path — the same escapeDeep-guarded renderer, and the
  // same record the "Open in review ↗" link uses). We render from the stored
  // draft rather than a live ?address= engine lookup so the preview is
  // deterministic and never 404s on address resolution.
  async function openTestReport(btn) {
    var orig = btn.textContent;
    btn.disabled = true; btn.textContent = "Preparing report…";
    try {
      var ir = await withTimeout(fetch("/api/intake?selftest=1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: TEST_ADDRESS,
          contact: { name: "Report Preview", email: "selftest@taxdrop.com" },
          evidence: [],
          draft: testDraft(),
        }),
      }), 15000, "seed report");
      if (ir.status === 402 || ir.status === 403) throw new Error("not signed in as an agent — open /agent and sign in first");
      var id = await ir.json().catch(function () { return {}; });
      if (!ir.ok) throw new Error(id.message || id.error || ("intake " + ir.status));
      var jti = id.jti || "sup-selftest";
      var w = window.open("/test/evidence-pack-v3?review=1&jti=" + encodeURIComponent(jti), "_blank", "noopener");
      if (!w) throw new Error("pop-up blocked — allow pop-ups for this site");
    } catch (e) {
      console.error("[report-preview] failed", e);
      alert("Couldn't open the test property report:\n\n" + (e && e.message || e));
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

    // Sibling FAB, stacked just above — opens a sample 6101 property report.
    var rbtn = el("button", "position:fixed;right:16px;bottom:60px;z-index:2147482000;border:1px solid rgba(255,255,255,.18);background:#0B6b3f;color:#fff;font-weight:700;font-size:13px;border-radius:999px;padding:10px 15px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28);font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;", "📄 Test property report");
    rbtn.id = "td-report-preview-fab";
    rbtn.title = "Open a sample 6101 Lake Shore Dr property report";
    rbtn.addEventListener("click", function () { openTestReport(rbtn); });
    document.body.appendChild(rbtn);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectButton);
  else injectButton();
})();
