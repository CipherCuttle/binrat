# A1.2 bounded hostile review and targeted rereview

Scope: additive Case evidence contract, its complete browser validator, and historical UI integration. One manual adversarial self-review; this is not independent owner approval.

## Hostile review (one pass)

- Tried independent changes to canonical launch fields, event/Case IDs, chain, authority/provenance hashes, publication identity, checkpoint hash, projection, coverage, counts, record order and missing facts, with original and recomputed outer digests. Existing strict validators reject them. A fully re-authored and rehashed response by a malicious trusted index is outside this unsigned contract's proof boundary; UI must disclose that boundary.
- Checked historical count isolation, exact URL/identity, latest-feed regression, missing-source fallback, publication movement, production read-only whitelist and non-GET method guard. No Critical/High findings.
- Medium: `olderLaunchesOmitted: true` asserted actual omissions for even a one-record window. Correct to `olderHistory: NOT_ENUMERATED`; state the bounded count and partial coverage without claiming older records exist. Add one-record adverse control.
- Medium: authority column binding parsed oversized stored JSON before failing the byte guard. Guard the JSON extraction itself with the existing 8192-character limit. The endpoint still fails closed.
- Mobile inspection caught the inherited flex ordering putting the historical notice before the Case hero and CTA. Place the notice after the hero, keep all limitations visible, assert CTA placement at 320/390/430px.
- Verification fixture audit caught a local checkpoint initially copied from the publication instead of the captured durable checkpoint. Hydrate the actual captured durable checkpoint; do not manufacture an equivalent source state.

## Targeted rereview (one pass)

Completed after the fixes above. Checked coverage constant and small-window acceptance, guarded SQL, exact production-capture hydration, mobile flex order, and validator/UI trust wording. No unresolved Critical/High findings. Relevant contract, adapter, compiled browser and TypeScript checks are recorded in the separate contract/UI reports.

No further review loop. No production writes, deployment, migration, merge, or capability activation.
