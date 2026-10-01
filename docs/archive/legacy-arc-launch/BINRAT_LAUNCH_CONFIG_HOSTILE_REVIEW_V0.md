# BINRAT Launch Configuration V0 — Hostile Review

Date: 2026-09-21

Scope: one bounded hostile review of wallet-role binding, EVM checksum handling, owner declaration versus on-chain proof, early Dumpster Ledger or Holder Gate activation, launch-state escalation, allocation-proof substitution, stale website/Telegram claims, and incomplete execution receipts.

## Result

One High finding was identified and fixed. No Critical findings remained. The one permitted targeted rereview passed; no further review loop was performed.

## High finding fixed

### H-01 — contradictory capability state crossed the public projection boundary

An adversarial mutation of the capability manifest to `AUTHORIZED / marketingAuthorized=true / launchAuthorized=true / tokenState=LAUNCHED` was structurally accepted by the generic manifest validator. Dumpster Ledger would then combine `tokenState=LAUNCHED` with `PRE_LAUNCH_AUTHORITIES_CONFIGURED`. Accounting still remained false, but the public claim was contradictory.

Fix:

- capability-manifest ingress now rejects any authorization escalation while Launch Configuration V0 is frozen;
- configured role addresses/digest and inactive Holder/accounting states are checked when the launch configuration is present;
- Dumpster Ledger independently rejects contradictory launch state before projection;
- regression tests cover both boundaries.

Targeted rereview result:

- manifest mutation rejected as `CAPABILITY_MANIFEST_AUTHORIZATION_ESCALATION`;
- ledger mutation rejected as `DUMPSTER_LEDGER_STATUS_CONTRADICTION`;
- targeted build and 16 launch/ledger tests passed.

## Other hostile cases

- Swapped, duplicated, zero, malformed, lowercased noncanonical, ArcPad protocol-treasury, and launcher-owner-confused role inputs fail closed.
- Production funding configuration requires the exact frozen role bindings, positive effective block, bound Launch Mechanics digest, and explicit observer activation; configuration still resolves inactive because the reviewed production observer is not implemented.
- Holder Gate remains `TOKEN_AUTHORITY_NOT_CONFIGURED`; selected treasury/project roles cannot create HOLDER eligibility.
- The execution template is `NOT_EXECUTED / INCOMPLETE` and cannot validate with a missing token address, launch transaction, block/hash, supply, pool, position, locker, allocation evidence, purchase observation receipt, or timestamp.
- Allocation PASS requires a post-launch on-chain evidence class, transaction match, owner-policy match, explicit absence of the privileged first buy, and a receipt digest. The founder/project purchase observation requires its own verification digest.
- Website and Telegram surfaces disclose the two roles as owner-selected future authorities while stating that the token is not live, accounting is off, Holder Gate is off, and launch remains blocked.
- The historical Launch Mechanics receipt and digest were preserved; its null owner-input snapshot is explicitly explained as superseded by the separately digested launch configuration rather than rewritten.

## Verdict

Hostile review: `PASS AFTER H-01 FIX`.
