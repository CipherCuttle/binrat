/**
 * G2A A1: bounded, read-only 4663 proof collector.
 * A coherent single-provider sample is NOT independent onchain verification,
 * a finalized block guarantee, a live indexer, or permission to enable Watch.
 */
import {
  decodeEventLog, encodeEventTopics, keccak256,
  type Address, type Hex, type PublicClient
} from 'viem';
import {
  PONS_CHAIN_ID, PONS_V2_FACTORY, PonsV2LaunchSource, ponsTokenLaunchedEvent,
  serializePonsLaunch
} from './source.js';

const TOPIC0 = encodeEventTopics({
  abi: [ponsTokenLaunchedEvent], eventName: 'TokenLaunched'
})[0]!.toLowerCase();

export interface PonsProofOptions {
  fromBlock: bigint;
  toBlock: bigint;
  expectedFactoryCodeHash: Hex;
  /** Max 12 * 500-block RPC windows in one explicit operator invocation. */
  maxWindows?: number;
  /** Sampling head buffer, deliberately NOT called finality. */
  headBufferBlocks?: bigint;
}

export interface PonsReceiptProof {
  launch: ReturnType<typeof serializePonsLaunch>;
  receipt: {
    transactionHash: Hex;
    blockNumber: string;
    blockHash: Hex;
    status: 'success';
    logIndex: number;
    emitter: Address;
    topics: readonly Hex[];
    data: Hex;
  };
}

export interface PonsProofBundle {
  schemaVersion: 'BINRAT_PONS_4663_RECEIPT_PROOF_V1';
  evidenceLevel: 'SINGLE_PROVIDER_CONSISTENT_NOT_INDEPENDENT';
  chainId: typeof PONS_CHAIN_ID;
  factory: typeof PONS_V2_FACTORY;
  expectedHistoricalFactoryCodeHash: Hex;
  sampledAtHead: string;
  headBufferBlocks: string;
  scannedFrom: string;
  scannedThrough: string;
  receiptCount: 3;
  receipts: [PonsReceiptProof, PonsReceiptProof, PonsReceiptProof];
  limitations: string[];
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const isHash = (value: string): value is Hex => /^0x[0-9a-fA-F]{64}$/.test(value);

export async function probePonsHistoricalFactory(client: PublicClient, block: bigint) {
  if (block < 0n) throw new Error('PONS_NEGATIVE_BLOCK');
  const chainId = await client.getChainId();
  if (chainId !== PONS_CHAIN_ID) throw new Error('PONS_CHAIN_ID_DRIFT');
  const head = await client.getBlockNumber();
  if (block > head) throw new Error('PONS_PROBE_FUTURE_BLOCK');
  const canonicalBlock = await client.getBlock({ blockNumber: block });
  if (!canonicalBlock.hash) throw new Error('PONS_PROBE_MISSING_BLOCK_HASH');
  const bytecode = await client.getBytecode({ address: PONS_V2_FACTORY, blockNumber: block });
  if (!bytecode || bytecode === '0x') throw new Error('PONS_HISTORICAL_FACTORY_CODE_MISSING');
  return {
    status: 'UNCONFIRMED_HISTORICAL_PIN' as const,
    chainId, factory: PONS_V2_FACTORY,
    blockNumber: block.toString(), blockHash: canonicalBlock.hash,
    codeHash: keccak256(bytecode), head: head.toString(),
    instruction: 'Cross-check the same historical block and code hash with an independent archive provider and verified factory deployment before using it as --code-hash.'
  };
}

/**
 * Collects three distinct transaction receipts and independently compares
 * eth_getLogs event decoding with eth_getTransactionReceipt event decoding.
 * Both reads may still come from one untrusted provider: never call this finality.
 */
export async function collectPonsReceiptProof(
  client: PublicClient, options: PonsProofOptions
): Promise<PonsProofBundle> {
  const { fromBlock, toBlock, expectedFactoryCodeHash } = options;
  const maxWindows = options.maxWindows ?? 12;
  const buffer = options.headBufferBlocks ?? 64n;
  if (!Number.isSafeInteger(maxWindows) || maxWindows < 1 || maxWindows > 12) {
    throw new Error('PONS_PROOF_WINDOW_LIMIT');
  }
  if (fromBlock < 0n || toBlock < fromBlock ||
      toBlock - fromBlock + 1n > BigInt(maxWindows) * 500n) {
    throw new Error('PONS_PROOF_SCAN_SPAN_UNBOUNDED');
  }
  if (buffer < 64n) throw new Error('PONS_PROOF_HEAD_BUFFER_TOO_SMALL');
  if (!isHash(expectedFactoryCodeHash)) throw new Error('PONS_FACTORY_CODE_PIN_REQUIRED');
  const source = new PonsV2LaunchSource({
    client, expectedFactoryCodeHash, maxWindowBlocks: 500n
  });
  const head = await source.getHeadBlockNumber();
  if (toBlock > head || head - toBlock < buffer) throw new Error('PONS_PROOF_HEAD_BUFFER_REQUIRED');

  const receipts: PonsReceiptProof[] = [];
  const seenTx = new Set<string>();
  const seenToken = new Set<string>();
  const blockFences = new Map<bigint, Hex>();
  let scannedThrough = fromBlock - 1n;
  for (let first = fromBlock; first <= toBlock && receipts.length < 3; first += 500n) {
    const last = first + 499n > toBlock ? toBlock : first + 499n;
    const events = await source.catchUp(first, last);
    scannedThrough = last;
    for (const event of events) {
      const tx = event.txHash.toLowerCase();
      // Reusing one transaction with multiple launch events is not three
      // independent transactions. Only one receipt per tx can count.
      if (seenTx.has(tx)) continue;
      if (seenToken.has(event.token.toLowerCase())) throw new Error('PONS_PROOF_DUPLICATE_TOKEN');
      const receipt = await client.getTransactionReceipt({ hash: event.txHash });
      if (receipt.status !== 'success' || !same(receipt.transactionHash, event.txHash) ||
          receipt.blockNumber !== event.blockNumber || !same(receipt.blockHash, event.blockHash)) {
        throw new Error('PONS_PROOF_RECEIPT_HEADER_CONFLICT');
      }
      const exact = receipt.logs.filter(log =>
        same(log.address, PONS_V2_FACTORY) && log.logIndex === event.logIndex &&
        same(log.transactionHash, event.txHash)
      );
      if (exact.length !== 1) throw new Error('PONS_PROOF_RECEIPT_LOG_MISSING');
      const [log] = exact;
      if (!log || log.topics[0]?.toLowerCase() !== TOPIC0 ||
          !Array.isArray(log.topics) || log.topics.length !== 4) {
        throw new Error('PONS_PROOF_RECEIPT_TOPIC_MISMATCH');
      }
      let args: {
        token: Address; curve: Address; deployer: Address; pairToken: Address;
        launchConfigId: bigint; graduationThreshold: bigint;
      };
      try {
        const decoded = decodeEventLog({
          abi: [ponsTokenLaunchedEvent],
          topics: log.topics as [Hex, ...Hex[]], data: log.data,
          strict: true
        });
        args = decoded.args as typeof args;
      } catch {
        throw new Error('PONS_PROOF_RECEIPT_ABI_MISMATCH');
      }
      if (!same(args.token, event.token) || !same(args.curve, event.curve) ||
          !same(args.deployer, event.originalDeployer) || !same(args.pairToken, event.pairToken) ||
          args.launchConfigId !== event.launchConfigId ||
          args.graduationThreshold !== event.graduationThreshold) {
        throw new Error('PONS_PROOF_RECEIPT_EVENT_CONFLICT');
      }
      const oldHash = blockFences.get(event.blockNumber);
      if (oldHash && !same(oldHash, event.blockHash)) throw new Error('PONS_PROOF_BLOCK_CONFLICT');
      blockFences.set(event.blockNumber, event.blockHash);
      seenTx.add(tx);
      seenToken.add(event.token.toLowerCase());
      receipts.push({
        launch: serializePonsLaunch(event),
        receipt: {
          transactionHash: event.txHash, blockNumber: event.blockNumber.toString(),
          blockHash: event.blockHash, status: 'success', logIndex: event.logIndex,
          emitter: PONS_V2_FACTORY, topics: [...log.topics], data: log.data
        }
      });
      if (receipts.length === 3) break;
    }
  }
  if (receipts.length < 3) throw new Error('PONS_PROOF_THREE_DISTINCT_TX_REQUIRED');

  // A changed interior event block after any receipt retrieval invalidates the
  // entire bundle. Recheck historical bytecode, not just today's factory code.
  for (const [number, expectedHash] of blockFences) {
    if (!same(await source.getBlockHash(number), expectedHash)) throw new Error('PONS_PROOF_LATE_REORG');
    await source.assertAuthority(number);
  }
  if (await source.getHeadBlockNumber() < head) throw new Error('PONS_PROOF_HEAD_REGRESSED');
  return {
    schemaVersion: 'BINRAT_PONS_4663_RECEIPT_PROOF_V1',
    evidenceLevel: 'SINGLE_PROVIDER_CONSISTENT_NOT_INDEPENDENT',
    chainId: PONS_CHAIN_ID, factory: PONS_V2_FACTORY,
    expectedHistoricalFactoryCodeHash: expectedFactoryCodeHash.toLowerCase() as Hex,
    sampledAtHead: head.toString(), headBufferBlocks: buffer.toString(),
    scannedFrom: fromBlock.toString(), scannedThrough: scannedThrough.toString(),
    receiptCount: 3,
    receipts: receipts as [PonsReceiptProof, PonsReceiptProof, PonsReceiptProof],
    limitations: [
      'One RPC provider; independent provider and block explorer agreement not proven.',
      'Head buffer is not L1 finality or a Robinhood finality guarantee.',
      'Factory source commit and supplied code hash are not proof of deployed source equivalence.',
      'Fee recipient at launch, curve trades, V4 graduation, live indexer, and chain-scoped Watch remain unproven.'
    ]
  };
}
