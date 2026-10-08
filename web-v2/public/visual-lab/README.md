# BINRAT original artwork

The ten PNGs are byte-for-byte copies of the local recovered source pack.
`originals.json` records source filenames, SHA-256, dimensions and actual alpha
ranges. The two duplicate source downloads and complete UI mockup are excluded.

`scene/` contains empty desktop and mobile alleys. `foreground/` contains two
alternative Rat Zero dumpster poses and a transparent trash layer. Only the
`ratzero-dumpster-desktop` pose is mounted, with two responsive delivery sizes.
The original canonical crew assets under `web/assets/crew/` remain unchanged.

`case-scenes/` and `decals/` are archived only, with no UI integration. Case
filenames describe proposed organization; their props do not establish evidence
or a case type. None of the artwork provides data, statuses, controls or proof.

WebP delivery copies use Pillow's WebP encoder at quality 88, method 6. The
desktop alley retains 1672px width; mobile alley is 784px, Rat Zero is 720px or
448px, and trash is 1600px. Downsampling uses Lanczos and preserves alpha. PNG
originals are never re-encoded. Relative Vite imports bundle only these five
delivery images because this app's `publicDir` points to `../web/assets`.
