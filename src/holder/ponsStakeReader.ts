import { createPublicClient, getAddress, http, isAddress, type Address, type PublicClient } from 'viem';
import { PONS_LAUNCH_CHAIN_ID } from '../launchConfig/ponsPlan.js';
import { PONS_STAKING_BEACON_V1, PONS_STAKING_IMPLEMENTATION_V1, PONS_PREFLIGHT_SELECTORS } from '../launchConfig/ponsPreflight.js';

export const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
export const PONS_STAKING_BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50' as const;
export const PONS_STAKE_READER_ABI = [
  { type: 'function', name: 'quoteAsset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'totalStaked', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'stakedOf', stateMutability: 'view', inputs: [{ name: 'wallet', type: 'address' }], outputs: [{ type: 'uint256' }] }
] as const;
const BEACON_ABI = [{ type: 'function', name: 'implementation', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const;

export type StakeReadStatus = 'VERIFIED' | 'UNAVAILABLE' | 'STALE' | 'CHAIN_MISMATCH' | 'AUTHORITY_MISMATCH';
export interface PonsStakeReceipt {
  schemaVersion: 'binrat.pons-active-stake/1';
  status: StakeReadStatus;
  chainId: number;
  wallet: Address;
  vault: Address;
  quoteAsset: Address | null;
  stakedRaw: string | null;
  totalStakedRaw: string | null;
  blockNumber: string | null;
  blockHash: `0x${string}` | null;
  freshness: 'FRESH' | 'STALE' | 'UNKNOWN';
  errorCode: string | null;
}

export interface PonsStakeReaderOptions {
  client?: PublicClient;
  rpcUrl?: string;
  expectedChainId?: number;
  maxBlockAge?: bigint;
}

export interface PonsStakeReadInput {
  vault: string;
  wallet: string;
  /** Optional caller-pinned observation context. Both fields must be supplied together. */
  block?: { number: bigint; hash: `0x${string}` };
}

export class PonsStakeReader {
  private readonly client: PublicClient;
  private readonly expectedChainId: number;
  private readonly maxBlockAge?: bigint;

  constructor(options: PonsStakeReaderOptions) {
    if (!options.client && !options.rpcUrl) throw new Error('PONS_STAKE_RPC_REQUIRED');
    this.client = options.client ?? createPublicClient({ transport: http(options.rpcUrl!) });
    this.expectedChainId = options.expectedChainId ?? PONS_LAUNCH_CHAIN_ID;
    this.maxBlockAge = options.maxBlockAge;
    if (this.maxBlockAge !== undefined && this.maxBlockAge < 0n) throw new Error('PONS_STAKE_MAX_BLOCK_AGE_INVALID');
  }

  async read(input: PonsStakeReadInput): Promise<PonsStakeReceipt> {
    const wallet = normalizeAddress(input.wallet, 'PONS_STAKE_WALLET_INVALID');
    const vault = normalizeAddress(input.vault, 'PONS_STAKE_VAULT_INVALID');
    const base = { schemaVersion: 'binrat.pons-active-stake/1' as const, chainId: this.expectedChainId, wallet, vault };
    if (this.expectedChainId !== PONS_LAUNCH_CHAIN_ID) return failed(base, 'CHAIN_MISMATCH', 'PONS_STAKE_EXPECTED_CHAIN_INVALID');
    try {
      const chainId = await this.client.getChainId();
      if (chainId !== PONS_LAUNCH_CHAIN_ID) return failed({ ...base, chainId }, 'CHAIN_MISMATCH', 'PONS_STAKE_CHAIN_MISMATCH');

      const initialBlock = input.block ? { number: input.block.number, hash: input.block.hash } : await this.client.getBlock({ blockTag: 'latest' });
      if (initialBlock.number === null || !initialBlock.hash) return failed(base, 'UNAVAILABLE', 'PONS_STAKE_BLOCK_CONTEXT_MISSING');
      const blockNumber = initialBlock.number;
      const blockHash = initialBlock.hash;
      if (input.block && (input.block.number < 0n || !/^0x[0-9a-fA-F]{64}$/.test(input.block.hash))) {
        return failed({ ...base, blockNumber: blockNumber.toString(), blockHash }, 'AUTHORITY_MISMATCH', 'PONS_STAKE_BLOCK_CONTEXT_INVALID');
      }
      const code = await this.client.getBytecode({ address: vault, blockNumber });
      if (!code || code === '0x') return failed({ ...base, blockNumber: blockNumber.toString(), blockHash }, 'AUTHORITY_MISMATCH', 'PONS_STAKE_VAULT_CODE_MISSING');
      const beaconCode = await this.client.getBytecode({ address: PONS_STAKING_BEACON_V1, blockNumber });
      if (!beaconCode || beaconCode === '0x') return failed({ ...base, blockNumber: blockNumber.toString(), blockHash }, 'AUTHORITY_MISMATCH', 'PONS_STAKE_BEACON_CODE_MISSING');
      const [vaultBeaconSlot, implementation] = await Promise.all([
        this.client.getStorageAt({ address: vault, slot: PONS_STAKING_BEACON_SLOT, blockNumber }),
        this.client.readContract({ address: PONS_STAKING_BEACON_V1, abi: BEACON_ABI, functionName: 'implementation', blockNumber })
      ]);
      if (!vaultBeaconSlot || vaultBeaconSlot.toLowerCase() !== `0x${'0'.repeat(24)}${PONS_STAKING_BEACON_V1.slice(2).toLowerCase()}`) {
        return failed({ ...base, blockNumber: blockNumber.toString(), blockHash }, 'AUTHORITY_MISMATCH', 'PONS_STAKE_VAULT_BEACON_MISMATCH');
      }
      if (!isAddress(implementation, { strict: false }) || getAddress(implementation).toLowerCase() !== PONS_STAKING_IMPLEMENTATION_V1.toLowerCase()) {
        return failed({ ...base, blockNumber: blockNumber.toString(), blockHash }, 'AUTHORITY_MISMATCH', 'PONS_STAKE_IMPLEMENTATION_MISMATCH');
      }

      const [quoteAsset, staked, total] = await Promise.all([
        this.client.readContract({ address: vault, abi: PONS_STAKE_READER_ABI, functionName: 'quoteAsset', blockNumber }),
        this.client.readContract({ address: vault, abi: PONS_STAKE_READER_ABI, functionName: 'stakedOf', args: [wallet], blockNumber }),
        this.client.readContract({ address: vault, abi: PONS_STAKE_READER_ABI, functionName: 'totalStaked', blockNumber })
      ]);
      if (!isAddress(quoteAsset, { strict: false }) || getAddress(quoteAsset) !== NATIVE_ETH_ADDRESS) {
        return failed({ ...base, quoteAsset: isAddress(quoteAsset, { strict: false }) ? getAddress(quoteAsset) : null, blockNumber: blockNumber.toString(), blockHash }, 'AUTHORITY_MISMATCH', 'PONS_STAKE_QUOTE_ASSET_MISMATCH');
      }
      if (typeof staked !== 'bigint' || staked < 0n || typeof total !== 'bigint' || total < 0n) {
        return failed({ ...base, quoteAsset: NATIVE_ETH_ADDRESS, blockNumber: blockNumber.toString(), blockHash }, 'AUTHORITY_MISMATCH', 'PONS_STAKE_UINT256_INVALID');
      }
      if (staked > total) return failed({ ...base, quoteAsset: NATIVE_ETH_ADDRESS, blockNumber: blockNumber.toString(), blockHash }, 'AUTHORITY_MISMATCH', 'PONS_STAKE_TOTAL_INCOHERENT');

      const canonical = await this.client.getBlock({ blockNumber });
      if (canonical.hash !== blockHash) return failed({ ...base, quoteAsset: NATIVE_ETH_ADDRESS, blockNumber: blockNumber.toString(), blockHash }, 'STALE', 'PONS_STAKE_BLOCK_REORGED');
      if (this.maxBlockAge !== undefined) {
        const head = await this.client.getBlockNumber();
        if (head < blockNumber || head - blockNumber > this.maxBlockAge) {
          return failed({ ...base, quoteAsset: NATIVE_ETH_ADDRESS, blockNumber: blockNumber.toString(), blockHash }, 'STALE', 'PONS_STAKE_BLOCK_STALE');
        }
      }
      return { ...base, status: 'VERIFIED', quoteAsset: NATIVE_ETH_ADDRESS, stakedRaw: staked.toString(), totalStakedRaw: total.toString(), blockNumber: blockNumber.toString(), blockHash, freshness: this.maxBlockAge === undefined ? 'UNKNOWN' : 'FRESH', errorCode: null };
    } catch {
      return failed(base, 'UNAVAILABLE', 'PONS_STAKE_RPC_OR_INTERFACE_FAILURE');
    }
  }
}

function normalizeAddress(value: string, code: string): Address {
  if (!isAddress(value, { strict: false })) throw new Error(code);
  return getAddress(value);
}

function failed(
  base: { schemaVersion: 'binrat.pons-active-stake/1'; chainId: number; wallet: Address; vault: Address } & Partial<Pick<PonsStakeReceipt, 'quoteAsset' | 'blockNumber' | 'blockHash'>>,
  status: StakeReadStatus,
  errorCode: string
): PonsStakeReceipt {
  return { ...base, status, quoteAsset: base.quoteAsset ?? null, stakedRaw: null, totalStakedRaw: null, blockNumber: base.blockNumber ?? null, blockHash: base.blockHash ?? null, freshness: status === 'STALE' ? 'STALE' : 'UNKNOWN', errorCode };
}

// Retain selector linkage as a compile-time-visible cross-check against the preflight ABI authority.
export const PONS_STAKE_READ_SELECTORS = PONS_PREFLIGHT_SELECTORS;
