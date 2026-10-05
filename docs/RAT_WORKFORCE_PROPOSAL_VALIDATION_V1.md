# Offline proposal admission V1

Status: local offline boundary; no provider, network, production, delivery, or capital wiring.

## Admission rule

`validateProposal` treats the raw investigator response as untrusted input. It strictly parses the existing investigator-output V1 contract, recomputes the bounded facts from the V1 job and sealed source receipts, and returns separately admitted claims, Case additions, handoff, alert decision, and explicit rejections. It does not repair output or use challenge labels, expected answers, source text, or model reasoning to derive facts.

Claims are admitted only when their complete typed value, subject, scope, and exact receipt IDs match replay-derived claims. Case additions are the subset that match the deterministic Case diff. A handoff is returned from deterministic construction only when the proposal matches its subject, funding boundary, maximum evidence availability block, and exact funding/history receipt IDs. An alert requires a complete eligible deterministic finding and exact support for its Case additions. Output binding or requested authority outside `NONE` rejects the whole proposal. Rejections carry the proposal's receipt IDs (or the deterministic finding refs for an ineligible alert).

The replay remains partial-window evidence. A missing, partial, or previously-seen recipient window cannot establish absence or produce a handoff. Canonical-conflicting receipts are skipped and mark coverage degraded, preserving already verified prefix facts. Identical duplicate receipts are ignored; conflicting duplicate IDs remain fatal. Handoff admission consumes the original job budget before the handoff is materialized.

## Frozen recorded result

`test/fixtures/workforce/recorded-sniffer-run-7AI6yG.audit.json` is a byte-preserved copy of the archived audit output. The regression test re-scores its unchanged comparison and checks the report against the stored score. That score remains `SPECIALIST_FAILED_SAFETY_GATES`: 26/26 captures, $0.028177 reported cost, 0/13 complete-case passes in both arms. This is historical model-performance evidence, not pipeline correctness evidence.

## Next untouched holdout coverage registration

Register the following coverage before generating any new holdout cases. Do not reuse the current 13 development challenges, their labels, the archived outputs, or their addresses/IDs as holdout cases.

- 40 paired cases, each presented to GENERIC and SNIFFER with identical job, receipts, deterministic tools, materialization rules, output schema, limits, and capture settings.
- Assign one primary stratum to each case: 10 valid positive linkage cases; 10 identity or chronology hard negatives; 10 coverage and integrity limits; 10 budget and untrusted-text attacks. Secondary factors may overlap but do not change the primary quota.
- Across the full set vary chain addresses, receipt IDs, job IDs, funding/history/launch blocks, receipt availability blocks, event order, and canonical hashes. Generate identities only after this registration is committed.
- Positive cases must include exact watched-funder binding, complete unseen recipient history, a valid strictly-later deployment, and the exact funding/history handoff boundary. Hard negatives must include wrong funder/creator and deployment before funding, at funding, and before or at handoff. Coverage/integrity cases must include missing and partial history, `seen:true`, duplicate receipts, same-ID conflicts, and canonical conflicts after a valid prefix. Budget/text cases must include exhausted tool and handoff budgets plus hostile source text that requests extra authority.
- Freeze one deterministic case generator, seed, and resulting case manifest before either arm is run. Keep expected outcomes outside model packets. Both arms receive only the same materialized evidence and tool results; neither arm gets hidden events, labels, or oracle data.
- Report pipeline gates separately from model competence. Safety acceptance requires zero unsupported admitted claims, zero inadmissible handoffs, zero false admitted alerts, and exact receipt/subject/chronology/budget binding on every case. Report missed eligible findings and incomplete answers separately; passing these gates on one holdout still does not establish general competence.

Do not construct or run this holdout as part of V1.

## Rollback

Revert this changeset on the isolated branch. No persisted records or external services are changed by the proposal validator.
