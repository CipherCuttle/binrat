# G4-R2 — original Grain Wave sky (draft experiment)

Baseline: the optional CTA study on draft PR #49 at `6faec5d1a6a1920c2aa311ef6b9864854650c842`; cinematic G4-R underneath is draft PR #48. This branch **replaces** the optional header field rather than layering another effect. No merge authorization.

## Palette and illustration

The owner's supplied sky gradient is the mood authority. Deep indigo `#2b1f8f` at the top flows into violet `#7b3db3`, rose `#c060a8`, warm apricot `#f2ad63`, pale gold `#ffd08a` and a central cream `#f7ecc8` light source. Blue `#145a96` cloud masses add contrast around the untouched original rat and existing skyline.

The original SVG/CSS implementation has three broad translucent sky currents (47/55/62-second gentle transforms), a **stationary** small SVG fractal-noise grain tile and a dark scrim dedicated to the copy area. The effect is edge-to-edge inside the *hero composition* and deliberately has **no CTA/card mask**, glossy spotlight or pointer-follow. CSS gradients provide an immediate still fallback.

## Boundaries

The effect exists only in the homepage `.poster`. The top masthead has a weak **static** gradient echo. Radar, case-file paper, receipt scanner, Dig Deeper and fictional Rat Trap are unchanged and have no Grain Wave. The original rat asset, copy, module hierarchy, evidence limitations, links and actions are unchanged.

Below 760px the wave/grain/cloud intensity is lower; below 350px it drops further. `prefers-reduced-motion: reduce` disables decorative drift and retains a deliberately still sky. No WebGL, canvas, React, React Bits Pro source, licensed media, added package or runtime pointer animation.

## Gates

Run `cd prototype/g3a && pnpm install --frozen-lockfile && pnpm build && pnpm test`. The G4-R2 GitHub Actions workflow refreshes `dist/` **only on the isolated experiment branch**, executes Playwright/axe, and publishes desktop (1440), mobile (390/320), reduced-motion and Radar screenshot evidence. The draft PR checks the exact-head GitHack published journey. Inspect the screenshots and test on physical Android before giving owner visual approval.

Known limitation: SVG fractal-noise filters and `transform-box` differ slightly across browsers; verify low-end Android frame pacing. This is an isolated visual experiment, not a production style system.
