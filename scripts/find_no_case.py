"""Try several Austin/Travis addresses to find one that triggers no_case wiggle-room."""
import os
from playwright.sync_api import sync_playwright

OUT_DIR = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"

CANDIDATES = [
    "7113+Black+Mountain+Dr%2C+Austin%2C+TX+78731",
    "3404+Bonnie+Rd%2C+Austin%2C+TX+78703",
    "1505+Hardouin+Ave%2C+Austin%2C+TX+78703",
    "4501+Balcones+Dr%2C+Austin%2C+TX+78731",
    "2200+Tower+Dr%2C+Austin%2C+TX+78703",
    "1700+Westover+Rd%2C+Austin%2C+TX+78703",
    "3204+Cherrywood+Rd%2C+Austin%2C+TX+78722",
]

def try_one(addr_param, idx):
    url = f"https://studio.taxdrop.com/test/evidence-pack-v3?address={addr_param}"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1440, 'height': 1800})
        try:
            page.goto(url, wait_until='networkidle', timeout=60000)
            page.wait_for_timeout(1500)
        except Exception as e:
            print(f"[{idx}] {addr_param}: TIMEOUT {e}")
            browser.close()
            return None
        body = page.evaluate("() => document.body.innerText")
        # Look for wiggle-room markers
        has_no_defensible = "No reduction defensible" in body
        has_wiggle_pct = "20.00%" in body or "20.0%" in body
        # We want REQUESTED MARKET VALUE × 0.80 of subject
        # Search for "98.5% of CAD" pattern vs "80.00%" pattern
        import re
        pct_match = re.search(r"(\d+(?:\.\d+)?)% of CAD notice", body)
        diff_match = re.search(r"Difference:.*?\((\d+\.\d+%)[^)]*\)", body)
        # Also check % below
        below_match = re.search(r"(\d+\.\d+%)\s*below", body)
        result = {
            "addr": addr_param,
            "no_defensible_banner": has_no_defensible,
            "has_20pct": has_wiggle_pct,
            "of_cad_notice": pct_match.group(0) if pct_match else None,
            "difference_pct": diff_match.group(0) if diff_match else None,
            "below_match": below_match.group(0) if below_match else None,
        }
        print(f"[{idx}] {addr_param}")
        print(f"     of_cad: {result['of_cad_notice']}  diff: {result['difference_pct']}  below: {result['below_match']}")
        print(f"     banner: {has_no_defensible}  20%: {has_wiggle_pct}")
        # Save body if it looks wiggle-roomy
        if has_wiggle_pct or has_no_defensible or (pct_match and float(pct_match.group(1)) <= 80.5):
            with open(f"{OUT_DIR}/no_case_candidate_{idx}_body.txt", "w") as f:
                f.write(body)
            page.screenshot(path=f"{OUT_DIR}/no_case_candidate_{idx}.png", full_page=True)
            print(f"     ** SAVED **")
        browser.close()
        return result

for i, addr in enumerate(CANDIDATES):
    try_one(addr, i)
