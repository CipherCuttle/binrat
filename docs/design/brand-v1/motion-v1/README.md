# BINRAT Motion Identity V1 — FOUND SOMETHING proof

**Prototype:** `FOUND SOMETHING → evidence → receipt → calm finish`  
**Status:** deterministic choreography proof; not a new social-template family.

## Source authority

This proof only moves already-approved Brand V1 raster proofs:

- `../proofs/social-v1/rat-found-wide-1200x675.png`
- `../proofs/social-v1/receipt-wide-1200x675.png`

Those source cards are demo/non-live evidence fixtures. This motion proof inherits that limitation. It must never be presented as a live finding.

No Rat redraw, vector reconstruction, procedural room art or generated cyberpunk background is introduced.

## Choreography

Runtime: **6.4 s** at **30 fps**.

- **0.00–0.70** — darkness gives way to the Rat side of the canonical card.
- **1.00–1.38** — the literal/evidence side resolves.
- **1.38–3.10** — reading dwell; no decorative escalation.
- **3.10–3.52** — canonical RECEIPT card enters from below.
- **3.52–4.95** — one damped settle; then still.
- **5.05–5.40** — transition to the full canonical RAT FOUND SOMETHING card.
- **5.40–6.40** — calm final dwell.

The receipt settle is the only intentionally noticeable secondary motion.

## Prototype path

Source:

`tools/brand/render-motion-proof.sh`

Verifier:

`tools/brand/verify-motion-proof.sh`

Rendered outputs:

`docs/design/brand-v1/proofs/motion-v1/found-something-v1.mp4`

`docs/design/brand-v1/proofs/motion-v1/found-something-v1-reduced.mp4`

Manifest:

`docs/design/brand-v1/proofs/motion-v1/manifest.json`

## Render

```bash
bash tools/brand/render-motion-proof.sh
bash tools/brand/verify-motion-proof.sh
```

Requires `ffmpeg` + `ffprobe` on PATH. No npm dependency is added.

## Reduced-motion proof

The reduced render is a static 4.8-second presentation of the final approved RAT FOUND SOMETHING card.

Verification requires:

- 1200×675;
- 30 fps;
- no audio;
- exactly one unique decoded frame hash across the reduced clip.

This proves that the semantic content remains intact when all travel, settle, Rat movement and ambient movement are removed.

## What this proof does not prove

- final production timing for every social format;
- a new Rat pose;
- a reusable animated mascot rig;
- a new end-card composition;
- platform-specific encoding limits;
- suitability of GSAP, Rive or Remotion.

Those remain separate gates.

## Dependency verdict

**Use now:** FFmpeg for video output; existing `motion` package for Web-only interactive transitions.

**Do not add for V1:** GSAP, Rive, Remotion.

Re-evaluate Remotion when a real need exists for repeatable data-bound batches (many tokens/cases/platform ratios), because that is where a React composition system starts paying for its dependency and maintenance cost.
