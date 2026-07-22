from playwright.sync_api import sync_playwright
import os, json

URLS = {
    "holsten": "https://studio.taxdrop.com/test/evidence-pack-v3?address=2420+Holsten+Hill+Dr%2C+Pflugerville%2C+TX+78660%2C+USA",
    "lavista": "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206",
}
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, url in URLS.items():
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.goto(url, wait_until="networkidle", timeout=90000)
        page.wait_for_timeout(3500)

        diag = page.evaluate(r"""
            () => {
                const result = {tables: []};
                document.querySelectorAll('table').forEach((tbl, idx) => {
                    const rows = [];
                    tbl.querySelectorAll('tr').forEach(tr => {
                        const cells = Array.from(tr.querySelectorAll('th,td')).map(c => {
                            const s = window.getComputedStyle(c);
                            return {
                                tag: c.tagName,
                                text: (c.innerText || '').trim().slice(0,160),
                                textAlign: s.textAlign,
                                color: s.color,
                                bg: s.backgroundColor,
                                fontWeight: s.fontWeight,
                                fontSize: s.fontSize,
                                bt: s.borderTopWidth + ' ' + s.borderTopStyle + ' ' + s.borderTopColor,
                                bb: s.borderBottomWidth + ' ' + s.borderBottomStyle + ' ' + s.borderBottomColor
                            };
                        });
                        if (cells.length) rows.push(cells);
                    });
                    result.tables.push({idx, rows});
                });
                return result;
            }
        """)
        with open(os.path.join(OUT_DIR, f"v3_styles_{name}.json"), "w") as f:
            json.dump(diag, f, indent=2)

        # Also crop a Section 3 screenshot for visual review
        try:
            # find first table with INDICATOR header text via locator
            tables = page.locator('table')
            count = tables.count()
            for i in range(count):
                t = tables.nth(i)
                txt = t.inner_text()
                if 'INDICATOR' in txt or 'Adjusted $/SF' in txt:
                    t.screenshot(path=os.path.join(OUT_DIR, f"v3_section3_{name}.png"))
                    break
        except Exception as e:
            print('crop error', e)

        ctx.close()
    browser.close()

print("Done styles")
