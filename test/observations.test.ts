import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildObservationReceipt } from '../src/observations/identity.js';
import { OBSERVATION_VERSION } from '../src/observations/types.js';
import { SqliteStore } from '../src/store/sqliteStore.js';

const chainId = 5042;
const launch: LaunchObserved = {
  chainId,
  blockNumber: 10n,
  blockHash: `0x${'10'.padStart(64, '0')}` as Hex,
  observedAtMs: 1_000,
  launchId: 'launch-observation-test',
  eventId: 'event-observation-test',
  source: 'ARCPAD',
  launcher: '0x24196cd6e534cfce8f480b53e70809b68ea86f29',
  txHash: `0x${'11'.padStart(64, '0')}` as Hex,
  logIndex: 0,
  token: '0x1000000000000000000000000000000000000001',
  creator: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  pool: '0x2000000000000000000000000000000000000002',
  name: 'Observation Test',
  symbol: 'OBS',
  imageUri: '',
  website: '',
  twitter: '',
  telegram: ''
};

test('observation ledger is idempotent, conflicting replay fails closed, and own-block rewind works', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'binrat-observation-'));
  const db = join(dir, 'test.sqlite');
  const store = new SqliteStore(db, chainId);
  try {
    await store.putLaunch(launch);
    const base = {
      chainId,
      launchId: launch.launchId,
      horizonMs: 300_000,
      targetTimestampMs: 300_000,
      observedBlock: 15n,
      observedBlockHash: `0x${'15'.padStart(64, '0')}` as Hex,
      observedTimestampMs: 301_000,
      status: 'COMPLETE' as const,
      facts: {
        poolCodePresent: true,
        poolActiveLiquidity: 123n,
        poolSqrtPriceX96: 456n,
        poolTick: 12,
        creatorTokenBalance: 789n,
        tokenTotalSupply: 1_000n,
        tokenDecimals: 18
      },
      missing: []
    };
    const receipt = await buildObservationReceipt(base);

    assert.equal(receipt.observationVersion, OBSERVATION_VERSION);
    assert.equal(await store.putObservation(receipt), 'INSERTED');
    assert.equal(await store.putObservation(receipt), 'DUPLICATE');

    const changed = await buildObservationReceipt({
      ...base,
      facts: { ...base.facts, creatorTokenBalance: 790n }
    });
    assert.equal(changed.observationId, receipt.observationId);
    await assert.rejects(store.putObservation(changed), /OBSERVATION_IDENTITY_CONFLICT/);

    const stored = await store.listObservationsForLaunch(launch.launchId);
    assert.equal(stored.length, 1);
    assert.equal(stored[0]?.facts.creatorTokenBalance, 789n);
    assert.equal(stored[0]?.observedBlock, 15n);

    await store.rewindFromBlock(14n);
    assert.equal((await store.listObservationsForLaunch(launch.launchId)).length, 0);
    assert.equal((await store.getLaunch(launch.launchId))?.launchId, launch.launchId);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('observation status cannot claim COMPLETE when evidence is missing', async () => {
  await assert.rejects(
    buildObservationReceipt({
      chainId,
      launchId: launch.launchId,
      horizonMs: 3_600_000,
      targetTimestampMs: 3_600_000,
      observedBlock: 20n,
      observedBlockHash: `0x${'20'.padStart(64, '0')}` as Hex,
      observedTimestampMs: 3_600_001,
      status: 'COMPLETE',
      facts: {},
      missing: ['POOL_LIQUIDITY']
    }),
    /OBSERVATION_STATUS_MISMATCH/
  );
});
