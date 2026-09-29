# BINRAT post-launch acceptance V1

The following is a prepared fixture/read-only acceptance sequence; step 8 is explicitly forbidden during this sprint.

1. Independently verify the launch transaction and canonical contract address.
2. Use a Robinhood 4663 personal-buyer wallet with separately approved ETH for its chosen buy and gas.
3. Confirm the trading surface resolves the verifier-derived BINRAT contract.
4. Owner independently chooses amount and explicitly authorizes that spend.
5. Make one ordinary public purchase; no launch-and-buy/founder exemption path may exist.
6. Confirm tokens arrive in that wallet.
7. Prove wallet control to BINRAT using the future chain-bound wallet proof.
8. Read finalized canonical BINRAT balance; policy resolves `HOLDER` only when its published threshold is met.
9. Confirm capacity rises while DIG/WHY facts remain identical to FREE.
10. Later falling below eligibility removes the capacity boost under frozen policy.

The independent verifier must establish transaction success; canonical block/hash; token and curve/pool; factory relation; supply/decimals; deployer; fee recipient; configuration/economics; launch block; on-chain metadata where present; initial curve/graduation state; founder/deployer and treasury/fee-recipient balances; and `launchAndBuy=NONE` unless a different exact authority exists.

Publication consistency rule: before launch every official surface says `NOT_LAUNCHED` or contains no CA. Afterwards every official surface contains exactly the verifier-derived canonical CA. A submitted address is never authoritative.
