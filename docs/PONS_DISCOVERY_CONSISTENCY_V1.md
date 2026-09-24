# BINRAT — Pons discovery consistency candidate V1

Date: 2026-09-24. **Draft only. No public launch or deployment authorization.**

## Identity and truth boundaries

- **Research:** historical and ongoing ArcPad-reported launch evidence on Arc 5042, subject to independent freshness/coverage gates. Public factual receipts remain free and are not controlled by token balance.
- **Selected token direction:** separate $BINRAT candidate through Pons V2 direct factory on Robinhood Chain 4663 with native ETH pairing. This is an owner-selected planning candidate, **not a launched token, a live listing, or an invitation to trade**.
- **Historical roles:** the two wallet declarations in frozen `docs/BINRAT_LAUNCH_CONFIG_V0.json` are **ArcPad V0 records**. Their mere availability does not establish control of any new Robinhood deployer, treasury or fee-recipient role.
- **New token authority:** Pons contract address, actual deployment receipt, owner/custody proofs, treasury, project fee recipient, verified site, Telegram, X and token-specific art are all **unverified / null**. Do not substitute a Pons factory address for the token's uncreated address.
- **Listing draft:** `docs/PONS_DISCOVERY_CANDIDATE_V1.json` is an internal planning schema and **MUST NOT** be submitted as Pons launch metadata or to token directories. It contains no executable or implied wallet authority. This is the only canonical Pons listing-editorial draft; do not create a second metadata file or submit this JSON to Pons directly.

## Staged surfaces

| Surface | Intended prelaunch message | Mechanism | Live authorization |
|---|---|---|---|
| Preview website `web/index.html` | Arc 5042 research vs separately planned Pons/4663 token; no official contract; old Arc roles labeled historical | Static copy; `noindex,nofollow,noarchive`; no unverified social links or buy CTA | None — preview only |
| `/api/capabilities` | `tokenLaunchSuccessor=SELECTED_CANDIDATE_BLOCKED`, no token/roles | Strict additive successor manifest from PR #30 | Existing deployed manifest unchanged until separately authorized |
| Telegram `/token` | Candidate Pons token vs Arc research; Pons owner wallets NOT_VERIFIED; old wallet declarations historical | Same validated capability manifest | Existing deployed bot unchanged until separately authorized |
| Public Dumpster Ledger | Legacy Arc accounting scope, with separate null Pons owner roles and disabled new accounting | PR #30 successor projection | No Pons observer or live accounting |
| Pons metadata | Proposed name/symbol, verified **repository** URL only, all external profiles/logo/token unknown | Non-submittable `PONS_DISCOVERY_METADATA_V1.json` | Do not publish or submit |

The website and Telegram are **not** proof of deployed state. The production frontend redesign proceeds independently in draft PR #31; this branch edits only the legacy preview surfaces and must not accidentally substitute for or overwrite the approved North Star visual implementation.

## Read-only mechanics and role verification gate

The earlier Pons read-only readiness checker supports explicit block-bound reads of factory bytecode, hook/deployer bytecode and binding, chain ID, launch config 0, fees, snipe policy, launch permissions, economics preview, balance/fee availability and `eth_call` of the direct launch path. A historical snapshot observed a 3-second snipe-tax decay at Robinhood block 69,767,635 on 2026-09-22; **that observation is stale for a future launch**. Neither the snapshot nor an earlier dry-run implies current fee/code settings.

A **fresh** read-only receipt must be generated with verified owner-supplied chain-4663 deployer, dedicated creator-fee recipient and a nonzero owner-selected salt using `pnpm pons:launch-receipt -- --deployer ... --fee-recipient ... --salt ...`. All 18 checks must pass at one explicit current block. A successful `eth_call` is not a deployed token. No signing or live-money execution is introduced by this PR.

Role proof requires owner confirmation of the **new** chain-4663 deployer, creator-fee recipient and treasury; independently verify control through a bounded, expiring, exact-purpose signature or equivalent reviewed contract-wallet proof, and check consistency with the frozen post-approval launch manifest. Do not copy historical Arc role addresses merely because they share EVM address syntax; never ask for private keys. The final website, Telegram and metadata must repeat the **same actual executed token contract address** and verified official profiles only after separately authorized execution and independent receipt review.

A full security/compliance review, fresh external Pons fee/bytecode check, actual token execution receipt, holder policy and threshold, funding-observer provenance, final official domains/handles, and explicit owner marketing/merge/deploy/launch approvals are outside this slice. No purported promise of profits, safety, return, guaranteed liquidity or token-holder access is made.

## Verification

`scripts/check-launch-presentation.mjs` compares the checked-in selection, successor manifest, site, original locked-down preview copy and proposed listing metadata. `test/ponsDiscovery.test.ts` checks cross-surface chain, address/role, Telegram, repository and non-publication boundaries. CI must pass `pnpm check` at the **exact** final PR head before closure. Any changes to the original ArcPad historical launch-gate files or live worker endpoint are outside this PR.

**Authority:** Merge NONE. Deploy NONE. Token launch NONE. Wallet action NONE. Production D1 migration NONE. Public marketing NONE. Holder activation NONE.
