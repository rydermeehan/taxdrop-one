"""Verify two changes on the v3 evidence pack."""
import os
import json
from playwright.sync_api import sync_playwright

OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT_DIR, exist_ok=True)

URL_A = "https://studio.taxdrop.com/test/evidence-pack-v3?address=2915+Bay+Hollow+Ct%2C+Katy%2C+TX+77450"
URL_B = "https://studio.taxdrop.com/test/evidence-pack-v3?address=12309+Capella+Trl%2C+Austin%2C+TX+78732"

def capture(url, label):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1440, 'height': 1800})
        page.goto(url, wait_until='networkidle', timeout=60000)
        page.wait_for_timeout(2000)

        full_path = f"{OUT_DIR}/verify_{label}_full.png"
        page.screenshot(path=full_path, full_page=True)

        body_text = page.evaluate("() => document.body.innerText")
        with open(f"{OUT_DIR}/verify_{label}_body.txt", "w") as f:
            f.write(body_text)

        # Try to find section 5 by heading
        section5 = page.evaluate("""() => {
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
            const s5 = headings.find(h => /adjustment methodology/i.test(h.innerText));
            if (!s5) return null;
            // Walk up to nearest section/container
            let container = s5.closest('section') || s5.parentElement;
            return container ? container.innerText : null;
        }""")

        section2 = page.evaluate("""() => {
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
            const s2 = headings.find(h => /section\\s*2|requested|reduction|recommendation/i.test(h.innerText));
            if (!s2) return null;
            let container = s2.closest('section') || s2.parentElement;
            return container ? container.innerText : null;
        }""")

        section4 = page.evaluate("""() => {
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
            const s4 = headings.find(h => /section\\s*4|narrative|argument|case/i.test(h.innerText));
            if (!s4) return null;
            let container = s4.closest('section') || s4.parentElement;
            return container ? container.innerText : null;
        }""")

        # Check for diagnostic JSON in page (common pattern)
        diag = page.evaluate("""() => {
            const pre = document.querySelector('pre, code');
            return pre ? pre.innerText.slice(0, 2000) : null;
        }""")

        result = {
            "url": url,
            "section5_text": section5,
            "section2_text": section2,
            "section4_text": section4,
            "diag_snippet": diag,
        }
        with open(f"{OUT_DIR}/verify_{label}_data.json", "w") as f:
            json.dump(result, f, indent=2)

        browser.close()
        print(f"Captured {label}: {full_path}")
        return result

if __name__ == "__main__":
    print("=== URL A (Bay Hollow) ===")
    a = capture(URL_A, "A_bayhollow")
    print("=== URL B (Capella Trl) ===")
    b = capture(URL_B, "B_capella")
