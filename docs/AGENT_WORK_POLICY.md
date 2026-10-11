# BINRAT — AGENT WORK POLICY (CODEx + BROWSER)

**Always read [FOUNDER NORTH STAR](BINRAT_FOUNDER_NORTH_STAR.md) first.** This is the practical short-form execution contract for any assistant, agent, Codex CLI/worktree or GitHub-browser session. Branch-specific \`AGENTS.md\`, higher-authority owner approvals and verified runtime/source evidence still apply.

## Mission-lock card (required before tools)

\`\`\`text
TRACK: PRODUCT_MVP | TOKEN_GATE | RESEARCH_ONLY | MAINTENANCE
USER JOB: In one plain sentence, what can a person do/learn afterward?
WHY THIS STEP: What single dependency of FIND→EMPLOY→LEAVE→RETURN does it close?
SOURCE AUTHORITY: repo / branch / SHA / deployment / exact receipt
BASELINE: supported facts, failed attempts and latest bounded verdicts
HYPOTHESIS: one falsifiable claim
PASS: exact evidence required
KILL: objective stop condition
SCOPE: files, services, resources and authority boundaries
BUDGET: max API/RPC/model calls, max cost, max retries, time/rows/sample
EXECUTION: PLAN → CHANGESET → VERIFY → VERDICT → STOP
\`\`\`

If USER JOB, PASS or KILL is missing, **do not invent another workstream**. Repair the plan or report BLOCKED.

## Fixed state machine

\`\`\`text
PLANNED
   ↓
IMPLEMENT / DIAGNOSE (one bounded scope)
   ↓
TEST (targeted; reuse accepted evidence)
   ↓
HOSTILE REVIEW (at most one)
   ├─ Critical/High → repair only those → targeted rereview (at most one) → STOP
   └─ none → STOP
\`\`\`

Existing green tests are *not* live product proof. Do not re-review successful finished phases or cascade from one blocker to an unrelated architecture sprint.

## Default budget and retry policy

- Unless the owner explicitly approves an exact spend/mutation, **new spend $0, paid calls 0, signing 0, broadcasts 0, Telegram sends 0, production writes 0**.
- One hypothesis and one smallest safe diff. Never invent a new provider/service/subscription to resolve a failed same-seam proof.
- A scoped blocker gets one diagnostic and one fix attempt; a second failure **closes that path** until new evidence/owner authorization.
- At most two *distinct predeclared* experiments for the same hypothesis; no retroactive sample replacement or enlarged denominators.
- Max one transient idempotent network retry *only when the documented tool budget permits*. Zero retries on challenge/403, safety/identity mismatch, uncertain send/write, token broadcast or missing source.
- State exact planned ceilings for requests/rows/time/handoffs/cost before starting. Defaults are zero external calls if none are specified. Tool budgeting must remain enforced in actual code; this policy is not runtime configuration.
- Real jobs have one owner and originating budget; a specialist handoff cannot add tools, funds, duration or call allowances.
- If the quota or source authority runs out, return **BLOCKED or NEGATIVE** with raw evidence, not a workaround.

## Hard kill rules

\`\`\`text
NO USER CONSEQUENCE       → KILL FEATURE HOOK
NO SOURCE-BACKED CLAIM    → KILL CLAIM
NO VERIFIED LIVE BEHAVIOR → DO NOT LABEL LIVE
NO BOUNDED COST/AUTHORITY → DO NOT RUN
REPEATED SAME BLOCKER     → PARK INVESTIGATION
PROVIDER CHALLENGE/403    → DO NOT BYPASS
OLD MAIN vs NEW PR DRIFT  → REPORT SOURCE AUTHORITY CONFLICT
NO MERGE/DEPLOY GRANT     → STOP BEFORE REMOTE MUTATION
\`\`\`

Concrete closed examples: J1.5 **0/8 actionable recurrence Cases** means recurrence counts cannot be the pitch; the lifecycle probe **0/4 verified within 32 calls** means archive RPC/lifecycle research is deferred, not repeated; isolated Tripwire staging deployed but its scanner RPC freshness failed, so do not silently activate watches.

## Token vs workforce authorization

**Token launch:** exact active facts, wallet, law, third-party risks, no-broadcast rehearsal and explicit one-manifest signing grant. The broader workforce is not a launch prerequisite. Never modify launch economics or interpret the user saying "go next" as transaction authority.

**Workforce MVP:** one real, owner-bounded, persistent and cancelable assignment with verified event/quiet outcome and return path. Two-Rat real handoff is the next milestone, not automatically a token blocker. Rat Zero live discovery alone is not this milestone. No unsupported claim that Working Rat/Tripwire/Sniffer/Den is public LIVE.

## Browser-agent and local Codex synchronization

- **GitHub browser agents**: read root \`AGENTS.md\`, \`README.md\`, this file, and the founder contract **on the same branch as the task**. Default \`main\` is an older backend snapshot. Reconcile relevant active PRs before making claims about current product.
- **Local Codex**: run \`git status --short\`, \`git worktree list\`, \`git rev-parse HEAD\` and read the *local* \`AGENTS.md\` before modifying anything. Protect uncommitted user work. If these docs live on a remote draft branch, **do not claim they already govern local worktrees**; explicitly sync/cherry-pick only with authorization after inspecting conflicts.
- **Agent instructions hierarchy:** branch-root AGENTS.md + the two docs + local task prompt + reviewed contracts and current verified live facts. No historic Arc-only README, synthetic tests or stale roadmap may silently supersede founder direction.
- **Never activate a later phase automatically.**

## Required end report

\`\`\`text
PLAN: user job, scope, frozen pass/kill and budget
CHANGESET: exact source files and changes; no change is okay
VERIFY: real vs synthetic; exact cases/receipts, source SHA, test counts,
        live deployed authority, request/$ usage, WIP preserved
VERDICT: GO | SMALL_EXPERIMENT | BLOCKED | PARK | KILL_HOOK
NEXT: exactly one smallest action, or STOP
STOP: no merge/deploy/migration/sign/broadcast/send unless explicitly authorized
\`\`\`

Keep final user-facing explanation short: **What did the Rat actually accomplish for a person, what is still fake/offline, and what is next?**
