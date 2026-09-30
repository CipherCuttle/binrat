# BINRAT Product Surface Split V1 — Telegram Scout / Web Forensics Code Plan

**Status:** PRODUCT / CODE PLAN — docs only  
**Date:** 2026-10-01  
**Planning base:** `ab6d0b09eacd2b3b7c0af7f5b3d2d4451a9fb316`  
**Runtime authority:** NONE  
**Merge authority:** NONE  
**Token/trading authority:** NONE  
**Public Rat:** unchanged / remains separately gated

## 1. Decision

BINRAT will use one intelligence system and two presentation depths:

> **Telegram tells you when to care. Web BINRAT shows you everything worth knowing.**

Telegram is the fast product:
- discover something interesting;
- understand the strongest signal in seconds;
- DIG a target;
- WATCH / UNWATCH;
- receive high-value recurrence alerts;
- get a bounded WHY;
- share;
- escalate to the exact case.

The Web App is the forensic product:
- dense case files;
- deployer / creator history;
- launch chronology and recurrence cadence;
- full receipts and source links;
- Replay;
- evidence coverage and missing-data detail;
- relationship views;
- side-by-side launch comparison;
- deeper Rat Radar browsing/filtering;
- larger watch management;
- later advanced analysis.

The Telegram Mini App is **not a third product**. It is the Web App running in a Telegram-aware shell with verified Telegram `initData`, private identity binding, Telegram Back-button integration and safe in-app navigation.

## 2. Why this split

The private Telegram V2 acceptance proved the transport, state, private menu, callback, Watch and Pons paths. The owner test exposed a different issue: too much internal evidence detail is reaching the primary user surface.

The correction is not to remove evidence. It is to enforce progressive disclosure:

1. **Card:** what happened?
2. **WHY:** why did BINRAT surface it?
3. **Open Case:** investigate the full case.
4. **Full Receipt:** prove the exact claim.

The same canonical evidence remains underneath every layer.

## 3. Product thesis

The end-user value proposition must be understandable in roughly ten seconds:

> **Catch repeat launchers early.**  
> BINRAT remembers who launched what and squeaks when familiar paws come back.  
> **No vibes. Receipts.**

Alternative brand-compatible headline:
> **The rat remembers what you don't.**

The emotional payoff to optimize for is:

> **"holy shit, the rat remembered that."**

Do not optimize for compulsive screen time, fake urgency or unsupported profit claims. Optimize for high-value discovery, competence, memory and timely return.

## 4. Frozen epistemic boundary

Existing evidence rules remain authoritative.

BINRAT may expose:
- observed launches;
- source-reported deployer/creator addresses;
- repeated appearance of the same address;
- deterministic recurrence/timing facts;
- explicit missing/partial/unverified evidence;
- Watch state;
- canonical receipts.

BINRAT must not upgrade those facts into:
- BUY / SELL / APE recommendations;
- SAFE;
- SCAM / RUGGER without a separately supported claim contract;
- guaranteed profit;
- pump prediction;
- wallet address = real-world human identity.

**Domain truth is shared. Presentation depth differs.**

## 5. Ten-stack product architecture

### Stack 1 — user job

Telegram answers:

> **Should I care about this right now?**

Web answers:

> **Show me everything BINRAT knows and how it knows it.**

Do not make Telegram answer the second question by default.

### Stack 2 — ten-second value comprehension

The first Telegram/Home experience must communicate:
- BINRAT watches repeat launchers;
- BINRAT remembers historical launches;
- BINRAT can notify the user when watched paws return.

Avoid teaching commands, schemas or backend terminology during onboarding.

### Stack 3 — information hierarchy

Primary Telegram cards follow:

**identity/context → strongest factual signal → recency/scale → actions**

Never:

**database fields → identifiers → methodology → disclaimers → commands**

Technical proof stays one or more levels deeper.

### Stack 4 — progressive disclosure

Three human-facing depths:

#### Level 1 — Telegram Card
- headline: roughly 3–8 words;
- one or two short factual sentences;
- recency/count only when valuable;
- at most two principal actions;
- no hashes/checkpoints unless the identifier is the subject.

#### Level 2 — Telegram WHY
- bounded explanation;
- 2–4 observations maximum;
- explicitly says what the pattern is and what BINRAT is **not** inferring when material;
- actions: Open Case / Full Receipt / Back.

#### Level 3 — Web Forensics
- dense structured detail;
- chronology;
- source roles;
- recurrence statistics;
- receipts;
- evidence coverage;
- Replay;
- relationship views;
- technical identifiers.

### Stack 5 — behavioral retention

Primary retention loop:

`DISCOVER → INVESTIGATE → WATCH → LEAVE → REAL EVENT → ALERT → RETURN → OPEN CASE`

Do not rely on refresh loops, meaningless streaks or excessive notifications.

A BINRAT alert should mean that a user-selected condition actually changed.

### Stack 6 — Rat voice

Preserve `RAT_PERSONALITY_V0_5.md`:
- short;
- dry;
- slightly feral;
- competent;
- mildly hostile to bullshit;
- never hostile to the user;
- no corporate assistant voice.

Personality comes primarily from:
- concise headlines;
- art/state;
- timing;
- button labels;
- restrained microcopy.

Do not prefix every line with an emoji.

### Stack 7 — trust

Use degen-native language on the surface while keeping proof exact underneath.

Examples:
- `Same paws. Again.`
- `5 launches. 9 days.`
- `Watching these paws. ✓`
- `SAME PAWS. NEW LAUNCH.`
- `Nothing in the bin.`

Trust escape hatch:
- `WHY`
- `OPEN CASE`
- `FULL RECEIPT`

A strong brand line is:

> **Don't trust the rat. Check the receipt.**

### Stack 8 — surface economics

Telegram should remain relatively small after this phase.

Future engineering effort should bias toward Web Forensics once:
- Telegram discovery works;
- DIG works;
- Watch works;
- alerts work;
- Open Case deep links work.

Do not keep adding dense forensic widgets to Telegram.

### Stack 9 — one state model

Do not implement separate:
- Telegram recurrence algorithms;
- Web recurrence algorithms;
- Telegram Watch state;
- Web Watch state;
- Telegram case IDs;
- Web case IDs.

One intelligence/state layer feeds both surfaces.

### Stack 10 — release discipline

The split is presentation architecture only.

It must not reopen:
- Pons catch-up architecture;
- RPC architecture;
- queue architecture;
- token launch;
- Holder Gate;
- trading/copy trading;
- frontend visual direction from scratch.

## 6. Target architecture

```
Robinhood / Pons
      ↓
canonical D1 evidence
      ↓
shared domain projections / outcomes
      ↓
stable case identity + Watch state
      ↓
 ┌───────────────┬─────────────────────┐
 │               │                     │
Telegram       Web API             receipt routes
summary        deep projections     canonical proof
 │               │
 │               ├── browser Web App
 │               └── Telegram Mini App shell
 │
 └── Open Case ────────────────→ exact same case
```

Rule:

> **One intelligence system. Multiple lenses.**

## 7. Shared domain contract

The split should converge on a shared typed case projection rather than surface-specific truth.

Candidate concept:

```ts
interface CaseSummary {
  caseId: string;
  chainId: 4663;
  subject: {
    type: 'REPORTED_DEPLOYER' | 'TOKEN' | 'LAUNCH';
    address?: string;
    launchId?: string;
  };
  strongestSignal: CaseSignal;
  latestLaunch?: LaunchReference;
  recurrence?: {
    launchCount: number;
    firstObservedAt: number;
    latestObservedAt: number;
    recentWindowCount?: number;
  };
  coverage: CoverageSummary;
  actions: {
    canWatch: boolean;
    canShare: boolean;
    receiptAvailable: boolean;
  };
}
```

Deep Web projections may add:
- all launches;
- full chronological timeline;
- Replay stages;
- related evidence;
- source links;
- relationship graph;
- raw receipt references.

Telegram should consume `CaseSummary`; it must not independently calculate a new finding from raw D1 rows.

## 8. Stable routing / handoff contract

Every meaningful Telegram object must have one stable Web destination.

Initial route contract:

```
/app/                         discovery/home
/app/case/:caseId             exact investigation
/app/deployer/:address        reported-deployer history
/app/launch/:launchId         launch dossier
/app/watches                  shared Watch management
```

If an existing route scheme is already stable, adapt rather than duplicating it.

Telegram deep links should carry identifiers, not pre-rendered evidence blobs.

The Web App rehydrates from canonical APIs.

Acceptance:

> alert → OPEN CASE → exact case opens with no search/re-entry.

## 9. Telegram capability boundary

Telegram must remain independently useful.

### HOME
Purpose:
- explain value in seconds;
- start discovery or DIG.

Target shape:

> **Hunting familiar paws.**  
> I remember repeat launchers and squeak when watched ones come back.

Actions:
- FIND RATS
- DIG

Secondary:
- WATCHES

### RATS
One candidate at a time.

Target shape:

> **Same paws. Again.**  
> This deployer has appeared **5 times** in BINRAT's memory.  
> Latest: **14m ago**

Actions:
- INVESTIGATE
- WATCH

Secondary:
- next / previous;
- OPEN CASE where appropriate.

### CASE
Target:

> **5 launches. 9 days.**  
> Same reported deployer address across all five.

Optional third line only when genuinely valuable:
> Latest return: **19h after the previous launch.**

Actions:
- WATCH / WATCHING
- OPEN CASE

Secondary:
- WHY
- SHARE

### WHY
Maximum 2–4 supporting observations.

Target:

> **Why I noticed**  
> Same reported deployer across 5 launches.  
> 3 appeared in the last 48h.  
> That's the pattern — nothing more inferred.

Actions:
- OPEN CASE
- FULL RECEIPT
- BACK

### WATCH
Success:

> **Watching these paws. ✓**  
> I'll squeak if they launch again.

No additional technical explanation unless Watch cannot be established.

### ALERT
Frozen spirit:

> **SAME PAWS. NEW LAUNCH.**  
> One of your watched deployers is back.  
> **2m ago**

Actions:
- INVESTIGATE / OPEN CASE
- WHY

Avoid five-button alert walls.

### EMPTY
> **Nothing in the bin.**

Then one useful explanation/action.

### ERROR
Translate internal state.

Instead of:
`SYNC_TIMEOUT_ERROR`

Use:
> **Pipe smells wrong.**  
> I can't verify fresh chain data right now.

Actions:
- RETRY
- HOME

Technical code may be available under diagnostics/deep proof, not the normal card.

## 10. Telegram copy constraints

Create enforced presentation budgets.

Suggested initial budgets:
- headline: <= 60 characters;
- ordinary card body: target <= 240 characters, hard cap significantly below Telegram's 1024 media limit;
- WHY: target <= 420 characters;
- max primary buttons: 2;
- max visible navigation/actions per normal card: 4;
- normal card paragraphs: <= 3;
- technical identifiers: abbreviated unless user explicitly requests/copies them.

These are initial implementation limits, not marketing claims. Tune only from owner/mobile evidence.

Prohibited main-surface terms unless the term itself is relevant:
- `sourceVerified`;
- `runtimeFresh`;
- `authority_json`;
- `evidenceDigest`;
- `checkpointBlock`;
- `canonical verification concurrency`;
- internal Queue/runtime codes.

Create a lint/test vocabulary for internal jargon leakage.

## 11. Web Forensics capability boundary

The Web App is where complexity is valuable.

### Case Header
Show:
- concise finding;
- subject role/address;
- latest launch / recency;
- Watch state;
- coverage status;
- canonical Open Receipt action.

### Launch Timeline
Chronological launches with:
- launch time/block;
- token;
- source-reported deployer;
- relevant interval since previous launch;
- available observation stages;
- direct receipt/source links.

### What BINRAT Noticed
Human-readable deterministic factor explanation:
- recurrence;
- timing/cadence;
- known evidence reuse;
- coverage limitations.

No opaque risk score.

### Creator / Deployer History
Complete known launch history for that source-reported address:
- count;
- chronological ordering;
- first/latest seen;
- bounded recurrence windows;
- per-launch links.

Always preserve:
`same address != same human identity`.

### Replay
Use frozen point-in-time stages:
- LAUNCH;
- 5m;
- 1h;
- 24h.

No lookahead.

### Receipts / Sources
Full technical evidence:
- tx/block/log;
- receipt IDs;
- digests;
- canonical source links;
- coverage and missing state.

### Relationship view
Only relations supported by canonical/derived evidence.
No generic bubble-map theater.

### Compare
Later bounded addition:
- compare 2–4 launches/cases;
- same dimensions;
- explicit missing data;
- no implied quality score.

## 12. Web information architecture

Initial navigation should privilege product work, not project documentation.

Candidate:

```
Discover
Radar
Watches
Cases / Recent
More
```

Inside a case:
```
Overview
History
Replay
Evidence
Relations
```

On phone, one task at a time.
On desktop, denser multi-panel inspection is acceptable.

Do not recreate the old dashboard overload.

## 13. Mini App strategy

The Telegram Mini App is the same application with a Telegram shell.

Shared:
- routes;
- data adapters;
- Case components;
- Radar components;
- Watch components;
- receipt views.

Telegram-only shell responsibilities:
- verify `initData` server-side;
- bind authorized Telegram identity;
- expose Telegram Back button;
- use Telegram viewport/safe-area information;
- avoid browser assumptions that break embedded navigation.

Browser shell responsibilities:
- standard history/deep links;
- normal share/copy behavior.

Do not fork Web features into a separate `telegram-mini-app` implementation tree.

## 14. Watch unification

One Watch concept.

Shared durable state:
- subject;
- owner/principal;
- start block/time;
- generation;
- enabled state;
- delivery state.

Telegram:
- quick arm/disarm;
- alerts.

Web:
- richer list management;
- case context;
- later filtering.

Any Web Watch action must use the same backend contract and idempotency guarantees as Telegram.

## 15. Share unification

One case/share receipt.

Telegram SHARE:
- compact message/card;
- deep link into exact public/authorized case.

Web SHARE:
- same underlying receipt/case identity;
- richer preview where available.

Repeated SHARE remains idempotent/reusable under existing expiry semantics.

## 16. Messaging and retention V1

The next product sprint starts with language, before adding forensic features.

### Value proposition
User should understand within ten seconds:
1. BINRAT spots repeat launchers;
2. BINRAT remembers their history;
3. BINRAT can watch them for a return.

### Retention events
Measure product value around:
- useful RATS discovery;
- CASE opened;
- WATCH armed;
- recurrence ALERT delivered;
- alert → case opened;
- receipt inspected.

Do not optimize a vanity metric such as raw message count.

### Notification policy
Alerts are event-driven and user-requested.
Do not create:
- generic engagement pings;
- fake scarcity;
- “you are missing gains” notifications;
- randomized urgency.

Notification trust is a product asset.

## 17. Implementation workstreams

### W0 — language and card compression

**Goal:** make current private Telegram usable before expanding Web.

Changes:
- audit every V2 card;
- replace database-shaped prose;
- implement copy budgets;
- reduce primary actions;
- add OPEN CASE;
- add jargon leakage tests;
- preserve FULL RECEIPT one level deeper.

Likely files:
- `src/telegram/ui/cards.ts`
- `src/telegram/ui/types.ts`
- `src/telegram/ui/keyboard.ts`
- Rat voice helpers
- Telegram tests

Acceptance:
- HOME value prop understood without command knowledge;
- normal cards fit without paragraph wall;
- every claim remains receipt-backed;
- no evidence capability removed.

### W1 — stable case/deep-link contract

**Goal:** exact handoff.

Implement:
- stable `caseId`;
- route builder shared by Telegram/Web;
- `OPEN CASE` button;
- deployed-host deep-link fallback;
- browser and Mini App route restoration.

Acceptance:
- Telegram RATS/CASE/ALERT opens the exact Web case.

### W2 — forensic Case V1

**Goal:** one excellent deep investigation before broadening the Web App.

Build:
- Case header;
- What BINRAT Noticed;
- chronological launch history;
- full evidence/receipts;
- Watch state;
- source/coverage disclosure.

Use existing evidence adapters. No backend redesign.

### W3 — Replay integration

Embed:
- LAUNCH → 5m → 1h → 24h;
- stage receipts;
- missing states;
- no-lookahead proof.

### W4 — Radar / discovery depth

Add:
- repeat-launcher browsing;
- filters that correspond to deterministic evidence;
- selection → Case;
- recurrence/cadence views;
- transparent sample/coverage.

No BUY score.

### W5 — shared Watch center

Add Web:
- watched subjects;
- state;
- latest relevant event;
- Open Case;
- Unwatch.

Telegram remains the alert/delivery surface.

### W6 — relationship and compare tools

Only after Case/History/Replay are accepted.

Add bounded:
- supported relations;
- launch comparison;
- shared-address/context views.

Kill if they become decorative graph theater.

### W7 — release qualification

Run:
- phone/browser/Mini App;
- Android owner flow;
- keyboard/screen-reader;
- large text;
- stale/error states;
- deep-link reload;
- Telegram Back;
- Watch idempotency;
- forged `initData`;
- long identifiers;
- evidence receipts;
- public/private boundaries.

## 18. Suggested code ownership

### Shared truth
`src/core/`  
`src/intelligence/`  
`src/autonomous/`

Own:
- domain facts;
- findings;
- stable identities;
- case projections;
- Watch semantics.

No surface copy.

### Telegram
`src/telegram/ui/`

Own:
- compression;
- Rat voice;
- navigation/actions;
- Telegram presentation limits.

No independent intelligence calculations.

### Web
`web-v2/` or accepted successor tree

Own:
- forensic visualization;
- exploration;
- deep information architecture.

No independent claim authority.

### API / persistence
Cloudflare/D1 layer owns shared state and projections.

## 19. Test architecture

### Shared contract tests
Assert same case ID/finding across Telegram and Web projections.

### Telegram tests
- headline/card budgets;
- jargon blacklist;
- strongest signal present;
- max action count;
- WHY bounded;
- FULL RECEIPT preserved;
- Open Case route exact;
- Watch/Share idempotency;
- error translation.

### Web tests
- exact case route hydration;
- no fixture fallback in LIVE mode;
- chronology ordering;
- missing evidence stays missing;
- full receipt access;
- source-role labels;
- responsive deep-link behavior.

### Cross-surface tests
Given the same fixture/canonical case:
- Telegram summary and Web Case reference same `caseId`;
- counts/recency agree;
- Watch state agrees;
- receipt references agree;
- no surface invents a stronger conclusion.

### Mobile acceptance
Owner flow:

`Telegram alert → OPEN CASE → inspect history → Replay → receipt → WATCH state → Back to Telegram`

## 20. Success metrics

Initial product metrics should answer whether BINRAT creates value, not whether it creates compulsive use.

Useful:
- first useful action completion;
- RATS → CASE rate;
- CASE → WATCH rate;
- ALERT → CASE rate;
- receipt-open rate;
- repeat Watch use;
- time from HOME to first useful finding;
- user-reported “understood why this was surfaced.”

Avoid optimizing:
- messages sent;
- notification volume;
- refresh count;
- raw session duration.

## 21. Non-goals

This plan does not authorize:
- public Rat rollout;
- token launch;
- Holder Gate;
- trading/copy trading;
- BUY buttons;
- portfolio management;
- self-hosted archive node;
- RPC rewrite;
- Queue split;
- new intelligence model;
- a third Mini App product;
- a second Watch implementation;
- visual redesign from zero;
- fake social proof or fake live stats.

## 22. Bounded execution order

The next product order is:

```
W0  Telegram language / hierarchy
 ↓
W1  exact Open Case handoff
 ↓
W2  forensic Case V1
 ↓
W3  Replay
 ↓
W4  Radar/discovery depth
 ↓
W5  shared Watch center
 ↓
W6  compare/relations if still valuable
 ↓
W7  owner/mobile/release acceptance
```

Parallel work is allowed only when it does not duplicate shared contracts.

Recommended engineering allocation after W0/W1:
- ~25% Telegram / alerts / triage;
- ~15% shared handoff/API/state;
- ~60% Web forensic experience.

## 23. Acceptance gate

This product split is accepted when:

1. a first-time user can state BINRAT's value after a short HOME/RATS interaction;
2. Telegram remains independently useful for RATS, DIG, WHY, WATCH, WATCHES, ALERT and SHARE;
3. normal Telegram cards no longer dump internal evidence/state;
4. every important Telegram finding has an exact Open Case handoff;
5. Web Case provides meaningfully deeper history/evidence than Telegram;
6. browser Web App and Telegram Mini App share the same forensic components/routes;
7. Telegram and Web consume one shared case/evidence/Watch authority;
8. FULL RECEIPT remains accessible and complete;
9. claim boundaries remain unchanged;
10. no token/trading/public authority is introduced.

## 24. Final product doctrine

**Telegram is the scout.**  
Fast, terse, useful on its own. It finds, explains just enough, watches and alerts.

**Web BINRAT is the intelligence room.**  
It exposes the history, timeline, relationships, Replay and receipts needed for serious investigation.

**The backend is the memory.**  
Both surfaces consume the same canonical facts and deterministic findings.

Do not solve Telegram overload by hiding truth.

Solve it by putting each level of truth on the surface where it is most useful.
