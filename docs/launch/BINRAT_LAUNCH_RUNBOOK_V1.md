# BINRAT launch-day runbook V1

This runbook is preparation only. Stop at any abort condition in the control record.

1. Codex runs fresh read-only `pnpm binrat:launch-status` and `pnpm pons:preflight` against two RPC providers.
2. Owner reviews the exact identity, final metadata, role addresses, economics, fee, gas cap, nonce and manifest digest.
3. Owner gives explicit authority for that single unexpired manifest digest. Without it, stop.
4. Codex prepares—not signs—the exact unsigned transaction. Check signer, chain, nonce and calldata hash again.
5. Deployer signs once, only after reviewing the wallet’s transaction display against the frozen manifest.
6. The separately authorized operator broadcasts. State becomes `EXECUTED_UNVERIFIED`; do not publish a CA.
7. Codex runs the independent read-only verifier from the transaction hash. It derives the token address itself and verifies factory relation, success, canonical block/hash, supply/decimals, curve, economics, fee recipient, balances and `launchAndBuy=NONE`.
8. Only after `PUBLICATION_ELIGIBLE`, perform separately authorized atomic fan-out from that verifier receipt: website status, binrat.tech CA, Telegram `/token`, community, X, GitHub release, Pons/listing metadata and public status API. Run consistency check.
9. Personal wallet test requires a *second*, separate owner spend approval. The personal 4663 wallet finds the exact verified token and makes one ordinary public purchase; no automatic purchase exists.
10. Prove wallet control, read finalized canonical balance, evaluate the ordinary policy, and confirm only capacity changes.
11. Smoke test public product: FREE and HOLDER `/dig` and `/why` factual output stays byte/semantically identical.
12. Record the immutable verifier/publication receipt. Holder activation remains off unless separately authorized after its own gate.

Stop immediately for a changed factory/hook/deployer/config, fee/economics mismatch, failed simulation, different signer/calldata/nonce, insufficient ETH, unresolved role/identity/legal record, provider disagreement, expiration, or any CA published before independent verification.
