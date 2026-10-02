#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
EXPORTS = ROOT / "exports"
TEMPLATE_DIR = ROOT / "docs/design/brand-v1/export-v1"
RAT_ZERO = ROOT / "docs/design/brand-v1/canon/rat-zero.jpg"
SOCIAL_PROOFS = ROOT / "docs/design/brand-v1/proofs/social-v1"

GENERATOR_ID = "binrat.brand-export/1.0.0"
GENERATION_COMMAND = "python tools/brand/render-export-pack.py"
AUTHORITY_BRANCH = "design/binrat-brand-system-v1"
AUTHORITY_COMMIT = "25a54278e6a5d8eb6f5a568e9e8f05d39ea21a4c"
GEIST_COMMIT = "10dc7658f13c38a474cde201bb09a4617267545b"
GEIST_SANS_URL = f"https://raw.githubusercontent.com/vercel/geist-font/{GEIST_COMMIT}/fonts/Geist/webfonts/Geist%5Bwght%5D.woff2"
GEIST_MONO_URL = f"https://raw.githubusercontent.com/vercel/geist-font/{GEIST_COMMIT}/fonts/GeistMono/webfonts/GeistMono%5Bwght%5D.woff2"

EXPECTED_RAT_ZERO_SIZE = (1536, 1536)
EXPECTED_RAT_ZERO_SHA256 = "43541a9b469fbe46a9b54dccb227cfb21c7fcfade1d96656410b124ded2d3edc"
AVATAR_CROP = (465, 235, 1105, 875)

REQUIRED_AUTHORITY_DOCS = [
    "docs/design/brand-v1/README.md",
    "docs/design/brand-v1/RAT_CANON.md",
    "docs/design/brand-v1/TYPOGRAPHY.md",
    "docs/design/brand-v1/LOGO_LOCKUP.md",
    "docs/design/brand-v1/WORDMARK_PROOF_V1.md",
    "docs/design/brand-v1/SOCIAL_TEMPLATES_V1.md",
    "docs/PRODUCT_LANGUAGE.md",
    "docs/PHILOSOPHY.md",
]

SOCIAL_FILES = {
    "receipt-wide": "receipt-wide-1200x675.png",
    "receipt-square": "receipt-square-1080.png",
    "case-file-wide": "case-file-wide-1200x675.png",
    "case-file-square": "case-file-square-1080.png",
    "rat-found-wide": "rat-found-wide-1200x675.png",
    "rat-found-square": "rat-found-square-1080.png",
}

SOCIAL_TARGET_DIMENSIONS = {
    "receipt-wide-1200x675.png": (1200, 675),
    "receipt-square-1080.png": (1080, 1080),
    "case-file-wide-1200x675.png": (1200, 675),
    "case-file-square-1080.png": (1080, 1080),
    "rat-found-wide-1200x675.png": (1200, 675),
    "rat-found-square-1080.png": (1080, 1080),
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as img:
        return img.size


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=False, compress_level=9)


def clean_owned_outputs() -> None:
    for name in ["logo", "x", "telegram", "opengraph", "generic-social", "proofs"]:
        path = EXPORTS / name
        if path.exists():
            shutil.rmtree(path)
    manifest = EXPORTS / "manifest.json"
    if manifest.exists():
        manifest.unlink()


def require_sources() -> None:
    missing = [p for p in REQUIRED_AUTHORITY_DOCS if not (ROOT / p).is_file()]
    if missing:
        raise SystemExit(f"missing brand authority source(s): {missing}")
    if not RAT_ZERO.is_file():
        raise SystemExit(f"missing Rat Zero: {RAT_ZERO}")
    if sha256(RAT_ZERO) != EXPECTED_RAT_ZERO_SHA256:
        raise SystemExit("Rat Zero SHA-256 drift; stop instead of exporting a different mascot")
    with Image.open(RAT_ZERO) as img:
        if img.size != EXPECTED_RAT_ZERO_SIZE:
            raise SystemExit(f"Rat Zero size drift: {img.size} != {EXPECTED_RAT_ZERO_SIZE}")
    for filename in SOCIAL_FILES.values():
        if not (SOCIAL_PROOFS / filename).is_file():
            raise SystemExit(f"missing approved Social V1 proof: {filename}")


def make_rat_derivatives() -> dict[str, Path]:
    logo = EXPORTS / "logo"
    xdir = EXPORTS / "x"
    telegram = EXPORTS / "telegram"
    for d in [logo, xdir, telegram]:
        d.mkdir(parents=True, exist_ok=True)

    with Image.open(RAT_ZERO) as src0:
        src = src0.convert("RGB")
        avatar_source = src.crop(AVATAR_CROP)
        outputs: dict[str, Path] = {}
        for size in [512, 256, 128, 64, 48, 32]:
            out = logo / f"rat-avatar-{size}.png"
            save_png(avatar_source.resize((size, size), Image.Resampling.LANCZOS), out)
            outputs[f"avatar-{size}"] = out

    shutil.copyfile(outputs["avatar-32"], logo / "favicon-candidate-32.png")
    shutil.copyfile(outputs["avatar-48"], logo / "favicon-candidate-48.png")
    shutil.copyfile(outputs["avatar-512"], xdir / "avatar-512.png")
    shutil.copyfile(outputs["avatar-512"], telegram / "profile-512.png")
    return outputs


def copy_social_exports() -> None:
    generic = EXPORTS / "generic-social"
    xdir = EXPORTS / "x"
    telegram = EXPORTS / "telegram"
    generic.mkdir(parents=True, exist_ok=True)
    xdir.mkdir(parents=True, exist_ok=True)
    telegram.mkdir(parents=True, exist_ok=True)

    for filename in SOCIAL_FILES.values():
        source = SOCIAL_PROOFS / filename
        destination = generic / filename
        expected = SOCIAL_TARGET_DIMENSIONS[filename]
        with Image.open(source) as img:
            actual = img.size
            allowed = {expected, (expected[0], expected[1] + 1)}
            if actual not in allowed:
                raise SystemExit(
                    f"Social V1 proof geometry drift {filename}: {actual} not in {sorted(allowed)}"
                )
            if actual == expected:
                shutil.copyfile(source, destination)
            else:
                # Frozen Social V1 proofs carry one extra bottom raster row from their
                # browser capture. Normalize only that row for declared export geometry.
                save_png(img.crop((0, 0, expected[0], expected[1])), destination)

    shutil.copyfile(generic / SOCIAL_FILES["receipt-wide"], xdir / "post-receipt-wide-1200x675.png")
    shutil.copyfile(generic / SOCIAL_FILES["rat-found-square"], xdir / "post-rat-found-square-1080.png")
    shutil.copyfile(generic / SOCIAL_FILES["case-file-wide"], telegram / "card-case-file-wide-1200x675.png")
    shutil.copyfile(generic / SOCIAL_FILES["rat-found-square"], telegram / "card-rat-found-square-1080.png")


def render_browser_exports() -> None:
    html = TEMPLATE_DIR / "index.html"
    if not html.is_file():
        raise SystemExit(f"missing export template: {html}")

    EXPORTS.joinpath("opengraph").mkdir(parents=True, exist_ok=True)
    EXPORTS.joinpath("proofs").mkdir(parents=True, exist_ok=True)

    targets = [
        ("#logo-horizontal-dark", EXPORTS / "logo/canonical-horizontal-dark-1200x320.png", (1200, 320)),
        ("#logo-horizontal-light", EXPORTS / "logo/canonical-horizontal-light-1200x320.png", (1200, 320)),
        ("#wordmark-dark", EXPORTS / "logo/wordmark-dark-1000x280.png", (1000, 280)),
        ("#wordmark-light", EXPORTS / "logo/wordmark-light-1000x280.png", (1000, 280)),
        ("#x-header", EXPORTS / "x/header-1500x500.png", (1500, 500)),
        ("#og-default", EXPORTS / "opengraph/default-og-1200x630.png", (1200, 630)),
        ("#pressure-tests", EXPORTS / "proofs/pressure-tests-1800x1600.png", (1800, 1600)),
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1900, "height": 1800}, device_scale_factor=1)
        page.goto(html.as_uri(), wait_until="networkidle")
        page.evaluate("document.fonts.ready")

        font_state = page.evaluate(
            """() => ({
              sans: document.fonts.check('800 72px "Geist Export"'),
              mono: document.fonts.check('500 14px "Geist Mono Export"')
            })"""
        )
        if font_state != {"sans": True, "mono": True}:
            raise SystemExit(f"pinned Geist fonts did not load: {font_state}")

        wordmark_colors = page.locator(".canonical-wordmark").evaluate_all(
            "els => [...new Set(els.map(el => getComputedStyle(el).color))]"
        )
        allowed = {"rgb(228, 221, 204)", "rgb(16, 18, 16)"}
        if not set(wordmark_colors).issubset(allowed):
            raise SystemExit(f"canonical wordmark color drift: {wordmark_colors}")

        for selector, path, expected in targets:
            locator = page.locator(selector)
            box = locator.bounding_box()
            if not box:
                raise SystemExit(f"missing render target: {selector}")
            got = (round(box["width"]), round(box["height"]))
            if got != expected:
                raise SystemExit(f"render target size drift {selector}: {got} != {expected}")
            locator.screenshot(path=str(path))

        browser.close()


def source_hashes(paths: list[str], *, include_fonts: bool = False) -> dict[str, str]:
    result = {p: f"sha256:{sha256(ROOT / p)}" for p in paths}
    if include_fonts:
        result["Geist Sans"] = f"git-commit:{GEIST_COMMIT}"
        result["Geist Mono"] = f"git-commit:{GEIST_COMMIT}"
    return result


def record(
    name: str,
    role: str,
    relpath: str,
    source_assets: list[str],
    intended_surfaces: list[str],
    background: str,
    status: str,
    *,
    include_fonts: bool = False,
) -> dict[str, Any]:
    path = ROOT / relpath
    width, height = png_size(path)
    return {
        "name": name,
        "role": role,
        "path": relpath,
        "dimensions": [width, height],
        "sourceAssets": source_assets,
        "sourceHashes": source_hashes(source_assets, include_fonts=include_fonts),
        "outputHash": f"sha256:{sha256(path)}",
        "intendedSurfaces": intended_surfaces,
        "backgroundAssumptions": background,
        "status": status,
        "generation": {
            "command": GENERATION_COMMAND,
            "version": GENERATOR_ID,
            "dependencies": {
                "Pillow": "11.3.0",
                "playwright": "1.55.0",
                "chromium": "playwright-1.55.0-bundled",
                "GeistCommit": GEIST_COMMIT,
            },
        },
    }


def build_manifest() -> dict[str, Any]:
    rat = "docs/design/brand-v1/canon/rat-zero.jpg"
    logo_doc = "docs/design/brand-v1/LOGO_LOCKUP.md"
    type_doc = "docs/design/brand-v1/TYPOGRAPHY.md"
    social_doc = "docs/design/brand-v1/SOCIAL_TEMPLATES_V1.md"
    language_doc = "docs/PRODUCT_LANGUAGE.md"
    template_html = "docs/design/brand-v1/export-v1/index.html"
    template_css = "docs/design/brand-v1/export-v1/export.css"

    records: list[dict[str, Any]] = []

    for rel, name, background in [
        ("exports/logo/canonical-horizontal-dark-1200x320.png", "canonical-horizontal-dark", "Opaque Brand V1 near-black proof background."),
        ("exports/logo/canonical-horizontal-light-1200x320.png", "canonical-horizontal-light", "Opaque Brand V1 bone/paper proof background."),
    ]:
        records.append(record(name, "canonical horizontal lockup", rel, [rat, logo_doc, type_doc, template_html, template_css], ["web", "social headers", "editorial"], background, "canonical", include_fonts=True))

    for rel, name, background in [
        ("exports/logo/wordmark-dark-1000x280.png", "wordmark-dark", "Bone wordmark on near-black proof background; use where dark-context contrast is guaranteed."),
        ("exports/logo/wordmark-light-1000x280.png", "wordmark-light", "Near-black wordmark on bone/paper proof background; use where light-context contrast is guaranteed."),
    ]:
        records.append(record(name, "single-color BINRAT wordmark", rel, [logo_doc, type_doc, template_html, template_css], ["web", "social", "editorial"], background, "canonical", include_fonts=True))

    for size in [512, 256, 128, 64, 48]:
        records.append(record(f"rat-avatar-{size}", "Rat Zero avatar crop", f"exports/logo/rat-avatar-{size}.png", [rat], ["profile", "social", "web"], "Square raster crop; platform may apply circular mask. Never mirror.", "canonical"))
    records.append(record("rat-avatar-32", "Rat Zero tiny avatar/favicon crop", "exports/logo/rat-avatar-32.png", [rat], ["favicon candidate", "tiny UI"], "Square raster; must survive real browser chrome validation.", "candidate"))
    records.append(record("favicon-candidate-32", "favicon candidate", "exports/logo/favicon-candidate-32.png", [rat], ["browser favicon"], "Browser may mask/resample; no simplification authorized.", "candidate"))
    records.append(record("favicon-candidate-48", "favicon candidate", "exports/logo/favicon-candidate-48.png", [rat], ["browser favicon", "compact UI"], "Browser may mask/resample; no simplification authorized.", "candidate"))

    records.append(record("x-avatar-512", "X-style profile avatar", "exports/x/avatar-512.png", [rat], ["X profile"], "Upload square; validate under circular presentation crop.", "canonical"))
    records.append(record("x-header-1500x500", "X-style header/banner preset", "exports/x/header-1500x500.png", [rat, logo_doc, type_doc, language_doc, template_html, template_css], ["X-style profile header"], "Platform/header crop may vary by viewport; key lockup content stays inside central safe area.", "candidate", include_fonts=True))
    records.append(record("telegram-profile-512", "Telegram profile avatar", "exports/telegram/profile-512.png", [rat], ["Telegram profile"], "Upload square; Telegram presents circular crop.", "canonical"))
    records.append(record("default-og-1200x630", "default OpenGraph preview", "exports/opengraph/default-og-1200x630.png", [rat, logo_doc, type_doc, language_doc, template_html, template_css], ["OpenGraph", "link unfurl"], "Opaque dark proof background; no live claims or dynamic values.", "candidate", include_fonts=True))

    social_map = [
        ("receipt-wide", "RECEIPT wide", "receipt-wide-1200x675.png"),
        ("receipt-square", "RECEIPT square", "receipt-square-1080.png"),
        ("case-file-wide", "CASE FILE wide", "case-file-wide-1200x675.png"),
        ("case-file-square", "CASE FILE square", "case-file-square-1080.png"),
        ("rat-found-wide", "RAT FOUND SOMETHING wide", "rat-found-wide-1200x675.png"),
        ("rat-found-square", "RAT FOUND SOMETHING square", "rat-found-square-1080.png"),
    ]
    for key, role, filename in social_map:
        source = f"docs/design/brand-v1/proofs/social-v1/{filename}"
        records.append(record(key, role, f"exports/generic-social/{filename}", [source, social_doc, language_doc], ["generic social", "editorial share"], "Opaque deterministic export from approved Social V1 proof; one extra bottom capture row is removed when present. Fixture is explicitly DEMO / NON-LIVE.", "canonical"))

    platform_copies = [
        ("x-post-receipt-wide", "X representative RECEIPT post", "exports/x/post-receipt-wide-1200x675.png", "docs/design/brand-v1/proofs/social-v1/receipt-wide-1200x675.png", ["X post"]),
        ("x-post-rat-found-square", "X representative RAT FOUND SOMETHING post", "exports/x/post-rat-found-square-1080.png", "docs/design/brand-v1/proofs/social-v1/rat-found-square-1080.png", ["X post"]),
        ("telegram-card-case-file-wide", "Telegram representative CASE FILE card", "exports/telegram/card-case-file-wide-1200x675.png", "docs/design/brand-v1/proofs/social-v1/case-file-wide-1200x675.png", ["Telegram message media"]),
        ("telegram-card-rat-found-square", "Telegram representative RAT FOUND SOMETHING card", "exports/telegram/card-rat-found-square-1080.png", "docs/design/brand-v1/proofs/social-v1/rat-found-square-1080.png", ["Telegram message media"]),
    ]
    for name, role, rel, source, surfaces in platform_copies:
        records.append(record(name, role, rel, [source, social_doc, language_doc], surfaces, "Deterministic export of approved Social V1 proof; one extra bottom capture row is removed when present. Fixture remains DEMO / NON-LIVE.", "canonical"))

    records.append(record("pressure-tests", "multi-context diagnostic contact sheet", "exports/proofs/pressure-tests-1800x1600.png", [rat, logo_doc, social_doc, language_doc, template_html, template_css, "docs/design/brand-v1/proofs/social-v1/receipt-square-1080.png", "docs/design/brand-v1/proofs/social-v1/case-file-wide-1200x675.png"], ["review only"], "Diagnostic only; simulates circular avatar crops, X-style header/profile, Telegram card, OG preview, mobile feed, and dark/light page contexts.", "candidate", include_fonts=True))

    return {
        "schemaVersion": "binrat.brand-export/1",
        "status": "DISTRIBUTION_PACK_V1",
        "authority": {
            "branch": AUTHORITY_BRANCH,
            "commit": AUTHORITY_COMMIT,
            "ratZeroSha256": EXPECTED_RAT_ZERO_SHA256,
            "geistCommit": GEIST_COMMIT,
        },
        "generation": {
            "command": GENERATION_COMMAND,
            "verifyCommand": f"{GENERATION_COMMAND} --verify",
            "version": GENERATOR_ID,
            "fonts": {
                "GeistSans": GEIST_SANS_URL,
                "GeistMono": GEIST_MONO_URL,
                "vendored": False,
            },
        },
        "records": records,
    }


def write_manifest() -> None:
    EXPORTS.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest()
    (EXPORTS / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def verify_manifest() -> None:
    manifest_path = EXPORTS / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit("exports/manifest.json missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != "binrat.brand-export/1":
        raise SystemExit("unexpected manifest schema")

    records = manifest.get("records", [])
    if len(records) != 27:
        raise SystemExit(f"unexpected manifest record count: {len(records)} != 27")
    names = [rec.get("name") for rec in records]
    paths = [rec.get("path") for rec in records]
    if len(names) != len(set(names)):
        raise SystemExit("duplicate manifest record name")
    if len(paths) != len(set(paths)):
        raise SystemExit("duplicate manifest output path")
    for rel in paths:
        if not isinstance(rel, str) or not rel.startswith("exports/") or ".." in Path(rel).parts:
            raise SystemExit(f"manifest output escaped exports/: {rel!r}")

    required = {
        "name", "role", "dimensions", "sourceAssets", "sourceHashes", "outputHash",
        "intendedSurfaces", "backgroundAssumptions", "status", "generation", "path",
    }
    for rec in manifest.get("records", []):
        missing = required - rec.keys()
        if missing:
            raise SystemExit(f"manifest record missing keys {rec.get('name')}: {sorted(missing)}")
        path = ROOT / rec["path"]
        if not path.is_file():
            raise SystemExit(f"manifest output missing: {path}")
        got_hash = f"sha256:{sha256(path)}"
        if got_hash != rec["outputHash"]:
            raise SystemExit(f"output hash mismatch {rec['name']}: {got_hash} != {rec['outputHash']}")
        got_size = list(png_size(path))
        if got_size != rec["dimensions"]:
            raise SystemExit(f"dimension mismatch {rec['name']}: {got_size} != {rec['dimensions']}")
        for src, expected in rec["sourceHashes"].items():
            if expected.startswith("sha256:"):
                got = f"sha256:{sha256(ROOT / src)}"
                if got != expected:
                    raise SystemExit(f"source hash drift {rec['name']} / {src}: {got} != {expected}")

    if any(EXPORTS.rglob("*.woff")) or any(EXPORTS.rglob("*.woff2")) or any(EXPORTS.rglob("*.ttf")) or any(EXPORTS.rglob("*.otf")):
        raise SystemExit("font binary unexpectedly present in exports")
    if any(EXPORTS.rglob("*.svg")):
        raise SystemExit("SVG unexpectedly present in export pack")

    print(json.dumps({
        "verify": "PASS",
        "records": len(manifest["records"]),
        "manifest": str(manifest_path.relative_to(ROOT)),
        "ratZero": EXPECTED_RAT_ZERO_SHA256,
        "generator": GENERATOR_ID,
    }, indent=2))


def generate() -> None:
    require_sources()
    clean_owned_outputs()
    make_rat_derivatives()
    copy_social_exports()
    render_browser_exports()
    write_manifest()
    verify_manifest()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Render deterministic BINRAT Brand V1 distribution assets")
    parser.add_argument("--verify", action="store_true", help="verify an existing export pack without rewriting it")
    args = parser.parse_args()
    if args.verify:
        require_sources()
        verify_manifest()
    else:
        generate()
