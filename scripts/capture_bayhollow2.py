from playwright.sync_api import sync_playwright
import json, urllib.parse

# Use the test page but fill the input with a fully-qualified address and click Generate.
URL = "https://studio.taxdrop.com/test/evidence-pack-v2.html"
FULL_ADDR = "2915 Bay Hollow Ct, Katy, TX 77450"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1920, "height": 1400})
    page = ctx.new_page()
    page.on("console", lambda msg: print("CONSOLE:", msg.type, msg.text[:200]))
    page.goto(URL, wait_until="networkidle", timeout=90000)

    # Fill the address input and click Generate
    page.fill("input[type=text], input", FULL_ADDR)
    page.click("button:has-text('Generate')")

    # Wait for the report to render — look for Section 3 heading or any table with 'Noticed improvement value'
    try:
        page.wait_for_selector("table:has-text('Noticed improvement value')", timeout=60000)
    except Exception as e:
        print("Wait for table failed:", e)

    page.wait_for_timeout(2500)
    page.screenshot(path="/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots/bayhollow_full2.png", full_page=True)

    # Extract all rows from the Section 3 comparable table
    data = page.evaluate("""
    () => {
        const tables = Array.from(document.querySelectorAll('table'));
        const out = [];
        for (const t of tables) {
            if (/Noticed improvement value/i.test(t.innerText)) {
                const rows = Array.from(t.querySelectorAll('tr')).map(r =>
                    Array.from(r.querySelectorAll('th,td')).map(c => c.innerText.trim().replace(/\\s+/g,' '))
                );
                out.push(rows);
            }
        }
        // Also collect headings to find section 3 title
        const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4')).map(h=>h.innerText.trim());
        return {tables: out, headings};
    }
    """)
    print("HEADINGS:", json.dumps(data["headings"], indent=2))
    for i, tbl in enumerate(data["tables"]):
        print(f"=== TABLE {i} ({len(tbl)} rows) ===")
        for row in tbl:
            print(" | ".join(row))

    # Try to screenshot just the comparable table
    try:
        loc = page.locator("table:has-text('Noticed improvement value')").first
        loc.scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        loc.screenshot(path="/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots/bayhollow_section3_table.png")
    except Exception as e:
        print("Locator screenshot failed:", e)

    browser.close()
print("done")
