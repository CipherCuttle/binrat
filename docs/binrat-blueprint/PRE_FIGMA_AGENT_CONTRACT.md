# G1a — Mandatory pre-Figma design-agent operating contract

**Status:** Accepted process correction on 2026-09-26 (Stockholm), based on owner request: make LLM design skills/process active **before** any Figma canvas exploration. This is a behavior and verification contract, **not** an aesthetic style guide. It grants no production coding, install, merge or deployment authority.

## Objective and pass/fail

Before creating a BINRAT Figma file or its first design frame, the assigned design agent must demonstrate that it has understood the product, accessed the applicable professional design skills and produced a concise, task-specific creative brief. A statement such as "I'll follow best practices" is **not** evidence of this gate passing.

**Artifacts (short, practical, no bureaucracy):**
1. `PREFIGMA_BRIEF.md` or equivalent approved document: exact user jobs, screens/flows, shared frozen token data, LIVE/DEMO/UNKNOWN rules, original rat master reference, mobile scenarios, proposed competing design ideas, what must be comprehensible in five seconds and why.
2. `SKILL_RUN_LOG.md` or equivalent manifest: exact skill source/commit/version and URL; whether genuinely **loaded** by this agent, merely **read**, unavailable, or tested; role in this task; conflicts/false-positive risks; any tool installation/hook permission. Never claim a skill ran because a repository document merely names it.
3. A **one-page hierarchy and interaction rationale** per proposed hybrid variant (not a palette or full design system), with explicit departures from relevant professional defaults and their intended user benefit.
4. A short **independent critique** against the same scenario: obvious user task, primary CTA, grouping, mobile reading order, unknown-data handling, accessibility and expected loading/interaction. Resolve functional contradictions before drawing Figma frames; purely aesthetic disagreement remains open for visual exploration.

The initial skill preflight is accepted when the above artifacts are present, source-specific, coherent and have no material contradictions. Exact typography, palette, geometry, specific mascot animation and tokens remain **unselected**. The owner separately approves finished Figma screens at G2.

## Mandatory agent skill sequence

| Stage | Skill or source | Mandatory action | Why / important limits |
|---|---|---|---|
| Product context | This blueprint, especially DIRECTION, LEDGER, PRODUCT_AND_EVIDENCE, HYBRID_FIGMA_UX | Read before creative generation; verify current repo exact PR heads and locate **original approved rat** asset | Old rejected bento/G2/North Star art has no authority; three launch receipts are not live wallet intelligence |
| Creative design | [Anthropic frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Load or explicitly read a checked source version and use it to shape the three distinctive whole-screen hybrids; record how its advice applies | The agent must not mistake its aesthetic defaults for universal laws or disregard user-approved rat/UX |
| Design reasoning and critique | [Impeccable](https://github.com/pbakaus/impeccable) | Inspect/pin compatible version & licence. Use **shape**, **critique** and later **audit** where actually installed; for an uninstalled environment, explicitly apply its documented questions as a manual rubric, not as though the executable ran | Don't blindly install an unchecked downloaded binary, apply automatic hooks or enable opinionated rules (fonts/easing/card bans) before approving exceptions |
| Professional defaults | [NN/g](https://www.nngroup.com/), [GOV.UK patterns](https://design-system.service.gov.uk/patterns/), [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Select only relevant principles for the current page and write **default → reason → common failure → justified exception → concrete test** for 1–3 actual UI problems | Accessible and truthful behavior is obligatory; attractive layout conventions are defaults rather than hard positioning rules |
| Independent criticism | A *separate* UX review agent, with a verified current review skill if available | Review proposed information hierarchy and journey with identical fixtures before Figma | No reviewer may override owner-approved aesthetic by inventing a new permanent theme |
| Figma file creation | Installed `figma-create-new-file` skill | **Load before** `create_new_file`; choose actual plan/file; record created file key | No file exists until real tool output verifies it |
| Figma canvas writes | Installed `figma-use` skill, plus `figma-generate-design` for full-screen composition | **Load before** canvas operations, obey actual Figma MCP tool contracts, return frame IDs/screenshots | For a brand-new, unapproved design, do not import a random design system or hardcode permanent tokens |
| Figma → implementation | Installed `figma-design-to-code` + Svelte relevant docs (AFTER G2) | Load before reading design context/implementing approved Figma; manually verify Svelte Code Connect support | Don't start production Svelte code before visual owner approval |
| Browser validation | Installed [agent-browser](https://github.com/vercel-labs/agent-browser), [Playwright](https://playwright.dev/), axe-core (during disposable prototype and G3) | Load applicable browser skill before interaction, take **actual** screenshots and test real user actions | Screenshot equality is drift prevention, not a quality judgment about the initially approved design |
| Reusable component library | Figma `figma-generate-library`, Storybook for SvelteKit (AFTER G2) | Extract variants and tokens from **approved completed screens only** | Not a pre-Figma global visual library |

### Skill versions and installation trust

Published upstream skills change. Before installing anything for Claude Code/Codex/another frontend orchestrator, capture the precise source commit/tag, inspect instructions and licences, review install scripts/downloaded binaries/hooks and pin the approved version. A GitHub URL in a Markdown file does not install or activate a skill. Different agents use different skill directories/triggers; verify the **actual target coding environment** has loaded the selected skill and log its result.

When a recommended external skill is unavailable, **do not pretend it ran and do not block all conceptual design forever**: use the documented principles with a transparent "manual equivalent" record, and mark any plugin-specific actions as unavailable until installed. Figma tool-specific prerequisites are strict: if the specific Figma operation's mandatory installed skill is unavailable, do not invoke that operation.

Do not stack two creative skills with conflicting absolute aesthetic instructions on the same generation step. **Anthropic = exploratory art direction; Impeccable = reasoned shaping, critique and later auditing; browser = observable verification; owner = visual authority.** If a heuristic contradicts a tested user goal or previously approved frame, document the exception and compare alternatives.

## Pre-Figma short task script

Freeze one Pons V2 launch scenario and separate factual receipts from fictional funding/pricing demonstration. For each of **Dumpster Workshop**, **Underground Intelligence Bureau**, **Living Case File**, articulate:
- One dominant finding and 5-second first impression.
- The exact investigation and Rat Trap route, three most important observations and primary action.
- How the same design deals with partial/unknown funding, stale sources and an immature historical cohort.
- Its distinctive artistic hypothesis and likely failure mode.
- Its mobile reading order at 320/360/390/430 CSS px, keyboard/reduced motion and how the rat retreats from home to investigation.
- A deliberately unconventional design choice, with its tradeoff and acceptance test.

Then independent critique **once**. Fix functional, truth and accessibility failures. Do not erase all distinctive creative ideas because reviewers disagree on taste. When the preflight passes, start the three Figma visual studies with the original approved rat; **do not freeze the shared token system until the owner selects a coherent whole-screen treatment**.

## Proof and handoff

The agent's handoff must cite this gate, the skill-run manifest with its actual loaded/read status, the preflight brief, source fixtures, rat artwork pointer, identified unresolved tool/asset blockers and **explicit owner/production authority state**. No "skill compliant" self-assertion without artifacts. A different agent should be able to execute G2 without reconstructing these choices from chat history.
