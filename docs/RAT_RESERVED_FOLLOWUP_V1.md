# Reserved follow-up experiment V1 — preregistration

Registered before execution/outcome on 2026-10-06, stacked on draft #144. Capture ID `reserved-followup-20261006-v1`. **SMALL EXPERIMENT**. No old journal is continued or replenished.

#144 captured future funding and a saved research handoff about 21 seconds after the reported funding-block time. It used 32 of its 48 calls before handoff and completed three empty post-handoff ranges before exhaustion. That is detection/handoff evidence, not a supported later-launch result. Its recipient, receipts, failed model verdict and original outcome remain unchanged. The next experiment starts strictly after a new initial head and retains the same predeclared funder, not the prior recipient or a known positive transaction.

## Small isolated extension

Add `PROSPECTIVE_CAPTURE_V4` with exactly 96 original calls and `PROSPECTIVE_HANDOFF_V2` to represent that allowance. Versions 1–3 and handoff V1 retain their original bytes and 48-call meanings. Existing funding, history, canonical receipt, chronology, Pons log/block, Case and notification gates are reused. V4 rejects duplicate JSON keys. No model, delivery, capital or production authority is added. The explicit archive CLI alone can create the new manifest; ordinary keyless dispatch rejects it before reservation.

The V4 auditor bounds the receipt export at 24 MB, compared with the existing 12 MB for old versions; individual responses remain at 1 MB. Journal restoration still reaudits every request and digest against the original manifest. Registration conflict prevents upgrading an existing journal. A copied offline restoration is for audit only, never a replacement allowance.

## Frozen experiment

Use `RESERVED_FOLLOWUP_V1` and protocol `reserved-followup-v1`, sealed with exact source SHA before requests:

- Same frozen funder `0x9bc462bce2acd6fbe2ef5470d55b439453451083`; first returned non-self qualifying candidate in ascending provider order. Stop on ineligibility; no candidate/subject switch.
- New initial canonical head establishes a strict future lower block boundary. Outer manifest bounds remain one day and initial head + 200,000 blocks. Operational bounds below take priority.
- **96 original reservations maximum**, across all stages, with failures and uncertainty counted. No retries, reruns, resume, copied-journal dispatch or fresh-budget continuation.
- Wait 60 seconds after the initial head and at discovery/watch boundaries. At most **five** confirmed discovery ranges; each at most 4,096 blocks, three pages and five transfers per page. Empty opportunity normally closes after about five minutes, not twenty.
- Require **73 calls remaining** before a new discovery range: worst-case 21 to a third-page handoff + **52 reserved for later-launch verification**. The latter covers nine empty cycles at five reads each plus a positive tenth cycle at seven reads. Ten entirely empty cycles consume 50 calls. This is capacity for those reads, not a guarantee of an eligible candidate, advancing heads or a launch.
- Follow-up ends at the first supported finding, ineligibility, error/uncertainty, exhaustion, **ten confirmed empty launch ranges**, **15 minutes after handoff**, or **20 minutes total**, whichever comes first. Ten minute-spaced ranges normally cover roughly ten minutes plus request processing. This is a fixed range-count window, not an exact ten-minute wall-clock promise. Slow reads, repeated heads, range chunking and earlier bounds can shorten actual verified coverage; report it.
- A time-bound prevented request still has a counted failed reservation; raw replies arriving past the bound are retained as failed attempts and cannot admit a finding. Single-attempt timeout remains 15 seconds.
- Save the first handoff raw/audit prefix before later reads. The launch must be strictly after the handoff block and its provider block timestamp strictly after saved local handoff time. A Case diff and `PREPARED_ONLY` notification require all existing canonical gates. Nothing is sent.
- Existing named archive secret only, injected after frozen installation and offline checks. No key in chat, printed output, command arguments or receipts. No new key, provider activation, signing, broadcast, merge, deployment or production worker.

## Prespecified measurements and verdicts

Original audit and handoff prefix are retained unchanged. Pure replay, read-only SQLite inspection and offline restoration must agree. Keep original Actions ZIP, checksums, registration, raw responses, all reservation statuses, checkpoints, first handoff if present and final summary.

Report selected funding/recipient, indexed ranges, eight-block top-level history result, detection/canonical-confirmation/receipt/handoff times, available later-launch time and lead time, Case changes and prepared/sent notifications. Timing mixes provider block timestamps and local receipt clocks; it cannot allocate delay to index lag versus cadence or establish a latency distribution. Missing stages remain null. RPC cost is unknown without billing evidence; model calls stay zero.

- A supported full path is one prospective factual success for this deterministic pipeline, not causality, model competence or production readiness.
- A handoff with no supported later launch is an incomplete positive path; confirmed empty log ranges apply only to their explicit subject/block interval. The final partial interval is unverified, not a negative.
- Empty discovery is inconclusive event opportunity; do not automatically repeat it. Ineligibility retains the first selected candidate and the specific gate.
- Failure/uncertainty halts once. Unsupported Case additions or a prepared alert without an audited finding block acceptance. Zero alert decisions do not estimate false-alert rate or recall. A factual launch relation does not establish user value, profitability or willingness to pay.

Provider-indexed external native candidates have incomplete freshness guarantees. Eight-block absence does not establish global wallet freshness or all internal participation. Local hashes/clocks are not external consensus/time attestation. Historical `SPECIALIST_FAILED_SAFETY_GATES`, public Rat status and token economics remain unchanged. More capacity does not guarantee a launch.

## Engineering gates and rollback

Verify a synthetic fifth-range third-page candidate followed by a tenth-cycle launch at no more than 96 original calls; ten empty follow-up ranges without admission; finite empty discovery; limits/failures/uncertainty; unchanged old budget rejection and frozen-file bytes; pure replay/restore; keyless V4 dispatch prevention; handoff-before-later-read checkpoint. One hostile self-review, fix Critical/High, one targeted rereview, then stop. Require canonical CI on the published source tree before the single exact trigger commit.

Rollback the extension commit as a unit and retain all new/old raw artifacts. V4 artifacts require the matching V4 reader for replay; the parent reader still audits old versions and correctly refuses new ones. No retargeting, merge or deployment authority follows from green checks.
