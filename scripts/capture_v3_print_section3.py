from playwright.sync_api import sync_playwright
import json

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 816, "height": 1056})
    page = ctx.new_page()
    page.emulate_media(media="print")
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(2500)

    # Find section 3 bounds and section 4 start
    info = page.evaluate("""() => {
        const all = Array.from(document.querySelectorAll('*'));
        function find(prefix){ return all.find(e => (e.innerText||'').trim().startsWith(prefix)); }
        const s3 = find('3. Comparable');
        const s4 = find('4. Analysis');
        const s3r = s3 ? s3.getBoundingClientRect() : null;
        const s4r = s4 ? s4.getBoundingClientRect() : null;
        return {
            s3Top: s3r ? s3r.top + window.scrollY : null,
            s4Top: s4r ? s4r.top + window.scrollY : null,
            scrollHeight: document.body.scrollHeight,
            viewportH: window.innerHeight,
        };
    }""")
    print(json.dumps(info,indent=2))
    pageH = 1056  # US Letter at 96dpi
    if info['s3Top'] is not None and info['s4Top'] is not None:
        s3_start_page = info['s3Top'] // pageH
        s3_end_page = (info['s4Top']-1) // pageH
        print(f"Section 3 starts on page {int(s3_start_page)+1}, ends on page {int(s3_end_page)+1}")
        print(f"Section 3 spans pages: {int(s3_end_page - s3_start_page + 1)}")

    page.screenshot(path=f"{OUT}/v3_round_print_full.png", full_page=True)
    browser.close()
