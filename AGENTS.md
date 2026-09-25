# BINRAT backend-only instructions

There is **no frontend and no approved design direction**. Do not reintroduce the old website, bento, North Star, Dumpster OS, visual assets, typography, palette, animation libraries or mobile layout from historical commits or other draft branches. Do not generate a replacement UI or starter skeleton without a new explicit owner request.

Backend scope: deterministic launch identity, verified ArcPad provenance, bounded reorg handling, source-bound public evidence and failure-closed unknowns. Preserve claim-boundary tests. No signing, trading, fund use, token launch or production deployment unless independently authorized.

Engineering workflow: PLAN → CHANGESET → VERIFY → VERDICT; one bounded hostile review and targeted repairs. Keep backend branch integration separate from new visual exploration. Historic source code is recoverable from Git, but has no design authority.
