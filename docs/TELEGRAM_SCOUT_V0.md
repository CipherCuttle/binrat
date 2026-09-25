# BINRAT TELEGRAM SCOUT V0 — RAT-OPERATED WALLET RESEARCH
Date: 2026-09-25
Status: isolated candidate; no production or webhook mutation authority
Prerequisite: draft PR #34 private-DM memory and current verified ArcPad index/Radar/Watch.

## Owner's intended journey
User: "Show me the latest wallets worth following." Deterministic routing opens a single Telegram photo of BINRAT rummaging. The same message changes from DIGGING to source-backed results through Telegram sendPhoto plus editMessageCaption/editMessageMedia. Present exact addresses, token launches in the past 14 days, verified MC and 24h volume if available, and evidence/Watch controls. Rat mood states are IDLE, CHEEKY, INQUISITIVE, DIGGING, EVIDENCE_FOUND, REPEAT_CREATOR, ALERT, EMPTY_PAWS, and ERROR. All states must derive from the exact owner-approved cyborg rat (web/assets/binrat-hero.webp); until separately approved mood images exist, use the existing approved static poster with honest DIGGING/EVIDENCE text, not invented art.

## Semantic boundary
Two separate tabs and data models:
- REPORTED_CREATOR: exact creator address reported by a source launcher event, not proven human identity.
- OBSERVED_SWAP_RECIPIENT: address receiving launched tokens in an indexed swap; not proven beneficial owner, economic payer or person. A router or contract may receive assets.
The current verified live source is ArcPad/Arc 5042. Robinhood/Pons expansion remains gated behind a separately verified launch source and chain-specific receipts. Do not combine roles or chains by an unsourced inferred identity.

## Creator discovery V0 contract
The default is a rolling 14 x 24-hour wall-clock window. Canonical launch block timestamp is required. LaunchObserved.observedAtMs is the INGESTION time and is never admissible for launch recency: historical backfill would look fresh. Persisted source-derived observation targetTimestampMs minus horizonMs equals the canonical launch-block timestamp. Check receipt chain, launch ID, checkpoint block, consistent independent horizons, finite bounds [now - 14d, now], then group exact creators by distinct launch IDs. Exclude unverified timestamps from the strict 14-day list and disclose excluded count; historical coverage stays UNVERIFIED where completeness isn't proven. Candidate ordering is recurrence count descending, last known timestamp descending, address ascending. Describe candidates as "most active indexed creators," never profitable/best/guaranteed. Show top 3 in a photo caption and an Inspect receipts link to verified creator API.

USD metrics are NOT currently authoritative. Existing observation receipts have pool price scalar and token supply if available; current Radar receipts are raw token deltas, not independently verified USD price or comprehensive pool volume. For V0 display MC: unavailable and 24h volume: unavailable, each with precise missing-source reason. Do not call FDV circulating MC. Subsequent metric adapter must verify quote asset, event-time USD valuation, supply denominator, decimals, pool coverage, as-of checkpoint, source and freshness before any USD number appears.

## Telegram contract and gated interactions
Deterministic "latest wallets worth following" and /scout commands must cost ZERO AI neurons. Send approved public poster via sendPhoto with DIGGING caption; after the bounded source lookup edit the SAME message's caption on success, empty or error. Keep within Telegram's photo-caption size. Inline keyboard: Inspect receipts (source URL), Copy address (when supported), Watch new launches and Unwatch (callbacks only after separately authorized same-URL/same-secret webhook allowed_updates extension), Later: observed buyer activity alerts. Production currently registered message-only webhook: no callback buttons should claim an active subscription before callback enablement and durable D1 acceptance. Existing /watch commands already provide real future-only creator subscriptions, cap 25 per chat. URL/copy actions are not subscription activation.

## Big-buy alerts (later)
Separate RECIPIENT_ACTIVITY subscription for observed swap recipient, explicit source/chain/pool, quote-denominated threshold, confirmed transaction evidence and checkpoint. "$10k ape" cannot be inferred from token-side pool delta or an unlabeled router address. Only enable USD labels with trusted quote asset, event-time pricing and complete relevant swap accounting. Dedupe alert outbox by source activity ID and subscriber; future-only from accepted checkpoint. No execution keys, trades, buy recommendations, wallet connections, or copytrade ordering in this scope.

## Art and animation
Preserve black fur, damaged ear, cyber-eye side, silhouette and the approved source identity. Each state eventually needs an approved static Telegram 1:1 poster (compressed WebP/JPG), matching 4:5 panel and optional web Rive artboard. Digging loop only when a real bounded job is running; found/repeat/success frames only after actual evidence. Empty/errors need textual status independent of any artwork. No heavy animation during Telegram load. Retain full static fallback and reduce-motion alternative.

## Capacity / reliability
One short bounded indexed snapshot per requested role/chain/window. For larger scale, derive cached source-backed summaries in existing scheduled Worker/Queue lane so thousands of DMs do not scan entire launch history or issue live RPC requests. Snapshot includes cutoff, checkpoint and freshness; fail closed on stale source rather than showing demo data. Existing Telegram per-chat rate limit, update ID dedupe, retry semantics and D1 cost caps remain. Never expose bot tokens, trust arbitrary user-supplied media URLs, or spend AI budget on deterministic research. Use a maximum of three creator cards per caption; full detail via source-backed link.

## Staged delivery
S0 (this candidate): 14-day creator projection + deterministic /scout phrase router + approved static photo that edits in place + explicit missing USD metrics + read-only evidence link + full fixture/CI coverage. No callback or production enablement.
S1: same-message one-tap real creator Watch/Unwatch with authenticated callback queries and guarded webhook allowed_updates change after owner authorization; exact D1 subscription receipt and future-only recurrence delivery test.
S2: independent verified recipient watchlist, swap timestamps, quote-based threshold and event outbox, then source-backed large-acquisition alerts. Do not infer a person from an address.
S3: verified USD MC/FDV/24h-volume adapter and chain-expansion gates, followed by separately owner-approved exact-canonical mood assets.

Acceptance S0: strict 14d time math (not ingestion time), boundary/future/conflicting horizons excluded, repeat creator grouping, empty/unverified output, no invented MC/volume, callback not silently enabled, no inference use, correct same-message Telegram edit, CI green and one hostile review. No merge, production deploy, webhook cutover or token/trade authorization.
