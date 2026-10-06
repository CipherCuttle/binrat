# Indexed funder discovery V1

## Existing authority and smallest extension

The indexed funding lookup was already implemented on October 2: core #91 (`2633dd8` introduced `AlchemyPonsFundingSource`) and canonical collector #103 (`90296437`). #103 supersedes the sibling #93 collector. Both are ancestors of this branch. The existing collector starts with a known Pons launch and looks for earlier native transfers **to its deployer**. Its production queue, stores, migration, leases and retry/backoff policy are not the prospective observer.

This slice adds the missing outgoing candidate direction to the same prospective journal on top of #136, published base `2a8a9c29dd277c94ff5071d6dd9b72371ea23151`. Shared native candidate parsing is extracted from the existing source; V3 uses it and the existing canonical full-block/receipt/history/handoff/later-launch admission. No new provider, dependency, production collector, migration, public route or UI is added.

## Registered protocol

`PROSPECTIVE_CAPTURE_V3.schema.json` declares `INDEXED_FUNDER_OUTGOING`, logical source `ALCHEMY_ROBINHOOD_ARCHIVE`, range size at most 4,096 blocks, at most three pages per range and five transfers per page. The same frozen funder, pinned Robinhood chain/factory, 48 original RPC attempts, eight-block recipient history and 24-hour/200,000-block horizon remain. Registration and offline audit require no credentials or provider calls. V1/V2 journals are not upgraded or rewritten.

After public chain/code and initial-head verification, a manual step:

1. Reads a current head. It waits at an unchanged cursor or freezes `[cursor+1, min(head, cursor+4096)]`; a later head cannot move this active range.
2. Rechecks the saved cursor hash/timestamp and saves a numbered range-end anchor.
3. Queries `alchemy_getAssetTransfers` with `fromAddress=funder`, fixed range, `category=['external']`, positive values, ascending block order and `maxCount='0x5'`.
4. Validates every returned candidate, including exact sender, native category/value, range, ascending block order, duplicate transaction hashes and bounded continuation keys. Self-transfers are skipped. Pagination uses exactly the preceding returned key, with original request reservations and budget. A cycle or malformed result halts; an unfinished third page ends `EXHAUSTED / INDEXED_PAGE_LIMIT_PARTIAL_RANGE` without advancing the cursor.
5. Stops at the first nonself candidate in provider-returned order, without looking at future launches. Ascending order is by block; this is not a claim about every transaction's canonical order within a block or omitted provider results.
6. Rechecks the range-end anchor before admitting its enumeration or candidate. An empty ended enumeration advances only a **provider-indexed range**, then returns. For a candidate, reads its canonical full block and verifies exact hash/sender/recipient/value and transaction membership, then uses the existing successful funding receipt, complete bounded history, funding recheck, pre-handoff logs, handoff and strictly-later-launch checks.

The journal returns after an indexed range or waiting-head boundary; it is not a scheduler. Every page, anchor and candidate-verification read counts against the same 48 attempts. Failure or unresolved reservation halts permanently. No hidden retry or copied-journal allowance is introduced.

## Transport and live gate

`indexedCaptureTransport(publicReads, indexedReads)` explicitly routes only `alchemy_getAssetTransfers` to the archive/indexed reader; approved standard read methods use the public reader. It clones requests and has no retry loop. Both injected readers must implement **one attempt**, retain their raw response and obey the caller's existing authorization. Do not instantiate the existing production collector's retrying viem transport for this experiment.

The current keyless CLI can inspect, export, audit and restore V3, but `step` refuses V3 with `INDEXED_CAPTURE_REQUIRES_EXPLICIT_ARCHIVE_TRANSPORT` before reserving or sending any request. No live indexed CLI or credential capture is installed in this slice. An explicit secure archive transport and a separately registered bounded live protocol are the next activation gate. Never place an RPC URL containing a key in a manifest, raw export, repository, console or chat.

Provider reference: https://www.alchemy.com/docs/data/transfers-api/transfers-endpoints/alchemy-get-asset-transfers and https://www.alchemy.com/docs/reference/transfers-api-quickstart document address filters and continuation keys. These general documents and older repository reconnaissance do not establish current Robinhood outgoing-query compatibility, index freshness, provider cost or latency. Those remain unverified until a real archived response is captured.

## Coverage and interpretation

`PROVIDER_INDEXED_CANDIDATES_ONLY` is distinct from V2's full consecutive-block coverage. The typed `indexedDiscovery` retains active range, page count/key, provider enumeration end marker, confirmed-range sequence references, indexed cursor and validity. An end marker means only that the provider ended this query. It never establishes all chain transfers, complete logs, global wallet freshness, no funding, or complete coverage of internal transfers.

Index lag can omit transfers that appear later after the indexed cursor advances. This implementation neither measures that lag nor repairs it by inventing completeness. A truncated or failed range cannot advance the indexed cursor. Exact canonical reads can support a positive funding fact but cannot establish absence from an indexed query. Authentication remains `PROVIDER_REPORTED_LOCAL_CLOCK_NOT_EXTERNALLY_ATTESTED`; local seals are replay integrity, not external timing or consensus attestation.

The real #136 keyless experiment confirmed eight blocks, examined 37 top-level transactions and found no qualifying funding at 35/48 calls. Its latest-head reads advanced 3,518 blocks over 358.042 seconds. That measures the manual keyless proof path, not Alchemy lookup performance. Its terminal snapshot remains `df0faa7fbc00b0e8032753bbbdce5275e323e2178fc054da36b5b4160f4ffc7a`. The existing V1 expired capture and historical model failure remain unchanged.

## Verification and bounded closure

All new transport controls are `SYNTHETIC_TRANSPORT_CONTROL`. The positive control prepares the existing research-only handoff at 22 attempts and supports a strictly later launch at 29; a second-page candidate costs one more attempt. Empty indexed ranges return without funding/Case/notification claims. Controls cover malformed native candidates, wrong address/range/category/value, duplicate/order regression, paging cycle/limit, changed anchors, canonical mismatch, deadline, failed/pending reservation, original-budget exhaustion, restoration, transport method restrictions and keyless CLI refusal. Counts establish deterministic pipeline behavior only.

No new public/indexed RPC calls, model calls, model cost, notification delivery, production activation, merge, deployment, wallet or capital authority. The public roster remains unchanged. Rollback: revert this changeset as one unit; preserve any separately registered V3 journal, because the parent cannot interpret V3. Existing V1/V2 exports remain readable.

One hostile self-review found two MEDIUM consistency gaps: the initial range-end anchor could disagree with the selected same-height head, and candidate timestamps were not lower-bounded by the saved indexed cursor. Both were fixed, including repeated cursor/range hash rejection and immediate-successor parent binding. One targeted rereview exercises these controls and shared-budget multi-range exhaustion. No independent reviewer or subagent. Review is closed after that pass.

Final local verification: TypeScript build; **591/591** repository tests; **11/11** indexed controls in targeted rereview; web invariants; Product Surface V2 evidence and build; `git diff --check`. Tests used Node’s tsx import hook and cached dependencies, with temporary links. This is not a local frozen-lockfile reinstall or a pinned-pnpm execution claim. All **34** inherited workforce evidence/contract/lock files match the #136 base bytes. The saved real 35-call V2 export replays to its unchanged terminal snapshot using the new source.
