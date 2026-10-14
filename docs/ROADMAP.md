# BINRAT ROADMAP

Status: **FUTURE FEATURE MAP ONLY — delegated under [Founder North Star](BINRAT_FOUNDER_NORTH_STAR.md)**. This roadmap does not independently outrank founder strategy, engineering policy, verified runtime status, launch/legal gates or owner authority. See [Canonical Authority Index](CANONICAL_AUTHORITY.md).
Current capability/deployment status: **verify the current deployed runtime** `/api/capabilities` and its backing manifest/revision/freshness; this branch's snapshots and tables are dated plans, not guaranteed present capability
Language: `docs/PRODUCT_LANGUAGE.md`
Principles: `docs/PHILOSOPHY.md`

This roadmap describes product direction, not dates, guaranteed delivery, token value, or launch authorization. Public status badges must come from canonical capability state rather than this document.

## Launch-night stage truth

| Rat / surface | Current stage |
|---|---|
| Rat Zero / Scout | LIVE; runtime freshness must be established separately |
| Tripwire / Watcher | BUILDING |
| Sniffer / Trail Hunter | PROVING; no public production agent or proven prediction |
| Working Rat | PLANNED / POST-LAUNCH; `productionEntitlementActive=false` |
| Den / ORGANIZE | PLANNED / POST-LAUNCH |
| Two unnamed `?????` slots | LOCKED |

Token: `NOT_LAUNCHED`. PonsVault Staking is **required at token launch** and must be verified in the exact creation path. Staking does **not** activate Working Rat entitlement. Current wallet roles remain unresolved; historical Arc 5042 records confer no current Pons authority.

Today: `DISCOVER → OPEN CASE → CHECK RECEIPTS`. Future: `FIND → EMPLOY → LEAVE → RETURN`.

Sniffer follows evidenced funding trails; later-launch prediction remains unproven. Persistent Tripwire jobs are BUILDING. Do not render fake working jobs.

## 01 — SNIFF · LIVE

> **THE RAT CATCHES THE LAUNCH.**

Find the launch and preserve the first receipt before the trail gets rewritten.

Stable capability IDs:

- `pons_live_intelligence`
- `rats_discovery`
- `dig_case`
- `rat_radar`

## 02 — REMEMBER · LIVE

> **SITES VANISH. THE TRAIL DOESN'T.**

Keep the history, replay what was knowable at the time, and preserve evidence that later disappears.

Stable capability IDs:

- `launch_memory`
- `trash_trails`
- `replay_lab`
- `dead_drops`

## 03 — WATCH · BUILDING

> **LEAVE A TRIPWIRE IN THE TRASH.**

Notice when observed structure moves again without turning alerts into trading recommendations.

Stable capability IDs:

- `rat_watch`
- `observation_alerts`
- `trash_dna_tripwires`
- `webhook_alerts`

## 04 — HUNT · PROVING

> **POINT THE RATS AT SOMETHING WORTH DIGGING.**

Turn curiosity and degen energy into bounded evidence work.

Stable capability IDs:

- `trash_dna`
- `trash_hunts`
- `trash_bounties`
- `dumpster_raids`
- `feed_the_rat`
- `bounty_boost`
- `case_sponsor`

### Sniffer graph intelligence — RESEARCH CANDIDATE / NOT LIVE

**Hypothesis:** bounded, source-linked wallet/funding graphs can reveal *additional, useful* relations beyond the existing reported-deployer history and plain Case receipts. Graph edges are observations, not proof of common ownership or prediction. Graph analysis is subordinate to **Tripwire real-owner Watch** and the Founder's workforce MVP sequencing; it is not a token-launch gate.

- **Trial A — Graph Sniffer (P1, NOT ADOPTED):** evaluate a small read-only derived graph of wallet -> funding recipient, wallet -> verified Pons launch, and time-ordered Case relationships against the existing deterministic Case-reader baseline. NetworkX is a **possible isolated offline library**, not installed/adopted runtime infrastructure; plain TypeScript/SQL may suffice. No graph DB, runtime Python service, broad framework, permanent scanner, or new RPC permission.
- **Trial B — Historical cohort comparison (P2, CONDITIONAL):** benchmark existing indexed SQL against DuckDB on a private copy/snapshot for scoped Pons launch comparisons. Do not introduce a database or change ingestion unless a measured analysis gap exists.
- **Trial C — Statistical anomaly / selective LLM reasoning (P3, DEFERRED):** only after verified cohort coverage and actual usefulness improvement. PyOD, River and a schema-bounded TS model SDK are research possibilities; no pretrained alpha, fraud prediction, model authority, autonomous tool discovery or uncapped spend.
- **Promotion criteria:** source/identity/chronology/coverage validated; **zero unsupported claims**; at least one independently verified and user-actionable relation not already present in the baseline; measured overhead, freshness and cost; bounded real-Case comparison followed by one hostile review. If no novelty is proven, **PARK**, preserve findings, do not add dependencies.
- **Safety:** retain original chain evidence and receipts; future data never informs historical findings; provider gaps and unknown ownership stay UNKNOWN; user interest gates any Watch or alert; per-job budgets and cancellation remain enforced outside the LLM.

**First offline exploratory result (2026-10-14):** 40 captured Pons launch rows from two *selected, nonrepresentative* captures + one separate verified funding observation; 3 repeated reported addresses in those groups, **0 new verified funding-to-launch links**, and 10/10 synthetic adversarial chronology/receipt checks passed. This did **not** benchmark NetworkX or establish incremental user value. **VERDICT: GRAPH_SIGNAL_PROMOTION = NOT_YET.** See [the exact bounded trial receipt](research/GRAPH_SNIFFER_TRIAL_20261014.md). No deployed feature or new capability ID.

**Degen decides attention. Receipts decide truth.**

## 05 — ORGANIZE · PLANNED / POST-LAUNCH

> **USEFUL WORK EARNS A RECEIPT.**

Coordinate contributors without letting money, popularity or token balance buy factual authority.

Stable capability IDs:

- `rat_credits`
- `proof_of_first`
- `rat_reputation`
- `case_files`
- `creator_right_of_reply`
- `rat_den`

## 06 — AUTONOMOUS RAT · LOCKED

> **GIVE IT A CASE. IT COMES BACK WITH RECEIPTS.**

Automation can investigate, replay and distribute evidence. It never becomes evidence authority itself.

Stable capability IDs:

- `autonomous_rat`
- `rat_machine`
- `rat_lab`
- `rat_api`
- `rat_nodes`

## Permanent roadmap boundaries

- No roadmap item is a BUY/SELL recommendation, safety score, identity claim, return promise, launch date, or token-price claim.
- Economic stake may influence attention, access, priority or anti-spam cost. It does not decide truth.
- Missing evidence stays missing.
- Future observations never rewrite earlier point-in-time views.
- The public roadmap may use feral/memetic language; the factual explanation underneath must remain literal.
- Current Pons event roles remain exact. `DEPLOYER` is not silently upgraded to creator, owner, trader or human identity.
- Feature implementation plans are created only when that capability becomes active work. Backburner capabilities stay here plus their long-horizon doctrine; they do not need speculative implementation plans.
