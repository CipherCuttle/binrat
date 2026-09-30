import assert from 'node:assert/strict';
import test from 'node:test';
import {
  renderRatReply,
  renderRatReplyDetailed,
  validateCapabilityManifest,
  type CapabilityManifest
} from '../src/telegram/rat.js';

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

test('remote manifest failure revokes launch and marketing authority in replies', async () => {
  const authorizedLocal: CapabilityManifest = {
    ...manifest,
    launchAuthorization: {
      ...manifest.launchAuthorization,
      status: 'AUTHORIZED',
      marketingAuthorized: true,
      launchAuthorized: true,
      tokenState: 'LAUNCHED'
    }
  };
  const remoteConfig = { ...config, manifest: authorizedLocal, manifestMode: 'REMOTE_FAIL_CLOSED' as const };
  const fakeFetch: typeof fetch = async () => new Response('{}', { status: 503 });

  const reply = await renderRatReply('/token', remoteConfig, fakeFetch);
  assert.match(reply ?? '', /launch authorization: UNVERIFIED_REMOTE_STATUS/);
  assert.match(reply ?? '', /marketing authorized: NO/);
  assert.match(reply ?? '', /launch authorized: NO/);
  assert.match(reply ?? '', /token state: UNVERIFIED/);
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
    schemaVersion: 'binrat.creator-file/0.1',
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

test('bare token address resolves to its bag instead of pretending to be a creator', async () => {
  const launchId='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const fakeFetch: typeof fetch = async (input) => {
    const url=String(input);
    if (url.endsWith('/api/feed')) return new Response(JSON.stringify({
      schemaVersion: 'binrat.public-feed/0.1',
      bags: [{
        id: launchId,
        token: '0x1111111111111111111111111111111111111111',
        pool: '0x2222222222222222222222222222222222222222',
        reportedCreatorAddress: '0x3333333333333333333333333333333333333333'
      }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url.endsWith('/api/bag/'+launchId)) return new Response(JSON.stringify({
      schemaVersion: 'binrat.public-feed/0.1',
      asOfBlock: '500',
      historyCoverage: 'UNVERIFIED',
      bag: {
        id: launchId,
        symbol: 'RAT',
        name: 'Rat Bag',
        reportedCreatorAddress: '0x3333333333333333333333333333333333333333',
        trashTrail: { priorLaunchCount: 2, coverage: 'UNVERIFIED' }
      },
      receipt: { receiptId: 'binrat-public:'+'a'.repeat(64) }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('{}', { status: 404 });
  };

  const reply = await renderRatReply('rat 0x1111111111111111111111111111111111111111', config, fakeFetch);
  assert.match(reply ?? '', /RAT — Rat Bag/);
  assert.match(reply ?? '', /prior launches from same reported address: 2/);
  assert.doesNotMatch(reply ?? '', /Creator File/);
});

test('address with multiple indexed roles asks for disambiguation', async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
    schemaVersion: 'binrat.public-feed/0.1',
    bags: [{
      id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      token: '0x1111111111111111111111111111111111111111',
      pool: '0x2222222222222222222222222222222222222222',
      reportedCreatorAddress: '0x1111111111111111111111111111111111111111'
    }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const reply = await renderRatReply('rat 0x1111111111111111111111111111111111111111', config, fakeFetch);
  assert.match(reply ?? '', /multiple meanings/i);
  assert.match(reply ?? '', /REPORTED_CREATOR, TOKEN/);
});

test('Replay consumer rejects schema drift instead of synthesizing a timeline', async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
    schemaVersion: 'binrat.replay-bundle/99.0',
    stages: [{ label: '5m', status: 'COMPLETE' }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const reply = await renderRatReply('/replay aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', config, fakeFetch);
  assert.match(reply ?? '', /no replayable indexed launch/i);
  assert.match(reply ?? '', /violated the public API contract/i);
  assert.doesNotMatch(reply ?? '', /5m COMPLETE/);
});

test('reply metadata binds exact non-user-text answer plan to the rendered text', async () => {
  const detailed = await renderRatReplyDetailed('/token', config);
  assert.ok(detailed);
  assert.match(detailed!.planDigest, /^[0-9a-f]{64}$/);
  assert.equal(detailed!.answerPlan.intent, 'TOKEN');
  assert.equal(detailed!.answerPlan.schemaVersion, 'binrat.rat-answer-plan/0.2');
  assert.equal(JSON.stringify(detailed!.answerPlan).includes('/token'), false);
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
