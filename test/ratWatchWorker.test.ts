import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/cloudflare/worker.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { D1CompatDatabase } from './support/d1Compat.js';

test('Telegram /watch persists exact reported creator subscription and operational receipt', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1Store(db, 5042);
  const runtime = new D1RuntimeStateStore(db, 5042);
  const creator = address(5);
  const launch = await makeLaunch(creator);
  const sent: string[] = [];

  try {
    await store.putLaunch(launch);
    await store.putProvenanceFact(await buildProvenanceFact(launch));
    await store.commitCheckpoint({
      blockNumber: 100n,
      blockHash: launch.blockHash,
      guardBlockNumber: 99n,
      guardBlockHash: hex64(99)
    });
    await runtime.put({
      sourceVerified: true,
      liveCaughtUp: true,
      headBlock: 102n,
      targetBlock: 100n,
      observationReady: true,
      historyBackfillComplete: false,
      historyBackfillTargetBlock: 90n,
      lastSyncError: null,
      lastHistoryError: null,
      lastObservationError: null,
      updatedAtMs: Date.now()
    });

    const env = {
      DB: db,
      TELEGRAM_BOT_TOKEN: '123:test',
      TELEGRAM_WEBHOOK_SECRET: 'watch-secret',
      TELEGRAM_REPLIES_ENABLED: 'true',
      TELEGRAM_MAX_MESSAGES_PER_MINUTE: '12',
      CAPABILITY_MANIFEST_JSON: JSON.stringify({
        schemaVersion: 'binrat.capability-manifest/0.1',
        capabilities: {},
        launchAuthorization: {
          status: 'BLOCKED',
          marketingAuthorized: false,
          launchAuthorized: false,
          tokenState: 'NOT_LAUNCHED'
        },
        invariant: 'Degen decides attention. Receipts decide truth.'
      })
    };

    const fakeFetch: typeof fetch = async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { text?: string };
      sent.push(body.text ?? '');
      return new Response(JSON.stringify({ ok: true, result: { message_id: 88 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    };

    const update = {
      update_id: 9001,
      message: {
        message_id: 1,
        chat: { id: 77, type: 'private' },
        text: `/watch ${creator}`
      }
    };
    const response = await worker.fetch(
      new Request('https://binrat.example/telegram/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-bot-api-secret-token': 'watch-secret'
        },
        body: JSON.stringify(update)
      }),
      env,
      { externalFetch: fakeFetch, now: () => Date.now() }
    );

    assert.equal(response.status, 200);
    assert.match(sent[0] ?? '', /watch armed/i);
    assert.match(sent[0] ?? '', /same address != same human identity/i);

    const subscription = await db.prepare(`
      SELECT chat_id,creator,start_block
      FROM rat_watch_subscriptions
      WHERE chat_id = 77
    `).first<{ chat_id: number; creator: string; start_block: string }>();
    assert.equal(subscription?.creator, creator);
    assert.equal(subscription?.start_block, '100');

    const receipt = await db.prepare(`
      SELECT state,intent,renderer_version,plan_digest,reply_digest,telegram_message_id
      FROM telegram_update_receipts
      WHERE update_id = 9001
    `).first<{
      state: string;
      intent: string;
      renderer_version: string;
      plan_digest: string | null;
      reply_digest: string | null;
      telegram_message_id: number | null;
    }>();
    assert.equal(receipt?.state, 'REPLIED');
    assert.equal(receipt?.intent, 'WATCH');
    assert.equal(receipt?.renderer_version, 'binrat.operational/0.1');
    assert.equal(receipt?.plan_digest, null);
    assert.match(receipt?.reply_digest ?? '', /^[0-9a-f]{64}$/);
    assert.equal(receipt?.telegram_message_id, 88);
  } finally {
    store.close();
    db.close();
  }
});

async function makeLaunch(creator: Hex): Promise<LaunchObserved> {
  const launcher = address(1);
  const txHash = hex64(2);
  const token = address(3);
  return {
    launchId: await deriveLaunchId({ chainId: 5042, launcher, txHash, token }),
    eventId: await deriveEventId({ chainId: 5042, launcher, txHash, logIndex: 4 }),
    chainId: 5042,
    blockNumber: 100n,
    blockHash: hex64(100),
    observedAtMs: 100_000,
    source: 'ARCPAD',
    launcher,
    txHash,
    logIndex: 4,
    token,
    creator,
    pool: address(6),
    name: 'Watch Source',
    symbol: 'WATCH',
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
