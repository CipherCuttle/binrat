# Local Den V1

The local job lifecycle from #132 now has a browser screen: **start → leave → return → inspect receipts**. It is a small usability experiment, not a live worker release. The public frontdoor, roster and Den BUILDING explanation are unchanged.

## Run it locally

From this branch, at the repository root, with the pinned dependencies installed:

```sh
pnpm den:local --db /tmp/binrat-local-den.sqlite
```

Open **http://127.0.0.1:4185/**. The optional `--port 4186` changes the local port. An explicit dedicated SQLite path is required; foreign databases are rejected by the existing controller. Do not use a production database. Stop the server with Ctrl+C, then restart with the same path to reopen the same jobs.

1. Choose **Recipient launches later** and start a replay job.
2. Run the next step twice: funding at block 100, history at 101. The job is saved and waiting.
3. Close the tab or restart the server. Reopen the bookmarked job URL.
4. Run the next step at 125. Inspect the supported synthetic Case and prepared notification.
5. Export the saved source and journal. The export is explicitly raw, unverified evidence.

There is no background scheduler. Progress requires a button press. No API key, RPC connection, model provider, Telegram recipient or wallet authority is requested. The demo wallet and block window are supplied fixture data; arbitrary real-wallet jobs are not admitted.

## Scenarios and return states

| Scenario | Expected lifecycle |
| --- | --- |
| Recipient launches later | Saved prefix → typed handoff → supported Case → prepared notification. |
| No later launch in the tape | Deadline reached; no finding in this declared synthetic tape. No claim about real chain activity. |
| Recipient history is missing | Deadline reached with incomplete coverage. No clean result, Case or notification. |
| Budget stops the job early | Two logical tool calls exhaust the original replay budget. No Case or notification. |

Cancellation stops a nonterminal job immediately and durably. Terminal jobs cannot be advanced again. No finding is displayed before receipt admission. Notifications say **PREPARED ONLY · NOTHING SENT**; they have no delivery target or permission. Tool counters describe logical replay reservations, not RPC usage, repeated verification CPU or billing.

Scenario names are deliberate demo guidance. This is not a model benchmark, holdout or proof of specialist competence. Historical failed model and dataset verdicts remain unchanged.

## Isolation and recovery

- HTML/JS/CSS live in `local-den/`, outside Cloudflare's configured `web/` asset directory. Approved fonts and the existing avatar are served unchanged by the local allowlist. No assets are regenerated.
- The server binds only to `127.0.0.1`. Host and Origin checks, a per-process session token, JSON-only writes and CSP deny cross-origin admission. The token is generated locally and never logged; this is not an OpenRouter or production credential.
- The local adapter imports only the replay controller. No production route or deployment binding imports it.
- The controller retains original budgets and atomically saves checkpoint/Case/notification. Reads replay and verify journal integrity. A damaged job appears unavailable while other verified jobs remain visible; its raw export remains available.
- At most 24 jobs and eight queued operations are admitted by this prototype. The existing 32-advance and fixture size bounds remain. There are no automatic mutation retries.
- A failed or malformed refresh preserves the prior view, marks it potentially stale and pauses controls. A server restart rotates the token; an open tab offers **Reload local Den** to recover without resubmitting work.
- Create requests use an idempotency identity. If a response is lost after creation, successful refresh finds the saved job and clears that pending identity. The next intentional start creates a new job.

SQLite persistence is local. It does not establish browser-session authentication against a local actor able to read/rewrite the entire file, production scheduling, live coverage, actual alert delivery or pricing readiness.

## Verification and bounded review

TypeScript and full repository tests pass. The eight new HTTP/invariant tests cover origin/token/host isolation, explicit asset serving, typed inputs, idempotency, cancellation and outcome semantics, restart/token rotation, damaged-job export and persisted capacity. The regression also checks that no prototype HTML is present in `web/`.

Pinned Playwright 1.56.1 verifies 320, 360, 390, 430, 768, 1024 and 1440 px. Checks cover first-action visibility, keyboard activation/focus, no overflow, leave/reopen, actual server restart, Case/notification/export, cancellation, deadline/coverage/budget states, unavailable/malformed refresh and uncertain create-response recovery. No external requests are allowed. The standalone `local-den-browser` workflow repeats this against isolated synthetic SQLite files and uploads screenshots/report as an artifact. Local build, 553/553 repository tests, web checks and Product Surface V2 pass.

Recorded [browser proof](RAT_LOCAL_DEN_BROWSER_PROOF_V1.json), [desktop](proofs/local-den-desktop.png) and [mobile](proofs/local-den-mobile.png) screenshots show synthetic replay only. Human visual/usability acceptance remains separate.

One hostile self-review found a **High** isolation issue: the initial prototype asset folder was inside the public deployment directory. It was moved outside `web/`; the new regression reproduced that mistake before the fix. It also found a **Medium** recovery issue: a token-rotated open tab needed a reload action instead of an endless refresh loop. Both were fixed. One targeted rereview verified the moved allowlist paths, unchanged production assets and open-tab restart recovery. No unresolved Critical/High finding remains; review is closed.

## Owner acceptance and next decision

The engineering gate proves the flow executes; it does not prove the user understands or values it. Try the five steps above. Acceptance is whether the screen makes it obvious what the Rat is checking, what is saved, why a job stopped and which receipts support a finding. Confusing outcome/coverage language falsifies the usability claim even with green tests.

Keep live collectors, durable scheduling, provider activation, Telegram sends and economics in separate slices. Nothing here authorizes merge or deployment. Rollback is reverting this branch commit; the unchanged V1 SQLite schema remains readable by #132's CLI.
