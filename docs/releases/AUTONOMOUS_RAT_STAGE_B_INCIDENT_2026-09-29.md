# Autonomous Rat Stage-B activation incident — 2026-09-29

- Candidate code SHA: `a447fc948f49195e94294c59d8ee7c2ae06024e5`
- Stage-A Worker: `e357f792-b8e3-4916-b105-57b203e35389`
- Inactive Stage-B Worker: `5027ba20-7414-477e-aa7f-1fa1ffa68c0d`
- Rollback Worker: `f2bc0c47-d9b8-4a5d-a72c-f0b60a199843`
- Rollback deployment: `cba846ac-7b3d-4d39-9582-2ce98d9523a5`
- Rollback time: `2026-09-29T14:44:37Z`

## Incident

Before Stage-B traffic activation, the shared production index repeatedly reported
`lastSyncError: SYNC_FAILED`; `/api/health` was not ready/caught up and the feed
and Rat Radar failed closed. The bounded recovery check failed twice.

Traffic was immediately returned to the previous known-good Worker. A first
post-rollback health sample recovered, then the same `SYNC_FAILED` recurred.
This establishes that the observed source/index failure was not caused by
activating Autonomous Rat: the flag-on version was never deployed to traffic.

## State retained safely

- The V1 and V1.1 migrations remain in place; they are additive.
- Stage-B Worker version remains inactive at 0% traffic.
- No V1 watches, outbox rows, discovery snapshots, or public receipt rows were
  created during this activation attempt.
- No Telegram two-user smoke commands beyond the identification `/start` messages
  were performed.

## Required next gate

Restore two consecutive healthy production index snapshots with no sync/history/
observation error before restaging Stage B. Re-run the controlled two-user smoke
only after that gate passes.
