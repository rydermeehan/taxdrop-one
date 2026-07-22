"""Capture /pro page and v3 PDF page for 738 Pinehill Ln comparison."""
from playwright.sync_api import sync_playwright
import time, sys, os

ADDR = "738 Pinehill Ln, Grand Prairie, TX 75052, USA"
URL_PRO = "https://one.taxdrop.com/?address=738+Pinehill+Ln%2C+Grand+Prairie%2C+TX+75052%2C+USA"
URL_V3  = "https://studio.taxdrop.com/test/evidence-pack-v3?address=738+Pinehill+Ln%2C+Grand+Prairie%2C+TX+75052%2C+USA"

OUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots"
os.makedirs(OUT, exist_ok=True)

def capture_pro(p):
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 2200})
    page = ctx.new_page()
    print(f"[pro] navigating: {URL_PRO}", flush=True)
    page.goto(URL_PRO, wait_until="domcontentloaded", timeout=60000)
    # Give page chance to auto-load if URL param works
    try:
        page.wait_for_load_state("networkidle", timeout=20000)
    except Exception:
        pass
    time.sleep(3)

    # Look for hero text first; if not present, type address manually
    body_text = page.locator("body").inner_text(timeout=10000)
    if "FILE THIS VALUE" not in body_text and "RECOMMENDATION" not in body_text:
        print("[pro] no hero yet, trying manual entry", flush=True)
        # Find an input
        try:
            inp = page.locator("input[type='text'], input[placeholder*='address' i], input").first
            inp.click()
            inp.fill(ADDR)
            time.sleep(0.5)
            # Click the find button
            btn = page.get_by_role("button", name=lambda n: n and ("find" in n.lower() or "best method" in n.lower()))
            if btn.count() > 0:
                btn.first.click()
            else:
                # fallback: press Enter or click any button
                page.keyboard.press("Enter")
        except Exception as e:
            print(f"[pro] manual entry error: {e}", flush=True)

        # Wait for hero
        try:
            page.wait_for_function(
                "() => document.body.innerText.includes('FILE THIS VALUE') || document.body.innerText.includes('RECOMMENDATION')",
                timeout=90000,
            )
        except Exception as e:
            print(f"[pro] hero wait timeout: {e}", flush=True)
        time.sleep(2)

    # Screenshot full page
    page.screenshot(path=f"{OUT}/pinehill_pro_full.png", full_page=True)
    # Also fold
    page.screenshot(path=f"{OUT}/pinehill_pro_fold.png", full_page=False)

    # Extract candidate text around recommendation
    text = page.locator("body").inner_text()
    # Print first ~6000 chars
    print("\n========== PRO PAGE TEXT (first 6000 chars) ==========\n", flush=True)
    print(text[:6000], flush=True)
    print("\n========== END PRO TEXT ==========\n", flush=True)

    browser.close()

def capture_v3(p):
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 2400})
    page = ctx.new_page()
    print(f"[v3] navigating: {URL_V3}", flush=True)
    page.goto(URL_V3, wait_until="domcontentloaded", timeout=90000)
    try:
        page.wait_for_load_state("networkidle", timeout=45000)
    except Exception:
        pass
    time.sleep(4)

    page.screenshot(path=f"{OUT}/pinehill_v3_full.png", full_page=True)
    page.screenshot(path=f"{OUT}/pinehill_v3_fold.png", full_page=False)

    text = page.locator("body").inner_text()
    print("\n========== V3 PDF PAGE TEXT (first 8000 chars) ==========\n", flush=True)
    print(text[:8000], flush=True)
    print("\n========== END V3 TEXT ==========\n", flush=True)

    browser.close()

with sync_playwright() as p:
    capture_pro(p)
    capture_v3(p)
print("DONE")
