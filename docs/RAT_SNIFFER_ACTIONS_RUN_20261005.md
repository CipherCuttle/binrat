# Sniffer comparison — one authorized Actions run

Owner requested execution on 2026-10-05 after adding `BINRAT_EVAL_OPENROUTER_API_KEY` to repository secrets.
Model/provider, request bodies, ceilings and plan remain the prepared GPT-4.1-mini / OpenAI comparison.
At most 26 sequential model requests; $0.26 full reservation; fresh dedicated nonresetting capped key required.
No merge, deployment, Telegram, account configuration changes or capital authority.

## Isolated wiring

Actions workflow exists only on `experiment/binrat-sniffer-gpt41mini-20261005`. It checks out immutable reviewed
source head `46d3ccbcf5c0158ea601f830a89d84e5512ed68b`, not the moving trigger branch. Standard actions are pinned
to commit SHAs; token permission is `contents: read`; checkout does not persist credentials. The provider secret
is exposed only to the capture step, after offline preparation verifies exact plan digest
`1392c6a092d33d8731f91a5697f5b8ac1014b901acc3165040dc414cb806b1ba`.

An ordinary publication skips the job. One explicitly authorized arming commit must have the exact message
`[run-binrat-sniffer-20261005] approved $0.26 comparison`. Only actor `CipherCuttle` and run attempt `1` qualify.
Concurrency prevents cancellation by overlapping runs. No PR, scheduled, dispatch or production trigger exists.
This push route permits an isolated experiment without registering a new manual workflow on the default branch.

**Do not rerun, delete/recreate the branch, or publish another arming marker.** Actions run-attempt guards block
reruns; the underlying runner also rejects a previously used dedicated key. Concurrency is not a persistent
cross-run lock. The orchestration publishes one arming commit only and keeps the experiment terminal afterward.
An ambiguous or rejected request halts. Failure does not authorize another experiment.

## Evidence

Every provider attempt gets a durable reservation and bounded raw response receipt. Offline audit and artifact
upload use `always()` so failed comparisons retain their evidence. Artifact includes the complete prepared plan,
source/workflow/run identity, reservations, receipts and audit score. No provider key is included.

The 2026-10-05 published runner's key policy is enforced unchanged. Missing secret, nonfresh key, unlimited or
resetting cap, wrong BYOK inclusion or inadequate remaining credit fail before model dispatch. Any such failure
is a preflight blocker, not a competence result. Provider metadata and costs remain reported, not invoice-attested.
Development-pack results do not prove generalization. An untouched holdout follows only a valid specialist advantage.

Validation passed: YAML/event/secret/permission/pin gates, embedded JavaScript/shell syntax, exact source/plan
binding, 26 mocked captures, unsafe-answer grading and duplicate-run rejection. One hostile self-review found
no unresolved Critical/High issue; one targeted rereview passed. No independent reviewer or subagent. Actual
run ID, receipt counts, costs and verdict belong in the
draft PR; no live result is claimed before inspecting those artifacts.
