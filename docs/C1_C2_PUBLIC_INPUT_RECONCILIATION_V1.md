# C1 / C2 public input reconciliation

## Ownership

The C1 candidate starts at PR #122 (`fa23aa77b8c0cf15ca5f3e0f5d5f5638f1da9cd1`).
It consumes these C2-owned files byte-for-byte from
`ccc677985ce07f438648a2499611e72c36729491`:

- `docs/CAPABILITY_MANIFEST_V0.json`: SHA-256 `981e4e6ac6eadd1a1c269b37f5e84e2b5f75b456e18c06ca8734bd75a4c7a075`.
- `docs/BINRAT_PONS_LAUNCH_PLAN_V1.json`: SHA-256 `e7b8731ac0ad17bd2e2161d7733f591ecf69897abe2ea4850997f6eb9e5be00f`.
- `docs/LAUNCH_GATE_MATRIX_PONS_V1.json`: SHA-256 `7c5bc4b01bdce13386fc4cfed008a7ce60e0326b7a5e9ae30e6a004b9ed8a985`.

No economic, wallet, launch or gate value is selected or edited by C1.

The owner-confirmed C2 selection is frozen in the approved launch-facing mapping:
`workingRatStatus = PLANNED`, `productionEntitlementActive = false`, post-launch.
PonsVault Staking may exist at token launch without public Working Rat entitlement.
Thresholds and activation are not C1 sprint dependencies. The projector requires
the canonical Pons scope and disabled production holder eligibility/wallet auth;
contradictory canonical Working Rat inputs fail closed. This is a product-direction
mapping, not an entitlement policy or a labor-admission control.

## Integration seam

`src/launchConfig/walletPresentation.ts` in the original checkout is a shared
C1/C2 seam. C1 does not copy or alter it. Current wallet roles are consumed directly
from C2's canonical `currentPonsLaunchConfiguration` by the public projector.
The original working tree and its untracked seam remain untouched.

## Evidence sources

Public product output is computed, not separately maintained. Rat Zero uses the
validated Pons publication and its matching status binding. Tripwire's BUILDING
stage derives from implemented Watch engineering, without employment admission.
Den derives from its canonical PLANNED / POST_LAUNCH capability. Locked slots are
undisclosed/unavailable slots in the approved frozen mapping.

Sniffer consumes the existing audit from GitHub artifact `11424156228`, source
`e8a722b456293e5ef092ed1f60db30f6d7f18831`. Archive SHA-256:
`77c14bf0346e4c37d5010e2d2e04b8ce9a9ff4d28a8fe19be7c785d63a76bc2b`.
Audit SHA-256: `3f242a4e230fe911c57256768d273496956b5d0114040c5346e65338e838ba5b`.
The build verifies the audit bytes and the projector recomputes the handoff digest.
The terminal result remains EXHAUSTED with no finding, Case diff or notification.
No research runner, additional RPC evidence or predictive capability is imported.
