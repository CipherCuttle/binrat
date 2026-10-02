# Rat Zero Identity Proof V1

Status: **review gate** — deterministic proof assets, not a new mascot decision.

Generator: `tools/brand/generate-rat-identity-proof.py`

The proof exists to answer one question:

> Can Rat Zero itself survive profile/avatar/favicon scale, or does BINRAT need a bounded manually simplified mark?

## Outputs

Expected under `docs/design/brand-v1/proofs/identity-v1/`:

- `rat-zero-reference-768.jpg`
- `rat-profile-512.png`
- `rat-avatar-128.png`
- `rat-avatar-48.png`
- `rat-avatar-32.png`
- `rat-mono-128.png`
- `identity-contact-sheet.png`
- `manifest.json`

All are deterministic derivatives from Rat Zero. No generation, redrawing, mirroring or new pose is permitted in this proof.

## Acceptance

PASS only if:

1. the 512/128/48/32 outputs clearly read as the same individual;
2. the red cyber-eye remains on the canonical side;
3. ear/snout geometry remains distinctive;
4. 48px is usable as a social/avatar mark;
5. 32px is still meaningfully recognizable rather than generic rat/noise.

If 32px fails while 48/128 pass, do **not** replace Rat Zero. Promote a bounded manually authored simplification study as a separate candidate gate.

The monochrome study is diagnostic only; it does not establish a monochrome logo.


## Review outcome — 2026-10-02

After the first generated proof, the original avatar crop was judged too context-heavy at 32px. One bounded correction tightened the crop from `(420, 215, 1180, 975)` to `(465, 235, 1105, 875)`. No redraw, mirror, generation or identity change occurred.

Final review:

- **512 profile:** PASS — clearly Rat Zero, useful for large profile/editorial treatment.
- **128 avatar:** PASS — strong character recognition; face, ears and red cyber-eye dominate.
- **48 avatar:** PASS — remains recognizably the same Rat and retains the asymmetric eye cue.
- **32 avatar:** PASS AS FAVICON CANDIDATE — recognizable in the proof, but intentionally high-detail rather than a simplified logo. Validate once more in actual browser/social chrome before declaring a permanent tiny mark.
- **monochrome study:** DIAGNOSTIC ONLY — sufficient to test geometry, not promoted as an official monochrome logo.

### Verdict

**IDENTITY PROOF PASS.**

Rat Zero can serve directly as the social/avatar identity without inventing a replacement mascot.

A manually simplified rat-head mark is **deferred**, not authorized. Only reopen that work if real 16–32px product/browser use proves the canonical crop unreadable.

Next identity gate: combine the approved Rat Zero crop with the Geist typography system to audition the BINRAT wordmark and horizontal lockup.
