# Sniffer comparison capture runner V1

Status: IMPLEMENTED, OFF by default. No real captures or provider activation are established by this changeset.
Stacks on draft #124. Frozen workforce V1 contracts, prompts, evaluator, production entrypoints and UI are unchanged.

## Smallest isolated changeset

One explicit CLI, one OpenRouter adapter, one config schema and mocked transport tests. No SDK, dependency,
deployment configuration, production jobs, Telegram sends or capital authority. Only the CLI imports the adapter.
The adapter consumes #124's 26 counterbalanced assignments and exports its existing recorded-comparison format.
Building or preparing makes zero network requests and does not read a provider key.

## Plan before execution

Fill an operator config with an exact model ID, exact provider slug (include an endpoint variant where applicable),
expected response provider name, prompt/completion price ceilings, and an ISO UTC expiration. OpenRouter router IDs,
colon suffixes, presets, lists, custom URLs and extra settings are rejected. The provider still controls its model
implementation; a pinned ID is not an attestation of immutable weights.

Example structure below uses **synthetic identifiers, not an executable model recommendation or spend authorization**:

```json
{
  "schemaVersion": "binrat.capture-config/1",
  "modelId": "synthetic/fixed-v1",
  "providerSlug": "synthetic",
  "responseProvider": "Synthetic",
  "maxCostMicrousd": 260000,
  "expiresAt": "2026-10-06T00:00:00.000Z",
  "maxPrice": {
    "promptMicrousdPerMillion": 500000,
    "completionMicrousdPerMillion": 1000000
  }
}
```

```sh
pnpm competence:capture prepare /absolute/config.json /absolute/new-run-directory
```

Review `plan.json`: complete request bodies, model/provider/settings, prompt/evidence/request digests,
price ceilings, $0.26 total reservation, expiration, frozen pack digest and runner/schema digest.
Preparation does not authorize execution. Changes to config, requests, prompts, contracts, pack, evaluator or
runner invalidate the existing plan. Prepare and audit with the same compiled runner; #124 deliberately binds
the evaluator's loaded module text, so a source-mode test plan differs from a compiled CLI plan.

## Explicit execution gate

Owner authorization must name the concrete model/provider and approve this plan's **$0.26 maximum reservation**
before anyone invokes `run`. This repository file or a successful test is not owner authorization.
Use a fresh dedicated OpenRouter key, no other workloads or BYOK configuration, with a nonresetting limit no
larger than $0.26 and BYOK inclusion enabled. Set it through the process environment
`BINRAT_EVAL_OPENROUTER_API_KEY`; never put credentials in command arguments, config, receipts or git.
The runner reads the existing key's limits; it cannot create keys, change limits, buy credits or enable providers.

```sh
pnpm competence:capture run /absolute/run-directory --execute EXACT_REVIEWED_PLAN_DIGEST
```

Both arms use the same model/provider, temperature zero, one non-streaming request and 1024 output-token ceiling.
Provider routing specifies `only`, `order`, `allow_fallbacks: false`, `require_parameters: true`, and maximum
prompt/completion prices with per-request fees capped at zero. There are no tools, plugins or fallback models.
The planned rate ceilings must fit the evaluator's $0.01 per-assignment budget at 8192 input and 1024 output tokens.
Exact input tokens are checked from returned provider usage; there is no native-tokenizer preflight. An input
overrun rejects that response and halts. Reservations plus the dedicated provider key cap are the cost backstops.

Before every POST the runner rechecks the key's cap, remaining credit, BYOK usage and plan expiration. Calls are
sequential. Each attempt durably consumes the full $0.01 reservation before outbound dispatch, even if reported
cost is lower or unavailable. Reservations are never recycled. The total planned reservation is exactly $0.26.
This is local dispatch accounting plus provider-side caps, not a guarantee about vendor billing behavior.

## Durable evidence and failures

`run.started.json` is an exclusive, permanent one-shot lock for the run directory. Each request gets
`N.reserved.json` before dispatch and `N.receipt.json` afterward, with file and directory fsync. Reservations
bind the full request, assignment and plan; receipts bind the reservation and retain the raw bounded response,
HTTP status, outcome, and derived capture. No bearer headers or exception text are written. Echoed credentials
are redacted; such responses cannot become captures. Files are private and created exclusively.

Native fetch has no application retries and rejects redirects. Each HTTP operation has a 60-second abort timeout;
responses are bounded to 64 KiB. HTTP/transport errors, malformed metadata, duplicate JSON keys, model/provider
drift, tool calls, truncation, missing/over-budget usage or expired authorization stop the run.
Invalid investigator answers with otherwise valid provider metadata are retained unchanged for grading.

An interrupted run is **never resumed**. A lock, partial file, uncertain dispatch or receipt write failure blocks
re-execution of that directory. Audit it offline. Do not delete the lock, replay an uncertain request, or launch a
second directory with the same key. A new experiment after failure needs its own reviewed plan and owner scope.
The lock prevents duplicate execution within one directory; it does not coordinate unrelated hosts or directories.

## Offline audit and verdict

```sh
pnpm competence:capture audit /absolute/run-directory > /absolute/audit.json
```

Audit verifies plan/reservation/receipt bindings and rederives captures from raw responses before applying #124's
grader. It never makes a network call. The JSON contains the compatible comparison, capture summary and score.
Incomplete or unsafe comparisons exit nonzero. A tie is a valid completed result; it is not a specialist advantage.
Known captured costs are listed separately; rejected/uncertain responses may have charges recorded only in raw
receipts or outside this process. Every attempted assignment retains its full reservation regardless.

Local hashes demonstrate consistency, not authenticity against an operator who can rewrite files. Provider usage
is reported evidence, not a settled invoice or independent billing attestation. Imported records remain
`RECORDED_UNVERIFIED_OUTPUTS`; evaluator `budgetEvidence` stays `DECLARED_UNVERIFIED` and `modelCompetence`
stays `UNPROVEN`. A result on the committed synthetic development pack cannot establish generalization.
After a valid specialist advantage, freeze the procedure and evaluate a separately untouched holdout.

Primary protocol references checked 2026-10-05:
- https://openrouter.ai/docs/guides/routing/provider-selection
- https://openrouter.ai/docs/cookbook/administration/usage-accounting
- https://openrouter.ai/docs/api_reference/limits

## Verification and bounded review

Mocked transports only. Coverage includes zero-call planning, price/config rejection, monetary rounding,
authorization/expiration, provider-key caps, durable dispatch order, double execution, crashes, uncertainty,
HTTP failures, stream failures, credential redaction, provider/model drift, usage overruns, response bounds,
strict parsing, tamper detection and unchanged grading of invalid answers. No production health or real model
competence claim follows from these checks.

One hostile self-review found and fixed HIGH: `openrouter/auto` initially matched the model-ID format and could
route to an unpinned model. All `openrouter/` router IDs now fail config validation before execution. MEDIUM:
halted execution initially exited zero; halted runs now exit nonzero, verified through the compiled CLI with a
mocked rate-limit response. One targeted rereview found no unresolved Critical/High issue. No independent reviewer
or subagent participated. Exact-head CI results are recorded in the draft PR. No merge or deployment is authorized.
