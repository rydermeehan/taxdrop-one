from playwright.sync_api import sync_playwright
import os

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 2200}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(URL, wait_until='networkidle', timeout=90000)
    page.wait_for_timeout(3000)

    # Full page
    page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_floor_full.png"), full_page=True)

    # Try to capture textual content of relevant sections for analysis
    body_text = page.evaluate("() => document.body.innerText")
    with open(os.path.join(OUT_DIR, "lavista_v3_floor_text.txt"), "w") as f:
        f.write(body_text)

    # Try locating Section 2 and Section 4 by headings
    for label in ["Section 2", "Section 3", "Section 4", "Requested Market Value", "Market-factor", "Floor", "Median adjusted", "Difference vs notice"]:
        try:
            loc = page.get_by_text(label, exact=False).first
            if loc and loc.count() > 0:
                box = loc.bounding_box()
                print(f"{label}: {box}")
        except Exception as e:
            print(f"{label}: err {e}")

    browser.close()
print("done")
