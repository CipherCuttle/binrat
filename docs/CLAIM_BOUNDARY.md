# BINRAT claim boundary

BINRAT publishes observations and deterministic derivations. It does not publish investment recommendations. Current role vocabulary follows `docs/PRODUCT_LANGUAGE.md`; on Pons/Robinhood 4663, `DEPLOYER` is an event role and is not silently upgraded to creator, owner, trader, or human identity.

## BINRAT may say

- a launch event was observed at a specific chain point;
- a source-reported `DEPLOYER` address appeared on a specific Pons launch event;
- the same exact source-reported `DEPLOYER` address appeared on earlier retained Pons launch events;
- an observation or historical outcome is missing;
- coverage is `COMPLETE`, `PARTIAL`, or `UNVERIFIED`;
- a deterministic rule emitted a named finding for the stated evidence/version.

## BINRAT must not say without a separately defined and supported claim contract

- `SAFE`;
- `BUY` / `SELL`;
- `SCAM` / `RUGGER` as an inference from generic anomalies;
- a percentage probability of rug/scam;
- that absence of evidence proves safety;
- that creator identity equals wallet identity in the real world;
- that a receipt is tamper-proof or independently audited.

## Authority boundary

Raw chain observations are authoritative inputs for chain facts. Derived provenance is disposable and rebuildable from durable facts. Human-facing copy and jokes are projections of receipts and never authoritative evidence.

No component in BINRAT V0 has signing, transaction submission, trading, or capital authority.
