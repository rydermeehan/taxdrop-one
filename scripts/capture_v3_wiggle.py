from playwright.sync_api import sync_playwright

URL = "https://studio.taxdrop.com/test/evidence-pack-v3?address=5749+La+Vista+Ct%2C+Dallas%2C+TX+75206"
OUTPUT = "/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots/v3_wiggle_lavista.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1440, 'height': 1800})
    page.goto(URL, wait_until='networkidle', timeout=120000)
    # Give the page time for any async render
    page.wait_for_timeout(3000)
    page.screenshot(path=OUTPUT, full_page=True)
    # Dump visible text for analysis
    text = page.evaluate("() => document.body.innerText")
    with open("/Users/upgrow/Downloads/ryder-workspace/ralph/video-studio/screenshots/v3_wiggle_lavista.txt", "w") as f:
        f.write(text)
    browser.close()
print("done")
