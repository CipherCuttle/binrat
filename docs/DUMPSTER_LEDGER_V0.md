# Dumpster Ledger V0

Dumpster Ledger is a public accounting projection, not an accounting authority. It keeps four layers separate:

1. a reviewed canonical funding configuration;
2. observed on-chain transaction facts;
3. deterministic conservative categorization;
4. a public projection and web presentation.

## Pre-launch state

`GET /api/dumpster-ledger` is intentionally useful before `$BINRAT` exists. The current production response says:

- `tokenState: NOT_LAUNCHED`;
- `launchAuthorization: BLOCKED`;
- `fundingAuthority.status: TREASURY_AUTHORITY_NOT_CONFIGURED`;
- `fundingAuthority.accountingEnabled: false`;
- no configured token, fee-recipient, or treasury addresses;
- zero production entries, inflows, and outflows;
- utility status derived from `CAPABILITY_MANIFEST_V0.json`.

The endpoint returns HTTP 200 for that truthful empty state. An absent authority is not an operational error and is never replaced with a fixture. Invalid configuration or configuration without a reviewed observation source returns a `FAIL_CLOSED` accounting state with accounting still disabled.

## Funding authority

`binrat.funding-config/0.1` binds the Arc chain ID, token address, fee recipients, treasury addresses, effective block, configuration version, and category-policy version. Duplicate or cross-role addresses, a wrong chain, a missing treasury, zero/malformed addresses, and test-labeled versions in production all fail closed.

Configuration alone never activates production accounting. V0 has no production observation provider, so even a structurally valid configuration resolves to `FUNDING_OBSERVATION_SOURCE_NOT_IMPLEMENTED`.

## Entries and projection

`binrat.dumpster-ledger-entry/0.1` entries preserve raw integer amounts and bind chain/block/transaction/log authority, from/to addresses, asset, direction, funding role, category, configuration/policy versions, and an evidence digest. Chain + transaction hash + log index is the immutable entry identity. Identical replay is idempotent; conflicting replay fails closed.

Known role/category combinations are enforced. When business intent is not deterministically known, the category stays `UNCATEGORIZED`. The projection recomputes entry integrity and totals rather than trusting presentation values. No address is inferred to be privileged merely from activity.

Transfers between two declared project funding addresses are rejected from the V0 inflow/outflow book. They are internal routing, not new money in or project money out, and booking them as either would inflate totals. A later schema may add a non-accounting internal-transfer view once canonical routes exist.

Arc explorer link conventions are not frozen in this repository, so link fields remain `null` instead of manufacturing a misleading URL. The raw transaction and address authorities remain copyable whenever real entries eventually exist.

## Fixture boundary

Fixtures require both configuration and category-policy versions prefixed `TEST_` and an explicit `TEST_FIXTURE` projection mode. Production projection rejects any supplied entries until a reviewed real observation source exists. Fixtures do not ship in runtime configuration or D1.

## Authority boundary

This surface does not create a token, choose wallets, move funds, sign or broadcast transactions, give tax advice, or change launch/marketing authorization. `dumpster_ledger_bootstrap` remains launch-required evidence.
