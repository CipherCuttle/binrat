# BINRAT documentation authority

Read this file first. Load only the authority needed for the task.

> **Status lives in the manifest. Intent lives in the roadmap. Principles live in philosophy. Language lives in the language contract. Implementation lives in scoped specs. History lives in receipts.**

## Canonical global authorities

| Question | Authority |
| --- | --- |
| What is true / shipped / blocked right now? | `docs/CAPABILITY_MANIFEST_V0.json` |
| What are we building toward? | `docs/ROADMAP.md` |
| Why does BINRAT behave this way? | `docs/PHILOSOPHY.md` |
| What words, role names and voice should surfaces use? | `docs/PRODUCT_LANGUAGE.md` |
| What is the current live intelligence rail? | `docs/product/ROBINHOOD_LIVE_INTELLIGENCE_V1.md` |
| How does the current V2 product surface behave? | `docs/PRODUCT_SURFACE_V1.md` |
| What is the token/fair-launch doctrine? | `docs/TOKEN_LAUNCH_DOCTRINE.md` |

## Precedence

If documents disagree:

1. current capability/deployment/authorization state → **CAPABILITY_MANIFEST** wins;
2. future product sequencing/inventory → **ROADMAP** wins;
3. evidence/truth/product invariants → **PHILOSOPHY** wins;
4. names, voice and public wording → **PRODUCT_LANGUAGE** wins;
5. implementation details inside one active feature → that feature's current scoped spec wins;
6. dated plans, handoffs, reviews and receipts describe what was planned or observed then; they never silently become current global authority.

A scoped feature spec may refine implementation. It may not promote its own deployment status, change the global roadmap, rename canonical roles, or authorize token/financial actions.

## Current rail boundary

The active launch-intelligence source contract is **Pons V2 on Robinhood Chain 4663**.

Arc `5042` remains historical / legacy evidence. The dated Arc launch-mechanics and launch-configuration artifacts are retained for provenance but are **not current token-launch rail authority** after the product rail migration. Current token launch authorization remains fail-closed until a fresh current-rail mechanics/configuration binding is reviewed and explicitly authorized.

See the capability manifest for current authority state.

## Document classes

### KEEP / active authority

Always prefer the canonical global authorities above. Load these scoped contracts only when the task touches them:

- `docs/PRODUCT_SURFACE_V1.md` — current V2 product-surface contract;
- `docs/product/ROBINHOOD_LIVE_INTELLIGENCE_V1.md` — current Pons/4663 source semantics;
- `docs/RAT_PERSONALITY_V0_5.md` — Telegram-specific renderer/parser behavior;
- `docs/product/AUTONOMOUS_RAT_V1_PLAN.md` — Autonomous Rat implementation contract while that capability is active work.

### BACKBURNER / vision

Do not preload these for normal implementation work:

- `docs/PRODUCT_NETWORK_PAPER_V0.md` — long-horizon product/network vision, not current status or execution authority;
- future capabilities named in `docs/ROADMAP.md` remain roadmap inventory until deliberately promoted to active work;
- do not create speculative `*_PLAN_V1.md` files for backburner features.

### HISTORY / receipts / superseded plans

Do not use these as current authority:

- `docs/ROADMAP_V0.md`;
- the superseded `ROADMAP_LIVING_SCENES_*` planning set;
- dated Gate / recovery / verification receipts;
- completed handoffs and reviews once their durable decisions have been extracted.

Keep them in Git for provenance. “Discard” means **discard from active context**, not erase history.

## Context-budget rule

For a normal task:

1. read this router;
2. read only the relevant canonical authority or authorities;
3. read at most the active scoped feature spec needed for implementation;
4. open receipts/reviews only when verifying history or a specific claim.

Do **not** bulk-load superseded roadmap plans, old handoffs, recovery receipts, or historical review files “just in case.”

## Planning lifecycle

A planning document has a bounded lifecycle:

`PLAN → IMPLEMENT / REJECT → EXTRACT DURABLE DECISIONS → VERIFY → FREEZE`

After it is superseded, do not keep editing it. Git history and dated receipts preserve the reasoning.

## Historical material

Files explicitly marked `SUPERSEDED`, `RECEIPT`, `HANDOFF`, `REVIEW`, or dated verification/recovery artifacts are reference/history unless a canonical authority explicitly points to them for a current fact.

Historical evidence should not be deleted merely to save context. Reduce context by routing correctly, not by destroying provenance.
