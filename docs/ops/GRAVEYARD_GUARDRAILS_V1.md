# S5 — small offline guardrails

STATUS: LOCAL_CHANGESET / AWAITING_OWNER_GRANT_FOR_REMOTE_ADOPTION. DOMAIN: maintenance. AUTHORIZATION_EFFECT: NONE. [CANONICAL_AUTHORITY.md](../CANONICAL_AUTHORITY.md) remains the single router.

PLAN: make source targets, archival evidence and permission gates mechanically reviewable without a new service or policy canon. PASS: complete offline inventory validation, adversarial failure checks, explicit source fields for new PRs, and exact local retirement patches. KILL: a guardrail that writes remotely, consumes secrets, treats tests as runtime truth or overwrites WIP.

CHANGESET:

- [graveyard_check.py](../../scripts/audit/graveyard_check.py) validates complete PR/ref coverage, exact identities, graph edges, leaf-first order, comment paths, quarantine/containment rules, protected refs and empty deletion scope. `--fresh-snapshot` rejects any recorded PR state/head/base or branch drift. It performs no network calls, Git mutations or remote actions.
- [The PR template](../../.github/pull_request_template.md) requests `ACTIVE_TARGET`, `SOURCE_BASE_REF`, `SOURCE_BASE_SHA` and primary `STATUS`. The CI check validates these for PRs created from October 14 onward, including the actual target branch. Historical PRs retain their original records. The source SHA must be syntactically exact; ancestry/source review remains necessary. No new branch naming hierarchy is imposed.
- [ci.yml](../../.github/workflows/ci.yml) adds a separate read-only Python integrity job and eleven adversarial tests. It does not relabel the old main backend checks as React V3 acceptance. Current frontend/Pons acceptance remains source-specific in the existing integration checks and migration evidence.
- [controlled-rat-private-rollout.yml](../../.github/workflows/controlled-rat-private-rollout.yml) locally removes push/commit-marker activation. Manual dispatch still requires its exact owner grant; no remote workflow has changed.
- [Five exact retirement patches](GRAVEYARD_WORKFLOW_RETIREMENT_V1.json) disable all jobs on five historical push-deployment refs. Original source/blob identities remain pinned. One original Rat Radar workflow has malformed YAML; its patch uses an inert manual-only stub, preserving the exact original in history and patch. The other four retain implementation with literal false job conditions. These patches were prepared and checked locally, not applied to historical branches or pushed.

No new dependency, linter, framework, skill or service was installed. The durable check uses Python's standard library. `graveyard_snapshot.py` uses only bounded GitHub metadata GETs (at most five pages per resource, 30 seconds per request), rejects incomplete pagination, and refuses to overwrite an existing receipt. Original October 2 audit tools remain available on their pinned historical branch; their old safe-to-delete verdicts are not reused.

## Predictable cleanup procedure

1. Run `python3 scripts/audit/graveyard_snapshot.py --output /tmp/binrat-fresh-snapshot.json` (new filename required) to refresh a bounded complete PR/branch snapshot, plus only the source/runtime evidence relevant to the proposed batch. Record exact head/base identities and inventory time. A complete snapshot is `prs`, `branches`, and inventory counts in the format of [the saved snapshot](GRAVEYARD_SNAPSHOT_V1.json).
2. Classify actual deltas and dependencies; update only affected records and the exact action manifest. Unknown uniqueness, assets, security, licenses or deployment implications remain QUARANTINE.
3. Run `python3 scripts/audit/graveyard_check.py` and `python3 -m unittest discover -s scripts/audit -p 'test_graveyard_check.py'`. Before a later approved execution, pass its fresh snapshot with `--fresh-snapshot`; any drift invalidates the old preparation. One hostile review, Critical/High fixes only, one targeted rereview if needed.
4. Request one exact batch grant for comments/closures. Recheck state/head/base and remaining children sequentially before each approved closure; verify CLOSED/unmerged and original branch SHA afterward. Stop on uncertain results. No deletion options, merges, pushes, workflows, production or token operations are included.
5. Treat archival creation, workflow retirement, branch deletion and adoption of these local changes as separate grants. Record exact actions actually executed and independently recount final state.

## Limits and remaining adoption

These local checks verify a frozen snapshot, not current GitHub state, live deployments or every semantic dependency. The source workflow audit is static; absence of a mutation regex is not safety proof for called scripts/actions. Original active historical workflows remain remotely enabled until separately authorized retirement. New PR template enforcement starts only after adoption on an applicable branch.

Main/integration entrypoints already route through merged #182/#183. Migration and Tripwire do not automatically receive those docs; the migration tree is dirty and remains untouched. The separate survival authority adaptation at `9083b12e7dab4e49a4328497ac10e4f59262a20c` is preserved for a later scoped reconciliation. #180 must not introduce an older competing hierarchy.

VERIFY: eleven offline adverse-state tests and complete inventory check; patch application/YAML checks; canonical router link checks; unchanged original WIP hashes; final GitHub state comparison. Exact outputs and the one bounded hostile review are recorded in the execution dashboard.

VERDICT: local guardrails are prepared; **AWAITING_OWNER_GRANT** for any push/adoption and for the five separately listed historical workflow changes. No claim is made that remote deployment triggers have been neutralized.
