import { createPublicClient, http, keccak256, type Address, type PublicClient } from 'viem';
import type { Hex } from '../core/types.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { PONS_V2_FACTORY, PONS_V2_FACTORY_CODE_HASH, ROBINHOOD_CHAIN_ID, robinhoodMainnet } from './chain.js';
import { ponsErc20Abi } from './ponsAbi.js';
import { PONS_RPC_RETRY_COUNT, PONS_RPC_RETRY_DELAY_MS, PONS_RPC_TIMEOUT_MS } from './ponsSource.js';

export const PONS_TOKEN_IDENTITY_VERSION = 'BINRAT_PONS_TOKEN_IDENTITY_V1' as const;

export interface PonsTokenIdentityLaunch {
  launchId: string;
  token: Hex;
}

export interface PonsTokenIdentityReceipt {
  identityId: string;
  identityVersion: typeof PONS_TOKEN_IDENTITY_VERSION;
  chainId: typeof ROBINHOOD_CHAIN_ID;
  launchId: string;
  token: Hex;
  observedBlock: bigint;
  observedBlockHash: Hex;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  evidenceDigest: string;
}

export interface PonsTokenIdentitySource {
  assertAuthority(): Promise<void>;
  getBlockHash(blockNumber: bigint): Promise<Hex>;
  readIdentity(
    launch: PonsTokenIdentityLaunch,
    blockNumber: bigint
  ): Promise<Pick<PonsTokenIdentityReceipt,'name'|'symbol'|'decimals'|'totalSupply'>>;
}

export interface PonsTokenIdentityStore {
  getCheckpoint(): Promise<{blockNumber:bigint;blockHash:Hex}|null>;
  listMissing(limit:number): Promise<PonsTokenIdentityLaunch[]>;
  put(receipt:PonsTokenIdentityReceipt): Promise<'INSERTED'|'DUPLICATE'>;
}

export interface PonsTokenIdentitySyncReport {
  observedBlock: bigint | null;
  attempted: number;
  inserted: number;
  duplicates: number;
  failed: number;
  remaining: number;
}

export class RpcPonsTokenIdentitySource implements PonsTokenIdentitySource {
  private readonly client: PublicClient;
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
    if (chainId!==ROBINHOOD_CHAIN_ID) throw new Error('PONS_TOKEN_IDENTITY_CHAIN_ID_DRIFT');
    const code=await this.client.getBytecode({address:PONS_V2_FACTORY as Address});
    if (!code || keccak256(code)!==PONS_V2_FACTORY_CODE_HASH) throw new Error('PONS_TOKEN_IDENTITY_FACTORY_AUTHORITY_DRIFT');
    this.authorityVerified=true;
  }

  async getBlockHash(blockNumber:bigint):Promise<Hex> {
    const block=await this.client.getBlock({blockNumber});
    if (!block.hash) throw new Error(`PONS_TOKEN_IDENTITY_BLOCK_HASH_MISSING:${blockNumber}`);
    return block.hash as Hex;
  }

  async readIdentity(
    launch:PonsTokenIdentityLaunch,
    blockNumber:bigint
  ):Promise<Pick<PonsTokenIdentityReceipt,'name'|'symbol'|'decimals'|'totalSupply'>> {
    if (!/^0x[0-9a-f]{40}$/.test(launch.token)) throw new Error('PONS_TOKEN_IDENTITY_TOKEN_INVALID');
    const address=launch.token as Address;
    const [name,symbol,decimals,totalSupply]=await Promise.all([
      this.client.readContract({address,abi:ponsErc20Abi,functionName:'name',blockNumber}),
      this.client.readContract({address,abi:ponsErc20Abi,functionName:'symbol',blockNumber}),
      this.client.readContract({address,abi:ponsErc20Abi,functionName:'decimals',blockNumber}),
      this.client.readContract({address,abi:ponsErc20Abi,functionName:'totalSupply',blockNumber})
    ]);
    if (typeof name!=='string' || typeof symbol!=='string') throw new Error('PONS_TOKEN_IDENTITY_TEXT_INVALID');
    if (Array.from(name).length>256 || Array.from(symbol).length>64) throw new Error('PONS_TOKEN_IDENTITY_TEXT_TOO_LARGE');
    if (!Number.isInteger(decimals) || decimals<0 || decimals>255) throw new Error('PONS_TOKEN_IDENTITY_DECIMALS_INVALID');
    if (typeof totalSupply!=='bigint' || totalSupply<0n) throw new Error('PONS_TOKEN_IDENTITY_TOTAL_SUPPLY_INVALID');
    return {name,symbol,decimals,totalSupply};
  }
}

export async function buildPonsTokenIdentityReceipt(input:{
  launch:PonsTokenIdentityLaunch;
  observedBlock:bigint;
  observedBlockHash:Hex;
  name:string;
  symbol:string;
  decimals:number;
  totalSupply:bigint;
}):Promise<PonsTokenIdentityReceipt> {
  const token=input.launch.token.toLowerCase() as Hex;
  const core={
    identityVersion:PONS_TOKEN_IDENTITY_VERSION,
    chainId:ROBINHOOD_CHAIN_ID,
    launchId:input.launch.launchId,
    token,
    observedBlock:input.observedBlock,
    observedBlockHash:input.observedBlockHash.toLowerCase() as Hex,
    name:input.name,
    symbol:input.symbol,
    decimals:input.decimals,
    totalSupply:input.totalSupply
  };
  return {
    identityId:await sha256Hex({kind:PONS_TOKEN_IDENTITY_VERSION,chainId:ROBINHOOD_CHAIN_ID,launchId:input.launch.launchId,token}),
    ...core,
    evidenceDigest:await sha256Hex(core)
  };
}

export async function verifyPonsTokenIdentityReceipt(receipt:PonsTokenIdentityReceipt):Promise<void> {
  if (receipt.identityVersion!==PONS_TOKEN_IDENTITY_VERSION || receipt.chainId!==ROBINHOOD_CHAIN_ID) throw new Error('PONS_TOKEN_IDENTITY_VERSION_INVALID');
  const rebuilt=await buildPonsTokenIdentityReceipt({
    launch:{launchId:receipt.launchId,token:receipt.token},
    observedBlock:receipt.observedBlock,
    observedBlockHash:receipt.observedBlockHash,
    name:receipt.name,
    symbol:receipt.symbol,
    decimals:receipt.decimals,
    totalSupply:receipt.totalSupply
  });
  if (canonicalJson(rebuilt)!==canonicalJson(receipt)) throw new Error('PONS_TOKEN_IDENTITY_RECEIPT_INVALID');
}

export async function parsePonsTokenIdentityReceipt(payload:string):Promise<PonsTokenIdentityReceipt> {
  let raw:Record<string,unknown>;
  try { raw=JSON.parse(payload) as Record<string,unknown>; }
  catch { throw new Error('PONS_TOKEN_IDENTITY_RECEIPT_INVALID'); }
  if (
    typeof raw.identityId!=='string' || typeof raw.identityVersion!=='string' ||
    raw.chainId!==ROBINHOOD_CHAIN_ID || typeof raw.launchId!=='string' ||
    typeof raw.token!=='string' || typeof raw.observedBlock!=='string' ||
    typeof raw.observedBlockHash!=='string' || typeof raw.name!=='string' ||
    typeof raw.symbol!=='string' || typeof raw.decimals!=='number' || !Number.isInteger(raw.decimals) ||
    typeof raw.totalSupply!=='string' || typeof raw.evidenceDigest!=='string'
  ) throw new Error('PONS_TOKEN_IDENTITY_RECEIPT_INVALID');
  let receipt:PonsTokenIdentityReceipt;
  try {
    receipt={
      identityId:raw.identityId,
      identityVersion:raw.identityVersion as typeof PONS_TOKEN_IDENTITY_VERSION,
      chainId:ROBINHOOD_CHAIN_ID,
      launchId:raw.launchId,
      token:raw.token.toLowerCase() as Hex,
      observedBlock:BigInt(raw.observedBlock),
      observedBlockHash:raw.observedBlockHash.toLowerCase() as Hex,
      name:raw.name,
      symbol:raw.symbol,
      decimals:Number(raw.decimals),
      totalSupply:BigInt(raw.totalSupply),
      evidenceDigest:raw.evidenceDigest
    };
  } catch {
    throw new Error('PONS_TOKEN_IDENTITY_RECEIPT_INVALID');
  }
  await verifyPonsTokenIdentityReceipt(receipt);
  return receipt;
}

export async function syncPonsTokenIdentities(
  source:PonsTokenIdentitySource,
  store:PonsTokenIdentityStore,
  limit:number
):Promise<PonsTokenIdentitySyncReport> {
  if (!Number.isSafeInteger(limit) || limit<1 || limit>100) throw new Error('PONS_TOKEN_IDENTITY_LIMIT_INVALID');
  const checkpoint=await store.getCheckpoint();
  if (!checkpoint) return {observedBlock:null,attempted:0,inserted:0,duplicates:0,failed:0,remaining:0};

  await source.assertAuthority();
  const before=await source.getBlockHash(checkpoint.blockNumber);
  if (before.toLowerCase()!==checkpoint.blockHash.toLowerCase()) throw new Error('PONS_TOKEN_IDENTITY_CHECKPOINT_REORG');

  const launches=await store.listMissing(limit);
  const pending:PonsTokenIdentityReceipt[]=[];
  let failed=0;
  for (const launch of launches) {
    try {
      const facts=await source.readIdentity(launch,checkpoint.blockNumber);
      pending.push(await buildPonsTokenIdentityReceipt({
        launch,
        observedBlock:checkpoint.blockNumber,
        observedBlockHash:before,
        ...facts
      }));
    } catch {
      // Identity enrichment is presentation-only. A malformed or unreadable
      // token must not stall canonical launch indexing or other identities.
      failed+=1;
    }
  }

  const after=await source.getBlockHash(checkpoint.blockNumber);
  if (after.toLowerCase()!==before.toLowerCase()) throw new Error('PONS_TOKEN_IDENTITY_REORG_DURING_READ');

  let inserted=0,duplicates=0;
  for (const receipt of pending) {
    await verifyPonsTokenIdentityReceipt(receipt);
    const result=await store.put(receipt);
    if (result==='INSERTED') inserted+=1;
    else duplicates+=1;
  }
  const remaining=(await store.listMissing(1)).length;
  return {
    observedBlock:checkpoint.blockNumber,
    attempted:launches.length,
    inserted,
    duplicates,
    failed,
    remaining
  };
}
