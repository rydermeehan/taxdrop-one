"""Capture Section 5 (Adjustment Methodology) under print media emulation."""
from playwright.sync_api import sync_playwright
import sys

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots/v3_section5_print.png"
OUT_FULL = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots/v3_section5_print_fullpage.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    # Use a standard "letter" portrait-ish viewport so print layout reflects ~816px width.
    context = browser.new_context(viewport={"width": 816, "height": 1056})
    page = context.new_page()
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.emulate_media(media="print")
    # Give print styles a moment to settle.
    page.wait_for_timeout(1500)

    # Find the h2 with "Adjustment Methodology"
    h2 = page.locator('h2', has_text='Adjustment Methodology').first
    h2.wait_for(timeout=10000)
    h2.scroll_into_view_if_needed()
    page.wait_for_timeout(300)

    # Capture the entire section: try to find an enclosing <section> ancestor, else
    # capture h2 + its following table by bounding box.
    section_handle = h2.evaluate_handle(
        """el => {
            let n = el;
            while (n && n.tagName && n.tagName.toLowerCase() !== 'section') n = n.parentElement;
            return n || el.parentElement;
        }"""
    )
    section_el = section_handle.as_element()
    if section_el:
        box = section_el.bounding_box()
        print(f"Section bounding box: {box}", flush=True)
        section_el.screenshot(path=OUT)
    else:
        h2.screenshot(path=OUT)

    # Also dump a full-page (print) screenshot for context.
    page.screenshot(path=OUT_FULL, full_page=True)

    # Extract a quick text/structure dump of the table for sanity checking.
    table_locator = page.locator('h2:has-text("Adjustment Methodology")').first.locator(
        'xpath=following::table[1]'
    )
    try:
        table_html = table_locator.evaluate("el => el.outerHTML")
    except Exception as e:
        table_html = f"<no table found: {e}>"

    # Measure column widths
    try:
        col_widths = table_locator.evaluate(
            """t => {
                const firstRow = t.querySelector('tbody tr') || t.querySelector('tr');
                if (!firstRow) return null;
                const cells = Array.from(firstRow.children);
                const totalW = t.getBoundingClientRect().width;
                return {
                    totalW,
                    cells: cells.map(c => ({
                        text: c.innerText.slice(0, 80),
                        width: c.getBoundingClientRect().width,
                        pct: (c.getBoundingClientRect().width / totalW) * 100,
                        clientHeight: c.clientHeight,
                    }))
                };
            }"""
        )
        print("COL WIDTHS:", col_widths, flush=True)
    except Exception as e:
        print(f"col width measurement failed: {e}", flush=True)

    with open("/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots/v3_section5_table.html", "w") as f:
        f.write(table_html)

    browser.close()
    print(f"Saved {OUT}", flush=True)
    print(f"Saved {OUT_FULL}", flush=True)
