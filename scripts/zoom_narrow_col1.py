"""Zoom in on Section 3 column 1 to visually verify wrapping."""
from playwright.sync_api import sync_playwright
import os

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=2420+Holsten+Hill+Dr%2C+Pflugerville%2C+TX+78660"
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"


def shoot(media, suffix, vw=1280):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": vw, "height": 1000}, device_scale_factor=2)
        page = ctx.new_page()
        if media == "print":
            page.emulate_media(media="print")
        page.goto(URL, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(2000)

        # Find section 3 table bbox
        bbox = page.evaluate(r"""
          () => {
            const headers = Array.from(document.querySelectorAll('h1,h2,h3,h4'));
            const sec3 = headers.find(h => /section\s*3/i.test(h.textContent) || /comparable/i.test(h.textContent));
            if (!sec3) return null;
            // Find next table after this heading
            const allTables = Array.from(document.querySelectorAll('table'));
            const top = sec3.getBoundingClientRect().top + window.scrollY;
            const tbl = allTables.find(t => (t.getBoundingClientRect().top + window.scrollY) > top);
            if (!tbl) return null;
            tbl.scrollIntoView({block:'start'});
            const r = tbl.getBoundingClientRect();
            return {x:r.x, y:r.y + window.scrollY, w:r.width, h:r.height, scrollY: window.scrollY};
          }
        """)
        if not bbox:
            print("no table"); browser.close(); return
        # scroll so top of table is near top of viewport
        page.evaluate(f"window.scrollTo(0, {max(0, bbox['y']-40)})")
        page.wait_for_timeout(400)
        # full table screenshot via clip
        rect_now = page.evaluate(r"""
          () => {
            const allTables = Array.from(document.querySelectorAll('table'));
            const headers = Array.from(document.querySelectorAll('h1,h2,h3,h4'));
            const sec3 = headers.find(h => /section\s*3/i.test(h.textContent) || /comparable/i.test(h.textContent));
            const top = sec3.getBoundingClientRect().top + window.scrollY;
            const tbl = allTables.find(t => (t.getBoundingClientRect().top + window.scrollY) > top);
            const r = tbl.getBoundingClientRect();
            return {x:r.x, y:r.y, w:r.width, h:r.height};
          }
        """)
        # Cap height so we don't blow up image dims
        clip_h = min(rect_now['h'], 1400)
        page.screenshot(
            path=f"{OUT_DIR}/v3_narrow_{suffix}_table_zoom.png",
            clip={"x": max(0, rect_now['x']-10), "y": max(0, rect_now['y']-10),
                  "width": rect_now['w']+20, "height": clip_h+20}
        )
        # Also a leftmost-column-only zoom
        page.screenshot(
            path=f"{OUT_DIR}/v3_narrow_{suffix}_col1_zoom.png",
            clip={"x": max(0, rect_now['x']-5), "y": max(0, rect_now['y']-5),
                  "width": 260, "height": clip_h+10}
        )
        browser.close()


shoot("screen", "screen", 1280)
shoot("print", "print", 1280)
print("done")
