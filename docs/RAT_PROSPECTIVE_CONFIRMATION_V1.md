# Prospective confirmation experiment V1 — preregistration

Registered before execution and outcome, 2026-10-06, stacked on draft #143.
Capture ID: `prospective-confirmation-20261006-v1`.
Verdict before outcome: **SMALL EXPERIMENT**.

## Question and selection

Can the existing deterministic pipeline observe funding, verify bounded recipient history and save a typed Sniffer → Rat Zero research handoff before a strictly later Pons launch?

Use the same previously frozen funder, `0x9bc462bce2acd6fbe2ef5470d55b439453451083`. The #143 historical control passed; one recent historical transfer was canonically verified. This justifies testing the subject again, but is not predictive success, proof of current activity or a blind holdout. Neither that transfer nor any old capture is an input to this observation. No outcome-based subject switch or selection of a known recipient. The first returned non-self qualifying candidate in ascending provider order is retained, including an inconvenient/ineligible outcome.

## Frozen protocol and original budget

Reuse `INDEXED_OBSERVATION_V1`, the V3 manifest, `observeIndexedFunding`, the secret-safe transport and the capture script unchanged. No new worker or investigation engine.

- Execution seals the exact source SHA, capture ID, policy, manifest, local creation time and manifest digest before the first RPC.
- The initial canonical head freezes the lower boundary. Discovery begins strictly after that block, never from the historical calibration window. The full block horizon remains initial head + 200,000; one-day manifest expiry is an outer bound, not the operational run length.
- Maximum **48 original reservations** across discovery, canonical funding/history, handoff and later-launch checks. Failures and uncertain reservations count. No retries, workflow reruns, resume, copied journals or replacement budget.
- Wait 60 seconds after the initial head, then observe at 60-second logical boundaries. Confirm at most **four discovery ranges**. Empty discovery will therefore usually close after about four minutes, not run for twelve minutes. The short event opportunity is a declared limitation.
- Each indexed range is bounded by 4,096 blocks, at most three pages and five transfers per page. Require 28 remaining reservations before starting another discovery range: up to 21 to a third-page candidate/handoff plus seven for an immediate positive launch verification. No guarantee of any event or eventual launch; empty later-launch checks consume the same allowance.
- Maximum **12 minutes locally**, with 15-second single-attempt HTTP limits and the existing wall/block bounds. Stop on the first candidate's ineligibility, any failure/uncertainty, exhaustion, bound or supported finding. If no launch follows the saved handoff within those bounds, retain it without a positive claim.
- Save the first handoff audit/raw prefix once, before later-launch reads. The launch must be in a block strictly after the handoff block and have a provider-reported block timestamp strictly after the saved local handoff time. Canonical receipt/log/block gates must all pass before a Case diff or `PREPARED_ONLY` notification is admitted.
- The existing named archive secret is injected only after frozen installation and offline checks. No secret in chat, command arguments, printed output or receipts. No new key, provider activation, model calls, sent alerts, capital actions, merge or deployment.

## Prespecified results and measurements

The original audit is authoritative; supplemental timing analysis never overwrites it. Replay/export and read-only SQLite inspection must agree. Preserve original Actions ZIP, raw responses, reservation statuses, registration, checkpoints, first handoff if any, final audit, hashes and summary.

Report attempts, complete/failed/pending counts, covered indexed ranges, selected funding/recipient, bounded history result, handoff, finding, Case diff and prepared/sent notification counts. Cost is unknown unless provider billing evidence is supplied; model calls remain zero.

When the relevant evidence exists, report provider funding-block timestamp, local indexed candidate receipt time, canonical funding-read time, successful funding-receipt time, saved handoff time, later-launch block timestamp and final canonical verification time. Compute detection delay, funding-to-handoff elapsed time and handoff-to-launch lead time, explicitly mixing provider timestamps and local receipt clocks where applicable. Missing stages produce **null**, not zero. A pre-handoff `LAUNCH_ALREADY_OBSERVED` result is a timing miss for this path; it does not by itself identify the cause.

Alert assessment is limited to admitted evidence: a prepared alert without a supported audited finding is unsafe and blocks acceptance. A supported audited finding establishes only the registered factual relation. Zero prepared alerts with no event gives no estimate of a false-alert rate, recall, profitability, user value or model competence. Notifications are never sent. Do not relabel zero decisions as a measured safety rate.

## Decision boundaries

- **Supported full path:** finding binds observed funding, bounded history, saved handoff and strictly later canonical Pons launch. This is one prospective factual success for the deterministic pipeline, not general model competence or permission to activate production.
- **Launch already observed / other ineligibility:** retain the first candidate and report the specific gate. Do not skip it to chase a positive.
- **Handoff without later proof:** incomplete positive path; retain the handoff, no supported launch claim.
- **Empty window:** inconclusive event opportunity. No claim of exhaustive funding absence, wallet inactivity or index freshness. Do not automatically keep repeating short empty windows.
- **Failure or uncertainty:** halt and retain all reservations. No replacement attempt. Attribution to provider lag, cadence, candidate eligibility or the engine requires specific receipts, not guesses.

Provider-indexed external native candidates are a locator with incomplete freshness guarantees. Eight pre-funding blocks cover only top-level transaction participation, not global wallet freshness or every internal transfer. Local timestamps/hashes are not external clock or consensus attestation. The historical model verdict remains `SPECIALIST_FAILED_SAFETY_GATES`; public Rat availability and token economics stay unchanged.

## Engineering gates and rollback

Small isolated changeset: this preregistration and a separately gated workflow only. Source runner, policy, fixtures, schemas and lockfile unchanged. Verify existing full-path, empty, budget, failure, checkpoint and chronology controls, build and canonical CI on the published source tree before publishing the single exact trigger commit. One bounded hostile self-review, one targeted rereview, then stop. Preserve other worktrees/WIP. Rollback the two-file experiment commit as a unit and retain receipts. The unchanged V3 journal remains auditable by the parent code.
