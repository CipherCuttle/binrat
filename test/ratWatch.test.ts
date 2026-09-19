import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import {
  D1RatWatchStore,
  ratWatchAlertText
} from '../src/cloudflare/ratWatch.js';
import { runCloudflareRatWatchCycle } from '../src/cloudflare/syncQueue.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const CHAIN_ID = 5042;

test('Rat Watch starts after subscription block and enqueues each future launch once', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const launches = new D1Store(db, CHAIN_ID);
  const watches = new D1RatWatchStore(db);
  const creator = address(5);

  try {
    await launches.putLaunch(await makeLaunch(100n, 1, creator));
    assert.equal(await watches.subscribe(77, creator, 100n, 1_000), 'INSERTED');
    assert.equal(await watches.subscribe(77, creator, 100n, 1_001), 'DUPLICATE');
    assert.equal(await watches.enqueueRecurrenceAlerts(CHAIN_ID, 1_100), 0);

    const second = await makeLaunch(200n, 2, creator);
    await launches.putLaunch(second);
    assert.equal(await watches.enqueueRecurrenceAlerts(CHAIN_ID, 2_000), 1);
    assert.equal(await watches.enqueueRecurrenceAlerts(CHAIN_ID, 2_001), 0);

    const pending = await watches.listPending();
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.launchId, second.launchId);
    const text = ratWatchAlertText(pending[0]!);
    assert.match(text, /same ArcPad-reported creator address/i);
    assert.match(text, /same reported address != same human identity/i);
    assert.match(text, /no buy call/i);

    await watches.completeSent(pending[0]!.alertId, 123, 2_100);
    assert.equal((await watches.listPending()).length, 0);
  } finally {
    launches.close();
    db.close();
  }
});

test('rewind discards pending Rat Watch alerts for removed launches', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const launches = new D1Store(db, CHAIN_ID);
  const watches = new D1RatWatchStore(db);
  const creator = address(5);

  try {
    await launches.putLaunch(await makeLaunch(100n, 1, creator));
    await watches.subscribe(77, creator, 100n, 1_000);
    await launches.putLaunch(await makeLaunch(200n, 2, creator));
    assert.equal(await watches.enqueueRecurrenceAlerts(CHAIN_ID, 2_000), 1);
    assert.equal((await watches.listPending()).length, 1);

    await launches.rewindFromBlock(150n);
    assert.equal((await watches.listPending()).length, 0);
  } finally {
    launches.close();
    db.close();
  }
});

test('unsubscribe cancels already-pending recurrence alerts', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const launches = new D1Store(db, CHAIN_ID);
  const watches = new D1RatWatchStore(db);
  const creator = address(5);

  try {
    await launches.putLaunch(await makeLaunch(100n, 1, creator));
    await watches.subscribe(77, creator, 100n, 1_000);
    await launches.putLaunch(await makeLaunch(200n, 2, creator));
    assert.equal(await watches.enqueueRecurrenceAlerts(CHAIN_ID, 2_000), 1);
    assert.equal((await watches.listPending()).length, 1);

    assert.equal(await watches.unsubscribe(77, creator), true);
    assert.equal((await watches.listPending()).length, 0);
    assert.equal((await watches.list(77)).length, 0);
  } finally {
    launches.close();
    db.close();
  }
});

test('Rat Watch queue sends one durable recurrence alert and does not resend it', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const launches = new D1Store(db, CHAIN_ID);
  const watches = new D1RatWatchStore(db);
  const creator = address(5);
  const sent: string[] = [];

  try {
    await launches.putLaunch(await makeLaunch(100n, 1, creator));
    await watches.subscribe(77, creator, 100n, 1_000);
    await launches.putLaunch(await makeLaunch(200n, 2, creator));

    const fakeFetch: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { text?: string };
      sent.push(body.text ?? '');
      return new Response(JSON.stringify({ ok: true, result: { message_id: 321 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    const first = await runCloudflareRatWatchCycle(
      { DB: db, TELEGRAM_BOT_TOKEN: '123:test' },
      { kind: 'RAT_WATCH_CYCLE', cycleId: 'watch-1', enqueuedAtMs: 5_000 },
      { now: () => 5_000, externalFetch: fakeFetch }
    );
    assert.deepEqual(first, { status: 'SUCCESS', enqueued: 1, sent: 1 });
    assert.equal(sent.length, 1);

    const second = await runCloudflareRatWatchCycle(
      { DB: db, TELEGRAM_BOT_TOKEN: '123:test' },
      { kind: 'RAT_WATCH_CYCLE', cycleId: 'watch-2', enqueuedAtMs: 6_000 },
      { now: () => 6_000, externalFetch: fakeFetch }
    );
    assert.deepEqual(second, { status: 'SUCCESS', enqueued: 0, sent: 0 });
    assert.equal(sent.length, 1);
  } finally {
    launches.close();
    db.close();
  }
});

async function makeLaunch(blockNumber: bigint, seed: number, creator: Hex): Promise<LaunchObserved> {
  const launcher = address(10 + seed);
  const txHash = hex64(20 + seed);
  const token = address(30 + seed);
  return {
    launchId: await deriveLaunchId({ chainId: CHAIN_ID, launcher, txHash, token }),
    eventId: await deriveEventId({ chainId: CHAIN_ID, launcher, txHash, logIndex: seed }),
    chainId: CHAIN_ID,
    blockNumber,
    blockHash: hex64(Number(blockNumber)),
    observedAtMs: Number(blockNumber) * 1_000,
    source: 'ARCPAD',
    launcher,
    txHash,
    logIndex: seed,
    token,
    creator,
    pool: address(40 + seed),
    name: `Watch Rat ${seed}`,
    symbol: `WR${seed}`,
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

function address(seed: number): Hex {
  return `0x${seed.toString(16).padStart(40, '0').slice(-40)}` as Hex;
}

function hex64(seed: number): Hex {
  return `0x${seed.toString(16).padStart(64, '0').slice(-64)}` as Hex;
}
