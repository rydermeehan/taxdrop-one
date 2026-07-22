from playwright.sync_api import sync_playwright
import os

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(URL, wait_until='networkidle', timeout=90000)
    page.wait_for_timeout(3000)

    # Section 2 clip
    page.evaluate("window.scrollTo(0, 900)")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_floor_section2.png"), clip={'x': 0, 'y': 0, 'width': 1440, 'height': 600})

    # Section 4 clip — scroll to ~2700
    page.evaluate("window.scrollTo(0, 2700)")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_floor_section4.png"), clip={'x': 0, 'y': 0, 'width': 1440, 'height': 900})

    # Section 3 footer — median display, scroll to ~2300
    page.evaluate("window.scrollTo(0, 2200)")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_floor_section3footer.png"), clip={'x': 0, 'y': 400, 'width': 1440, 'height': 500})

    browser.close()
print("done")
