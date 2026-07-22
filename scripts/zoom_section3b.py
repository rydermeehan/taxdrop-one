"""Capture section 3 grid by direct clip on the second BUILDING CHARACTERISTICS bar."""
from playwright.sync_api import sync_playwright

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 2400}, device_scale_factor=2)
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(2500)

    # Iterate all BUILDING CHARACTERISTICS to find the bar (second occurrence)
    locs = page.get_by_text("BUILDING CHARACTERISTICS", exact=False).all()
    bar = locs[1]
    bar.scroll_into_view_if_needed()
    page.wait_for_timeout(400)
    bbox = bar.bounding_box()
    print("BC bbox after scroll:", bbox)

    # Capture clip around the whole comp grid (~1100px tall)
    clip = {
        "x": max(0, bbox["x"] - 40),
        "y": max(0, bbox["y"] - 220),
        "width": min(1400, 1100),
        "height": 1300,
    }
    page.screenshot(path=f"{OUT}/v3_4changes_section3_grid2.png", clip=clip)

    # Tight clips of each subsection bar
    for label in ["BUILDING CHARACTERISTICS", "2026 MARKET VALUES", "ADJUSTMENTS", "TOTALS", "DERIVATION", "INDICATOR"]:
        ls = page.get_by_text(label, exact=False).all()
        for i, l in enumerate(ls):
            try:
                bb = l.bounding_box()
                if not bb: continue
                # only consider bar-like full-row spans (w > 800)
                if bb["width"] < 800: continue
                l.scroll_into_view_if_needed()
                page.wait_for_timeout(200)
                bb2 = l.bounding_box()
                clip = {"x": max(0, bb2["x"] - 20), "y": max(0, bb2["y"] - 6), "width": min(1400, bb2["width"] + 40), "height": bb2["height"] + 12}
                fname = f"{OUT}/v3_4changes_bar_{label.replace(' ', '_')}_{i}.png"
                page.screenshot(path=fname, clip=clip)
                print(f"saved {fname} bb={bb2}")
            except Exception as e:
                print("bar capture err:", label, e)

    browser.close()
