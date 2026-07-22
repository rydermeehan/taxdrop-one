from playwright.sync_api import sync_playwright
import os

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 1100})
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(5000)

    # Exclusion callout - search for "excluded from the panel"
    try:
        el = page.get_by_text("excluded from the panel", exact=False).first
        el.scroll_into_view_if_needed(timeout=5000)
        page.wait_for_timeout(800)
        # Add some scroll buffer
        page.evaluate("window.scrollBy(0, -100)")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_exclusion.png"), full_page=False)
    except Exception as e:
        print(f"exclusion: {e}")

    # Map - look for "Pin numbers"
    try:
        el = page.get_by_text("Pin numbers", exact=False).first
        el.scroll_into_view_if_needed(timeout=5000)
        page.wait_for_timeout(800)
        page.evaluate("window.scrollBy(0, -400)")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_map.png"), full_page=False)
    except Exception as e:
        print(f"map: {e}")

    # Effective year built row
    try:
        el = page.get_by_text("Effective year built", exact=False).first
        el.scroll_into_view_if_needed(timeout=5000)
        page.wait_for_timeout(800)
        page.evaluate("window.scrollBy(0, -200)")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_eff_year.png"), full_page=False)
    except Exception as e:
        print(f"eff year: {e}")

    # Section 2 - Requested value
    try:
        el = page.get_by_text("Owner's Requested", exact=False).first
        el.scroll_into_view_if_needed(timeout=5000)
        page.wait_for_timeout(800)
        page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_section2.png"), full_page=False)
    except Exception as e:
        print(f"sec2: {e}")

    # Section 4 - Analysis
    try:
        el = page.get_by_text("4. Analysis", exact=False).first
        el.scroll_into_view_if_needed(timeout=5000)
        page.wait_for_timeout(800)
        page.screenshot(path=os.path.join(OUT_DIR, "lavista_v3_section4.png"), full_page=False)
    except Exception as e:
        print(f"sec4: {e}")

    browser.close()

print("Done")
