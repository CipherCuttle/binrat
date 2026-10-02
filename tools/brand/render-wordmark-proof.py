#!/usr/bin/env python3
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "docs/design/brand-v1/wordmark-proof-v1/index.html"
OUT = ROOT / "docs/design/brand-v1/proofs/wordmark-v1"
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1800, "height": 1600}, device_scale_factor=1)
    page.goto(HTML.as_uri(), wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    page.locator("#board").screenshot(path=str(OUT / "wordmark-contact-sheet.png"))
    browser.close()
