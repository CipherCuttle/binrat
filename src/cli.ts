import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ARCPAD_START_BLOCK, ARC_CHAIN_ID } from './arc/chain.js';
import { ArcPadLaunchSource } from './arc/arcpadSource.js';
import type { Hex } from './core/types.js';
import { runLaunchWatcher, syncLaunches, type SyncOptions } from './indexer/syncLaunches.js';
import { SqliteStore } from './store/sqliteStore.js';

const command = process.argv[2];
const dbPath = resolve(process.env.BINRAT_DB_PATH ?? './data/binrat.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const store = new SqliteStore(dbPath, ARC_CHAIN_ID);

const options: SyncOptions = {
  startBlock: ARCPAD_START_BLOCK,
  confirmations: BigInt(process.env.BINRAT_CONFIRMATIONS ?? '2'),
  maxBatchBlocks: BigInt(process.env.BINRAT_MAX_BATCH_BLOCKS ?? '1000'),
  reorgLookbackBlocks: 32n,
  pollIntervalMs: Number(process.env.BINRAT_POLL_MS ?? '2000')
};

try {
  if (command === 'backfill') {
    const source = new ArcPadLaunchSource();
    const report = await syncLaunches(source, store, options);
    console.log(JSON.stringify(report, bigintReplacer, 2));
  } else if (command === 'watch') {
    const source = new ArcPadLaunchSource();
    const controller = new AbortController();
    process.once('SIGINT', () => controller.abort());
    process.once('SIGTERM', () => controller.abort());
    await runLaunchWatcher(source, store, options, controller.signal, (report) => {
      console.log(JSON.stringify(report, bigintReplacer));
    });
  } else if (command === 'inspect') {
    const token = process.argv[3]?.toLowerCase() as Hex | undefined;
    if (!token || !/^0x[0-9a-f]{40}$/.test(token)) throw new Error('Usage: pnpm inspect 0xTOKEN');
    const launch = await store.getLaunchByToken(token);
    if (!launch) {
      console.log(JSON.stringify({ found: false, token }, null, 2));
    } else {
      const facts = await store.listProvenanceFacts();
      const prior = facts.filter((fact) =>
        fact.creator.toLowerCase() === launch.creator.toLowerCase() &&
        (fact.observedBlock < launch.blockNumber || (fact.observedBlock === launch.blockNumber && fact.logIndex < launch.logIndex))
      );
      console.log(JSON.stringify({ found: true, launch, trashTrail: { priorLaunchCount: prior.length, priorLaunchIds: prior.map((item) => item.launchId) } }, bigintReplacer, 2));
    }
  } else {
    throw new Error('Usage: binrat <backfill|watch|inspect> [token]');
  }
} finally {
  store.close();
}

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}
