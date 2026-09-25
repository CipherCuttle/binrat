/**
 * Operator-only bounded, read-only 4663 evidence collector.
 * This is never invoked by CI, Worker, scheduled job or Telegram.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createPublicClient, defineChain, http, type Hex } from 'viem';
import { collectPonsReceiptProof, probePonsHistoricalFactory } from '../src/pons/liveEvidence.js';

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const [, , command, ...argv] = process.argv;
const args = parseArgs(argv);
const rpc = args.rpc ?? process.env.ROBINHOOD_RPC_URL ?? RPC;
if (!/^https:\/\//.test(rpc)) throw new Error('PONS_HTTPS_RPC_ONLY');
const client = createPublicClient({
  chain: defineChain({
    id: 4663, name: 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } }
  }),
  transport: http(rpc, { timeout: 15_000, retryCount: 1 })
});

if (command === 'probe') {
  onlyArgs(args, ['rpc', 'block']);
  const block = requiredBlock(args.block, 'block');
  const result = await probePonsHistoricalFactory(client, block);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else if (command === 'collect') {
  onlyArgs(args, ['rpc', 'from', 'to', 'code-hash', 'max-windows', 'out']);
  const fromBlock = requiredBlock(args.from, 'from');
  const toBlock = requiredBlock(args.to, 'to');
  const hash = args['code-hash'];
  if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error('PONS_OPERATOR_CONFIRMED_HISTORICAL_CODE_PIN_REQUIRED');
  }
  const maxWindows = args['max-windows'] ? Number(args['max-windows']) : 12;
  const proof = await collectPonsReceiptProof(client, {
    fromBlock, toBlock, expectedFactoryCodeHash: hash as Hex, maxWindows
  });
  const text = JSON.stringify(proof, null, 2) + '\n';
  if (args.out) {
    const output = resolve(args.out);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, text, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    process.stderr.write('Read-only candidate proof written (never auto-imported): ' + output + '\n');
  }
  process.stdout.write(text);
} else {
  throw new Error('PONS_USAGE: probe --block N | collect --from N --to N --code-hash 0x... [--max-windows 12] [--out path] [--rpc https://...]');
}

function parseArgs(values: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < values.length; i += 2) {
    const key = values[i];
    const next = values[i + 1];
    if (!key?.startsWith('--') || !next || next.startsWith('--')) {
      throw new Error('PONS_ARGUMENT_PAIR_REQUIRED');
    }
    const name = key.slice(2);
    if (name in parsed) throw new Error('PONS_DUPLICATE_ARG:' + name);
    parsed[name] = next;
  }
  return parsed;
}
function onlyArgs(args: Record<string, string>, names: string[]) {
  for (const key of Object.keys(args)) {
    if (!names.includes(key)) throw new Error('PONS_UNKNOWN_ARG:' + key);
  }
}
function requiredBlock(value: string | undefined, name: string): bigint {
  if (!value || !/^\d{1,17}$/.test(value)) throw new Error('PONS_BLOCK_REQUIRED:' + name);
  return BigInt(value);
}
