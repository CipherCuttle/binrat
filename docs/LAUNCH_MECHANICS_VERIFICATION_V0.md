# Launch Mechanics Verification Receipt V0

Verified at: `2026-09-21T00:16:16Z`
Arc chain ID: `5042`
Candidate rail: `arcpad-arc-mainnet-usdc-standard-v0`
Machine receipt: `docs/LAUNCH_MECHANICS_VERIFICATION_V0.json`
Canonical SHA-256 digest: `aff37d6d82cced00a34284453c0327bb51e5624b5761b621264f55602e8245e6`

## Verdict

`LAUNCH MECHANICS V0 VERIFIED / OWNER INPUT REQUIRED`

This receipt verifies the current ArcPad USDC standard creator-rewards path well enough to describe its deployed mechanics. It did not itself select final wallets; the later `BINRAT_LAUNCH_CONFIG_V0.json` now supplies those owner declarations while preserving this receipt and digest. Neither artifact authorizes a launch, satisfies the separate legal lane, or proves that ArcPad will still expose the same contracts at a future launch time. Refresh authority immediately before any launch authorization decision.

## Evidence rules

- `ON_CHAIN_VERIFIED`: established from deployed bytecode, state, calls, receipts, logs, or transaction traces on Arc mainnet.
- `SOURCE_VERIFIED`: established from source tied convincingly to the deployed version. This classification applies here to the official Uniswap chain-5042 deployment manifest. No ArcPad contract source reached this standard.
- `PLATFORM_CLAIM`: stated by ArcPad's current site or application but not independently established as phrased.

The JSON receipt gives every substantive claim an evidence class and source references. Retrieval timestamps are recorded per source.

## Verified launch rail

ArcPad's current application routes USDC launches to the following rail:

| Authority | Address | Evidence |
| --- | --- | --- |
| launcher | `0x24196CD6e534cfCE8F480B53E70809b68Ea86F29` | `ON_CHAIN_VERIFIED` |
| token factory | `0x48EecE92e20f3431B00FD5Bc49D94aBe058E7E8f` | `ON_CHAIN_VERIFIED` |
| fee/liquidity locker | `0x69A615DD32B89fE40D87b2e3123baE4162f2d450` | `ON_CHAIN_VERIFIED` |
| Uniswap V3 factory | `0xf0db7b58379503491d857dB50AC9ece64c653918` | `SOURCE_VERIFIED` and `ON_CHAIN_VERIFIED` |
| Uniswap V3 position manager | `0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377` | `SOURCE_VERIFIED` and `ON_CHAIN_VERIFIED` |
| quote token, USDC | `0x3600000000000000000000000000000000000000` | `ON_CHAIN_VERIFIED` |
| ArcPad protocol treasury | `0xa71200705Ed02c5837961b5331EaC119Ecd37746` | `ON_CHAIN_VERIFIED` |
| current launcher owner | `0x0F7972E8012EEEF3c4fd8084A2739D802f8bFA7f` | `ON_CHAIN_VERIFIED` |

The launcher runtime is 17,227 bytes with keccak256 `0x7d7dd41fb043033027a3061e2bb2dcf65489a72f1adc83ce1fdf983c91bfce68`. It was created in transaction `0xda831a6c0e23a0cd82a93db1b19e981444ce29fb3091f4ec05329423c67a8d13` at block `19014715` and initialized in transaction `0xf8118989242ef1746652de69db2e5e40c08a9a438badb2642327c2713da12c40` at block `19014815`.

The launcher, token factory, and locker are not EIP-1967 proxies; their implementation, admin, and beacon slots are zero. No upgrade entry point was observed. The launcher is still owned: its owner can transfer launcher ownership and manage banned launch-name hashes. No launcher pause function was observed.

ArcPad also currently exposes a separate non-USDC pair launcher at `0x9D328ea13957C74103781aa6B060124f3c1Bd82B`. It has different factory and locker authorities. This receipt excludes that path and does not transfer findings between the two variants.

## Token mechanics

The selected launcher calls the verified deployed token factory address above. Across the three reconstructed standard launches:

- token supply is `1,000,000,000` tokens with 18 decimals;
- no post-creation mint, supply-reducing burn, pause, blacklist, tax, or upgrade entry point was observed;
- token ownership is renounced to the zero address;
- the token contains a temporary recipient-balance cap hook;
- the token contains a one-time pad-controlled migration-exemption setter, but `migrationExemptSet` was false in all three samples;
- raw runtime hashes vary with constructor immutables, while the samples share the same code family and selectors.

The factory initially mints the supply to the launcher. In no-dev-buy samples, `999999999999999999673642024` raw units entered the initial position and `326357976` raw units, or `0.000000000326357976` tokens, remained at the launcher. “Full supply enters liquidity” is therefore not exact at raw-unit precision. No creator or team allocation was present in the no-dev-buy samples.

## Liquidity

The rail creates a Uniswap V3 USDC/token pool at the 1% fee tier with tick spacing 200. The launcher mints the initial position directly to the locker. The locker runtime is 5,439 bytes with keccak256 `0x769201a0a9390ea37aadc2e468dc0f1260baea3f58b30be7bbf4a385d8b22b78`.

The observed locker runtime has collection, claim, registration, and fee-redirection paths. It has no observed position transfer, withdrawal, or decrease-liquidity entry point, and the sampled position NFTs remain owned by the locker.

These are three distinct conclusions:

- `LP CANNOT BE WITHDRAWN UNDER THE OBSERVED RUNTIME`: verified.
- `LP EXISTS FOREVER`: not independently provable.
- `LP REMAINS IN RANGE FOREVER`: false; price can move outside the bounded position range.

The position range is `[-403600, 887200]` when the launch token is token0 and `[-887200, 403600]` when it is token1. Outside that range the position can cease earning fees and become economically one-sided even though the NFT remains locked.

## Fees

The selected mode charges the Uniswap V3 pool's 1% fee. Anyone may trigger locker collection. For quote-side USDC fees, the locker assigns 50% to the launch creator and 50% to the ArcPad treasury. The creator must claim its accrued amount.

Launch-token-side fees are not paid to the creator. They are sent to `0x000000000000000000000000000000000000dEaD` without reducing ERC-20 total supply. ArcPad's broad “creator earns 0.5% on every swap” language is therefore imprecise: the verified creator route is 50% of quote-side fees, economically the USDC side of the flow.

The current launcher owner can call the locker to redirect future creator quote fees for a position. The sampled creator, protocol treasury, and unrelated callers could not. This makes the ArcPad launcher owner an external trust dependency for the creator-fee destination.

Observed accounting checks include:

- MoonCat collection transaction `0x021092bbbdd243a0726b468ccdb8307643b4004c233c08ade5c4a40446bbd795`: `100999` raw USDC collected, `50500` sent to treasury, `50499` made creator-claimable.
- TITCOIN mixed collection transaction `0x3840ed856ed22dd2e6425f5c9c7f8374cc02e08392aff17be7bafc90f2bd8ba0`: `2845400` raw USDC collected, `1422700` sent to treasury, and `745030083883844075935269` raw launch-token units sent from the locker to the dead address.

ArcPad's UI also advertises a holder-rewards mode with a configurable creator cut. That different product mode was not selected or contract-verified by this receipt.

## Wallet cap and anti-snipe semantics

The token transfer hook limits a recipient to `20,000,000` tokens, exactly 2% of total supply, through an inclusive deadline of launch block plus 1,200 blocks. Historical calls around the MoonCat launch established that 2% was accepted, 2% plus one raw unit was rejected through block `21879584`, and the cap was gone at block `21879585`.

The check applies to direct Uniswap transfers because it is enforced on the token recipient balance. Routers do not turn it into identity-level control. Multiple wallets bypass it trivially, and a contract wallet is simply another recipient. This is a temporary per-address cap, not Sybil resistance.

The immutable duration is measured in blocks. At the observed Arc cadence, 1,200 blocks was about ten minutes. ArcPad's current “~2 min” UI copy is a platform claim and did not match that observation.

## Creator first buy

ArcPad permits a configured initial buy in the same transaction and block as token creation and position minting. It executes against the new pool before third-party transactions can be ordered after the launch transaction. It is a public-pool purchase with privileged first-position ordering, not a hidden token allocation. BINRAT Launch Configuration V0 disables this option.

MoonCat used this path: the creator supplied `100000` raw USDC and received `33332636015742865668472` raw token units. BINRAT has not executed this option and its frozen owner policy sets it to `DISABLED`.

## Real-launch cross-check

| Launch | Launch transaction | Token | Pool | Position | Dev buy |
| --- | --- | --- | --- | ---: | --- |
| MoonCat | `0xd8399b178274900222abb7892a1e4a02836463ad6a769d5416db4f9e14e355d3` | `0x33791dde0Af120cf8DBFbb015f53f62C2A1F6B14` | `0x3fcc327C14Df41926f9F8f2F3b06D14F3490a5b5` | 43108 | yes |
| TITCOIN | `0xc412e709858e4fea70a600d8ca05bc6178c15529e4ee740cc7676d845264ab31` | `0x3BA3182081fb79c60209a32789137145fD03e7f1` | `0xCC1fe4d5A7660152EecBe8eab3deC89B09E35DF3` | 41000 | no |
| EMPTYOT | `0x2b19355aa1f8fe91b6c75b0cdf57d1543ed1f6e317f578b184355cd9ebb8b418` | `0xa7ef970A9cC2f2238b9ab8f9de8076F76F192Cd7` | `0xF021624FFE2667F93Dff2D717ea3b634E88356d0` | 40163 | no |

Each reconstruction binds launcher transaction → factory-created token → V3 pool → locker-owned position → standard-mode fee authority. All three had 18 decimals, 1 billion supply, zero token owner, a 2% cap, the same configured V3 authorities, a 1% pool fee, and the standard reward flag.

## Allocation and privileged inventory disclosure

- Private presale: `NO_UNDER_SELECTED_MECHANICS`.
- Discounted insider round: `NO_UNDER_SELECTED_MECHANICS`.
- Team allocation: `NO_UNDER_SELECTED_MECHANICS`.
- Hidden privileged inventory: no creator/team allocation; deterministic raw-unit launcher dust exists; final launch state requires the actual launch receipt.
- Founder/project public purchase: mechanics receipt snapshot `UNRESOLVED`; later owner policy is `NOT_PLANNED_FOR_LAUNCH`.
- Treasury inventory: `ZERO_NOT_YET_CREATED` under the later owner policy. This describes the current absence of a BINRAT token, not a future inventory claim.

The mechanics findings plus Launch Configuration V0 form a deterministic pre-launch owner-policy statement. They do not prove a future launch transaction; post-launch on-chain allocation verification remains required.

## Platform claims not independently verified as phrased

- ArcPad contract source matched to the deployed launcher, factory, and locker bytecode was unavailable. Embedded compiler metadata indicates Solidity 0.8.24, but that alone is not source verification.
- “100% supply added to liquidity” ignores observed raw-unit launcher dust.
- “Liquidity locked forever” is stronger than the verified absence of a withdrawal path in the current runtime and says nothing about remaining in range.
- “Creator earns 0.5% on every swap” omits that only quote-side fees are shared and launch-token-side fees go to the dead address.
- “2% cap for ~2 min” does not bind the deployed 1,200-block duration.
- The holder-rewards alternative was visible in the platform UI but was outside the selected standard-mode verification.

## Owner-input snapshot and later resolution

At verification time no values were inferred for these decisions. The immutable receipt JSON therefore preserves its original null handoff. Launch Configuration V0 later resolves items 1–4 without rewriting or redigesting this mechanics evidence:

1. creator/project fee recipient wallet;
2. treasury wallet;
3. whether the founder/project makes a disclosed public-pool purchase and whether it uses the same-transaction first-buy option;
4. confirmation of standard creator-rewards mode rather than holder rewards;
5. final Holder Gate absolute raw balance threshold;
6. launch name, symbol, image, links, and other metadata;
7. exact launch time/block;
8. separate legal/compliance authorization.

The selected values are `TREASURY = 0xab063A9b53a2Ab832a941aE5890ea05c1672339D`, `PROJECT_FEE_RECIPIENT = 0xba5Ee49734b50Cf62d0B538584fbaC0eFFB79866`, standard creator rewards, no privileged first buy, and no founder/project public-market purchase planned for launch. Threshold, metadata, timing, and legal authorization remain unresolved.

## Dumpster Ledger handoff

Production accounting remains inactive. After owner-selected wallets and the actual token are frozen, a separate reviewed authority record must consume:

- chain ID `5042`;
- actual token address;
- creator/project fee recipient address;
- treasury address;
- effective launch block;
- this receipt digest, or a refreshed successor digest used for launch.

The digest is copied into the separate funding authority rather than self-referenced inside the hashed receipt. The current JSON handoff keeps all unknown addresses and the effective block `null`.

## Holder Gate handoff

Production HOLDER eligibility remains inactive. Its later authority must bind:

- chain ID `5042`;
- actual canonical token address;
- owner-approved absolute raw balance threshold;
- policy/version;
- effective time and/or block;
- separately reviewed balance source.

Receipt existence, a token address, or a threshold alone must not activate HOLDER.

## Legal and authority boundary

This is technical verification, not legal authorization. The legal/compliance gate remains separate and unresolved.

- `launchAuthorization = BLOCKED`
- `marketingAuthorized = false`
- `tokenState = NOT_LAUNCHED`
- no BINRAT token was created;
- no transaction was signed or broadcast;
- no funds moved;
- no production HOLDER eligibility was activated.
