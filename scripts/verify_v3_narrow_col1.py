"""Verify v3 evidence-pack Section 3 with narrower column 1."""
from playwright.sync_api import sync_playwright
import json
import os

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=2420+Holsten+Hill+Dr%2C+Pflugerville%2C+TX+78660"
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"

os.makedirs(OUT_DIR, exist_ok=True)


def capture(media: str, suffix: str, viewport_width: int = 1280):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": viewport_width, "height": 1000})
        page = ctx.new_page()
        if media == "print":
            page.emulate_media(media="print")
        page.goto(URL, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(2500)

        # Full page screenshot
        page.screenshot(
            path=f"{OUT_DIR}/v3_narrow_{suffix}_full.png", full_page=True
        )

        # Find Section 3 heading and the comp grid container after it
        rows = page.evaluate(
            r"""
            () => {
              const out = {section3Found: false, rows: [], tableRect: null, pageScrollWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth};

              // Find headings containing "Section 3" or comparable phrasing
              const headers = Array.from(document.querySelectorAll('h1,h2,h3,h4'));
              const sec3 = headers.find(h => /section\s*3/i.test(h.textContent) || /comparable/i.test(h.textContent));
              if (!sec3) return out;
              out.section3Found = true;
              out.headingText = sec3.textContent.trim();

              // Search forward for the next table-like grid
              let el = sec3;
              let grid = null;
              const stopAt = 60;
              for (let i = 0; i < stopAt && el; i++) {
                el = el.nextElementSibling || (el.parentElement && el.parentElement.nextElementSibling);
                if (!el) break;
                // accept tables OR divs styled as grids
                const cand = el.querySelector ? el.querySelector('table, [class*="grid"], [class*="Grid"]') : null;
                if (cand) { grid = cand; break; }
                if (el.tagName === 'TABLE') { grid = el; break; }
              }
              if (!grid) {
                // fallback: pick the first table in document after the heading offsetTop
                const allTables = Array.from(document.querySelectorAll('table'));
                grid = allTables.find(t => t.getBoundingClientRect().top + window.scrollY > sec3.getBoundingClientRect().top + window.scrollY) || null;
              }
              if (!grid) return out;

              const gridRect = grid.getBoundingClientRect();
              out.tableRect = {x: gridRect.x, y: gridRect.y, width: gridRect.width, height: gridRect.height};

              // Iterate first column cells
              const firstColCells = [];
              if (grid.tagName === 'TABLE') {
                grid.querySelectorAll('tr').forEach(tr => {
                  const cell = tr.querySelector('th, td');
                  if (cell) firstColCells.push(cell);
                });
              } else {
                // Grid container: take direct children grouped into rows.
                // Try common pattern: each row is a child with its own first cell.
                const children = Array.from(grid.children);
                children.forEach(row => {
                  const cell = row.firstElementChild || row;
                  firstColCells.push(cell);
                });
              }

              firstColCells.forEach((cell, idx) => {
                const r = cell.getBoundingClientRect();
                const cs = window.getComputedStyle(cell);
                const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
                const lines = Math.round(r.height / lineHeight);
                out.rows.push({
                  idx,
                  text: (cell.textContent || '').trim().replace(/\s+/g,' '),
                  width: r.width,
                  height: r.height,
                  lineHeight,
                  approxLines: lines,
                  fontSize: cs.fontSize,
                });
              });

              return out;
            }
            """
        )

        with open(f"{OUT_DIR}/v3_narrow_{suffix}_rows.json", "w") as f:
            json.dump(rows, f, indent=2)

        # Scroll to Section 3 and shoot the table
        if rows.get("tableRect"):
            tr = rows["tableRect"]
            page.evaluate(
                f"window.scrollTo(0, {max(0, tr['y'] - 80)})"
            )
            page.wait_for_timeout(500)
            page.screenshot(
                path=f"{OUT_DIR}/v3_narrow_{suffix}_section3.png", full_page=False
            )

        browser.close()
        return rows


print("=== SCREEN (1280px) ===")
screen_rows = capture("screen", "screen", viewport_width=1280)
print(json.dumps({"section3Found": screen_rows.get("section3Found"),
                  "pageScrollWidth": screen_rows.get("pageScrollWidth"),
                  "viewportWidth": screen_rows.get("viewportWidth"),
                  "tableRect": screen_rows.get("tableRect"),
                  "row_count": len(screen_rows.get("rows", []))}, indent=2))

print("\n=== PRINT ===")
print_rows = capture("print", "print", viewport_width=1280)
print(json.dumps({"section3Found": print_rows.get("section3Found"),
                  "pageScrollWidth": print_rows.get("pageScrollWidth"),
                  "tableRect": print_rows.get("tableRect"),
                  "row_count": len(print_rows.get("rows", []))}, indent=2))

print("\n=== SCREEN ROWS ===")
for r in screen_rows.get("rows", []):
    flag = "WRAP" if r["approxLines"] > 1 else "ok  "
    print(f"  [{flag}] lines={r['approxLines']} h={r['height']:.0f} w={r['width']:.0f}  | {r['text'][:80]}")

print("\n=== PRINT ROWS ===")
for r in print_rows.get("rows", []):
    flag = "WRAP" if r["approxLines"] > 1 else "ok  "
    print(f"  [{flag}] lines={r['approxLines']} h={r['height']:.0f} w={r['width']:.0f}  | {r['text'][:80]}")
