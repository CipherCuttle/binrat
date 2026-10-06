# Prospective funding capture V1

This is a manual, keyless, read-only observation recorder. It extends the recorded retrospective proof from #134 with a saved handoff boundary **before** a possible later Pons launch. It is isolated from the public site, Den, production jobs, model clients and notification delivery. A successful regression is not a successful real capture.

## Frozen experiment

The subject is funder `0x9bc462bce2acd6fbe2ef5470d55b439453451083`, chosen from the earlier retrospective example before this prospective outcome. This is a deliberately selected subject, not a blind holdout or evidence of general model competence. The endpoint is `https://rpc.mainnet.chain.robinhood.com`, chain 4663. The existing pinned Pons factory address and bytecode hash remain authoritative.

| Bound | Value |
| --- | --- |
| RPC attempts across the original journal | 48, including failures and unresolved reservations |
| Work per manual step | At most 16 RPC attempts; stop at an observation or handoff boundary |
| Recipient history | Eight consecutive full blocks immediately before funding |
| Observation horizon | Initial block + 200,000 blocks, or 24 hours after registration |
| Launch-log range per read | At most 4,096 blocks |
| Selected subject | First qualifying transfer in a sampled block, transaction order |
| Model calls / model budget | 0 / $0.00 |
| Telegram, webhook, wallet or capital authority | None |

Discovery reads full latest blocks only when the operator invokes `step`. It does **not** scan every block between samples. Coverage is `SAMPLED_BLOCKS_ONLY`; a pending or expired run cannot establish that no funding occurred in unsampled blocks. A positive candidate is a successful, positive-value, nonself, top-level native transfer from the frozen funder to a nonnull recipient. There is no minimum amount or inferred ownership/identity claim.

History checks only sender/recipient participation in the eight declared full blocks. It excludes internal transfers, traces and all earlier history. Absence means `TOP_LEVEL_TRANSACTION_PARTICIPATION_ONLY` within that window, never global wallet freshness.

## Evidence and admission

1. Register the immutable manifest; verify chain and factory bytecode, then record the initial current block.
2. Save each sampled full block. Select funding without consulting future launch outcomes. Bind its successful receipt to the transaction and block.
3. Read eight complete predecessor blocks, bind transaction membership, check their parent chain and funding parent, and reject an already-seen recipient.
4. Recheck the funding block. Reject a Pons launch already returned by the pre-handoff log query. Read a current head and prepare the typed Sniffer → Rat Zero handoff with its local receipt time, block boundary, history scope, evidence references and remaining original budget.
5. A later manual step watches bounded Pons log ranges after that boundary. Recheck the previous cursor anchor and read the range-end block **before and after** the log query. A changed anchor halts; an empty query advances only that declared stable range.
6. For a positive log, bind its successful receipt, exact log and containing block/transaction. The launch block must be strictly later than the saved handoff block and its provider-reported timestamp strictly later than the local handoff receipt time. Only then derive a Case diff and `PREPARED_ONLY` notification. Nothing is sent.

The schemas live under `contracts/rat-workforce/prospective/`. They intentionally describe this public-read observation boundary separately from the frozen synthetic evaluation contracts. The handoff grants research only; it does not grant network, provider, delivery or capital authority. The recorder's original manifest separately authorizes the fixed public RPC reads.

Every request is reserved durably in a dedicated SQLite journal before transport. A crash leaves `PENDING`; a timeout/transport error leaves `FAILED`. Both retain the request and available raw response and halt further calls. There are no retries, replacement reservations or fresh budgets on reopen. A journal from another application is rejected before mutation. A validated raw export can restore the same prefix into an empty journal; it cannot replace an advanced journal.

The journal verifies exact request order, response bindings, local monotonic timestamps and a SHA-256 chain. Its trust label is `PROVIDER_REPORTED_LOCAL_CLOCK_NOT_EXTERNALLY_ATTESTED`. These checks detect local corruption and preserve reproducibility; they do not authenticate wall-clock time, independently attest consensus, prove complete provider logs or guarantee finality. Anchor checks address observed changes during reads, not every possible reorg. The runtime does not trace ancestry across all skipped head blocks. Whole-journal validation is capped at 12 MB and each raw response at 1 MB; exceeding either fails closed with raw journal export still available.

## Saved real prefix

`test/fixtures/workforce/prospective/public-capture-prefix-v1.json` contains four complete public RPC responses from capture `prospective-funder-20261006-v1`. Initial block: **81,271,131**. Its offline audit is **SEARCHING**, with no selected funding, handoff, finding, Case diff or notification. It retains **44** of the original **48** attempts. Registration: `2026-10-06T02:12:36.800Z`; wall expiry: `2026-10-07T02:12:36.800Z`; block horizon: **81,471,131**. The first applicable bound ends the observation. This is an incomplete real capture, not an early-warning success or a negative finding.

The raw file and audit hashes are recorded in `RAT_PROSPECTIVE_CAPTURE_PROOF_V1.json`. Offline `audit` reconstructs the saved prefix at capture time; `inspect` and `step` additionally apply the current wall deadline. An expired prefix remains valid historical evidence and cannot be revived by restoration.

## Run locally

Use a separate checkout of the published prospective branch. Node 20+ and `curl` are required; Node 24 was used locally. Install the frozen lockfile with pinned pnpm 10.15.0 and build. No API key or secret is used.

```sh
npx --yes pnpm@10.15.0 install --frozen-lockfile
npx --yes pnpm@10.15.0 build
node scripts/capture-prospective-rat.mjs audit --input test/fixtures/workforce/prospective/public-capture-prefix-v1.json
node scripts/capture-prospective-rat.mjs restore --db /tmp/binrat-prospective-v1.sqlite --input test/fixtures/workforce/prospective/public-capture-prefix-v1.json
node scripts/capture-prospective-rat.mjs inspect --db /tmp/binrat-prospective-v1.sqlite
node scripts/capture-prospective-rat.mjs step --db /tmp/binrat-prospective-v1.sqlite
node scripts/capture-prospective-rat.mjs export --db /tmp/binrat-prospective-v1.sqlite > /tmp/binrat-prospective-v1-export.json
```

Run commands sequentially. On a command failure, stop and retain the database and export. A manual `step` after a healthy pending observation is new observation work against the same budget. A halted, expired or exhausted capture must not be restarted. Do not run multiple copied journals: local export restoration is an operational handoff, not an authenticated global quota service. Keep one active copy and retain all previous raw exports. A fresh `init` is a separate experiment, not continuation of this one.

## Verification and closure

Synthetic transport controls exercise successful chronology, handoff persistence, stable empty ranges, restart/restoration, exhausted budgets, pending reservations, failed transports, existing recipient history, invalid funding, forks, earlier launches, wall-clock ordering and changed cursor/range anchors. They are labelled synthetic in the tests and never substituted into the real fixture. The real prefix is audited offline in regression tests.

One hostile self-review found a HIGH cursor-advancement risk on a changing range anchor. The fix adds both pre-query and post-query anchor reads; the targeted rereview covers an **empty** log response during that reorg, stable empty advancement and the supported synthetic positive. Review stops after that targeted check.

Engineering verification and the real-world outcome are separate. The historical failed model verdict and prior frozen evidence remain unchanged. Public Rat availability is unchanged. This slice does not establish model competence, autonomous service readiness, complete funding coverage or a real funding → handoff → later launch success. The next useful evidence is a qualifying event within this exact capture's remaining budget and window. If none is captured, report the incomplete outcome rather than redesigning the experiment around a known positive.
