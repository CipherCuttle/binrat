import { ARC_CHAIN_ID } from '../arc/chain.js';
import { projectBagIntelligence } from '../public/bagIntelligence.js';
import { projectCreatorFile } from '../public/creatorFile.js';
import { projectPublicFeed } from '../public/project.js';
import { projectReplayBundle } from '../public/replayBundle.js';
import type { PublicFeed } from '../public/types.js';
import { D1RuntimeStateStore, type D1RuntimeState } from './runtimeState.js';
import { D1Store } from './d1Store.js';
import type { D1DatabaseLike } from './d1Types.js';

export interface BinratWorkerEnv {
  DB: D1DatabaseLike;
  CAPABILITY_MANIFEST_JSON?: string;
  BINRAT_MAX_STATUS_AGE_MS?: string;
}

interface ReadyContext {
  store: D1Store;
  runtime: D1RuntimeState;
  feed: PublicFeed;
}

export default {
  async fetch(request: Request, env: BinratWorkerEnv): Promise<Response> {
    if (request.method !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' });
    let pathname: string;
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      return json(400, { error: 'INVALID_PATH' });
    }

    try {
      if (pathname === '/api/capabilities') return capabilities(env);
      if (pathname === '/api/health') return health(env);

      const ready = await readyContext(env);
      if (!ready) return json(503, { ready: false, reason: 'INDEX_NOT_READY' });
      const { store, feed } = ready;

      if (pathname === '/api/feed') return json(200, feed);

      if (pathname.startsWith('/api/creator/')) {
        const creator = pathname.slice('/api/creator/'.length).toLowerCase();
        if (!/^0x[0-9a-f]{40}$/.test(creator)) return json(400, { error: 'CREATOR_ADDRESS_INVALID' });
        const creatorFile = await projectCreatorFile(feed, creator);
        return creatorFile ? json(200, creatorFile) : json(404, { error: 'CREATOR_NOT_INDEXED' });
      }

      if (pathname.startsWith('/api/bag/') && pathname.endsWith('/intelligence')) {
        const bagId = pathname.slice('/api/bag/'.length, -'/intelligence'.length);
        if (!bagId) return json(400, { error: 'BAG_ID_INVALID' });
        const bag = feed.bags.find((item) => item.id === bagId);
        if (!bag) return json(404, { error: 'BAG_NOT_FOUND' });
        const observations = (await store.listObservationsForLaunch(bag.id))
          .filter((receipt) => receipt.observedBlock <= BigInt(feed.asOfBlock));
        return json(200, await projectBagIntelligence(feed, bag, observations));
      }

      if (pathname.startsWith('/api/bag/') && pathname.endsWith('/replay')) {
        const bagId = pathname.slice('/api/bag/'.length, -'/replay'.length);
        if (!bagId) return json(400, { error: 'BAG_ID_INVALID' });
        const bag = feed.bags.find((item) => item.id === bagId);
        if (!bag) return json(404, { error: 'BAG_NOT_FOUND' });
        const observations = (await store.listObservationsForLaunch(bag.id))
          .filter((receipt) => receipt.observedBlock <= BigInt(feed.asOfBlock));
        return json(200, await projectReplayBundle(feed, bag, observations));
      }

      if (pathname.startsWith('/api/bag/')) {
        const bagId = pathname.slice('/api/bag/'.length);
        if (!bagId) return json(400, { error: 'BAG_ID_INVALID' });
        const bag = feed.bags.find((item) => item.id === bagId);
        if (!bag) return json(404, { error: 'BAG_NOT_FOUND' });
        return json(200, {
          schemaVersion: feed.schemaVersion,
          chainId: feed.chainId,
          asOfBlock: feed.asOfBlock,
          historyCoverage: feed.historyCoverage,
          bag,
          receipt: feed.receipt
        });
      }

      if (pathname.startsWith('/api/')) return json(404, { error: 'NOT_FOUND' });
      return json(404, { error: 'NOT_FOUND' });
    } catch {
      return json(503, { ready: false, reason: 'PUBLIC_PROJECTION_UNAVAILABLE' });
    }
  }
};

async function health(env: BinratWorkerEnv): Promise<Response> {
  const store = new D1Store(env.DB, ARC_CHAIN_ID);
  const runtimeStore = new D1RuntimeStateStore(env.DB, ARC_CHAIN_ID);
  const [checkpoint, launches, nextBlock, runtime] = await Promise.all([
    store.getCheckpoint(),
    store.listLaunches(),
    store.getHistoricalBackfillNextBlock(),
    runtimeStore.get()
  ]);

  const fresh = runtime ? runtimeFresh(runtime, maxStatusAgeMs(env)) : false;
  const indexReady = Boolean(checkpoint && runtime?.sourceVerified && !runtime.lastSyncError && fresh);
  const observationReady = Boolean(runtime?.observationReady && !runtime.lastObservationError && fresh);

  return json(200, {
    ok: indexReady,
    chainId: ARC_CHAIN_ID,
    indexReady,
    checkpointBlock: checkpoint?.blockNumber.toString() ?? null,
    launchCount: checkpoint
      ? launches.filter((launch) => launch.blockNumber <= checkpoint.blockNumber).length
      : 0,
    historyBackfillComplete: runtime?.historyBackfillComplete ?? false,
    historyBackfillTargetBlock: runtime?.historyBackfillTargetBlock?.toString() ?? null,
    historyBackfillNextBlock: nextBlock?.toString() ?? null,
    lastHistoryError: runtime?.lastHistoryError ?? null,
    observationReady,
    lastObservationError: runtime?.lastObservationError ?? null,
    lastSyncError: runtime?.lastSyncError ?? null,
    runtimeFresh: fresh,
    runtimeUpdatedAtMs: runtime?.updatedAtMs ?? null
  });
}

function capabilities(env: BinratWorkerEnv): Response {
  if (!env.CAPABILITY_MANIFEST_JSON) {
    return json(503, { error: 'CAPABILITY_MANIFEST_NOT_CONFIGURED' });
  }
  try {
    const value = JSON.parse(env.CAPABILITY_MANIFEST_JSON) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return json(200, value);
  } catch {
    return json(503, { error: 'CAPABILITY_MANIFEST_INVALID' });
  }
}

async function readyContext(env: BinratWorkerEnv): Promise<ReadyContext | null> {
  const store = new D1Store(env.DB, ARC_CHAIN_ID);
  const runtimeStore = new D1RuntimeStateStore(env.DB, ARC_CHAIN_ID);
  const runtime = await runtimeStore.get();
  if (
    !runtime ||
    !runtime.sourceVerified ||
    runtime.lastSyncError ||
    !runtimeFresh(runtime, maxStatusAgeMs(env))
  ) return null;

  const state = await store.readPublicProjectionState();
  if (!state) return null;

  const feed = await projectPublicFeed({
    chainId: ARC_CHAIN_ID,
    asOfBlock: state.checkpoint.blockNumber,
    asOfBlockHash: state.checkpoint.blockHash,
    launches: state.launches,
    facts: state.facts
  });

  const [after, afterRuntime] = await Promise.all([
    store.getCheckpoint(),
    runtimeStore.get()
  ]);
  if (
    !after ||
    after.blockNumber !== state.checkpoint.blockNumber ||
    after.blockHash !== state.checkpoint.blockHash ||
    !afterRuntime ||
    afterRuntime.updatedAtMs !== runtime.updatedAtMs ||
    !afterRuntime.sourceVerified ||
    afterRuntime.lastSyncError ||
    !runtimeFresh(afterRuntime, maxStatusAgeMs(env))
  ) return null;

  return { store, runtime: afterRuntime, feed };
}

function maxStatusAgeMs(env: BinratWorkerEnv): number {
  const raw = Number(env.BINRAT_MAX_STATUS_AGE_MS ?? '60000');
  if (!Number.isSafeInteger(raw) || raw < 1_000 || raw > 3_600_000) return 60_000;
  return raw;
}

function runtimeFresh(runtime: D1RuntimeState, maxAgeMs: number): boolean {
  const age = Date.now() - runtime.updatedAtMs;
  return age >= 0 && age <= maxAgeMs;
}

function json(status: number, value: unknown): Response {
  return Response.json(value, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}
