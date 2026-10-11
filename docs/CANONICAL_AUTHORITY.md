# BINRAT — CANONICAL AUTHORITY INDEX V1

**Status:** single routing/index authority for **which document or proof governs which decision**. Dated 2026-10-11. This index is not itself a production deployment, capability manifest, token launch approval, or permission to modify infrastructure.

**START HERE** before using a BINRAT README, roadmap, PRD, docs canon, LLM skill, branch or receipt as instructions. **One entrypoint does not mean one giant source of facts:** factual authority is deliberately delegated to the correct domain and exact deployed version.

## 1. Authority by question — no competing owners

| Question / domain | Governing authority | What it does **not** prove |
| --- | --- | --- |
| **What are we building?** User promise, Rat roles, MVP sequencing, user-facing kill criteria | [Founder North Star](BINRAT_FOUNDER_NORTH_STAR.md) | Does not prove a Rat is live, activate token rights or authorize a deploy |
| **How do we build it?** Stack decisions, signal pipeline, durability, CI/tools, memory/cost constraints | [Engineering Stack North Star](ENGINEERING_STACK_NORTH_STAR.md) | Suggestions/trials are not installed or production-accepted components |
| **What can agents do now?** Task budget, review/stop procedure, changeset and permission gates | [Agent Work Policy](AGENT_WORK_POLICY.md) + branch-local [AGENTS.md](../AGENTS.md), under explicit owner authorization | A plan or branch rule cannot grant money, production access or signing authority |
| **What is true about code and actual capability?** | Exact reviewed source branch/SHA **plus** current runtime deployment/version, observed API/status/capabilities, digest-bound chain/DB receipts, independent acceptance | README, stale repository manifest, preview, screenshot, green unit tests or former Cloudflare status are insufficient |
| **What can we claim about wallets, tokens and events?** | Direct verified chain evidence, canonical Case/provenance and [claim boundary](CLAIM_BOUNDARY.md), scoped projection contracts | Same funder ≠ same owner; UNKNOWN ≠ negative; receipts ≠ safety/returns |
| **What is approved visually and linguistically?** | Exact owner-reviewed and frozen art/React V3 identity on its source branch, bounded product-language/UX contracts for that exact version | Neither a historic visual mockup nor a generic guideline overrides current data/status truth |
| **What may happen with the $BINRAT token?** | Exact current Pons V2 chain/launch manifest, live upstream verification, launch-gate matrix, legal assessment and separately signed owner-specific execution authority | Historic Arc 5042 configs, roadmaps, product doctrine and green rehearsal are not authority to sign/broadcast |
| **How do we deploy/cut over or recover?** | Exact owner grant + verified environment/server identity, pinned deployment manifest, backups, migration/cutover and rollback proofs | Local SQLite/Compose/browser PASS ≠ independent production hosting or cancellation of old invoices |
| **What is historical context?** | Frozen PRDs, ROADMAP_V0, ArcPad experiments, receipts, prior PRs, snapshots | Historic states, failed tests or superseded proposals do not become present commands |

## 2. Conflict resolver (run in order)

1. **STOP at non-negotiable controls.** Security/legal restrictions, no unauthorized money, external writes, signing, DNS, deploy, account changes, public Telegram/X sends or tokens cannot be overridden by prose or a prior agent.
2. **Require the exact owner grant for a particular action** and keep its scope/budget/time/target. A founder direction such as “build the Rats” is **not** an authorization for a deployment, paid RPC or broadcast.
3. **For live capability or operational claims**, independently check current deployed version, exact chain/endpoint, provider access, publication freshness, source authority and digest/receipts. Never substitute repo-manifest “LIVE,” historical screenshots or a green offline test. If inaccessible, **UNKNOWN / STALE / BLOCKED**, as appropriate.
4. **For planning choose the domain owner in section 1**, not the newest-sounding file or the document that labels itself `canonical`. This index decides *which* authority applies, not factual contents. Product, engineering, experience, token and run-state authorities are **not interchangeable**.
5. **Use exact branch/SHA and time**. The default `main` is historically an ArcPad/backend baseline. Current React V3/Pons integration, self-hosted migration and release receipts may live only on other branches or local worktrees; remote docs do **not** change them automatically. Do not apply a docs-only PR to a different tree without a reconciled diff.
6. **Treat conflict as a blocker**, not a vote among documents. Record both claims, paths, SHAs, deployed reality, chosen domain owner and owner decision needed. No assumed merge or “latest wins.”
7. **Never delete or relabel earlier evidence** to make the canon look consistent. Preserve historic documents, raw observations and failed results; mark old proposals `HISTORICAL / SUPERSEDED FOR CURRENT DECISIONS`.

## 3. Explicit supersession registry

| Earlier or competing text | Status today | Replacement / interpretation |
| --- | --- | --- |
| `docs/PRD.md` — ArcPad V0, “no website”, pre-frontend gate | **HISTORICAL** | Founder North Star for current product; Engineering Stack North Star for current architecture |
| `docs/PUBLIC_READ_PLANE.md` — `PUBLIC_PROJECTION_V0` | **ACTIVE VERSIONED CONTRACT; HISTORICAL SOURCE/UI ASSUMPTIONS** | `binrat.public-feed/0.1`, `BINRAT_PUBLIC_PROJECTION_V0`, identity/provenance, `UNVERIFIED` history coverage and digest-bound receipts still govern implementations using that projection, including Pons Cases. Only ArcPad-only source assumptions and the no-frontend boundary are superseded; newer Case schemas keep their own exact contracts |
| `docs/CODEPLAN.md`, `docs/INTELLIGENCE_V1.md` (on integration branches) | **HISTORICAL/BRANCH-SCOPED** | Not today's default implementation plan or Pons authority |
| `docs/ROADMAP_V0.md` and old token/genesis schedules | **HISTORICAL PLANNING** | Founder MVP sequencing, exact current token gates and verified runtime status; no launch/entitlement escalation |
| `docs/ROADMAP.md` (“canonical future-product authority”) on integration | **FUTURE FEATURE MAP ONLY** | Founder North Star controls *strategic product priorities*; roadmap may enumerate ambitions but never outranks founder, evidence, launch/legal or current runtime |
| `docs/PHILOSOPHY.md` | **PRESERVED PRINCIPLES, NOT EXECUTION** | Evidence and fair-launch constraints can remain, old Arc/feature status/time-specific commitments subordinate |
| `docs/BINRAT_LAUNCH_NIGHT_CANON_V1.md`, `docs/TOKEN_LAUNCH_DOCTRINE.md` | **SCOPED LAUNCH PLANNING** | Exact reviewed Pons manifest/gates/verified receipts/legal + owner grant decide launch actions |
| `docs/CAPABILITY_MANIFEST_V0.json` committed snapshot | **VERSIONED REPOSITORY SNAPSHOT** | Current live capability claims require verified runtime-served manifest + active deployment provenance; repo snapshot alone cannot prove current live |
| Visual lab/demo/status receipts/old infrastructure docs | **EXACT-VERSION EVIDENCE ONLY** | Approved visual freeze only for the exact asset/source; runtime needs its own verified acceptance |
| Self-hosted migration / VM access reports | **EXACT-VERSION EVIDENCE ONLY** | Use the pinned sources in section 6; a restore, access or local UI result proves only its measured scope, never scanner/deployment/custody/DNS acceptance |

The older files may exist on other branches with headings such as `CANONICAL`, `FROZEN`, `CURRENT` or `LIVE`. Those headings only describe the original phase/contract unless the above domain authority and up-to-date evidence also support them. **Do not search-and-replace historical results.**

## 4. Engineering choices with no shadow authority

The single technical policy is [ENGINEERING_STACK_NORTH_STAR.md](ENGINEERING_STACK_NORTH_STAR.md): `viem` + SQLite/`better-sqlite3` + existing Node API and React V3; deterministic receipt-first data, typed bounded Rat jobs and outbox; no uncontrolled production MCP mesh. Zod/Pino/SQLite FTS5 and CI/agent tools are **candidates/trials**, not blanket dependencies. Never import old ArcPad source choices or new OSS tool recommendations as live runtime decisions.

Do not equate:
- product aspiration with deployed functionality;
- a branch's `CAPABILITY_MANIFEST` with present production state;
- a local test with a future event/real Telegram alert;
- a token launch plan with permission to sign;
- a frozen candidate with production cutover;
- an approved library **trial** with implementation permission.

## 5. Maintenance contract

- Entry instructions in `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md`, `README.md` and `docs/README.md` **link here instead of introducing alternative precedences**.
- A domain owner may refine *its own scope* but cannot self-promote to universal source of truth. A versioned ADR/owner approval records substantive changes; change this index and its dependent entrypoints in the same reviewed PR.
- New proposals must state: `STATUS` (ACTIVE_DOMAIN_POLICY / CANDIDATE / EXACT_VERSION_RECEIPT / HISTORICAL), `DOMAIN`, `SOURCE_BRANCH_SHA`, `AS_OF`, and `AUTHORIZATION_EFFECT` (normally NONE).
- Do not rewrite immutable evidence/receipts, historical commits, signed manifests or security controls; historical documents receive a warning header only when warranted.
- If branch-level docs disagree, report **AUTHORITY_CONFLICT** with concrete paths and SHAs before implementation. Promote this index into each active source branch through an explicit reviewed integration; **a draft PR cannot make all branches consistent by itself**.

## 6. Exact evidence lookup (review snapshot 2026-10-11)

These are source locators, not current operational status or renewed action grants. Read the selected document at the stated SHA, distinguish its contract from its historical acceptance results, and reconcile any later evidence for the same environment before making a present-tense claim.

| Domain | Pinned source to inspect |
| --- | --- |
| Pons public truth and source-bound Cases | Integration `30564864f5d406414f0c09c4d2ba2be5d1e79ab8`: [public truth contract](https://github.com/CipherCuttle/binrat/blob/30564864f5d406414f0c09c4d2ba2be5d1e79ab8/docs/BINRAT_PUBLIC_TRUTH_ACCEPTANCE_V1.md), [additive Case evidence contract](https://github.com/CipherCuttle/binrat/blob/30564864f5d406414f0c09c4d2ba2be5d1e79ab8/docs/BINRAT_SPRINT_A1_2_CASE_CONTRACT.md). These do not retire the still-used V0 projection |
| React V3 visual/source selection | Same integration SHA: [visual direction freeze](https://github.com/CipherCuttle/binrat/blob/30564864f5d406414f0c09c4d2ba2be5d1e79ab8/docs/BINRAT_REACT_VISUAL_V3_FREEZE_V1.md), [Pons read-integration boundaries](https://github.com/CipherCuttle/binrat/blob/30564864f5d406414f0c09c4d2ba2be5d1e79ab8/docs/BINRAT_REACT_PONS_READ_INTEGRATION_V1.md), [dated release source/build procedure](https://github.com/CipherCuttle/binrat/blob/30564864f5d406414f0c09c4d2ba2be5d1e79ab8/docs/BINRAT_V3_PRODUCTION_SPRINT_20261009.md). Neither a direction freeze nor a past cutover grant authorizes a new release |
| Pons token execution and publication gates | Same integration SHA: [launch authority contract](https://github.com/CipherCuttle/binrat/blob/30564864f5d406414f0c09c4d2ba2be5d1e79ab8/docs/BINRAT_PONS_LAUNCH_AUTHORITY_V1.md), [Pons plan](https://github.com/CipherCuttle/binrat/blob/30564864f5d406414f0c09c4d2ba2be5d1e79ab8/docs/BINRAT_PONS_LAUNCH_PLAN_V1.json), [Pons gate matrix](https://github.com/CipherCuttle/binrat/blob/30564864f5d406414f0c09c4d2ba2be5d1e79ab8/docs/LAUNCH_GATE_MATRIX_PONS_V1.json). Plans/snapshots are not fresh upstream proof or owner authorization |

Migration evidence is local on `migration/binrat-survival-v1` at **`a269d8272ec93e41b00ebfcf6c528074a2c4c898`**, inspected in `/home/swirky/DevHub/worktrees/binrat-survival-v1`. At that exact commit, read:

- `docs/migration/LOCAL_COMMIT_OFFLINE_REVIEW.md` for the checkpoint and unresolved gates;
- `docs/migration/D1_RESTORE_PROOF.md` and `docs/migration/PRODUCTION_RESTORE_EVIDENCE.json` for recovered production history;
- `docs/migration/SELF_HOSTED_REPLACEMENT_PROOF.md` and `docs/migration/BLOCKER_CLOSURE_PROOF.md` for local runtime/Case/browser evidence and its limits;
- `docs/migration/BLOCKER_CLOSURE_EVIDENCE.json`, `docs/migration/HETZNER_DEPLOYMENT_CHECKLIST.md` and `docs/migration/OFF_DEVICE_BACKUP_CUSTODY.md` for source, environment and custody gates;
- `docs/migration/OFFICIAL_RPC_CANDIDATE.md` and `docs/migration/OFFICIAL_RPC_CANARY_PLAN.json` for the unexecuted, separately gated diagnostic proposal.

Use `git show a269d8272ec93e41b00ebfcf6c528074a2c4c898:docs/migration/LOCAL_COMMIT_OFFLINE_REVIEW.md` and the other exact paths above when that object is available. This local commit is not assumed published or present in every clone. If unavailable, report the missing evidence; do not substitute old Cloudflare status. Any later VM `ACCESS_PASS` report requires its exact receipt, environment and time reconciled with this checkpoint before it can change the recorded identity blocker. This router does not certify such a pass. Qnty/QntyLab/Frontier remain outside BINRAT's action scope; billing, deployment, DNS, source collection and backup custody each need their own evidence and authorization.

**This file and its PR grant no new spend, remote write, deployment, merge, DNS change, provider bypass, public notification, trading or token transaction.**
