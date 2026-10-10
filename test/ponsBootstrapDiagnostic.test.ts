import assert from 'node:assert/strict';
import test from 'node:test';
import { ROBINHOOD_CHAIN_ID } from '../src/pons/chain.js';
import { handlePonsBootstrapDiagnostic } from '../src/cloudflare/ponsBootstrapDiagnostic.js';

const SECRET = '0123456789abcdef0123456789abcdef';

function request(secret = SECRET): Request {
  return new Request('https://candidate.invalid/__candidate/pons-bootstrap', {
    method: 'POST',
    headers: { 'x-binrat-candidate-secret': secret }
  });
}

function rpcFetch(blockStatus = 200): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { method?: string };
    if (body.method === 'eth_blockNumber' && blockStatus !== 200) {
      return new Response('', { status: blockStatus });
    }
    const result = body.method === 'eth_blockNumber'
      ? '0x100'
      : body.method === 'eth_chainId'
        ? '0x1237'
        : body.method === 'eth_getCode'
          ? '0x6000'
          : null;
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }) as typeof fetch;
}

const fakeClient = {
  getBlockNumber: async () => 256n,
  getChainId: async () => ROBINHOOD_CHAIN_ID,
  getBytecode: async () => '0x6000' as `0x${string}`
};

test('Pons candidate diagnostic is dark unless the existing candidate smoke gate is enabled', async () => {
  const response = await handlePonsBootstrapDiagnostic(
    request(),
    { RAT_CANDIDATE_SMOKE_ENABLED: 'false', RAT_CANDIDATE_SMOKE_SECRET: SECRET },
    { externalFetch: rpcFetch(), client: fakeClient }
  );
  assert.equal(response.status, 404);
});

test('Pons candidate diagnostic returns only the safe raw-vs-viem matrix', async () => {
  const response = await handlePonsBootstrapDiagnostic(
    request(),
    {
      ROBINHOOD_RPC_URL: 'https://user:secret@rpc.example/private',
      RAT_CANDIDATE_SMOKE_ENABLED: 'true',
      RAT_CANDIDATE_SMOKE_SECRET: SECRET
    },
    { externalFetch: rpcFetch(), client: fakeClient }
  );
  assert.equal(response.status, 200);
  const body = await response.json() as {
    chainId: number;
    raw: Record<string, string>;
    viem: Record<string, string>;
    failures: Array<{ transport: string; operation: string; code: string | null }>;
  };
  assert.equal(body.chainId, ROBINHOOD_CHAIN_ID);
  assert.deepEqual(body.raw, { blockNumber: 'PASS', chainId: 'PASS', factoryCode: 'FAIL' });
  assert.deepEqual(body.viem, { blockNumber: 'PASS', chainId: 'PASS', factoryCode: 'FAIL' });
  assert.equal(body.failures.every((failure) => failure.code === 'PONS_FACTORY_AUTHORITY_DRIFT'), true);
  assert.equal(JSON.stringify(body).includes('rpc.example'), false);
  assert.equal(JSON.stringify(body).includes('secret'), false);
});

test('Pons candidate diagnostic distinguishes raw HTTP failure from viem success', async () => {
  const response = await handlePonsBootstrapDiagnostic(
    request(),
    { RAT_CANDIDATE_SMOKE_ENABLED: 'true', RAT_CANDIDATE_SMOKE_SECRET: SECRET },
    { externalFetch: rpcFetch(503), client: fakeClient }
  );
  assert.equal(response.status, 200);
  const body = await response.json() as {
    raw: { blockNumber: string };
    viem: { blockNumber: string };
    failures: Array<{ transport: string; operation: string; code: string | null; httpStatus: number | null }>;
  };
  assert.equal(body.raw.blockNumber, 'FAIL');
  assert.equal(body.viem.blockNumber, 'PASS');
  assert.ok(body.failures.some((failure) =>
    failure.transport === 'raw' && failure.operation === 'blockNumber' &&
    failure.code === 'PONS_RAW_HTTP_ERROR' && failure.httpStatus === 503
  ));
});
