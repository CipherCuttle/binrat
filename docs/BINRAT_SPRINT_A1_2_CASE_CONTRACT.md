# A1.2 — bounded canonical historical Case evidence

HISTORICAL_CASE_CONTRACT = PASS (local compiled Worker, captured production source, exact-head CI required before approval)
A1_RELEASE_READY = NO

## Choice and compatibility

Choose B: additive GET `/api/bag/:id/evidence`, schema `binrat.case-evidence/1`, projection `BINRAT_PONS_HISTORICAL_CASE_V1`. Returning all legacy V0 projection material would couple consumers to a different model and substantially larger whole-projection payload. Existing `/api/bag/:id` responses and latest-feed/status validators remain unchanged. No migrations or infrastructure changes.

Contract base: `16994bf1e331441f75d2ebba5f1d8d6226e7ebc6` (`release/binrat-backend-read-only-20261009`). Implementation: `84e399d943a71e7c9be5b17e5c60194c822aece8`; reviewed corrections and final runtime/test source: `1b5d0a05dae900128065bc81c41013d6e24566ee`.

## Verification boundary

The endpoint reads the canonical stored launch authority and provenance fact, verifies all 18 authority fields against relational columns, recomputes launch/event identities and provenance derivation, and binds the returned window to the canonical validated published snapshot. It checks the durable checkpoint has not rolled back and rereads the publication to reject movement during the read. The browser independently recomputes the Case material digest and all record derivations, and requires exact equality with its separately validated feed/status publication: chain, checkpoint/hash, feed digest, publication version and verification time.

This is verification of wire integrity and canonical index consistency, with the same-origin index as trusted source authority. Neither unsigned digests nor inclusion of a checkpoint hash prove historical chain ancestry or log execution independently. A malicious trusted index could re-author and rehash every authority/fact consistently; this contract does not protect against that. No RPC proof, Merkle inclusion proof, immutable publication archive or historical point-in-time replay is claimed.

`reconstruction=PUBLISHED_CHECKPOINT_RECONSTRUCTION`, `archivedPublication=false`, `pointInTimeReplay=false`. The original launch observation block is separate from the current published checkpoint. The projection returns up to 20 same-deployer canonical launches through the selected Case, newest first, including that exact Case. `priorLaunchCount=records.length-1`; coverage is partial, with older history not enumerated. It cannot borrow a latest-feed recurrence count or assert omitted records exist.

## Real old-Case demonstration

Case: `742ed5c2d361c11d5a4da715e35e6c189a9b61ae4a433a937a96111360d7ab01`.

- Original observation: block `84243094`.
- Captured canonical publication: checkpoint `84298735`, hash `0x9bf40ee12ac5aaa781ac3b6b012542612aed0870ca9acb4c4c6d00d1eb97d577`, publication version 666.
- This ID is absent from the captured latest-20 feed. Its original `/bag/:id` URL renders locally through the real compiled frontend and Worker over captured production records.
- The new envelope contains 20 source records and **19** earlier records in its own returned window. The count is not replaced with 38 from another projection.
- Recomputed canonical digest: `c2f0e7658021bc9587c265a3d172f230d4e203cc15b2ebfd24b049e6ed6ac1a3`.
- Compact response: 28,148 bytes, under the 65,536-byte cap. The formatted evidence file is larger because it is pretty-printed.

Source receipts: [production capture](receipts/sprint-a1-2-contract/production-records.json), [envelope](receipts/sprint-a1-2-contract/old-case-envelope.json), [query plan and payload](receipts/sprint-a1-2-contract/bounds.json), [actual provider readback](receipts/sprint-a1-2-contract/provider-state-final.json).

Production read-only receipts also confirm the old legacy Case still returns HTTP 200 and the final window SQL returns 20 records with all column bindings valid: 40 rows read, zero rows written, `changed_db=false`, 2.9481ms. See [legacy GET](receipts/sprint-a1-2-contract/legacy-old-case-live.json) and [final production SELECT bounds](receipts/sprint-a1-2-contract/provider-query-bound.json).

No fake launch authorities or provenance facts. Local adverse tests deliberately mutate an in-memory copy and are labelled controls. The new endpoint has **not** been deployed; this demonstration is not a live endpoint success claim.

## Verification and bounds

`pnpm exec tsc --noEmit`: PASS.

`pnpm exec tsx --test test/caseEvidence.test.ts test/publicProjection.test.ts test/cloudflareWorker.test.ts`: **45/45 PASS**, including 29 Case-contract checks and 16 existing route/projection regressions. [Output](receipts/sprint-a1-2-contract/targeted-tests.txt).

Checks cover independent field tampering with original and recomputed outer digest; wrong chain/Case/checkpoint; projection/count/coverage mismatch; missing/oversized evidence; stored relational/fact contradiction; record ordering; publication movement; checkpoint rollback/hash contradiction; exact identity; GET-only production read-only whitelist; legacy compatibility; and a one-record partial window.

Five SELECTs per successful read; target and checkpoint lookups LIMIT 1; window LIMIT 20; existing creator/block index forced; no full-window sorting; authority <=8192 characters and fact <=2048 characters before parsing; response <=64KiB; no RPC calls, D1 writes, migrations or capabilities. The [bounded review and rereview](BINRAT_SPRINT_A1_2_REVIEW.md) has no unresolved Critical/High findings.

## Release gate

Provider readback still identifies backend **105**, UUID `abe4c68d-e38e-4591-889b-77b2ca2abfe7`, at 100% traffic. No deployment or merge was performed. Frontend integration is separately reviewable on the PR #173 base; it requires this endpoint before production approval. Owner visual approval and any production rollout remain pending and separately authorized.
