# BINRAT — RAT GENOME ROADMAP V1

**STATUS:** CANDIDATE (founder-approved strategic product direction; implementations and capabilities NOT approved/live)  
**DOMAIN:** Product roadmap / forensic research only  
**AS_OF:** 2026-10-23  
**SOURCE_BRANCH_SHA:** based on `main` at `3a5f53b7b5aca19c7c7ac4b5499453f224c92d96`; exact updated source is the commit containing this file  
**AUTHORIZATION_EFFECT:** NONE — roadmap documentation only; no execution, production, RPC-spend, message, signing, trading, deployment, merge, token/entitlement or capability authorization.

**Founder decision, 2026-10-23:** Lock **RAT GENOME — behavioral blockchain forensics** into the BINRAT future product roadmap, with **EXEMPT SWARM** as the first offline proof, **FIND SIMILAR** as the first intended user interaction, and carefully separated future bot, narrative, listing and alpha research. The user has approved the *direction*, not an assertion that these capabilities are built.

**Authority and precedence:** [Canonical Authority Index](CANONICAL_AUTHORITY.md) → [Founder North Star](BINRAT_FOUNDER_NORTH_STAR.md) for product priority → [Engineering Stack North Star](ENGINEERING_STACK_NORTH_STAR.md) for choices → [Agent Work Policy](AGENT_WORK_POLICY.md) for execution bounds → exact versioned source/receipts for factual capability. This plan is a **future feature map**, not a replacement for the founder's already frozen owner Rat/Tripwire MVP sequence, token/legal gates, or approved V3 art and language. Keep the existing Rat Zero → Case journey intact.

## 1. Promise: why a degen opens BINRAT

> **EVERY LAUNCH LEAVES FINGERPRINTS. THE RAT REMEMBERS.**

A user enters a token / Pons Case and asks **FIND SIMILAR**. BINRAT compares *evidenced behavior*, not just names or repeat deployer addresses. A useful result shows the observed pattern, the actual historical Cases and raw receipts, credible alternative explanations, what is unknown, and the **one next investigation** worth doing. Where evidence is absent, clearly say **UNKNOWN**. No fabricated risk score, fake bot identity, "SAFE/RUG", promised returns or speculative "alpha" label.

The product can later allow a user to **WATCH THIS PATTERN**, employing a bounded Rat that returns when independently verified future evidence warrants reopening a Case. That capability is PLANNED only and remains subordinate to the existing real owner Watch/return MVP gate.

## 2. Genome data model — observed facts before interpretation

Normalize source-bound facts with: chain/protocol/version; launch identity; contract/deployer/recipient roles; transaction hash, block number/hash and transaction/log order; immutable source & digest; observation time and cutoff; decoded event/amount/token decimals; source completeness, pagination and reorg/finality status. For each derived link preserve direction and type, e.g. `FUNDED`, `EXEMPTED`, `BOUGHT_FOR`, `TRANSFERRED_TO`, `SOLD`, `RECEIVED_PROCEEDS`.

Six proposed fingerprint families:
1. **Creator DNA:** repeat deployers, configuration, fee recipients, exemptions.
2. **Funding DNA:** visible transfers, recent funding and shared infrastructure with exchange-service false-positive controls.
3. **Trading DNA:** early `CurveBuy`/`CurveSell`, recipient-aware tax, relative transaction order and concentration.
4. **Contract DNA:** bytecode/proxy/permissions, curve version, material fee/role behavior.
5. **Liquidity DNA:** curve/graduation and supported exit/market phases; samples do not imply a complete lifecycle.
6. **Narrative DNA:** attributable public announcements and claims, official listing confirmations versus rumors, and observable development activity.

Every finding must separate **OBSERVED** / **DERIVED** / **HYPOTHESIS** / **UNKNOWN**, with point-in-time eligibility. Same funding is not common ownership; a coordinated opening is not proof of wrongdoing, and a historical reverse quote is not executable net P&L.

## 3. The first motif: EXEMPT SWARM

**Research question:** For a canonical Pons V2 launch, can BINRAT reconstruct whether source-verified launch-exempt recipients accumulated a substantial, *measured* fraction of the opening buy flow/supply during a declared early window? Can it retrieve structurally similar launches using independent addresses, without over-attribution?

**Minimum necessary evidence:**
- Canonical launch transaction and precisely decoded historical exemption set, bound to the correct factory/protocol/version.
- Canonical `CurveBuy` events (buyer AND recipient), actual amounts, order and full coverage of the chosen block/log window.
- Denominator specified in advance: percentage of *opening acquired tokens* versus *total supply* must never be silently conflated; use the supply denominator only when proven.
- Historical actual fee/tax mechanics including recipient-specific exemptions; factory current defaults cannot rewrite past launch state.
- Completeness/provenance receipt: block hash, source, range, pagination, deterministic digest and explicit missing-data flags.

**Optional stronger context (not required for basic motif):** pre-launch funding graph, recurring buyer cohort, post-buy transfer hops, selling, proceeds collector, later outcomes. Never infer these when unavailable. Post-cutoff facts belong to retrospective characterization and cannot justify what an early detector could have known.

**Detector output:** `MATCHED`, `NOT_MATCHED_WITH_COMPLETE_EVIDENCE`, or `UNKNOWN_INCOMPLETE`, an explainable set of individual predicates and their raw evidence, alternatives/benign controls, and source-bounded comparable Cases. Missing required logs or mismatched identity must fail closed.

## 4. Phase-gated research roadmap

### GENOME-001: Offline pattern archaeology — FIRST GATE

- Inventory **actual existing** BINRAT Pons Case/A2 and Sentry Pons ABI/receipt source at exact refs. Do not assume the live trade tape or exemption list has been collected.
- Freeze a small cohort, e.g. 12 fixtures: a verified positive specimen only if independently reconstructible; legitimate-looking early activity, unrelated high-volume and deliberately incomplete/contradictory negatives/unknowns; clearly label synthetic versus captured data.
- Implement at most one deterministic EXEMPT SWARM motif in an isolated disposable offline experiment; no new agent runtime, public endpoint, paid archive subscription or production migration.
- Compare with baselines (same-deployer lookup and plain early-buy concentration). Test whether **FIND SIMILAR** discovers an independently reviewable next lead *beyond* the trivial matches.
- One targeted test run, one hostile review of temporal leakage/partial logs/role confusion/exemptions/false clustering/cost, fix Critical/High only, one targeted rereview if needed; STOP.
- **PASS (limited):** at least one source-grounded, nontrivial behavioral similarity reproducible across independent runs, evidence-linked and useful to investigate, with negatives and unknowns treated correctly. A synthetic-only success is an implementation check, not a real-world finding.
- **BLOCK:** historical exemption/event evidence cannot be acquired within separately authorized limits, source completeness unverified, or pattern reduces to a recurring-address count.
- **KILL THE HOOK:** no useful next investigation versus the existing Case or trivial baseline; do not aestheticize non-actionable data. Preserve earlier J1.5 **0/8 actionable Cases** as a real benchmark.

### GENOME-002: Behavior search — AFTER GENOME-001 PASS

Add exact motif queries to frozen historical Cases, explainable similarity with proof of precision against deliberately confusing controls, a user-visible **FIND SIMILAR** Case interaction. No arbitrary AI-generated SQL, universal risk scores, or speculative attribution. Only expand historical coverage after a measured source/cost gate.

### GENOME-003: Specialist forensics — AFTER SOURCE/UTILITY GATES

Proposed bounded roles:
- **SWARM RAT**: bot/cohort, early-buy and potential MEV behavior (do not label MEV without sufficient ordering/call-path evidence).
- **SNIFFER**: funding and token-handoff provenance with typed links.
- **CONTRACT RAT**: permissions, taxes, proxies, phase-specific mechanics.
- **NARRATIVE RAT**: attributable public web/social/repository evidence, contradictory claims, changes.
- **LISTING RAT**: public official announcement verification and rumor classification.
Each shares the originating job's authority, limits, receipts and stop reason. No autonomous public crawling or new paid services by roadmap fiat.

### GENOME-004: Pattern Watch — AFTER LIVE EMPLOY/RETURN MVP

Persist an explicit owner-authorized fingerprint job with coverage boundaries, freshness, cost ceiling, cancellation and honest NO_EVENT_YET/UNKNOWN. Trigger only when verifiable new facts satisfy a frozen motif. Return to the exact Case via the existing Web/Telegram path when independently proven; no false LIVE promotion from replay, branch or mock delivery.

### GENOME-005: Rat Lab — DISTINCT RESEARCH GATE

Test carefully preregistered *prospective* hypotheses (avoidance, discovery, execution relevance) with decision-time information only, held-out chronology, controls, missing-outcome reporting, size-aware executable quotes, full fees/taxes/gas/slippage and realistic latency when available. **ALPHA_UNPROVEN** until strict economic evidence exists. No paper leaderboard marketed as profit; no trading authority in this roadmap.

## 5. Tech and source boundaries

**Reuse first:** existing `viem` and Pons ABI events; canonical Case/provenance/digest and SQLite evidence contracts; reviewed React V3 Case pattern; Tripwire's default-off owner/local proof only as a later donor. Avoid graph DB, vector DB, LLM swarm, new indexer, paid archive or broad provider scan by default.

**Known evidence limits at planning time:** Pons launch identities and partial A2 outcomes exist in reviewed snapshots; full ordered trade tape, historical exemption sets, authoritative funding graphs, complete phase histories and source coverage are *not* established in the BINRAT production read-plane. Sentry `CurveBuy`/`CurveSell` ABI is reusable source code, not proof that BINRAT already stores those events. The previous S0 outcome research does not establish a profitable strategy. Current runtime status must be reverified before any present-tense product claim.

**Reference sources:** [BINRAT founder decisions](BINRAT_FOUNDER_NORTH_STAR.md); [engineering stack](ENGINEERING_STACK_NORTH_STAR.md); [Tripwire owner-only candidate](https://github.com/CipherCuttle/binrat/pull/178); [A2 bounded historical specimen](https://github.com/CipherCuttle/binrat/blob/7720773dc5a5c18168c54f0d8be8e9d10905a4f5/docs/receipts/sprint-a2/README.md); [Sentry Pons curve ABI](https://github.com/CipherCuttle/sentry-forensic-gate/blob/74cf98d08d232ceced34d8faea16e0c7e075dd98/src/canary/ponsE0Contracts.ts).

## 6. Success in one screenshot

**SMELLS FAMILIAR.** A user can see (1) the actual onchain sequence, (2) precisely which nontrivial conditions match older Cases, (3) coverage/unknowns, and (4) one useful evidence-backed next action. The Case is not labeled "rug", "bot", "same operator" or "profitable" solely because a structural motif matched.

**NEXT MOVE:** Design and execute GENOME-001 only under its own bounded, explicit future task grant. This document authorizes **documentation only** and does not run the proof.
