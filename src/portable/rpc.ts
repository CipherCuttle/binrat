import { custom } from 'viem';
import type { BudgetLedger } from './budget.js';
import type { Limits } from './config.js';

const METHODS = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getCode', 'eth_getBlockByNumber', 'eth_getLogs']);

export interface RpcFailureDiagnostic {
  kind: 'NETWORK' | 'HTTP' | 'MALFORMED_JSON' | 'RPC_ERROR' | 'ENVELOPE_INVALID' | 'RESPONSE_TOO_LARGE';
  method: string;
  httpStatus?: number;
  rpcCode?: number;
}

export class RpcRequestFailed extends Error {
  constructor(readonly diagnostic: RpcFailureDiagnostic) { super('RPC_REQUEST_FAILED'); }
}

/** Only fixed categories and numeric metadata may enter CLI logs. Never copy
 * provider text, URLs, response bodies or viem's request-bearing error message. */
export function rpcFailureDiagnostic(error: unknown): RpcFailureDiagnostic | undefined {
  for (let depth = 0; error && depth < 8; depth++) {
    if (error instanceof RpcRequestFailed) return error.diagnostic;
    error = typeof error === 'object' && 'cause' in error ? error.cause : undefined;
  }
  return undefined;
}

export function budgetedTransport(url: string, ledger: BudgetLedger, job: string,
  ceiling: Limits, deadline: number, fetchImpl: typeof fetch = fetch, now = Date.now,
  scope: 'COLLECTOR' | 'PONS_FORWARD_V1' = 'COLLECTOR') {
  let id = 0;
  return custom({
    async request({ method, params }) {
      if (!METHODS.has(method) && !(scope === 'PONS_FORWARD_V1' && method === 'eth_getBlockReceipts')) throw new Error('RPC_METHOD_DENIED');
      for (let attempt = 0; attempt < ceiling.attemptsPerRequest; attempt++) {
        // Deliberately outside catch: no retry of a failed ledger reservation.
        ledger.reserve(job, method, deadline);
        const requestId = ++id;
        const signal = AbortSignal.timeout(Math.max(1, Math.min(15000, deadline - now())));
        try {
          const response = await fetchImpl(url, {
            method: 'POST', redirect: 'error', signal,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params: params ?? [] })
          });
          if (!response.body) throw new RpcRequestFailed({ kind: 'HTTP', method, httpStatus: response.status });
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let size = 0;
          try {
            while (true) {
              const part = await reader.read();
              if (part.done) break;
              size += part.value.length;
              if (size > 4 * 1024 * 1024) throw new RpcRequestFailed({ kind: 'RESPONSE_TOO_LARGE', method, httpStatus: response.status });
              chunks.push(part.value);
            }
          } finally { await reader.cancel(); }
          let envelope: Record<string, unknown>;
          try {
            const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
            envelope = parsed as Record<string, unknown>;
          } catch {
            throw new RpcRequestFailed({ kind: response.ok ? 'MALFORMED_JSON' : 'HTTP', method, httpStatus: response.status });
          }
          const error = envelope.error;
          const code = error && typeof error === 'object' && 'code' in error &&
            typeof error.code === 'number' && Number.isSafeInteger(error.code) ? error.code : undefined;
          if (!response.ok) throw new RpcRequestFailed({ kind: 'HTTP', method, httpStatus: response.status, rpcCode: code });
          if (envelope.jsonrpc !== '2.0' || envelope.id !== requestId || !('result' in envelope) && !error)
            throw new RpcRequestFailed({ kind: 'ENVELOPE_INVALID', method, httpStatus: response.status });
          if (error) throw new RpcRequestFailed({ kind: 'RPC_ERROR', method, httpStatus: response.status, rpcCode: code });
          return envelope.result;
        } catch (error) {
          const failure = error instanceof RpcRequestFailed ? error : new RpcRequestFailed({ kind: 'NETWORK', method });
          const d = failure.diagnostic;
          const permanent = d.httpStatus === 401 || d.httpStatus === 403 || d.rpcCode === -32601 || d.rpcCode === -32602;
          if (permanent || attempt + 1 >= ceiling.attemptsPerRequest || now() >= deadline) throw failure;
        }
      }
      throw new Error('RPC_REQUEST_FAILED');
    }
  }, { retryCount: 0 }); // viem must not add hidden transport retries.
}
