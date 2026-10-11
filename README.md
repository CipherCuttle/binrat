# BINRAT — repository orientation

**Founder north star: [A crew of Rats users can actually employ](docs/BINRAT_FOUNDER_NORTH_STAR.md).**

**Agent operating rules: [bounded execution, kill criteria and retries](docs/AGENT_WORK_POLICY.md).**

BINRAT's selected product direction is a bounded workforce of specialized crypto-investigation Rats. **Rat Zero** finds Pons V2 launches and opens Cases; **Tripwire** is a future-event Watcher under owner-pilot verification; **Sniffer** investigates funding trails and exchanges typed handoffs; the **Den** will organize jobs. The user journey is **FIND → EMPLOY → LEAVE → RETURN**. User-facing truth comes from verified deployment/source evidence, not merely these docs.

**This GitHub \`main\` tree is an older ArcPad/backend-only baseline.** It is not the current production source, approved React V3 art, live Pons 4663 Worker or latest token-launch plan. The historic backend-only language below is context for this tree only; it does **not** override the founder vision or authorize discarding newer UI, branding or workforce work. Browser-based agents must reconcile the active PR/production authority before suggesting implementation.

## Historical default-branch baseline

The original ArcPad indexer stored deterministic launch identity and provenance in SQLite, supported replay/reorg handling and command-line backfill, watch and inspection:

\`\`\`sh
cp .env.example .env
pnpm install
pnpm check
pnpm backfill
pnpm watch
pnpm inspect 0xTOKEN
\`\`\`

Its evidence boundaries remain in \`docs/CLAIM_BOUNDARY.md\` and \`docs/PUBLIC_READ_PLANE.md\`. Later Pons/Cloudflare/frontend/workforce implementations live on separately reviewed branches and PRs. No local checkout, doc edit or green CI confers production deployment, wallet, signing, capital, token-launch or capability-promotion authority.

For source history and exact canon follow the links in [Founder North Star](docs/BINRAT_FOUNDER_NORTH_STAR.md).
