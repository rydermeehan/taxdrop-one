from playwright.sync_api import sync_playwright
import sys, json, re

URL = "https://studio.taxdrop.com/test/evidence-pack-v2.html?address=2915%20Bay%20Hollow%20Ct&zip=77450"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=90000)
    # give time for any JS-built tables to populate
    try:
        page.wait_for_timeout(3000)
    except Exception:
        pass

    # Full page screenshot to capture all sections
    page.screenshot(path="/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots/bayhollow_full.png", full_page=True)

    # Try to find Section 3 specifically and screenshot it
    # Look for headings mentioning '2026 Appraisal' or 'Section 3'
    section_info = page.evaluate("""
    () => {
        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4'));
        const out = headings.map(h => ({tag: h.tagName, text: h.innerText.trim().slice(0,150)}));
        return out;
    }
    """)
    print("HEADINGS:", json.dumps(section_info, indent=2))

    # Find the Section 3 table by searching for the heading text
    table_rows = page.evaluate("""
    () => {
        // Find heading that includes '2026 Appraisal'
        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4'));
        let target = null;
        for (const h of headings) {
            if (/2026\\s*Appraisal/i.test(h.innerText)) { target = h; break; }
        }
        if (!target) return {error: 'Section 3 heading not found'};

        // Find next table after this heading
        let el = target;
        let table = null;
        while (el && el.nextElementSibling) {
            el = el.nextElementSibling;
            const t = el.querySelector ? el.querySelector('table') : null;
            if (el.tagName === 'TABLE') { table = el; break; }
            if (t) { table = t; break; }
        }
        if (!table) {
            // fallback: any table that contains 'Noticed improvement value'
            const tables = Array.from(document.querySelectorAll('table'));
            for (const t of tables) {
                if (/Noticed improvement value/i.test(t.innerText)) { table = t; break; }
            }
        }
        if (!table) return {error: 'No table found'};

        const rows = Array.from(table.querySelectorAll('tr'));
        const data = rows.map(r => {
            const cells = Array.from(r.querySelectorAll('th,td')).map(c => c.innerText.trim().replace(/\\s+/g,' '));
            return cells;
        });
        const rect = table.getBoundingClientRect();
        return {rows: data, rect: {x: rect.x, y: rect.y, w: rect.width, h: rect.height}, scrollY: window.scrollY};
    }
    """)
    print("TABLE_DATA:", json.dumps(table_rows, indent=2)[:8000])

    if isinstance(table_rows, dict) and "rect" in table_rows:
        # Scroll the table into view and screenshot just it
        page.evaluate("""(r) => {
            const tables = Array.from(document.querySelectorAll('table'));
            for (const t of tables) {
                if (/Noticed improvement value/i.test(t.innerText)) {
                    t.scrollIntoView({block:'start'});
                    return true;
                }
            }
            return false;
        }""", table_rows["rect"])
        page.wait_for_timeout(500)
        # Locator-based screenshot
        loc = page.locator("table:has-text('Noticed improvement value')").first
        try:
            loc.screenshot(path="/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots/bayhollow_section3_table.png")
        except Exception as e:
            print("Locator screenshot failed:", e)

    browser.close()
print("done")
