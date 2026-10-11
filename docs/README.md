# BINRAT — document entrypoint (React / Pons integration branch)

**START: [CANONICAL AUTHORITY INDEX](CANONICAL_AUTHORITY.md).** This is the single place that resolves which documents may govern which decision. A document saying “CANONICAL”, “LIVE”, “CURRENT” or “FROZEN” is not automatically authoritative outside its exact version/domain.

## Delegated authority — read only what your task requires

| Domain | Authority |
| --- | --- |
| Product vision, Rat roles, user-facing MVP and strategic sequence | [Founder North Star](BINRAT_FOUNDER_NORTH_STAR.md) |
| Engineering stack, signal flow, quality, development tooling and cost | [Engineering Stack North Star](ENGINEERING_STACK_NORTH_STAR.md) |
| Agent task scope, test/review cadence and zero-spend defaults | [Agent Work Policy](AGENT_WORK_POLICY.md) + [branch AGENTS](../AGENTS.md) |
| Factual on-chain truth / allowable inference | [Claim Boundary](CLAIM_BOUNDARY.md) + exact source-bound verified Case/chain evidence |
| Actual production functionality | **Current verified deployed version, API/status/capabilities and receipts**, not committed docs or snapshots |
| UX/brand/copy | Exact owner-approved visual/source freeze and [Product Language](PRODUCT_LANGUAGE.md) for its original scope; never override runtime truth |
| Token mechanics/signing | Exact reviewed Pons plan, gate matrix, legal/owner authority and current receipts; never authorize from docs alone |
| Self-hosted migration/recovery | Exact local verified migration proof and current VM observation; **not** this branch's historical Cloudflare snippets |

## Explicit historical or limited-scope files

- [ArcPad V0 PRD](PRD.md), [ArcPad V0 Public Read Plane](PUBLIC_READ_PLANE.md), [V0 Code Plan](CODEPLAN.md), [Arc Intelligence V1](INTELLIGENCE_V1.md), [Roadmap V0](ROADMAP_V0.md) — historical context/evidence, **not** today's product/chain/engineering instructions.
- [Roadmap](ROADMAP.md) — **future feature map**, subordinate to Founder North Star and verified live capability.
- [Philosophy V0](PHILOSOPHY.md) — durable evidence principles, **not** a complete current architecture or token execution grant.
- [Launch Night Canon V1](BINRAT_LAUNCH_NIGHT_CANON_V1.md), [Token Launch Doctrine](TOKEN_LAUNCH_DOCTRINE.md), [capability-manifest snapshot](CAPABILITY_MANIFEST_V0.json) — scoped plans and historic/draft source data; exact verified runtime/launch gate evidence and owner grant decide actions.

**Branch warning:** This documentation PR does not update GitHub `main`, the local `migration/binrat-survival-v1` worktree, deployed Cloudflare Worker, Hetzner VM, canonical database, DNS or provider costs. An unmerged draft PR is an audited proposal, not adopted across branches.

Do not merge, deploy, publish, sign, or execute a token transaction without separate owner authorization.
