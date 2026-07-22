from playwright.sync_api import sync_playwright
import json

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 1200})
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(2500)

    # Targeted screenshots of each section using bounding boxes
    sections_info = page.evaluate("""() => {
        const headers = ['1. Subject Property','2. Owner','3. Comparable','4. Analysis','5. Adjustment'];
        const out = {};
        headers.forEach(h => {
            const el = Array.from(document.querySelectorAll('h2,h3,h1,div,section')).find(e => (e.innerText||'').startsWith(h));
            if(el){
                const r = el.getBoundingClientRect();
                out[h] = {top: r.top + window.scrollY, height: r.height};
            }
        });
        return {sections: out, scrollHeight: document.body.scrollHeight};
    }""")
    print(json.dumps(sections_info, indent=2))

    # Section 1 - look for YoY layout
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(300)
    page.screenshot(path=f"{OUT}/v3_round_s1_s2.png", clip={"x":0,"y":0,"width":1440,"height":900})

    # Section 4 + 5
    s4_top = sections_info['sections'].get('4. Analysis',{}).get('top',0)
    if s4_top:
        page.evaluate(f"window.scrollTo(0,{s4_top-50})")
        page.wait_for_timeout(300)
        page.screenshot(path=f"{OUT}/v3_round_s4_s5.png", clip={"x":0,"y":0,"width":1440,"height":1100})

    # Column header alignment - inspect computed styles via querying any element containing SUBJECT
    align_check = page.evaluate("""() => {
        // find every element whose immediate text contains SUBJECT
        const candidates = Array.from(document.querySelectorAll('th,td,div,span')).filter(e => {
            const t = (e.textContent||'').trim();
            return t === 'SUBJECT' || t === 'COMP #1' || t === 'COMP #2' || t === 'COMP #3' || t === 'COMP #4';
        });
        return candidates.slice(0,12).map(e => ({
            tag: e.tagName,
            text: e.textContent.trim(),
            textAlign: getComputedStyle(e).textAlign,
            justify: getComputedStyle(e).justifyContent,
            display: getComputedStyle(e).display,
            parentAlign: getComputedStyle(e.parentElement).textAlign,
            parentJustify: getComputedStyle(e.parentElement).justifyContent,
        }));
    }""")
    print("HEADER ALIGN:")
    print(json.dumps(align_check, indent=2))

    # YoY-in-same-cell check using broader search
    yoy_check = page.evaluate("""() => {
        const priorAmount = Array.from(document.querySelectorAll('*')).find(e => (e.textContent||'').trim() === '$390,300');
        const yoyText = Array.from(document.querySelectorAll('*')).find(e => /\\+\\$87,930 \\(22\\.53% YoY\\)/.test(e.textContent||'') && e.children.length<=2);
        if(!priorAmount || !yoyText) return {found:false};
        // walk up priorAmount ancestors and check if yoyText is descendant
        let p = priorAmount;
        let sameCell = false;
        let depth = 0;
        while(p && depth < 6){
            if(p.contains(yoyText) && p !== yoyText){ sameCell = true; break; }
            p = p.parentElement;
            depth++;
        }
        return {
            found:true, sameCell, depth,
            priorOuter: priorAmount.outerHTML.slice(0,200),
            yoyOuter: yoyText.outerHTML.slice(0,200),
            commonParent: sameCell ? p.outerHTML.slice(0,400) : null,
            yoyFontSize: getComputedStyle(yoyText).fontSize,
            yoyColor: getComputedStyle(yoyText).color,
        };
    }""")
    print("YoY CHECK:")
    print(json.dumps(yoy_check, indent=2))

    browser.close()
