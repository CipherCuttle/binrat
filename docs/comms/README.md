# BINRAT Comms Rat — Shadow V1

Status: **SHADOW ONLY**  
Publication authority: **NONE**  
Default output: `POST | QUEUE | IGNORE` + draft bundle + receipts + violations.

## Mission

Turn verified BINRAT project events into channel-native communication candidates without turning engineering progress, roadmap intent, or inference into product truth.

The Comms Rat automates editorial operations. It does not own claim authority.

## Frozen operating laws

1. **No evidence → no factual public claim.**
2. **ENGINEERING_PASS != DEPLOYED != PUBLIC_LIVE.**
3. **Engagement may optimize presentation later; it may never lower the truth threshold.**
4. **Publisher infrastructure owns delivery, not narrative authority.**
5. **Human approval remains mandatory until a content class earns bounded autonomy through recorded evidence.**

## Authority inputs

This first slice is based on:

- repository claim boundary: `docs/CLAIM_BOUNDARY.md`;
- frozen Brand V1 composition: `integration/binrat-brand-v1-composed@0343d3815e509c45ef6b4991a7f8d438e2f4deb1`;
- Brand V1 copy contract: `docs/design/brand-v1/COPY_LIBRARY.md`;
- Brand V1 banned language: `docs/design/brand-v1/BANNED_LANGUAGE.md`;
- Brand V1 usage contract: `docs/design/brand-v1/BRAND_USAGE.md`.

Do not duplicate those brand files here. Rebase/import the approved Brand V1 composition before final integration if it is still not on the target branch.

## Content contract

Brand V1 already defines the public shape:

**FERAL HEADLINE → LITERAL EXPLANATION → RECEIPT / SOURCE**

Comms Rat adds the state machine in front of that copy system.

Canonical lifecycle states used by this module:

- `EXPERIMENTAL`
- `PLANNED`
- `BUILDING`
- `ENGINEERING_PASS`
- `DEPLOYED`
- `PUBLIC_LIVE`
- `BLOCKED`
- `DEPRECATED`
- `REJECTED`

A later state may support stronger wording. An earlier state may never borrow wording from a later state.

Examples:

- `BUILDING` may say "building".
- `ENGINEERING_PASS` may say engineering passed.
- `DEPLOYED` may say deployed.
- only `PUBLIC_LIVE` may say live, shipped, available now, or use it now.

## Shadow-mode flow

```text
project event
    ↓
structured CommsEvent
    ↓
deterministic triage
POST | QUEUE | IGNORE
    ↓
baseline drafts or external writer drafts
    ↓
claim / banned-language validation
    ↓
ShadowPostBundle
    ↓
human review
```

Even a valid `POST` bundle has:

```text
requiresHumanApproval = true
publishAllowed = false
```

No code in Shadow V1 can publish to X, Telegram, OpenPost, Postiz, or any other destination.

## Triage

The score is intentionally coarse and only ranks editorial attention:

```text
userValue
+ novelty
+ evidence strength
- repetition penalty
- medium-risk penalty
```

The score does **not** estimate virality, truth, token performance, financial value, or probability of success.

Hard queue conditions override the score:

- explicit `HOLD`;
- public authorization absent;
- evidence absent;
- `EXPERIMENTAL` / `PLANNED`;
- `BLOCKED`;
- high-risk topic.

## Threat model covered in V1

- PR/commit evidence references do not grant public authority; `publicAuthorized` is a separate trusted input;
- BUILDING/ENGINEERING_PASS cannot silently become LIVE;
- missing receipts stop immediate publication;
- Brand V1 hard-ban phrases are linted;
- publisher authority is structurally absent.

Still **not solved**:

- semantic entailment beyond simple state/banned-language checks;
- stale authority selection across branches;
- prompt injection in future external research;
- duplicate-story memory;
- analytics feedback;
- OpenPost/Postiz integration;
- X / Telegram credentials;
- model-backed writing.

Those are later slices, not hidden assumptions.

## Acceptance gate

Before adding an LLM or publisher:

1. run the repository check;
2. prove BUILDING cannot produce a live claim;
3. prove ENGINEERING_PASS cannot produce a deployed claim;
4. prove missing evidence queues the event;
5. prove high-risk events queue;
6. prove all bundles remain shadow-only.

Only after this gate is green should the next slice add model-backed drafting behind this validator.
