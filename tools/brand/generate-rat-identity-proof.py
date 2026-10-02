#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs/design/brand-v1/canon/rat-zero.jpg"
OUT = ROOT / "docs/design/brand-v1/proofs/identity-v1"

EXPECTED_SOURCE_SIZE = (1536, 1536)

# Explicit, reviewable source-space crops. Never mirror Rat Zero.
PROFILE_CROP = (350, 180, 1230, 1060)  # 880x880, character + some dumpster context
AVATAR_CROP = (420, 215, 1180, 975)    # 760x760, face/ears/paws emphasis

BG = (16, 18, 16)
PANEL = (28, 32, 28)
BONE = (228, 221, 204)
MUTED = (147, 151, 141)
ORANGE = (207, 149, 103)
LINE = (54, 60, 52)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def crop_square(img: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    left, top, right, bottom = box
    if right - left != bottom - top:
        raise ValueError(f"crop must be square: {box}")
    if not (0 <= left < right <= img.width and 0 <= top < bottom <= img.height):
        raise ValueError(f"crop outside source: {box} vs {img.size}")
    return img.crop(box)


def save_png(img: Image.Image, path: Path) -> None:
    # optimize=False keeps output deterministic across the pinned Pillow version.
    img.save(path, format="PNG", optimize=False, compress_level=9)


def fit(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.contain(img, size, Image.Resampling.LANCZOS)


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill=BONE) -> None:
    draw.text(xy, text, font=ImageFont.load_default(), fill=fill)


def make_contact_sheet(
    full: Image.Image,
    profile: Image.Image,
    avatar128: Image.Image,
    avatar48: Image.Image,
    avatar32: Image.Image,
    mono128: Image.Image,
) -> Image.Image:
    sheet = Image.new("RGB", (1600, 1040), BG)
    d = ImageDraw.Draw(sheet)

    label(d, (42, 26), "BINRAT / RAT ZERO / IDENTITY PROOF V1")
    label(d, (42, 48), "Deterministic crops only. No redraw. No mirror. No generated mascot.", MUTED)

    # Full-source reference.
    d.rectangle((40, 90, 660, 710), fill=PANEL, outline=LINE)
    full_fit = fit(full, (590, 590))
    sheet.paste(full_fit, (55 + (590-full_fit.width)//2, 105 + (590-full_fit.height)//2))
    label(d, (55, 680), "RAT ZERO / full-source reference")

    # 512 profile.
    d.rectangle((700, 90, 1238, 628), fill=PANEL, outline=LINE)
    sheet.paste(profile.convert("RGB"), (713, 103))
    label(d, (713, 606), "PROFILE 512 / source crop")

    # Monochrome proof.
    d.rectangle((1274, 90, 1560, 376), fill=PANEL, outline=LINE)
    mono_big = mono128.resize((256, 256), Image.Resampling.NEAREST).convert("RGB")
    sheet.paste(mono_big, (1289, 105))
    label(d, (1289, 350), "MONO 128 / 4-tone")

    # 128 avatar actual and enlarged.
    d.rectangle((700, 668, 1010, 1000), fill=PANEL, outline=LINE)
    sheet.paste(avatar128.convert("RGB"), (715, 695))
    enlarged128 = avatar128.resize((160, 160), Image.Resampling.NEAREST).convert("RGB")
    sheet.paste(enlarged128, (835, 695))
    label(d, (715, 870), "AVATAR 128")
    label(d, (835, 870), "128 enlarged")

    # 48 + 32 actual sizes and nearest enlarged.
    d.rectangle((1045, 668, 1560, 1000), fill=PANEL, outline=LINE)
    label(d, (1060, 687), "SMALL-SIZE SURVIVAL")

    sheet.paste(avatar48.convert("RGB"), (1062, 720))
    a48_big = avatar48.resize((192, 192), Image.Resampling.NEAREST).convert("RGB")
    sheet.paste(a48_big, (1125, 720))
    label(d, (1062, 778), "48 actual")
    label(d, (1125, 920), "48 enlarged")

    sheet.paste(avatar32.convert("RGB"), (1340, 720))
    a32_big = avatar32.resize((192, 192), Image.Resampling.NEAREST).convert("RGB")
    sheet.paste(a32_big, (1384, 720))
    label(d, (1340, 762), "32 actual")
    label(d, (1384, 920), "32 enlarged")

    d.line((40, 735, 660, 735), fill=ORANGE, width=2)
    label(d, (42, 755), "PASS QUESTIONS", ORANGE)
    questions = [
        "1. Same individual at 512 / 128 / 48 / 32?",
        "2. Red cyber-eye survives without changing sides?",
        "3. Ears + snout remain distinctive at feed/avatar scale?",
        "4. Does 32px still read as BINRAT, not generic rat/noise?",
        "5. If #4 fails: simplify manually; do not invent a new mascot.",
    ]
    y = 780
    for q in questions:
        label(d, (42, y), q, BONE)
        y += 28

    return sheet


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    src = Image.open(SOURCE).convert("RGB")
    if src.size != EXPECTED_SOURCE_SIZE:
        raise SystemExit(f"Rat Zero size drift: expected {EXPECTED_SOURCE_SIZE}, got {src.size}")

    # 1. Full source reference, bounded output.
    full_ref = src.resize((768, 768), Image.Resampling.LANCZOS)
    full_ref_path = OUT / "rat-zero-reference-768.jpg"
    full_ref.save(full_ref_path, format="JPEG", quality=92, subsampling=0, optimize=False)

    # 2. 512 profile crop.
    profile_source = crop_square(src, PROFILE_CROP)
    profile = profile_source.resize((512, 512), Image.Resampling.LANCZOS)
    profile_path = OUT / "rat-profile-512.png"
    save_png(profile, profile_path)

    # 3–5. Avatar family shares ONE source crop.
    avatar_source = crop_square(src, AVATAR_CROP)
    avatar128 = avatar_source.resize((128, 128), Image.Resampling.LANCZOS)
    avatar48 = avatar_source.resize((48, 48), Image.Resampling.LANCZOS)
    avatar32 = avatar_source.resize((32, 32), Image.Resampling.LANCZOS)

    p128 = OUT / "rat-avatar-128.png"
    p48 = OUT / "rat-avatar-48.png"
    p32 = OUT / "rat-avatar-32.png"
    save_png(avatar128, p128)
    save_png(avatar48, p48)
    save_png(avatar32, p32)

    # 6. Monochrome / silhouette-pressure study: preserve geometry, remove hue.
    mono = ImageOps.autocontrast(ImageOps.grayscale(avatar128))
    mono = mono.quantize(colors=4, method=Image.Quantize.MEDIANCUT).convert("L")
    mono_path = OUT / "rat-mono-128.png"
    save_png(mono, mono_path)

    # 7. Contact sheet.
    contact = make_contact_sheet(full_ref, profile, avatar128, avatar48, avatar32, mono)
    contact_path = OUT / "identity-contact-sheet.png"
    save_png(contact, contact_path)

    outputs = [
        full_ref_path,
        profile_path,
        p128,
        p48,
        p32,
        mono_path,
        contact_path,
    ]

    manifest = {
        "schemaVersion": "binrat.identity-proof/1",
        "source": {
            "path": str(SOURCE.relative_to(ROOT)),
            "dimensions": list(src.size),
            "sha256": sha256(SOURCE),
            "mirrored": False,
        },
        "crops": {
            "profile": list(PROFILE_CROP),
            "avatar": list(AVATAR_CROP),
        },
        "resampling": "Pillow LANCZOS for downscale; NEAREST only for enlarged contact-sheet inspection",
        "outputs": {
            str(p.relative_to(ROOT)): {
                "bytes": p.stat().st_size,
                "sha256": sha256(p),
            }
            for p in outputs
        },
        "verdict": "REVIEW_REQUIRED",
        "note": "No asset in this proof is a new mascot or new pose. All are deterministic Rat Zero derivatives.",
    }

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({
        "source": str(SOURCE.relative_to(ROOT)),
        "sourceSize": src.size,
        "profileCrop": PROFILE_CROP,
        "avatarCrop": AVATAR_CROP,
        "outputs": [str(p.relative_to(ROOT)) for p in outputs],
    }, indent=2))


if __name__ == "__main__":
    main()
