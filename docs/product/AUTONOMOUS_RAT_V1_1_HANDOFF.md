# Autonomous Rat V1.1 — Rats discovery and public receipts

## Contract

`/rats` is explicit, shared discovery—not a leaderboard, profitability prediction, safety label, or unsolicited alert. It only returns exact Arc 5042 addresses reported as creators in at least two canonical indexed ArcPad launch facts. This keeps every current candidate compatible with the existing creator-only V1 `/watch` route.

The deterministic sort tuple is:

1. distinct canonical indexed-launch recurrence, descending;
2. latest canonical indexed block, descending;
3. retained public evidence count, descending;
4. normalized creator address, ascending.

The implementation never derives or stores a composite score. The rendered recurrence claim is intentionally bounded to the 2–5 retained public receipts shown in the candidate, rather than claiming an unrendered aggregate.

Coverage is always `PARTIAL`: indexed ArcPad launches only, through the verified checkpoint. `authoritativeCheckpoint` is required before discovery; unready, stale, failed, or mismatched source state returns the existing honest unavailable state. `/rats` does bounded D1 reads and canonical fact reconstruction only—never an archive/RPC history scan per user. A neutral entitlement capacity currently provides five candidates; FREE is the sole live profile.

The `RatsSnapshot` contains `discoveryId`, `chainId`, `generatedAt`, `sourceCheckpoint`, `coverage`, `ruleVersion`, and bounded candidates. It is keyed by the canonical rule/checkpoint/candidate content, retained for seven days, and physically capped at 200 rows. It contains no user, chat, watch, preference, or conversation field.

## Share receipts

`/share <caseId>` first reconstructs the canonical case and writes a separate public record:

```text
schemaVersion, receiptId, caseId, chainId, subject, findingType,
publicEvidenceRefs, coverage, finding, createdAt, expiresAt
```

`receiptId` is a cryptographic `randomUUID` value with separators removed (32 opaque hex characters), never a sequence or encoded private state. The share artifact supplies:

```text
https://t.me/BinratBot?start=receipt_<opaque-id>
https://t.me/share/url?url=<encoded-link>&text=<encoded-BINRAT-receipt>
```

Receipts retain only public canonical evidence for 30 days. `/start receipt_<id>` validates the opaque ID, retrieves the public store record, reconstructs the live canonical case, and compares it to the stored finding. Unknown, expired, tampered, rewound, stale, or unavailable evidence fails honestly; it never falls back to a different case. A recipient receives no sharer identity, Telegram IDs, chat, watch relationship, entitlement, wallet-auth session, or conversation context. Creator receipts offer the normal independent `/watch`; token/launch receipts deliberately state that WATCH is unavailable for that role.

There is no graphic card in this sprint. Any later card must use only subject, 2–4 evidence facts, coverage, BINRAT identity, short receipt ID, and the deep link.

## Deterministic local demo transcript

This is `runRatsShareDemo`, a synthetic D1/Telegram fixture only—no live RPC or Telegram call. Receipt IDs are generated randomly; the captured run used `04458b082c704dff9b0a4faf06da3b18`.

```text
USER A (77) → /rats
BINRAT → candidate: Arc 5042 CREATOR 0x…002a
  DERIVED: exact reported creator appears across 2 retained indexed launches.
  OBSERVED: latest retained receipt is at block 100.
  Coverage: PARTIAL
  WHY /watch /share commands supplied.

USER A → /why <rats-case>
BINRAT → the same two canonical facts, DERIVED recurrence, observed block,
          source/digest/block-hash receipts, PARTIAL coverage, UNKNOWN identity.

USER A → /watch 5042:CREATOR:0x…002a
BINRAT → watch armed after block 102; future launches only.

FIXTURE → new canonical launch at block 105
BINRAT → FOUND SOMETHING for User A, exactly one alert, with /share <alert-case>.

USER A → /share <alert-case>
BINRAT → https://t.me/BinratBot?start=receipt_04458b082c704dff9b0a4faf06da3b18

USER B (88) → /start receipt_04458b082c704dff9b0a4faf06da3b18
BINRAT → same public alert fact and coverage; no sharer/watch/chat context; WATCH command supplied.

USER B → /why <alert-case>
BINRAT → same public evidence.

USER B → /watch 5042:CREATOR:0x…002a
BINRAT → an independent future-only watch after block 107.
```

The fixture asserts separate A/B watch rows, one alert only, no pre-watch event relabeling, and no private fields in the public receipt.

## Verification and review

Focused tests cover deterministic ordering, same-state snapshot reuse, chain collision exclusion, evidence/reason reconstruction, coverage, stale/unready/malformed fail-closed behavior, creator-only watch routing, output/snapshot bounds, all three share origins (DIG/RATS/ALERT), deep-link encoding, receipt opening/replay/expiry/tampering, and privacy isolation.

One hostile review was completed against smart-money language, score fields, private receipt leakage, user/watch isolation, chain collisions, stale discovery, ranking manipulation, link injection, opaque-ID enumeration, storage bounds, per-user RPC work, duplicate watches/alerts, unsolicited discovery, and observed-vs-derived labels. Critical/high fixes: none outstanding after implementation. Targeted rereview confirmed (1) only CSPRNG opaque IDs reach deep links, (2) the public row has no private columns or owner joins, (3) receipt recovery revalidates canonical evidence, and (4) discovery remains source-health-gated and creator-only.

No deployment, production D1 migration, merge, token-launch operation, or holder activation was performed.
