# Indexed retrieval and funder activity diagnostic V1

This is a separately authorized SMALL EXPERIMENT, not a continuation of the closed #140/#142 captures. Freeze the protocol before RPC. No production worker, prospective evaluation, model, alert delivery, capital action, subject switch or provider activation. Use the existing named archive setting through the established secret-safe, single-attempt transport. No retries, reruns, reset or resume; retain uncertain reservations.

The purpose is to distinguish failure to retrieve a selected historical positive from lack of returned recent funding candidates. The historical control is already known from #134 and the Oct 2 investigation: block 77,795,399, transaction `0xcb29fa5271340288f12d79fba9adcd783a6d789e4dc043bd299812620511e9e2`, funder `0x9bc462bce2acd6fbe2ef5470d55b439453451083`, recipient `0xaf70c00d8d252fc9fe68f00525b8df4e4fdcfcb8`. This is retrieval calibration, never predictive success or an untouched holdout.

## Fixed original attempt budget

| Attempt | Read |
| --- | --- |
| 1 | Public chain ID, must be 4663 |
| 2 | Archive outgoing external native query for only the historical block, ascending, maximum five |
| 3–5 | Expected historical canonical full block, successful receipt, same-block hash recheck |
| 6 | Recent public head, timestamp within 30 seconds of local receipt |
| 7–8 | Start/end headers for exactly 200,000 blocks ending at that frozen head (clamp at genesis) |
| 9 | Same outgoing query over that recent window, ascending, maximum five, one page |
| 10 | Recent end-header hash recheck |
| 11–12 | First returned non-self candidate's canonical full block and successful receipt, when one exists |

Maximum 12 original attempts and five minutes. A reservation is atomically written and synced before sending each request. HTTP/transport/parse/binding/reorg failure or uncertain reservation halts immediately. Existing output directories are rejected. Secrets are neither printed nor placed in registration/requests; named environment value is removed after constructing the transport. Raw bodies are retained subject to the existing credential-reflection redaction and 1 MB cap.

Registration binds the exact source SHA and frozen protocol. `auditIndexedCalibration` purely replays the response prefix and recomputes every expected request; it does not trust summaries. No ordinary prospective schema, parser, journal or frozen fixture changes. Candidate queries are locator data, with canonical verification required for admitted activity. Only one recent candidate is verified; additional candidates and page continuation remain unverified. Self transfers do not count as funding another recipient.

## Decision boundaries

- Historical expected hash missing: `CONTROL_NOT_RETURNED`. Stop before recent inspection and investigate outgoing query/provider coverage. Pagination can limit retrieval, so this is not proof that the transaction is absent on chain.
- Control verified and a recent non-self candidate verified: `RECENT_ACTIVITY_VERIFIED`. The subject has one supported recent transfer. Register any next prospective observation separately before its future evidence.
- Control verified but no recent non-self candidate returned: `NO_RECENT_NON_SELF_RETURNED`. Historical retrieval works for this selected transaction; activity remains limited to provider-indexed responses in this window. An empty page does not attest current index freshness, exhaustive chain absence, or wallet inactivity. A nonempty all-self page with continuation is especially inconclusive. Consider a different subject only under an explicit historical selection rule.
- Any malformed, failed, pending or mismatched read: `HALTED`. Retain all receipts, never silently repeat calls.

`pageEnded` describes the provider's pagination marker, not proof of index completeness. Window timestamps describe sampled headers; there is no full 200,000-block parent-chain proof. Canonical candidate checks bind transaction membership, chain ID, from/to/value, block, index and successful receipt at read time. Local timestamps and hashes do not establish consensus or external time attestation. No handoff, Case addition or predictive verdict is produced. RPC cost is unknown without separate provider billing evidence. Historical model verdict remains `SPECIALIST_FAILED_SAFETY_GATES`.

## Verification and rollback

Offline tests must cover known positive retrieval with recorded canonical responses, recent positive and empty paths, missing control, pagination, malformed/binding failures, uncertain reservations, and the CLI's exclusive directory/missing-secret behavior. One hostile self-review and one targeted rereview, then stop. Require canonical CI on the published source tree before publishing the single exact trigger commit. Keep every older capture immutable. Roll back this presentation-independent diagnostic commit as a unit; retain evidence artifacts.
