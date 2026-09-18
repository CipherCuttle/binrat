import assert from 'node:assert/strict';
import test from 'node:test';
import { renderRatReply } from '../src/telegram/rat.js';

const config = {
  apiBaseUrl: 'https://api.example.test',
  siteUrl: 'https://binrat.example.test'
};

test('token answer is explicit that no token is launched', async () => {
  const reply = await renderRatReply('/token', config);
  assert.match(reply ?? '', /No \$BINRAT token is launched/);
  assert.match(reply ?? '', /not equity, revenue share, yield/i);
});

test('natural-language roadmap question resolves without model inference', async () => {
  const reply = await renderRatReply('binrat what is next on the roadmap?', config);
  assert.match(reply ?? '', /Trash DNA/);
  assert.match(reply ?? '', /Rat Credits/);
});

test('status is grounded in public health API', async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
    indexReady: true,
    launchCount: 12,
    checkpointBlock: '12345',
    historyBackfillComplete: false,
    observationReady: true,
    lastSyncError: null,
    lastObservationError: null
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const reply = await renderRatReply('/status', config, fakeFetch);
  assert.match(reply ?? '', /index: READY/);
  assert.match(reply ?? '', /launches indexed: 12/);
  assert.match(reply ?? '', /IN PROGRESS \/ UNVERIFIED/);
});

test('invalid creator address fails before network lookup', async () => {
  let calls = 0;
  const fakeFetch: typeof fetch = async () => {
    calls += 1;
    throw new Error('should not fetch');
  };
  const reply = await renderRatReply('/creator nope', config, fakeFetch);
  assert.match(reply ?? '', /invalid creator address/i);
  assert.equal(calls, 0);
});

test('creator answer preserves identity boundary and receipt', async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
    reportedCreatorAddress: '0x1111111111111111111111111111111111111111',
    indexedLaunchCount: 3,
    firstIndexedBlock: '100',
    lastIndexedBlock: '300',
    historyCoverage: 'UNVERIFIED',
    receipt: { receiptId: 'binrat-creator:abc' }
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const reply = await renderRatReply('/creator 0x1111111111111111111111111111111111111111', config, fakeFetch);
  assert.match(reply ?? '', /indexed launches: 3/);
  assert.match(reply ?? '', /binrat-creator:abc/);
  assert.match(reply ?? '', /not proof of common human identity/i);
});

test('irrelevant ordinary chat is ignored', async () => {
  assert.equal(await renderRatReply('wen moon?', config), null);
});
