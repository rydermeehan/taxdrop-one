"""Zoom into Section 3 subsection bars to inspect alignment."""
from playwright.sync_api import sync_playwright

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 2400})
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(2500)

    # Find the comp grid table
    rows = page.locator("text=BUILDING CHARACTERISTICS").all()
    print(f"found {len(rows)} matches for BUILDING CHARACTERISTICS")
    if rows:
        try:
            rows[0].scroll_into_view_if_needed()
            page.wait_for_timeout(400)
        except Exception as e:
            print(e)

    # Also locate other subsection bars
    for label in ["BUILDING CHARACTERISTICS", "2026 MARKET VALUES", "ADJUSTMENTS", "TOTALS", "DERIVATION", "INDICATOR"]:
        locs = page.get_by_text(label, exact=False).all()
        for i, l in enumerate(locs):
            try:
                box = l.bounding_box()
                if box:
                    print(f"{label} [{i}] -> x={box['x']:.0f} y={box['y']:.0f} w={box['width']:.0f} h={box['height']:.0f}")
            except Exception:
                pass

    # Take a tall screenshot to capture section 3
    page.screenshot(path=f"{OUT}/v3_4changes_section3_zoom.png", full_page=True, clip=None)

    # Try clipping to the comp grid area
    bc = page.get_by_text("BUILDING CHARACTERISTICS", exact=False).first
    try:
        bbox = bc.bounding_box()
        if bbox:
            clip = {
                "x": max(0, bbox["x"] - 40),
                "y": max(0, bbox["y"] - 80),
                "width": 1400,
                "height": 1200,
            }
            page.screenshot(path=f"{OUT}/v3_4changes_section3_compgrid.png", clip=clip)
            print("compgrid clip captured")
    except Exception as e:
        print("clip failed", e)

    browser.close()
