import {
  decodeEventLog,
  decodeFunctionData,
  encodeFunctionData,
  getAddress,
  keccak256,
  parseAbiItem,
  toHex,
  type Address,
  type Hex,
  type PublicClient
} from 'viem';
import { sha256Hex } from '../evidence/canonical.js';
import {
  BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS,
  BINRAT_TREASURY_ADDRESS,
  LAUNCH_CONFIG_DIGEST,
  LAUNCH_MECHANICS_RECEIPT_DIGEST,
  deriveLaunchExecutionReceiptDigest,
  validateLaunchExecutionReceipt,
  type LaunchExecutionReceipt
} from '../launchConfig/config.js';

export const ARC_CHAIN_ID = 5042 as const;
export const ARCPAD_LAUNCHER_ADDRESS = '0x24196CD6e534cfCE8F480B53E70809b68Ea86F29' as const;
export const ARCPAD_USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const;
export const LAUNCH_FUNCTION_SIGNATURE =
  'createToken(string,string,(string,string,string,string),bytes32)' as const;
export const LAUNCH_FUNCTION_SELECTOR = '0xce5798cd' as const;

const launchAbi = [parseAbiItem(
  'function createToken(string,string,(string,string,string,string),bytes32) payable returns (address)'
)] as const;
const tokenCreatedEvent = parseAbiItem(
  'event TokenCreated(address indexed token,address indexed creator,string name,string symbol,address pool,string imageURI,string website,string twitter,string telegram)'
);
const poolCreatedEvent = parseAbiItem(
  'event PoolCreated(address indexed token0,address indexed token1,uint24 indexed fee,int24 tickSpacing,address pool)'
);
const positionLockedEvent = parseAbiItem(
  'event PositionLocked(uint256 indexed tokenId,address indexed token,address indexed creator)'
);
const transferTopic = keccak256(toHex('Transfer(address,address,uint256)'));

export interface LaunchMetadataInput {
  name: string;
  symbol: string;
  imageURI: string;
  website: string;
  twitter: string;
  telegram: string;
  salt: Hex;
}

export interface DryRunClientOptions {
  metadata?: LaunchMetadataInput;
  signer?: Address;
}

export function encodeLaunchCalldata(metadata: LaunchMetadataInput): Hex {
  validateMetadata(metadata);
  const data = encodeFunctionData({
    abi: launchAbi,
    functionName: 'createToken',
    args: [
      metadata.name,
      metadata.symbol,
      [metadata.imageURI, metadata.website, metadata.twitter, metadata.telegram],
      metadata.salt
    ]
  });
  if (!data.startsWith(LAUNCH_FUNCTION_SELECTOR)) throw new Error('LAUNCH_SELECTOR_MISMATCH');
  return data;
}

export function decodeLaunchCalldata(data: Hex): LaunchMetadataInput & { functionName: 'createToken' } {
  if (!data.startsWith(LAUNCH_FUNCTION_SELECTOR)) throw new Error('LAUNCH_SELECTOR_MISMATCH');
  const decoded = decodeFunctionData({ abi: launchAbi, data });
  const [name, symbol, metadata, salt] = decoded.args as [string, string, [string, string, string, string], Hex];
  const result = {
    functionName: 'createToken' as const,
    name,
    symbol,
    imageURI: metadata[0],
    website: metadata[1],
    twitter: metadata[2],
    telegram: metadata[3],
    salt
  };
  validateMetadata(result);
  return result;
}

export async function buildUnsignedLaunchIntent(
  client: PublicClient,
  options: DryRunClientOptions = {}
): Promise<Record<string, unknown>> {
  const chainId = await client.getChainId();
  if (chainId !== ARC_CHAIN_ID) throw new Error('LAUNCH_INTENT_CHAIN_INVALID');

  const signer = options.signer ? canonicalSigner(options.signer) : null;
  if (signer && !sameAddress(signer, BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS)) {
    throw new Error('LAUNCH_SIGNER_FEE_RECIPIENT_MISMATCH');
  }

  const metadata = options.metadata ?? null;
  const calldata = metadata ? encodeLaunchCalldata(metadata) : null;
  const gas = await feeSnapshot(client);
  const complete = Boolean(metadata && signer);
  let nonce: number | null = null;
  let gasEstimate: bigint | null = null;
  let simulation: Record<string, unknown> = {
    status: complete
      ? 'NOT_RUN'
      : metadata
        ? 'SIMULATION_NOT_POSSIBLE_WITHOUT_SIGNER'
        : signer
          ? 'SIMULATION_NOT_POSSIBLE_WITHOUT_OWNER_METADATA'
          : 'SIMULATION_NOT_POSSIBLE_WITHOUT_SIGNER_AND_OWNER_METADATA'
  };

  if (signer) nonce = await client.getTransactionCount({ address: signer, blockTag: 'pending' });
  if (complete) {
    const request = { account: signer!, to: ARCPAD_LAUNCHER_ADDRESS as Address, data: calldata!, value: 0n };
    try {
      const call = await client.call(request);
      gasEstimate = await client.estimateGas(request);
      simulation = {
        status: 'SIMULATION_PASS_WITH_REAL_STATE',
        returnData: call.data ?? '0x',
        gasEstimate: gasEstimate.toString()
      };
    } catch (error) {
      simulation = { status: 'SIMULATION_FAILED', error: sanitizeError(error) };
    }
  }

  return {
    schemaVersion: 'binrat.launch-intent-dry-run/0.1',
    status: complete ? 'READY_TO_SIMULATE' : 'OWNER_INPUT_REQUIRED',
    chainId: ARC_CHAIN_ID,
    launcher: ARCPAD_LAUNCHER_ADDRESS,
    function: { signature: LAUNCH_FUNCTION_SIGNATURE, selector: LAUNCH_FUNCTION_SELECTOR },
    parameters: {
      name: metadata?.name ?? null,
      symbol: metadata?.symbol ?? null,
      metadata: metadata ? {
        imageURI: metadata.imageURI,
        website: metadata.website,
        twitter: metadata.twitter,
        telegram: metadata.telegram
      } : null,
      salt: metadata?.salt ?? null,
      projectFeeRecipient: {
        expected: BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS,
        binding: 'msg.sender',
        signerRequired: true
      },
      launchMode: 'STANDARD_CREATOR_REWARDS',
      creatorFirstBuy: { enabled: false, amountRaw: '0' }
    },
    transaction: {
      from: signer,
      fromAddressState: signer ? 'OWNER_SIGNER_BOUND_TO_PROJECT_FEE_ROLE' : 'OWNER_SIGNER_NOT_YET_BOUND',
      to: ARCPAD_LAUNCHER_ADDRESS,
      data: calldata,
      value: '0x0',
      nonce,
      gasEstimate: gasEstimate?.toString() ?? null,
      maxFeePerGas: gas.maxFeePerGas,
      maxPriorityFeePerGas: gas.maxPriorityFeePerGas
    },
    requiredFunds: {
      nativeCurrency: 'USDC',
      nativeDecimals: 18,
      nativeGasUpperBoundRaw: gasEstimate && gas.maxFeePerGas
        ? (gasEstimate * BigInt(gas.maxFeePerGas)).toString()
        : null,
      ethRequired: '0',
      launchValueRaw: '0',
      usdcApprovalRaw: '0',
      permitRequired: false,
      note: 'Arc chain gas is denominated in native USDC; first-buy-disabled launch value is zero.'
    },
    bindings: {
      launchMechanicsReceiptDigest: LAUNCH_MECHANICS_RECEIPT_DIGEST,
      launchConfigDigest: LAUNCH_CONFIG_DIGEST,
      gateMatrixDigest: 'd244d4b8d19d17679adee0e995dbbf4845f321702ea91bfcc646497e6f2ce73b'
    },
    expectedAuthorities: {
      treasury: BINRAT_TREASURY_ADDRESS,
      projectFeeRecipient: BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS
    },
    simulation,
    creationStatus: 'NOT_EXECUTED'
  };
}

export interface ReconcileEvidenceInput {
  transaction: {
    hash: Hex;
    from: Address;
    to: Address | null;
    input: Hex;
    value: bigint;
    blockNumber: bigint;
  };
  receipt: {
    status: string;
    blockNumber: bigint;
    blockHash: Hex;
    logs: Array<{ address: Address; topics: Hex[]; data: Hex; logIndex?: number | null }>;
  };
  blockTimestamp: bigint;
  totalSupply: bigint;
  decimals: number;
}

export async function reconcileLaunchExecutionEvidence(
  input: ReconcileEvidenceInput
): Promise<LaunchExecutionReceipt> {
  const { transaction: tx, receipt } = input;
  if (!sameAddress(tx.to, ARCPAD_LAUNCHER_ADDRESS)) throw new Error('LAUNCH_RECONCILE_WRONG_LAUNCHER');
  if (receipt.status !== '0x1' && receipt.status !== 'success') throw new Error('LAUNCH_RECONCILE_TX_FAILED');
  if (tx.blockNumber !== receipt.blockNumber) throw new Error('LAUNCH_RECONCILE_BLOCK_MISMATCH');
  if (tx.value !== 0n) throw new Error('LAUNCH_RECONCILE_PRIVILEGED_FIRST_BUY');
  if (!sameAddress(tx.from, BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS)) {
    throw new Error('LAUNCH_RECONCILE_WRONG_FEE_RECIPIENT');
  }

  const decodedCall = decodeLaunchCalldata(tx.input);
  const tokenLog = receipt.logs.find((log) =>
    sameAddress(log.address, ARCPAD_LAUNCHER_ADDRESS) && log.topics[0] === tokenCreatedTopic
  );
  if (!tokenLog) throw new Error('LAUNCH_RECONCILE_TOKEN_EVENT_MISSING');
  const tokenEvent = decodeEventLog({ abi: [tokenCreatedEvent], data: tokenLog.data, topics: tokenLog.topics as any });
  const tokenArgs = tokenEvent.args as any;
  const token = getAddress(tokenArgs.token);
  const creator = getAddress(tokenArgs.creator);
  if (!sameAddress(creator, tx.from)) throw new Error('LAUNCH_RECONCILE_CREATOR_MISMATCH');
  if (tokenArgs.name !== decodedCall.name || tokenArgs.symbol !== decodedCall.symbol) {
    throw new Error('LAUNCH_RECONCILE_METADATA_MISMATCH');
  }

  const poolLog = receipt.logs.find((log) =>
    sameAddress(log.address, '0xf0db7b58379503491d857dB50AC9ece64c653918') && log.topics[0] === poolCreatedTopic
  );
  if (!poolLog) throw new Error('LAUNCH_RECONCILE_POOL_EVENT_MISSING');
  const poolEvent = decodeEventLog({ abi: [poolCreatedEvent], data: poolLog.data, topics: poolLog.topics as any });
  const poolArgs = poolEvent.args as any;
  const pool = getAddress(poolArgs.pool);
  if (
    !sameAddress(poolArgs.token0, token) &&
    !sameAddress(poolArgs.token1, token)
  ) throw new Error('LAUNCH_RECONCILE_POOL_TOKEN_MISMATCH');
  if (Number(poolArgs.fee) !== 10000) throw new Error('LAUNCH_RECONCILE_POOL_FEE_MISMATCH');
  if (getAddress(tokenArgs.pool) !== pool) throw new Error('LAUNCH_RECONCILE_TOKEN_POOL_MISMATCH');

  const lockedLog = receipt.logs.find((log) =>
    sameAddress(log.address, '0x69A615DD32B89fE40D87b2e3123baE4162f2d450') && log.topics[0] === positionLockedTopic
  );
  if (!lockedLog) throw new Error('LAUNCH_RECONCILE_LOCK_EVENT_MISSING');
  const lockedEvent = decodeEventLog({ abi: [positionLockedEvent], data: lockedLog.data, topics: lockedLog.topics as any });
  const lockedArgs = lockedEvent.args as any;
  if (!sameAddress(lockedArgs.token, token) || !sameAddress(lockedArgs.creator, tx.from)) {
    throw new Error('LAUNCH_RECONCILE_LOCK_AUTHORITY_MISMATCH');
  }

  const tokenTransfers = receipt.logs.filter((log) =>
    sameAddress(log.address, token) && log.topics[0] === transferTopic
  );
  for (const transfer of tokenTransfers) {
    const from = getAddress(`0x${transfer.topics[1]!.slice(-40)}`);
    const to = getAddress(`0x${transfer.topics[2]!.slice(-40)}`);
    if (sameAddress(to, tx.from) || (!sameAddress(to, ARCPAD_LAUNCHER_ADDRESS) && !sameAddress(to, pool))) {
      throw new Error('LAUNCH_RECONCILE_PRIVILEGED_ALLOCATION');
    }
    if (!sameAddress(from, '0x0000000000000000000000000000000000000000') &&
        !sameAddress(from, ARCPAD_LAUNCHER_ADDRESS) && !sameAddress(from, pool)) {
      throw new Error('LAUNCH_RECONCILE_UNKNOWN_TOKEN_SOURCE');
    }
  }
  if (receipt.logs.some((log) => sameAddress(log.address, ARCPAD_USDC_ADDRESS))) {
    throw new Error('LAUNCH_RECONCILE_USDC_FIRST_BUY_OR_FLOW');
  }

  const verifiedAt = new Date(Number(input.blockTimestamp) * 1000).toISOString().replace('.000Z', 'Z');
  const allocationVerification = {
    status: 'PASS',
    evidenceClass: 'POST_LAUNCH_ON_CHAIN_VERIFICATION',
    launchTransactionMatches: true,
    ownerPolicyMatched: true,
    privilegedCreatorFirstBuyObserved: false,
    receiptDigest: await sha256Hex({
      transaction: tx.hash,
      token,
      creator,
      tokenTransferLogCount: tokenTransfers.length,
      privilegedCreatorFirstBuyObserved: false
    }),
    verifiedAt
  };
  const founderProjectPublicPurchase = {
    policy: 'NOT_PLANNED_FOR_LAUNCH',
    observedStatus: 'NONE_OBSERVED',
    transaction: null,
    verificationReceiptDigest: await sha256Hex({ policy: 'NOT_PLANNED_FOR_LAUNCH', transaction: null })
  };
  const result: Record<string, unknown> = {
    schemaVersion: 'binrat.launch-execution-receipt/0.1',
    executionStatus: 'EXECUTED',
    validationStatus: 'PASS',
    chainId: ARC_CHAIN_ID,
    tokenAddress: token,
    launchTransaction: tx.hash,
    launchBlock: Number(receipt.blockNumber),
    launchBlockHash: receipt.blockHash,
    tokenSupply: { raw: input.totalSupply.toString(), decimals: input.decimals },
    pool: { address: pool },
    liquidityPosition: { positionId: BigInt(lockedArgs.tokenId).toString(), mintTransaction: tx.hash },
    lockerAddress: getAddress(lockedLog.address),
    authorities: {
      treasury: { role: 'TREASURY', address: BINRAT_TREASURY_ADDRESS },
      projectFeeRecipient: { role: 'PROJECT_FEE_RECIPIENT', address: BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS }
    },
    launchConfigDigest: LAUNCH_CONFIG_DIGEST,
    launchMechanicsReceiptDigest: LAUNCH_MECHANICS_RECEIPT_DIGEST,
    allocationVerification,
    founderProjectPublicPurchase,
    deploymentExecutedAt: verifiedAt
  };
  result.receiptDigest = await deriveLaunchExecutionReceiptDigest(result);
  return validateLaunchExecutionReceipt(result);
}

export async function reconcileLaunchExecution(
  client: PublicClient,
  txHash: Hex
): Promise<LaunchExecutionReceipt> {
  const tx = await client.getTransaction({ hash: txHash });
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  const block = await client.getBlock({ blockNumber: receipt.blockNumber });
  const tokenLog = receipt.logs.find((log) =>
    sameAddress(log.address, ARCPAD_LAUNCHER_ADDRESS) && log.topics[0] === tokenCreatedTopic
  );
  if (!tokenLog) throw new Error('LAUNCH_RECONCILE_TOKEN_EVENT_MISSING');
  const tokenEvent = decodeEventLog({ abi: [tokenCreatedEvent], data: tokenLog.data, topics: tokenLog.topics as any });
  const token = (tokenEvent.args as any).token as Address;
  const totalSupply = await client.readContract({
    address: token,
    abi: [
      { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
      { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }
    ],
    functionName: 'totalSupply',
    blockNumber: receipt.blockNumber
  });
  const decimals = await client.readContract({
    address: token,
    abi: [{ type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }],
    functionName: 'decimals',
    blockNumber: receipt.blockNumber
  });
  return reconcileLaunchExecutionEvidence({
    transaction: {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      input: tx.input,
      value: tx.value,
      blockNumber: tx.blockNumber!
    },
    receipt: {
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      blockHash: receipt.blockHash,
      logs: receipt.logs.map((log) => ({
        address: log.address,
        topics: log.topics,
        data: log.data,
        logIndex: log.logIndex
      }))
    },
    blockTimestamp: block.timestamp,
    totalSupply: totalSupply as bigint,
    decimals: Number(decimals)
  });
}

const tokenCreatedTopic = keccak256(toHex('TokenCreated(address,address,string,string,address,string,string,string,string)'));
const poolCreatedTopic = keccak256(toHex('PoolCreated(address,address,uint24,int24,address)'));
const positionLockedTopic = keccak256(toHex('PositionLocked(uint256,address,address)'));

function validateMetadata(metadata: LaunchMetadataInput): void {
  for (const key of ['name', 'symbol', 'imageURI', 'website', 'twitter', 'telegram'] as const) {
    if (typeof metadata[key] !== 'string') throw new Error(`LAUNCH_METADATA_${key.toUpperCase()}_REQUIRED`);
  }
  if (typeof metadata.salt !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(metadata.salt)) {
    throw new Error('LAUNCH_METADATA_SALT_REQUIRED');
  }
}

function canonicalSigner(value: Address): Address {
  const checksum = getAddress(value);
  if (checksum !== value) throw new Error('LAUNCH_SIGNER_NOT_CANONICAL');
  return checksum;
}

function sameAddress(left: string | null, right: string): boolean {
  return Boolean(left) && left!.toLowerCase() === right.toLowerCase();
}

async function feeSnapshot(client: PublicClient): Promise<{
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
}> {
  try {
    const block = await client.getBlock();
    let priority: bigint | undefined;
    try {
      const raw = await (client as any).request({ method: 'eth_maxPriorityFeePerGas', params: [] });
      priority = BigInt(raw as string);
    } catch {}
    const maxPriority = priority ?? 0n;
    const maxFee = block.baseFeePerGas === null ? null : block.baseFeePerGas + maxPriority;
    return {
      maxFeePerGas: maxFee?.toString() ?? null,
      maxPriorityFeePerGas: priority?.toString() ?? null
    };
  } catch {
    return { maxFeePerGas: null, maxPriorityFeePerGas: null };
  }
}

function sanitizeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 240) : 'SIMULATION_ERROR';
}
