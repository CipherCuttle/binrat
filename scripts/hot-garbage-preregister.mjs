const RPC_URL = process.env.ARC_RPC_URL || 'https://rpc.arc-scan.org';
const ARCPAD_API = process.env.BINRAT_ARCPAD_API || 'https://arcpad.meme';
const EXPECTED_CHAIN_ID = 5042;
const LAUNCHER = '0x24196cd6e534cfce8f480b53e70809b68ea86f29';

async function rpc(method, params = []) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`RPC_HTTP_${response.status}:${method}`);
  const body = await response.json();
  if (body.error) throw new Error(`RPC_ERROR:${method}:${JSON.stringify(body.error)}`);
  return body.result;
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP_${response.status}:${url}`);
  return response.json();
}

const chainIdHex = await rpc('eth_chainId');
const chainId = Number.parseInt(chainIdHex, 16);
if (chainId !== EXPECTED_CHAIN_ID) {
  throw new Error(`ARC_CHAIN_ID_DRIFT:expected=${EXPECTED_CHAIN_ID}:actual=${chainId}`);
}

const blockHex = await rpc('eth_blockNumber');
const startBlock = BigInt(blockHex);
const block = await rpc('eth_getBlockByNumber', [blockHex, false]);
if (!block?.hash) throw new Error(`START_BLOCK_HASH_MISSING:${startBlock}`);

const [clientVersion, status, tokens] = await Promise.all([
  rpc('web3_clientVersion').catch(() => null),
  getJson(`${ARCPAD_API}/api/status`).catch((error) => ({ unavailable: true, error: String(error) })),
  getJson(`${ARCPAD_API}/api/tokens?limit=5`).catch((error) => ({ unavailable: true, error: String(error), creations: [] }))
]);

const latest = Array.isArray(tokens?.creations) && tokens.creations.length > 0
  ? tokens.creations[0]
  : null;

const preregistration = {
  schemaVersion: 'binrat.hot-garbage-72h.prereg.v0',
  startedAt: new Date().toISOString(),
  windowHours: 72,
  chainId,
  launcher: LAUNCHER,
  startBlock: startBlock.toString(),
  startBlockHash: String(block.hash).toLowerCase(),
  rpc: {
    url: RPC_URL,
    clientVersion
  },
  arcPadSnapshot: {
    status,
    apiServedAt: tokens?.servedAt ?? null,
    apiState: tokens?.state ?? null,
    latestLaunch: latest ? {
      token: latest.token ?? null,
      creator: latest.creator ?? null,
      blockNumber: latest.blockNumber ?? null,
      symbol: latest.symbol ?? null
    } : null
  },
  decisionRules: {
    arcPadOnlyContinue: '>=25 launches in window',
    addSecondSource: '10-24 launches in window',
    arcPadOnlyTooSparse: '<10 launches in window'
  },
  claimBoundary: 'ArcPad creator is an onchain address reported by TokenCreated, not proof of human identity, EOA ownership, or ultimate deploying actor.'
};

process.stdout.write(`${JSON.stringify(preregistration, null, 2)}\n`);
