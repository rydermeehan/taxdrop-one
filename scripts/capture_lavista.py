from playwright.sync_api import sync_playwright
import os

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(4000)

    # Full page
    page.screenshot(path=os.path.join(OUT_DIR, "lavista_full.png"), full_page=True)
    # Viewport (top)
    page.screenshot(path=os.path.join(OUT_DIR, "lavista_top.png"), full_page=False)

    # Extract body text
    body_text = page.evaluate("() => document.body.innerText")
    with open(os.path.join(OUT_DIR, "lavista_body.txt"), "w") as f:
        f.write(body_text)

    # Find subject photo and check alignment
    photo_info = page.evaluate("""
        () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            const results = [];
            imgs.forEach(img => {
                const rect = img.getBoundingClientRect();
                const parent = img.parentElement;
                const parentRect = parent ? parent.getBoundingClientRect() : null;
                const computed = window.getComputedStyle(img);
                const parentComputed = parent ? window.getComputedStyle(parent) : null;
                if (rect.width > 200) {
                    results.push({
                        src: img.src.slice(0, 100),
                        width: rect.width,
                        height: rect.height,
                        left: rect.left,
                        right: rect.right,
                        windowWidth: window.innerWidth,
                        leftMargin: rect.left,
                        rightMargin: window.innerWidth - rect.right,
                        parentTextAlign: parentComputed ? parentComputed.textAlign : null,
                        parentDisplay: parentComputed ? parentComputed.display : null,
                        imgMargin: computed.margin,
                        imgDisplay: computed.display,
                    });
                }
            });
            return results;
        }
    """)
    with open(os.path.join(OUT_DIR, "lavista_photo_info.txt"), "w") as f:
        import json
        f.write(json.dumps(photo_info, indent=2))

    # Section-level HTML extraction for section 2 and section 4
    sections_html = page.evaluate("""
        () => {
            const out = {};
            const allH = document.querySelectorAll('h1, h2, h3');
            allH.forEach(h => {
                const t = (h.innerText || '').trim();
                if (/requested|target|reduction|market value/i.test(t) ||
                    /analysis/i.test(t) ||
                    /comparable property analysis/i.test(t)) {
                    const section = h.closest('section, div');
                    if (section) {
                        out[t] = section.innerText.slice(0, 3000);
                    }
                }
            });
            return out;
        }
    """)
    with open(os.path.join(OUT_DIR, "lavista_sections.txt"), "w") as f:
        import json
        f.write(json.dumps(sections_html, indent=2))

    browser.close()

print("Done")
