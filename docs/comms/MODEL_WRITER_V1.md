# BINRAT Comms Rat — Model Writer V1

Status: **SHADOW ONLY**  
Network adapter: **AVAILABLE BUT NEVER CALLED BY CI OR PRODUCT RUNTIME**  
Publication authority: **NONE**

## Purpose

Add model-backed copy drafting behind the deterministic Comms Rat gate from the parent shadow slice.

The model gets **copy authority only**. It cannot set or modify:

- event lifecycle;
- public authorization;
- evidence references;
- POST / QUEUE / IGNORE;
- human approval requirements;
- publication authority;
- X / Telegram credentials;
- token, capital, trading, signing, or deployment authority.

## Flow

```text
trusted CommsEvent
    ↓
prompt builder
    ↓
model writer
    ↓
strict { x, telegram } JSON only
    ↓
local parser
    ↓
existing deterministic claim gate
    ↓
ShadowPostBundle
    ↓
human review
```

If the model emits a stronger capability claim than the event supports, Brand V1 banned language, malformed JSON, extra authority fields, or oversized channel copy, the output is rejected or downgraded. Nothing is repaired silently.

## Prompt-injection boundary

`headline`, `summary`, and evidence refs are serialized inside an explicit `EVENT_DATA` envelope and declared untrusted. They cannot alter the output contract or authority model.

This is defense in depth, not proof that prompts cannot be injected. The important boundary is downstream: the model has no tools and the deterministic gate owns claim admission.

## OpenRouter adapter

`createOpenRouterCommsWriter()` is an optional transport adapter.

Properties:

- fixed HTTPS endpoint: `https://openrouter.ai/api/v1/chat/completions`;
- caller-selected exact model ID;
- one request, no retry loop;
- 30-second default timeout;
- 64 KiB response cap;
- no tools;
- no streaming;
- strict JSON Schema response request;
- `provider.require_parameters=true`;
- provider error bodies are not surfaced;
- API key is held only in request memory and is never returned in receipts.

Current OpenRouter documentation supports OpenAI-compatible chat completions and `response_format` structured output. The adapter still validates the returned content locally because provider-side structure is not authority.

## Writer receipt

A successful model call returns a local receipt containing:

- provider;
- returned model ID;
- request digest;
- raw-output digest;
- parsed-draft digest;
- optional token counts;
- deterministic-gate admission result.

It deliberately does **not** persist the API key or grant credibility to model-generated factual claims.

## Execution boundary

No repository workflow, cron, API route, Telegram handler, X adapter, OpenPost adapter, or product runtime invokes the OpenRouter writer in this slice.

An actual provider experiment is a separate explicit action after this code passes exact-head CI. It must use a dedicated bounded key/config and must still produce only shadow drafts.

## Acceptance

- safe structured copy survives the local parser and deterministic gate;
- BUILDING prompt injection cannot become LIVE;
- banned language downgrades the bundle;
- model cannot add lifecycle/decision fields;
- malformed markdown is rejected rather than repaired;
- channel limits fail closed;
- OpenRouter adapter uses strict structured output and no tools;
- provider failure gets one attempt only;
- every admitted bundle still has `publishAllowed=false`.
