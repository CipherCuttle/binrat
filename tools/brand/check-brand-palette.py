#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOKENS_PATH = ROOT / "docs/design/brand-v1/tokens.json"
CSS_PATH = ROOT / "docs/design/brand-v1/brand-tokens.css"
SOCIAL_CSS_PATH = ROOT / "docs/design/brand-v1/social-v1/social.css"
REPORT_PATH = ROOT / "docs/design/brand-v1/proofs/palette-v1/contrast-report.json"

HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

REQUIRED_TEXT_PAIRS = [
    ("bone", "ink", 4.5),
    ("paper", "ink", 4.5),
    ("muted", "ink", 4.5),
    ("copper", "ink", 4.5),
    ("ratEye", "ink", 4.5),
    ("oxidizedMint", "ink", 4.5),
    ("bruise", "ink", 4.5),
    ("bone", "panel", 4.5),
    ("paper", "panel", 4.5),
    ("muted", "panel", 4.5),
    ("copper", "panel", 4.5),
    ("ratEye", "panel", 4.5),
    ("oxidizedMint", "panel", 4.5),
    ("bruise", "panel", 4.5),
    ("ink", "paper", 4.5),
]

SOCIAL_LEGACY_MAP = {
    "black": "ink",
    "asphalt": "asphalt",
    "panel": "panel",
    "panel-hi": "panelHigh",
    "bone": "bone",
    "paper": "paper",
    "muted": "muted",
    "orange": "copper",
    "red": "ratEye",
    "green": "oxidizedMint",
    "line": "line",
    "line-hi": "lineHigh",
}


def channel(v: int) -> float:
    c = v / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    value = int(hex_color[1:], 16)
    r = (value >> 16) & 255
    g = (value >> 8) & 255
    b = value & 255
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def css_vars(text: str) -> dict[str, str]:
    return {
        name: value.lower()
        for name, value in re.findall(r"--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;", text)
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write-report", action="store_true")
    args = parser.parse_args()

    tokens = json.loads(TOKENS_PATH.read_text(encoding="utf-8"))
    primitives = tokens["primitives"]

    failures: list[str] = []

    for name, value in primitives.items():
        if not HEX.match(value):
            failures.append(f"invalid hex token {name}: {value}")

    ratios = []
    for fg, bg, minimum in REQUIRED_TEXT_PAIRS:
        value = contrast(primitives[fg], primitives[bg])
        ratios.append({
            "foreground": fg,
            "background": bg,
            "foregroundHex": primitives[fg],
            "backgroundHex": primitives[bg],
            "contrast": round(value, 2),
            "minimum": minimum,
            "pass": value >= minimum,
        })
        if value < minimum:
            failures.append(f"contrast fail {fg}/{bg}: {value:.2f} < {minimum}")

    brand_css = css_vars(CSS_PATH.read_text(encoding="utf-8"))
    for primitive, expected in primitives.items():
        css_name = {
            "panelHigh": "br-panel-high",
            "dumpsterHigh": "br-dumpster-high",
            "ratEye": "br-rat-eye",
            "oxidizedMint": "br-oxidized-mint",
            "lineHigh": "br-line-high",
        }.get(primitive, f"br-{primitive}")
        got = brand_css.get(css_name)
        if got != expected.lower():
            failures.append(f"brand CSS drift {css_name}: {got} != {expected.lower()}")

    # The social proof is the current visual pressure test for this exact palette.
    # Keep its legacy variable names byte-equivalent until it is migrated to imports.
    social = css_vars(SOCIAL_CSS_PATH.read_text(encoding="utf-8"))
    for legacy, primitive in SOCIAL_LEGACY_MAP.items():
        got = social.get(legacy)
        expected = primitives[primitive].lower()
        if got != expected:
            failures.append(f"social proof palette drift --{legacy}: {got} != {expected}")

    diagnostic = {
        "lineHighOnInk": round(contrast(primitives["lineHigh"], primitives["ink"]), 2),
        "lineHighOnPanel": round(contrast(primitives["lineHigh"], primitives["panel"]), 2),
        "mutedOnPaper": round(contrast(primitives["muted"], primitives["paper"]), 2),
        "copperOnPaper": round(contrast(primitives["copper"], primitives["paper"]), 2),
        "ratEyeOnPaper": round(contrast(primitives["ratEye"], primitives["paper"]), 2),
        "oxidizedMintOnPaper": round(contrast(primitives["oxidizedMint"], primitives["paper"]), 2),
        "bruiseOnPaper": round(contrast(primitives["bruise"], primitives["paper"]), 2),
    }

    report = {
        "schemaVersion": "binrat.palette-contrast/1",
        "status": "PASS" if not failures else "FAIL",
        "tokenSource": str(TOKENS_PATH.relative_to(ROOT)),
        "requiredNormalTextPairs": ratios,
        "diagnostic": diagnostic,
        "rules": {
            "lineHighIsDecorativeOnly": diagnostic["lineHighOnInk"] < 3.0,
            "paperUsesInkForNormalText": True,
            "colorAloneNeverCarriesEvidenceMeaning": True,
        },
        "failures": failures,
    }

    if args.write_report:
        REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
        REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(report, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
