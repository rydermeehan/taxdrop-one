from playwright.sync_api import sync_playwright
import os, json

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 2000})
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(2500)

    # Section 3 table screenshot
    section3 = page.query_selector("text=3. Comparable Property Analysis")
    if section3:
        # find ancestor section
        page.evaluate("""() => {
            const headers = Array.from(document.querySelectorAll('*')).filter(e => /^3\\. Comparable/.test((e.innerText||'').trim()));
            if(headers.length){ headers[0].scrollIntoView(); }
        }""")
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/v3_round_section3_zoom.png", full_page=False, clip={"x":0,"y":0,"width":1440,"height":1800})

    # Diagnostics: column header alignment, row label widths/wrap, footer rows
    diag = page.evaluate("""() => {
        function findEl(text){
            return Array.from(document.querySelectorAll('*')).find(e => e.children.length===0 && (e.innerText||'').trim()===text);
        }
        const subjectHeader = findEl('SUBJECT');
        const comp1Header = findEl('COMP #1');
        const subjAlign = subjectHeader ? getComputedStyle(subjectHeader).textAlign : null;
        const comp1Align = comp1Header ? getComputedStyle(comp1Header).textAlign : null;
        const subjParentAlign = subjectHeader ? getComputedStyle(subjectHeader.parentElement).textAlign : null;

        const labels = ['Improvement value','Improvement $/SF','CAD market $/SF','Additional (pools, garages, misc.)'];
        const labelData = labels.map(l => {
            const el = findEl(l);
            if(!el) return {label:l, found:false};
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            const parentR = el.parentElement.getBoundingClientRect();
            // count lines via clientHeight / lineHeight
            const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize)*1.2;
            const lines = Math.round(r.height / lineHeight);
            return {label:l, found:true, whiteSpace: cs.whiteSpace, width:r.width, height:r.height, lines, parentWidth:parentR.width};
        });

        // Footer row check
        const hasMedianValueRow = /Median adjusted value of comps/.test(document.body.innerText);
        const hasMedianSFRow = /Median adjusted value \\(\\$\\/SF/i.test(document.body.innerText);

        // YoY layout: is YoY text in same cell/parent as $390,300?
        const prior = Array.from(document.querySelectorAll('*')).find(e => e.children.length===0 && /^\\$390,300$/.test((e.innerText||'').trim()));
        const yoy = Array.from(document.querySelectorAll('*')).find(e => e.children.length===0 && /\\+\\$87,930 \\(22\\.53% YoY\\)/.test(e.innerText||''));
        let yoyInSameCell = false;
        if(prior && yoy){
            // check if they share an ancestor that is a grid cell
            yoyInSameCell = prior.parentElement === yoy.parentElement || prior.parentElement.contains(yoy);
        }
        const yoyFontSize = yoy ? getComputedStyle(yoy).fontSize : null;
        const yoyColor = yoy ? getComputedStyle(yoy).color : null;

        return {
            subjAlign, comp1Align, subjParentAlign,
            labelData,
            hasMedianValueRow, hasMedianSFRow,
            yoyInSameCell, yoyFontSize, yoyColor,
            priorFound: !!prior, yoyFound: !!yoy,
            priorParentHTML: prior ? prior.parentElement.outerHTML.slice(0,500) : null,
        };
    }""")
    with open(f"{OUT}/v3_round_zoom_diag.json","w") as f:
        json.dump(diag, f, indent=2)
    print(json.dumps(diag, indent=2))

    # Print mode multi-page check
    page2 = ctx.new_page()
    page2.emulate_media(media="print")
    page2.set_viewport_size({"width": 816, "height": 1056})
    page2.goto(URL, wait_until="networkidle", timeout=90000)
    page2.wait_for_timeout(2500)
    full_h = page2.evaluate("() => document.body.scrollHeight")
    print(f"PRINT FULL HEIGHT: {full_h}px (one US Letter page = ~1056px at 96dpi)")
    print(f"PAGES (approx): {full_h/1056:.2f}")

    browser.close()
