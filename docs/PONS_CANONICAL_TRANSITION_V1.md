# BINRAT Pons canonical selection — migration contract V1

Status: **owner-selected product/launch direction; documentation-only proposal**.
This document is not a deployment instruction or authorization to market, sign, or launch.
Until the runtime and manifest cutover has been independently verified, the existing ArcPad V0 configuration remains the live code's historical reference, **not an authorization to launch on Arc**.

## Decision and non-goals

- Intended $BINRAT token: **Pons V2 on Robinhood Chain (4663), native ETH pair**.
- Existing BINRAT intelligence: **Arc (5042)**. Preserve current indexer, D1 evidence, receipts, Radar, Watch and Replay. Token placement does not magically provide Robinhood-launch intelligence.
- Preserve `docs/BINRAT_LAUNCH_CONFIG_V0.json`, its digest, on-chain ArcPad mechanics receipt and tests as immutable *historical* artifacts. Create distinct V1 Pons policy/authority and an atomic migration of the canonical manifest, gate matrix, Telegram, website, ledger and holder resolver later.
- No new token on Arc, bridge, staking contract, buy/sell execution, wallet approval, trade recommendation, or private-key handling.
- No merge, token-launch, token-marketing, deployment or production entitlement authority from this document.

The owner-selected *candidate* is recorded in `docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json`. Its null fields are intentional blockers, not placeholders to autofill from another chain.

## Proposed frozen *candidate* economics (refresh at launch)

Current reviewed read-only Pons receipt PR #20 pins chain 4663 and Pons V2 factory `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`, launch config 0, native ETH pair, 0 bps additional creator tax, buybacks disabled, direct factory launch, no extra opening-tax exemptions and no founder opening buy. It also captures the existing standard Pons fee policy and simulates the full launch using `eth_call` only.

The historical 2026-09-22 receipt observed a **3-second** opening-tax decay at one block. This is neither an anti-bot effectiveness claim nor a promise of future terms. Rerun the checker at the actual launch authorization decision; changed factory/fees/hook/deployer/access/snipe policy or simulation failures block progression.

Funding intent is **disclosed creator/project share of the applicable trading fees**, not initial bonding-curve proceeds, and is not guaranteed. Pons launch configurations and risk findings require a current verification receipt and independent review. The final recipient, deployer, treasury, salt, website, social ownership and token metadata remain unresolved.

## Product contract — one brand, two audiences

- **The Rat**: first-party mascot/meme identity, Pons discovery listing, verified website/X/Telegram, transparent launch terms, public treasury, a genuinely useful community.
- **The Machine**: existing free Arc launch evidence, Creator Files, Rat Radar, Replay and Telegram. Professionals can inspect receipts without holding the token. A researcher/API access option need not require exposure to a volatile token.
- **The Token**: if later activated, verified Robinhood wallet control plus independently checked token balance may unlock more Radar depth, Watch slots, filters, speed and API capacity. A holder cannot change, hide or adjudicate factual evidence. Off-chain Rat Credits and reputation remain separate.
- **The Network**: Trash DNA, Dead Drops, contribution bounties and bounded research priority/optional collateral are *planned or experimental*, not launch-day rights.

Show shipped/building/planned capabilities separately. Never claim buying early will produce returns or that fees are shared with holders.

## Implementation gates — one bounded successor changeset, not scattered PRs

1. **Authority migration:** add a versioned Pons launch configuration and evaluator, fresh on-chain receipt, chain 4663 holder/ledger binding and chain-specific role proofs. Retain the frozen Arc V0 evidence; only then atomically update canonical manifest/gate matrix and public status surfaces. An EVM address seen on Arc is not proof of custody or funded status on Robinhood.
2. **Utility:** reuse existing EIP-4361/session machinery with chain 4663, domain, purpose, nonce, expiry and reviewed contract-wallet handling. Verify actual canonical token address and independent balance source; test thresholds and fail-closed states with fixtures; do not activate production until post-launch proof.
3. **Discovery:** after approved art direction and social/domain ownership, ensure Pons metadata → website → Telegram → live product demonstration has one consistent identity; publish one canonical contract address only after actual execution. Show Pons and Arc coverage distinctly.
4. **Funding and safety:** bind actual post-launch Pons fee recipient/treasury to a separately reviewed public accounting observer; measure low-volume runway. Complete applicable legal/compliance, contract review and disclosures before marketing and launch authorization. Current token and marketing authority remain blocked.

## Exact acceptance checks

- No live component confuses **token chain 4663** with **research chain 5042**.
- Frozen Arc V0 bytes/digests stay unchanged; historical tests continue to pass while new Pons config/tests are added.
- No Pons candidate receipt is presented as a verified launch execution receipt. No copied Arc wallet address is treated as Robinhood custody proof.
- No wallet transaction, approval or signing/broadcast authority is added by the planning or read-only receipt.
- The public site, Telegram, capability manifest, funding ledger and actual on-chain contract agree **before** any token-live claim.
- Only an independently reviewed, authorized cutover changes runtime token authority; owner retains separate explicit merge and launch decisions.

## Smallest validation experiment

Show unfamiliar traders and developers the truthful Pons-style listing → website → Telegram → *real Arc evidence* user journey. Record authenticity verification, capability comprehension, one completed real research task and intent to return. Treat this as a usability/product validation, **not** proof of future token price or investment demand.
