#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
HTML = ROOT / "docs/design/brand-v1/social-production-v1/index.html"
FIXTURES = ROOT / "docs/design/brand-v1/social-production-v1/fixtures.json"
OUT = ROOT / "docs/design/brand-v1/proofs/social-production-v1"
OUT.mkdir(parents=True, exist_ok=True)

payload = json.loads(FIXTURES.read_text(encoding="utf-8"))
fixtures = payload["fixtures"]

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def validate_page(page):
    expected_count = len(fixtures) * 2
    cards = page.locator("#native-tests .production-card")
    if cards.count() != expected_count:
        raise SystemExit(f"native mutation card count drift: {cards.count()} != {expected_count}")

    failures = []
    for i in range(cards.count()):
        info = cards.nth(i).evaluate(
            """el => {
              const rect = el.getBoundingClientRect();
              const ratio = el.dataset.ratio;
              const expected = ratio === "wide" ? [1200,675] : [1080,1080];
              const selectors = [
                ".brand",".proof-flag",".eyebrow",".headline",".literal",
                ".receipt-panel",".case-grid",".claim-boundary",".evidence-strip",
                ".action",".footer-source"
              ];
              const outside = [];
              for (const node of el.querySelectorAll(selectors.join(","))) {
                const r = node.getBoundingClientRect();
                if (r.left < rect.left - 1 || r.right > rect.right + 1 ||
                    r.top < rect.top - 1 || r.bottom > rect.bottom + 1) {
                  outside.push(node.className || node.tagName);
                }
              }
              const evidenceNodes = [...el.querySelectorAll(".fact,.case-row,.evidence-strip")];
              const evidenceFonts = evidenceNodes.map(n => parseFloat(getComputedStyle(n).fontSize));
              const longEvidence = [...el.querySelectorAll(".fact b,.case-row b,.evidence-strip")]
                .filter(n => (n.textContent || "").length > 48)
                .map(n => ({text:(n.textContent||"").length, font:parseFloat(getComputedStyle(n).fontSize),
                            left:n.getBoundingClientRect().left, right:n.getBoundingClientRect().right}));
              const proof = el.querySelector(".proof-flag");
              const proofFont = proof ? parseFloat(getComputedStyle(proof).fontSize) : 0;
              const literal = el.querySelector(".literal");
              const rat = el.querySelector(".rat-hero");
              const content = el.querySelector(".found-card .content, .content");
              const ratFade = el.querySelector(".rat-fade");
              const z = n => n ? Number.parseInt(getComputedStyle(n).zIndex || "0", 10) || 0 : 0;
              return {
                fixtureId: el.dataset.fixtureId,
                ratio,
                family: el.dataset.template,
                expected,
                got:[Math.round(rect.width),Math.round(rect.height)],
                outside,
                overflow:[getComputedStyle(el).overflowX,getComputedStyle(el).overflowY],
                actionCount:el.querySelectorAll(".action").length,
                text:el.innerText,
                coverage:el.dataset.coverage,
                sourceState:el.dataset.sourceState,
                proofFont,
                minEvidenceFont:evidenceFonts.length ? Math.min(...evidenceFonts) : 999,
                longEvidence,
                literalFont:literal ? parseFloat(getComputedStyle(literal).fontSize) : 0,
                foundLayerSafe: rat ? Boolean(ratFade) && z(content) > z(rat) : true
              };
            }"""
        )
        prefix = f'{info["fixtureId"]}/{info["ratio"]}'
        if info["got"] != info["expected"]:
            failures.append(f'{prefix}: card size {info["got"]} != {info["expected"]}')
        if info["outside"]:
            failures.append(f'{prefix}: core content outside safe card bounds: {info["outside"]}')
        if info["overflow"] != ["hidden", "hidden"]:
            failures.append(f'{prefix}: card overflow contract drift {info["overflow"]}')
        if info["actionCount"] != 1:
            failures.append(f'{prefix}: expected exactly one CTA, got {info["actionCount"]}')
        if info["coverage"] not in info["text"]:
            failures.append(f'{prefix}: coverage state suppressed')
        if info["sourceState"] not in info["text"]:
            failures.append(f'{prefix}: source state suppressed')
        if info["minEvidenceFont"] < info["proofFont"]:
            failures.append(f'{prefix}: primary evidence type smaller than decorative proof flag')
        if info["literalFont"] < 24:
            failures.append(f'{prefix}: literal explanation fell below 24px')
        if not info["foundLayerSafe"]:
            failures.append(f'{prefix}: Rat layer outranks literal content or fade missing')
        for item in info["longEvidence"]:
            if item["font"] < 11:
                failures.append(f'{prefix}: long evidence shrank below 11px mono')

    if failures:
        raise SystemExit("SOCIAL PRODUCTION BROWSER FAIL\n- " + "\n- ".join(failures))

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1500, "height": 1200}, device_scale_factor=1)
    page.add_init_script(script=f"window.BINRAT_SOCIAL_PRODUCTION_FIXTURES = {json.dumps(payload)};")

    outputs = {}
    for ratio, filename in [("wide","contact-wide.png"),("square","contact-square.png")]:
        page.goto(HTML.as_uri() + f"?ratio={ratio}", wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        validate_page(page)
        sheet = page.locator("#contact-sheet")
        path = OUT / filename
        sheet.screenshot(path=str(path))
        box = sheet.bounding_box()
        outputs[filename] = {
            "width": round(box["width"]) if box else None,
            "height": round(box["height"]) if box else None,
            "bytes": path.stat().st_size,
            "sha256": sha256(path)
        }

    browser.close()

manifest = {
    "schemaVersion":"binrat.social-production-proof/1",
    "status":"PASS",
    "fixture":"DEMO / NON-LIVE",
    "fixtureCount":len(fixtures),
    "families":["receipt","case-file","rat-found"],
    "ratios":{"wide":[1200,675],"square":[1080,1080]},
    "matrix":[
        {
            "fixtureId":f["fixtureId"],
            "family":f["family"],
            "coverage":f["coverage"],
            "sourceState":f["source"]["state"],
            "headlineLength":len(f["headline"])
        }
        for f in fixtures
    ],
    "outputs":outputs,
    "checks":[
        "exact card dimensions",
        "no core content outside card bounds",
        "no card scroll overflow",
        "exactly one CTA",
        "coverage and source state remain visible",
        "primary evidence typography >= decorative proof flag",
        "literal explanation >= 24px",
        "Rat artwork remains behind literal layer with fade",
        "long evidence remains >= 11px"
    ],
    "note":"All proof content is DEMO / NON-LIVE. No live metric or production observation is consumed."
}
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
print(json.dumps(manifest, indent=2))
