/* Evidence extractor — turns a pasted/dropped/uploaded CAD evidence packet into
   the structured object the analysis engine consumes.

   Handles: PDF (via pdf.js / pdf-parse web build), plain text, CSV.
   Reads real Texas & California CAD formats where the key figures hide under
   many different labels. AI does the heavy reading; a heuristic parser is the
   fallback when AI is unavailable. */
(function () {
  "use strict";

  const PDF_ESM = "https://cdn.jsdelivr.net/npm/pdf-parse@2.4.5/dist/pdf-parse/web/pdf-parse.es.js";
  const PDF_WORKER = "https://cdn.jsdelivr.net/npm/pdf-parse@2.4.5/dist/pdf-parse/web/pdf.worker.min.mjs";
  let _pdfMod = null;

  // SheetJS via ESM CDN — loaded lazily on first Excel drop. Free/community
  // build is sufficient for reading .xlsx / .xls / .xlsm; we never write.
  // (2026-06-11: multi-file + Excel rollout.)
  const XLSX_ESM = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
  let _xlsxMod = null;

  // Production AI reader endpoint (OpenRouter-backed serverless function).
  // Override with window.EVIDENCE_API_BASE if the API is hosted elsewhere.
  const AI_ENDPOINT = (window.EVIDENCE_API_BASE || "") + "/api/evidence-read";

  // Send the schema prompt + evidence to the serverless reader. Returns the
  // model's raw text. Any failure (missing endpoint, no key, network, timeout)
  // throws so extract() falls back to the transparent rule-based parser.
  async function aiComplete(prompt) {
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: prompt }),
    });
    if (!res.ok) throw new Error("reader endpoint returned " + res.status);
    const data = await res.json();
    if (!data || !data.ok || typeof data.text !== "string") {
      throw new Error((data && data.error) || "reader endpoint returned no text");
    }
    return data.text;
  }

  const SCHEMA_PROMPT = `You read U.S. county appraisal district (CAD) property-tax "evidence" packets — mostly Texas and California — and extract structured data. These documents support the government's value; your reader uses them to argue for a LOWER value. Return ONLY a compact JSON object. No prose, no markdown fences.

Schema:
{
  "subject": { "address": string, "account": string|null, "value": number, "sqft": number|null, "yearBuilt": number|null, "beds": number|null, "baths": number|null, "condition": string|null, "improvementValue": number|null, "landValue": number|null, "state": "TX"|"CA"|null, "lienDate": string|null },
  "median": number|null,
  "salesMedian": number|null,
  "equityMedian": number|null,
  "medianPsf": number|null,
  "taxRate": number|null,
  "comps": [ { "address": string, "value": number, "sqft": number|null, "psf": number|null, "netAdjustment": number|null, "salePrice": number|null, "yearBuilt": number|null, "condition": string|null, "distanceMi": number|null, "saleDate": string|null } ]
}

How to find each field (labels vary by county — match by meaning):
- subject.account = the subject's account / property / parcel ID. Labels: "Account", "Property ID", "Prop ID", "Parcel", "Quick Ref ID", "Ref ID". Keep the value as printed (string).
- subject.value = the SUBJECT property's appraised/market value. Labels: "Appraised Value", "Market Value", "Noticed Value", "Total Value", or the Subject row's value. Use the market/appraised value, not land-only.
- subject.sqft = subject "Living Area" / "Total Living Area" / "Gross Living Area" in square feet.
- subject.yearBuilt = subject year built (or effective year built if that is what's shown).
- subject.beds = subject bedroom count. Labels: "Bedrooms", "Total Bedrooms", "Bed".
- subject.baths = subject bathroom count (full + half; e.g. "2 / 0" → 2, "2/1" → 2.5). Labels: "Baths", "Total Baths", "Bath".
- subject.improvementValue = subject "Total Improvement Value" / "Improvements" (the building, not land). null if absent.
- subject.landValue = subject "Land Value" / "Land". null if absent.
- subject.condition = subject condition/quality/renovation descriptor if present. Labels: "CDU" (Average/Good...), "Cost and Design" (None/Partial/Extensive), "Grade", "Quality".
- median = the single subject median VALUE if the packet states only one. Labels: "Subject Value At Median", "Median", "Median Indicated Value", "weighted median". null if none.
- MANY Texas packets contain TWO separate comparison grids, each with its OWN subject median — capture both:
  - salesMedian = the subject median on the SALES / MARKET-value grid (built from comparable SALES). Labels: on that grid's subject row, "Median Value", "Median Indicated Value", "Median Sale". This is the market-value median.
  - equityMedian = the subject median on the EQUITY / UNIFORMITY grid (unequal-appraisal comps, usually no sale prices). Labels: "Median Equity Value", "Subject Value At Median", "Equity Median". This is the §41.43(b)(3) uniformity median.
  If the packet has only one grid/median, set the matching one (salesMedian if it's a sales grid, equityMedian if it's an equity grid) and leave the other null. Read each grid's SUBJECT row median, never a comparable's value.
- medianPsf = the median Value-per-square-foot if the packet states one. Labels: "Median ... Value / Sqft", "Median $/SF", "Indicated Value / SQFT ... Median". null if none.
- comps[].value = each comparable's FINAL indicated value for the subject — the most-adjusted figure on that comp's row. Labels: "Final Adj Sale Price", "Indicated Value", "Adjusted Sales Price", "Indicated MKT Value", "Comparative Value". For EQUITY/EQUALITY comps that show no adjusted figure, use that comparable's "Market Value".
- comps[].sqft = that comparable's Living Area in square feet.
- comps[].psf = that comparable's stated Value/Sqft or Indicated Value per SQFT, if shown. Else null (the engine computes it).
- comps[].netAdjustment = the comp's "Net Adjustment" / "Total Adjustment" / "Adjustment" amount (the dollar change applied to its sale or market value to make it comparable to the subject). Keep the sign if shown. null if none.
- comps[].salePrice = the comp's raw, unadjusted Sale Price if present (sales comps only). null for equity comps.
- comps[].yearBuilt = the comp's year built (or effective year built).
- comps[].condition = the comp's condition/quality/renovation descriptor (same labels as subject.condition).
- comps[].saleDate = the sale date if present (equity comps have none — use null).
- subject.state = "TX" or "CA" from the address.
- Strip $ and commas; output plain numbers. Use null for anything missing — never invent.

OUTPUT BUDGET: Return MINIFIED JSON (no line breaks, no extra spaces). Keep every address to the street line only (omit city, state, ZIP). Return at most the 12 comparables most similar to the subject. This keeps the response small enough to be complete.

CRITICAL: If the document lists MULTIPLE subject properties, extract ONLY THE FIRST subject and the comparables that belong to it. Return every comparable for that one subject.

SOME PACKETS ARE POSITIONAL GRIDS: a column-header list appears once (e.g. "Prop ID, GEO ID, ... Market Value, ... Indicated Value"), then a "Subject" block lists that subject's values in the same order, then each "Comp #1 / Comp #2 ..." block lists its values in the same order. When you see this, match values to headers by position: the subject.value is the Subject block's "Market Value"; each comp's value is that comp block's "Indicated Value" (typically the last large dollar figure in the block, after the adjustments). The header row repeats on every page — ignore the repeats.

EVIDENCE:
`;

  async function loadPdf() {
    if (_pdfMod) return _pdfMod;
    const mod = await import(PDF_ESM);
    mod.PDFParse.setWorker(PDF_WORKER);
    _pdfMod = mod;
    return mod;
  }

  async function loadXlsx() {
    if (_xlsxMod) return _xlsxMod;
    _xlsxMod = await import(XLSX_ESM);
    return _xlsxMod;
  }

  // Render an Excel workbook as plain text the AI reader can consume.
  // Each sheet becomes a CSV block prefixed with `--- Sheet: <name> ---`
  // so a multi-tab workbook stays legible without us hand-tuning the layout.
  async function textFromXlsx(file) {
    const xlsx = await loadXlsx();
    const buf = await file.arrayBuffer();
    const wb = xlsx.read(buf, { type: "array" });
    const parts = [];
    for (const name of wb.SheetNames) {
      const sheet = wb.Sheets[name];
      if (!sheet) continue;
      const csv = xlsx.utils.sheet_to_csv(sheet, { strip: true, blankrows: false });
      if (!csv.trim()) continue;
      parts.push("--- Sheet: " + name + " ---\n" + csv);
    }
    return parts.join("\n\n");
  }

  function fileKind(file) {
    const name = (file.name || "").toLowerCase();
    if (/\.pdf$/.test(name) || /pdf$/i.test(file.type)) return "pdf";
    if (/\.(xlsx|xlsm|xls|xlsb)$/.test(name)
        || /sheet|excel|spreadsheetml/i.test(file.type)) return "xlsx";
    if (/\.(csv|tsv)$/.test(name) || /csv$/i.test(file.type)) return "csv";
    return "text";
  }

  // Pull text out of any supported file: PDF, Excel (.xlsx/.xls/.xlsm),
  // CSV/TSV, or plain text.
  async function textFromFile(file) {
    const kind = fileKind(file);
    if (kind === "pdf") {
      const { PDFParse } = await loadPdf();
      const buf = new Uint8Array(await file.arrayBuffer());
      const parser = new PDFParse({ data: buf });
      const res = await parser.getText();
      return res.text || "";
    }
    if (kind === "xlsx") {
      return await textFromXlsx(file);
    }
    // csv / tsv / text / md
    return await file.text();
  }

  async function extractFromFile(file) {
    return extractFromFiles([file]);
  }

  // Multi-file evidence: read each file, concatenate with a "=== FILE: name ==="
  // header so the AI reader knows where each document starts. A typical CAD
  // packet ships as one PDF; agents and homeowners with several appraisals,
  // CSV roll exports, or supplemental spreadsheets can now drop the whole
  // batch at once. (2026-06-11.)
  async function extractFromFiles(files) {
    const list = Array.isArray(files) ? files : Array.from(files || []);
    if (!list.length) return { ok: false, error: "No files dropped." };

    const parts = [];
    const failed = [];
    for (const file of list) {
      try {
        const t = await textFromFile(file);
        if (t && t.trim()) {
          parts.push("=== FILE: " + (file.name || "(unnamed)") + " ===\n" + t);
        }
      } catch (e) {
        failed.push(file.name || "(unnamed)");
      }
    }

    if (!parts.length) {
      const detail = failed.length
        ? "Couldn't read: " + failed.slice(0, 3).join(", ") + (failed.length > 3 ? "…" : "")
        : "No readable content in those files.";
      return {
        ok: false,
        error: detail + " If it's a scanned PDF, try pasting the text instead.",
      };
    }
    const combined = parts.join("\n\n");
    const out = await extract(combined);
    if (out.ok && failed.length) {
      out.warning = "Some files couldn't be read: " + failed.slice(0, 3).join(", ");
    }
    return out;
  }

  async function extract(text) {
    let trimmed = (text || "").trim();
    if (!trimmed) return { ok: false, error: "empty" };
    // keep AI input bounded; the meaningful evidence is near the front of CAD packets
    const forAI = trimmed.length > 45000 ? trimmed.slice(0, 45000) : trimmed;

    try {
      const raw = await aiComplete(SCHEMA_PROMPT + forAI);
      const data = coerce(parseLooseJSON(raw));
      if (usable(data)) return { ok: true, method: "ai", data };
    } catch (e) {
      /* AI reader unavailable — fall through to the rule-based parser */
    }

    const data = coerce(window.Analyzer.parseHeuristic(trimmed));
    if (usable(data)) return { ok: true, method: "rules", data };

    return {
      ok: false,
      error: "Couldn't find a subject value and comparables in that evidence. Make sure you uploaded the full appraisal evidence packet.",
    };
  }

  function usable(d) {
    if (!d) return false;
    const hasValue = d.subject && d.subject.assessedValue != null;
    const hasComps = Array.isArray(d.comps) && d.comps.length >= 1;
    return hasValue && hasComps;
  }

  function parseLooseJSON(s) {
    if (!s) return null;
    let t = String(s).trim();
    t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start === -1) return null;
    if (end !== -1) {
      try {
        return JSON.parse(t.slice(start, end + 1));
      } catch (e) {
        /* fall through to repair */
      }
    }
    return repairTruncated(t.slice(start));
  }

  // Recover a usable object from JSON truncated by the output-token cap: walk back
  // from the end to the last position where braces/brackets can be balanced.
  function repairTruncated(t) {
    for (let i = t.length - 1; i >= 0; i--) {
      if (t[i] !== "}") continue;
      const head = t.slice(0, i + 1);
      const ob = (head.match(/{/g) || []).length - (head.match(/}/g) || []).length;
      const obr = (head.match(/\[/g) || []).length - (head.match(/\]/g) || []).length;
      if (ob < 0 || obr < 0) continue;
      try {
        return JSON.parse(head + "]".repeat(obr) + "}".repeat(ob));
      } catch (e) {
        /* keep walking back */
      }
    }
    return null;
  }

  const toNum = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return isNaN(v) ? null : v;
    const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? null : n;
  };

  // tax rate may arrive as a decimal (0.021) or as percentage points (2.1) — normalize to a decimal
  const normRate = (v) => {
    const n = toNum(v);
    if (n == null) return null;
    return n >= 0.25 ? n / 100 : n; // effective property-tax rates are < 25%
  };

  // map AI/heuristic shape -> analyzer input shape
  function coerce(d) {
    if (!d) return null;
    const subj = d.subject || {};
    const assessedValue = toNum(subj.value != null ? subj.value : subj.assessedValue);
    const state = (subj.state || "").toString().toUpperCase().slice(0, 2) || null;
    return {
      subject: {
        address: subj.address || "",
        account: subj.account || null,
        assessedValue,
        sqft: toNum(subj.sqft),
        yearBuilt: toNum(subj.yearBuilt),
        beds: toNum(subj.beds),
        baths: toNum(subj.baths),
        improvementValue: toNum(subj.improvementValue),
        landValue: toNum(subj.landValue),
        condition: subj.condition || null,
        state,
        lienDate: subj.lienDate || null,
      },
      term: state === "TX" ? "protest" : state === "CA" ? "appeal" : "appeal",
      weightedMedian: toNum(d.median != null ? d.median : d.weightedMedian),
      salesMedian: toNum(d.salesMedian),
      equityMedian: toNum(d.equityMedian),
      medianPsf: toNum(d.medianPsf != null ? d.medianPsf : d.medianPSF),
      taxRate: normRate(d.taxRate),
      comps: (d.comps || [])
        .map((c, i) => ({
          id: "Comp " + (i + 1),
          address: c.address || c.addr || "",
          value: toNum(
            c.value != null ? c.value : c.adjustedValue != null ? c.adjustedValue : c.indicatedValue
          ),
          sqft: toNum(c.sqft),
          psf: toNum(c.psf != null ? c.psf : c.pricePerSqft),
          netAdjustment: toNum(c.netAdjustment != null ? c.netAdjustment : c.adjustment),
          salePrice: toNum(c.salePrice != null ? c.salePrice : c.salesPrice),
          yearBuilt: toNum(c.yearBuilt),
          condition: c.condition || null,
          distanceMi: toNum(c.distanceMi != null ? c.distanceMi : c.distance),
          saleDate: c.saleDate || c.date || "",
        }))
        .filter((c) => c.value != null),
    };
  }

  window.Extractor = { extract, extractFromFile, extractFromFiles };
})();
