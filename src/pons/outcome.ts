import { createPublicClient, getAddress, http, keccak256, type Address, type PublicClient } from 'viem';
import type { Hex } from '../core/types.js';
import { sha256Hex } from '../evidence/canonical.js';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH, ROBINHOOD_CHAIN_ID, robinhoodMainnet } from './chain.js';
import { ponsErc20Abi, ponsV2BondingCurveReadAbi } from './ponsAbi.js';
import { PONS_RPC_RETRY_COUNT, PONS_RPC_RETRY_DELAY_MS, PONS_RPC_TIMEOUT_MS } from './ponsSource.js';

export const PONS_OUTCOME_OBSERVATION_VERSION='BINRAT_PONS_OUTCOME_OBSERVATION_V1' as const;
export const NATIVE_QUOTE_ADDRESS='0x0000000000000000000000000000000000000000' as const;

export type PonsOutcomeStatus='COMPLETE'|'PARTIAL'|'UNVERIFIED';
export type PonsOutcomePhase='CURVE'|'GRADUATED';

export interface PonsOutcomeLaunch {
  launchId:string;
  token:Hex;
  curve:Hex;
  launchBlock:bigint;
}

export interface PonsOutcomeObservation {
  outcomeId:string;
  observationVersion:typeof PONS_OUTCOME_OBSERVATION_VERSION;
  chainId:typeof ROBINHOOD_CHAIN_ID;
  launchId:string;
  token:Hex;
  curve:Hex;
  observedBlock:bigint;
  observedBlockHash:Hex;
  phase:PonsOutcomePhase;
  quoteAsset:Hex;
  quoteDecimals:number | null;
  tokenDecimals:number | null;
  quoteReserve:bigint | null;
  tokenReserve:bigint | null;
  totalSupply:bigint | null;
  estimatedFdvQuoteRaw:bigint | null;
  status:PonsOutcomeStatus;
  missing:string[];
  evidenceDigest:string;
}

export interface PonsCurveState {
  token:Hex;
  pairToken:Hex;
  factory:Hex;
  graduated:boolean;
  quoteReserve:bigint;
  tokenReserve:bigint;
  tokenDecimals:number;
  totalSupply:bigint;
  quoteDecimals:number;
}

export interface PonsOutcomeSource {
  assertAuthority():Promise<void>;
  getBlockHash(blockNumber:bigint):Promise<Hex>;
  readCurveState(launch:PonsOutcomeLaunch,blockNumber:bigint):Promise<PonsCurveState>;
}

export class RpcPonsOutcomeSource implements PonsOutcomeSource {
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

  async getBlockHash(blockNumber:bigint):Promise<Hex> {
    const block=await this.client.getBlock({blockNumber});
    if (!block.hash) throw new Error(`PONS_OUTCOME_BLOCK_HASH_MISSING:${blockNumber}`);
    return block.hash as Hex;
  }

  async readCurveState(launch:PonsOutcomeLaunch,blockNumber:bigint):Promise<PonsCurveState> {
    assertLaunchShape(launch);
    const curve=launch.curve as Address,token=launch.token as Address;
    const [curveToken,pairToken,factory,graduated,reserves,tokenDecimals,totalSupply]=await Promise.all([
      this.client.readContract({address:curve,abi:ponsV2BondingCurveReadAbi,functionName:'token',blockNumber}),
      this.client.readContract({address:curve,abi:ponsV2BondingCurveReadAbi,functionName:'pairToken',blockNumber}),
      this.client.readContract({address:curve,abi:ponsV2BondingCurveReadAbi,functionName:'factory',blockNumber}),
      this.client.readContract({address:curve,abi:ponsV2BondingCurveReadAbi,functionName:'graduated',blockNumber}),
      this.client.readContract({address:curve,abi:ponsV2BondingCurveReadAbi,functionName:'getReserves',blockNumber}),
      this.client.readContract({address:token,abi:ponsErc20Abi,functionName:'decimals',blockNumber}),
      this.client.readContract({address:token,abi:ponsErc20Abi,functionName:'totalSupply',blockNumber})
    ]);
    const pair=getAddress(pairToken).toLowerCase() as Hex;
    const quoteDecimals=pair===NATIVE_QUOTE_ADDRESS
      ? 18
      : await this.client.readContract({address:pair as Address,abi:ponsErc20Abi,functionName:'decimals',blockNumber});
    return {
      token:getAddress(curveToken).toLowerCase() as Hex,
      pairToken:pair,
      factory:getAddress(factory).toLowerCase() as Hex,
      graduated:Boolean(graduated),
      quoteReserve:reserves[0],
      tokenReserve:reserves[1],
      tokenDecimals:Number(tokenDecimals),
      totalSupply,
      quoteDecimals:Number(quoteDecimals)
    };
  }
}

export async function observePonsOutcome(
  source:PonsOutcomeSource,
  launch:PonsOutcomeLaunch,
  observedBlock:bigint
):Promise<PonsOutcomeObservation> {
  assertLaunchShape(launch);
  if (observedBlock<launch.launchBlock) throw new Error('PONS_OUTCOME_BEFORE_LAUNCH');
  await source.assertAuthority();
  const before=(await source.getBlockHash(observedBlock)).toLowerCase() as Hex;
  const state=await source.readCurveState(launch,observedBlock);
  const after=(await source.getBlockHash(observedBlock)).toLowerCase() as Hex;
  if (before!==after) throw new Error('PONS_OUTCOME_REORG_DURING_READ');
  if (state.token!==launch.token.toLowerCase()) throw new Error('PONS_OUTCOME_TOKEN_BINDING_MISMATCH');
  if (state.factory!==PONS_V2_FACTORY.toLowerCase()) throw new Error('PONS_OUTCOME_FACTORY_BINDING_MISMATCH');

  const missing:string[]=[];
  let estimatedFdvQuoteRaw:bigint|null=null;
  if (!Number.isInteger(state.tokenDecimals) || state.tokenDecimals<0 || state.tokenDecimals>255) missing.push('TOKEN_DECIMALS');
  if (!Number.isInteger(state.quoteDecimals) || state.quoteDecimals<0 || state.quoteDecimals>255) missing.push('QUOTE_DECIMALS');
  if (state.totalSupply<0n) missing.push('TOTAL_SUPPLY');

  const phase:PonsOutcomePhase=state.graduated ? 'GRADUATED' : 'CURVE';
  if (phase==='GRADUATED') {
    missing.push('POST_GRADUATION_PRICE_AUTHORITY');
  } else if (state.quoteReserve<=0n || state.tokenReserve<=0n) {
    missing.push('CURVE_RESERVES');
  } else if (missing.length===0) {
    estimatedFdvQuoteRaw=estimateFdvQuoteRaw(state.quoteReserve,state.tokenReserve,state.totalSupply);
  }

  const status:PonsOutcomeStatus=estimatedFdvQuoteRaw!==null
    ? 'COMPLETE'
    : (state.quoteReserve>0n || state.tokenReserve>0n || state.totalSupply>=0n ? 'PARTIAL' : 'UNVERIFIED');

  const core:Omit<PonsOutcomeObservation,'outcomeId'|'evidenceDigest'>={
    observationVersion:PONS_OUTCOME_OBSERVATION_VERSION,
    chainId:ROBINHOOD_CHAIN_ID,
    launchId:launch.launchId,
    token:launch.token.toLowerCase() as Hex,
    curve:launch.curve.toLowerCase() as Hex,
    observedBlock,
    observedBlockHash:before,
    phase,
    quoteAsset:state.pairToken,
    quoteDecimals:validDecimals(state.quoteDecimals) ? state.quoteDecimals : null,
    tokenDecimals:validDecimals(state.tokenDecimals) ? state.tokenDecimals : null,
    quoteReserve:phase==='CURVE' ? state.quoteReserve : null,
    tokenReserve:phase==='CURVE' ? state.tokenReserve : null,
    totalSupply:state.totalSupply>=0n ? state.totalSupply : null,
    estimatedFdvQuoteRaw,
    status,
    missing:[...new Set(missing)].sort()
  };
  return {
    outcomeId:await sha256Hex({kind:PONS_OUTCOME_OBSERVATION_VERSION,launchId:launch.launchId,observedBlock,observedBlockHash:before}),
    ...core,
    evidenceDigest:await sha256Hex(core)
  };
}

export function estimateFdvQuoteRaw(
  quoteReserve:bigint,
  tokenReserve:bigint,
  totalSupply:bigint
):bigint {
  if (quoteReserve<=0n || tokenReserve<=0n || totalSupply<0n) throw new Error('PONS_OUTCOME_FDV_INPUT_INVALID');
  return quoteReserve*totalSupply/tokenReserve;
}

export async function verifyPonsOutcomeObservation(receipt:PonsOutcomeObservation):Promise<void> {
  if (!/^[0-9a-f]{64}$/.test(receipt.launchId) ||
      !/^0x[0-9a-f]{40}$/.test(receipt.token) ||
      !/^0x[0-9a-f]{40}$/.test(receipt.curve) ||
      !/^0x[0-9a-f]{40}$/.test(receipt.quoteAsset) ||
      !/^0x[0-9a-f]{64}$/.test(receipt.observedBlockHash) ||
      receipt.observedBlock<0n ||
      (receipt.quoteDecimals!==null && !validDecimals(receipt.quoteDecimals)) ||
      (receipt.tokenDecimals!==null && !validDecimals(receipt.tokenDecimals))) {
    throw new Error('PONS_OUTCOME_RECEIPT_INVALID');
  }
  const core:Omit<PonsOutcomeObservation,'outcomeId'|'evidenceDigest'>={
    observationVersion:receipt.observationVersion,
    chainId:receipt.chainId,
    launchId:receipt.launchId,
    token:receipt.token,
    curve:receipt.curve,
    observedBlock:receipt.observedBlock,
    observedBlockHash:receipt.observedBlockHash,
    phase:receipt.phase,
    quoteAsset:receipt.quoteAsset,
    quoteDecimals:receipt.quoteDecimals,
    tokenDecimals:receipt.tokenDecimals,
    quoteReserve:receipt.quoteReserve,
    tokenReserve:receipt.tokenReserve,
    totalSupply:receipt.totalSupply,
    estimatedFdvQuoteRaw:receipt.estimatedFdvQuoteRaw,
    status:receipt.status,
    missing:[...receipt.missing]
  };
  const expectedId=await sha256Hex({
    kind:PONS_OUTCOME_OBSERVATION_VERSION,
    launchId:receipt.launchId,
    observedBlock:receipt.observedBlock,
    observedBlockHash:receipt.observedBlockHash
  });
  if (receipt.observationVersion!==PONS_OUTCOME_OBSERVATION_VERSION ||
      receipt.chainId!==ROBINHOOD_CHAIN_ID ||
      receipt.outcomeId!==expectedId ||
      receipt.evidenceDigest!==await sha256Hex(core)) {
    throw new Error('PONS_OUTCOME_RECEIPT_INVALID');
  }

  if (receipt.phase==='GRADUATED') {
    if (receipt.estimatedFdvQuoteRaw!==null || receipt.quoteReserve!==null || receipt.tokenReserve!==null ||
        !receipt.missing.includes('POST_GRADUATION_PRICE_AUTHORITY')) {
      throw new Error('PONS_OUTCOME_RECEIPT_INVALID');
    }
    return;
  }

  if (receipt.phase!=='CURVE') throw new Error('PONS_OUTCOME_RECEIPT_INVALID');
  if (receipt.estimatedFdvQuoteRaw!==null) {
    if (receipt.quoteReserve===null || receipt.tokenReserve===null || receipt.totalSupply===null ||
        receipt.quoteReserve<=0n || receipt.tokenReserve<=0n || receipt.totalSupply<0n ||
        receipt.estimatedFdvQuoteRaw!==estimateFdvQuoteRaw(receipt.quoteReserve,receipt.tokenReserve,receipt.totalSupply) ||
        receipt.status!=='COMPLETE' || receipt.missing.length!==0) {
      throw new Error('PONS_OUTCOME_RECEIPT_INVALID');
    }
  } else if (receipt.status==='COMPLETE') {
    throw new Error('PONS_OUTCOME_RECEIPT_INVALID');
  }
}

function assertLaunchShape(launch:PonsOutcomeLaunch):void {
  if (!/^[0-9a-f]{64}$/.test(launch.launchId) ||
      !/^0x[0-9a-f]{40}$/.test(launch.token) ||
      !/^0x[0-9a-f]{40}$/.test(launch.curve) ||
      launch.launchBlock<0n) {
    throw new Error('PONS_OUTCOME_LAUNCH_INVALID');
  }
}

function validDecimals(value:number):boolean {
  return Number.isInteger(value) && value>=0 && value<=255;
}
