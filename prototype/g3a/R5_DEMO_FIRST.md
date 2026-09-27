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
