# A1.1 targeted hostile self-review

Scope: reviewed base `3aedca9d2ea9bfca1aa66d54aab3c8b86df8ef2b`, four changed runtime files, historical source contract, compiled Chromium mobile/desktop and negative states. This is one bounded self-review, not independent owner approval.

- Critical launch blocker: V0 historical response returns one bag but the output digest covers all projected bags. Canonical launch/fact material and membership binding to the latest publication are absent. A syntactically valid receipt is insufficient. Stop verified historical rehydration; disclose the contract gap. Never merge counts (recorded current-feed count 38, historical projection 19 for the original Case).
- High H1: inherited tablet CSS `order: 3` reverses the mobile source-status and Recheck row. Initial geometry checks missed the reversed horizontal placement. Reset order, pin Recheck to the right, and assert row order in both phone widths.
- High H2: the delayed-source navigation test originally waited for networkidle before navigating, so it did not exercise cancellation. Navigate while `CHECKING` is present, select a current Case, then confirm the delayed response cannot alter it.
- High H3: the 64-character requested identity and diagnostic error codes overflow the historical/unavailable surfaces. Wrap both; assert no document overflow for historical-source, unavailable, projection-mismatch and checkpoint-mismatch views.
- Test issue: recovery assertions initially raced the asynchronous React state update and later treated an expired recorded fresh status as perpetually fresh. Wait for the expected read state and honor the original TTL. No application validator was relaxed.

No unvalidated bag fields, projected counts, or feed digests appear as historical Case evidence. No backend, dependency/lockfile, art, UI library, merge or production mutation was added. Apply the targeted fixes and run one rereview.
