import assert from 'node:assert/strict';
import test from 'node:test';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const now = Date.UTC(2026, 8, 25, 12);
const path = 'https://candidate.example/__candidate/rat-smoke';
const secret = 's'.repeat(48);
const auth = () => new Request(path, {
  method: 'POST', headers: { 'x-binrat-candidate-secret': secret }
});

test('candidate smoke is default-off, secret-gated, and one-shot with observed token usage', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  let calls = 0;
  const ai = {
    run: async () => {
      calls += 1;
      return {
        response: '{"kind":"BANTER","text":"found a crusty little snack."}',
        usage: { prompt_tokens: 240, completion_tokens: 48, total_tokens: 288 }
      };
    }
  };
  try {
    const off = await handleWorkerRequest(auth(), { DB: db, AI: ai }, {
      now: () => now, externalFetch: fetch
    });
    assert.equal(off.status, 404);
    assert.equal(calls, 0);

    const env = {
      DB: db, AI: ai,
      RAT_CANDIDATE_SMOKE_ENABLED: 'true',
      RAT_CANDIDATE_SMOKE_SECRET: secret,
      TELEGRAM_REPLIES_ENABLED: 'false',
      RAT_AI_ENABLED: 'false'
    };
    const denied = await handleWorkerRequest(new Request(path, { method: 'POST' }), env, {
      now: () => now, externalFetch: fetch
    });
    assert.equal(denied.status, 401);
    assert.equal(calls, 0);

    const ok = await handleWorkerRequest(auth(), env, { now: () => now, externalFetch: fetch });
    assert.equal(ok.status, 200);
    const info = await ok.json() as Record<string, unknown>;
    assert.equal(info.modelReturnedValidBanter, true);
    assert.deepEqual(info.reportedTokenUsage, {
      prompt_tokens: 240, completion_tokens: 48, total_tokens: 288
    });
    assert.equal(info.estimatedNeuronsFromReportedTokens, 3.067);
    assert.equal(info.actualBilledNeurons, null);
    assert.equal(calls, 1);
    const duplicate = await handleWorkerRequest(auth(), env, { now: () => now, externalFetch: fetch });
    assert.equal(duplicate.status, 409);
    assert.equal(calls, 1);
  } finally { db.close(); }
});

test('smoke refuses unavailable AI and cannot be invoked twice on failed output', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  let calls = 0;
  const env = {
    DB: db, AI: { run: async () => { calls++; throw new Error('NO_CAPACITY'); } },
    RAT_CANDIDATE_SMOKE_ENABLED: 'true', RAT_CANDIDATE_SMOKE_SECRET: secret
  };
  try {
    const response = await handleWorkerRequest(auth(), env, { now: () => now, externalFetch: fetch });
    assert.equal(response.status, 503);
    assert.equal(calls, 1);
    assert.equal(
      (await handleWorkerRequest(auth(), env, { now: () => now, externalFetch: fetch })).status, 409
    );
    assert.equal(calls, 1);
  } finally { db.close(); }
});

test('default-off route cannot access AI even with a valid shared candidate secret', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const response = await handleWorkerRequest(auth(), {
      DB: db, AI: { run: async () => { throw new Error('MUST_NOT_RUN'); } },
      RAT_CANDIDATE_SMOKE_SECRET: secret
    }, { now: () => now, externalFetch: fetch });
    assert.equal(response.status, 404);
  } finally { db.close(); }
});
