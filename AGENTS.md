> **Authority routing (2026-10-11):** Read [docs/CANONICAL_AUTHORITY.md](docs/CANONICAL_AUTHORITY.md) first; its product, engineering, runtime, launch and historical domain rules take precedence over *planning labels* in this branch. This file remains binding for branch-local checks/stop conditions but grants no new execution authority. Do not infer current Cloudflare, Pons or deploy status from older branch documents.

# BINRAT agent/operator tooling defaults

Scope: this repository. Select acceptance checks for the exact source, chain, frontend and environment under review; historical V2 checks do not govern React V3/Pons or self-hosted acceptance.

## Preferred path — no third-party browser agent by default

- Inspect branches, files, PRs and CI with the native GitHub integration or `git`/`gh`.
- Use the pinned Playwright runner and exact reviewed checks for the selected frontend. For React V3/Pons, start with [Pons read-integration boundaries](docs/BINRAT_REACT_PONS_READ_INTEGRATION_V1.md) and the [Case evidence contract](docs/BINRAT_SPRINT_A1_2_CASE_CONTRACT.md), then reconcile the selected source and receipt. For a self-hosted task, also use that worktree's migration proofs located by the router. A historical plan or test command is not a new work order.
- **Historical Arc/V2 gate only:** `node web-v2/checks/live-candidate-smoke.cjs` targets the old Cloudflare endpoint, requires chain 5042 and the V2 DOM. It must not be run as a Pons 4663, React V3 or self-hosted acceptance gate. Any current live check requires its own exact target and authorized request budget; use direct read-only HTTPS through `curl` or Playwright's request client, forwarding only authorized public GETs.
- For current external reference material, prefer primary sources and built-in web search if available.
- Do **not** use TinyFish or another third-party web/browser agent by default. If a native route is genuinely blocked, report the limitation instead of silently introducing an external tool or extra cost.

## Evidence / release constraints

- LIVE and DEMO must remain isolated. Missing, stale, or invalid LIVE evidence fails closed; never fill it with fixtures.
- Historical V2 health sampling required two consecutive healthy snapshots within its bounded preflight. It does not authorize polling a current endpoint; current release/restore acceptance uses its own reviewed freshness and request limits.
- Historical V2 screenshot gates used 390px and 430px phone, 1024px tablet, 1440px desktop, plus separate DEMO 320px, 360px and 768px checks. React V3 and migration tasks use their exact visual/runtime acceptance contracts.
- V2 release-candidate CI is **read-only** against the existing public API. Do not infer deployment authority from a green build. No merge, production cutover, token launch, signing, or fund movement without specific owner authorization.
- Prefer small diffs, exact-head CI, one bounded hostile review, then closure or an explicit blocker.
