# BINRAT R5 — demo-first visual repair
Owner's Android screenshots of R4 show a static-looking dark field, broad gray-purple space, dark full-hero overlay and a hard seam where the original rat image begins. R4 correctly mounted the paid component, but changed its colors/background and buried it underneath the hero's own styling.

## Exact-demo comparison (no visual reinterpretation)
- Same licensed `grain-wave-css` React Bits Starter component and pinned source installer.
- Official demo speed 0.5, wave count 25, amplitude .85, frequency 4, width 3.5, variation .006, thickness .2, grain 50, scale .6, brightness 1.
- **Official demo's displayed colors**: start `#ff6666`, end `#6666ff`, dark background `#333333`, light background `#ffffff`.
- New `?demo-isolate=1` shows the **same running component** at viewport size without the rat, branding, copy, masks or overlay. This is a direct visual gate; the original upstream demo remains authoritative.
- Normal homepage: identical component and props; no full-hero shade or custom gradient. Local copy shading only. Mobile uses two compact side-by-side actions, an unoccluded wave reveal, and a soft vertical fade into the unchanged approved rat artwork. Desktop's original photo fades from its left edge rather than hard-abutting the animated field.
- `?static-sky=1` still supported only for functional tests and low-power fallback. Reduced-motion does not mount WebGL.

## Authority and acceptance
Isolated draft visual experiment based on PR #51, NOT merged or deployed.
Tests should prove unchanged real-world Radar journey and actual moving official-canvas pixels at desktop and both Android widths; check mobile fold and both source/default and composed visual screenshots.
No claims of aesthetic equivalence to React Bits should be made until owner compares the dedicated isolate with their demo on Android.

### Portrait aspect-ratio correction
Actual post-CI inspection found that merely extending an absolutely positioned fullscreen shader behind text/photo exposes an empty dark wedge on Android: its portrait aspect ratio changes the demo wave's shape radically. The integrated portrait homepage now presents the **official component in an uncluttered ~2:1 landscape stage** between compact copy and the original rat, overlapping the artwork by 40px for a continuous fade. Desktop still uses the full hero canvas, and `?demo-isolate=1` remains the untouched full-viewport preset for direct comparison. The visual assertion now checks the dedicated stage and original rat first-fold position rather than the old 76px decorative strip.

## Final R5 isolated mobile composition (owner visual gate)

The portrait experiment that extended an absolute fullscreen shader to a tall
unoccluded strip produced an empty dark wedge. It was superseded on the
**same draft branch** by the final R5 composition: on <=760px, the paid
component runs in its own fully exposed 2:1 landscape stage (190px at 390px;
175px at 320px) between compact copy and the original pixel-art rat.
The original rat artwork enters with a 40px overlap and feathered top mask.
The desktop integrated hero retains its fullscreen official shader.

Normal mobile and desktop use the original demo speed/count/grain/wave shape
and colors, selecting the demo's dark `#333333` background for readability.
The comparison `?demo-isolate=1` keeps the exact original white/gray theme
background options and **no BINRAT artwork, shading, copy or layout crop**.

Isolated source build https://github.com/CipherCuttle/binrat/actions/runs/36302640674
passed **32/32** Playwright browser checks (plus one intentionally skipped
published check; that test runs on PR). The suite checks actual shader-frame
changes at 1440, 390 and 320 and 390/1440 demo isolates; reduced-motion
fallback, Rat Radar and historical-versus-fictional case boundaries stay intact.
Verified screenshot artifact ID 10926367498 has composed mobile 390, 320,
desktop 1440, isolate 390/1440 phase pairs, reduced-motion and full journey
states.

Public build is frozen in the branch at commit
`73c2bffcc1af8da76fb156a427c0e37b41167ff2`.
A Git comparison to PR #51 shows no paid TSX/CSS in history or diff; no license
key or source maps shipped. Owner Android review remains essential: technical
proof of animation is not visual approval. No merge or production deployment.
