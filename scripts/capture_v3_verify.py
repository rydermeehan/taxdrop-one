from playwright.sync_api import sync_playwright
import os, json

URLS = {
    "holsten": "https://studio.taxdrop.com/test/evidence-pack-v3?address=2420+Holsten+Hill+Dr%2C+Pflugerville%2C+TX+78660%2C+USA",
    "lavista": "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206",
}
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, url in URLS.items():
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        page = ctx.new_page()
        page.goto(url, wait_until="networkidle", timeout=90000)
        page.wait_for_timeout(3500)

        # Full-page
        page.screenshot(path=os.path.join(OUT_DIR, f"v3_verify_{name}_full.png"), full_page=True)

        # Body text
        body_text = page.evaluate("() => document.body.innerText")
        with open(os.path.join(OUT_DIR, f"v3_verify_{name}_body.txt"), "w") as f:
            f.write(body_text)

        # Capture detailed Section 1 + Section 3 + Section 4 markup
        diagnostic = page.evaluate(r"""
            () => {
                const out = {section1: [], section3_rows: [], section3_html: '', section4_text: '', methodology_snippet: ''};

                // Section 1 — property identifiers
                document.querySelectorAll('section, div').forEach(el => {
                    const h = el.querySelector && el.querySelector('h1,h2,h3');
                    if (h && /subject property|property summary|section\s*1/i.test(h.innerText)) {
                        out.section1.push(el.innerText.slice(0, 800));
                    }
                });

                // Section 3 — comparable analysis table
                document.querySelectorAll('section, div').forEach(el => {
                    const h = el.querySelector && el.querySelector('h1,h2,h3');
                    if (h && /comparable property analysis|comparable analysis|comp grid|section\s*3/i.test(h.innerText)) {
                        out.section3_html = el.outerHTML.slice(0, 50000);
                        el.querySelectorAll('tr').forEach(tr => {
                            const cells = Array.from(tr.querySelectorAll('th,td')).map(c => {
                                const style = window.getComputedStyle(c);
                                return {
                                    text: (c.innerText || '').trim().slice(0,200),
                                    textAlign: style.textAlign,
                                    color: style.color,
                                    background: style.backgroundColor,
                                    fontWeight: style.fontWeight,
                                    borderTop: style.borderTopWidth + ' ' + style.borderTopStyle + ' ' + style.borderTopColor,
                                    borderBottom: style.borderBottomWidth + ' ' + style.borderBottomStyle + ' ' + style.borderBottomColor,
                                    fontSize: style.fontSize
                                };
                            });
                            if (cells.length) out.section3_rows.push(cells);
                        });
                    }
                });

                // Section 4 — methodology / narrative
                document.querySelectorAll('section, div').forEach(el => {
                    const h = el.querySelector && el.querySelector('h1,h2,h3');
                    if (h && /methodology|valuation methodology|section\s*4|valuation approach/i.test(h.innerText)) {
                        out.section4_text = (el.innerText || '').slice(0, 4000);
                    }
                });

                // Search full body for "lowest" / "2nd-lowest" mentions
                const full = document.body.innerText;
                const matches = [];
                const re = /(2nd[- ]lowest|second[- ]lowest|lowest)[^\n]{0,200}/gi;
                let m;
                while ((m = re.exec(full)) !== null) matches.push(m[0]);
                out.methodology_snippet = matches.join('\n---\n');

                return out;
            }
        """)
        with open(os.path.join(OUT_DIR, f"v3_verify_{name}_diag.json"), "w") as f:
            json.dump(diagnostic, f, indent=2)

        ctx.close()
    browser.close()

print("Done")
