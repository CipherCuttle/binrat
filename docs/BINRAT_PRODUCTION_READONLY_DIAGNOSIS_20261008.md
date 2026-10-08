# BINRAT — production read-only status diagnosis (2026-10-08)

**Scope:** One bounded rerun of the *existing* read-only GitHub Actions
production-preflight broker on main; no deployment, Worker config mutation, D1
write, Telegram message, token action or live publishing.

## Reproducible evidence

- GitHub run: https://github.com/CipherCuttle/binrat/actions/runs/37245847956/attempts/2
- Job: `readonly-inspect`, attempt 2; started 2026-10-08 ~02:19 UTC.
- Sanitized artifact: `cloudflare-production-readonly-inspect`, artifact id
  `11523932512`, created 2026-10-08T02:19:58Z.
- Broker Actions conclusion: `success`; **artifact's actual verdict:
  `FAIL`**, reason `status endpoint HTTP 503`.

| Read-only check | Observed |
| --- | --- |
| `GET /api/health` | HTTP 200; chain 4663; `indexReady=true`, `liveCaughtUp=true`, `runtimeFresh=true`; checkpoint 82959089 and head 82959091 |
| `GET /api/launches/latest` | HTTP 200; response chain 4663, source checkpoint 82959089 |
| `GET /api/status` | **HTTP 503; Cloudflare body `error code: 1102`** |
| `GET /api/dumpster-ledger` | HTTP 200, **chainId 5042** (historical Arc presentation, not current Pons 4663) |
| Cloudflare production D1 | database `binrat-v0` verified, expected ID bound |
| D1 `binrat_public_snapshots` | table present, **one** row. One row alone does NOT establish fresh, bound publications |
| D1 numeric launch indexes | source-block / block / source-creator-block indexes present |
| Current production Worker | `binrat-edge-v0` present, 100% active version in latest deployment |
| Latest deployment timestamp | **2026-10-05T00:38:45Z**; no new deployment in this work |

The raw, sanitized inspection artifact is accessible via the GitHub Actions
run. This document intentionally excludes full Cloudflare binding values and
unredacted diagnostic bodies.

## Strong code-level explanation, not confirmed CPU-vs-memory root cause

Prior production `/health` reports recorded release source
`53325fd0806765578ed6921428ad55f15a9728f1` (2026-10-02). In that
source's `src/cloudflare/worker.ts`, the `/api/status` path is **absent**
from the early GET route dispatch and therefore falls through to the much
heavier `readyContext`/full index-projection path.

The reviewed candidate **PR #151**, exact head
`e34a94cf1702340582266852495e28423728add0`, adds the
bounded `/api/status` route before any full projection, bounded read-only
status calculation and an early 404 for unsupported paths. It also routes
`/api/dumpster-ledger` through the current Pons public-product projection.

The old routing creates a plausible direct explanation for HTTP 1102,
but the public HTTP receipt does **not** prove whether Cloudflare exhausted
CPU versus memory, or independently bind the latest deployed Worker binary
back to exact source SHA. Keep the diagnosis `STRONG_CODE_CORRELATION`,
not `VERIFIED_RUNTIME_ROOT_CAUSE`.

## Actual launch-readiness consequence

The public read plane is **NOT ACCEPTED**. Backend index health and a healthy
latest-launch feed are meaningful but do not cure `/api/status` 1102,
historical chain-5042 presentation, or missing active Worker/build identity.

The existing Workflow was itself giving a **false green** when artifact
verdict was FAIL. Draft PR #163 changes only the broker's exit gate and
synthetic tests; it **does not** modify or deploy the production Worker.

## Minimal continuation (separate approvals required)

1. Verify the exact chosen PR #151 source/artifact/Worker version against
   expected Pons/Robinhood and current chain 4663 presentation.
2. Obtain explicit owner authorization for any candidate or production
   deployment; the deployment must not grant token signing/broadcast.
3. On the approved deployed artifact, repeat bounded read-only status,
   Case, chain-ID, body-integrity and 1102 checks; verify two independent
   advancing canonical publications over the resolved >=61-second cadence.
4. Keep the legal, staking/launcher semantics, token owner inputs, and
   precise one-send approval as separate launch gates.

**Verdict: `PRODUCTION_BLOCKED_READ_PLANE` / do not merge, deploy, launch or
publish token marketing from this research/diagnosis alone.**
