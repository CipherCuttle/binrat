/** Loopback-only Den prototype. Intentionally separate from production routes. */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { LocalRatJobs } from './localJob.js';
import type { EvalCase } from './offline.js';

export const LOCAL_DEN_SCENARIOS = ['FINDING', 'NO_LAUNCH', 'INCOMPLETE_HISTORY', 'EXHAUSTED'] as const;
export const LOCAL_DEN_MAX_JOBS = 24;
const fail = (code: string, status = 400): never => { throw Object.assign(new Error(code), { status }); };
const safeCode = (error: unknown): string => error instanceof Error && /^[A-Z][A-Z0-9_]{0,100}$/.test(error.message)
  ? error.message : 'LOCAL_DEN_FAILED';
function object(value: unknown, keys: string[]): asserts value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== [...keys].sort().join(',') ||
      Object.values(value).some(item => typeof item !== 'string')) fail('LOCAL_BODY_INVALID');
}
async function body(request: IncomingMessage): Promise<unknown> {
  if (request.headers['content-type'] !== 'application/json') fail('LOCAL_JSON_REQUIRED', 415);
  if (Number(request.headers['content-length'] ?? 0) > 2048) fail('LOCAL_BODY_TOO_LARGE', 413);
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length; if (size > 2048) fail('LOCAL_BODY_TOO_LARGE', 413);
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return fail('LOCAL_BODY_INVALID'); }
}

export async function startLocalDen(options: { dbPath: string; port?: number; assetRoot?: string; fixture?: EvalCase }) {
  const token = randomBytes(32).toString('hex');
  const root = options.assetRoot ?? resolve('local-den');
  const fixture: EvalCase = options.fixture ?? JSON.parse(readFileSync(resolve('test/fixtures/workforce/sniffer-funding-to-pons-v1.json'), 'utf8'));
  // Serve an explicit allowlist, never request-controlled filesystem paths or the SQLite file.
  const assets = new Map<string, { bytes: Buffer; type: string }>([
    ['/', { bytes: Buffer.from(readFileSync(resolve(root, 'index.html'), 'utf8').replace('__LOCAL_TOKEN__', token)), type: 'text/html; charset=utf-8' }],
    ['/den.js', { bytes: readFileSync(resolve(root, 'den.js')), type: 'text/javascript; charset=utf-8' }],
    ['/den.css', { bytes: readFileSync(resolve(root, 'den.css')), type: 'text/css; charset=utf-8' }],
    ['/geist-sans.woff2', { bytes: readFileSync(resolve('web/assets/fonts/geist-sans.woff2')), type: 'font/woff2' }],
    ['/geist-mono.woff2', { bytes: readFileSync(resolve('web/assets/fonts/geist-mono.woff2')), type: 'font/woff2' }],
    ['/rat-avatar.png', { bytes: readFileSync(resolve('web/assets/crew/rat-avatar-48.png')), type: 'image/png' }]
  ]);
  const store = new LocalRatJobs(options.dbPath, { create: true });
  let origin = '', host = '', pending = 0;
  let queue: Promise<unknown> = Promise.resolve();
  async function serial<T>(operation: () => Promise<T>): Promise<T> {
    if (pending >= 8) return fail('LOCAL_DEN_BUSY', 503);
    pending++;
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    try { return await result; } finally { pending--; }
  }
  const json = (response: ServerResponse, value: unknown, status = 200) => {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value));
  };
  const server = createServer(async (request, response) => {
    response.setHeader('cache-control', 'no-store'); response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY'); response.setHeader('cross-origin-resource-policy', 'same-origin');
    response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
    try {
      if (request.headers.host !== host || (request.headers.origin && request.headers.origin !== origin)) fail('LOCAL_ORIGIN_REQUIRED', 403);
      const url = new URL(request.url ?? '/', origin);
      if (url.search) fail('LOCAL_ROUTE_INVALID', 404);
      const asset = assets.get(url.pathname);
      if (asset) {
        if (request.method !== 'GET') fail('LOCAL_METHOD_INVALID', 405);
        response.writeHead(200, { 'content-type': asset.type }); response.end(asset.bytes); return;
      }
      if (!url.pathname.startsWith('/api/')) fail('LOCAL_ROUTE_INVALID', 404);
      if (request.headers['x-binrat-local-token'] !== token) fail('LOCAL_TOKEN_REQUIRED', 403);
      if (request.method === 'GET' && url.pathname === '/api/jobs') {
        const result = await serial(async () => {
          const jobs = [];
          for (const jobId of store.listJobIds()) {
            try { jobs.push({ verification: 'VERIFIED', ...await store.inspect(jobId) }); }
            catch (error) { jobs.push({ verification: 'FAILED', jobId, error: safeCode(error) }); }
          }
          return { mode: 'LOCAL_SYNTHETIC_REPLAY', jobs, maxJobs: LOCAL_DEN_MAX_JOBS };
        });
        json(response, result); return;
      }
      const match = /^\/api\/jobs\/([a-zA-Z0-9_:-]{1,100})\/(advance|cancel|export)$/.exec(url.pathname);
      if (request.method === 'GET' && match?.[2] === 'export') {
        json(response, await serial(async () => store.exportEvidence(match[1]!))); return;
      }
      if (request.method !== 'POST') fail('LOCAL_METHOD_INVALID', 405);
      if (!request.headers.origin || request.headers.origin !== origin) fail('LOCAL_ORIGIN_REQUIRED', 403);
      if (url.pathname !== '/api/jobs' && (!match || match[2] === 'export')) fail('LOCAL_ROUTE_INVALID', 404);
      const input = await body(request);
      const result = await serial(async () => {
        if (url.pathname === '/api/jobs') {
          object(input, ['scenario', 'requestId']);
          if (!LOCAL_DEN_SCENARIOS.includes(input.scenario as typeof LOCAL_DEN_SCENARIOS[number]) ||
              !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.requestId!)) fail('LOCAL_SCENARIO_INVALID');
          const jobId = `local-den-${input.requestId}`;
          const existing = store.listJobIds(LOCAL_DEN_MAX_JOBS + 1);
          if (existing.length >= LOCAL_DEN_MAX_JOBS && !existing.includes(jobId)) fail('LOCAL_DEN_CAPACITY', 409);
          const source = structuredClone(fixture); source.job.jobId = jobId;
          source.evalId = `local-den-${input.scenario!.toLowerCase().replaceAll('_','-')}`;
          if (input.scenario === 'NO_LAUNCH') source.events = source.events.filter(event => event.kind !== 'PONS_LAUNCH');
          if (input.scenario === 'INCOMPLETE_HISTORY') source.events = source.events.filter(event => event.kind === 'NATIVE_TRANSFER');
          if (input.scenario === 'EXHAUSTED') source.job.budget.maxToolCalls = 2;
          return store.create(source);
        }
        if (match![2] === 'advance') {
          object(input, ['throughBlock']); return store.advance(match![1]!, input.throughBlock!);
        }
        object(input, []); return store.cancel(match![1]!);
      });
      json(response, result);
    } catch (error) {
      const code = safeCode(error);
      const status = (error as { status?: number })?.status ?? (code === 'LOCAL_JOB_NOT_FOUND' ? 404 :
        ['LOCAL_REVISION_CONFLICT', 'LOCAL_JOB_ID_CONFLICT'].includes(code) ? 409 :
        code === 'LOCAL_BOUNDARY_INVALID' ? 400 : 500);
      if (!response.headersSent) json(response, { error: code, evidencePreserved: true }, status);
      else response.end();
    }
  });
  server.requestTimeout = 5000; server.headersTimeout = 5000; server.timeout = 15000;
  try {
    await new Promise<void>((accept, reject) => {
      server.once('error', reject); server.listen(options.port ?? 4185, '127.0.0.1', accept);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('LOCAL_LISTEN_FAILED');
    host = `127.0.0.1:${address.port}`; origin = `http://${host}`;
  } catch (error) { store.close(); throw error; }
  return { url: origin, close: async () => {
    await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept()));
    store.close();
  } };
}
