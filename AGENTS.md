# Founder vision lock — applies to every agent session

**Before exploring or coding read [docs/BINRAT_FOUNDER_NORTH_STAR.md](docs/BINRAT_FOUNDER_NORTH_STAR.md) and [docs/AGENT_WORK_POLICY.md](docs/AGENT_WORK_POLICY.md).** User goal: **"a crew of Rats you can actually employ"**. Loop: **FIND → EMPLOY → LEAVE → RETURN**. Rat Zero is the on-ramp, not the whole product. Rat collaboration means typed source-linked handoffs under one enforced budget, not unlimited chats. Real MVP requires a real persistent bounded assignment and truthful return; the full workforce is *not* automatically a token transaction blocker.

At task start freeze USER JOB, evidence, exact source branch+production status, PASS, KILL and call/time/$ budget. Default: no paid calls, spending, external messages, production writes, deployments, merges, launch or signing without owner-scoped authority. One scope → targeted test → one hostile review → Critical/High fixes → at most one targeted rereview → STOP. Do not restart stale RPC/recurrent-address research without new falsifying evidence. Report actual user outcome vs synthetic proof.

## Existing branch-local technical/tooling rules (preserved)

# BINRAT agent/operator tooling defaults

Scope: this repository, including the V2 frontend and release-candidate checks.

## Preferred path — no third-party browser agent by default

- Inspect branches, files, PRs and CI with the native GitHub integration or `git`/`gh`.
- Run reproducible checks in GitHub Actions. For frontend work, use the pinned CI Playwright runner and the repository's `web-v2/checks/` scripts, not an external browser-automation service.
- For live public API checks, use direct, read-only HTTPS through `curl` or Playwright's native request client. The canonical current gate is `node web-v2/checks/live-candidate-smoke.cjs`, run after the isolated V2 build and preview start. Only public GETs may be forwarded.
- For current external reference material, prefer primary sources and built-in web search if available.
- Do **not** use TinyFish or another third-party web/browser agent by default. If a native route is genuinely blocked, report the limitation instead of silently introducing an external tool or extra cost.

## Evidence / release constraints

- LIVE and DEMO must remain isolated. Missing, stale, or invalid LIVE evidence fails closed; never fill it with fixtures.
- A single transient `SYNC_FAILED` is logged and sampled in a bounded health preflight. Acceptance requires two consecutive healthy snapshots; exhaustion blocks release. This does not repair the underlying sync issue.
- Screenshot gates: 390px and 430px phone, 1024px tablet, 1440px desktop; separate DEMO responsive checks additionally cover 320px, 360px, and 768px.
- V2 release-candidate CI is **read-only** against the existing public API. Do not infer deployment authority from a green build. No merge, production cutover, token launch, signing, or fund movement without specific owner authorization.
- Prefer small diffs, exact-head CI, one bounded hostile review, then closure or an explicit blocker.
