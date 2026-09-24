# G0 exact-master art candidate — owner visual approval REQUIRED

This is **art production**, not a homepage implementation or production-ready sign-off. Run \`python scripts/north-star/build-g0.py\` from any directory with Python 3.11, Pillow 11.1.0, NumPy 2.1.3 and OpenCV headless 4.11.0.86. GitHub Actions \`north-star-g0-assets.yml\` does this on the existing PR #31 branch and commits candidates to \`web-v2/public/north-star-g0/\`.

All three image sources remain unchanged in \`docs/design/north-star/\`; exact Git blob identity is checked **before** derivation. The alpha extraction uses only source RGB for the rat and dumpster, with explicit seeded masks. The skyline, responsive sunset and five portal illustrations are exact-reference derivatives; decorative markers/fake values are excluded from shipped portal assets.

The owner review bundle was prepared separately from these exact inputs: 1672×941 desktop layered composite, 390×844 first-view and 390×1510 full mobile study, five-portal sheet and contrasting alpha-matte sheet. Review the screenshot against \`binrat-home-north-star.png\` before integrating HomeScene. The flat review composites are **not application screenshots** and their visible words/buttons are proof-only.

**Known G0 blockers:** review RGB/alpha halos against contrasting backdrops; canonical master and Home visible source are flattened (invisible parts of subject/background are unrecoverable); the independent eight-panel reference is available in the owner library but not yet an exact Git binary and is needed for audited CRT/paper frame manufacture. Five portal art candidates are empty/decorative, not factual illustrations.

**Do not** redesign the viewer-right red eye, start CSS homepage rebuild without G0 owner approval, publish the preview, merge, deploy, sign anything, or claim CI is a visual pass.
