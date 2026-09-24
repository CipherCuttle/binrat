# BINRAT G2 — One bounded hostile review

Date: 2026-09-24. Baseline: `c13310bc3ab425563e5e1d11498fe53e4b2a8500`, [CI 36016925271](https://github.com/CipherCuttle/binrat/actions/runs/36016925271): SUCCESS (repository, V2, desktop 1024/1440, responsive 320/360/390/430/768/1024/1440, mocked LIVE G2 320/390/1024).

H1 HIGH: Desktop status rail inferred UNVERIFIED coverage when Feed unavailable. Fix: explicit UNAVAILABLE; preserve valid UNVERIFIED only when the Feed actually says so.
H2 HIGH: Default DEMO preview had no visible route to independently sourced LIVE evidence. Fix: visible desktop and phone source switch preserving exact path; separate e2e test proves LIVE GET and return control.
M1: Hero's static RECORDER ACTIVE/INDEX READY was false if all sources failed. Fix: read-only label and source-relative state.
M2: Invalid address was labeled valid but out-of-shortlist. Fix: distinguish malformed, valid unranked and ranked.
M3: Mobile More used legacy noncanonical rat. Fix: mount original approved red-eye rat everywhere.

Previously closed: independent Feed/Radar failure states, no LIVE→DEMO substitution; empty activity vs unavailable; full-identifier copy and independent checkpoints; saved out-of-shortlist deep-link retention.

Residual art/perf gate: Canonical character/dumpster (3.3 MB) and world sunset (2.1 MB) are exact owner-approved Git blobs used provisionally in V2. Final optimized responsive derivatives, clean transparent rat/dumpster foreground, empty unlettered CRT, physical paper frames and exact eight-panel reference binary still need production asset preparation and owner visual approval. CSS frames remain functional scaffolds. No Rive, deploy, merge, token or fund action.

Targeted rereview: require green follow-up full CI/browser run on review-fix commit, explicit exact address and DEMO→LIVE checks; otherwise ENGINEERING INCOMPLETE. This document records one hostile pass; do not restart a review loop.
