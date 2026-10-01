import { canonicalJson } from '../src/evidence/canonical.js';
import type { Hex } from '../src/core/types.js';
import { probePonsOutcomeAtBlock, RpcPonsOutcomeProbeSource, verifyPonsOutcomeProbeReceipt } from '../src/pons/outcomeProbe.js';

const [launchId,token,curve,blockText]=process.argv.slice(2);
if (!launchId || !token || !curve || !blockText) {
  throw new Error('USAGE: pnpm probe:pons-outcome <launchId> <token> <curve> <blockNumber>');
}
if (!/^[0-9a-f]{64}$/.test(launchId) || !/^0x[0-9a-fA-F]{40}$/.test(token) || !/^0x[0-9a-fA-F]{40}$/.test(curve) || !/^\d+$/.test(blockText)) {
  throw new Error('PONS_OUTCOME_PROBE_ARGUMENT_INVALID');
}
const rpcUrl=process.env.ROBINHOOD_RPC_URL?.trim();
if (!rpcUrl) throw new Error('ROBINHOOD_RPC_URL_REQUIRED');

const source=new RpcPonsOutcomeProbeSource({rpcUrl});
const receipt=await probePonsOutcomeAtBlock(source,{
  launchId,
  token:token.toLowerCase() as Hex,
  curve:curve.toLowerCase() as Hex
},BigInt(blockText));
await verifyPonsOutcomeProbeReceipt(receipt);
process.stdout.write(canonicalJson(receipt)+'\n');
