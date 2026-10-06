# One-shot indexed archive probe V1

This slice connects #138's existing V3 journal to the existing
`BINRAT_ROBINHOOD_ARCHIVE_RPC_URL` GitHub Actions secret. It changes no production
route, provider settings, subscriptions, delivery, model or capital authority.

The transport accepts only the existing Alchemy Robinhood archive host and key
path (or a bare key). Only `alchemy_getAssetTransfers` uses this credential.
Canonical chain reads use the fixed keyless RPC. Each HTTP request is one attempt,
with a 15-second timeout, no redirects/retries and a 1 MB streamed response limit.
HTTP failure bodies are retained; credential-reflecting bodies are discarded with
an explicit error. Raw URLs, keys and transport exceptions are never logged.

The runner creates an exclusive fresh output directory and journal. It reserves
before requests, waits 60 seconds before the first indexed head observation,
and stops at the first confirmed provider-indexed range, a validated research
handoff, or any terminal state. Waiting for a head to advance uses 30-second
observation intervals. It has an eight-minute local time bound and the same
original 48-reservation allowance; failed and uncertain reservations count.
There is no resume, replay with network, automatic retry, replacement capture
or fresh-budget continuation. Ordinary keyless CLI execution still rejects V3.

The dedicated workflow only responds to the exact one-shot commit message
`[binrat-indexed-capture-20261006-v1]` on its isolated branch, rejects Actions
reruns, and runs the frozen-lockfile install and offline checks before the secret
is injected. No workflow dispatch or scheduled execution exists. Publish the
prepared changes and verify them before making the single trigger commit.
Do not publish the trigger again or rerun a failed job.

After capture begins, success or failure preserves `registration.json`,
`raw-receipts.json`, `audit.json`, `summary.json`, the SQLite journal and
`SHA256SUMS`. Replay is offline through the existing audit command.
Missing/invalid secret settings produce a zero-attempt audit. Build/install
failure occurs before registration and has no capture receipts.

An empty indexed page demonstrates only the provider's enumeration of that
declared range at observation time. It proves neither chain-wide absence nor
index freshness. A prepared handoff is not a later-deployment proof. No model
competence, production readiness, delivery or fiat/stake economics are inferred.
RPC billing is unknown unless the provider supplies separate cost evidence.
All historical journals, frozen evidence, schemas and model verdicts remain intact.

Bounded review: one hostile self-review found a medium-severity gap in credential
reflection filtering for truncated, escaped JSON. Filtering now decodes escapes
without requiring a complete JSON document; the targeted regression covers it.
The targeted rereview checks routing, partial bodies, timeout, allowance, receipt
retention and this fix. No independent reviewer or subagent is claimed.

Local invocation after build (key supplied in the named environment, never as an
argument):

```sh
node scripts/probe-indexed-funder.mjs --out /absolute/new-directory \
  --capture-id indexed-archive-20261006-v1 --source-sha <exact-commit-sha>
```
