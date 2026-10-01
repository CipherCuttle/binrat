import { createPublicClient, getAddress, http, keccak256, zeroAddress, type Address, type PublicClient } from 'viem';
import type { Hex } from '../core/types.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH, ROBINHOOD_CHAIN_ID, robinhoodMainnet } from './chain.js';
import { ponsErc20Abi, ponsV2BondingCurveAbi } from './ponsAbi.js';
import { PONS_RPC_RETRY_COUNT, PONS_RPC_RETRY_DELAY_MS, PONS_RPC_TIMEOUT_MS } from './ponsSource.js';

export const PONS_OUTCOME_PROBE_VERSION = 'BINRAT_PONS_OUTCOME_PROBE_V1' as const;

export interface PonsOutcomeLaunchRef {
  launchId:string;
  token:Hex;
  curve:Hex;
}

export interface PonsOutcomeBlockPoint {
  blockNumber:bigint;
  blockHash:Hex;
  timestampMs:number;
}

export interface PonsCurveState {
  curveToken:Hex;
  pairToken:Hex;
  graduated:boolean;
  quoteReserve:bigint;
  tokenReserve:bigint;
  tokenDecimals:number;
  quoteDecimals:number;
  totalSupply:bigint;
}

export interface PonsOutcomeProbeSource {
  assertAuthority():Promise<void>;
  getBlockPoint(blockNumber:bigint):Promise<PonsOutcomeBlockPoint>;
  readCurveState(launch:PonsOutcomeLaunchRef,blockNumber:bigint):Promise<PonsCurveState>;
}

export interface PonsOutcomeProbeReceipt {
  probeId:string;
  probeVersion:typeof PONS_OUTCOME_PROBE_VERSION;
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
  tokenDecimals:number;
  totalSupply:bigint;
  quoteReserve:bigint;
  tokenReserve:bigint;
  /** Exact numerator for reserve-ratio FDV in raw quote units. */
  estimatedFdvQuoteNumerator?:bigint;
  /** Exact denominator for reserve-ratio FDV in raw quote units. */
  estimatedFdvQuoteDenominator?:bigint;
  /** Floor(numerator / denominator), still in raw quote units. */
  estimatedFdvQuoteRawFloor?:bigint;
  evidenceDigest:string;
}

export class RpcPonsOutcomeProbeSource implements PonsOutcomeProbeSource {
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

  async getBlockPoint(blockNumber:bigint):Promise<PonsOutcomeBlockPoint> {
    const block=await this.client.getBlock({blockNumber});
    if (!block.hash) throw new Error(`PONS_OUTCOME_BLOCK_HASH_MISSING:${blockNumber}`);
    const timestampMs=Number(block.timestamp*1000n);
    if (!Number.isSafeInteger(timestampMs) || timestampMs<0) throw new Error('PONS_OUTCOME_BLOCK_TIMESTAMP_INVALID');
    return {blockNumber,blockHash:block.hash as Hex,timestampMs};
  }

  async readCurveState(launch:PonsOutcomeLaunchRef,blockNumber:bigint):Promise<PonsCurveState> {
    const curve=launch.curve as Address;
    const token=launch.token as Address;
    const [curveToken,pairToken,graduated,reserves,tokenDecimals,totalSupply]=await Promise.all([
      this.client.readContract({address:curve,abi:ponsV2BondingCurveAbi,functionName:'token',blockNumber}),
      this.client.readContract({address:curve,abi:ponsV2BondingCurveAbi,functionName:'pairToken',blockNumber}),
      this.client.readContract({address:curve,abi:ponsV2BondingCurveAbi,functionName:'graduated',blockNumber}),
      this.client.readContract({address:curve,abi:ponsV2BondingCurveAbi,functionName:'getReserves',blockNumber}),
      this.client.readContract({address:token,abi:ponsErc20Abi,functionName:'decimals',blockNumber}),
      this.client.readContract({address:token,abi:ponsErc20Abi,functionName:'totalSupply',blockNumber})
    ]);
    const normalizedCurveToken=getAddress(curveToken).toLowerCase() as Hex;
    if (normalizedCurveToken!==launch.token.toLowerCase()) throw new Error('PONS_OUTCOME_CURVE_TOKEN_MISMATCH');
    const normalizedPair=getAddress(pairToken).toLowerCase() as Hex;
    const quoteDecimals=normalizedPair===zeroAddress
      ? 18
      : await this.client.readContract({address:normalizedPair as Address,abi:ponsErc20Abi,functionName:'decimals',blockNumber});
    if (!Number.isInteger(tokenDecimals) || tokenDecimals<0 || tokenDecimals>255 ||
        !Number.isInteger(quoteDecimals) || quoteDecimals<0 || quoteDecimals>255) {
      throw new Error('PONS_OUTCOME_DECIMALS_INVALID');
    }
    const [quoteReserve,tokenReserve]=reserves;
    if (typeof quoteReserve!=='bigint' || typeof tokenReserve!=='bigint' || typeof totalSupply!=='bigint') {
      throw new Error('PONS_OUTCOME_STATE_INVALID');
    }
    return {
      curveToken:normalizedCurveToken,
      pairToken:normalizedPair,
      graduated,
      quoteReserve,
      tokenReserve,
      tokenDecimals,
      quoteDecimals,
      totalSupply
    };
  }
}

/**
 * Reserve-ratio valuation only. This is the infinitesimal, pre-fee curve spot
 * implied by Pons's constant-product reserves, multiplied by totalSupply()
 * observed at the same block. It is not an executable full-supply liquidation
 * quote and must never be labeled market cap.
 */
export function derivePonsCurveFdvRaw(input:{
  quoteReserve:bigint;
  tokenReserve:bigint;
  totalSupply:bigint;
}):{numerator:bigint;denominator:bigint;floorRaw:bigint} {
  if (input.quoteReserve<=0n || input.tokenReserve<=0n || input.totalSupply<0n) {
    throw new Error('PONS_OUTCOME_CURVE_UNPRICEABLE');
  }
  const numerator=input.quoteReserve*input.totalSupply;
  const denominator=input.tokenReserve;
  return {numerator,denominator,floorRaw:numerator/denominator};
}

export async function probePonsOutcomeAtBlock(
  source:PonsOutcomeProbeSource,
  launch:PonsOutcomeLaunchRef,
  blockNumber:bigint
):Promise<PonsOutcomeProbeReceipt> {
  if (!/^[0-9a-f]{64}$/.test(launch.launchId) ||
      !/^0x[0-9a-f]{40}$/.test(launch.token) ||
      !/^0x[0-9a-f]{40}$/.test(launch.curve) ||
      blockNumber<0n) {
    throw new Error('PONS_OUTCOME_INPUT_INVALID');
  }
  await source.assertAuthority();
  const before=await source.getBlockPoint(blockNumber);
  const state=await source.readCurveState(launch,blockNumber);
  if (state.curveToken.toLowerCase()!==launch.token.toLowerCase()) throw new Error('PONS_OUTCOME_CURVE_TOKEN_MISMATCH');
  const after=await source.getBlockPoint(blockNumber);
  if (before.blockHash.toLowerCase()!==after.blockHash.toLowerCase() || before.timestampMs!==after.timestampMs) {
    throw new Error('PONS_OUTCOME_REORG_DURING_READ');
  }

  const valuation=state.graduated ? null : derivePonsCurveFdvRaw(state);
  const core:Omit<PonsOutcomeProbeReceipt,'probeId'|'evidenceDigest'>={
    probeVersion:PONS_OUTCOME_PROBE_VERSION,
    chainId:ROBINHOOD_CHAIN_ID,
    launchId:launch.launchId,
    token:launch.token.toLowerCase() as Hex,
    curve:launch.curve.toLowerCase() as Hex,
    observedBlock:blockNumber,
    observedBlockHash:before.blockHash.toLowerCase() as Hex,
    observedTimestampMs:before.timestampMs,
    phase:state.graduated ? 'GRADUATED' : 'CURVE',
    pairToken:state.pairToken.toLowerCase() as Hex,
    quoteDecimals:state.quoteDecimals,
    tokenDecimals:state.tokenDecimals,
    totalSupply:state.totalSupply,
    quoteReserve:state.quoteReserve,
    tokenReserve:state.tokenReserve,
    ...(valuation ? {
      estimatedFdvQuoteNumerator:valuation.numerator,
      estimatedFdvQuoteDenominator:valuation.denominator,
      estimatedFdvQuoteRawFloor:valuation.floorRaw
    } : {})
  };
  return {
    probeId:await sha256Hex({kind:PONS_OUTCOME_PROBE_VERSION,launchId:launch.launchId,blockNumber,blockHash:before.blockHash.toLowerCase()}),
    ...core,
    evidenceDigest:await sha256Hex(core)
  };
}

export async function verifyPonsOutcomeProbeReceipt(receipt:PonsOutcomeProbeReceipt):Promise<void> {
  if (receipt.probeVersion!==PONS_OUTCOME_PROBE_VERSION || receipt.chainId!==ROBINHOOD_CHAIN_ID) {
    throw new Error('PONS_OUTCOME_RECEIPT_VERSION_INVALID');
  }
  if (receipt.phase==='CURVE') {
    const valuation=derivePonsCurveFdvRaw(receipt);
    if (
      receipt.estimatedFdvQuoteNumerator!==valuation.numerator ||
      receipt.estimatedFdvQuoteDenominator!==valuation.denominator ||
      receipt.estimatedFdvQuoteRawFloor!==valuation.floorRaw
    ) throw new Error('PONS_OUTCOME_RECEIPT_VALUATION_INVALID');
  } else if (
    receipt.estimatedFdvQuoteNumerator!==undefined ||
    receipt.estimatedFdvQuoteDenominator!==undefined ||
    receipt.estimatedFdvQuoteRawFloor!==undefined
  ) {
    throw new Error('PONS_OUTCOME_GRADUATED_VALUATION_FORBIDDEN');
  }
  const core={
    probeVersion:receipt.probeVersion,
    chainId:receipt.chainId,
    launchId:receipt.launchId,
    token:receipt.token,
    curve:receipt.curve,
    observedBlock:receipt.observedBlock,
    observedBlockHash:receipt.observedBlockHash,
    observedTimestampMs:receipt.observedTimestampMs,
    phase:receipt.phase,
    pairToken:receipt.pairToken,
    quoteDecimals:receipt.quoteDecimals,
    tokenDecimals:receipt.tokenDecimals,
    totalSupply:receipt.totalSupply,
    quoteReserve:receipt.quoteReserve,
    tokenReserve:receipt.tokenReserve,
    ...(receipt.phase==='CURVE' ? {
      estimatedFdvQuoteNumerator:receipt.estimatedFdvQuoteNumerator,
      estimatedFdvQuoteDenominator:receipt.estimatedFdvQuoteDenominator,
      estimatedFdvQuoteRawFloor:receipt.estimatedFdvQuoteRawFloor
    } : {})
  };
  if (await sha256Hex(core)!==receipt.evidenceDigest) throw new Error('PONS_OUTCOME_RECEIPT_DIGEST_INVALID');
  const expectedId=await sha256Hex({
    kind:PONS_OUTCOME_PROBE_VERSION,
    launchId:receipt.launchId,
    blockNumber:receipt.observedBlock,
    blockHash:receipt.observedBlockHash
  });
  if (expectedId!==receipt.probeId || canonicalJson(core)===canonicalJson({})) {
    throw new Error('PONS_OUTCOME_RECEIPT_ID_INVALID');
  }
}
