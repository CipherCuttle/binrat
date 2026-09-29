# Autonomous Rat V1 — exact local fixture conversation

This is a deterministic synthetic fixture, not live chain activity or a Telegram send.
It runs the actual Worker webhook, D1-compatible SQL, Queue handler and receipt reconstruction
against a fake Telegram transport. No production secrets, chain writes or remote migration.

Reproduce:

```sh
BINRAT_PRINT_FIXTURE=true pnpm exec tsx --test --test-name-pattern='deterministic DIG' test/autonomousRat.test.ts
```

Assertions: one shared recurrence finding; attention ALERT; one sent receipt; replay emits
no second alert; unwatch cancels future attention. Sender 77 is a synthetic test principal.

```text
SYNTHETIC LOCAL FIXTURE — not a production claim.

USER 77 → /dig 0x000000000000000000000000000000000000002a

BINRAT → 77
🐀 dug through it.

Arc 5042 · CREATOR 0x000000000000000000000000000000000000002a

OBSERVED: ArcPad reported creator 0x000000000000000000000000000000000000002a
launch 72f95a83d6442cae8a160f44b15d94f9bffa9577509be97a6da6d7febff7cc0f
block 100 · tx 0x0000000000000000000000000000000000000000000000000000000000002774 · log 0

DERIVED: 1 referenced launch record(s) match this subject.

Coverage: PARTIAL · indexed ArcPad launches only · up to 5 records · as of block 100.

UNKNOWN: human identity, intent, safety and future outcome. Same address != same human identity.

caseId: d091bf96f97a89b138f2a4c48a9e177a1db88692b1b33a3a4515431871857b8f

shareId: d091bf96f97a89b138f2a4c48a9e177a1db88692

/why d091bf96f97a89b138f2a4c48a9e177a1db88692b1b33a3a4515431871857b8f

/watch 5042:CREATOR:0x000000000000000000000000000000000000002a

USER 77 → /watch 0x000000000000000000000000000000000000002a

BINRAT → 77
🐀 watch armed.
5042:CREATOR:0x000000000000000000000000000000000000002a
Future launches only, after block 102. Existing watches keep their original boundary.
Same address != same human identity.

FIXTURE EVENT: new canonical launch at block 105, after watch boundary 102.

BINRAT → 77
🐀 FOUND SOMETHING.

Arc 5042 · CREATOR 0x000000000000000000000000000000000000002a

OBSERVED: ArcPad reported creator 0x000000000000000000000000000000000000002a
launch b9de13ddd6d0c18920be5afe5b2e546c94220c0e7bba59eb24cdf7f2f118c2f0
block 105 · tx 0x0000000000000000000000000000000000000000000000000000000000002779 · log 0

DERIVED: the reported creator exactly matches your explicit future watch.

Coverage: PARTIAL · indexed ArcPad launches only · up to 5 records · as of block 105.

UNKNOWN: human identity, intent, safety and future outcome. Same address != same human identity.

caseId: de98a12829ba7de354dbed4f2c7882a0788aec39d2b6ed2c1dae3422d04822de

shareId: de98a12829ba7de354dbed4f2c7882a0788aec39

/why de98a12829ba7de354dbed4f2c7882a0788aec39d2b6ed2c1dae3422d04822de

USER 77 → /why de98a12829ba7de354dbed4f2c7882a0788aec39d2b6ed2c1dae3422d04822de

BINRAT → 77
🐀 receipts, not guesses.

Arc 5042 · CREATOR 0x000000000000000000000000000000000000002a

OBSERVED: ArcPad reported creator 0x000000000000000000000000000000000000002a
launch b9de13ddd6d0c18920be5afe5b2e546c94220c0e7bba59eb24cdf7f2f118c2f0
block 105 · tx 0x0000000000000000000000000000000000000000000000000000000000002779 · log 0

DERIVED: 1 referenced launch record(s) match this subject.

Coverage: PARTIAL · indexed ArcPad launches only · up to 5 records · as of block 105.

UNKNOWN: human identity, intent, safety and future outcome. Same address != same human identity.

caseId: de98a12829ba7de354dbed4f2c7882a0788aec39d2b6ed2c1dae3422d04822de

shareId: de98a12829ba7de354dbed4f2c7882a0788aec39

source: 4d7dc912e3583b38c14b304e67bee0b896ecb97b4f49e8d33ea68f43c46d8fd0
fact: binrat-fact:5042:b9de13ddd6d0c18920be5afe5b2e546c94220c0e7bba59eb24cdf7f2f118c2f0
digest: 874b9e9c29e9801e2d020801879c0de2d6353135765a595b8b43a982191a6f7f
block hash: 0x0000000000000000000000000000000000000000000000000000000000000069

DERIVED (private attention): exact reported creator matched your explicit watch; event block > 102.
OBSERVED at delivery: canonical event block time 1790640001000ms.
DERIVED: event time > watch creation 1790640000000ms.

USER 77 → /unwatch 0x000000000000000000000000000000000000002a

BINRAT → 77
🐀 stopped watching 5042:CREATOR:0x000000000000000000000000000000000000002a. Pending notifications suppressed.

REPLAY: no additional alert. UNWATCH: block 110 emitted no alert.
```

