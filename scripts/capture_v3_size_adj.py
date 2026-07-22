from playwright.sync_api import sync_playwright
import os, json

URLS = {
    "bayhollow": "https://studio.taxdrop.com/test/evidence-pack-v3?address=2915+Bay+Hollow+Ct%2C+Katy%2C+TX+77450",
    "lavista":   "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206",
}
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, url in URLS.items():
        ctx = browser.new_context(viewport={"width": 1600, "height": 1000})
        page = ctx.new_page()
        page.goto(url, wait_until="networkidle", timeout=120000)
        page.wait_for_timeout(4000)

        page.screenshot(path=os.path.join(OUT_DIR, f"size_adj_{name}_full.png"), full_page=True)

        body_text = page.evaluate("() => document.body.innerText")
        with open(os.path.join(OUT_DIR, f"size_adj_{name}_body.txt"), "w") as f:
            f.write(body_text)

        # Extract every table row keyed by leading label so we can grep size-adj rows
        rows = page.evaluate(r"""
            () => {
                const out = [];
                document.querySelectorAll('tr').forEach(tr => {
                    const cells = Array.from(tr.querySelectorAll('th,td')).map(c => (c.innerText||'').trim());
                    if (cells.length) out.push(cells);
                });
                return out;
            }
        """)
        with open(os.path.join(OUT_DIR, f"size_adj_{name}_rows.json"), "w") as f:
            json.dump(rows, f, indent=2)

        ctx.close()
    browser.close()

print("Done")
