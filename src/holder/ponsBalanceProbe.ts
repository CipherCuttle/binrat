import { erc20Abi, getAddress, isAddress, type Address, type PublicClient } from 'viem';

export const BINRAT_PONS_TOKEN_CHAIN_ID = 4663 as const;
export const BINRAT_ARC_RESEARCH_CHAIN_ID = 5042 as const;

/**
 * Candidate balance inspection is not production entitlement. No caller may
 * transform its result into HOLDER access without a separately reviewed,
 * on-chain-bound authority, final launch receipt and explicit activation.
 */
export type PonsProbeStatus =
  | 'TOKEN_AUTHORITY_NOT_CONFIGURED'
  | 'TOKEN_AUTHORITY_INVALID'
  | 'PONS_RPC_CHAIN_MISMATCH'
  | 'PONS_FINALIZED_BLOCK_UNAVAILABLE'
  | 'PONS_FINALIZED_BLOCK_STALE_OR_FUTURE'
  | 'PONS_FINALIZED_BLOCK_BEFORE_EFFECTIVE_BLOCK'
  | 'PONS_REORG_OR_INCONSISTENT_RPC'
  | 'PONS_BALANCE_READ_FAILED'
  | 'BELOW_CANDIDATE_THRESHOLD'
  | 'MEETS_CANDIDATE_THRESHOLD_NO_ACCESS';

export interface PonsCandidateAuthority {
  tokenChainId: typeof BINRAT_PONS_TOKEN_CHAIN_ID;
  researchChainId: typeof BINRAT_ARC_RESEARCH_CHAIN_ID;
  tokenAddress: string | null;
  minimumRawBalance: string | null;
  effectiveBlock: string | null;
  policyId: string | null;
  /** This is deliberately incapable of conveying production authority. */
  mode: 'READ_ONLY_CANDIDATE';
}

export interface PonsFinalizedBlock {
  number: bigint;
  hash: string;
  timestamp: bigint;
}

export interface PonsBalanceProbePort {
  getChainId(): Promise<number>;
  getFinalizedBlock(): Promise<PonsFinalizedBlock>;
  getBlockHash(blockNumber: bigint): Promise<string>;
  balanceOf(input: { token: Address; wallet: Address; blockNumber: bigint }): Promise<bigint>;
}

export interface PonsProbeResult {
  status: PonsProbeStatus;
  accessTier: 'FREE';
  holderAccessGranted: false;
  tokenChainId: typeof BINRAT_PONS_TOKEN_CHAIN_ID;
  researchChainId: typeof BINRAT_ARC_RESEARCH_CHAIN_ID;
  checkpoint: { blockNumber: string; blockHash: string } | null;
  candidateThresholdMet: boolean | null;
}

const HASH = /^0x[0-9a-fA-F]{64}$/;
const RAW = /^(0|[1-9][0-9]*)$/;
const POLICY_ID = /^binrat\.pons-holder\/v[1-9][0-9]*(?:\.[0-9]+)*$/;
const ZERO = '0x0000000000000000000000000000000000000000';

function probe(status: PonsProbeStatus, block: PonsFinalizedBlock | null = null, thresholdMet: boolean | null = null): PonsProbeResult {
  return {
    status,
    accessTier: 'FREE',
    holderAccessGranted: false,
    tokenChainId: BINRAT_PONS_TOKEN_CHAIN_ID,
    researchChainId: BINRAT_ARC_RESEARCH_CHAIN_ID,
    checkpoint: block ? { blockNumber: block.number.toString(), blockHash: block.hash } : null,
    candidateThresholdMet: thresholdMet
  };
}

function configuredAuthority(authority: PonsCandidateAuthority): {
  token: Address;
  threshold: bigint;
  effectiveBlock: bigint;
} | PonsProbeStatus {
  if (
    authority.tokenChainId !== BINRAT_PONS_TOKEN_CHAIN_ID ||
    authority.researchChainId !== BINRAT_ARC_RESEARCH_CHAIN_ID ||
    authority.mode !== 'READ_ONLY_CANDIDATE'
  ) return 'TOKEN_AUTHORITY_INVALID';

  if (
    authority.tokenAddress === null ||
    authority.minimumRawBalance === null ||
    authority.effectiveBlock === null ||
    authority.policyId === null
  ) return 'TOKEN_AUTHORITY_NOT_CONFIGURED';

  if (
    !isAddress(authority.tokenAddress, { strict: false }) ||
    getAddress(authority.tokenAddress) !== authority.tokenAddress ||
    authority.tokenAddress.toLowerCase() === ZERO ||
    !RAW.test(authority.minimumRawBalance) ||
    authority.minimumRawBalance === '0' ||
    !RAW.test(authority.effectiveBlock) ||
    !POLICY_ID.test(authority.policyId)
  ) return 'TOKEN_AUTHORITY_INVALID';

  return {
    token: getAddress(authority.tokenAddress),
    threshold: BigInt(authority.minimumRawBalance),
    effectiveBlock: BigInt(authority.effectiveBlock)
  };
}

/**
 * Safe to exercise against a read-only RPC or deterministic fixture.
 * Never yields HOLDER access, even when the candidate threshold is met.
 * Invalid/missing authority does not call the RPC.
 */
export async function probePonsHolderCandidate(
  authority: PonsCandidateAuthority,
  wallet: string,
  port: PonsBalanceProbePort,
  nowMs: number
): Promise<PonsProbeResult> {
  const cfg = configuredAuthority(authority);
  if (typeof cfg === 'string') return probe(cfg);
  if (!isAddress(wallet, { strict: false }) || wallet.toLowerCase() === ZERO) {
    return probe('TOKEN_AUTHORITY_INVALID');
  }
  const normalizedWallet = getAddress(wallet);
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) return probe('TOKEN_AUTHORITY_INVALID');
  const nowSeconds = BigInt(Math.floor(nowMs / 1000));

  try {
    if (await port.getChainId() !== BINRAT_PONS_TOKEN_CHAIN_ID) {
      return probe('PONS_RPC_CHAIN_MISMATCH');
    }
    const block = await port.getFinalizedBlock();
    if (
      typeof block.number !== 'bigint' ||
      block.number <= 0n ||
      typeof block.hash !== 'string' ||
      !HASH.test(block.hash) ||
      block.hash.toLowerCase() === `0x${'0'.repeat(64)}` ||
      typeof block.timestamp !== 'bigint' ||
      block.timestamp <= 0n
    ) return probe('PONS_FINALIZED_BLOCK_UNAVAILABLE');
    // A finalized block can still be stale when an RPC has stopped advancing.
    // Clock skew tolerance is 30s; maximum age for this candidate probe is 5m.
    if (block.timestamp > nowSeconds + 30n || nowSeconds - block.timestamp > 300n) {
      return probe('PONS_FINALIZED_BLOCK_STALE_OR_FUTURE');
    }
    if (block.number < cfg.effectiveBlock) {
      return probe('PONS_FINALIZED_BLOCK_BEFORE_EFFECTIVE_BLOCK', block);
    }
    if ((await port.getBlockHash(block.number)).toLowerCase() !== block.hash.toLowerCase()) {
      return probe('PONS_REORG_OR_INCONSISTENT_RPC');
    }
    const balance = await port.balanceOf({
      token: cfg.token,
      wallet: normalizedWallet,
      blockNumber: block.number
    });
    if (typeof balance !== 'bigint' || balance < 0n) return probe('PONS_BALANCE_READ_FAILED');
    if ((await port.getBlockHash(block.number)).toLowerCase() !== block.hash.toLowerCase()) {
      return probe('PONS_REORG_OR_INCONSISTENT_RPC');
    }
    if (await port.getChainId() !== BINRAT_PONS_TOKEN_CHAIN_ID) {
      return probe('PONS_RPC_CHAIN_MISMATCH');
    }
    return balance >= cfg.threshold
      ? probe('MEETS_CANDIDATE_THRESHOLD_NO_ACCESS', block, true)
      : probe('BELOW_CANDIDATE_THRESHOLD', block, false);
  } catch {
    // RPC failures, unsupported finalized tags and reverted balanceOf all fail closed.
    return probe('PONS_BALANCE_READ_FAILED');
  }
}

/**
 * viem adapter: block-tag finality and canonical block identity are required.
 * No pending/latest fallback. This method never signs or sends a transaction.
 */
export function viemPonsBalanceProbePort(
  client: Pick<PublicClient, 'getChainId' | 'getBlock' | 'readContract'>
): PonsBalanceProbePort {
  return {
    getChainId: () => client.getChainId(),
    getFinalizedBlock: async () => {
      const block = await client.getBlock({ blockTag: 'finalized' });
      return { number: block.number, hash: block.hash, timestamp: block.timestamp };
    },
    getBlockHash: async (blockNumber) => (await client.getBlock({ blockNumber })).hash,
    balanceOf: async ({ token, wallet, blockNumber }) =>
      client.readContract({
        abi: erc20Abi,
        address: token,
        functionName: 'balanceOf',
        args: [wallet],
        blockNumber
      }) as Promise<bigint>
  };
}
