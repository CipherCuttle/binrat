import {
  createPublicClient,
  http,
  keccak256,
  type Address,
  type Hex
} from 'viem';
import {
  PONS_V2_FACTORY,
  PONS_V2_FACTORY_CODE_HASH,
  ROBINHOOD_CHAIN_ID,
  robinhoodMainnet
} from '../pons/chain.js';
import { ROBINHOOD_PUBLIC_RPC_FALLBACK_URL } from './syncQueue.js';

export interface PonsBootstrapDiagnosticEnv {
  ROBINHOOD_RPC_URL?: string;
  RAT_CANDIDATE_SMOKE_ENABLED?: string;
  RAT_CANDIDATE_SMOKE_SECRET?: string;
}

interface BootstrapClient {
  getBlockNumber(): Promise<bigint>;
  getChainId(): Promise<number>;
  getBytecode(args: { address: Address }): Promise<Hex | undefined>;
}

export interface PonsBootstrapDiagnosticDeps {
  externalFetch: typeof fetch;
  client?: BootstrapClient;
}

type ProbeStatus = 'PASS' | 'FAIL';
type Transport = 'raw' | 'viem';
type Operation = 'blockNumber' | 'chainId' | 'factoryCode';

interface ProbeFailure {
  transport: Transport;
  operation: Operation;
  code: string | null;
  errorClass: string;
  httpStatus: number | null;
  rpcCode: number | null;
}

function response(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

/** Candidate-only raw-fetch vs viem isolation. Never returns URLs or provider bodies. */
export async function handlePonsBootstrapDiagnostic(
  request: Request,
  env: PonsBootstrapDiagnosticEnv,
  deps: PonsBootstrapDiagnosticDeps
): Promise<Response> {
  if (
    request.method !== 'POST' ||
    env.RAT_CANDIDATE_SMOKE_ENABLED !== 'true' ||
    !env.RAT_CANDIDATE_SMOKE_SECRET ||
    env.RAT_CANDIDATE_SMOKE_SECRET.length < 32
  ) return response(404, { error: 'NOT_FOUND' });

  if (request.headers.get('x-binrat-candidate-secret') !== env.RAT_CANDIDATE_SMOKE_SECRET) {
    return response(401, { error: 'UNAUTHORIZED' });
  }

  const rpcUrl = env.ROBINHOOD_RPC_URL?.trim() || ROBINHOOD_PUBLIC_RPC_FALLBACK_URL;
  const client = deps.client ?? createPublicClient({
    chain: robinhoodMainnet(rpcUrl),
    transport: http(rpcUrl, { timeout: 8_000, retryCount: 0 })
  }) as unknown as BootstrapClient;
  const failures: ProbeFailure[] = [];

  const rawCall = async (method: string, params: unknown[]): Promise<unknown> => {
    const rpcResponse = await deps.externalFetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
    });
    if (!rpcResponse.ok) {
      throw Object.assign(new Error('PONS_RAW_HTTP_ERROR'), {
        name: 'HttpRequestError',
        status: rpcResponse.status
      });
    }
    let parsed: unknown;
    try {
      parsed = await rpcResponse.json();
    } catch (cause) {
      throw new Error('PONS_RAW_JSON_INVALID', { cause });
    }
    if (!parsed || typeof parsed !== 'object') throw new Error('PONS_RAW_JSON_INVALID');
    const payload = parsed as { result?: unknown; error?: { code?: unknown } };
    if (payload.error) {
      const rpcCode = Number.isInteger(payload.error.code) ? Number(payload.error.code) : null;
      throw Object.assign(new Error('PONS_RAW_RPC_ERROR'), { name: 'RpcError', rpcCode });
    }
    return payload.result;
  };

  const raw = {
    blockNumber: await probe('raw', 'blockNumber', failures, async () => {
      requireHex(await rawCall('eth_blockNumber', []), 'PONS_RAW_BLOCK_NUMBER_INVALID');
    }),
    chainId: await probe('raw', 'chainId', failures, async () => {
      requireRobinhoodChain(requireHex(await rawCall('eth_chainId', []), 'PONS_RAW_CHAIN_ID_INVALID'));
    }),
    factoryCode: await probe('raw', 'factoryCode', failures, async () => {
      requireFactoryCode(requireHex(
        await rawCall('eth_getCode', [PONS_V2_FACTORY, 'latest']),
        'PONS_RAW_FACTORY_CODE_INVALID'
      ));
    })
  };

  const viem = {
    blockNumber: await probe('viem', 'blockNumber', failures, async () => {
      await client.getBlockNumber();
    }),
    chainId: await probe('viem', 'chainId', failures, async () => {
      if (await client.getChainId() !== ROBINHOOD_CHAIN_ID) throw new Error('PONS_CHAIN_ID_DRIFT');
    }),
    factoryCode: await probe('viem', 'factoryCode', failures, async () => {
      requireFactoryCode(await client.getBytecode({ address: PONS_V2_FACTORY as Address }));
    })
  };

  return response(200, {
    chainId: ROBINHOOD_CHAIN_ID,
    raw,
    viem,
    failures
  });
}

async function probe(
  transport: Transport,
  operation: Operation,
  failures: ProbeFailure[],
  run: () => Promise<void>
): Promise<ProbeStatus> {
  try {
    await run();
    return 'PASS';
  } catch (error) {
    failures.push({
      transport,
      operation,
      code: safeCode(error),
      errorClass: safeErrorClass(error),
      httpStatus: safeHttpStatus(error),
      rpcCode: safeRpcCode(error)
    });
    return 'FAIL';
  }
}

function requireHex(value: unknown, code: string): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) throw new Error(code);
  return value as Hex;
}

function requireRobinhoodChain(chainIdHex: Hex): void {
  let chainId: bigint;
  try { chainId = BigInt(chainIdHex); }
  catch { throw new Error('PONS_RAW_CHAIN_ID_INVALID'); }
  if (chainId !== BigInt(ROBINHOOD_CHAIN_ID)) throw new Error('PONS_CHAIN_ID_DRIFT');
}

function requireFactoryCode(code: Hex | undefined): void {
  if (!code || code === '0x' || keccak256(code) !== PONS_V2_FACTORY_CODE_HASH) {
    throw new Error('PONS_FACTORY_AUTHORITY_DRIFT');
  }
}

function safeCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : '';
  return /^PONS_[A-Z0-9_]+$/.test(message) ? message : null;
}

function safeErrorClass(error: unknown): string {
  if (!(error instanceof Error)) return 'UNKNOWN_ERROR';
  const normalized = error.name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return new Set([
    'ABORT_ERROR', 'ERROR', 'FETCH_ERROR', 'HTTP_REQUEST_ERROR',
    'NETWORK_ERROR', 'RPC_ERROR', 'TIMEOUT_ERROR', 'TYPE_ERROR'
  ]).has(normalized) ? normalized : 'UNKNOWN_ERROR';
}

function safeHttpStatus(error: unknown): number | null {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth += 1) {
    const status = (current as { status?: unknown }).status;
    if (Number.isInteger(status) && Number(status) >= 100 && Number(status) <= 599) {
      return Number(status);
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

function safeRpcCode(error: unknown): number | null {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth += 1) {
    const rpcCode = (current as { rpcCode?: unknown }).rpcCode;
    if (Number.isInteger(rpcCode)) return Number(rpcCode);
    const code = (current as { code?: unknown }).code;
    if (Number.isInteger(code)) return Number(code);
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}
