# LLM Design Intelligence — professional judgment without an aesthetic prison

**Accepted direction:** give every coding LLM the *reasoning habits* of a good designer and actual approved screen/component exemplars, not an arbitrary giant style guide. **No global aesthetic is approved in this document.** The hybrid concept and Figma are accepted. A final theme, palette, typography and layout are TBD until the owner approves a complete interaction.

**Mandatory pre-Figma operating contract:** [PRE_FIGMA_AGENT_CONTRACT.md](PRE_FIGMA_AGENT_CONTRACT.md). Load the relevant skills, record actually available/invoked versions, frame the screen tasks, then critique the brief **before** any Figma file or canvas creation; no automatic opinionated style enforcement. Skill names in documentation do not mean they are installed in the next agent's environment.

## Three tiers, different authority

1. **Non-negotiable:** facts/provenance and coverage truth; usable keyboard/focus navigation; accessible alternatives for essential interactions; readable contrast, proper semantics; functional tap/CTA targets; responsive access; reduced motion. Apply objective tests and identify what still requires manual inspection.
2. **Strong defaults:** one clear immediate job per screen, coherent primary visual hierarchy, meaningful grouping and alignment, readable length and spacing, obvious next action, progressive disclosure of secondary material, consistently named actions. These are *informed heuristics*, not permanent shape/placement rules.
3. **Creative territory:** environmental artwork, delight, asymmetric compositions, expressive typography, story presentation, pixel-faithful animation, unusual but comprehensible visual metaphors. A convention may be broken when the task benefits and the resulting screen passes verification.

**Creative freedom by phase:** high for disposable visual studies; moderate when refining the owner-selected complete design; bounded when using approved design-system components across new pages; zero for invented financial/on-chain facts. The previous frontend failed in part by treating unapproved visual specifications as permanent authority. No tool gets to restore those deleted historical screens.

## The decision loop used for each page/component

1. **Identify the job:** exact user action and current stage (discover, investigate, compare, watch, recover from an error). Identify source facts available; use explicitly DEMO fixtures where source is missing.
2. **Retrieve only relevant pattern cards** (normally 1–3), not a massive all-purpose prompt. Also inspect adjacent approved Storybook components and Figma frames **once they exist**.
3. **Create a restrained and an expressive alternative** during exploration, both meeting functionality, accessibility and evidence requirements. Explain what each trades away in clear language; one may be deliberately asymmetric or surprising.
4. **Critique against the actual task** at mobile and desktop, not merely "looks premium." Evaluate scan path, the visible next action, information scent, readability, mental workload, aesthetic coherence and interaction.
5. **Build from source-backed data fixtures** with Svelte, real states, working CTA and reusable components; do not add new unrelated libraries to solve trivial layout decisions.
6. **Verify in browser:** screenshots and working journey, keyboard/focus, mobile text overflow, reduced motion, axe checks, error/partial/stale/unknown; one independent hostile review. Fix Critical/High and re-review once if needed. Document any consciously accepted heuristic exception.
7. **Record the approved result**, its source fixtures, Figma frame ID and Storybook story/screenshot; only then extract new tokens/variants. A failed experiment is not a new global rule.

## Contextual playbook cards — starting patterns

Each full card must retain: **user goal; default and rationale; common failure; when to break it; BINRAT example; mobile/accessibility checks; evidence states; acceptance test.** These are draft knowledge cards pending visual implementation, not exact design mandates.

| Problem | Default designer reasoning | Avoid | Valid exception / verification |
|---|---|---|---|
| Homepage hero / CTA | Recognizable product purpose, one dominant discovery, obvious next action and readable scan path | Generic two-button marketing hero or oversized rat hiding findings | A strong interactive rat-scanner can be the hero if meaning/action remain obvious within ~5 seconds |
| Launch story card | One factual headline, ≤3 observations, coverage/time, precise action | Metadata/metrics wall and unsupported "safe"/"insider" badges | Dense alternate mode for expert research, not the first-contact default |
| Primary actions | Label actual result, emphasize the most useful next move | Same visual weight on six competing CTAs; meaningless "Submit" | Two equal actions when user really has two equally valid tasks |
| Navigation | Stable mental model for Discover / Investigate / Traps / Watch, clear back paths | A mysterious fully graphical app shell and inconsistent mobile nav | Environmental hotspots are okay if ordinary discoverable navigation remains |
| Token investigation | Critical finding at top; tabs/sections for chronology, funding, trading and receipts | Homepage visual spectacle replicated throughout the data workspace | Small context-aware rat comment when it aids understanding |
| Metrics and thermometer | State metric definition, unit, period, sample/denominator and uncertainty | Singular "temperature" implying guaranteed next-token outcome; colored unlabelled bars | Expressive metaphor with visible exact factual description beside it |
| Historical chart | Consistent axis/unit, phase boundary, source/observation status and selected time window | Spiky sparse data portrayed as smooth complete history | Playful framing around an otherwise factual accessible chart/table |
| Funding diagram | Start with a simple directed evidence trail; expose links on click | Default giant bubble/Sigma graph implying owners | Expand Svelte Flow when >1 genuine connected funding path explains something |
| Watch/alert CTA | Show target, conditions, delivery channel, quota and success/error | Dead button or "instant alert" promise without measured latency | Rat-like names if action destination stays clear |
| Pricing / paywall | Demonstrate useful free value, explain exactly what metered extras buy | Blocking raw proofs or selling a performance prediction | Contextual paid prompt after a real watch/research limit |
| Empty/unknown/stale | Explicitly say what is unverified, last reliable block/time, what action still works | Blank page, green status for source failure, fictional fallback LIVE | The rat can be funny while remaining unambiguously honest |
| Motion / environmental art | One purposeful attention cue and faithful pixel-art rat; useful reduced-motion/static fallback | Looping every card, unreadable CRT overlays, canvas-only facts | Playful discovery animation when it doesn't delay meaningful access |

### The five questions when creating a hero

(1) Can a new visitor identify BINRAT's actual Pons value immediately? (2) Which one thing gets attention first? (3) What exactly happens when primary CTA is pressed? (4) Does the rat/illustration carry meaning rather than consume space? (5) Does the same hierarchy work at 320–430px and with reduced motion? No specified left/right illustration geometry or permanent typographic recipe.

## Useful external sources — inspect versions before adopting

**Professional methods:** [Nielsen Norman Group design guidance](https://www.nngroup.com/articles/), [GOV.UK Design System patterns](https://design-system.service.gov.uk/patterns/), [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/). The first two teach principles/patterns; WCAG is a testable accessibility standard. Don't confuse aesthetic preferences with law or objective defects.

**Creative:** [Anthropic frontend-design skill](https://github.com/anthropics/skills/tree/main/skills/frontend-design) — grounded visual identity, intentional typography/composition, critique. Review its exact current version and licence before adding to agent environments; do not let it override approved owner screenshots.

**Structured critique:** [Impeccable](https://github.com/pbakaus/impeccable) — repository inspected 2026-09-26 describes one AI design skill, shape/init/critique/audit/polish/clarify/distill/harden/adapt/live workflows and 61 deterministic detector rules (counts/version can change). Evaluate `shape` for design problem framing and `critique`/`audit` for expert and deterministic review. Its anti-pattern statements (e.g., specific fonts or easing disallowed) are **aesthetic opinions**, not inviolable BINRAT rules. **Don't enable automatic hooks or install wholesale before reviewing false positives**, Svelte behavior, trust/download model and relevant licence.

**Independent review candidate:** Microsoft's previously discussed frontend-design-review skill, if its current repository path/version and terms can be independently verified. Another coding LLM may review with our own checklist if that skill is unavailable. Use an independent reviewer to question hierarchy and usability, not invent a new visual style. Check [Microsoft skills repository](https://github.com/microsoft/skills) before any dependency decision.

**Browser:** [Vercel agent-browser](https://github.com/vercel-labs/agent-browser) and its exploratory/dogfood workflow, plus [Playwright](https://playwright.dev/) for repeatable user journeys and baseline screenshots. A browser agent must open the actual app, interact, take screenshots and report faults; textual assurance is insufficient.

**Components and visual tooling:** [Storybook SvelteKit](https://storybook.js.org/docs/get-started/frameworks/sveltekit) as working component lab and responsive/edge-state reference; Storybook MCP is an **experiment** because some Svelte component-manifest features have been limited/experimental. [Figma](https://www.figma.com/) is chosen for owner-approved visual intention; use Figma MCP and test Code Connect component mapping **with Svelte** rather than assume React documentation directly applies. [Bits UI](https://www.bits-ui.com/) provides unstyled accessible primitives, not a ready-made visual identity.

**Alternative UI systems:** shadcn-svelte, Tailwind utilities, Rive, generic UI themes and prefab landing-page generators can be explored in disposable branches only if they resolve a concrete need; no design authority through mere installation. React/TypeScript is a fallback candidate if a Svelte bakeoff fails. Exotic frameworks explored earlier (Rust/Dioxus/Leptos, Phoenix LiveView, Flutter, Gleam, Godot, Elm etc.) are **not** chosen dependencies.

## What goes into the repository after visual approval

- Approved Figma file/frame IDs and dated journey screenshots with identical fixture identifiers.
- `Storybook` stories for every shared component: populated, partial, empty, stale, loading, error, long-label, focused, keyboard, reduced-motion, dense/sparse and mobile.
- Small semantic design variables for text, surfaces, focus, states and spacing **extracted from the approved screens**; reusable typography roles and component variants, not an imposed prefab CSS theme.
- A concise `DESIGN.md` *generated from living implementation*, plus a dated exception/change ledger. LLM agent instructions link to these living artifacts rather than embedding hundreds of hardcoded personal opinions.
- Component-based regression verification and owner visual review. Screenshots can establish no unexpected drift, but they never prove the original design was good.

**Acceptance for another LLM:** give it an approved component library and a new screen task. It should independently produce a cohesive but not cloned screen, verify responsive behavior and make an explicit case for any intentional design exception.
