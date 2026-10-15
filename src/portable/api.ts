import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { PortableDatabase } from './sqlite.js';
import { readPublicSnapshot, publicStatus } from '../cloudflare/publicSnapshot.js';
import { readPublicCaseEvidence } from '../cloudflare/publicCaseEvidence.js';
import { readCreatorSummary } from '../cloudflare/creatorSummaryReadModel.js';
import { readFunding } from './funding.js';
import { projectPublicFeed } from '../public/project.js';
import type { LaunchObserved, Hex } from '../core/types.js';
import type { ProvenanceFact } from '../intelligence/provenance.js';
import type { CaseEnvelope } from '../public/caseEvidence.js';
import type { PortablePonsTripwire } from './ponsTripwire.js';
import { handlePortablePonsTripwireRequest } from './ponsTripwireHttp.js';
import { monitoringHealth } from './progress.js';

export async function caseBag(envelope: CaseEnvelope) {
  const material = envelope.material;
  const feed = await projectPublicFeed({ chainId: 4663,
    asOfBlock: BigInt(material.publication.checkpointBlock), asOfBlockHash: material.publication.checkpointBlockHash as Hex,
    launches: material.records.map(r => ({ ...r.launch, blockNumber: BigInt(r.launch.blockNumber), observedAtMs: 0 }) as LaunchObserved),
    facts: material.records.map(r => ({ ...r.provenance, observedBlock: BigInt(r.provenance.observedBlock) }) as ProvenanceFact)
  });
  const bag = feed.bags.find(b => b.id === material.caseId);
  if (!bag) throw new Error('CASE_MISSING');
  return { schemaVersion: feed.schemaVersion, chainId: feed.chainId, asOfBlock: feed.asOfBlock,
    historyCoverage: feed.historyCoverage, bag, receipt: feed.receipt };
}

function json(response: ServerResponse, status: number, value: unknown) {
  const body = JSON.stringify(value);
  if (Buffer.byteLength(body) > 256 * 1024) {
    response.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end('{"error":"RESPONSE_BUDGET_EXCEEDED"}'); return;
  }
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(body);
}

/** Bounded Node body adapter; never enters the asynchronous read transaction. */
function watchBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    const finish = (error?: Error) => {
      request.off('data', data); request.off('end', end); request.off('error', fail); request.off('aborted', abort);
      clearTimeout(timer);
      if (error) { request.resume(); reject(error); }
      else resolve(Buffer.concat(chunks).toString('utf8'));
    };
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > 16_384) finish(new Error('BODY_TOO_LARGE'));
      else chunks.push(chunk);
    };
    const end = () => finish();
    const fail = (error: Error) => finish(error);
    const abort = () => finish(new Error('BODY_ABORTED'));
    const timer = setTimeout(() => finish(new Error('BODY_TIMEOUT')), 5000);
    if (Number(request.headers['content-length']) > 16_384) return finish(new Error('BODY_TOO_LARGE'));
    request.on('data', data); request.on('end', end); request.on('error', fail); request.on('aborted', abort);
  });
}

/** Watch routes require explicit injection and a separate writer connection.
 * The portable runtime supplies one only behind its explicit enable flag. */
export function createReadServer(database: PortableDatabase, site: string, now = Date.now,
  options: { tripwire?: PortablePonsTripwire } = {}): Server {
  if (options.tripwire && !database.sql.readonly) throw new Error('WATCH_API_REQUIRES_READ_ONLY_CONNECTION');
  // The reused Mini App client obtains credentials from Telegram's SDK.
  // Permit its exact script path only on an explicitly injected Watch server.
  const sdkScript = options.tripwire ? ' https://telegram.org/js/telegram-web-app.js' : '';
  const root = resolve(site);
  let minute = -1, allReads = 0, expensiveReads = 0;
  let active = false;
  const waiting: (() => void)[] = [];
  const server = createServer(async (request, response) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'same-origin');
    response.setHeader('content-security-policy', `default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'${sdkScript}; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`);
    if (!request.url || request.url.length > 512) return json(response, 400, { error: 'INVALID_PATH' });
    let url: URL;
    try { url = new URL(request.url, 'http://localhost'); } catch { return json(response, 400, { error: 'INVALID_PATH' }); }
    const path = url.pathname;
    if (options.tripwire && /^\/api\/pons-tripwire\/(watch|status|cancel)$/.test(path)) {
      if (request.method !== 'POST') return json(response, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
      if (url.search) return json(response, 400, { ok: false, error: 'QUERY_NOT_SUPPORTED' });
      try {
        const result = await handlePortablePonsTripwireRequest(new Request(url, {
          method: 'POST', body: await watchBody(request), headers: { 'content-type': 'application/json' }
        }), options.tripwire);
        return json(response, result.status, await result.json());
      } catch (error) {
        return json(response, error instanceof Error && error.message === 'BODY_TOO_LARGE' ? 413 : 400,
          { ok: false, error: error instanceof Error && error.message === 'BODY_TOO_LARGE' ? 'BODY_TOO_LARGE' : 'INVALID_BODY' });
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'READ_ONLY' });
    if (path.startsWith('/api/') || path === '/health' || path === '/heartbeat') {
      const current = Math.floor(now() / 60000);
      if (minute !== current) { minute = current; allReads = 0; expensiveReads = 0; }
      if (++allReads > 120 || waiting.length >= 8) return json(response, 429, { error: 'READ_BUDGET_EXHAUSTED' });
      if (url.search) return json(response, 400, { error: 'QUERY_NOT_SUPPORTED' });
      const expensive = path.startsWith('/api/bag/') || path.startsWith('/api/creator/');
      if (expensive && ++expensiveReads > 30) return json(response, 429, { error: 'CASE_BUDGET_EXHAUSTED' });
      if (active) await new Promise<void>(resolve => waiting.push(resolve));
      else active = true;
      try {
        database.sql.exec('BEGIN'); // Consistent read frame across async digests.
        if (path === '/health') {
          database.sql.prepare('SELECT 1').get();
          return json(response, 200, { ok: true, kind: 'LIVENESS_ONLY', monitoring: '/heartbeat', service: 'binrat-survival-v1', collectorMode: 'manual', telegramEnabled: false });
        }
        // Check stored size without materializing unbounded JSON.
        const size = database.sql.prepare('SELECT length(snapshot_json) n FROM binrat_public_snapshots WHERE chain_id=4663 LIMIT 1').get() as { n: number } | undefined;
        if (size && size.n > 128 * 1024) throw new Error('SNAPSHOT_BUDGET_EXCEEDED');
        const snapshot = await readPublicSnapshot(database);
        const checkpoint = database.sql.prepare('SELECT block_number,block_hash FROM chain_checkpoints WHERE chain_id=4663 LIMIT 1').get() as { block_number: string; block_hash: string } | undefined;
        if (snapshot && (!checkpoint || BigInt(checkpoint.block_number) < BigInt(snapshot.checkpointBlock) ||
            (checkpoint.block_number === snapshot.checkpointBlock && checkpoint.block_hash !== snapshot.checkpointBlockHash))) throw new Error('PUBLICATION_QUARANTINED');
        if (path === '/api/status' || path === '/heartbeat') {
          const status = await publicStatus(database, now(), 180000);
          const health = monitoringHealth(database, status, checkpoint, now());
          if (path === '/heartbeat') return json(response, health.ok ? 200 : 503, health);
          return json(response, 200, { ...status,
            state: status.state === 'FRESH_VERIFIED' && !health.ok ? 'STALE_VERIFIED' : status.state,
            monitoringState: health.state, monitoring: health,
            chainHead: health.chainHead, chainHeadObservedAtMs: health.chainHeadObservedAtMs,
            scannerCheckpoint: health.scannerCheckpoint, publishedSnapshotCheckpoint: health.publishedSnapshotCheckpoint,
            snapshotGeneratedAtMs: snapshot?.verifiedAtMs ?? null, sourceMode: 'LOCAL_TRUSTED_INDEX' });
        }
        if (path === '/api/launches/latest') return snapshot ? json(response, 200, snapshot.snapshot) : json(response, 503, { reason: 'NO_VERIFIED_SNAPSHOT' });
        const evidence = /^\/api\/bag\/([0-9a-f]{64})(?:\/(evidence|funding))?$/.exec(path);
        if (evidence) {
          const envelope = await readPublicCaseEvidence(database, evidence[1]!);
          if (!envelope) return json(response, 404, { error: 'BAG_NOT_FOUND' });
          if (evidence[2] === 'evidence') return json(response, 200, envelope);
          if (evidence[2] === 'funding') return json(response, 200, await readFunding(database,
            evidence[1]!, envelope.material.publication.checkpointBlock));
          return json(response, 200, await caseBag(envelope));
        }
        const creator = /^\/api\/creator\/(0x[0-9a-f]{40})\/summary$/.exec(path);
        if (creator) {
          const rows = database.sql.prepare(`SELECT
            length(l.name)+length(l.symbol)+length(l.image_uri)+length(l.website)+length(l.twitter)+length(l.telegram) bytes,
            length(f.payload_json) fact_bytes
            FROM launches l LEFT JOIN provenance_facts f ON f.launch_id=l.launch_id AND f.chain_id=l.chain_id
            WHERE l.chain_id=4663 AND l.source='PONS_V2' AND l.creator=? AND CAST(l.block_number AS INTEGER)<=?
            ORDER BY CAST(l.block_number AS INTEGER) DESC,l.log_index DESC,l.launch_id DESC LIMIT 4`)
            .all(creator[1]!, Number(snapshot?.checkpointBlock ?? -1)) as { bytes: number; fact_bytes: number | null }[];
          if (rows.some(r => r.bytes > 8192 || r.fact_bytes === null || r.fact_bytes > 2048)) throw new Error('CREATOR_BYTES_EXCEEDED');
          const summary = await readCreatorSummary(database, creator[1]!);
          return summary ? json(response, 200, summary) : json(response, 404, { error: 'CREATOR_NOT_INDEXED' });
        }
        return json(response, path.startsWith('/api/bag/') ? 400 : 404, { error: 'UNSUPPORTED_OR_INVALID_ROUTE' });
      } catch { return json(response, 503, { ok: false, state: 'UNAVAILABLE', error: 'LOCAL_EVIDENCE_UNAVAILABLE' }); }
      finally {
        if (database.sql.inTransaction) database.sql.exec('ROLLBACK');
        const next = waiting.shift();
        if (next) next();
        else active = false;
      }
    }
    if (path.startsWith('/telegram') || path.startsWith('/__candidate') || path === '/api') return json(response, 404, { error: 'UNSUPPORTED_ROUTE' });
    let decoded: string;
    try { decoded = decodeURIComponent(path); } catch { return json(response, 400, { error: 'INVALID_PATH' }); }
    if (decoded.split('/').some(p => p.startsWith('.')) || decoded.includes('\\')) return json(response, 404, { error: 'NOT_FOUND' });
    let file = resolve(root, '.' + decoded);
    if (file !== root && !file.startsWith(root + sep)) return json(response, 404, { error: 'NOT_FOUND' });
    try { if (!statSync(file).isFile()) file = resolve(root, 'index.html'); }
    catch { if (extname(decoded)) return json(response, 404, { error: 'NOT_FOUND' }); file = resolve(root, 'index.html'); }
    try {
      const size = statSync(file).size;
      const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
      response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'content-length': size, 'cache-control': 'no-cache' });
      if (request.method === 'HEAD') response.end();
      else createReadStream(file).on('error', () => response.destroy()).pipe(response);
    } catch { json(response, 503, { error: 'STATIC_BUILD_MISSING' }); }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 3000;
  server.maxConnections = 32;
  return server;
}
