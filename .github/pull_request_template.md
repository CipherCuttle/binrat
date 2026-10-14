ACTIVE_TARGET: <actual destination branch>
SOURCE_BASE_REF: <source branch used for this change>
SOURCE_BASE_SHA: <exact 40-character source base commit>
STATUS: <ACTIVE | ACTIVE_ANCESTOR | DONOR | GRAVEYARD | OPS_RECEIPT | QUARANTINE | MERGED_REDUNDANT>

Read [the canonical authority index](../docs/CANONICAL_AUTHORITY.md).

Describe the user outcome, changed behavior, and exact verification. For donor or experiment work, name the retained source, intended reuse and unresolved blocker. Source inclusion, runtime acceptance, token authority and permission to deploy remain separate.

External operations require an exact owner grant; list the grant actually used, or NONE. Preserve historical evidence and dirty worktrees. See [the graveyard execution dashboard](../docs/ops/GRAVEYARD_EXECUTION_STATUS_V1.md) for the current snapshot and gated batches.
