# BINRAT docs — authority router

Date: 2026-10-06

This directory contains planning, factual state, receipts, historical experiments and implementation notes. They are not equal authorities.

## Start here

For current launch-night planning:

1. `BINRAT_LAUNCH_NIGHT_CANON_V1.md` — one product / launch-night convergence doctrine.
2. `ROADMAP.md` — customer-facing capability story.
3. `PRODUCT_LANGUAGE.md` — voice, names, crew statuses and public-copy rules.
4. `BINRAT_FRONTDOOR_JOURNEY_V1.md` — web + Telegram journey and presentation acceptance.
5. `product/BINRAT_TOKEN_LAUNCH_AND_GENESIS_FUNNEL_V1.md` — token/product convergence and launch critical path.

## State authority

Planning docs do **not** decide whether something is actually deployed, launchable or authorized.

Use:

- `CAPABILITY_MANIFEST_V0.json` — capability/deployment/public authorization state;
- `LAUNCH_GATE_MATRIX_PONS_V1.json` — launch blockers;
- `BINRAT_PONS_LAUNCH_PLAN_V1.json` — current Pons launch-policy/input state;
- exact preflight/rehearsal/verification receipts — current contract/evidence truth.

If planning says **LIVE** but state authority does not support it, state authority wins and planning must be corrected.

## Product doctrine

- `PHILOSOPHY.md` — permanent evidence/product principles.
- `TOKEN_LAUNCH_DOCTRINE.md` — fair-launch and token boundary.
- Brand V1 authority — Rat identity, Geist typography, raster rules, copy system.

## Current public product story

`RAT ZERO · LIVE`  
`TRIPWIRE · BUILDING`  
`SNIFFER · PROVING`

User loop:

`FIND → EMPLOY → LEAVE → RETURN`

Public roadmap:

`SNIFF → REMEMBER → WATCH → HUNT → ORGANIZE → AUTONOMOUS RAT`

Token boundary:

> **STAKE BUYS LABOR. NOT TRUTH.**

## Superseded planning

The following may remain addressable for receipts/tests, but must not be used to invent current product direction when they conflict with the launch-night canon:

- older `ROADMAP_V0.md` product-work-order prose;
- old Arc/Astra frontend plans;
- pre-reset Pons candidate plans;
- older visual roadmap chapter naming that uses `INVESTIGATE` / `CONNECT` as canonical chapters;
- standalone experiment PR descriptions as product truth;
- autonomous/Comms/Sniffer experiments as proof of public availability.

Do not rewrite immutable historical receipts to make them look current.

## Branch doctrine

Launch-night integration target:

`integration/binrat-launch-night-v1`

Everything else should be classified as one of:

- **COMPOSE** — needed in launch-night product;
- **EXTRACT FACTS** — experiment receipts inform truth, machinery not shipped;
- **POST-LAUNCH** — useful but not launch-critical;
- **ARCHIVE/CLOSE** — superseded or completed.

Do not use “latest PR number” as an authority rule.

## Conflict order

When two docs conflict, resolve in this order:

1. live on-chain / runtime evidence at the required freshness;
2. launch receipts / gate matrix / capability manifest;
3. launch-night canon;
4. public roadmap + product language + frontdoor contract;
5. implementation plans;
6. experiment docs / PR descriptions;
7. archived historical planning.

Never promote a lower authority because its wording is newer or more exciting.
