#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/design/brand-v1/proofs/wordmark-v1"
AVATAR = ROOT / "docs/design/brand-v1/proofs/identity-v1/rat-avatar-128.png"

DARK = (16, 18, 16)
LIGHT = (228, 221, 204)
PAPER = (206, 198, 181)
MUTED_DARK = (147, 151, 141)
MUTED_LIGHT = (82, 86, 80)
RED = (255, 57, 72)
LINE_DARK = (54, 60, 52)
LINE_LIGHT = (176, 169, 154)

CANON_LINE = "HE GETS THE SCRAPS. YOU GET THE RECEIPTS."


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def font(path: Path, size: int, weight: int | None = None):
    f = ImageFont.truetype(str(path), size=size)
    if weight is not None and hasattr(f, "set_variation_by_axes"):
        axes = f.get_variation_axes()
        if len(axes) == 1:
            lo = axes[0]["minimum"]
            hi = axes[0]["maximum"]
            f.set_variation_by_axes([max(lo, min(hi, weight))])
    return f


def tracked_width(draw, text: str, f, tracking: float) -> float:
    if not text:
        return 0
    return sum(draw.textlength(ch, font=f) for ch in text) + tracking * (len(text) - 1)


def draw_tracked(draw, xy, text: str, f, fill, tracking: float):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=f, fill=fill)
        x += draw.textlength(ch, font=f) + tracking
    return x


def trim_rgba(img: Image.Image, pad: int = 12) -> Image.Image:
    alpha = img.getchannel("A")
    box = alpha.getbbox()
    if not box:
        return img
    l, t, r, b = box
    return img.crop((max(0, l-pad), max(0, t-pad), min(img.width, r+pad), min(img.height, b+pad)))


def make_wordmark_a(sans: Path) -> Image.Image:
    # A / PURE — default hypothesis: the name itself is the logo.
    img = Image.new("RGBA", (1000, 220), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = font(sans, 142, 800)
    draw_tracked(d, (30, 22), "BINRAT", f, LIGHT, -5.0)
    return trim_rgba(img, 18)


def make_wordmark_b(sans: Path) -> Image.Image:
    # B / SPLIT-WEIGHT — tests a tiny structural cue without color or icon tricks.
    img = Image.new("RGBA", (1000, 220), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    heavy = font(sans, 142, 800)
    medium = font(sans, 142, 610)
    x = 30
    x = draw_tracked(d, (x, 22), "BIN", heavy, LIGHT, -4.0)
    draw_tracked(d, (x - 2, 22), "RAT", medium, LIGHT, -3.0)
    return trim_rgba(img, 18)


def make_wordmark_c(mono: Path) -> Image.Image:
    # C / MONO — control candidate; intentionally tests "forensic terminal" gravity.
    img = Image.new("RGBA", (1000, 220), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = font(mono, 124, 650)
    draw_tracked(d, (30, 31), "BINRAT", f, LIGHT, 1.5)
    return trim_rgba(img, 18)


def recolor_alpha(img: Image.Image, rgb) -> Image.Image:
    alpha = img.getchannel("A")
    out = Image.new("RGBA", img.size, (*rgb, 0))
    solid = Image.new("RGBA", img.size, (*rgb, 255))
    out.paste(solid, (0, 0), alpha)
    return out


def make_lockup(
    wordmark: Image.Image,
    sans: Path,
    mono: Path,
    *,
    background,
    foreground,
    muted,
    line,
    width=1500,
    height=380,
    compact=False,
) -> Image.Image:
    img = Image.new("RGB", (width, height), background)
    d = ImageDraw.Draw(img)
    avatar = Image.open(AVATAR).convert("RGB")

    if compact:
        a = 88
        x0, y0 = 34, (height-a)//2
        wm_h = 64
        subtitle = False
    else:
        a = 180
        x0, y0 = 54, (height-a)//2
        wm_h = 112
        subtitle = True

    avatar = avatar.resize((a, a), Image.Resampling.LANCZOS)
    d.rectangle((x0-1, y0-1, x0+a, y0+a), outline=line, width=1)
    img.paste(avatar, (x0, y0))

    # Recolor transparent wordmark for dark/light surface.
    wm = recolor_alpha(wordmark, foreground)
    scale = wm_h / wm.height
    wm = wm.resize((round(wm.width*scale), wm_h), Image.Resampling.LANCZOS)

    wx = x0 + a + (30 if compact else 46)
    wy = (height - wm_h)//2 - (20 if subtitle else 0)
    img.paste(wm, (wx, wy), wm)

    if subtitle:
        mf = font(mono, 23, 500)
        d.text((wx+4, wy+wm_h+18), CANON_LINE, font=mf, fill=muted)

        # Evidence-key cue: tiny red receipt marker, not part of the wordmark geometry.
        d.rectangle((wx+4, wy+wm_h+58, wx+16, wy+wm_h+70), fill=RED)
        ef = font(mono, 16, 550)
        d.text((wx+28, wy+wm_h+54), "RAT ZERO / BRAND V1", font=ef, fill=muted)

    return img


def make_contact_sheet(a, b, c, sans: Path, mono: Path) -> Image.Image:
    sheet = Image.new("RGB", (1800, 1460), DARK)
    d = ImageDraw.Draw(sheet)
    title = font(sans, 54, 760)
    label = font(mono, 22, 550)
    body = font(sans, 25, 450)

    d.text((56, 46), "BINRAT / WORDMARK + LOCKUP PROOF V1", font=title, fill=LIGHT)
    d.text((58, 116), "Rat Zero is frozen. This proof changes typography only.", font=label, fill=MUTED_DARK)

    candidates = [
        ("A / PURE", "Geist Sans 800 · tight tracking · no extra device", a),
        ("B / SPLIT-WEIGHT", "Geist Sans 800 → 610 · subtle BIN/RAT contrast", b),
        ("C / MONO CONTROL", "Geist Mono 650 · tests terminal/forensic overreach", c),
    ]
    y = 190
    for name, desc, wm in candidates:
        d.rectangle((54, y, 1746, y+220), fill=(28,32,28), outline=LINE_DARK)
        d.text((82, y+24), name, font=label, fill=(207,149,103))
        d.text((82, y+58), desc, font=body, fill=MUTED_DARK)
        vis = wm.copy()
        max_h = 105
        scale = min(1, max_h/vis.height)
        vis = vis.resize((round(vis.width*scale), round(vis.height*scale)), Image.Resampling.LANCZOS)
        sheet.paste(vis, (82, y+94), vis)
        y += 250

    lock_dark = make_lockup(a, sans, mono, background=DARK, foreground=LIGHT, muted=MUTED_DARK, line=LINE_DARK)
    lock_light = make_lockup(a, sans, mono, background=LIGHT, foreground=DARK, muted=MUTED_LIGHT, line=LINE_LIGHT)
    lock_compact = make_lockup(a, sans, mono, background=DARK, foreground=LIGHT, muted=MUTED_DARK, line=LINE_DARK, width=1000, height=160, compact=True)

    for name, im, top in [
        ("A / HORIZONTAL / DARK", lock_dark, 945),
        ("A / HORIZONTAL / LIGHT", lock_light, 1125),
    ]:
        d.text((58, top-28), name, font=label, fill=MUTED_DARK if top == 945 else LIGHT)
        scaled = im.resize((1350, round(im.height*1350/im.width)), Image.Resampling.LANCZOS)
        sheet.paste(scaled, (225, top))

    # Compact lockup inset over bottom of sheet.
    compact_scaled = lock_compact.resize((800, 128), Image.Resampling.LANCZOS)
    sheet.paste(compact_scaled, (500, 1320))
    return sheet


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--geist-sans", type=Path, required=True)
    p.add_argument("--geist-mono", type=Path, required=True)
    args = p.parse_args()

    if not AVATAR.exists():
        raise SystemExit(f"missing approved Rat Zero avatar: {AVATAR}")

    OUT.mkdir(parents=True, exist_ok=True)

    a = make_wordmark_a(args.geist_sans)
    b = make_wordmark_b(args.geist_sans)
    c = make_wordmark_c(args.geist_mono)

    outputs = {}

    def save(name: str, im: Image.Image):
        path = OUT / name
        im.save(path, "PNG", optimize=False, compress_level=9)
        outputs[str(path.relative_to(ROOT))] = {
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "dimensions": list(im.size),
        }
        return path

    save("wordmark-a-pure.png", a)
    save("wordmark-b-split-weight.png", b)
    save("wordmark-c-mono-control.png", c)

    save("lockup-a-horizontal-dark.png", make_lockup(
        a, args.geist_sans, args.geist_mono,
        background=DARK, foreground=LIGHT, muted=MUTED_DARK, line=LINE_DARK
    ))
    save("lockup-a-horizontal-light.png", make_lockup(
        a, args.geist_sans, args.geist_mono,
        background=LIGHT, foreground=DARK, muted=MUTED_LIGHT, line=LINE_LIGHT
    ))
    save("lockup-a-compact-dark.png", make_lockup(
        a, args.geist_sans, args.geist_mono,
        background=DARK, foreground=LIGHT, muted=MUTED_DARK, line=LINE_DARK,
        width=1000, height=160, compact=True
    ))
    save("wordmark-contact-sheet.png", make_contact_sheet(a, b, c, args.geist_sans, args.geist_mono))

    manifest = {
        "schemaVersion": "binrat.wordmark-proof/1",
        "status": "REVIEW_REQUIRED",
        "ratIdentity": {
            "asset": str(AVATAR.relative_to(ROOT)),
            "mode": "unchanged deterministic derivative from Rat Zero"
        },
        "fontSources": {
            "geistSans": {
                "path": str(args.geist_sans),
                "sha256": sha256(args.geist_sans),
            },
            "geistMono": {
                "path": str(args.geist_mono),
                "sha256": sha256(args.geist_mono),
            }
        },
        "candidates": {
            "A": "PURE — Geist Sans 800, tight tracking, no added logo device",
            "B": "SPLIT-WEIGHT — Geist Sans BIN 800 / RAT 610",
            "C": "MONO CONTROL — Geist Mono 650"
        },
        "paletteScope": "diagnostic dark/light proof only; not a new palette freeze",
        "outputs": outputs,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
