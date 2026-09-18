import { ArcObservationSource } from './arc/observationSource.js';
import { ARC_CHAIN_ID } from './arc/chain.js';
import { canonicalJson } from './evidence/canonical.js';
import { SqliteStore } from './store/sqliteStore.js';

const dbPath = process.env.BINRAT_DB_PATH ?? './data/binrat.sqlite';
const store = new SqliteStore(dbPath, ARC_CHAIN_ID);

try {
  const launches = await store.listLaunches();
  const launch = launches.at(-1);
  if (!launch) throw new Error('OBSERVATION_PROBE_NO_INDEXED_LAUNCH');
  const source = new ArcObservationSource();
  const report = await source.probeHistoricalCapabilities(launch);
  process.stdout.write(`${canonicalJson(report)}\n`);
  if (!report.historicalReconstructionSupported) process.exitCode = 2;
} finally {
  store.close();
}
