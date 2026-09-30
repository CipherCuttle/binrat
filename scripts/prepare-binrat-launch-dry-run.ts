import { createPublicClient, http, type Address } from 'viem';
import { buildUnsignedLaunchIntent, type LaunchMetadataInput } from '../src/launchExecution/dryRun.js';

const rpcUrl = process.env.ARC_RPC_URL ?? 'https://rpc.mainnet.arc.io';
const metadata = process.env.BINRAT_LAUNCH_METADATA_JSON
  ? JSON.parse(process.env.BINRAT_LAUNCH_METADATA_JSON) as LaunchMetadataInput
  : undefined;
const signer = process.env.BINRAT_LAUNCH_SIGNER as Address | undefined;
const client = createPublicClient({ transport: http(rpcUrl) });

const intent = await buildUnsignedLaunchIntent(client, { metadata, signer });
console.log(JSON.stringify(intent, null, 2));
