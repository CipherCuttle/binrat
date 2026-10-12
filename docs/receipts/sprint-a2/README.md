# A2 — bounded Case outcome intelligence

A2_EVIDENCE_VALUE = LIMITED. The finding is useful and source-bound, but most current outcome coverage is absent. A2 is a read-only review candidate, not a production release.

## Exact source and real specimen

The branch starts at deployed A1 source `30564864f5d406414f0c09c4d2ba2be5d1e79ab8`. Provider readback confirmed Worker 106 `28ebc65b-bb14-4862-b677-cbe74b6aad2b`, deployment `2d526347-5375-449c-8300-e6cb3496bf15`, and module SHA-256 `4ca255e4381f1440df3e385805c399c5d7c5a09c001822f5f1b70748d99da0b8`. No deployment, merge, D1 write, collector activation, token or DNS operation occurs in this sprint.

Deployer `0x0e1651aec67b2a049a4fa6aeb6c1c305aabfc35b` had 1,625 earlier launches in the initially inspected current feed. It was the strongest recurrence in that feed and bounded latest-200 inspection; this is not a claim about all indexed deployers. That count is not borrowed into the specimen.

Forensic Case: `/bag/a990a51200774466822d24e4a17961447396b9749cdd2cdcc9d5fe4b22f1b992`, observed at block 76069792. Its own reconstruction returns 12 canonical source records, 11 earlier, through that exact launch. All 12 have retained 5m/1h/24h target-age samples (36 receipts). The 11 earlier launches have 33 samples: 32 CURVE, one GRADUATED. These are sampled states, not a complete lifecycle or an assertion that the other launches never graduated.

The graduated launch is `3505b63b75a19b9a13b3b27d5740b74fff91f47e6bcb9ed12ccd31a46ab23c5b`, token `0xaead3b6b04882b56a2dc9abbf49af407fe1ad901`, launched at block 75926232. Its earlier two targets recorded CURVE; its 24h target recorded GRADUATED at block 76785421, hash `0x893b7dc442045c334fece415aeb241c2ef098f133b79b954a40eee42072d145f`. The receipt digest is `1d486ac1f0238f7152e35101436b4404ad12f6b6b26a9002da1b970668b87d78`. It is explicitly PARTIAL, missing `V4_POOL_STATE`, with no valuation. Graduation does not establish profitability, liquidity, sellability, success or intent. No fresh RPC independently rechecks the recorded phase.

This matters because someone can inspect an actual earlier lifecycle observation, rather than treating recurrence alone as suspicious. The exact chronology, missing fields and raw supporting receipt remain accessible. There is no risk score or prediction.

## Coverage and unknowns

- OBSERVED: indexed launch identities, deployer, tokens, transactions, blocks and retained outcome samples.
- DERIVED: canonical identities/digests, provenance derivation, exact publication binding, returned-window counts and sample coverage.
- UNKNOWN: current market activity, human ownership, funding relationships, profitability, sellability, current lifecycle state and exact graduation time. No scam inference.
- PARTIAL: at most 20 records through the selected Case, three retained horizon receipts each; the returned window is not complete deployer history. Reconstruction uses a current published checkpoint, not an archived original publication.

The initially selected recent Case `1d8c52997e1375ea409e0497134c1b0b3ad24b56ccaae9f14ded1a69cfaba7f7` returns 20 records / 19 earlier, all without outcome receipts. No historical graduation is imported into that recent window. Exact-token identity and activity checks found no retained corresponding recent receipts; absence is not inactivity. Funding experiment tables are absent from current D1, so funding is UNKNOWN. Deferred outcome, token-identity and funding branches were inspected for existing receipt authority; they were not bulk merged. Identity-only name enrichment was left out of this slice.

`specimen.json` is actual read-only production data used only by tests/preview, never a LIVE fallback or hardcoded product finding. The atomic snapshot/checkpoint/runtime frame was captured at `2026-10-09T23:29:26.253988+00:00`, publication 1242 / block 84543560. The selected current-feed regression Case is `284afbd28e3b23002fd839dd53de085044592bc3cd79e55fb226bdc8d5ffb579` and is present in that frame. The preview freezes the capture-time clock; its FRESH label describes that capture only.

## Small vertical slice

The existing GET `/api/bag/:id/evidence?include=outcomes` returns a strict outcome envelope containing the unchanged Case envelope and per-launch canonical receipt payloads. Default v1 reads remain unchanged. The reader uses the existing indexed launch/horizon key, at most 20 point lookups and three receipts each. Payload sizes and stored columns are checked. Shared backend/browser verification checks identities, provenance, both digests, time/block bounds, repeated horizons, consistent target ages and known block hashes. Publication movement or durable checkpoint rollback fails closed. No new route path, binding, migration, collector, public capability flag or AI authority.

WHY adds the supported outcome finding and coverage. TRAIL adds sample chronology and expandable technical proof. RECEIPTS exposes the canonical envelope. Existing V3 artwork, styles, discovery, Crew, exact sharing and WHY → TRAIL → RECEIPTS → NEXT remain. A known legacy `observedAtMs` ingestion field is removed only after canonical stored-source and provenance checks; unknown fields still fail. This lets valid older authorities reopen without changing D1.

## Reproduce and review

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm --dir web-v2 check
pnpm --dir web-v2 build:production
# In a separate clean worktree of exact A1 source, build the same commands.
BINRAT_A1_WORKTREE=/absolute/path/to/clean-a1-worktree \
  pnpm exec tsx web-v2/checks/serve-a2-preview.mjs
# Native Playwright 1.56.1 installed in BINRAT_FRONTDOOR_TOOLS:
node web-v2/checks/a2-case-browser.cjs
```

A2 compiled replay: `http://127.0.0.1:4205/bag/a990a51200774466822d24e4a17961447396b9749cdd2cdcc9d5fe4b22f1b992`. A1 comparison: port 4204. When using the reviewed A1 archive, set `BINRAT_A1_SITE` to its `site` directory. The preview requires clean exact builds and checks every static asset against its manifest. Browser receipts in `.artifacts/a2/browser/` cover 1440, 1024, 430, 390 and 320 pixels, before/after renders, proof expansion, sharing, navigation, current missing outcomes and explicitly simulated stale/503/digest controls. No production fault injection.

One bounded hostile self-review found a High stored-column binding omission and a Medium wording issue. Both were fixed; the targeted rereview and final receipts are in `.artifacts/a2/`. This is not an independent external review. Native Playwright supplies console/network/browser truth; the Chrome DevTools MCP could not start because its headful browser lacks an X server.

## Cost

No sprint RPC scans or Alchemy RPC calls, and no new continuous indexing. Authenticated Alchemy readback remained $0.68 used / $9.32 remaining / $10 setting; the setting is not a hard cutoff. Existing production continues its normal indexing. An exploratory historical D1 join unexpectedly read **14,928,760 rows** despite a bounded result. That path was stopped and is not shipped. Subsequent reads use exact indexed IDs; the runtime query plan is tested for SEARCH on the existing index. The exploratory D1 cost is not represented by Alchemy's summary; no dollar amount is asserted for it.

Stop for owner review. No deployment authority is inferred from tests or the draft PR.
