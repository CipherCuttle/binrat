# Recorded evidence replay V1

This slice imports one bounded real RPC recording into the local Den's existing saved-job journal. It admits a **retrospective relation**, not a prediction or a live Sniffer job.

## What was actually recorded

Nine successful read-only JSON-RPC responses from `https://rpc.mainnet.chain.robinhood.com` were captured on 2026-10-06. The transfer and launch were selected from the earlier reconnaissance in `docs/product/PONS_FUNDING_PROVENANCE_V1.md`; they are not a blind holdout or evidence of model competence.

- Native ETH transfer: `0xcb29fa5271340288f12d79fba9adcd783a6d789e4dc043bd299812620511e9e2`, block **77795399**.
- Pons launch transaction: `0x259bd408520b99864a7a069896dcf6868fe0ed18a3bbce95ff32f02fd9ab06d7`, block **77796794**.
- Direct source: `0x9bc462bce2acd6fbe2ef5470d55b439453451083`.
- Exact Pons-reported deployer / transfer recipient: `0xaf70c00d8d252fc9fe68f00525b8df4e4fdcfcb8`.
- Final capture checkpoint: **81253814**; final response received **2026-10-06T01:43:26.980853+00:00**.

The raw file retains requests, full responses, endpoint and per-response received times. The self-contained import bundle preserves those payloads and adds a sealed, bounded job contract. `RAT_RECORDED_EVIDENCE_PROOF_V1.json` records exact file SHA-256s, bundle digest and saved-job proof.

## Admission boundary

The new recorded schema is separate from the frozen synthetic EVAL_CASE and job-receipt schemas. Recorded inputs cannot enter the synthetic creation path. The recorded job objective is `REPLAY_RECORDED_FUNDING_AND_PONS_LAUNCH`; network, provider, delivery and capital authority remain false, with zero model budget and zero handoff budget.

Checks bind RPC request/result IDs and parameters, chain ID 4663, pinned factory code hash, successful transfer and launch transaction receipts, transaction inclusion in the returned blocks, matching block hashes, exact source/recipient and decoded factory `TokenLaunched.deployer`, and strict funding-before-launch chronology. Removed or misbound logs fail closed. A conflicting job ID cannot replace saved evidence.

**Trust boundary:** payload consistency and hashes do not establish consensus authentication. The recording is `PROVIDER_REPORTED_NOT_CONSENSUS_PROVEN`; there are no transaction/receipt trie proofs, independent RPC quorum or reconstructed block headers. Editing all payloads and resealing them can fabricate a consistent recording. Imported responses are local supplied evidence, not authenticated production authority.

All admitted events use the final returned capture checkpoint as their replay availability boundary. Their wall-clock receipt times remain preserved. A block before that boundary reveals no claims, tool reservations, Case or notification. This checkpoint convention is not proof of historic knowledge or the exact head at HTTP response arrival.

Coverage is `PARTIAL_RECORDED_RELATION_NO_RECIPIENT_HISTORY`. The bundle has no recipient-history scan and establishes neither wallet freshness nor absence of other transfers/launches. No history event or handoff is fabricated. A supported positive retrospective relation may prepare a notification despite that explicitly limited coverage; it cannot satisfy the future-only synthetic Sniffer objective or its competence evals. No common-human, same-team or ownership claim is admitted.

## Use it locally

From the repository root, install the pinned frozen-lockfile dependencies and build, then:

```bash
npx --yes pnpm@10.15.0 build
node scripts/local-rat-job.mjs import-recorded --db /tmp/binrat-recorded-den.sqlite --bundle test/fixtures/workforce/recorded/pons-funding-a-bundle-v1.json
node scripts/serve-local-den.mjs --db /tmp/binrat-recorded-den.sqlite
```

Open `http://127.0.0.1:4185/#job=recorded-pons-funding-a`, run the replay step, close the page and return. The Case is labeled **RECORDED CASE · RETROSPECTIVE RELATION**, coverage remains visible, and the notification states that no earlier prediction or freshness was established. Existing synthetic scenarios remain available and labeled synthetic. Import is a local CLI operation; there is no arbitrary-recording browser upload or public route.

Equivalent CLI progression and export:

```bash
node scripts/local-rat-job.mjs advance --db /tmp/binrat-recorded-den.sqlite --job-id recorded-pons-funding-a --through-block 81253814
node scripts/local-rat-job.mjs inspect --db /tmp/binrat-recorded-den.sqlite --job-id recorded-pons-funding-a
node scripts/local-rat-job.mjs export --db /tmp/binrat-recorded-den.sqlite --job-id recorded-pons-funding-a
```

The import is capped at 512,000 bytes and exactly nine bound responses. Four deterministic logical reservations cover reading the transfer, reading the launch, building the Case and preparing the alert. These counters are not physical RPC billing, replay CPU or hashing costs. The recording phase made public RPC reads; subsequent import/replay is offline. Model calls and model cost are zero; no notification is delivered.

## Acceptance and limits

- Same source/job import and repeated advancement return the existing terminal snapshot; one notification is prepared per job.
- Restart verifies the entire journal and retains the same Case and notification ID.
- Budgets 0–3 stop before Case/notification admission; four reservations complete this relation.
- Missing responses, failed transactions, changed request bindings, code/chain/block conflicts and forbidden authority reject. A missing matching launch halts once and keeps source/export evidence available.
- No finding, claims or handoff appear before the capture checkpoint.
- The seven-width local browser check includes synthetic flows and recorded Case/reopen/rendering; no browser external requests are made.

Historical failed model audits, frozen synthetic evidence, public `web/` and the lockfile are unchanged. This is a known positive relation and adapter regression, not a collection coverage benchmark, prospective funding watcher, model success, production-health proof or owner visual acceptance.

The next useful proof is **prospective observation**: collect bounded funding evidence before a later launch, retain recipient-window coverage and exact observation chronology, and show whether a legitimate handoff can be created. Local scheduling is a separate slice; it cannot turn this retrospective recording into an earlier prediction.

## Rollback

Revert this presentation/adapter commit as a unit. The SQLite schema and application marker remain V1. Existing synthetic jobs remain readable by earlier code; earlier code cannot verify new recorded rows, but raw export remains available. Export recorded evidence before reverting if those rows must be inspected by the older application. No production data or migration is involved.

## Engineering verification

TypeScript build and all **561 repository tests** pass. Pinned pnpm 10.15.0 web invariants and isolated Product Surface V2 checks pass. Local tests use Node's tsx import hook because the normal tsx Unix IPC socket is restricted in this workspace; canonical CI uses the normal frozen-lockfile workflow. Dependencies are the existing pinned cache, temporarily linked only in this isolated worktree; the lockfile is unchanged.

One bounded hostile self-review, with no subagent or independent reviewer, found three medium issues: failed-verification rows could inherit synthetic labeling, synthetic CLI imports could inherit the demo's fixed progression blocks, and the recorded receipt-table caption retained synthetic language. These are fixed with targeted regression checks. No unresolved Critical/High finding was identified. The single targeted rereview passed those boundaries, including all seven browser widths; its browser proof is saved in `RAT_RECORDED_DEN_BROWSER_PROOF_V1.json`.

Browser screenshot/export artifacts are generated by the pinned Playwright 1.56.1 workflow. Existing historical screenshots and browser proof documents are not overwritten. Owner visual/usability acceptance remains separate from these automated checks.
