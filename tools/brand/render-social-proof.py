#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "docs/design/brand-v1/social-v1/index.html"
OUT = ROOT / "docs/design/brand-v1/proofs/social-v1"
OUT.mkdir(parents=True, exist_ok=True)

TARGETS = [
    ("receipt", "wide", "receipt-wide-1200x675.png"),
    ("case-file", "wide", "case-file-wide-1200x675.png"),
    ("rat-found", "wide", "rat-found-wide-1200x675.png"),
    ("receipt", "square", "receipt-square-1080.png"),
    ("case-file", "square", "case-file-square-1080.png"),
    ("rat-found", "square", "rat-found-square-1080.png"),
]

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda:f.read(1024*1024), b""):
            h.update(chunk)
    return h.hexdigest()

with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={"width": 1400, "height": 1200}, device_scale_factor=1)
    page.goto(HTML.as_uri(), wait_until="networkidle")
    page.evaluate("document.fonts.ready")

    # Brand invariant: canonical wordmark remains one flat bone color.
    brand_colors = page.locator(".brand strong").evaluate_all(
        "els => [...new Set(els.map(el => getComputedStyle(el).color))]"
    )
    if brand_colors != ["rgb(228, 221, 204)"]:
        raise SystemExit(f"wordmark color drift: {brand_colors}")

    outputs={}
    for template, ratio, filename in TARGETS:
        locator=page.locator(f'[data-template="{template}"][data-ratio="{ratio}"]')
        box=locator.bounding_box()
        if not box:
            raise SystemExit(f"missing template {template}/{ratio}")
        expected=(1200,675) if ratio=="wide" else (1080,1080)
        got=(round(box["width"]), round(box["height"]))
        if got != expected:
            raise SystemExit(f"size drift {template}/{ratio}: {got} != {expected}")
        path=OUT/filename
        locator.screenshot(path=str(path))
        outputs[filename]={"width":expected[0],"height":expected[1],"bytes":path.stat().st_size,"sha256":sha256(path)}

    browser.close()

manifest={
    "schemaVersion":"binrat.social-proof/1",
    "status":"REVIEW_REQUIRED",
    "fixture":"DEMO / NON-LIVE",
    "templates":["receipt","case-file","rat-found"],
    "ratios":{"wide":[1200,675],"square":[1080,1080]},
    "outputs":outputs,
    "note":"All proof values are demo-only. Templates inherit canonical Rat Zero and Geist brand contracts."
}
(OUT/"manifest.json").write_text(json.dumps(manifest, indent=2)+"\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))
