# BINRAT LAUNCH PRESENTATION V0

## Objective

Prepare BINRAT's public-facing prelaunch language without launching a token, publishing a contract, opening a presale, or enabling wallet/trading flows.

This document governs presentation only. It does not create token-launch authority.

## Current canonical status

- product: **BINRAT**
- ticker: **$BINRAT**
- token: **NOT LIVE**
- contract: **NOT PUBLISHED**
- presale: **NONE**
- wallet connection: **NONE**
- selected **token** direction: **Pons V2 direct factory / Robinhood Chain 4663** — planning candidate only
- independent **research** product: **Arc 5042** / ArcPad-reported launch evidence
- Pons deployer: **NOT_VERIFIED**
- Pons treasury role: **NOT_VERIFIED**
- Pons creator-fee recipient: **NOT_VERIFIED**
- source repository: `https://github.com/CipherCuttle/binrat`
- official website ownership, Telegram handle, X handle and token logo: **NOT_VERIFIED**
- Pons listing metadata: **INTERNAL PRELAUNCH DRAFT, NOT SUBMITTABLE** — `docs/PONS_DISCOVERY_METADATA_V1.json`
- production Pons accounting: **DISABLED**
- Holder Gate: **TOKEN_AUTHORITY_NOT_CONFIGURED**
- Arc research index: availability is determined by its independent live evidence-readiness checks
- consumer shell: explicit `?fixtures=1` previews are not live evidence

The two historical ArcPad V0 address declarations below belong **only to the superseded Arc launch candidate**. They are not Robinhood/Pons custody proof or current token owner roles:

- historical Arc V0 treasury declaration: `0xab063A9b53a2Ab832a941aE5890ea05c1672339D`
- historical Arc V0 project-fee declaration: `0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866`

Neither address may be imported into a Pons launch without an independent wallet-control proof and explicit owner approval. Until the canonical BINRAT site and `CipherCuttle/binrat` repository publish the same contract address together, no circulating contract should be treated as an official BINRAT contract.

## Primary positioning

**He gets the scraps. You get the receipts.**

BINRAT is a dumpster rat for Arc. New launches hit the bin; he follows the ArcPad-reported creator address, remembers older bags that are actually present in the evidence, and keeps the receipts.

The joke is the rat. The evidence boundary is not a joke.

## X / social bio draft

> 🐀 Arc launch receipts and creator history // separate $BINRAT token planned via Pons V2 / Robinhood 4663 // NOT LIVE

The exact X handle `@binrat` is **not available for BINRAT branding** as of the 2026-09-17 check; it resolves to an existing account. Do not claim, link, or imply ownership of `@binrat`. A distinct official handle must be selected and verified before public launch materials link to X.

## Prelaunch pinned-post draft

> 🐀 BINRAT
>
> Arc launches go in the dumpster. the rat follows ArcPad-reported creator addresses, remembers old bags, and keeps the receipts.
> a separate $BINRAT token is planned via Pons V2 on Robinhood Chain 4663. that is a candidate direction, not a launch.
>
> no risk score. no buy call. no paid placement.
>
> $BINRAT IS NOT LIVE.
> NO CONTRACT PUBLISHED.
> NO PRESALE.
>
> he gets the scraps. you get the receipts.

## Launch-announcement template

**DO NOT PUBLISH UNTIL EXPLICIT TOKEN-LAUNCH AUTHORITY EXISTS.**

Replace every placeholder only after the launch gate passes and the same address is published to the canonical site and repository in the same release:

> 🐀 $BINRAT is live on Robinhood Chain 4663 via Pons V2.
>
> token contract: `[VERIFIED_ROBINHOOD_CONTRACT_ADDRESS]`
> launch transaction: `[VERIFIED_LAUNCH_TX]`
> official site: `[VERIFIED_CANONICAL_SITE]`
> official Telegram: `[VERIFIED_TELEGRAM]`
> official X (if approved): `[VERIFIED_X]`
>
> if the address does not match both places, it is not the official BINRAT contract.
>
> the dumpster stays free. the receipts stay public.

## Launch gate for presentation

The launch-announcement template remains blocked until all of the following are explicit and current:

1. 72-hour HOT GARBAGE evidence gate has matured and been evaluated;
2. exact-name/ticker collision sweep has been repeated immediately before launch;
3. official social handles and canonical site have been verified immediately before launch;
4. current Pons V2 chain-4663 factory, launch fee, fee policy, code hashes and actual launch calldata are freshly checked against a block-bound read-only receipt;
5. Pons deployer, creator-fee recipient and treasury are separately verified; no Arc owner role is silently inherited;
6. the final Pons contract/source, on-chain execution receipt, token address and any liquidity claims have been independently verified;
7. explicit owner token-launch authority and all required legal/security gates exist;
8. canonical website, repository, Telegram and any verified official social account publish the identical executed token address in one separately authorized release;
9. no claim is made about returns, price appreciation, safety, staking yield, guaranteed liquidity, or investment performance.

## Collision note

A preliminary search on 2026-09-17 did not surface an obvious active exact-name BINRAT crypto project on general search or major token-index search results. This is not authoritative proof of global uniqueness and must be repeated immediately before launch.

The exact X handle `@binrat` is already occupied. Product/ticker identity and social-handle availability are separate checks.

## Prohibited presentation

Do not publish:

- BUY NOW / SELL NOW calls;
- guaranteed returns or price targets;
- `100x` / moon promises;
- presale language while presale status is NONE;
- a contract address before explicit launch authority;
- links to an unverified social account;
- fake holder utility;
- fake live-feed screenshots;
- wallet-connect prompts before wallet functionality is deliberately authorized;
- language implying BINRAT certifies a token as safe.

## Permanent boundary

BINRAT's evidence layer remains useful without owning `$BINRAT`.

Token branding and distribution must never change the factual evidence shown for a launch.


## Discovery-to-listing handoff (planning only)

`docs/PONS_DISCOVERY_METADATA_V1.json` is deliberately non-submittable. Name and ticker are proposals; token contract, execution receipt, logo, Pons treasury and project-fee wallet, verified site, Telegram and X are null until separately proven. Repository ownership proves only source location, not ownership of other domains or handles. The listing must never reuse this draft's empty socials or infer an official contract from a symbol match. No wallet link, `BUY` button or token-address copy affordance is authorized prelaunch.

The same basic facts must agree across the staged preview website, `GET /api/capabilities` when separately deployed, Telegram `/token` when separately deployed, and the *future* Pons metadata submission. None of these preview assets changes the frozen historical ArcPad launch-config digest, the Arc 5042 evidence runtime, or PR #30's block on Robinhood funding and holder entitlements.
