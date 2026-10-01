# BINRAT Replay Lab V1

Status: ENGINEERING PASS / CLOUDFLARE LIVE VERIFIED / PUBLIC LIVE BETA

Original candidate: draft PR #13, `feat/binrat-live-candidate-v1` at `d3341052f95c0e3a1874a4b3cfcecf6e960846fb`

Current reconciliation branch: `feat/binrat-rat-radar-v0`

Base: Intelligence V1 reviewed head `69793aef3ac6c152e0a91d8c914a6f71c5a4f0f3`  
Merge authority: NONE

## Why this exists

The preregistered 72-hour ArcPad experiment answers one narrow question: whether current ArcPad launch density is sufficient for an ArcPad-only product decision.

It does **not** freeze product engineering until the experiment matures.

Replay Lab lets BINRAT demonstrate its actual technical moat before that date using already indexed, real Arc evidence:

- launch authority;
- same-reported-address history;
- deterministic 5m / 1h / 24h observations;
- WHAT CHANGED projection;
- one exportable evidence bundle with nested receipt IDs and evidence digests.

The experiment remains untouched. Replay Lab must not use partial experiment data to claim that ArcPad-only volume is sufficient.

## Contract

`GET /api/bag/:bagId/replay`

returns a pure read projection:

`public feed receipt -> creator-file receipt -> intelligence receipt -> replay-bundle receipt`

The bundle contains a deterministic stage sequence:

`LAUNCH -> 5m -> 1h -> 24h`

Only matured observation stages appear. Missing stages remain missing; they are never synthesized.

The public response also exposes:

- canonical as-of block number and block hash;
- the source public, Creator File, Intelligence, and Replay receipt IDs;
- observation IDs, evidence digests, target timestamps, and observed timestamps;
- explicit available and missing horizons;
- history and observation coverage separately;
- no-lookahead, missing-evidence, reported-creator identity, and recommendation boundaries.

Replay validates the public projection receipt, canonical launch object, nested observation receipts, and monotonic horizon/observation chronology before returning evidence.

## Live acceptance

Verified against production D1 evidence on 2026-09-21:

- launch ID: `01f1eb8fe5acede475ce7f09bad73962cbb3279deb1e50f7e7c2746bcd28d85f`;
- launch: `TST / ARCTEST`, block `19015290`;
- ArcPad-reported creator: `0x0f7972e8012eeef3c4fd8084a2739d802f8bfa7f`;
- 5m: stored `COMPLETE` receipt;
- 1h: stored `COMPLETE` receipt;
- 24h: stored `COMPLETE` receipt;
- observation coverage: `COMPLETE`;
- historical coverage: `UNVERIFIED`;
- endpoint: `GET /api/bag/:bagId/replay`.

The complete observation chain does not imply complete global launch history. Deep backfill remains a separate coverage claim.

## Product boundary

Replay Lab is evidence presentation, not prediction.

No:
- BUY / SELL output;
- safe/rug/scam score;
- inferred human identity;
- simulated market outcome presented as observed;
- token launch mechanics;
- wallet/signing/capital authority.

Historical evidence may be used to demonstrate the product before the 72-hour source-density experiment matures, but it must remain clearly identified as indexed/replayed evidence rather than invented live activity.
