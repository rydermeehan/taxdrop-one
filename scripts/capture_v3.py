from playwright.sync_api import sync_playwright
import os

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=2915%20Bay%20Hollow%20Ct&zip=77450"
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(2500)
    # Full page
    page.screenshot(path=os.path.join(OUT_DIR, "v3_full.png"), full_page=True)
    # Viewport (top)
    page.screenshot(path=os.path.join(OUT_DIR, "v3_top.png"), full_page=False)

    # Extract DOM text by section for verification
    body_text = page.evaluate("() => document.body.innerText")
    with open(os.path.join(OUT_DIR, "v3_body.txt"), "w") as f:
        f.write(body_text)

    # Try to grab section 3 row labels in order - assume comp grid table-like rows
    rows = page.evaluate("""
        () => {
            const rows = [];
            // collect anything that looks like a label cell in Section 3
            document.querySelectorAll('section, div').forEach(el => {
                const h = el.querySelector && el.querySelector('h2,h3');
                if (h && /comparable property analysis/i.test(h.innerText)) {
                    el.querySelectorAll('th, td:first-child, .row-label, [class*="label"]').forEach(c => {
                        const t = (c.innerText || '').trim();
                        if (t && t.length < 120) rows.push(t);
                    });
                }
            });
            return rows;
        }
    """)
    with open(os.path.join(OUT_DIR, "v3_section3_rows.txt"), "w") as f:
        f.write("\n".join(rows))

    browser.close()

print("Done")
