# BINRAT Telegram UX V2 — Comprehensive Code Plan

**Repository:** `CipherCuttle/binrat`  
**Planning baseline:** `5fed3ed3c6f6405617348e150275378b23c24a59`  
**Branch:** `feat/binrat-telegram-ux-v2`  
**Status:** PLAN ONLY  
**Production authority:** NONE in this plan  
**Merge authority:** NONE  
**Public Rat:** remains OFF  
**Telegram media:** remains OFF until private V2 acceptance  
**Holder/token/trading:** untouched

## 1. Mission

Turn `@BinratBot` from a command-driven text bot into a polished, Telegram-native BINRAT product while preserving the evidence, replay, watch, rate-limit and deployment invariants already established.

The desired experience is:

**DISCOVER → INVESTIGATE → WATCH → ALERT → EXPLAIN → SHARE**

inside Telegram.

The Rat becomes the visible interaction layer. Users should spend most of their time tapping, browsing and interacting with a persistent Rat card rather than memorizing slash commands. Slash commands remain available as power-user and recovery paths.

## 2. Current state

Already present:

- verified Telegram webhook ingress;
- D1 update claim/deduplication;
- rate limiting;
- private controlled-user activation;
- canonical Pons/Robinhood evidence;
- `/rats`, `/dig`, `/why`, `/watch`, `/watches`, `/unwatch`, `/share`;
- public receipt deep links;
- durable Watch state;
- durable Alert outbox;
- command replay protection;
- eleven Rat artwork states;
- `sendPhoto`;
- `editMessageMedia`;
- media fallback;
- controlled media flag.

Existing visual states:

`idle-neutral`, `cheeky`, `inquisitive`, `digging`, `evidence-found`, `repeat-creator`, `alert`, `empty-paws`, `error`, `insulted`, `profile`.

The major missing pieces are interaction architecture rather than backend intelligence. Today `TelegramUpdate` effectively understands only `message`; `callback_query` is ignored. There is no inline-keyboard system and no `reply_markup` implementation. The Autonomous Rat returns presentation strings directly from domain operations.

Current media flow:

`command → send digging image → execute → edit image/caption`.

Useful, but not yet a Telegram application.

## 3. Critical planning constraint: evidence must never be truncated

Current media captions go through `ratCaption()`, bounded to Telegram's 1024-character photo-caption limit.

Canonical receipt rendering is separately tested against the 4096-character text-message limit.

Therefore V2 MUST NOT simply put current full receipt strings into prettier image cards.

V2 introduces a strict split:

### Rat Card Summary

- deliberately designed for ≤1024 characters;
- contains decisive facts;
- never gets generic silent truncation.

### Full Receipt

- canonical evidence;
- retains the existing larger text representation or opens an evidence surface;
- remains explicitly available through WHY / FULL RECEIPT / OPEN CASE.

UI convenience must never remove evidence.

## 4. Ten-stack design reasoning

### Stack 1 — Product

The Rat becomes the UI rather than an emoji attached to output.

One primary interactive object should represent the current task.

Instead of:

`user → /dig → large text response`

target:

`user → DIG → Rat starts digging → same Rat card becomes evidence result`.

### Stack 2 — Telegram-native interaction

Use Telegram native inline keyboards as the primary control surface.

Commands remain fallback interfaces.

### Stack 3 — State machine

Visual states correspond to actual system state:

- `idle-neutral` → home;
- `inquisitive` → waiting for input / watch interest;
- `digging` → investigation in progress;
- `evidence-found` → canonical evidence returned;
- `repeat-creator` → recurrence discovery;
- `alert` → explicit future Watch event;
- `empty-paws` → valid search, no qualifying result;
- `error` → evidence source unavailable/stale.

No Rat state may independently imply safety, maliciousness, profitability or human identity.

### Stack 4 — Information architecture

Every main card follows:

**identity/context → strongest factual signal → coverage → actions**

not database dump → IDs → commands → disclaimers.

Full raw receipts remain one level deeper.

### Stack 5 — Character

Reduce repetitive `🐀` prefixes.

The Rat's personality should come from artwork, transitions, concise headlines, button labels, microcopy and timing.

### Stack 6 — Latency feedback

Callback queries must be acknowledged immediately before expensive discovery or evidence work. Use chat-action feedback only for operations with noticeable latency.

### Stack 7 — Navigation

The user should always have an obvious route back to:

**HOME / RATS / DIG / WATCHES**

Navigation should edit the current message rather than append chat spam.

### Stack 8 — Reliability

Button actions must be at least as replay-safe as slash commands.

Particularly:

- double-tapping WATCH must not spend two DIG quotas;
- double-tapping SHARE should not create unnecessary public receipts;
- stale buttons must fail closed;
- edit ambiguity must never mutate evidence twice;
- notification delivery semantics remain unchanged.

### Stack 9 — Security / epistemics

Callback payloads are untrusted input.

Every action independently verifies:

- callback actor;
- private chat;
- controlled/public rollout gate;
- callback version;
- action allowlist;
- identifier format;
- canonical D1 state;
- current evidence availability;
- watch ownership.

No button state is evidence authority.

### Stack 10 — platform evolution

Build the native chat experience first.

Then attach a Rat Radar Mini App for dense investigation.

The Mini App complements the Rat chat; it does not replace it.

## 5. Target architecture

Current:

```text
Telegram update
      ↓
worker.ts
      ↓
parse command
      ↓
domain operation
      ↓
string renderer
      ↓
sendMessage / optional photo
```

V2:

```text
                   ┌── text command
Telegram update ───┤
                   └── callback query
                         ↓
                 Telegram UI Controller
                         ↓
                  authorization gate
                         ↓
                    typed action
                         ↓
               Autonomous Rat domain
                         ↓
                    typed outcome
                         ↓
                    RatCard model
                         ↓
             ┌───────────┴───────────┐
             ↓                       ↓
       Telegram renderer        full receipt
             ↓
  send/edit media + keyboard
```

Critical separation:

**domain truth ≠ presentation string**

## 6. Branch strategy

Use:

`feat/binrat-telegram-ux-v2`

stacked from exact approved parent:

`5fed3ed3c6f6405617348e150275378b23c24a59`

Base its draft PR on:

`feat/binrat-robinhood-live-rat-v1`

Why:

- PR #59 remains independently reviewable;
- current production activation mechanics stay isolated;
- Telegram UX can evolve without changing Pons evidence infrastructure;
- rollback remains simple;
- no accidental public rollout from UI commits.

## 7. V2 domain result layer

### New file

`src/autonomous/outcome.ts`

Introduce typed outcomes:

```ts
type AutonomousOutcome =
  | HomeOutcome
  | RatsOutcome
  | CaseOutcome
  | WatchMutationOutcome
  | WatchListOutcome
  | ShareOutcome
  | OpenReceiptOutcome;
```

Example:

```ts
interface CaseOutcome {
  kind: 'CASE';
  mode: 'DIG' | 'WHY' | 'ALERT';
  receipt: Receipt;
  privateAttention?: {
    watchStartBlock: number;
    watchCreatedAtMs: number;
    eventTimestampMs: number | null;
  };
}
```

No evidence interpretation is added here. This layer packages existing canonical results.

## 8. Refactor autonomous command execution

### Modify

`src/autonomous/telegram.ts`

Split:

```text
parse command
execute command
render legacy text
```

New structure:

```ts
executeAutonomousCommand(...)
  → AutonomousOutcome

renderLegacyAutonomousOutcome(outcome)
  → string

handleAutonomousCommand(...)
  → legacy compatibility wrapper
```

Existing slash-command tests must continue passing.

## 9. Fix WATCH button idempotency

### Modify

`src/autonomous/watches.ts`

New invariant:

**WATCH on an already-enabled identical target is an idempotent no-op.**

It must:

- not reserve another DIG;
- not call RPC again;
- not reset the watch boundary;
- not change generation;
- not create another notification authority.

Likewise:

**UNWATCH on an already-disabled target is a no-op.**

Return a typed `WatchMutationOutcome`.

## 10. Make SHARE reusable

### Modify

`src/autonomous/share.ts`

Introduce:

```ts
getOrCreatePublicShareReceipt(...)
```

Before creating a new random receipt:

- search for an existing unexpired public receipt for the same canonical case;
- reconstruct and verify it;
- reuse it if valid;
- otherwise create a new one.

Repeated SHARE taps must not create receipt spam.

## 11. Telegram UI type system

### New directory

`src/telegram/ui/`

### New file

`types.ts`

Core model:

```ts
type RatView =
  | 'HOME'
  | 'RATS'
  | 'CASE'
  | 'WATCHLIST'
  | 'WATCH_STATE'
  | 'SHARE'
  | 'ALERT'
  | 'EMPTY'
  | 'ERROR'
  | 'HELP';

interface RatCard {
  view: RatView;
  media: RatMediaState;
  caption: string;
  keyboard: TelegramInlineKeyboard;
  digestMaterial: unknown;
}
```

The renderer is presentation-only. No DB calls inside card renderers.

## 12. Callback protocol

### New file

`src/telegram/ui/callback.ts`

Define one strict versioned callback grammar.

Examples:

```text
v2:h
v2:r
v2:rn:<snapshot>
v2:rp:<snapshot>
v2:w:<creator>
v2:u:<creator>
v2:y:<shareId>
v2:s:<shareId>
v2:wl:<page>
v2:back
```

Never place arbitrary text in callback payloads.

Use existing `share_id` where possible instead of full 64-character case IDs.

Encode 32-byte identifiers as base64url where required.

Required functions:

```ts
encodeCallback(action): string
decodeCallback(input): RatCallback
```

Every emitted callback must be ≤64 UTF-8 bytes.

## 13. Telegram keyboard renderer

### New file

`src/telegram/ui/keyboard.ts`

Typed helpers:

```ts
callbackButton(...)
copyButton(...)
urlButton(...)
webAppButton(...)
```

BINRAT styling rules:

- primary: principal navigation/action;
- success: active Watch state only;
- danger: destructive settings action such as UNWATCH;
- default: evidence/navigation;
- never green/red-code a token, creator, launch or evidence conclusion.

## 14. Telegram API client

### New file

`src/telegram/ui/client.ts`

Centralize Telegram network calls.

Functions:

```ts
answerCallback(...)
sendChatAction(...)
sendCard(...)
editCard(...)
editKeyboard(...)
sendFullReceipt(...)
sendForceReplyPrompt(...)
deleteMessageBestEffort(...)
```

Existing `ratMedia.ts` remains asset/state authority.

All methods must:

- enforce timeouts;
- parse Telegram `ok`;
- understand `retry_after`;
- distinguish definitive failure from ambiguous network failure;
- never log bot tokens;
- never log private callback payloads wholesale.

## 15. Upgrade ratMedia instead of replacing it

### Modify

`src/telegram/ratMedia.ts`

Retain:

- closed artwork allowlist;
- same-origin HTTPS media;
- edit-in-place semantics;
- unsupported-media fallback.

Extend:

```ts
sendRatCard(..., keyboard?)
editRatCard(..., keyboard?)
```

Important change:

Do not use generic `ratCaption()` truncation for V2 cards.

Introduce:

```ts
assertRatCardCaption(caption)
```

If a V2 renderer exceeds 1024 chars, tests/build fail.

Legacy behavior may retain `ratCaption()` temporarily.

## 16. Card renderers

### New file

`src/telegram/ui/cards.ts`

Pure deterministic renderers.

### HOME

Media: `idle-neutral`

Buttons:

```text
[ 🐀 RATS ] [ 🔎 DIG ]
[ 👁 WATCHES ] [ ? HELP ]
```

### RATS

Display one candidate per card, not five giant text entries.

Media: `repeat-creator`

Buttons:

```text
[ WHY ] [ WATCH ]
[ COPY ADDRESS ]
[ ◀ ] [ 1/5 ] [ ▶ ]
[ HOME ]
```

No financial score.

### DIG / CASE

Media: `evidence-found`, or `repeat-creator` for recurrence.

Buttons:

```text
[ WHY ] [ WATCH ]
[ COPY ADDRESS ] [ SHARE ]
[ HOME ]
```

### WHY

Bounded summary plus:

```text
[ FULL RECEIPT ]
[ COPY CASE ID ]
[ BACK ]
```

FULL RECEIPT sends canonical full text until Mini App case viewer exists.

### WATCH STATE

Active:

```text
[ WATCHING ✓ ]
[ UNWATCH ]
[ WHY ]
```

### WATCHLIST

At most five watches per page. No 25-button wall.

### ALERT

Headline:

`SAME PAWS. NEW LAUNCH.`

Buttons:

```text
[ INVESTIGATE ]
[ WHY ]
[ SHARE ]
[ UNWATCH ]
```

The existing outbox remains the sole alert authority.

### EMPTY

Media: `empty-paws`

Buttons:

```text
[ REFRESH ]
[ HOME ]
```

### ERROR

Media: `error`

No fake result.

Buttons:

```text
[ RETRY ]
[ HOME ]
```

## 17. Callback-query ingestion

### Modify

`src/cloudflare/worker.ts`

Expand Telegram update type with `callback_query`.

Routing:

```text
validate webhook
↓
claim update_id
↓
replies enabled?
↓
callback_query?
   ↓
authorize callback principal
   ↓
parse V2 callback
   ↓
answerCallbackQuery immediately
   ↓
execute domain action
   ↓
edit card
   ↓
complete D1 Telegram ledger
```

Current callback-ignore regression becomes:

callback updates are ignored unless V2 is explicitly enabled and principal is authorized.

## 18. Authorization refactor

Generalize current message-only authorization into:

```ts
autonomousPrincipalAllowed({
  userId,
  chatId,
  chatType,
  isBot
}, env)
```

Slash commands and callbacks must pass the same controlled/public gate.

Private V2 rollout keeps:

```text
BINRAT_AUTONOMOUS_RAT_ENABLED=true
BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED=false
allowed user secret = exact tester
```

## 19. Callback acknowledgement

`answerCallbackQuery` must run before expensive D1/RPC work.

Examples:

- WATCH → `Watch armed ✓`
- UNWATCH → `Watch removed`
- stale receipt → `That receipt went cold. Refresh the case.`
- navigation → empty acknowledgement.

## 20. DIG input UX

Buttons cannot safely contain arbitrary user addresses.

Add a tiny Telegram-native prompt state.

### Additive migration

`cloudflare/migrations/<date>_telegram_ui_v2.sql`

Table concept:

```sql
rat_ui_prompts (
  chat_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('DIG')),
  card_message_id INTEGER NOT NULL,
  prompt_message_id INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  PRIMARY KEY(chat_id,user_id)
)
```

Approximate TTL: 5 minutes.

Flow:

1. user taps DIG;
2. callback acknowledged;
3. Rat card becomes inquisitive;
4. send native ForceReply prompt;
5. persist exact prompt message ID;
6. consume only an exact reply from same private principal;
7. edit original card to digging;
8. perform canonical DIG;
9. edit original card into CASE;
10. delete prompt best-effort.

Ordinary conversation must never be consumed as DIG input.

## 21. Message editing policy

Primary rule:

**navigate by editing the Rat card, not by spawning messages.**

New messages only for:

- explicit input prompts;
- full canonical receipt expansion;
- autonomous future alerts;
- unavoidable fallback after a definitive send/edit limitation.

## 22. Card digests and replay receipts

For V2, `replyDigest` hashes the deterministic card model:

- view;
- media state;
- caption;
- button actions;
- subject;
- presentation version.

Suggested renderer version:

`binrat.telegram-ui/2.0`

Suggested intents:

`UI_V2_HOME`, `UI_V2_RATS`, `UI_V2_RATS_NEXT`, `UI_V2_CASE`, `UI_V2_WATCH`, `UI_V2_UNWATCH`, `UI_V2_WATCHLIST`, `UI_V2_WHY`, `UI_V2_SHARE`, `UI_V2_DIG_PROMPT`, `UI_V2_DIG_RESULT`.

## 23. Formatting

Adopt Telegram HTML formatting in V2 renderer only.

Implement:

`escapeTelegramHtml()`

All dynamic strings are escaped.

Use formatting sparingly.

## 24. Alerts

### Modify

`src/autonomous/delivery.ts`

Preserve current outbox semantics.

Only change presentation from giant caption to interactive Alert card.

Outbox remains:

`PENDING → SENDING → SENT / UNKNOWN / FAILED`

Network ambiguity remains UNKNOWN rather than auto-resending.

## 25. Feature flags

Add:

```text
BINRAT_TELEGRAM_UI_V2_ENABLED=false
```

Keep:

```text
BINRAT_TELEGRAM_MEDIA_ENABLED=false
BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED=false
```

Controlled private V2 smoke:

```text
AUTONOMOUS RAT        true
UI V2                 true
MEDIA                 true
PUBLIC                false
ALLOWED USER          exact tester
```

Do not overload the media flag to mean UI V2.

## 26. Binding parity

### Modify

`src/cloudflare/deploymentBindingParity.ts`

Controlled V2 activation may permit only:

```text
BINRAT_TELEGRAM_UI_V2_ENABLED: false → true
BINRAT_TELEGRAM_MEDIA_ENABLED: false → true
```

while requiring:

`BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED=false`

and exact controlled tester secret.

Default production parity remains fail-closed.

## 27. Health surface

Extend `/health` with safe booleans:

```json
{
  "telegramUiV2Enabled": true,
  "telegramMediaEnabled": true,
  "autonomousRatPublicEnabled": false
}
```

Never expose tester ID or Telegram credential metadata.

## 28. Telegram command menu

Create idempotent:

`scripts/configure-telegram-ui.mjs`

Visible commands:

```text
/start
/rats
/dig
/watches
/help
```

Keep WHY/WATCH/UNWATCH/SHARE supported but not necessarily prominent.

Do not alter webhook configuration in this script.

## 29. Mini App — Phase 2 only

Do not make Mini App a prerequisite for native V2.

After native Telegram private pass, add Rat Radar Mini App for:

- dense case files;
- evidence timeline;
- discovery browsing;
- watchlist management later;
- receipt visualization;
- relationship graphs;
- source links.

Initial Mini App must be read-only.

Before Mini App mutations:

- verify Telegram `initData` server-side;
- bind Telegram identity;
- reject expired init data;
- never trust browser-supplied user IDs.

## 30. Explicitly deferred

Do not mix into Telegram UX V2:

- token launch;
- Holder migration;
- trading/copy trading;
- BUY buttons;
- portfolio tracking;
- arbitrary wallet surveillance;
- full Pons backfill;
- RPC architecture rewrite;
- queue architecture rewrite;
- 10K load qualification;
- frontend redesign;
- public/group rollout;
- inline-mode viral search;
- announcement-channel automation.

## 31. Test plan

All existing tests must stay green.

Planning baseline: 270 tests.

Add callback tests for:

- valid controlled principal;
- unauthorized principal;
- group rejection;
- bot actor rejection;
- malformed callback;
- unknown action;
- wrong version;
- payload length bound;
- stale snapshot;
- expired receipt;
- forged creator;
- public-disabled privacy.

Add acknowledgement ordering test:

`answerCallbackQuery` before expensive D1/RPC work.

Card tests:

- every caption ≤1024;
- every callback ≤64 bytes;
- approved media state only;
- approved button action only;
- no arbitrary URL;
- no user-controlled media.

Golden card fixtures:

HOME, RATS, DIG, WHY, WATCH ACTIVE, WATCHLIST, ALERT, EMPTY, ERROR.

Evidence tests:

- condensed card does not alter receipt;
- WHY reconstructs same canonical evidence;
- coverage remains PARTIAL where applicable;
- human identity/safety/profitability remain UNKNOWN;
- media state cannot change claim.

Watch hostile tests:

- WATCH double tap → one active watch, original boundary, one quota reservation, no duplicate RPC;
- UNWATCH double tap → disabled, pending work suppressed, no quota use.

Share hostile tests:

- repeated SHARE reuses valid public receipt;
- no private Watch/user context leaks.

DIG prompt tests:

- exact user/chat/prompt;
- TTL enforced;
- ordinary text unaffected;
- malformed address rejected;
- replacement/cancel safe.

Edit failure tests:

- not-modified is success;
- definitive 400 safe fallback;
- callback ack succeeds but edit fails;
- mutation succeeds but edit fails;
- network ambiguity does not repeat domain mutation.

## 32. UX acceptance script

Private controlled tester only.

### HOME

One interactive Rat home card.

### RATS

Tap RATS, browse next/previous, same Telegram message ID.

### WHY

Bounded summary then FULL RECEIPT gives full canonical receipt without truncation.

### WATCH

Immediate callback acknowledgement; WATCHING ✓ state. Double-tap must not spend twice.

### WATCHLIST

Watch visible, UNWATCH updates same card.

### DIG

Tap DIG → inquisitive → ForceReply prompt → real indexed Pons deployer → digging → evidence card.

### SHARE

Generate/reuse public receipt; no private owner/watch info.

### ERROR

Exercise source failure; error Rat, no invented evidence.

## 33. Mobile hostile review

Primary: Telegram Android.

Check:

- captions not clipped;
- button labels readable;
- keyboard height controlled;
- addresses readable;
- tap targets obvious;
- no chat flooding;
- visual Rat proportion;
- dark mode;
- slow-network state;
- keyboard survives media edit;
- copy address works;
- back/home obvious.

One iOS/desktop sanity pass if accessible.

## 34. Observability

Sanitized structured logs only:

```json
{
  "event": "TELEGRAM_UI_V2",
  "action": "WATCH",
  "phase": "COMPLETE",
  "latencyMs": 184
}
```

Never log:

- bot token;
- webhook secret;
- raw message text;
- private numeric user ID;
- arbitrary callback payload;
- Mini App init data.

Track later:

- callback success/failure;
- card edit failure;
- media fallback;
- stale buttons;
- callback latency;
- DIG prompt completion;
- WATCH mutation failures.

## 35. Implementation slices

### Slice A — interaction foundation

Implement:

- typed outcome layer;
- callback codec;
- keyboard types;
- card types;
- Telegram client;
- callback ingestion;
- immediate callback acknowledgement;
- private authorization;
- UI V2 flag.

No production activation.

Acceptance: unit/hostile tests green.

### Slice B — core cards

Implement:

HOME, RATS, CASE/WHY, WATCH, WATCHLIST, EMPTY, ERROR.

Extend media editing with keyboards.

Acceptance: deterministic card fixtures + 1024/64-byte invariants.

### Slice C — mutation hardening

Implement:

- WATCH idempotency;
- UNWATCH idempotency;
- reusable SHARE receipts;
- callback mutation replay tests.

Acceptance: double taps cannot duplicate authority/capacity.

### Slice D — DIG prompt

Add D1 prompt migration + ForceReply flow.

Acceptance: ordinary conversation cannot be consumed as DIG.

### Slice E — alerts

Render future Watch findings as interactive Alert cards without changing outbox semantics.

### Slice F — private visual rollout

State:

```text
UI V2       ON
MEDIA       ON
AUTONOMOUS  ON
PUBLIC      OFF
TESTER      owner only
```

Run Android acceptance sequence.

No merge.

### Slice G — hostile review

One independent hostile review on:

- authority bypass;
- callback forgery;
- replay;
- double tap;
- evidence truncation;
- private/public leakage;
- edit recovery;
- Telegram flood control.

Fix Critical/High only.

One targeted re-review.

### Slice H — owner UX verdict

Required verdict before public consideration:

`TELEGRAM UX V2 PRIVATE: PASS`

## 36. File changes summary

### New

```text
src/autonomous/outcome.ts

src/telegram/ui/types.ts
src/telegram/ui/callback.ts
src/telegram/ui/keyboard.ts
src/telegram/ui/cards.ts
src/telegram/ui/client.ts
src/telegram/ui/controller.ts

scripts/configure-telegram-ui.mjs

cloudflare/migrations/<date>_telegram_ui_v2.sql

test/telegramUiCallback.test.ts
test/telegramUiCards.test.ts
test/telegramUiController.test.ts
test/telegramUiSecurity.test.ts
test/telegramUiPrompt.test.ts

docs/product/TELEGRAM_UX_V2.md
```

### Modify

```text
src/cloudflare/worker.ts
src/telegram/ratMedia.ts

src/autonomous/telegram.ts
src/autonomous/watches.ts
src/autonomous/share.ts
src/autonomous/delivery.ts

cloudflare/wrangler.example.jsonc
src/cloudflare/deploymentBindingParity.ts

test/autonomousRat.test.ts
test/ratMedia.test.ts
test/cloudflareTelegramWorker.test.ts
test/deploymentBindingParity.test.ts
```

## 37. Non-negotiable invariants

1. No UI state creates evidence.
2. No artwork implies financial safety or maliciousness.
3. No evidence is silently truncated.
4. Every callback is re-authorized server-side.
5. Every callback payload is bounded and strictly parsed.
6. Double taps do not double-spend capacity.
7. A Watch boundary can never move silently.
8. Public receipts contain no private Watch/user context.
9. Telegram failure cannot affect indexing.
10. Public Rat remains OFF throughout private V2 development.
11. Token/Holder/trading stay untouched.
12. No merge without explicit owner authorization.

## 38. Definition of done

Telegram UX V2 is complete when:

- HOME is a visual interactive Rat card;
- RATS is browseable without command spam;
- DIG has a native input flow;
- investigation happens through card transitions;
- WHY exposes summary and complete evidence;
- WATCH is one-tap and idempotent;
- WATCHLIST is navigable;
- alerts have meaningful actions;
- addresses can be copied natively;
- callback interactions clear immediately;
- one primary message is edited instead of flooding chat;
- every V2 caption fits deliberately within Telegram limits;
- existing baseline has no regressions;
- hostile callback/replay tests pass;
- private owner Android smoke passes;
- Pons indexing stays healthy;
- webhook remains unchanged;
- public mode remains OFF;
- one hostile review and one targeted re-review pass.

Final gate:

**TELEGRAM UX V2 PRIVATE: PASS — READY TO CONSIDER PUBLIC UX GATE**

Not PUBLIC READY and not TOKEN READY.
