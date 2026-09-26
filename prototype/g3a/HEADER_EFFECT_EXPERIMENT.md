# G4-R / Header atmosphere study (not React Bits Pro source)

Baseline: owner-liked G4-R on draft PR #48, head f9ec83f663fe5e0446b8a1dc61ccd507bc00027d.

Reference: https://pro.reactbits.dev/docs/blocks/cta/cta-5 (public description: rounded video mask / aurora-or-ember parameters). The paid implementation is not included. This branch uses an original CSS/Svelte animation inspired by its visible concept, not a claim of exact visual equivalence.

Scope: homepage hero and subtly echoed top masthead *only*. The original rat JPEG, text, CTA layout, skyline, Radar, frozen factory receipt, provenance and fictional MOLD demonstration are unchanged.

Implementation: three composited CSS gradient fields clipped inside a rounded mask, slow transform animation, desktop fine-pointer parallax throttled to requestAnimationFrame, mobile opacity reduction, static reduced-motion fallback. No video transfer, WebGL, shader or new dependency.

Acceptance: review moving effect on desktop and a physical Android phone. Motion should remain an atmospheric layer behind the rat and wording, never a new bright interface style. In particular, read the homepage action labels at 320px, inspect reduced-motion behavior, and confirm no horizontal scroll. The G4-R base must remain separately reviewable; no merge authorized.

Verify: `cd prototype/g3a && pnpm install --frozen-lockfile && pnpm build && pnpm test`, then exact-head GitHack smoke and screenshot artifact (1440 / 390 / 320).