# BINRAT Replay Lab V1

Status: IMPLEMENTATION ACTIVE  
Branch: `feat/binrat-live-candidate-v1`  
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
