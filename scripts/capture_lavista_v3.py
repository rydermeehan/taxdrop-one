from playwright.sync_api import sync_playwright
import os

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(4000)
    # Full page
    page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_full.png"), full_page=True)
    # Viewport (top)
    page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_top.png"), full_page=False)

    body_text = page.evaluate("() => document.body.innerText")
    with open(os.path.join(OUT_DIR, "lavista_v3_body.txt"), "w") as f:
        f.write(body_text)

    # Try to screenshot specific sections by scrolling to headings
    try:
        for label in ["Section 2", "Section 3", "Section 4", "Comparable", "Requested", "Exclusion", "Effective year"]:
            try:
                el = page.get_by_text(label, exact=False).first
                el.scroll_into_view_if_needed(timeout=3000)
                page.wait_for_timeout(500)
                page.screenshot(path=os.path.join(OUT_DIR, f"lavista_v3_{label.replace(' ', '_')}.png"), full_page=False)
            except Exception as e:
                print(f"Could not capture {label}: {e}")
    except Exception as e:
        print(f"Section capture error: {e}")

    browser.close()

print("Done")
