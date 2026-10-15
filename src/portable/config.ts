export interface Limits {
  attemptsPerRun: number;
  attemptsPerDay: number;
  blocksPerRun: number;
  runtimeMs: number;
  attemptsPerRequest: number;
}
export const DEFAULT_LIMITS: Limits = Object.freeze({
  attemptsPerRun: 50, attemptsPerDay: 500, blocksPerRun: 1000,
  runtimeMs: 60000, attemptsPerRequest: 2
});

export function integer(value: string | undefined, fallback: number, max: number): number {
  if (value !== undefined && !/^[1-9]\d*$/.test(value)) throw new Error('CONFIG_INTEGER_INVALID');
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new Error('CONFIG_CEILING_EXCEEDED');
  return n;
}

export function limits(env: NodeJS.ProcessEnv = process.env): Limits {
  // Lower ceilings are configurable. Raising experiment ceilings requires a
  // reviewed code change, never an unnoticed environment default.
  return {
    attemptsPerRun: integer(env.RPC_ATTEMPTS_PER_RUN, 50, 50),
    attemptsPerDay: integer(env.RPC_ATTEMPTS_PER_DAY, 500, 500),
    blocksPerRun: integer(env.BLOCKS_PER_RUN, 1000, 1000),
    runtimeMs: integer(env.RUNTIME_MS, 60000, 60000),
    attemptsPerRequest: integer(env.ATTEMPTS_PER_REQUEST, 2, 2)
  };
}

export function freeEndpoint(env: NodeJS.ProcessEnv = process.env): string {
  if (env.COLLECTOR_MODE !== 'manual' || env.RPC_ENABLED !== 'true' ||
      env.RPC_ENDPOINT_CLASS !== 'free' || env.PAID_RPC !== 'false' ||
      env.AUTOMATIC_PAID_FALLBACK !== 'false' || env.TELEGRAM_ENABLED !== 'false') {
    throw new Error('EXTERNAL_WORK_DISABLED');
  }
  const raw = env.RPC_URL;
  if (!raw) throw new Error('SINGLE_FREE_ENDPOINT_REQUIRED');
  const url = new URL(raw);
  if (url.username || url.password || url.search || url.hash ||
      /alchemy|infura|quicknode/i.test(url.hostname) ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('FREE_ENDPOINT_POLICY_REJECTED');
  }
  // Owner must establish this endpoint is actually unmetered. No inference
  // from hostname or successful response establishes a provider price.
  return url.href;
}
