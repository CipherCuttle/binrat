# BINRAT Pons cutover candidate V1

Status: **draft engineering candidate only**. This changeset is a *metadata/status cutover*, not a token-launch transaction, operational authority, final Pons economics proof, production entitlement activation, public marketing approval or deployment.

## Why a successor field instead of overwriting V0?

The original ArcPad launch configuration, mechanics verification, gate matrix and ledger are digest-bound historical records. Overwriting them would make earlier evidence and tests false. The current desired token-launch rail is Pons V2 on Robinhood 4663; the research indexer and existing Radar evidence continue on Arc 5042.

The canonical capability manifest now has an additive `tokenLaunchSuccessor` section, linked to `docs/BINRAT_PONS_LAUNCH_SELECTION_V1.json`. Its versioned validator admits **only** a blocked, unlaunched, unverified candidate. It refuses future authority fields and unknown fields. The read-only cross-file evaluator checks both the historical Arc digest/declared addresses and the Pons candidate snapshot. It cannot return success if the chain, factory, intended zero-extra-tax policy, role inputs, balance policy, launch receipt or authorization contradict that frozen candidate.

## Product surface responsibilities

- `/api/capabilities`, if a reviewed successor manifest is **later** deployed, will expose the selected Pons launch direction separately from the legacy Arc history. A candidate document does not authorize public token marketing.
- Telegram `/token` distinguishes *Pons owner roles not verified* from *historical Arc V0 wallet declarations* instead of presenting the old Arc wallets as the intended Pons fee or treasury recipient. Existing deployed Telegram is **unchanged** until separately authorized deployment.
- The prelaunch Dumpster Ledger stays an **Arc V0 historical projection**. It adds a separate successor section showing a null Pons token address, null Pons treasury, null Pons fee recipient, and disabled funding/holder rights. It rejects attempts to pass a legacy Arc funding configuration as a production Pons funding source.
- No full Radar/Watch access change; no Worker authentication enablement; no holder tier; no transaction signing/broadcasting, contract deployment or live D1 migration.

## Explicit blockers

1. Run fresh read-only Pons factory/config/fee/launch simulation against current chain state; independent code/security review as applicable.
2. Obtain and verify chain-4663 deployer, creator-fee recipient and treasury ownership. Do **not** copy Arc wallet bytes without fresh proof.
3. Complete applicable legal/compliance and public disclosure requirements before any separately authorized marketing or launch.
4. After authorized execution, bind the real deployed token address, transaction, block/hash, pool, allocation verification and verified owner roles to a new **postlaunch** schema. Do not overwrite the V1 candidate with executable authority.
5. Independently review a finalized Robinhood balance source and sensible raw holder threshold, then add policy-versioned session invalidation, EIP-1271/contract-wallet handling as applicable and explicit entitlement activation.
6. Build the actual Pons funding observer, category policy and reconciliation; do not infer creator revenue from curve proceeds or hypothetical volume.
7. Update website, Telegram, manifest, new Pons ledger and chain metadata consistently only after accepted tests and separate operator authorization. The current older Arc gate matrix remains frozen as V0 evidence and is NOT a Pons launch-pass.

## Acceptance and authority

Run `pnpm check` on the exact PR head, then one bounded hostile review and fix any Critical/High issue. The suite tests cross-chain role leakage, Pons candidate tampering, false token-live claims, zero active benefits, historical status, Telegram wording, ledger separation and the public manifest read under the candidate. Preserve all prior Arc V0 tests.

Merge: **NONE**. Launch: **NONE**. Marketing: **NONE**. Production deployment: **NONE**. Production funding/holder activation: **NONE**. No wallet transactions.
