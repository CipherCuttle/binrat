ACTIVE_TARGET: <actual destination branch>
SOURCE_BASE_REF: <source branch used for this change>
SOURCE_BASE_SHA: <exact lowercase 40-character Git commit SHA>
STATUS: <ACTIVE | ACTIVE_ANCESTOR | DONOR | GRAVEYARD | OPS_RECEIPT | QUARANTINE | MERGED_REDUNDANT>

Describe the user outcome, smallest source changeset, and tested behavior. For donor/experimental work, name the exact reviewed source and unresolved blocker.

Use [CANONICAL_AUTHORITY.md](https://github.com/CipherCuttle/binrat/blob/main/docs/CANONICAL_AUTHORITY.md) for source routing. Provenance fields are declarative metadata, **not** proof of ancestry, runtime acceptance, token authority, or permission to deploy or merge.

External operations: state the exact owner authorization used, or NONE. Do not include credentials, local worktree paths, recovery-key/backup locations, private hashes or forensic inventories in a public PR.
