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


## BINRAT Intelligence V1 donor freeze

Intelligence V1 ports bounded primitives once and then owns them locally. There are no runtime imports, submodules, shared databases, or compatibility promises to donor repositories.

### Sentry Forensic Gate — primary donor

Repository: `CipherCuttle/sentry-forensic-gate`  
Pinned commit: `7f48f1ea59ae59c4cb36b4bfb93cb53406e39948`

Allowed ports:

- `src/outcome/horizons.ts` -> `src/observations/horizons.ts`
- forward-outcome identity/replay/reorg semantics -> `src/observations/*` and `src/store/*`
- creator-history point-in-time join semantics -> future `src/intelligence/creatorFile.ts`
- atomic launch/provenance snapshot pattern -> future read projections

Explicitly not ported:

- baseline trading positions;
- BUY / PASS / REJECT decisions;
- adverse-selection scoring;
- canary execution;
- approvals, signing, broadcast, capital, or wallet authority;
- Sentry-specific Tsunami market assumptions.

### SerrataOS — later funding-trail donor

Repository: `CipherCuttle/SerrataOS`  
Pinned commit: `34f981a7ea6d8148443046211562d23fe6c365a1`

Reserved, not in the first Intelligence V1 changeset:

- bounded funding-origin traversal;
- infrastructure/router filtering;
- chronological event projection.

Do not port suspect labels, Python runtime coupling, or case-specific heuristics.

### Rektrace — provider-resilience donor

Repository: `CipherCuttle/Rektrace`  
Pinned commit: `9db947aa3a5b9036a9ef91f283b475c62b357334`

Reserved only if third-party providers become necessary:

- timeout/retry/concurrency patterns;
- circuit-breaker patterns.

Do not port risk scores, approved/rejected semantics, or provider dependencies pre-emptively.

The previous React Bits frontend donor and animation-island integration were retired in the backend-only reset. They carry no active implementation or design requirements.
