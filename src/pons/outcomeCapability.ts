import { createPublicClient, http, keccak256, type Address, type PublicClient } from 'viem';
import type { Hex } from '../core/types.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH, ROBINHOOD_CHAIN_ID, robinhoodMainnet } from './chain.js';
import { ponsErc20Abi, ponsV2BondingCurveReadAbi, ponsV2FactoryOutcomeReadAbi } from './ponsAbi.js';
import { PONS_RPC_RETRY_COUNT, PONS_RPC_RETRY_DELAY_MS, PONS_RPC_TIMEOUT_MS } from './ponsSource.js';

export const PONS_CURVE_OUTCOME_CAPABILITY_VERSION = 'BINRAT_PONS_CURVE_OUTCOME_CAPABILITY_V1' as const;
export const NATIVE_QUOTE = '0x0000000000000000000000000000000000000000' as Hex;

export interface PonsOutcomeLaunch {
  launchId:string;
  token:Hex;
  curve:Hex;
}

export interface PonsCurveStateAtBlock {
  launch:PonsOutcomeLaunch;
  observedBlock:bigint;
  observedBlockHash:Hex;
  observedTimestampMs:number;
  pairToken:Hex;
  quoteDecimals:number;
  totalSupply:bigint;
  graduated:boolean;
  quoteReserve:bigint|null;
  tokenReserve:bigint|null;
}

export interface PonsCurveOutcomeCapabilityReceipt {
  outcomeId:string;
  outcomeVersion:typeof PONS_CURVE_OUTCOME_CAPABILITY_VERSION;
  chainId:typeof ROBINHOOD_CHAIN_ID;
  launchId:string;
  token:Hex;
  curve:Hex;
  observedBlock:bigint;
  observedBlockHash:Hex;
  observedTimestampMs:number;
  phase:'CURVE'|'GRADUATED';
  pairToken:Hex;
  quoteDecimals:number;
  totalSupply:bigint;
  quoteReserve:bigint|null;
  tokenReserve:bigint|null;
  estimatedFdvQuoteRaw:bigint|null;
  status:'COMPLETE'|'PARTIAL';
  missing:string[];
  evidenceDigest:string;
}

export interface PonsCurveOutcomeSource {
  assertAuthority():Promise<void>;
  readStateAt(launch:PonsOutcomeLaunch,blockNumber:bigint):Promise<PonsCurveStateAtBlock>;
}

function normalizedAddress(value:string,code:string):Hex {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error(code);
  return value.toLowerCase() as Hex;
}

export class RpcPonsCurveOutcomeSource implements PonsCurveOutcomeSource {
  private readonly client:PublicClient;
  private authorityVerified=false;

  constructor(options:{rpcUrl?:string;client?:PublicClient}={}) {
    if (!options.client && !options.rpcUrl) throw new Error('ROBINHOOD_RPC_URL_REQUIRED');
    this.client=options.client ?? createPublicClient({
      chain:robinhoodMainnet(options.rpcUrl!),
      transport:http(options.rpcUrl!,{
        timeout:PONS_RPC_TIMEOUT_MS,
        retryCount:PONS_RPC_RETRY_COUNT,
        retryDelay:PONS_RPC_RETRY_DELAY_MS
      })
    });
  }

  async assertAuthority():Promise<void> {
    if (this.authorityVerified) return;
    const chainId=await this.client.getChainId();
    if (chainId!==ROBINHOOD_CHAIN_ID) throw new Error('PONS_OUTCOME_CHAIN_ID_DRIFT');
    const code=await this.client.getBytecode({address:PONS_V2_FACTORY as Address});
    if (!code || keccak256(code)!==PONS_V2_FACTORY_CODE_HASH) throw new Error('PONS_OUTCOME_FACTORY_AUTHORITY_DRIFT');
    this.authorityVerified=true;
  }

  async readStateAt(launch:PonsOutcomeLaunch,blockNumber:bigint):Promise<PonsCurveStateAtBlock> {
    await this.assertAuthority();
    if (!/^[0-9a-f]{64}$/.test(launch.launchId)) throw new Error('PONS_OUTCOME_LAUNCH_ID_INVALID');
    const token=normalizedAddress(launch.token,'PONS_OUTCOME_TOKEN_INVALID');
    const curve=normalizedAddress(launch.curve,'PONS_OUTCOME_CURVE_INVALID');

    const block=await this.client.getBlock({blockNumber});
    if (!block.hash) throw new Error('PONS_OUTCOME_BLOCK_HASH_MISSING');
    const observedBlockHash=block.hash.toLowerCase() as Hex;
    const timestampMs=Number(block.timestamp*1000n);
    if (!Number.isSafeInteger(timestampMs)) throw new Error('PONS_OUTCOME_BLOCK_TIMESTAMP_INVALID');

    const [registry,curveTokenRaw,pairTokenRaw,graduated,totalSupply]=await Promise.all([
      this.client.readContract({
        address:PONS_V2_FACTORY as Address,
        abi:ponsV2FactoryOutcomeReadAbi,
        functionName:'getLaunchedToken',
        args:[token as Address],
        blockNumber
      }),
      this.client.readContract({address:curve as Address,abi:ponsV2BondingCurveReadAbi,functionName:'token',blockNumber}),
      this.client.readContract({address:curve as Address,abi:ponsV2BondingCurveReadAbi,functionName:'pairToken',blockNumber}),
      this.client.readContract({address:curve as Address,abi:ponsV2BondingCurveReadAbi,functionName:'graduated',blockNumber}),
      this.client.readContract({address:token as Address,abi:ponsErc20Abi,functionName:'totalSupply',blockNumber})
    ]);
    if (!registry.exists) throw new Error('PONS_OUTCOME_FACTORY_LAUNCH_MISSING');
    const registryToken=normalizedAddress(String(registry.token),'PONS_OUTCOME_FACTORY_TOKEN_INVALID');
    const registryCurve=normalizedAddress(String(registry.curve),'PONS_OUTCOME_FACTORY_CURVE_INVALID');
    const registryPairToken=normalizedAddress(String(registry.pairToken),'PONS_OUTCOME_FACTORY_PAIR_INVALID');
    if (registryToken!==token || registryCurve!==curve) throw new Error('PONS_OUTCOME_FACTORY_LAUNCH_MISMATCH');

    const curveToken=normalizedAddress(String(curveTokenRaw),'PONS_OUTCOME_CURVE_TOKEN_INVALID');
    if (curveToken!==token) throw new Error('PONS_OUTCOME_CURVE_TOKEN_MISMATCH');
    const pairToken=normalizedAddress(String(pairTokenRaw),'PONS_OUTCOME_PAIR_TOKEN_INVALID');
    if (registryPairToken!==pairToken) throw new Error('PONS_OUTCOME_PAIR_TOKEN_MISMATCH');
    if (typeof graduated!=='boolean' || typeof totalSupply!=='bigint' || totalSupply<0n) {
      throw new Error('PONS_OUTCOME_CORE_STATE_INVALID');
    }
    const registryGraduated=Number(registry.phase)!==0;
    if (registryGraduated!==graduated) throw new Error('PONS_OUTCOME_GRADUATION_STATE_MISMATCH');

    const quoteDecimals=pairToken===NATIVE_QUOTE
      ? 18
      : Number(await this.client.readContract({
          address:pairToken as Address,abi:ponsErc20Abi,functionName:'decimals',blockNumber
        }));
    if (!Number.isInteger(quoteDecimals) || quoteDecimals<0 || quoteDecimals>255) {
      throw new Error('PONS_OUTCOME_QUOTE_DECIMALS_INVALID');
    }

    let quoteReserve:bigint|null=null;
    let tokenReserve:bigint|null=null;
    if (!graduated) {
      const reserves=await this.client.readContract({
        address:curve as Address,abi:ponsV2BondingCurveReadAbi,functionName:'getReserves',blockNumber
      });
      quoteReserve=reserves[0];
      tokenReserve=reserves[1];
      if (typeof quoteReserve!=='bigint' || typeof tokenReserve!=='bigint' || quoteReserve<0n || tokenReserve<0n) {
        throw new Error('PONS_OUTCOME_RESERVES_INVALID');
      }
    }

    const confirmedBlock=await this.client.getBlock({blockNumber});
    if (!confirmedBlock.hash || confirmedBlock.hash.toLowerCase()!==observedBlockHash) {
      throw new Error('PONS_OUTCOME_BLOCK_REORG_DURING_READ');
    }
    if (confirmedBlock.timestamp!==block.timestamp) {
      throw new Error('PONS_OUTCOME_BLOCK_TIMESTAMP_DRIFT');
    }

    return {
      launch:{launchId:launch.launchId,token,curve},
      observedBlock:blockNumber,
      observedBlockHash,
      observedTimestampMs:timestampMs,
      pairToken,
      quoteDecimals,
      totalSupply,
      graduated,
      quoteReserve,
      tokenReserve
    };
  }
}

export async function buildPonsCurveOutcomeCapabilityReceipt(
  state:PonsCurveStateAtBlock
):Promise<PonsCurveOutcomeCapabilityReceipt> {
  const token=normalizedAddress(state.launch.token,'PONS_OUTCOME_TOKEN_INVALID');
  const curve=normalizedAddress(state.launch.curve,'PONS_OUTCOME_CURVE_INVALID');
  const pairToken=normalizedAddress(state.pairToken,'PONS_OUTCOME_PAIR_TOKEN_INVALID');
  if (!/^[0-9a-f]{64}$/.test(state.launch.launchId)) throw new Error('PONS_OUTCOME_LAUNCH_ID_INVALID');
  if (!/^0x[0-9a-fA-F]{64}$/.test(state.observedBlockHash)) throw new Error('PONS_OUTCOME_BLOCK_HASH_INVALID');
  if (!Number.isSafeInteger(state.observedTimestampMs) || state.observedTimestampMs<0) throw new Error('PONS_OUTCOME_BLOCK_TIMESTAMP_INVALID');
  if (!Number.isInteger(state.quoteDecimals) || state.quoteDecimals<0 || state.quoteDecimals>255) throw new Error('PONS_OUTCOME_QUOTE_DECIMALS_INVALID');
  if (state.totalSupply<0n) throw new Error('PONS_OUTCOME_TOTAL_SUPPLY_INVALID');

  let estimatedFdvQuoteRaw:bigint|null=null;
  let status:'COMPLETE'|'PARTIAL'='PARTIAL';
  let missing:string[]=['V4_POOL_STATE'];
  let quoteReserve:bigint|null=null;
  let tokenReserve:bigint|null=null;
  const phase=state.graduated ? 'GRADUATED' as const : 'CURVE' as const;

  if (!state.graduated) {
    quoteReserve=state.quoteReserve;
    tokenReserve=state.tokenReserve;
    missing=[];
    if (quoteReserve===null || tokenReserve===null) {
      missing.push('CURVE_RESERVES');
    } else if (quoteReserve<0n || tokenReserve<=0n) {
      missing.push('USABLE_CURVE_RESERVES');
    } else {
      estimatedFdvQuoteRaw=(quoteReserve*state.totalSupply)/tokenReserve;
      status='COMPLETE';
    }
  }

  const core:Omit<PonsCurveOutcomeCapabilityReceipt,'outcomeId'|'evidenceDigest'>={
    outcomeVersion:PONS_CURVE_OUTCOME_CAPABILITY_VERSION,
    chainId:ROBINHOOD_CHAIN_ID,
    launchId:state.launch.launchId,
    token,
    curve,
    observedBlock:state.observedBlock,
    observedBlockHash:state.observedBlockHash.toLowerCase() as Hex,
    observedTimestampMs:state.observedTimestampMs,
    phase,
    pairToken,
    quoteDecimals:state.quoteDecimals,
    totalSupply:state.totalSupply,
    quoteReserve,
    tokenReserve,
    estimatedFdvQuoteRaw,
    status,
    missing
  };
  return {
    outcomeId:await sha256Hex({
      kind:PONS_CURVE_OUTCOME_CAPABILITY_VERSION,
      chainId:ROBINHOOD_CHAIN_ID,
      launchId:state.launch.launchId,
      observedBlock:state.observedBlock.toString(),
      observedBlockHash:state.observedBlockHash.toLowerCase()
    }),
    ...core,
    evidenceDigest:await sha256Hex(core)
  };
}

export async function verifyPonsCurveOutcomeCapabilityReceipt(
  receipt:PonsCurveOutcomeCapabilityReceipt
):Promise<void> {
  const rebuilt=await buildPonsCurveOutcomeCapabilityReceipt({
    launch:{launchId:receipt.launchId,token:receipt.token,curve:receipt.curve},
    observedBlock:receipt.observedBlock,
    observedBlockHash:receipt.observedBlockHash,
    observedTimestampMs:receipt.observedTimestampMs,
    pairToken:receipt.pairToken,
    quoteDecimals:receipt.quoteDecimals,
    totalSupply:receipt.totalSupply,
    graduated:receipt.phase==='GRADUATED',
    quoteReserve:receipt.quoteReserve,
    tokenReserve:receipt.tokenReserve
  });
  if (canonicalJson(rebuilt)!==canonicalJson(receipt)) throw new Error('PONS_OUTCOME_RECEIPT_INVALID');
}

export async function readPonsCurveOutcomeCapability(
  source:PonsCurveOutcomeSource,
  launch:PonsOutcomeLaunch,
  blockNumber:bigint
):Promise<PonsCurveOutcomeCapabilityReceipt> {
  const state=await source.readStateAt(launch,blockNumber);
  const receipt=await buildPonsCurveOutcomeCapabilityReceipt(state);
  await verifyPonsCurveOutcomeCapabilityReceipt(receipt);
  return receipt;
}
