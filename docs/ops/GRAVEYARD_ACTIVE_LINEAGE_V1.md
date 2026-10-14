# Graveyard active lineage — S0 evidence snapshot

STATUS: EXACT_VERSION_RECEIPT; DOMAIN: repository maintenance; AUTHORIZATION_EFFECT: NONE.
Canonical routing remains [CANONICAL_AUTHORITY.md](../CANONICAL_AUTHORITY.md).

PLAN: Preserve the source, evidence and recovery paths needed for FIND → EMPLOY → LEAVE → RETURN. PASS requires complete bounded GitHub inventory, local WIP accounting, exact authority heads and no external mutation. KILL is ambiguous preservation or any unapproved external write. Budget: at most 100 GitHub metadata GETs total across workers, two bounded local discovery passes, three delegated investigations without recursion, $0 spend, zero chain/provider RPC, live messages and production writes. Local scripts and reports only.

## Current GitHub truth

As of 2026-10-14T02:18:15.171763+00:00: **151 open PRs, 242 remote branches, 182 total PR records**. REST pagination completed: two 100-item PR pages, three 100-item branch pages, with a hard ceiling of five pages each. Git fetch used `--no-prune --no-tags` and updated only remote-tracking branch refs in the DevHub repository. No existing local branch or checkout was moved.

- `main`: `d93defb8b59be5c5a9fd9f7f5733b766567c4b10`; #182 merged 2026-10-11T22:12:22Z. Canonical documentation/router and historical backend scope.
- `integration/binrat-a1-3-visual-gate`: `160ab9c4fbb2f9cebd4a45cc20f5e75d85f57302`; #183 merged 2026-10-11T22:11:59Z. Selected React/Pons integration; not proof of present runtime deployment.
- #172 `release/binrat-v3-production-20261009`: `8a2245176889e5e75aeb3695661e8dc834e2cac6`. Frozen release/rollback source; later integration runtime receipts must also be retained.
- #178 `feat/pons-tripwire-v1`: `216647d214a7df05d1eb48e99d8af27dc4262392`. Owner candidate only; use snapshot for exact identity and source map for drift. No public alert success inferred.
- `migration/binrat-survival-v1`: `a269d8272ec93e41b00ebfcf6c528074a2c4c898` **plus 48 dirty paths**. Local always-on work; never substitute committed HEAD for WIP.

The complete graph is [GRAVEYARD_DEPENDENCIES_V1.json](GRAVEYARD_DEPENDENCIES_V1.json); direct and transitive edges follow PR base refs. Textual citations and content dependencies are separately reviewed, not inferred absent from zero graph degree.

## Authority and existing audit

The four authority documents, root AGENTS, CLAUDE and copilot instructions were read at refreshed main; matching integration routing is verified in the source map. Their scopes remain routing/product/engineering/execution, distinct from source evidence, deployed runtime and token/legal grants. No competing canon was created.

Historical October 2 cleanup exists only on `ops/binrat-repo-cleanup-manifest-v1` at the snapshot SHA, in `docs/ops/BINRAT_REPO_CLEANUP_V1.md`, its JSON and `scripts/audit/` tools. Its old closure/deletion flags are **not** adopted. In particular, Case reconstruction and #93 contain non-identical history.

[GRAVEYARD_SOURCE_MAP_V1.md](GRAVEYARD_SOURCE_MAP_V1.md) identifies domain sources and conflicts; [GRAVEYARD_WORKFLOW_AUDIT_V1.json](GRAVEYARD_WORKFLOW_AUDIT_V1.json) inventories all remote workflow blobs. Push-triggered historical workflows can mutate infrastructure; preserving a branch is not permission to push or rerun it. GitHub's deployment metadata only lists six old Pages deployments and is not a complete Cloudflare runtime registry. No live capability claim is made here.

## Local topology and preservation



Bounded walk of `/home/swirky`: **190863 directories**, **328 Git markers** inspected for BINRAT identity. Complete within the second pass budget of 500,000 directories / 90 seconds. Symlinks were not followed. Excluded names: `.agents`, `.cache`, `.cargo`, `.codex`, `.config`, `.git`, `.gradle`, `.local`, `.m2`, `.mozilla`, `.next`, `.npm`, `.nuxt`, `.oh-my-zsh`, `.pnpm-store`, `.rustup`, `.venv`, `.vscode`, `.vscode-server`, `.yarn`, `__pycache__`, `build`, `dist`, `go`, `node_modules`, `target`, `venv`. An unrelated archived tocsv Redis directory denied access; it is the only walk error. This is not a claim about repositories hidden inside the explicitly excluded roots, symlink targets outside the root, other users, or unmounted storage. All registered worktrees from each matched common dir were added even when outside this scan root. Exact exclusions/paths are in `GRAVEYARD_LOCAL_TOPOLOGY_V1.json`.

**4 independent Git common directories; 56 worktree records; 52 existing locations; 4 missing registered /tmp locations.** The existing count includes the newly created graveyard preparation tree and the empty Desktop repository. Three substantive independent repositories plus the empty Desktop repository exist.

- `/home/swirky/binrat/.git`
- `/home/swirky/DevHub/repos/binrat/.git`
- `/home/swirky/DevHub/worktrees/binrat-survival-v1/.artifacts/clean-room/.git`
- `/home/swirky/Desktop/binrat/.git`

The nested survival `.artifacts/clean-room` clone is clean at `d1ab7570e99995bca1e5812cc22cf88e0bf416c2` and has a local-path remote. `/home/swirky/Desktop/binrat` has no valid HEAD; classify QUARANTINE/empty or incomplete, not as a release source. Four `/tmp` worktree registrations are missing and marked prunable; no pruning was done.

## Dirty work protected

**12 dirty existing worktrees, 726 changed/untracked paths.** Every readable dirty file is represented by path/status/SHA-256; tracked paths also include staged/index blob identity. This inventories working state without displaying contents. Ignored build/runtime files are outside `git status`; the clean-room clone and explicitly known encrypted recovery artifacts were checked separately. A hash inventory is not a backup.

| Worktree | Branch or detached head | HEAD | Dirty paths |
|---|---|---|---:|
| `/home/swirky/DevHub/repos/binrat` | `DETACHED` | `2d507045327bd4269a5c0dd4f2050805488f60ee` | 583 |
| `/home/swirky/DevHub/repos/binrat-integration-gate-v1` | `temp/binrat-integration-gate-v1` | `a05717e7a64c46e6be7376de4b9e0ef5f29e68ae` | 34 |
| `/home/swirky/DevHub/worktrees/binrat-autonomous-rat-v1-1` | `release/binrat-autonomous-rat-v1-1` | `5f0eedbd26179fa1dee1f7f77db87db1c4507384` | 3 |
| `/home/swirky/DevHub/worktrees/binrat-exact-pons-launch-rehearsal-v1` | `feat/binrat-exact-pons-launch-rehearsal-v1` | `ccc677985ce07f438648a2499611e72c36729491` | 1 |
| `/home/swirky/DevHub/worktrees/binrat-original-runner-125` | `DETACHED` | `46d3ccbcf5c0158ea601f830a89d84e5512ed68b` | 1 |
| `/home/swirky/DevHub/worktrees/binrat-production-preflight-20261009` | `DETACHED` | `c31ddf8ae70806a0a2abf444c9879c3e418bb2ae` | 3 |
| `/home/swirky/DevHub/worktrees/binrat-survival-v1` | `migration/binrat-survival-v1` | `a269d8272ec93e41b00ebfcf6c528074a2c4c898` | 48 |
| `/home/swirky/binrat` | `design/binrat-roadmap-brand-v1` | `95c7e78223cec4f2f8bbe62d83d4aa81bc9fc4ee` | 10 |
| `/home/swirky/binrat-case-canonical` | `integration/binrat-product-surface-authority-v1` | `9e8b37ec0a643aadf8aaf789e9ab6c4ae4b85cb3` | 1 |
| `/home/swirky/binrat-pons-tripwire-v1` | `feat/pons-tripwire-v1` | `8ae1e0e2f3c356fe0a7ca3810b5a50a551abf944` | 17 |
| `/home/swirky/binrat-rat-select-v2` | `feat/binrat-rat-select-v2` | `d31faee8e7e572cf1e1a540e3f97832674ca5dca` | 24 |
| `/home/swirky/binrat-sprint-a1` | `feat/binrat-sprint-a1-frontdoor-discovery` | `db13d4d8568bd99d72c6f318462664a8157e88eb` | 1 |

End-of-task hash recheck: **726 dirty files unchanged; 0 mismatches** (`GRAVEYARD_LOCAL_PRESERVATION_V1.json`). No dirty tree was edited.

## Active migration and local-only evidence

`migration/binrat-survival-v1` is `a269d8272ec93e41b00ebfcf6c528074a2c4c898` (2026-10-11), with 12 modified + 36 untracked paths. WIP covers canonical source/Pons adjustments, portable Tripwire/Watch/frontend, and always-on progress/backup/source guards. Preserve all 48 paths together; head SHA alone omits this work. Four always-on readiness/runbook/review/evidence documents are untracked. There are 39 public migration evidence files, separately hash-indexed in `GRAVEYARD_LOCAL_TOPOLOGY_V1.json`.

The survival head lacks `docs/CANONICAL_AUTHORITY.md`, both North Stars, `docs/AGENT_WORK_POLICY.md`, and `CLAUDE.md`; its existing `AGENTS.md` still routes to V2 candidate smoke checks. The clean separate authority adaptation branch `docs/authority-hostile-fixes-survival-20261011` is `9083b12e7dab4e49a4328497ac10e4f59262a20c`. Do not assume this adaptation was absorbed into migration WIP. Route cleanup authority through the merged canonical system in the authoritative branches; do not overwrite survival to reconcile it.

These local branch heads have no containing remote-tracking ref in their own current local repository. This is a conservative local observation, not refreshed GitHub proof; protect until cross-repository/current-remote containment is established:

| Common directory | Local ref | SHA |
|---|---|---|
| `/home/swirky/binrat/.git` | `refs/heads/feat/pons-tripwire-v1` | `8ae1e0e2f3c356fe0a7ca3810b5a50a551abf944` |
| `/home/swirky/binrat/.git` | `refs/heads/forensics/a2-1-outcome-coverage` | `f20e3a3f853ebdd7c7d96d2becb7278b83b7285b` |
| `/home/swirky/binrat/.git` | `refs/heads/hotfix/pons-catchup-throughput-v1` | `b732b8e0e52ff4a9560ec69f132cfb4288f07d03` |
| `/home/swirky/DevHub/repos/binrat/.git` | `refs/heads/docs/authority-hostile-fixes-survival-20261011` | `9083b12e7dab4e49a4328497ac10e4f59262a20c` |
| `/home/swirky/DevHub/repos/binrat/.git` | `refs/heads/feat/binrat-frontdoor-brand-convergence-v1` | `517388a2b97839a1d201c96f40a2336c203d0b5a` |
| `/home/swirky/DevHub/repos/binrat/.git` | `refs/heads/incident-9b001d9-backup` | `9b001d9fdc0a83af1f2cf2db7565a59d1071ba42` |
| `/home/swirky/DevHub/repos/binrat/.git` | `refs/heads/migration/binrat-survival-v1` | `a269d8272ec93e41b00ebfcf6c528074a2c4c898` |
| `/home/swirky/DevHub/repos/binrat/.git` | `refs/heads/qa/launch-self-service-checks-v1` | `09fad7aa228a6375f2fe38ff9d1c9e8ebd5705c2` |
| `/home/swirky/DevHub/repos/binrat/.git` | `refs/heads/temp/binrat-integration-gate-v1` | `a05717e7a64c46e6be7376de4b9e0ef5f29e68ae` |
| `/home/swirky/DevHub/repos/binrat/.git` | `refs/heads/test/pons-alchemy-feasibility-v1` | `c86f4fbf46dfa35528e381349a6200ebcf8a575a` |

## Backup, recovery and rollback preservation

**Deadline remains critical: GitHub artifact `11700131674`, workflow run `38133453274`, reported expiry 2026-10-25 at 10:52 UTC.** Current GitHub metadata independently confirms `expired:false`, expiry **2026-10-25T10:52:02Z**, size 261,866,741 bytes and archive digest `sha256:7aeb1c228d09a98e922ececc8a55bddc5910203e1d247d7e30b348310e0c4d6f`. This archive digest differs from the contained `.sql.age` ciphertext digest by design; neither is a plaintext hash.

Dated prompt baseline saying restoration is unestablished is superseded by stronger local receipts: tracked `D1_RESTORE_PROOF.md` / `PRODUCTION_RESTORE_EVIDENCE.json` record restoration from the actual October 11 rescue, 183,950 original rows across 34 original tables, zero unexpected cell changes, preserved 3,207 legacy authority projections, and fresh online-backup restore. `SELF_HOSTED_REPLACEMENT_PROOF.md` records dedicated-age bundle decryption, all 39 restored table counts, integrity/FK checks, and network-none historical Case read recovery. Those are existing receipts, not tests rerun in this sprint, and they do not independently prove original provider aggregate completeness or fresh chain collection.

**Off-platform local preservation is established; off-device/separately controlled custody is NOT established.** Three recorded ciphertext files currently exist and all SHA-256/size checks pass; all are on device 66307. `OFF_DEVICE_BACKUP_CUSTODY.md` reports ciphertext and dedicated key on the same physical disk, no selected external destination, and owner-controlled original rescue identity custody unverified. No key was read, searched for, copied or hashed, and no plaintext/database was opened.

| Ciphertext | Bytes | SHA-256 | Current check |
|---|---:|---|---|
| `/home/swirky/.local/share/binrat-rescue/20261011/binrat-v0-20261011.sql.age` | 261786680 | `7f4fc4298f1ad2e40413bc7ef26cb1e28d7f1adfa138e6342150d17985540b84` | PASS |
| `/home/swirky/Backups/binrat/replacement-20261011/backup.tar.age` | 315284824 | `c31576b701e8b3a6a4f6e9af5d49b4ff627107b16b35a2f10bc7613eef292b25` | PASS |
| `/home/swirky/.local/share/binrat-rescue/20261011/blocker-closure/ledger-custody/budget-11-attempts.sqlite.age` | 28872 | `18c512b7b28164c0f46df05fac9138ec416af20985a79bb29af941d2b466e33d` | PASS |

Original rescue ciphertext is 0400; replacement and budget ciphertexts are 0600. Preserve the **11-attempt / three FAILED jobs** budget adjunct with the database; older recovery must not refund accounting. Host-loss recovery remains blocked until owner-selected independent ciphertext/key custody and fresh recovery from those copies are verified. Local ciphertexts do not expire with GitHub artifact retention.

Historical Cloudflare configuration, emergency freeze/rescue workflow records, qualified local images and transfer pack are rollback/operational evidence. Migration docs explicitly retain old provider workflows as historical rollback and forbid manually reactivating them. Existing receipts record a qualified API/Caddy pack and an RPC-diagnostics derivative; those image/archive identities were not rebuilt or executed here. Deployment, DNS, VM identity/capacity, independent watchdog, approved backup scheduling and archive-capable source/cost/throughput remain unqualified. Always-on WIP reports offline mechanics PASS / live activation BLOCKED; it does not authorize running the collector.

## Verification and next action

Inventory JSON parses; all worktrees/local refs carry exact heads where valid; dirty paths have hashes; 726 dirty-file hashes rechecked unchanged; three ciphertext hashes match recorded values. No remote mutation. Preserve every dirty location, all local-only refs, nested clean-room clone and recovery receipts in the protected inventory. Authorize no deletion based solely on branch names, current counters or remote containment of a committed head.
