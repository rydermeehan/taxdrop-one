"""Verify 4 v3 evidence-pack changes for 5749 La Vista Ct."""
from playwright.sync_api import sync_playwright
import re

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()

    # Regular (screen) capture
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{OUT}/v3_4changes_screen_full.png", full_page=True)

    # Targeted sections
    body_text = page.inner_text("body")
    with open(f"{OUT}/v3_4changes_body.txt", "w") as f:
        f.write(body_text)

    # Section captures by heading proximity
    for sel_name in ["Section 2", "Section 3", "Section 4"]:
        try:
            loc = page.get_by_text(sel_name, exact=False).first
            loc.scroll_into_view_if_needed()
            page.wait_for_timeout(400)
            page.screenshot(path=f"{OUT}/v3_4changes_{sel_name.replace(' ', '_')}.png", full_page=False)
        except Exception as e:
            print(f"could not capture {sel_name}: {e}")

    ctx.close()

    # Print emulation capture
    ctx2 = browser.new_context(viewport={"width": 1100, "height": 1400})
    page2 = ctx2.new_page()
    page2.goto(URL, wait_until="networkidle", timeout=90000)
    page2.emulate_media(media="print")
    page2.wait_for_timeout(1500)
    page2.screenshot(path=f"{OUT}/v3_4changes_print_full.png", full_page=True)
    ctx2.close()

    browser.close()

print("done")
