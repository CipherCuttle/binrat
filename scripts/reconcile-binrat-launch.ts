import { createPublicClient, http, type Hex } from 'viem';
import { reconcileLaunchExecution } from '../src/launchExecution/dryRun.js';

const txHash = process.argv[2] as Hex | undefined;
if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
  throw new Error('USAGE: pnpm exec tsx scripts/reconcile-binrat-launch.ts <future-launch-tx-hash>');
}

const rpcUrl = process.env.ARC_RPC_URL ?? 'https://rpc.mainnet.arc.io';
const client = createPublicClient({ transport: http(rpcUrl) });
const receipt = await reconcileLaunchExecution(client, txHash);
console.log(JSON.stringify(receipt, null, 2));
