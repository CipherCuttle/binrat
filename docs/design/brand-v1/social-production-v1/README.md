# BINRAT Social Production V1

**Branch:** `design/binrat-social-production-v1`  
**Base authority:** `design/binrat-brand-system-v1`  
**Status:** production-system proof only; no live binding, merge or deploy.

This layer consumes structured content and feeds the already-approved Brand V1 social renderer. It does **not** create a fourth family or redesign RECEIPT, CASE FILE, RAT FOUND SOMETHING, Rat Zero, the wordmark, or Geist typography.

## Contract

Every card must preserve:

`FERAL HEADLINE → LITERAL EXPLANATION → RECEIPT / SOURCE`

Data authority remains literal. Rat personality may stop the scroll; it may not upgrade evidence.

Canonical families:

1. `receipt`
2. `case-file`
3. `rat-found`

Schema authority: `schema.ts`  
Demo mutation corpus: `fixtures.json`  
Browser adapter/contact sheet: `production.js` + `index.html`  
Validation: `tools/brand/validate-social-production.mjs`  
Deterministic proof renderer: `tools/brand/render-social-production.py`

## Copy limits

| Slot | Limit |
| --- | ---: |
| receipt headline | 38 chars |
| case-file headline | 42 chars |
| rat-found headline | 24 chars |
| receipt literal | 170 chars |
| case-file literal | 200 chars |
| rat-found literal | 150 chars |
| source label | 28 chars |
| source value | 120 chars |
| CTA label | 24 chars |
| receipt deployer / observation | 96 chars |
| case fact label / value | 18 / 96 chars |
| rat-found evidence strip | 96 chars |

Longer input is a validation failure. The renderer does not silently truncate factual content.

## Wrapping / truncation

- Headlines wrap; no ellipsis or line clamp.
- Literal copy wraps; no ellipsis or line clamp.
- Addresses and hashes render in Geist Mono, retain the **complete** value, and use `overflow-wrap:anywhere`. Primary evidence is never middle-truncated in the proof.
- Long source values wrap and remain visible with their evidence state.
- CTAs never wrap. One card gets exactly one CTA.
- A long-copy density class may reduce headline size within the frozen hierarchy; it may not shrink evidence below the minimum evidence type size.

## Safe area

- Wide 1200×675: copy/evidence inset is at least **58px horizontal / 48px vertical**.
- Square 1080×1080: at least **58px horizontal / 54px vertical**.
- Rat artwork may bleed outside this inset. Literal explanation, evidence and CTA may not.
- Decorative frame lines do not count as safe area.

## CTA rules

Allowed action/label pairs only:

- `OPEN_RECEIPTS` → `OPEN RECEIPTS →`
- `OPEN_CASE` → `OPEN CASE →`
- `DIG_DEEPER` → `DIG DEEPER →`

No urgency, price language, buy/sell/ape instruction, or second action.

## Evidence-boundary rules

- `coverage` is mandatory and one of COMPLETE / PARTIAL / UNKNOWN / MISSING.
- `source.state` is independently mandatory. Coverage and source state may differ.
- RECEIPT always exposes coverage and source state.
- CASE FILE requires exactly `PATTERN · NOT A VERDICT` plus 3–5 structured facts.
- RAT FOUND SOMETHING must expose coverage in its evidence strip and source state in the footer.
- PARTIAL / UNKNOWN / MISSING are written as text. Color is never the only carrier.
- Missing evidence may not be converted into a positive inference.
- Recurrence may not be described as profitability, skill, safety, human identity, or guilt.

## Hard language rejects

The validator rejects production copy containing hype/advice or unsupported labels including:

`smart money`, `alpha`, `good buy`, `bad buy`, `buy now`, `sell now`, `ape`, `safe score`, `rug score`, `scammer`, `rugger`, `guaranteed`, `profitability`.

## Mutation proof

The demo corpus intentionally includes:

- very short deployer text;
- long address/hash-like values;
- 1 launch and 12 launches;
- COMPLETE / PARTIAL / UNKNOWN / MISSING;
- short headlines and max-density headlines;
- deliberately long source text;
- 3-fact and 5-fact case files.

All values are `DEMO / NON-LIVE`. No fixture is a production observation.

## Kill gate

The renderer fails if browser proof detects overflow/crop, hidden state text, unreadable long evidence, Rat/literal collision, missing source/coverage visibility, or card-size drift. Semantic validation separately fails hype/advice and schema violations.

No merge. No deploy. No live metrics.
