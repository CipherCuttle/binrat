import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createPublicClient, getAddress, http, type Address, type Hex } from 'viem';
import { buildPonsLaunchReadinessReceipt } from '../src/ponsLaunchReceipt/receipt.js';

const DEFAULT_RPC_URL = 'https://rpc.mainnet.chain.robinhood.com';

const args = parseArgs(process.argv.slice(2));
const rpcUrl = args.rpc ?? process.env.ROBINHOOD_RPC_URL ?? DEFAULT_RPC_URL;
const deployer = optionalAddress(args.deployer ?? process.env.BINRAT_PONS_DEPLOYER);
const creatorFeeRecipient = optionalAddress(
  args['fee-recipient'] ?? process.env.BINRAT_PONS_FEE_RECIPIENT
);
const salt = optionalSalt(args.salt ?? process.env.BINRAT_PONS_SALT);

const client = createPublicClient({ transport: http(rpcUrl) });
const receipt = await buildPonsLaunchReadinessReceipt(client, {
  deployer,
  creatorFeeRecipient,
  salt,
  metadata: {
    name: 'BINRAT',
    symbol: 'BINRAT',
    logo: process.env.BINRAT_PONS_LOGO ?? '',
    description: process.env.BINRAT_PONS_DESCRIPTION ?? '',
    socials: {
      twitter: process.env.BINRAT_PONS_TWITTER ?? '',
      telegram: process.env.BINRAT_PONS_TELEGRAM ?? '',
      discord: process.env.BINRAT_PONS_DISCORD ?? '',
      website: process.env.BINRAT_PONS_WEBSITE ?? '',
      farcaster: process.env.BINRAT_PONS_FARCASTER ?? ''
    }
  }
});

const rendered = `${JSON.stringify(receipt, null, 2)}\n`;
if (args.out) {
  const output = resolve(args.out);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, rendered, { encoding: 'utf8', mode: 0o600 });
  console.error(`Pons launch readiness receipt written to ${output}`);
}
process.stdout.write(rendered);

process.exitCode = receipt.status === 'PASS'
  ? 0
  : receipt.status === 'OWNER_INPUT_REQUIRED'
    ? 2
    : 1;

function parseArgs(values: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]!;
    if (!value.startsWith('--')) throw new Error(`UNKNOWN_POSITIONAL_ARGUMENT:${value}`);
    const name = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`ARGUMENT_VALUE_REQUIRED:${name}`);
    parsed[name] = next;
    index += 1;
  }
  const allowed = new Set(['rpc', 'deployer', 'fee-recipient', 'salt', 'out']);
  for (const name of Object.keys(parsed)) {
    if (!allowed.has(name)) throw new Error(`UNKNOWN_ARGUMENT:${name}`);
  }
  return parsed;
}

function optionalAddress(value: string | undefined): Address | undefined {
  return value ? getAddress(value) : undefined;
}

function optionalSalt(value: string | undefined): Hex | undefined {
  if (!value) return undefined;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('BINRAT_PONS_SALT_INVALID');
  return value as Hex;
}
