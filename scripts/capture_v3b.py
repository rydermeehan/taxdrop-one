from playwright.sync_api import sync_playwright
import os, urllib.parse

OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

# Try a few address-encoding variants - the engine wants city+state
addr_variants = [
    "2915 Bay Hollow Ct, Katy, TX 77450",
    "2915 Bay Hollow Ct, Houston, TX 77450",
]

BASE = "https://studio.taxdrop.com/test/evidence-pack-v3"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 1200})
    page = ctx.new_page()

    success_url = None
    for a in addr_variants:
        u = f"{BASE}?address={urllib.parse.quote(a)}&zip=77450"
        page.goto(u, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3500)
        txt = page.evaluate("() => document.body.innerText")
        if "Lookup failed" not in txt and "Property Appraisal Report" in txt:
            success_url = u
            break
        # also try clicking Generate Report after filling input directly
        try:
            page.fill('input[type="text"]', a)
            page.click('button:has-text("Generate Report")')
            page.wait_for_timeout(6000)
            txt = page.evaluate("() => document.body.innerText")
            if "Property Appraisal Report" in txt and "Lookup failed" not in txt:
                success_url = u
                break
        except Exception as e:
            print("click err", e)

    if not success_url:
        # Fall back to capturing whatever last state we have
        page.screenshot(path=os.path.join(OUT_DIR, "v3_failed.png"), full_page=True)
        body = page.evaluate("() => document.body.innerText")
        with open(os.path.join(OUT_DIR, "v3_body_failed.txt"), "w") as f:
            f.write(body)
        print("FAIL - no successful render. Last URL tried:", u)
        browser.close()
        raise SystemExit(0)

    print("SUCCESS via:", success_url)
    page.screenshot(path=os.path.join(OUT_DIR, "v3_full.png"), full_page=True)
    page.screenshot(path=os.path.join(OUT_DIR, "v3_top.png"), full_page=False)
    body = page.evaluate("() => document.body.innerText")
    with open(os.path.join(OUT_DIR, "v3_body.txt"), "w") as f:
        f.write(body)

    # Capture section 3 only - find heading with "Comparable Property Analysis"
    sec3_html = page.evaluate("""
        () => {
            const all = Array.from(document.querySelectorAll('h1,h2,h3'));
            const h = all.find(e => /comparable property analysis/i.test(e.innerText));
            if (!h) return null;
            const sec = h.closest('section') || h.parentElement;
            return sec ? sec.outerHTML : null;
        }
    """)
    if sec3_html:
        with open(os.path.join(OUT_DIR, "v3_section3.html"), "w") as f:
            f.write(sec3_html)

    # Pull row labels (first column of any tables in section 3)
    labels = page.evaluate("""
        () => {
            const all = Array.from(document.querySelectorAll('h1,h2,h3'));
            const h = all.find(e => /comparable property analysis/i.test(e.innerText));
            if (!h) return [];
            const sec = h.closest('section') || h.parentElement;
            const out = [];
            sec.querySelectorAll('tr').forEach(tr => {
                const first = tr.querySelector('th, td');
                if (first) {
                    const t = (first.innerText || '').trim();
                    if (t) out.push(t);
                }
            });
            return out;
        }
    """)
    with open(os.path.join(OUT_DIR, "v3_section3_rows.txt"), "w") as f:
        f.write("\n".join(labels))

    browser.close()
print("Done")
