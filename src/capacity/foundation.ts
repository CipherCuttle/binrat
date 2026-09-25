import type { D1DatabaseLike, D1PreparedStatementLike, D1ResultLike } from '../cloudflare/d1Types.js';

export type CapacityClass = 'PUBLIC_CACHED' | 'PUBLIC_MISS' | 'ACCOUNT' | 'PREMIUM';
export interface CapacityEnv {
  BINRAT_CAPACITY_TELEMETRY_ENABLED?: string;
  BINRAT_CAPACITY_GUARDS_ENABLED?: string;
  BINRAT_OPTIONAL_WORK_MODE?: string;
}
export interface D1CapacityMeter {
  operations: number;
  rowsReturned: number;
  rowsReadReported: number;
  rowsWrittenReported: number;
  rowsReadUnknown: number;
  failedOperations: number;
}
export function makeD1CapacityMeter(): D1CapacityMeter {
  return { operations: 0, rowsReturned: 0, rowsReadReported: 0, rowsWrittenReported: 0, rowsReadUnknown: 0, failedOperations: 0 };
}

// Templates only. Never put wallet addresses, request query, Telegram data or secrets in metrics.
export function capacityRoute(request: Request): { route: string; costClass: CapacityClass } {
  const { pathname, searchParams } = new URL(request.url);
  if (pathname === '/telegram/webhook') return { route: '/telegram/webhook', costClass: 'ACCOUNT' };
  if (pathname.startsWith('/api/holder/')) return { route: '/api/holder/:action', costClass: 'ACCOUNT' };
  if (pathname.startsWith('/api/pons-candidate/')) return { route: '/api/pons-candidate/:action', costClass: 'ACCOUNT' };
  if (/^\/api\/bag\/[^/]+\/replay$/.test(pathname)) return { route: '/api/bag/:id/replay', costClass: 'PREMIUM' };
  if (/^\/api\/bag\/[^/]+\/intelligence$/.test(pathname)) return { route: '/api/bag/:id/intelligence', costClass: 'PUBLIC_MISS' };
  if (/^\/api\/bag\/[^/]+$/.test(pathname)) return { route: '/api/bag/:id', costClass: 'PUBLIC_MISS' };
  if (/^\/api\/creator\/[^/]+$/.test(pathname)) return { route: '/api/creator/:address', costClass: 'PUBLIC_MISS' };
  if (/^\/api\/rat-radar\/activity\/[^/]+$/.test(pathname)) return { route: '/api/rat-radar/activity/:id', costClass: 'PUBLIC_MISS' };
  if (/^\/api\/rat-radar\/address\/[^/]+\/activity$/.test(pathname)) return { route: '/api/rat-radar/address/:address/activity', costClass: 'PREMIUM' };
  if (pathname === '/api/rat-radar/watchlist') return { route: '/api/rat-radar/watchlist', costClass: searchParams.get('depth') === 'full' ? 'PREMIUM' : 'PUBLIC_MISS' };
  if (pathname === '/api/feed') return { route: '/api/feed', costClass: 'PUBLIC_CACHED' }; // target class; actual API currently no-store
  if (pathname === '/api/health' || pathname === '/health') return { route: pathname, costClass: 'PUBLIC_CACHED' };
  if (pathname === '/api/capabilities' || pathname === '/api/dumpster-ledger') return { route: pathname, costClass: 'PUBLIC_CACHED' };
  return { route: '/unmatched', costClass: 'PUBLIC_MISS' };
}

export function capacityBudgetGuard(request: Request, env: CapacityEnv): Response | null {
  if (env.BINRAT_CAPACITY_GUARDS_ENABLED !== 'true' ||
      env.BINRAT_OPTIONAL_WORK_MODE !== 'SHED_OPTIONAL' ||
      capacityRoute(request).costClass !== 'PREMIUM') return null;
  return Response.json({ error: 'OPTIONAL_CAPACITY_SHED', retryable: true }, {
    status: 503,
    headers: { 'retry-after': '60', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

type DetailedMeta = { changes?: number; rows_read?: number; rows_written?: number };
function validCount(n: unknown): n is number { return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0; }
function count(meter: D1CapacityMeter, meta: DetailedMeta | undefined, returned: number | null, write: boolean): void {
  meter.operations++;
  if (returned !== null) meter.rowsReturned += returned;
  if (validCount(meta?.rows_read)) meter.rowsReadReported += meta.rows_read;
  else if (!write) meter.rowsReadUnknown++;
  if (validCount(meta?.rows_written)) meter.rowsWrittenReported += meta.rows_written;
  else if (write && validCount(meta?.changes)) meter.rowsWrittenReported += meta.changes;
}

// When Cloudflare does not expose rows_read for .first(), unknown is visible rather than guessed.
// Batch unwrap preserves the real D1Compat transaction and existing production batch semantics.
export function instrumentD1(db: D1DatabaseLike, meter: D1CapacityMeter): D1DatabaseLike {
  const unwrapped = new WeakMap<D1PreparedStatementLike, { statement: D1PreparedStatementLike; write: boolean }>();
  function wrap(statement: D1PreparedStatementLike, write: boolean): D1PreparedStatementLike {
    const proxy: D1PreparedStatementLike = {
      bind(...values) { return wrap(statement.bind(...values), write); },
      async run<T>() {
        try { const result = await statement.run<T>(); count(meter, result.meta, result.results?.length ?? null, true); return result; }
        catch (error) { meter.failedOperations++; throw error; }
      },
      async first<T>() {
        try { const result = await statement.first<T>(); count(meter, undefined, result === null ? 0 : 1, false); return result; }
        catch (error) { meter.failedOperations++; throw error; }
      },
      async all<T>() {
        try { const result = await statement.all<T>(); count(meter, result.meta, result.results?.length ?? 0, false); return result; }
        catch (error) { meter.failedOperations++; throw error; }
      }
    };
    unwrapped.set(proxy, { statement, write });
    return proxy;
  }
  return {
    prepare(sql) { return wrap(db.prepare(sql), /^\s*(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP)/i.test(sql)); },
    async batch(statements) {
      const entries = statements.map((s) => unwrapped.get(s));
      try {
        const results = await db.batch(statements.map((s, i) => entries[i]?.statement ?? s));
        for (let i = 0; i < results.length; i++) {
          const result: D1ResultLike = results[i]!;
          count(meter, result.meta, result.results?.length ?? null, entries[i]?.write ?? false);
        }
        return results;
      } catch (error) { meter.failedOperations++; throw error; }
    },
    async exec(sql) {
      try { const result = await db.exec(sql); meter.operations++; return result; }
      catch (error) { meter.failedOperations++; throw error; }
    }
  };
}

export function capacityMetric(event: Record<string, string | number | boolean | null>): void {
  console.log(JSON.stringify({ schemaVersion: 'binrat.capacity.telemetry/1', ...event }));
}
