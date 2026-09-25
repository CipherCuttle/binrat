# BINRAT — Pons-native bounded review preview

Date: 2026-09-25. Draft PR #31 visual experiment only. Arc production read plane, historical receipts, wallet operations, token-launch authority and D1 remain unchanged.

## Pons-first source contract

Owner's selected product direction: Robinhood Chain 4663 / Pons V2, both for the intended BINRAT token launch and primary launch-intelligence product. Arc 5042 remains separate legacy research, never silently substituted for missing Pons data. Pons GitHack mode must show a confirmed SOURCE SNAPSHOT, not claim continuously live Pons indexing.

- Reuse SENTRY M2A factory authority ID ROBINHOOD_PONS_V2_FACTORY_2026_08_03_R1: reviewed factory 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e, epoch 26,841,846, exact code hash; no floating factory discovery.
- The opt-in GitHack publisher checks chain 4663, current factory bytecode at one 12-confirmation anchor, acquires newest-first factory TokenLaunched event logs in 64-block bounded ranges, retains up to 500 launches from at most 8192 recent blocks with a 128-range maximum and checks the anchor hash again.
- Recover matching launch name, symbol, logo, description and socials from at most 72 exact direct-factory launch transaction inputs. Router metadata and failed reads remain explicitly unavailable. User-supplied logos are not authenticity or security proof.
- Publish one typed static JSON file with confirmed anchor number/hash, capture time, reviewed factory, exact token/curve/deployer/pair addresses, source transaction, recent-window coverage and distinct immutable launch IDs. Never silently fabricate a 500th launch. Reject invalid chain, epoch, code hash, truncation or reorg.
- If source snapshot generation fails, fail GitHack publishing and preserve the previous preview. A static source capture can become stale and is labelled accordingly; it is not an always-on backend.

## The ritual: selected Pons launch → bounded Rat Scan

Show the same approved bento visual identity, exact Pons captured launch portraits, searchable list, Pons-specific case routing and Blockscout links. Trigger a deterministic on-demand scan against the saved source snapshot. Display exact previous launches from the same on-chain deployer only within the scanned recent window, with real transaction receipt links and clear incomplete-history bounds. No evidence of older links cannot mean a clean wallet.

The miniature FUNDING GRAPH is hidden until a separately verified Robinhood transaction-provenance collector produces concrete supported funding edges. Exact creator recurrence is not funding provenance; shared exchanges or bridging infrastructure are not evidence of common beneficial ownership. No shame labels, wallet attribution, profit scores, recommendations or trading action.

## Acceptance and authority

Root tests cover corrupt factory authority, duplicate event identity, ordering, bounded history, unknown metadata and unsafe social URLs. Frontend Playwright fixtures at 390/1440 test actual route navigation, independent Arc isolation, source-snapshot errors, early-recurrence scan, missing funding graph and responsive layout. Fixtures are SYNTHETIC; the publisher separately requires actual confirmed on-chain factory logs. Pons source selection is opt-in on the same isolated GitHack preview branch. PR stays draft; no main merge, production deployment or token/wallet action.

## Separate future implementation

Durable, chain-isolated Pons D1 tables and checkpoint/reorg recovery; WS-primary source discovery reconciled via HTTP and explicit D1 write budgets; cached public read-only Pons feed and case API; bounded two-hop funding tracer adapted from Serrata's ANITA investigation; optional 5–9-node transaction-backed graph; source-qualified early-curve trade-flow receipts from SENTRY. This is not falsely represented by the snapshot pilot. Activation and spending need separate authorization.
