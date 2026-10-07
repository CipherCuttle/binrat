# CS01 regression receipt

Base: `fa23aa77b8c0cf15ca5f3e0f5d5f5638f1da9cd1` (PR #122).

Before implementation, the following commands reproduced nine failing tests:

```sh
node --test --test-name-pattern='regression:' test/readPlane.test.mjs
./node_modules/.bin/tsx --test --test-name-pattern='regression:' test/publicReadPlaneStability.test.ts
```

Browser contract: 0/6 passed. Adaptation lost binding fields; initial loading
emitted FRESH before status; same-checkpoint conflicts were accepted; tampered
material remained fresh; retry discarded availability of retained evidence;
NO_VERIFIED_SNAPSHOT accepted contradictory binding fields.

Server contract: 0/3 passed. Embedded digest corruption was accepted;
same-checkpoint conflicting publication replaced the row; unknown API routing
performed seven database statements before returning 404.

These are local reproductions, not a production launch-readiness verdict.
