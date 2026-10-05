# History before funding repair V1

Isolated offline repair from draft #129 head `9759e02a44c9a6a60390d33db70f57166916e90c`.

Replay retains a verified recipient-window receipt when it arrives before funding. The first matching
watched-funder transfer reconciles those pending reads in arrival order through the same exact recipient
and declared-window checks used for history arriving after funding. No absence claim or handoff is emitted
until funding is available. `holdout-094b54b80018` now creates its handoff at block **1517** and admits
the later launch at block 1529, available at 1533.

Each unique history receipt consumes one `READ_RECIPIENT_WINDOW_FIXTURE` reservation at its availability
block. Reconciliation does not charge it again. Pending state is local to replay and bounded by both the
V1 maximum of 64 input receipts and the original tool budget. An unmatched or self-funding transfer does
not make an available history read free. Identical duplicates remain idempotent. Integrity failures,
canonical degradation, partial coverage, seen recipients, authority and strictly future launch rules
retain their existing behavior. Resume reconstructs and verifies the checkpoint, including charged
pending work, then deterministically replays the job.

## Regression evidence

The registered 40-case pack is now regression input. No new holdout was constructed.
`test/fixtures/workforce/benchmark/history-before-funding-results-v1.json` is the separately named
post-fix report. The report identifies repaired execution as `FROZEN_REGRESSION_AFTER_REPAIR`.

| Arm | Historical recovered/eligible | Repaired recovered/eligible | False alerts | Unsafe artifacts |
|---|---:|---:|---:|---:|
| Deterministic replay | 15/16 | 16/16 | 0 | 0 |
| Synthetic allowed proposal + admission | 15/16 | 16/16 | 0 | 0 |
| Always suppress | 0/16 | 0/16 | 0 | 0 |

Both repaired arms complete 38 ordinary cases and separately report the two expected source rejections:
`DIGEST_MISMATCH` and `EVENT_ID_CONFLICT`. All 160 adversarial rejection probes pass. There are zero
unexpected exceptions, incorrect handoffs or inadmissible Case additions on this finite regression pack.

- Original #128 registered boundary source digest:
  `7a81929dc0bb5ec457a006d1e09d9b7d392efcaae6cedef24b0961456cd2c236`
- Actual repaired boundary source digest (named `offline.ts` and `proposal.ts` bodies in canonical JSON):
  `30decdc4d18b9cd04c56143e0f172abada759b5151b576d22f908bcaba45e366`
- Repaired harness source digest:
  `604ec35dd5a7cff706fe2c4b27896e0f9910f03d73e4393dd00a4b3d9f51bbd3`

The registration, generator, case manifest, historical development and holdout reports, recorded audit,
and lockfile retain their pinned-head bytes. Tests pin the six historical file hashes independently of
fresh execution, while the fresh report is reproduced exactly from the repaired source. The original
`OFFLINE_PIPELINE_FAILED` report remains intact. Recorded model outputs and scores remain intact with
`SPECIALIST_FAILED_SAFETY_GATES`, 0/13 complete-case passes per arm and $0.028177 original reported cost.
New model calls are **0** and new model cost is **$0.00**. This repair establishes finite pipeline
regression results; model competence remains `UNPROVEN`.

## Verification and rollback

From the new worktree: pnpm **10.15.0**, `pnpm install --frozen-lockfile`, `pnpm check` (523 repository
tests plus TypeScript and web checks), and `pnpm --dir web-v2 check` pass. The regular tsx CLI works;
no IPC fallback was needed. The report is reproduced using `pnpm workforce:benchmark holdout`;
this legacy CLI mode name refers to the frozen manifest, not a newly untouched holdout.

One independent hostile review found no Critical/High issues. Its offline probes covered 12 address/ID
variations, early boundaries, delayed funding, duplicates, unrelated pending history and resume equivalence.
One targeted rereview confirmed the frozen case's history read at 1511, funding read at 1517, no artifacts
at checkpoint 1516, exact resume equivalence, matching report/source digests and frozen-file integrity.
There are no unresolved Critical/High findings; review is closed.

The repair remains limited to one recipient and one finding per bounded offline job. It does not
reconcile arbitrary event types or revise the existing first-matching-history policy. Revert the single
repair commit to return to the pinned #129 implementation; the separately named post-fix report and
this note will be removed, while the original six evidence files remain unchanged.
