# BINRAT — Rat Workforce Offline V1

Status: isolated engineering proof; no production activation or competence claim.

Base: `feat/binrat-frontdoor-journey-v1@fa23aa77b8c0cf15ca5f3e0f5d5f5638f1da9cd1`.
Preserves #122's parent, #121's stability composition, existing public evidence types,
frontend availability and all existing runtime flags.

## What this proves

A bounded deterministic investigation can preserve chronology, exchange a typed
specialist handoff, reuse existing Pons evidence construction, and produce a supported
Case diff plus an offline alert decision under one origin job budget.

Seven JSON Schema Draft 2020-12 contracts live in `contracts/rat-workforce/v1/`:

- `RAT_PROFILE_V1.schema.json`
- `RAT_JOB_CONTRACT_V1.schema.json`
- `RAT_HANDOFF_V1.schema.json`
- `RAT_JOB_RECEIPT_V1.schema.json`
- `TOOL_MANIFEST_V1.schema.json`
- `SKILL_MANIFEST_V1.schema.json`
- `EVAL_CASE_V1.schema.json`

Ajv 8.17.1 is pinned as an offline development dependency. Contracts reject unknown
fields and authority expansion. Decimal strings preserve block and wei precision.
Profile, skill and tool manifests bind canonical content hashes. These hashes establish
integrity relative to the reviewed repository, not independent proof of source truth.

The three competence packs under `competence/rat-workforce/v1/` specify objectives,
procedures, evidence requirements, forbidden claims and eval references. They preserve
RAT ZERO / LIVE, TRIPWIRE / BUILDING, SNIFFER / NEXT. These are candidate competence
specifications, not demonstrated LLM capabilities. The executable specialist path
exercises Sniffer → Rat Zero. Tripwire's future specialist behavior remains unproven.

## Replay contract

Run from the repository root with Node >=20 and pinned pnpm 10.15.0:

```sh
pnpm install --frozen-lockfile
pnpm workforce:replay
```

For machine-readable JSON without the package-manager/build log:

```sh
pnpm build
node scripts/replay-rat-workforce.mjs
```

The CLI writes JSON to stdout and exits nonzero if any acceptance gate fails. The
existing `pnpm check` includes `test/ratWorkforce.test.ts` through its normal test glob.

The synthetic fixture in `test/fixtures/workforce/sniffer-funding-to-pons-v1.json`:

1. Records a direct native transfer at block 100.
2. At block 101, admits a declared recipient scan over blocks 90–99. Complete coverage
   in that window with no observation supports only `RECIPIENT_NOT_SEEN_IN_WINDOW`.
3. Creates a typed Sniffer → Rat Zero handoff inside the originating job. It carries
   exact subject, evidence references, chronology boundary, authority and remaining budget.
4. Observes a Pons event at block 120, available to the replay at block 125, reporting
   that exact recipient as deployer. A launch must follow the handoff's creation boundary.
5. Builds a shared Case diff and an offline alert decision. Expected use: five tool
   reservations, one handoff, zero provider/model calls, zero provider spend.

This is deliberately one funder, one qualifying recipient, one handoff and one finding.
It does not enumerate a funder's real transaction graph or implement persistent jobs.

The existing `PonsPrelaunchNativeInboundReceipt` requires a launch. The new fixture
transfer observation exists independently before a launch; the old retrospective
builder/verifier is reused only after both observations exist. Existing canonical
hashing, launch/event identity, provenance fact and Case receipt construction are reused.
No public or persisted production evidence types change.

## Outside-specialist enforcement

- Authority is research-only within deterministic fixture replay. Network, providers,
  delivery and capital are explicitly false; model-call and monetary budgets are zero.
- An explicit code policy caps each Rat's tools. Profiles may narrow that ceiling but
  cannot expand it. There is no dynamic tool/skill import or caller-supplied executor.
- Tool attempts reserve budget before work. Failed attempts and retries consume the
  same ledger. Handoffs inherit remaining budget and do not create another job allowance.
- Budget exhaustion suppresses alerts and admits no partial Case diff. Source and
  canonical integrity errors reject the replay instead of becoming no-match results.
- Missing or incomplete recipient coverage remains DEGRADED. Historical/backfilled,
  same-block or before-handoff launches cannot satisfy the future job.
- An unobserved recipient is not evidence of a new wallet, common ownership, human
  identity, intent, safety or future returns. Funding linkage means exact-address linkage.
- Every artifact is marked `SYNTHETIC_OFFLINE_REPLAY`. Embedded legacy launch receipts
  remain inside that marked envelope and are never passed to production storage or sends.
  Source event time is not invented: embedded receipt timing uses null/zero placeholders.

## Replay, restart and scoring

Each boundary exposes only source events available at or before that block. Static
fixture structure is validated up front; factual digest/canonical checks happen at
the visible boundary. Expected answers do not influence the replay.

The receipt binds the job, visible source prefix, relevant canonical blocks and
competence pack digest. Resume rebuilds the earlier boundary and compares the full
receipt before continuing; it never trusts saved counters or specialist assertions.
This bounded proof recomputes the prefix rather than maintaining a production journal.

Exact source-event duplicates consume no additional budget. Conflicting copies fail.
Restart yields the same finding identifier. This demonstrates stable offline finding
identity; it is not proof of durable job admission or exactly-once Telegram delivery.

Scoring uses named boolean gates for receipt sealing, chronology, receipt completeness,
unsupported claims, typed handoff correctness, budget adherence, Case diff integrity,
replay integrity and the fixture's explicit expected outcome. Replay integrity detects
counterfeit traces/checkpoints by reconstruction. Independent golden assertions and
adversarial mutations exercise the semantic gates; no weighted quality score is used.

## Bounded review

One hostile self-review; no independent reviewer or subagent.

HIGH: the exported reservation ledger accepted expanded profile references, allowing
a fabricated competence pack to reserve another specialist's tool. Fixed with a
code-owned capability ceiling in addition to manifest/profile restrictions. A targeted
regression attempts the expansion and requires denial before any reservation.

Targeted rereview verifies that ceiling, immutable admitted budgets, forged checkpoint
rejection and completion with `fetch` disabled. No production integration follows from
this proof. Verification results and exact commit/CI status accompany the draft changeset.

## Scope and rollback

No production routes, database migrations, job admission, provider activation, Telegram
sends, wallet operations, fiat/stake economics, frontend changes or launch authority.
No merge or deployment is authorized by this engineering slice.

Rollback: revert this changeset as a unit, including the pinned Ajv development
dependency and lockfile additions. Its parent retains the complete #122/#121 composition.

Next evidence needed: evaluate actual specialist outputs against held-out fixtures;
then design a separate durable shadow runner. This proof does not justify live autonomy
or pricing decisions.
