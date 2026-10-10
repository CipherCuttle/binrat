# Robinhood live intelligence V1

## Source contract

`PONS_SOURCE_RAIL = Pons V2 direct factory`.

- Live intelligence chain: Robinhood Chain `4663`.
- Factory: `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e`.
- Canonical launch event: `TokenLaunched(address indexed token,address indexed curve,address indexed deployer,address pairToken,uint256 launchConfigId,uint256 graduationThreshold)`.
- Conservative source start: block `27027321`, the earliest retained canonical event verified during rail selection.
- A current read at block `75805941` found the expected factory code hash, config `0` enabled, and permissionless `canLaunch` probes accepted. The intended BINRAT deployer remains unset; no deployer-specific authority is inferred.

`deployer` is exactly the indexed event role. It is not a human identity, beneficial owner, skill signal, buyer, or profitability claim. `curve` is the factory-emitted pre-graduation curve address. `graduationThreshold` and `pairToken` are event facts; their economic meaning is not upgraded beyond the protocol event.

The first V1 index stores LAUNCH, TOKEN, DEPLOYER, and CURVE identities plus the canonical transaction/block/log provenance. It does not perform wallet analytics. Any future activity record must retain the exact protocol role and must not label a recipient as a buyer or a wallet as a person.

## Evidence vocabulary

- **OBSERVED**: canonical Pons event or source-backed metadata.
- **DERIVED**: deterministic relation between retained observed facts, such as the same reported deployer appearing in multiple launches.
- **PATTERN**: bounded rule output, never profitability, safety, or skill.
- **UNKNOWN**: identity, intent, outcome, safety, and financial performance.

## Availability

Robinhood chain health controls live Robinhood DIG, RATS, new watches, alerts, and receipts. Arc `5042` remains `HISTORICAL / LEGACY EVIDENCE`; its failure cannot make Robinhood live evidence unavailable. No Arc row is rewritten, relabelled, or cross-chain joined.
