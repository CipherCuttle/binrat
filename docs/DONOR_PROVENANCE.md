# Donor provenance

BINRAT is a new independent repository. It does not runtime-depend on donor repositories. Generic primitives are adapted from pinned revisions owned by the same project owner.

## Sentry Forensic Gate

Repository: `CipherCuttle/sentry-forensic-gate`  
Pinned commit: `402f762970064507226d7b81954ee6d38d56d8fc`

Adapted concepts/code:

- `src/evidence/canonical.ts` -> `src/evidence/canonical.ts`
- `src/sentry/identity.ts` -> `src/core/identity.ts`
- `src/sentry/ports.ts` -> `src/core/ports.ts`
- `src/sentry/viemSource.ts` -> `src/arc/arcpadSource.ts`
- `src/runtime/sentryTruth.ts` -> `src/indexer/syncLaunches.ts`
- `src/graph/provenance.ts` -> `src/intelligence/provenance.ts`
- launch/provenance/checkpoint subset of SQLite schema/store -> `src/store/*`
- deterministic provenance/reorg test patterns -> `test/*`

Explicitly excluded: FastVet BUY eligibility, canary entry, approvals, revokes, signing, execution, capital, and trading authority.

## Frontier

Repository: `CipherCuttle/frontier`  
Pinned commit: `6a068b815d40f1e8eb9beccbedcbb2ae0546cda9`

Ported as design rules, not Python dependencies:

- digest-bound receipt identity;
- frozen evaluator/version/config identity;
- unresolved coverage must stay unresolved.

## Qnty

Repository: `CipherCuttle/Qnty`  
Pinned commit: `610f66f6c5660e09a6c0560ae1b4262f0bfd5578`

Ported as architecture rules:

- SQLite/WAL durability;
- transactional/atomic state changes where authority matters;
- read-only verifier boundary;
- explicit `what this proves / what this does not prove` language.

## REKT Inkubator

Repository: `CipherCuttle/rekt-terminal`  
Pinned H5 commit: `b2c67646a65307d05b6aa0fa7392092fd21eb483`

Not copied in V0. Reserved future donor for idempotent outbox workers, renewable leases, stale-worker fencing, bounded retry, and failure observability once BINRAT needs concurrent workers.
