# One hostile review and one targeted rereview

Reviewer: C1, a separate self-review pass. No independent agent/model review is
claimed. Scope: the frozen C1 candidate based on PR #122
`fa23aa77b8c0cf15ca5f3e0f5d5f5638f1da9cd1`, with byte-identical pinned C2 inputs.

## Hostile review — completed once

Pre-review verification: 487/487 tests and all web invariant scripts passed.
Pre-review build ID:
`27626b2215e7e40fb774296fc5c8a8c20d445f62ab7f68afc2e7f25b302f7bbd`.
This was an uncommitted local build, not an immutable release approval.

| Finding | Severity | Reproduction / evidence | Resolution |
|---|---|---|---|
| H1 — cached projection survives remote failure | Critical | Seed a local cached product with launchAuthorized/marketingAuthorized true; return remote HTTP 503. `/token` incorrectly reported authorization YES. Initial hostile test failed. | Discard cached product on failure; local mode always derives from canonical input; revoke token-address/current-authority claims; remote reads have a deadline. |
| H2 — transported claims contradict canonical inputs / current scope | High | A BLOCKED canonical manifest with a projected launchAuthorized true was accepted. Crew/wallet/digest drift variants reproduce the same transport flaw. With no Pons runtime, `/api/health` returned current chain 5042; the explicit scope regression failed `5042 !== 4663`. | Compare transported static crew, wallet, launch, Working Rat and evidence fields with the same deterministic projector and canonical digest. Execution validators unchanged. Current health stays Pons; missing stays unavailable; Arc remains explicitly historical. |
| H3 — future timestamps can claim freshness | High | A matching tuple with verifiedAtMs in the future still projected FRESH_VERIFIED. Initial hostile test failed. Future verification timestamps were also rendered in stale browser copy. | Bound freshness by both publication and runtime age; future timestamps cannot promote Fresh. Suppress future timestamp copy; retain stale verified evidence. Expiry remains enforced while hidden. |
| H4 — unavailable Sniffer proof retains positive copy | High | Research null projected UNVERIFIED but its description still said a funding handoff had been captured. Initial hostile test failed. | Unsupported stages receive unavailable-evidence copy. Overview and selected crew copy consume that projection; missing proof removes affirmative steps and claims. |
| H5 — identity checked only before timed acceptance | High | Observer verified initial health/provider receipt but had no final active-version/health check. A secret/config revision could reuse the same source/build ID during the observation window. | GET active deployment before and after; rebind final runtime version, manifest, build and response headers. Changed revision or unavailable readback rejects acceptance. No provider mutations. |

Initial executable hostile probes H1–H4: **0/4 passed**, proving the defects.
Fixes are covered by `test/publicTruthHostile.test.ts`, read-plane/server tests and
browser checks. The H2 control also proves that legitimate deterministic
transport remains usable; it is not replaced by a permanent unavailable state.

The earlier channel diagnostic separately proved that legacy Arc delivery could
incorrectly arm a newly retargeted Pons subscription. Its red regression returned
“watch armed” and “i will alert”; the repaired path refuses admission. Existing
list/unwatch and gated Pons Watch behavior remain. No Tripwire job was added.

## Targeted rereview — completed once

Only H1–H5 resolutions, their regressions and the original P0 contract were
revisited. No second broad hostile review or optional product expansion.

Evidence:

- Focused server/projection/transport/provenance tests: **34/34 passed**.
- Focused browser read-plane contract tests: **18/18 passed**.
- Complete candidate `pnpm check`: **497/497 passed**, zero failures; web,
  share-card and launch-presentation invariant scripts PASS.
- Native Playwright 1.56.1: seven fixture widths, four LIVE widths; Case/Crew/Den
  navigation, keyboard return, stale retention, tampering, binding conflict,
  unavailable state, future timestamp suppression, private Mini App entry;
  page errors and public writes zero. Separate read-plane resilience PASS.
- YAML parsing and `git diff --check`: PASS.
- Worker package: pinned Wrangler 4.135.0 dry-run only. No workflow dispatched.
- C2 canonical document bytes match the recorded input hashes. Original dirty
  checkout still has its original HEAD and original changed-file inventory.

Verdict: **PASS for the reviewed local code changes.** No unresolved local
Critical/High finding among H1–H5. This self-review does not constitute an
independent reviewer approval or production launch authorization.

## Production gate and STOP

Production remains **UNVERIFIED / not launch-ready**. `/api/status` reproduced
HTTP 503 / Cloudflare 1102. The exact active Worker revision/resource cause has
not been established. Public health reports old source metadata without the new
build identity. Provider read access is absent in this environment.

Still required after separately authorized release: immutable reviewed Git head,
exact artifact/version/manifest mapping, two independent bound publications
across resolved 61-second source cadence, no nonretryable launch-critical 1102,
real fresh Pons → Case, deployed browser and Telegram checks, three-reader
comprehension receipt. These are not fabricated from local synthetic fixtures.

**STOP.** No commit, push, PR action, deploy, publish, live Telegram message,
Cloudflare mutation, token signing/broadcast, economics/launch/gate change or
Working Rat activation was performed. Original shared wallet seam untouched.
See `BINRAT_PUBLIC_TRUTH_ACCEPTANCE_V1.md` for the exact executable gate.
