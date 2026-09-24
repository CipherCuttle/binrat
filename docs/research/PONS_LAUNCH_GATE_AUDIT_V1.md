# BINRAT — Pons launch readiness audit V1

Snapshot: 2026-09-25. Independent documentation-only research, based on PR #32 head f1411ab83eddb25ed18c88584b6e26e75e86f163. This document does not supersede the canonical capability manifest or approve launch, marketing, money movement or a production deployment.

## Summary

BINRAT's research product indexes Arc (5042). The proposed $BINRAT token is a separate Pons V2 direct-factory candidate on Robinhood Chain (4663), paired with native ETH. Old ArcPad launch receipts and its frozen V0 gate matrix document another rail; their historical satisfied fields DO NOT verify the Pons rail. PRs #20 → #26 → #27 → #28 → #29 → #30 → #32 are stacked draft prerequisites; PR #31 and the current Telegram workstream are separate and must not be overwritten.

At the inspected head, the successor and discovery records are explicitly blocked and the Pons token, launch transaction, deployer, treasury, creator-fee recipient, final threshold and production observer remain null. The listing JSON is non-submittable and its website/Telegram/X claims remain unverified. Candidate holder sessions are FREE only, with production eligibility inactive.

## A. Pre-deployment gate ledger

| Gate | Current evidence | Missing proof / acceptance gate |
| --- | --- | --- |
| Canonical chain/rail selection | Pons V2/4663 selected as a BLOCKED candidate; Arc/5042 remains research-only | Versioned post-approval selection that never rewrites old Arc evidence |
| Current factory and fee state | Historical read-only Pons receipt at block 69,767,635 on 2026-09-22 | Repeat all 18 read-only checks at a fresh pinned Robinhood block; fail on code/config/access/fee drift |
| Candidate mechanics | Config 0/native ETH, 1bn-token hypothetical supply, 1% curve fee and 30% protocol share were expected by the reviewed checker; no extra creator tax; buyback disabled; no founder first buy | Independently confirm actual executable factory/hook/deployer bytecode, current economic previews, graduation economics, third-party rights and complete contract/security review |
| Snipe policy | Historical snapshot observed 9,900 bps starting tax decaying for 3 seconds, not the older 15-second initializer | Fresh verification and clear description; DO NOT market as anti-bot guarantee or a level trading field |
| Role custody | Dedicated Pons deployer / fee recipient / treasury absent from inspected canonical documents | Owner-approved separate 4663 public addresses; purpose/chain/domain/expiry-bound control evidence or reviewed contract-wallet equivalent, stored without keys |
| Fee and funding roles | Revenue objective is disclosed Pons creator/project share; production Pons observer inactive | Independently verify fee recipient binding, actual fee paths, protocol controls and separate Pons treasury/observer, no inherited Arc roles |
| Identity / listing | Name and symbol provisional; final logo and official website/TG/X not verified in candidate | Approve exact logo and verify control of each official destination; keep metadata non-submittable until authorized |
| Launch-policy fairness | Planned no presale, hidden allocation, extra opening exemptions or founder opening buy | Review final deployer balances, actual calldata, curve rules, ownership/fee-redirection powers and documented founder inventory; do not conflate intended policy with actual receipt |
| Legal / tax | Canonical status NOT_SATISFIED; no accepted legal determination in audited repository | Obtain written jurisdiction/issuer/classification/marketing/disclosure/notification analysis, fee-revenue tax treatment and approved, versioned documents |
| Explicit authority | launchAuthorized=false; marketingAuthorized=false; ownerAuthority NOT_GRANTED | Separate owner grants for deployment, transaction signing and any public marketing, only after corresponding objective gates |

The checker is READ-ONLY: pnpm pons:launch-receipt, with public deployer, recipient and a fresh nonzero salt supplied locally. It uses block-pinned calls and an eth_call simulation, NOT deployment. Do not place keys, signed custody proofs or a yet-unpublished deterministic salt in a public repository. Verify wallet ETH covers current launch fee **and gas**, and confirm all supplied parameters before any separately authorized transaction. The historical checker expected a 0.0005 ETH launch fee; do not assume that remains current.

## B. Correct two-phase authorization

The legacy Arc V0 matrix marks the actual launch transaction receipt as a launch-authorization blocker. A future on-chain receipt cannot exist before authorized execution. Do not silently copy that circular condition to the Pons successor.

Required explicit successor stages:

1. PREFLIGHT_BLOCKED: default state. Only research, independently verified owner inputs, current mechanics/custody/legal/security evidence and read-only simulation may advance this state.
2. PREFLIGHT_ELIGIBLE: verified pre-deployment gates satisfied; no transaction or public token-launch promotion implied.
3. EXECUTION_AUTHORIZED: distinct, explicit owner authorization for an exact reviewed launch transaction, including chain, calldata hash, signer, fee, recipient, nonce policy, spending cap and abort criteria. No automatic privilege from passing tests.
4. EXECUTED_UNVERIFIED: separately authorized on-chain transaction observed but token-live publication still blocked.
5. PUBLICATION_ELIGIBLE: independently verify actual token contract, transaction, canonical block/hash, minted supply, roles, pool/curve, real fee routes, founder inventory and execution receipt; only then authorize the same exact address across website, Telegram, GitHub and listing. A failed/reorged transaction must never advance this state.
6. HOLDER_AND_LEDGER_ACTIVATION: later, distinct authorization following a real 4663 balance source, effective block, finalized-chain reorg policy, published raw threshold, session invalidation, accounting observer, catch-up and real end-to-end smoke tests. Can remain off while truthful token-live information is published.

This is a proposed design correction, NOT a change to production launch gates. The signer/executor is not implemented or authorized in this research PR.

## C. Legal questions requiring counsel

Swedish FI's MiCA guidance describes requirements by asset category for Swedish/EU offers and admissions to trading. For a Title II asset under MiCA Article 4, ordinary public offers have legal-entity, white-paper, notification, publication and marketing conditions, subject to specific exceptions. Article 4(4) limits exclusions where admission to trading is announced; the applicability of any exemption to a Pons DEX launch must be assessed, not assumed. Article 8(5) describes a 20-working-day pre-publication notification where required; Article 7 governs promotional material and its publication sequence. This document is issue spotting, NOT a conclusion about whether BINRAT requires a white paper, CASP authorization or a particular entity structure.

Counsel decision record should include: actual offeror and location; MiCA classification; offer vs admission-to-trading vs genuinely non-EU activity; whether Pons DEX launch and coordinated marketing trigger Title II; applicable exceptions and whether Article 4(4) disapplies them; required white paper, explanatory classification, notification dates, mandatory statements and marketing order; consumer and sanctions/AML perimeter; project fees, VAT/tax, custody and potential token-gated service implications. Record the reviewing professional, date, signed scope and decision, not just a generic AI summary. Do not presume that calling the token a meme, fair launch, or utility removes obligations.

Primary references verified 2026-09-25:
- FI: https://www.fi.se/sv/betalningar/sok-tillstand/kryptotillgangar-och-kryptotillgangstjanster/kryptotillgangar/
- MiCA Article 4: https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-4-offers-public-crypto-assets-other
- MiCA Article 7: https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-7-marketing-communications
- MiCA Article 8: https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-8-notification-crypto-asset-white
- MiCA Articles 6/9: https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-6-content-and-form-crypto-asset and https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mica/article-9-publication-crypto-asset-white

## D. Bounded next actions

Preflight may proceed in parallel in three non-overlapping work packets: (A) collect public role-control proofs and locally rerun current read-only receipt, retaining a block/digest and no secrets; (B) commission/finish applicable counsel and independent mechanics/security review; (C) validate truthful token discovery and the holder-access value experiment, without publication, a live gate or speculative revenue claims. Do not reactivate outdated 72-hour/launch-window checks just because calendar time elapsed; capture their actual evaluated receipts.

Hard stop: any chain/bytecode/fee drift, failed ownership proof, adverse/unresolved legal classification, contradictory official identities or missing explicit authority leaves launch and marketing BLOCKED. After another PR changes canonical launch/holder docs, rerun cross-file checks against its exact head.

Sources inside repo: docs/PONS_LAUNCH_READINESS_V0.md, docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json, docs/PONS_CUTOVER_CANDIDATE_V1.md, docs/PONS_DISCOVERY_CANDIDATE_V1.json, docs/CAPABILITY_MANIFEST_V0.json and frozen docs/LAUNCH_GATE_MATRIX_V0.json.
