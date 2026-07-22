"""Tight capture of just the Adjustment Methodology h2 + following table."""
from playwright.sync_api import sync_playwright

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots/v3_section5_tight.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={"width": 900, "height": 1200}, device_scale_factor=2)
    page = context.new_page()
    page.goto(URL, wait_until="networkidle", timeout=60000)
    page.emulate_media(media="print")
    page.wait_for_timeout(1500)

    # Get bounding box of the h2 and the following table; clip a screenshot around them.
    rect = page.evaluate(
        """() => {
            const hs = Array.from(document.querySelectorAll('h2'));
            const h2 = hs.find(h => /Adjustment Methodology/i.test(h.textContent));
            if (!h2) return null;
            // Find the next table after the h2 in document order
            const all = document.body.querySelectorAll('*');
            let after = false;
            let table = null;
            for (const el of all) {
                if (el === h2) { after = true; continue; }
                if (after && el.tagName === 'TABLE') { table = el; break; }
            }
            if (!table) return null;
            const a = h2.getBoundingClientRect();
            const b = table.getBoundingClientRect();
            return {
                x: Math.min(a.left, b.left) + window.scrollX,
                y: Math.min(a.top, b.top) + window.scrollY,
                right: Math.max(a.right, b.right) + window.scrollX,
                bottom: Math.max(a.bottom, b.bottom) + window.scrollY,
                tableTop: b.top + window.scrollY,
                tableHeight: b.height,
            };
        }"""
    )
    print("rect:", rect, flush=True)

    # Scroll to position and capture clip
    page.evaluate(f"window.scrollTo(0, {max(0, rect['y'] - 20)})")
    page.wait_for_timeout(300)

    # After scrolling, recompute relative-to-viewport coords
    clip = page.evaluate(
        """() => {
            const hs = Array.from(document.querySelectorAll('h2'));
            const h2 = hs.find(h => /Adjustment Methodology/i.test(h.textContent));
            const all = document.body.querySelectorAll('*');
            let after = false;
            let table = null;
            for (const el of all) {
                if (el === h2) { after = true; continue; }
                if (after && el.tagName === 'TABLE') { table = el; break; }
            }
            const a = h2.getBoundingClientRect();
            const b = table.getBoundingClientRect();
            const left = Math.max(0, Math.min(a.left, b.left) - 10);
            const top = Math.max(0, a.top - 10);
            const right = Math.max(a.right, b.right) + 10;
            const bottom = b.bottom + 10;
            return { x: left, y: top, width: right - left, height: bottom - top };
        }"""
    )
    print("clip:", clip, flush=True)

    # The clip height may be larger than viewport; expand viewport first.
    needed_height = int(clip['y'] + clip['height'] + 50)
    if needed_height > 1200:
        page.set_viewport_size({"width": 900, "height": min(needed_height, 8000)})
        page.wait_for_timeout(300)
        clip = page.evaluate(
            """() => {
                const hs = Array.from(document.querySelectorAll('h2'));
                const h2 = hs.find(h => /Adjustment Methodology/i.test(h.textContent));
                const all = document.body.querySelectorAll('*');
                let after = false; let table = null;
                for (const el of all) {
                    if (el === h2) { after = true; continue; }
                    if (after && el.tagName === 'TABLE') { table = el; break; }
                }
                const a = h2.getBoundingClientRect();
                const b = table.getBoundingClientRect();
                const left = Math.max(0, Math.min(a.left, b.left) - 10);
                const top = Math.max(0, a.top - 10);
                const right = Math.max(a.right, b.right) + 10;
                const bottom = b.bottom + 10;
                return { x: left, y: top, width: right - left, height: bottom - top };
            }"""
        )
        print("clip (after resize):", clip, flush=True)

    page.screenshot(path=OUT, clip=clip)
    print(f"Saved {OUT}", flush=True)

    browser.close()
