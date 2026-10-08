# BINRAT — first bounded prospective evidence capture

**Date:** 2026-10-08 UTC
**Captured at:** `2026-10-08T01:52:54.862Z` (after GitHub reads; web-page excerpts were reviewed during this session)
**Branch:** `experiment/binrat-prospective-capture-20261008-v1`
**Authority:** Research-only, no production/runtime/autonomous watching.

## What is actually captured

Three public GitHub REST GET response bodies from **0xMiden/node**
are committed verbatim as UTF-8 JSON files. The fixture contains the SHA-256
digest of each **exact saved response string**. Git history additionally
pins the snapshot. GitHub API responses can themselves describe mutable
release/PR metadata; these copies are point-in-time captures, not proofs
of earliest publication or unchangeable upstream content.

Logos and Rialo websites were inspected through search/text extraction.
Their URL and attributable claims were recorded in the fixture with
`WEB_TEXT_EXCERPT_NOT_RAW_CAPTURE`. **No HTML/body bytes or SHA-256 of
those upstream pages were captured.** The git commit makes our observation
record tamper-evident, not the external page state prior to this session.

## 1. Logos — public testnet confirmed, no dated mainnet commitment

- Official roadmap: https://logos.co/roadmap
- Official Oct 7 development update:
  https://logos.co/media/article/logos-dev-update-sep-2026
- Testnet v0.3 was released **September 30, 2026**; it is explicitly
  testnet / ecosystem-dynamics validation.
- Mainnet: **IN DEVELOPMENT**, target **H1 2027**, with roadmap itself
  warning that timing and features can change.
- Result: public testnet progress / medium-horizon Scout prospect only.
  No exact official `YYYY-MM-DD`, verified production deploy, audit-closure
  chain, or V0 multi-family pressure. **Coverage PARTIAL**.

## 2. Miden — independently pinned mainnet-specific code, still not live proof

Three first-party GitHub API response bodies in `receipts/2026-10-08/`:
- release `0xMiden/node v0.17.2`, published 2026-10-07T11:50:16Z
  https://github.com/0xMiden/node/releases/tag/v0.17.2
- PR #2744, merged 2026-10-07T08:07:54Z:
  https://github.com/0xMiden/node/pull/2744
  Adds mainnet bootstrap/full-node network selection; code supports
  mainnet-specific endpoint naming.
- PR #2743, merged 2026-10-07T08:31:06Z:
  https://github.com/0xMiden/node/pull/2743
  Genesis USDCx faucet uses a V2 policy manager to prevent a paused
  genesis fee token from irreversibly blocking fee payments.
- Immutable Oct 7 commit:
  https://github.com/0xMiden/node/commit/40f458ed3c20fb1ef2ddc71e3d70d840aed4be47

**Interpretation:** mainnet-specific implementation and genesis
hardening are real, recent engineering receipts; more informative than
ordinary testnet activity.

**NOT proven:** public mainnet execution, live chain/network status,
blocker closure, production genesis distribution, public launch date or
a launch within 30 days. One release's notes are not automatically two
independent P1/P3/P6 families. Mainnet flag support is not production
infra activation. No `ARMED` or `PRODUCTION_PREP` promotion from this
snapshot alone. **Coverage PARTIAL**.

## 3. Rialo — public status claims conflict; authority incomplete

- Rialo first-party project introduction (2025-09-25) documents its
  private devnet: https://www.rialo.io/posts/introducing-rialo/
- `rialoscan.org` public search index claims testnet/devnet RPC active
  and mainnet not live, but direct fetch yielded HTTP 402, and the
  research did **not** establish endorsement/ownership by Rialo.
- `rialo-os.vercel.app/build` describes invite-only devnet and public
  testnet not yet live. Its ownership and freshness are likewise unknown.

These lower-authority claims are inconsistent about *testnet*. They
must NOT be blended into a first-party status claim, used to infer a
live mainnet, or used as verified non-launch labels.

**Coverage PARTIAL / SOURCE_CONFLICT.**

## Correctness gates

- Exact prospect identities match the frozen three-project registry.
- GitHub captured source SHA-256 checked against the committed JSON.
- All claimed source publications <= snapshot capture time.
- At least two Miden PRs independently identifiable and merged before
  release; both are source-literal **code milestones**, not mainnet execution.
- All three remain `PARTIAL`, with V0/V1 admission false.
- No negative/positive labels, returns, probabilities, or investment
  claims generated from missing source coverage.

## Verdict and next action

**ONE CAPTURE COMPLETED / 0 coverage-VERIFIED projects / 0 scored
launch forecasts.**

Miden has the strongest **specific mainnet-code preparation** evidence
of the three. A next *bounded* source-only exercise would validate the
referenced mainnet bootstrap configuration and check if an independently
attested production genesis/network has ever activated. Do not use a
mutable page's current content to backdate that activation.

Do not create a scheduler from this branch. The original BINRAT token
launch/read-plane stabilization remains independent. No merge, deploy,
transaction, wallet, marketing claim or public predictive alert.
