# BINRAT Pons Launch Authority Reconciliation V1

Date: 2026-10-03  
Status: CANONICAL PRELAUNCH AUTHORITY CANDIDATE / NO LAUNCH AUTHORITY  
Branch: `integration/binrat-pons-launch-canonical-v1`  
Base authority candidate: `docs/binrat-staking-authority-rebind-v1@4f3e4622c0d089c0fa40cb06ca0fe01abbdc706c`

## Purpose

Reconcile already-selected BINRAT Launch V1 policy into the latest Pons/Staking authority line without reviving historical Arc authority or granting launch/marketing authority.

This receipt does not authorize merge, deploy, signing, broadcast, token launch, staking launch, marketing activation, or irreversible parameter freeze.

## Selected Launch V1 policy

- Chain: Robinhood Chain 4663.
- Launch rail: Pons V2 + public PonsVault Staking dependency.
- Pair / quote asset: native ETH.
- Pons native buyback: OFF for Launch V1.
- Creator tax: 0%.
- Opening/dev buy: 0 ETH.
- Private presale: none.
- Discounted insider round: none.
- Hidden team allocation: none.
- One stake-backed product tier: WORKING RAT.
- Stake & Burn remains rejected historical evidence.
- No custom vault, staking emissions, DAO, bonds, or FERAL RAT as Launch V1 requirements.
- Any later founder/project token purchase must use the ordinary public market and be disclosed.

## Third-party staking risk

The selected PonsVault Staking dependency remains third-party and upgradeable. Its observed authority chain reaches an external EOA-controlled factory path.

The owner-selected dependency risk is accepted for continued Launch V1 planning. This does not satisfy fresh preflight, source/provenance, exact-manifest, legal, execution, or explicit launch-authorization gates.

Risk disclosure remains required.

## Genuinely unresolved owner inputs

These remain null and must not be guessed:

- final launchConfigId;
- final expected-economics object;
- minimum fees before payout;
- WORKING RAT minimum active stake;
- current Pons treasury wallet;
- launch/signing wallet;
- final token metadata.

Reward asset copy must remain no more specific than verified while ETH-vs-WETH claim-transfer behavior remains unresolved.

## Arc authority boundary

Arc / chain 5042 launch configuration remains immutable historical evidence only.

Current Pons-facing state uses `currentPonsLaunchConfiguration`.

Old Arc wallet roles are retained only under `historicalArcLaunchConfiguration` and must not be used as current Pons treasury, launch-wallet, creator-fee-recipient, token, marketing, or holder-gate authority.

Until current Pons wallet roles are explicitly selected, public current-role presentation must be `NOT_CONFIGURED`, not an Arc fallback.

## Authorization boundary

The following remain false / blocked:

- `marketingAuthorized = false`
- `launchAuthorized = false`
- `explicitOwnerLaunchAuthorityState = NOT_GRANTED`
- token state = `NOT_LAUNCHED`

Policy reconciliation is not launch authorization.

## Next bounded engineering slices

1. Fresh Pons read-only preflight:
   `4663 -> factory -> launcher -> registry -> staking factory -> beacon -> implementation -> owners/admins -> canLaunch -> exact atomic simulation`.
2. Pons-specific exact-input dry rehearsal.
3. Fail-closed L2 `stakedOf(address)` reader.
4. Pons/4663-correct Telegram-wallet binding.
5. Resolve remaining owner inputs.
6. Freeze one exact machine-readable manifest.
7. Full dry rehearsal.
8. Stop before live launch and request separate explicit owner authorization.
