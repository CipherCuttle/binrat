# BINRAT — agent entrypoint (founder vision first)

**READ FIRST:** [Founder North Star](docs/BINRAT_FOUNDER_NORTH_STAR.md) and [Agent Work Policy](docs/AGENT_WORK_POLICY.md).

**North star:** **A crew of specialized Rats users can actually employ.** FIND → EMPLOY → LEAVE → RETURN. Rat Zero finds Cases; Tripwire watches; Sniffer follows funding and hands off evidence; the Den will organize bounded jobs. This is the product direction; never confuse plans/offline proofs with deployed features.

**IMPORTANT REPO TOPOLOGY:** This default \`main\` checkout is an **older ArcPad/backend-only source snapshot**, *not* the current BINRAT product, visual approval, Pons 4663 runtime, or token launch authority. The previous claim "no approved frontend/design exists" applied only to old reset discussions and is **superseded as product direction** by PR #122/#148/#151 and the approved React V3 branch. Do not redesign, delete or recreate frontend assets merely because this branch lacks them. Reconcile the current relevant PR/commit and active production readback before a product claim.

**Work bounds:** PLAN → CHANGESET → VERIFY → VERDICT. One bounded implementation, targeted tests, one hostile review, fix Critical/High, one targeted rereview if needed, STOP. Every phase declares a user-facing outcome and hard kill condition before execution. Default **$0 new spend**, zero paid RPC/model calls, zero production writes, zero Telegram delivery, zero merges/deployments/signing/trading/token transactions without exact separate owner authorization. No repeated same-seam RPC/provider chase.

**Factual truth:** Source/claim boundary and original backend invariants in \`docs/CLAIM_BOUNDARY.md\` remain valid. Fail closed on unknown history, mismatched identity or stale evidence. A Pons-reported deployer address is not a human identity; same funding is not shared ownership; no BUY/SELL/SAFE/RUG conclusions.

**Agents in browser mode:** Read the same branch's AGENTS + linked founder/policy docs, then reconcile PR #123 (offline handoffs), #132/#133 (local jobs/Den), #148/#151 (launch convergence), #178 (owner-only Tripwire). Never infer production readiness from a GitHub branch or old \`main\` README. No production mutation without explicit authorization.

**Local Codex:** Your uncommitted worktree is not touched by this remote documentation branch. Before applying these docs locally, inspect \`git status\`, \`git worktree list\` and the exact diff; do not overwrite WIP.
