import assert from 'node:assert/strict';
import test from 'node:test';
import { renderRatReply, validateCapabilityManifest, type CapabilityManifest } from '../src/telegram/rat.js';

const manifest: CapabilityManifest = {
  schemaVersion: 'binrat.capability-manifest/0.1',
  capabilities: {
    intelligenceV1: { engineeringStatus: 'ENGINEERING_PASS', publicStatus: 'NOT_PUBLIC_LIVE_AUTHORIZED' },
    replayLab: { engineeringStatus: 'BUILDING', publicStatus: 'NOT_PUBLIC_LIVE_AUTHORIZED' },
    telegramRatV0: { engineeringStatus: 'BUILDING', publicStatus: 'NOT_PUBLIC_LIVE_AUTHORIZED' },
    dumpsterLedger: { engineeringStatus: 'PLANNED', publicStatus: 'NOT_PUBLIC_LIVE_AUTHORIZED' },
    ratDenV0: { engineeringStatus: 'PLANNED', publicStatus: 'NOT_PUBLIC_LIVE_AUTHORIZED' },
    ratWatchV0: { engineeringStatus: 'PLANNED', publicStatus: 'NOT_PUBLIC_LIVE_AUTHORIZED' },
    dumpsterRaidsV0: { engineeringStatus: 'EXPERIMENTAL', phase: 'POST_LAUNCH' }
  },
  launchAuthorization: {
    status: 'BLOCKED',
    marketingAuthorized: false,
    launchAuthorized: false,
    tokenState: 'NOT_LAUNCHED'
  },
  invariant: 'Degen can decide attention and priority. It cannot decide what is true.'
};

const config = {
  apiBaseUrl: 'https://api.example.test',
  siteUrl: 'https://binrat.example.test',
  manifest
};

test('token answer is sourced from fail-closed launch authorization', async () => {
  const reply = await renderRatReply('/token', config);
  assert.match(reply ?? '', /token state: NOT_LAUNCHED/);
  assert.match(reply ?? '', /launch authorization: BLOCKED/);
  assert.match(reply ?? '', /marketing authorized: NO/);
  assert.match(reply ?? '', /launch authorized: NO/);
  assert.match(reply ?? '', /not equity, revenue share, or yield/i);
});

test('roadmap answer reports canonical capability states instead of hard-coded shipped claims', async () => {
  const reply = await renderRatReply('binrat what is next on the roadmap?', config);
  assert.match(reply ?? '', /Intelligence V1: ENGINEERING_PASS/);
  assert.match(reply ?? '', /Replay Lab: BUILDING/);
  assert.match(reply ?? '', /Telegram Rat V0: BUILDING/);
  assert.match(reply ?? '', /Dumpster Raids V0: EXPERIMENTAL/);
  assert.match(reply ?? '', /launch authorization: BLOCKED/);
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
  assert.match(reply ?? '', /Telegram Rat capability: BUILDING/);
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

test('manifest validator fails closed on malformed launch authorization', () => {
  assert.throws(
    () => validateCapabilityManifest({
      ...manifest,
      launchAuthorization: { status: 'BLOCKED', marketingAuthorized: 'no', launchAuthorized: false }
    }),
    /CAPABILITY_MANIFEST_INVALID/
  );
});
