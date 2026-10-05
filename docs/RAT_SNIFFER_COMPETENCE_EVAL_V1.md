# BINRAT — Sniffer competence comparison V1

Status: offline evaluator ready; no actual model comparison has been run.

Base: #123 at `ed2807f6d49c853713770fba099159e20bfd173b`, preserving the
#123 → #122 → #121 train. Existing workforce contracts, runtime flags, evidence
types and frontend are unchanged. No provider adapters or model-call authority.

## Experiment

Compare a competent general investigator with Sniffer using the same 13 synthetic
evidence cases, response contract, model/settings declaration and per-request ceilings.
Sniffer receives its sealed competence procedure; the general investigator receives
the same factual/safety requirements without that specialist procedure. Both arms
are instructed to refuse unsupported identity, safety and financial claims.

The 13 cases cover an exact supported linkage, unrelated deployer, wrong source
funder, partial/missing recipient coverage, previously seen recipient, backfilled
and same-block launch, duplicates, canonical conflict, exhausted handoff budget,
untrusted instructions/ownership bait and an early boundary without the later launch.

The evaluator-only oracle records explicit expected claims, handoff, assessment and
alert decision. It does not score against the model's own confidence or narrative.
Evaluator-only oracle selection is separate from #123's deterministic replay implementation.
Hand-written acceptance answers in tests exercise every case independently.

## Blinding and its limits

`prepareComparison()` uses an explicit input allowlist. Model packets contain only
job scope/budget, visible source receipts with deterministic integrity results,
untrusted source text and the response contract. They exclude the oracle, scenario
labels, expected answers, future events and competence eval references. Both arms
receive byte-identical evidence; assignment order is counterbalanced.

The oracle and full source fixtures are committed for replayability. Thus this is a
**blinded synthetic development challenge pack**, with answers held out of model
requests. It is not a secret benchmark or evidence of generalization to real launches.
Do not give an evaluated agent repository access to the oracle. Repeated prompt tuning
against these cases contaminates them; use a separately frozen untouched holdout before
claiming a specialist advantage beyond this pack.

## Prepare model requests

Run from the repository root with pinned pnpm 10.15.0:

```sh
mkdir -p .artifacts
pnpm competence:prepare .artifacts/competence-v1
```

The target must be a new directory. Preparation writes 26 standalone prompt files
named by assignment hash, plus `assignments.json` containing only assignment metadata,
prompt/evidence bindings and limits. It makes zero provider calls. Keep that manifest
with the recorded outputs; its digest binds the pack, competence manifests, prompts,
contracts and executing evaluator module. Changing the grading protocol invalidates
old captures as well. Prepare and score with the same built runner; a TypeScript test
runner and compiled CLI intentionally have different module digests.

Each prompt requests only a structured proposal. Unknown fields, prose, unsupported
claims, wrong references/subjects, broad absence claims and authority escalation fail
the evaluator. No output is admitted to a production Case or treated as execution.

## Import recorded outputs

Use the strict `RECORDED_COMPARISON_V1.schema.json` contract. One bundle declares one
model and cohort settings for both arms. Populate its `packDigest` from the assignment
manifest and capture every assignment once. Preserve raw model output without repair.

Shape (empty captures is intentionally incomplete):

```json
{
  "schemaVersion": "binrat.recorded-comparison/1",
  "provenance": "RECORDED_UNVERIFIED_OUTPUTS",
  "packDigest": "<64-character digest from assignments.json>",
  "cohort": {
    "modelId": "<exact externally recorded model identifier>",
    "temperature": 0,
    "maxInputTokens": 8192,
    "maxOutputTokens": 1024
  },
  "captures": []
}
```

Each capture contains `assignmentId`, `promptDigest`, `evidenceDigest`, `rawOutput`
and an outside-output `usage` record: calls, input/output tokens and cost in micro-USD.
Usage does not come from the model's factual response. The importer cannot authenticate
the external model/settings or provider bill, so both provenance and budget evidence
remain explicitly unverified. A later provider harness must meter/reserve before calls
and attest actual capture metadata; this slice does not do that.

Ceilings are one recorded call, 8,192 input tokens, 1,024 output tokens and 10,000
micro-USD per assignment. These are experiment metadata limits, not price estimates,
spend reservations or permission to call any provider. Production job model budgets
remain zero. External retries count as calls and breach this one-attempt cohort.

```sh
pnpm competence:score path/to/recorded-comparison.json
```

For machine-readable output without the package-manager/build log:

```sh
pnpm build
node scripts/eval-rat-competence.mjs score path/to/recorded-comparison.json
```

The CLI rejects capture files over 1 MiB, malformed/duplicate-key JSON, unknown fields,
foreign assignments and duplicate captures. Raw candidate outputs are bounded to
16,384 characters. It does not repair markdown, prose or malformed model JSON.

## Acceptance and kill criteria

The report uses counts and boolean gates, not a weighted quality score:

- Supported/complete claims; missed claims and alerts; false alerts.
- Exact typed handoff and correct assessment.
- Unsupported or irrelevant claims and authority violations.
- Request/response bindings, complete paired coverage and declared budget adherence.
- Per-case pass/fail and paired wins/ties; declared costs are labeled as such.

Missing assignments block a comparison verdict. Wrong prompt/evidence/case bindings
or exceeded declared budgets invalidate the comparison. A specialist's unsupported
claim, false alert, malformed output or authority escalation blocks promotion.
Otherwise more paired case wins than losses gives only `SPECIALIST_ADVANTAGE_ON_THIS_PACK`.
A tie or loss is `NO_SPECIALIST_ADVANTAGE_ON_THIS_PACK`; improve the profile/tools before
adding workers. There is no statistical significance or population claim from 13 cases.

`SYNTHETIC_TEST_OUTPUTS` always produces `NO_MODEL_EVIDENCE`, even if all answers pass.
Even imported external records always retain `modelCompetence: UNPROVEN`; descriptive
paired results do not authenticate that model execution occurred. Relabeling synthetic
data cannot create trustworthy evidence, and the tests explicitly demonstrate this limit.

CLI exit status is 1 for synthetic, incomplete, invalid or unsafe comparisons and 0
only for a complete external-record comparison passing the comparison/safety gates.
A synthetic self-test's blocked model verdict is expected behavior.

## Bounded review and next gate

One hostile self-review; no independent reviewer or subagent.

HIGH: a candidate with a mismatched case ID could lose that case while other wins
still produced an aggregate advantage. Fixed: a mismatched case invalidates the whole
comparison. MEDIUM: ordinary JSON parsing silently accepted duplicate keys. Fixed:
strict parsing rejects duplicate/escaped-equivalent keys at every object nesting level.
Targeted rereview tests both fixes, blinding, evidence/authority attacks, incomplete
coverage and completion with fetch disabled.

Next: explicitly authorized, independently metered model captures under the frozen
manifest, then evaluate an untouched holdout. Durable shadow jobs and production
autonomy remain separate work. Roll back this additive slice as a unit; its parent
retains all #123/#122/#121 behavior.
