# BINRAT — ENGINEERING STACK NORTH STAR V1

**Founder-confirmed engineering direction:** 2026-10-11.
**Scope:** Product engineering, signal flow, agent/tool choices, measurable quality, and infrastructure cost discipline.
**Authority:** Delegated **engineering/technology domain** under the [single Canonical Authority Index](CANONICAL_AUTHORITY.md), alongside [Founder North Star](BINRAT_FOUNDER_NORTH_STAR.md) (product) and [Agent Work Policy](AGENT_WORK_POLICY.md) (execution). This is a **decision contract and target architecture, not a statement of deployed capabilities or permission to install, migrate, merge, spend, or deploy.**

## 1. Engineering thesis

**Build an evidence-first, deterministic forensic engine with selective, bounded specialist reasoning — not a heavyweight swarm of LLM agents.**

Product loop: **FIND → EMPLOY → LEAVE → RETURN**.
Forensic loop: **SNIFF → REMEMBER → INVESTIGATE → WATCH → ALERT**.
Human-facing result: **WHAT HAPPENED → WHY CARE → WHAT NEXT?**

The collector is Rat Zero's eyes, not the product. Receipts/chain facts are authoritative; copy, LLMs and Rat personalities never are. Financial FOMO, inferred real-world wallet ownership, predictive returns, BUY/SELL/SAFE/RUG conclusions and manufactured signals remain disallowed without separately verified claim authority.

## 2. Canonical signal and job flow

```text
Pons / chain observations
  → validate chain, source, identity, block/log and provenance
  → idempotent durable evidence in SQLite (handle reorgs and checkpoint authority)
  → source-bound Case projection with coverage/freshness and exact receipts
  → deterministic change detection / relevance / suppression rules
  → persisted, cancelable, budgeted Rat job (only when warranted)
  → typed specialist handoff sharing the original authority and budget
  → transactional job/outbox transition and recoverable notification
  → exact Web Case / Telegram return with plain-language finding or honest UNKNOWN
```

**Never confuse stages:** no arrival = NO_EVENT_YET; unavailable source = SOURCE_UNAVAILABLE; stale verified snapshot = STALE; failed identity/provenance = BLOCK; no real persisted event/job/alert = do not call it LIVE. No inference of complete absence from partial historical coverage.

Design for one writer and multiple readers; explicit transactions, restart recovery, stable idempotency IDs, reorg quarantine, and independently rederived evidence identities. Delivery cannot be asserted exactly-once merely because a local outbox is durable; ambiguous external acknowledgements remain uncertain and do not trigger unsafe retries.

## 3. Approved lean substrate — preserve, do not rewrite

- **Blockchain interface:** existing `viem` and typed ABI/event handling. Real archive/log access remains a **provider capability**, not a library feature.
- **Canonical evidence and jobs:** existing SQLite / `better-sqlite3` approach, with WAL/read-write boundaries and tested snapshot/backup recovery. No separate DB or message broker by default.
- **Service / presentation:** existing Node API, reviewed React V3 and verified Case/read-plane contracts. Caddy/Compose **only as validated deployment packaging**; do not treat an offline pack as public deployment authority.
- **Evidence semantics:** strict source/claim boundary, replay, canonical receipts, freshness, coverage, and role-scoped data projection.

**Candidates, NOT yet adopted by this document:** Zod (only for missing runtime contract validation), Pino (only for missing structured logs/redaction), SQLite FTS5 (only if query evaluation justifies it). Verify equivalent existing implementation and trial one scoped change before new dependencies.

**Explicit default rejection:** Redis, Kafka, Temporal, Kubernetes, distributed queues, new graph DB, hosted vector DB, LangGraph/Paperclip/Hindsight agent runtime, general production MCP mesh, uncontrolled autonomous agents, and new paid observability/search stacks. Reopen one choice only with an objective bottleneck, baseline, bounded experiment, operational fit and owner approval.

## 4. Tooling policy — local development or CI, never assumed production deps

| Candidate | Decision | Measurable reason / gate |
| --- | --- | --- |
| fast-check | **P0 TRIAL** | Property-based duplicate/reorg/job budget/crash invariants; retain only if it catches a missing class of bugs |
| Biome | **P0 TRIAL** | Faster deterministic TS/React checks with no disruptive mass reformat |
| actionlint | **P0 TRIAL** | Check GitHub Actions syntax/semantics and guard risky workflow regressions |
| OSV-Scanner | **P0 TRIAL** | Lockfile vulnerability triage with bounded CI runtime and zero new subscription |
| React Doctor | **P1 CANDIDATE** | Measure actionable accessibility/perf issues on actual React V3 |
| Knip | **P1 CANDIDATE** | Prove safe removal of genuinely unused code/dependencies, respect dynamic imports |
| Promptfoo | **P1 CONDITIONAL** | Offline/approved-cost evaluation only when an LLM Rat is used; fixture provenance and separate grading |
| CodeQL / OpenSSF Scorecard | **P2 CANDIDATE** | Supply-chain baseline, subject to project eligibility, noise and CI cost |

At most **three** tools in the first bounded trial. For each: verify current maintenance, license, source provenance, security, dependency footprint, compatibility and actual benefit. No automatic global installation; pin versions and record lockfile changes.

### Agent skills / MCP / workflow tools

- **Worktrunk**: conditional developer-side worktree convenience; never replaces branch/merge permissions.
- **SkillSpector**: conditional static screening of third-party skills. Passing a scanner is not blanket trust.
- **Graphify, RTK, QMD**: optional isolated trials for navigation, concise tool output and local document search, respectively. Avoid irreversible log compression, uncontrolled local-model RAM usage and unverifiable generated context.
- MCP plugins are **developer-side adapters** by default; no live Rat may discover new tools or autonomously elevate authority. Treat tool responses and token metadata as untrusted input.
- Skills are small reviewed instructions with explicit tool/scope budgets. Do not install a general agent framework just to manage Codex.

## 5. Objective quality gates

1. **User value:** Every change names one concrete user decision/outcome, baseline, and kill condition. Avoid optimizing raw event/hash counts.
2. **Source truth:** Zero unsupported claims in frozen acceptance Cases; explicit UNKNOWN and coverage. Original evidence digests, chain identities and chronology independently verifiable.
3. **Durability:** Stable IDs, property-based replay/reorg/duplicate tests, job admission/cancel/budget tests, process crash/restore and outbox recovery.
4. **Signal quality:** Freeze a representative real-Case baseline *before* changes; independently evaluate usefulness, novelty, actionability, false alerts and the user's next action. An initial 20 real Cases + 10 adversarial fixtures is a **proposed trial set**, not statistically significant validation, permission to invent evidence or a new approved trial budget.
5. **End-user proof:** Plain-language WHAT / WHY / NEXT and exact Case; genuine persisted owner job → leave → honest result/quiet/unknown → return. Simulation != deployed success.
6. **Security:** Use OWASP ASVS as a relevant control checklist; SLSA concepts for pinned, auditable build/provenance; dependency scanning and least-privilege secret handling. No certification claim without independent evidence.
7. **Operations/cost:** Verify memory headroom, CPU contention, startup, rollbacks, independent encrypted backup custody and retention. Measure RPC/model requests and actual dollar costs per *useful* finding, not just per request. No paid cost when price/usage is unknown.

The existing **Qnty/Frontier/other workloads on the small Hetzner VM take precedence** over BINRAT staging. A read-only API staging path with collector disabled is different from a qualified full production ingestion runtime. Do not touch other applications/services/timers.

## 6. Bounded sequence (not a perpetual optimization project)

**0. Rescue/custody:** finish independent encrypted DB and key custody; protect verified local restoration.
**1. Frozen baseline:** inventory actual source authority; capture replayable real Cases, user decisions, requests/costs and crash outcomes.
**2. Narrow contract gaps:** reuse existing guards; add only missing source/event/signal/job/handoff validation.
**3. Durable work:** demonstrate real persisted/cancelable job and transactional outbox, recovering after restart.
**4. Tooling trial:** at most three P0 tools; prove quality improvement with bounded tests, no large code churn.
**5. Real canary:** only after separately authorized *legitimate, nonbillable* log-source access; accepted new Pons event, durable storage, checkpoint/reorg and dedup proof; then a genuine user-job return.
**6. Intelligence:** independently compare useful source-backed Case decisions against the frozen baseline. Rejected, weak or unactionable signals are not promoted by better copy.

Keep these independent: **engineering readiness**, **active RPC capability**, **VM deployment**, **product LIVE status**, and **token/legal/signing authorization**.

## 7. Budget, review and hard stop

Default: **$0 new subscriptions, $0 paid RPC/model spend, no production writes, no remote VM changes, no DNS, no Telegram sends, no merge, no signing or token transactions** absent a separate explicit owner grant. A provider's existing subscription/credit is not new spending authority. Licenses may be free while running/evaluation costs are not.

Before each task freeze: USER JOB, HYPOTHESIS, BASELINE, SOURCE SHA/runtime authority, PASS, KILL, exact API/model/RPC/$/time/row budget, scope, and stop authority.

Workflow: **PLAN → CHANGESET → VERIFY → VERDICT**; implement → targeted test → **one** hostile review → fix Critical/High only → **one** targeted rereview if needed → STOP.

No retry after 403/managed challenge, no sneaky alternative RPC, no silent ledger reset, no provider fan-out or expanded sample after failures. Keep original 11/12 RPC attempt ledger intact until separately approved and independently documented; it is historical migration evidence, **not reusable allowance**. One failed hypothesis does not kill the product; two bounded attempts without materially new evidence PARK that path.

## 8. Supersession and evidence precedence

This file is the **current engineering/stack selection authority** once adopted. The [Founder North Star](BINRAT_FOUNDER_NORTH_STAR.md) continues to govern product vision and [Agent Work Policy](AGENT_WORK_POLICY.md) controls task execution. **Neither documentation nor green tests upgrade actual deployed features.** Current authorized deployments, verified source evidence, hard safety rules and owner-scoped approvals take precedence over plans.

The ArcPad-only [V0 PRD](PRD.md) is historical product scope. The [V0 public projection](PUBLIC_READ_PLANE.md) remains an **active versioned technical contract** wherever `binrat.public-feed/0.1` / `BINRAT_PUBLIC_PROJECTION_V0` is used, including Pons Case projections in the integration and portable runtime. Its identity/provenance checks, frozen `UNVERIFIED` history coverage and digest-bound receipts remain binding. Only its ArcPad-only source assumptions and no-frontend boundary are historical; a separately versioned Case envelope does not retire an existing endpoint's contract. Old architecture/roadmap proposals and status receipts remain available for forensic provenance, but are superseded where they conflict with this decision contract. Do not delete audit receipts, obscure past failed tests, or rewrite historical outcomes to make the new stack appear proven.

**Change control:** Any replacement of a frozen engineering choice requires a dated ADR stating the old decision, falsifying new evidence, candidate/baseline, constraints, trial result, approved authority and migration/rollback implications. Do not quietly change the stack through a dependency install, agent prompt or PR.
