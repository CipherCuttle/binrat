# BINRAT Brand V1 — Palette & Color Semantics

**Status:** FROZEN Brand V1 palette authority  
**Decision date:** 2026-10-02

This promotes the already-proven BINRAT dark / paper / dumpster / warm-accent system into named Brand V1 tokens. It is not a visual reset.

The palette is inherited from the current product and the approved Brand V1 wordmark/social proofs. The important new work is **semantic discipline**: colors may organize attention, evidence state and character, but they may not silently become safety, profitability or risk judgments.

## Core palette

| Token | Hex | Role |
| --- | --- | --- |
| **Ink** | `#101210` | canonical dark canvas / primary dark background |
| **Asphalt** | `#161916` | secondary dark background |
| **Panel** | `#1c201c` | primary UI/evidence panel |
| **Panel High** | `#242a24` | raised/selected dark surface |
| **Dumpster** | `#263b35` | branded environmental/surface green |
| **Dumpster High** | `#405a4a` | authored world / hover / environmental highlight |
| **Bone** | `#e4ddcc` | primary light foreground / canonical wordmark |
| **Paper** | `#cec6b5` | receipt/case-file artifact surface and secondary light text |
| **Muted** | `#93978d` | secondary metadata on dark surfaces |
| **Copper** | `#cf9567` | attention, discovery, focus, receipt/case accents |
| **Rat Eye** | `#ff3948` | character cue and explicit destructive/error attention only |
| **Oxidized Mint** | `#a8b795` | observed/complete/status accent when explicitly labeled |
| **Bruise** | `#9a8aa2` | unknown/unverified/status accent when explicitly labeled |
| **Line** | `#363c34` | subtle decorative separator |
| **Line High** | `#596154` | stronger decorative separator |

Canonical machine-readable tokens live in `tokens.json`. CSS aliases live in `brand-tokens.css`.

## Semantic rules

### Neutrals own hierarchy

Most BINRAT surfaces should be built from:

`Ink → Asphalt → Panel → Bone/Paper → Muted`

If a composition requires several saturated colors to remain understandable, the hierarchy is wrong.

### Copper means “look here,” not “good”

Copper is the primary Brand V1 attention color.

Use it for:

- focus;
- discovery markers;
- receipt/case details;
- selected structural cues;
- restrained campaign accents.

It never independently means:

- safe;
- profitable;
- recommended;
- bullish;
- verified-good.

### Rat Eye red is not a risk score

The red exists first because Rat Zero has an asymmetric red cyber-eye.

It may also support:

- destructive controls;
- genuine error states;
- rare urgent attention where literal copy states why.

It must not become a “rug/scam/risk” color system.

Small red body text on dark panels is discouraged even where nominal contrast passes; use Bone text with a red marker instead.

### Evidence-state colors require words

Existing evidence-state accents remain allowed:

- Oxidized Mint → `OBSERVED` / `COMPLETE`;
- Copper → `PARTIAL` / `NOTED`;
- Bruise → `UNKNOWN` / `UNVERIFIED`;
- Bone/open mark → `MISSING`.

But color is always redundant presentation.

The literal state word, icon/shape, or both must remain visible. A user who cannot distinguish the colors must still receive the same factual meaning.

Green never means safe. Red never means dangerous. Copper never means buy.

## Paper-surface rule

Paper is a **light artifact surface**, not a tinted dark UI surface.

On `Paper #cec6b5`:

- use `Ink #101210` for primary and normal-sized text;
- dark neutral separators are allowed;
- do not use Muted, Copper, Rat Eye, Oxidized Mint or Bruise as normal-sized text merely because they work on dark surfaces.

Those pairings are too low-contrast for small evidence copy.

This is especially important for RECEIPT and CASE FILE exports.

## Contrast receipt

The Brand V1 gate checks at least these text pairs:

| Foreground / Background | Contrast |
| --- | ---: |
| Bone / Ink | **13.90:1** |
| Paper / Ink | **11.08:1** |
| Muted / Ink | **6.32:1** |
| Copper / Ink | **7.30:1** |
| Rat Eye / Ink | **5.31:1** |
| Oxidized Mint / Ink | **8.85:1** |
| Bruise / Ink | **5.85:1** |
| Bone / Panel | **12.19:1** |
| Paper / Panel | **9.72:1** |
| Muted / Panel | **5.54:1** |
| Copper / Panel | **6.40:1** |
| Rat Eye / Panel | **4.66:1** |
| Oxidized Mint / Panel | **7.76:1** |
| Bruise / Panel | **5.13:1** |
| Ink / Paper | **11.08:1** |

The automated palette gate uses 4.5:1 as the minimum for normal text pairs above.

### Known non-text limitation

`Line High #596154` is only about **2.92:1** against Ink and **2.56:1** against Panel.

Therefore it is a **decorative separator**, not an accessibility-critical boundary.

Focus rings, required control boundaries and other essential state indicators must use a stronger cue such as Copper, Bone, shape, thickness or another redundant treatment.

## World-art relationship

Brand UI tokens do not flatten authored raster scenes into a 15-color illustration palette.

The approved raster world may contain richer magenta, apricot, violet, rust, teal and environmental light.

Those are **scene colors**, not automatic interface tokens.

Promoting a scene color into global UI or social semantics requires a separate Brand decision.

This prevents the roadmap world from turning every interface surface into neon scenery.

## Usage ratio

Not a literal quota, but a useful pressure test:

- dark neutrals + Bone/Paper should dominate;
- Copper should be scarce enough to mean attention;
- Rat Eye red should be rarer still;
- Mint/Bruise should appear only where a labeled state or bounded composition needs them.

If the first impression is “colorful crypto dashboard,” the palette is being misused.

## Hard rejects

Do not introduce as Brand V1 defaults:

- crypto purple/blue gradients;
- rainbow status systems;
- green = safe / red = risky;
- colored wordmark halves;
- glow used to repair weak contrast;
- low-contrast accent text on Paper;
- scene colors promoted into UI tokens without a gate;
- new near-duplicate colors for one-off cards.

## Verification

Run:

```bash
python tools/brand/check-brand-palette.py --write-report
```

The gate validates token integrity, required contrast pairs and parity with the frozen social proof palette.
