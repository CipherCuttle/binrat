# BINRAT FRONTEND V2 AUDIT

Status: Product Surface V1 audit at source head `b1b25e3bbd08189e7e913ef16768841ba7cb5296`
Scope: presentation architecture only; no backend, API, token-authority, or production-frontend migration.

## Executive finding

The public frontend has a memorable visual identity and unusually disciplined evidence language, but its product model is still WEB V0: one long marketing/feed page and one modal. The backend has become a network of durable objects—bags, Creator Files, replay stages, radar candidates, watch subscriptions, ledger entries, and capability states—while the frontend still treats most of those objects as expansions of a launch card.

The primary V1 correction is routing and hierarchy, not more intelligence. A launch becomes the entry to an exploration loop:

`LAUNCH → BAG → CREATOR → HISTORY → REPLAY → RADAR → WATCH`

## KEEP

- `web/styles.css:19-33` establishes the recognizable asphalt, dumpster green, dirty bone, muted orange, and semantic accent palette. Preserve these values as named design tokens.
- `web/index.html:70-119` communicates the rat/dumpster metaphor in seconds. `HOT GARBAGE`, the approved mascot, and “He gets the scraps. You get the receipts.” remain valuable acquisition language.
- `web/data-source.js` is the correct browser authority boundary. It validates public schemas and fails closed instead of allowing views to interpret raw backend state ad hoc.
- `web/evidence-semantics.css` and the normalizers in `web/app.js:767-775` are the beginning of a coherent evidence-semantic system.
- The language “ArcPad-reported creator address,” the identity boundary in the drawer, and the replay statement that nothing is simulated preserve the product doctrine.
- `web/app.js:708-759` provides real modal focus containment, Escape handling, and focus restoration.
- Local Plex Mono and Plex Condensed fonts, square industrial controls, thin rules, dense tables, physical receipt treatments, and the approved mascot create a distinctive world.
- `scripts/check-web.mjs` protects brand asset hashes, source boundaries, schemas, evidence terms, and prohibited claims. V2 needs equivalent checks.

## REWORK

- `web/index.html` is 432 lines and `web/styles.css` is 2,946 lines because homepage, feed, method, ledger, token status, drawer, responsive behavior, React Bits treatments, and launch presentation all share one document cascade. Split by product destination, not merely by visual section.
- `web/app.js` is a 784-line controller that performs fetch orchestration, validation-adjacent normalization, HTML templating, state, focus management, filtering, image fallback, share tooling, and navigation-like behavior. Preserve the behavior, but move it into typed route screens and focused components.
- The bag drawer hydrates Bag Intelligence, Creator File, and Replay (`hydrateBagIntelligence`, `hydrateCreatorFile`, `hydrateReplayLab`) after opening. These are first-class product objects; the bag should be a deep-linkable dossier and each downstream object should offer a clear next action.
- The homepage combines acquisition story, full launch browser, method documentation, ledger, and token status. It should become story plus live proof, with the application immediately available through persistent navigation.
- `web/react-bits-island.js` is acceptable prototype enhancement, but pointer spotlight behavior is not a product-state motion language. Replace it over time with restrained transitions and a mascot state adapter driven by indexing/evidence state.
- Ledger and `$BINRAT` currently compete for attention on the same long page. Separate financial transparency from token status/utility so each can state present versus planned authority precisely.

## REMOVE

- Remove duplicated or accumulated cascade overrides from the V2 architecture. `web/styles.css` contains a second `:root` at line 1950 and additional breakpoint families appended after earlier ones; do not carry this layering pattern forward.
- Remove “everything is a section on home” as the product navigation model.
- Remove modal-only URLs for meaningful evidence. A copied link must restore the same bag, creator, replay, or radar context.
- Remove ornamental animation that has no state meaning. Spotlight/pointer effects may remain in production V0 but do not belong in the V2 core contract.
- Remove duplicate product explanation at every depth. Keep the compact boundary beside the evidence it governs, with one expanded methodology destination.
- Remove generic metric-tile thinking. Counts should sit inside the instrument they qualify rather than become detached dashboard trophies.

## MISSING

- Rat Radar has live public APIs (`/api/rat-radar/watchlist`, public activity receipts, and address activity) but no web destination. This is the largest hidden capability and should be the flagship interface.
- Rat Watch is operational through Telegram subscriptions but has no contextual web action from a creator/address/bag surface.
- Creator Files are only hydrated inside the drawer and have no canonical `/creator/:address` URL.
- Replay Lab is a drawer subsection instead of an interactive, point-in-time route at `/replay/:id`.
- Dumpster Ledger has a long homepage block, not an auditable financial-transparency destination with entry chronology and receipt drill-down.
- Holder Gate has no presentation boundary explaining that it can change depth/speed/scale but not public factual truth. It must remain visibly inactive until token authority exists.
- There is no persistent receipt rail carrying checkpoint, coverage, receipt identifier, and observation authority between evidence views.
- Share tooling exists for bags but the route architecture cannot reliably recreate shared application state.

## MOBILE

- At `max-width: 760px`, the production feed and every homepage section stack into a long document. The result preserves content but not task priority.
- The drawer is usable, but it contains evidence, Creator File, replay, share controls, and nested launch actions in one vertical overlay; users lose their position and sense of progress.
- The desktop header/navigation collapses, but it still reflects homepage anchors rather than the core loop.
- Dense receipt IDs and full addresses need explicit wrapping/copy affordances; relying on generic wrapping risks horizontal overflow.
- V1 mobile should use a persistent five-destination bottom rail, compact checkpoint header, one primary object per screen, and contextual next actions. The critical loop is `latest launch → bag → creator history → replay/watch`.

## ACCESSIBILITY

- Keep the existing skip link, `:focus-visible` treatment, Escape close, focus containment, focus restoration, and reduced-motion media query.
- Convert clickable feed articles using `role="button"` into native buttons or links. Native navigation is more reliable for keyboard, assistive technology, context menus, and copied URLs.
- Route changes must move focus to the page heading/main region and expose a stable `<main>` landmark.
- Evidence colors must never be the only carrier of meaning; render state text and a shape/marker together.
- Radar selection requires `aria-live` or a controlled detail region, and replay stages should use tab semantics with `aria-selected`.
- Mobile navigation labels cannot become icon-only. The visual language intentionally avoids stock icons; short text labels are clearer.
- The approved mascot needs descriptive alt text when informative and empty alt text only when repeated decoration.

## PERFORMANCE

- The approved hero asset is 256,890 bytes at 1100×1100 and is suitable for a primary hero, not every route. Reuse the cached file and avoid duplicating it in bundles.
- The three local WOFF2 subsets total 43,848 bytes and are appropriate; preload only the face needed above the fold.
- V2 adds React/Vite, but should keep the dependency surface to React, React DOM, Vite, TypeScript, and the React Vite plugin. No router, charting library, component kit, icon pack, or animation runtime is required for the thin demo.
- Lazy route chunks are a later optimization. The V1 priority is separating product surfaces and keeping data adapters strict.
- Avoid requesting Bag Intelligence, Creator File, Replay, and Radar for every feed row. Fetch on destination/intent and cache validated projections.
- Final Rive artwork should load on states/surfaces that use it, and the static WebP fallback must remain available.

## PRODUCT CONFUSION

- The page opens as a strong campaign site but does not immediately reveal that BINRAT is already an explorable evidence product.
- “HOT GARBAGE” is memorable but must sit beside the literal promise: new launches, reported creator recurrence, point-in-time evidence, and receipts.
- Creator history, replay, and intelligence appear as progressively loaded drawer panels without a visible journey or next step.
- Rat Radar’s absence prevents users from discovering the most repeatable daily-return behavior: inspect unusual recurrence and timing, then watch it.
- The ledger and token sections can be read as launch marketing unless current state, planned utility, and legal authorization are separated.
- Coverage is displayed, but the relationship among checkpoint, sample size, missing history, and receipt authority is not persistent.

## Ten-stack conclusion

| Lens | Current state | V1 response |
|---|---|---|
| Product | Capabilities exceed surfaces | First-class routes for existing capabilities |
| Journey | Feed → drawer → long scroll | Explicit exploration loop and next action |
| IA | Homepage is the application | Persistent shell plus deep links |
| Identity | Distinctive and worth keeping | Refine, do not sanitize |
| Assets | One approved mascot family plus fonts | Define bounded coherent queue |
| Motion | Pointer/entrance prototype | Product-state contract with static fallback |
| Data visualization | Strong tables, weak longitudinal objects | Recurrence strip, evidence stack, replay rail |
| Engineering | Correct adapter, oversized controller/cascade | Typed isolated React/Vite app |
| Trust | Strong copy invariants | Semantic components plus automated checks |
| Distribution | Share card exists, routes lag | Stable dossier/replay/radar URLs |
