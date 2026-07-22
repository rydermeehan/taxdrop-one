from playwright.sync_api import sync_playwright
import os

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()

    # Screen mode (desktop)
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{OUT}/v3_round_screen.png", full_page=True)

    # Capture body text + element diagnostics
    body_text = page.evaluate("() => document.body.innerText")
    with open(f"{OUT}/v3_round_body.txt", "w") as f:
        f.write(body_text)

    # Element-level diagnostics
    diag = page.evaluate("""() => {
        function txt(sel){ const el = document.querySelector(sel); return el ? el.innerText : null; }
        function all(sel){ return Array.from(document.querySelectorAll(sel)).map(e=>({text:e.innerText, align: getComputedStyle(e).textAlign})); }
        return {
            hasYoYGridItem: !!Array.from(document.querySelectorAll('*')).find(e=> e.children.length===0 && /Year-over-year change/i.test(e.innerText||'')),
            bodyHasYoYText: /\\+\\$87,930 \\(22\\.53% YoY\\)/.test(document.body.innerText),
            bodyHasSqftDecimal: /\\$\\d+\\.\\d{2}\\/sqft/.test(document.body.innerText),
            bodyHasSqftNoDecimal: /\\$\\d+\\/sqft/.test(document.body.innerText),
            bodyHasPercentOfNotice: /% of CAD notice/i.test(document.body.innerText),
            bodyHasExclusion: /comparable excluded/i.test(document.body.innerText),
            bodyHasFiveSubjectExcerpt: /5821 La Vista/i.test(document.body.innerText),
            bodyHasMedianAdjusted: /Median adjusted value of comps/i.test(document.body.innerText),
            bodyHasMedianPerSF: /Median adjusted value \\(\\$\\/SF/i.test(document.body.innerText),
            bodyHasMethodologyParagraph: /Adjustments shown in Section 3 are based on/i.test(document.body.innerText),
            bodyHasAdjMagnitudeTable: /MAGNITUDE/.test(document.body.innerText) && /WHAT IT CORRECTS FOR/i.test(document.body.innerText),
            requestValue: (document.body.innerText.match(/\\$464,963/g)||[]).length,
        };
    }""")
    import json
    with open(f"{OUT}/v3_round_diag.json","w") as f:
        json.dump(diag, f, indent=2)

    # Print media emulation
    page2 = ctx.new_page()
    page2.emulate_media(media="print")
    # US Letter at 96dpi-ish, common print width
    page2.set_viewport_size({"width": 816, "height": 1056})
    page2.goto(URL, wait_until="networkidle", timeout=90000)
    page2.wait_for_timeout(2500)
    page2.screenshot(path=f"{OUT}/v3_round_print.png", full_page=True)

    browser.close()
print("DONE")
print(diag)
