# BINRAT Visual Lab V2 — review evidence

Branch: `feat/binrat-visual-lab-v1` · PR #166
Starting reference: `53776e3b5402eeb05fa4154e39e77d8c19b933d9`
Review date: 2026-10-08

## PLAN — diagnosis from the two supplied images

Both the approved reference and current screenshot were opened before editing.
The requested branch was fetched into an isolated worktree because the primary
checkout contained unrelated work. Its starting HEAD matched the supplied SHA.

The five highest-impact differences were: competing dashboard panels; uniformly
opaque materials without directional edges; a CSS ellipse in place of Case art;
tiny typography and simultaneous evidence competing with the explanation; and
separation between the character/environment and the interface. Mobile needed
its own scene opening and readable vertical journey.

## CHANGESET

Only the isolated Visual Lab and its artwork/checks changed:

- `web-v2/src/VisualLab.tsx`: discovery rail, illustrated dominant Case, distinct
  journey views, receipt inspection, keyboard behavior, compact Crew control,
  truthful Watch access boundary, material controls behind `?visualDebug=1`.
- `web-v2/src/visual-lab.css`: hero/evidence/control material primitives,
  directional pearlescent edges, modern 14–16px body type / 12px metadata,
  mobile and tablet compositions, reduced-motion behavior.
- `web-v2/src/visual-lab-fixtures.ts`: typed, explicitly synthetic Case records;
  per-Case facts, provenance, history and Watch availability.
- `web-v2/checks/check-visual-lab.mjs`: retain isolation and artwork checks;
  update obsolete animation/placeholder assumptions and invoke fixture checks.
- `web-v2/checks/check-visual-lab-fixtures.ts`: validate Case graphs, references,
  address matches, chronology, unknown history and shared-record consistency.
- `web-v2/checks/visual-lab-browser.cjs`: repeatable browser proof and screenshots.
- `web-v2/public/visual-lab/case-scenes/case-neon-alley.webp`: optimized delivery
  copy of the existing PNG; original bytes preserved.
- `web-v2/public/visual-lab/README.md`: record artwork use and delivery provenance.
- `web-v2/checks/visual-lab-v2-review.md`: this review.

No production route, API, read-plane contract, token-economics file, dependency
manifest, lockfile, or unrelated WIP was changed. No new artwork was generated.
No merge or production deployment was performed.

## VERIFY — actual built application

The frozen repository lockfile was installed with scripts disabled. Local
Chromium used the CI-pinned Playwright **1.56.1**, browser **141.0.7390.37**.
Ubuntu 26.04 is not recognized by that Playwright version, so the documented
runner command below selects its Ubuntu 24.04 binary. Browser execution worked.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --dir web-v2 check
pnpm --dir web-v2 preview --host 127.0.0.1 --port 4187
# In another terminal, with Playwright 1.56.1 installed in the isolated runner:
NODE_PATH=/tmp/binrat-visual-lab-runner/node_modules \
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 \
BINRAT_PREVIEW_URL=http://127.0.0.1:4187 \
node web-v2/checks/visual-lab-browser.cjs
git diff --check
```

Results:

- Existing evidence semantics/integrity: PASS.
- Original artwork: all ten PNG byte counts and SHA-256 hashes preserved.
- Typed fixture graphs and truthful unknown-history/Watch boundaries: PASS.
- TypeScript and Vite production build: PASS.
- Browser: all **17 check groups** PASS; zero console errors, failed requests,
  page exceptions or evidence API requests in the tested flows.
- The full journey, all five Case selections, substantive tabs, receipt JSON,
  keyboard roving focus/Home/End/arrows, native details, Crew statuses,
  Watch unavailable/access-required outcomes and navigation pass at all three
  required viewports. Telegram target navigation is intercepted locally; no
  Telegram account or actual entitlement is contacted or verified.
- Reduced-motion preferences disable transitions/animations and smooth scrolling.
- No page or unexpected content overflow at 320, 360, 390, 430, 768, 1024 or
  1440px. The contained Fresh Finds rail deliberately scrolls on narrow screens.
- The material switcher is absent normally and works in explicit debug mode.

Screenshots are native Playwright captures of the Vite build, not compositions
or generated illustrations. The three comparable WHAT views all use `$MOLDY`,
Case #042, PEARL, device scale factor 1. WHAT, TRAIL, RECEIPTS, expanded receipt,
NEXT and Crew captures are available at each required viewport in:

`web-v2/browser-artifacts/visual-lab/final/`

The directory also contains `results.json`. Browser artifacts are intentionally
ignored by Git. The final handoff links them and an archive from the workspace.

## HOSTILE REVIEW — screenshot comparison and one targeted rereview

The initial browser review found a **High** defect: the primary action was below
the first desktop/tablet viewport. It was moved into the Case introduction and
the discovery rail tightened. A tablet keyboard focus race was caught by browser
testing and fixed by making focus changes synchronous. A mobile caption overlap
was corrected. The targeted rereview examined final desktop/mobile/tablet WHAT,
desktop TRAIL, desktop/mobile expanded RECEIPTS and mobile NEXT screenshots.
No further visual iteration was performed after that rereview.

| Question | Observation from screenshots / browser |
| --- | --- |
| Does the world feel integrated? | The alley remains visible on the left, through the discovery surface and around the Case; the Case illustration repeats that world's visual language. |
| Do the panels read as holographic? | Chromatic rims, luminous bevels and background color transmission are visible. The reference has more intricate specular/refraction detail. Owner judgment remains required. |
| Is the active Case primary? | It is the largest framed object; the rail is subordinate and Crew is collapsed. |
| Is the next action obvious? | The bright primary action is inside the Case introduction and is visible in all three required first viewports. |
| Is Rat Zero part of the scene? | The preserved transparent dumpster artwork overlaps the alley, with a substantial desktop presence and a separate mobile/tablet scene opening. |
| Is everything readable? | Body text is 14–16px and metadata is 12px or larger. Inspected receipt fields wrap within mobile width. The small mobile scene thumbnail loses scenic detail. |
| Is mobile intentionally composed? | It has a scene opening, compact rail, smaller atmospheric thumbnail, full-width action and four progression controls. Journey navigation brings the selected content into view. |
| Are interactive states truthful? | All Cases have distinct content. Unknown history stays unknown. Receipts name local synthetic provenance; Watch creates nothing in the lab. Crew capabilities match the required statuses. |

Remaining differences / defects:

- **Critical:** none found in the bounded checks and screenshot review.
- **High:** none remaining from the identified issues.
- **Medium:** the pearl treatment remains smoother and less optically intricate
  than the reference. The existing alley and Rat pose differ from the reference;
  the supplied canonical assets were reused without regeneration.
- **Medium:** the mobile scene thumbnail carries little detail. Deeper evidence
  requires vertical scrolling; desktop Case footer and some tablet evidence also
  extend below the first viewport.
- **Low:** mobile scene caption spacing is tight above the discovery rail; token
  initials are simpler than the reference's illustrated token marks.

## PERFORMANCE AND UNCERTAINTIES

All displayed images decoded successfully. The Case image is **159,034 bytes**,
compared with the archived **2,773,204-byte** PNG. Mobile skips the desktop-only
trash download. Observed image payload: **659,419 bytes mobile**, **1,176,469 bytes
desktop/tablet**. Initial measured CLS was **0.09571 mobile**, **0.00119 desktop**,
**0.00157 tablet**. Font loading causes some initial mobile reflow; this is a
remaining stability concern to assess on devices. These are one local,
unthrottled Chromium run, not field performance or a cross-browser guarantee.

Only 2–4 local backdrop-filter surfaces are active in the default view. No
animated full-screen blur/shader, continuous pointer repaint, animation library
or new UI library was introduced. Browser engine/GPU differences in blur and
color, real mobile performance, Safari/Firefox behavior, actual Telegram access
and subjective visual acceptance remain unverified.

## VERDICT

`FUNCTIONAL_VERDICT = PASS`

`VISUAL_VERDICT = CONDITIONAL`

`OWNER_VISUAL_APPROVAL = PENDING`

Overall: **CONDITIONAL**. The screenshots show a functional, materially changed
vertical slice and are evidence for owner review. They do not certify that the
subjective visual target has been achieved. No aesthetic similarity score is
claimed. Repository CI is separate from the browser and visual review evidence.

Rollback: on `feat/binrat-visual-lab-v1`, run `git revert <V2-rebuild-commit>`.
This restores the pre-rebuild Visual Lab with a new commit and preserves history.
Use the exact resulting commit SHA supplied in the final handoff/manifest.
