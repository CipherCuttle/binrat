# G6a art integration gate

The Svelte/CSS visual composition is staged on draft PR #53. **The eight safe binary G6 PNGs are not uploaded to GitHub**. CSS gradients keep the deployed prototype usable, but a GitHack preview of this commit is *not* proof of finished G6 art.

Copy exactly the files in `G6A_SAFE_ASSET_MANIFEST.json` from the G6 pack `source/` and `cards/` into `prototype/g3a/public/g6/` (flat, no `source/` or `cards/` suffix). `public/rat-original.jpg` must stay byte-identical with SHA-256 `43541a9b469fbe46a9b54dccb227cfb21c7fcfade1d96656410b124ded2d3edc`. Neither the dirty foreground/parchment atlases nor the review mockups belong in the app. The Radar dossier deliberately remains CSS paper.

Once PNGs are in the committed tree, rerun the build, full browser suite and desktop/390/320 screenshots. Assert all eight assets return HTTP 200 and there is no page overflow; conduct one hostile review and fix Critical/High. Keep PR draft and request owner visual approval before any merge.
