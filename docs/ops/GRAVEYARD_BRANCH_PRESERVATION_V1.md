# S4 — remote branch preservation

STATUS: EXACT_VERSION_RECEIPT / LOCAL_RECOMMENDATION. DOMAIN: repository maintenance. AUTHORIZATION_EFFECT: NONE. Use [the existing canonical router](../CANONICAL_AUTHORITY.md).

PLAN: test exact commit reachability without reducing recovery, donor or licensed-asset custody. PASS allows an empty deletion set when permanent preservation or references are unresolved. KILL: any inaccessible history, unique evidence, unknown deployment/reference, open dependent, local WIP risk or missing exact owner grant.

CHANGESET: [the deletion manifest](GRAVEYARD_BRANCH_DELETION_V1.json) contains **all 242 remote branches and an empty deletion set**. Each record has exact head, classification, selected-history containment, dependents, unique deltas and blockers. No tags or branches were deleted or created remotely. No bundle or archive tag was created.

`git merge-base --is-ancestor`, `git rev-list`, `git diff`, complete commit trees and path/blob comparisons establish historical containment where it exists. They do not establish that a deployment no longer references a branch, that an asset can be relicensed, or that an independently held permanent copy exists. `gh-pages` and other unrelated histories cannot be compared using an invented merge base. Zero direct dependents is insufficient.

The proposed archive scheme is a separately authorized, non-production Git bundle per independent Git common directory, with explicit ref/SHA inputs from [protected refs](GRAVEYARD_PROTECTED_REFS_V1.json), SHA-256 receipts, `git bundle verify`, and a fresh offline restore that checks each advertised head/tree. Remote archive tags/refs and pushes would need a different exact grant. Archive restoration must not run hooks, workflows, deployment scripts or collectors. Do not push the historical trigger refs.

A bundle does not capture the 726 dirty paths, ignored files, rescue ciphertexts, recovery keys, local databases or external build artifacts. Those require separate preservation and custody evidence. Publishing a bundle must also account for private history and asset licenses; no publication is proposed here.

VERIFY: the offline integrity check enforces the empty deletion set and all protected head identities. [Git evidence](GRAVEYARD_GIT_EVIDENCE_V1.json) and [local topology](GRAVEYARD_LOCAL_TOPOLOGY_V1.json) retain the mechanical inputs. The execution dashboard records the one bounded hostile review.

VERDICT: **PASSED — NO DELETION**. No final deletion set is ready for owner approval. Permanent archival custody, individual deployment/doc/workflow/rollback references and local WIP gates remain unresolved. Archive creation itself remains AWAITING_OWNER_GRANT; no deletion authorization should be inferred from eventual archive creation.
