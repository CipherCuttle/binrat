import { createReadStream, mkdirSync, realpathSync, statSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { ArcPadLaunchSource } from './arc/arcpadSource.js';
import { ARCPAD_START_BLOCK, ARC_CHAIN_ID } from './arc/chain.js';
import { runLaunchWatcher, type SyncOptions } from './indexer/syncLaunches.js';
import { projectPublicFeed } from './public/project.js';
import { projectCreatorFile } from './public/creatorFile.js';
import { SqliteStore } from './store/sqliteStore.js';

// Source and compiled entrypoints both resolve the same repo-owned web directory.
const here = dirname(fileURLToPath(import.meta.url));
const webRoot = realpathSync(resolve(here, here.endsWith(`${sep}dist${sep}src`) ? '../../web' : '../web'));
const dbPath = resolve(process.env.BINRAT_DB_PATH ?? './data/binrat.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
const store = new SqliteStore(dbPath, ARC_CHAIN_ID);
const controller = new AbortController();
let lastSyncError: string | null = null;
let sourceVerified = false;

function integerEnv(name: string, fallback: number, minimum: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`INVALID_CONFIG:${name}`);
  return value;
}
const lookback = BigInt(integerEnv('BINRAT_LIVE_LOOKBACK_BLOCKS', 50000, 1));
const pollIntervalMs = integerEnv('BINRAT_POLL_MS', 2000, 100);
const baseOptions = {
  confirmations: BigInt(integerEnv('BINRAT_CONFIRMATIONS', 2, 0)),
  maxBatchBlocks: BigInt(integerEnv('BINRAT_MAX_BATCH_BLOCKS', 1000, 1)),
  reorgLookbackBlocks: 32n,
  pollIntervalMs
};

// Never expose viem error messages: they may contain RPC URLs, headers or credentials.
function syncErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const code = message.match(/^(ARC_[A-Z_]+|ARCPAD_[A-Z_]+|REORG_[A-Z_]+|LAUNCH_[A-Z_]+|PROVENANCE_[A-Z_]+)(?=:|$)/)?.[1];
  return code ?? 'SYNC_FAILED';
}

async function watch(): Promise<void> {
  let options: SyncOptions | undefined;
  while (!controller.signal.aborted) {
    try {
      const source = new ArcPadLaunchSource();
      if (!options) {
        const checkpoint = await store.getCheckpoint();
        const head = await source.getHeadBlockNumber();
        const recentStart = head > lookback ? head - lookback : 0n;
        options = { ...baseOptions, startBlock: checkpoint ? ARCPAD_START_BLOCK : (recentStart > ARCPAD_START_BLOCK ? recentStart : ARCPAD_START_BLOCK) };
        console.log(JSON.stringify({ event: 'INDEX_START', chainId: ARC_CHAIN_ID, startBlock: options.startBlock.toString(), resumed: Boolean(checkpoint), historyCoverage: 'UNVERIFIED' }));
      }
      await source.assertAuthority(await source.getHeadBlockNumber());
      // Existing databases must pass checkpoint validation before being advertised ready.
      if (!(await store.getCheckpoint())) sourceVerified = true;
      await runLaunchWatcher(source, store, options, controller.signal, (report) => {
        sourceVerified = true;
        lastSyncError = null;
        console.log(JSON.stringify({ event: 'INDEX_SYNC', ...report }, (_key, value) => typeof value === 'bigint' ? value.toString() : value));
      });
    } catch (error) {
      sourceVerified = false;
      lastSyncError = syncErrorCode(error);
      console.error(JSON.stringify({ event: 'INDEX_ERROR', code: lastSyncError }));
      await delay(pollIntervalMs, undefined, { signal: controller.signal }).catch(() => {});
    }
  }
}

async function snapshot() {
  const checkpoint = await store.getCheckpoint();
  if (!checkpoint || !sourceVerified || lastSyncError) return null;
  const launches = (await store.listLaunches()).filter((launch) => launch.blockNumber <= checkpoint.blockNumber);
  const facts = (await store.listProvenanceFacts()).filter((fact) => fact.observedBlock <= checkpoint.blockNumber);
  const feed = await projectPublicFeed({
    chainId: ARC_CHAIN_ID,
    asOfBlock: checkpoint.blockNumber,
    asOfBlockHash: checkpoint.blockHash,
    launches,
    facts
  });
  // Reject a snapshot if a rewind/commit raced the asynchronous projection.
  const after = await store.getCheckpoint();
  if (!after || after.blockNumber !== checkpoint.blockNumber || after.blockHash !== checkpoint.blockHash || !sourceVerified || lastSyncError) return null;
  return feed;
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  response.end(JSON.stringify(value));
}
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2'
};
const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET') { json(response, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
    let pathname: string;
    try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); }
    catch { json(response, 400, { error: 'INVALID_PATH' }); return; }
    if (pathname === '/api/health') {
      const checkpoint = await store.getCheckpoint();
      const launches = await store.listLaunches();
      json(response, 200, {
        ok: !lastSyncError, chainId: ARC_CHAIN_ID,
        indexReady: Boolean(checkpoint && sourceVerified && !lastSyncError),
        checkpointBlock: checkpoint?.blockNumber.toString() ?? null,
        launchCount: checkpoint ? launches.filter((launch) => launch.blockNumber <= checkpoint.blockNumber).length : 0,
        lastSyncError
      });
      return;
    }
    if (pathname.startsWith('/api/creator/')) {
      const creator = pathname.slice('/api/creator/'.length).toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(creator)) { json(response, 400, { error: 'CREATOR_ADDRESS_INVALID' }); return; }
      const feed = await snapshot();
      if (!feed) { json(response, 503, { ready: false, reason: lastSyncError ? 'LIVE_INDEX_NOT_AVAILABLE' : 'INDEX_NOT_READY' }); return; }
      const creatorFile = await projectCreatorFile(feed, creator);
      if (!creatorFile) { json(response, 404, { error: 'CREATOR_NOT_INDEXED' }); return; }
      json(response, 200, creatorFile);
      return;
    }
    if (pathname === '/api/feed' || pathname.startsWith('/api/bag/')) {
      const feed = await snapshot();
      if (!feed) { json(response, 503, { ready: false, reason: lastSyncError ? 'LIVE_INDEX_NOT_AVAILABLE' : 'INDEX_NOT_READY' }); return; }
      if (pathname === '/api/feed') { json(response, 200, feed); return; }
      const bag = feed.bags.find((item) => item.id === pathname.slice('/api/bag/'.length));
      if (!bag) { json(response, 404, { error: 'BAG_NOT_FOUND' }); return; }
      json(response, 200, { schemaVersion: feed.schemaVersion, chainId: feed.chainId, asOfBlock: feed.asOfBlock, historyCoverage: feed.historyCoverage, bag, receipt: feed.receipt });
      return;
    }
    if (pathname.startsWith('/api/')) { json(response, 404, { error: 'NOT_FOUND' }); return; }
    const path = resolve(webRoot, pathname === '/' ? 'index.html' : `.${pathname}`);
    if (!path.startsWith(`${webRoot}${sep}`)) { json(response, 403, { error: 'FORBIDDEN' }); return; }
    let file: string;
    try {
      file = realpathSync(path);
      if (!file.startsWith(`${webRoot}${sep}`) || !statSync(file).isFile()) throw new Error();
    } catch { json(response, 404, { error: 'NOT_FOUND' }); return; }
    response.writeHead(200, { 'content-type': mime[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    if (!response.headersSent) json(response, 503, { ready: false, reason: 'PUBLIC_PROJECTION_UNAVAILABLE' });
    else response.destroy();
  }
});
const port = integerEnv('PORT', 4174, 1);
server.listen(port, '0.0.0.0', () => console.log(`BINRAT public read service: http://localhost:${port}`));
const watching = watch();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    controller.abort();
    server.close(() => { void watching.finally(() => store.close()); });
  });
}
