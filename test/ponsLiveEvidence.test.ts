import assert from 'node:assert/strict';
import test from 'node:test';
import {
  encodeAbiParameters, encodeEventTopics, keccak256,
  type Address, type Hex, type PublicClient
} from 'viem';
import {
  PONS_CHAIN_ID, PONS_V2_FACTORY, ponsTokenLaunchedEvent
} from '../src/pons/source.js';
import {
  collectPonsReceiptProof, probePonsHistoricalFactory
} from '../src/pons/liveEvidence.js';

const address = (n: number) => ('0x' + n.toString(16).padStart(40, '0')) as Address;
const hex = (n: number) => ('0x' + n.toString(16).padStart(64, '0')) as Hex;
const blockHash = (n: bigint) => hex(Number(n) + 900);
const pinnedBytecode = '0x6001' as const;
const pinnedHash = keccak256(pinnedBytecode);
const abiData = [
  { type: 'address', name: 'pairToken' }, { type: 'uint256', name: 'launchConfigId' },
  { type: 'uint256', name: 'graduationThreshold' }
] as const;
type MockEvent = {
  address: Address; blockNumber: bigint; blockHash: Hex;
  transactionHash: Hex; logIndex: number;
  args: {
    token: Address; curve: Address; deployer: Address; pairToken: Address;
    launchConfigId: bigint; graduationThreshold: bigint;
  };
};
function launch(n: number, tx = n): MockEvent {
  const blockNumber = 100n + BigInt(n);
  return {
    address: PONS_V2_FACTORY, blockNumber, blockHash: blockHash(blockNumber),
    transactionHash: hex(5000 + tx), logIndex: 10 + n,
    args: {
      token: address(200 + n), curve: address(300 + n),
      deployer: address(400 + n), pairToken: address(0),
      launchConfigId: BigInt(n), graduationThreshold: BigInt(n + 1000)
    }
  };
}
function rawLog(event: MockEvent) {
  const topics = encodeEventTopics({
    abi: [ponsTokenLaunchedEvent], eventName: 'TokenLaunched',
    args: {
      token: event.args.token, curve: event.args.curve, deployer: event.args.deployer
    }
  });
  const data = encodeAbiParameters(abiData, [
    event.args.pairToken, event.args.launchConfigId, event.args.graduationThreshold
  ]);
  return {
    address: event.address, transactionHash: event.transactionHash,
    blockNumber: event.blockNumber, blockHash: event.blockHash,
    logIndex: event.logIndex, topics, data
  };
}
function mockClient(
  rows: MockEvent[] = [launch(0), launch(1), launch(2)],
  changes: {
    chainId?: number; bytecode?: Hex; head?: bigint;
    changeReceipt?: (receipt: any) => any; lateReorg?: boolean;
    throwReceipt?: boolean
  } = {}
): PublicClient {
  let readsOf100 = 0;
  const receipts = new Map<string, {
    transactionHash: Hex; blockNumber: bigint; blockHash: Hex;
    status: string; logs: ReturnType<typeof rawLog>[];
  }>();
  for (const row of rows) {
    const key = row.transactionHash.toLowerCase();
    const existing = receipts.get(key);
    if (existing) {
      if (existing.blockNumber !== row.blockNumber) throw new Error('INVALID_MOCK_TX_CROSS_BLOCK');
      existing.logs.push(rawLog(row));
    } else {
      receipts.set(key, {
        transactionHash: row.transactionHash, blockNumber: row.blockNumber,
        blockHash: row.blockHash, status: 'success', logs: [rawLog(row)]
      });
    }
  }
  return {
    async getChainId() { return changes.chainId ?? PONS_CHAIN_ID; },
    async getBlockNumber() { return changes.head ?? 300n; },
    async getBytecode() { return changes.bytecode ?? pinnedBytecode; },
    async getBlock({ blockNumber }: { blockNumber: bigint }) {
      // The source's 100..110 window finishes while this remains stable.
      // Make the last proof-bundle reread disagree after receipts are fetched.
      if (changes.lateReorg && blockNumber === 100n && ++readsOf100 >= 5) {
        return { hash: hex(99999) };
      }
      return { hash: blockHash(blockNumber) };
    },
    async getLogs({ fromBlock, toBlock }: { fromBlock: bigint; toBlock: bigint }) {
      return rows.filter(row => row.blockNumber >= fromBlock && row.blockNumber <= toBlock);
    },
    async getTransactionReceipt({ hash }: { hash: Hex }) {
      if (changes.throwReceipt) throw new Error('RPC_429');
      const receipt = receipts.get(hash.toLowerCase());
      if (!receipt) throw new Error('TRANSACTION_NOT_FOUND');
      return changes.changeReceipt ? changes.changeReceipt(receipt) : receipt;
    }
  } as unknown as PublicClient;
}
const opts = {
  fromBlock: 100n, toBlock: 110n, expectedFactoryCodeHash: pinnedHash
};

test('probe returns historic bytecode hash but explicitly NOT an independently verified pin', async () => {
  const report = await probePonsHistoricalFactory(mockClient(), 100n);
  assert.equal(report.chainId, 4663);
  assert.equal(report.codeHash, pinnedHash);
  assert.equal(report.blockHash, blockHash(100n));
  assert.equal(report.status, 'UNCONFIRMED_HISTORICAL_PIN');
});

test('three distinct tx receipts cross-check getLogs, receipt ABI, historical code, and canonical block hashes', async () => {
  const result = await collectPonsReceiptProof(mockClient(), opts);
  assert.equal(result.evidenceLevel, 'SINGLE_PROVIDER_CONSISTENT_NOT_INDEPENDENT');
  assert.equal(result.receiptCount, 3);
  assert.equal(result.receipts.length, 3);
  assert.deepEqual(result.receipts.map(x => x.launch.blockNumber), ['100', '101', '102']);
  assert.equal(new Set(result.receipts.map(x => x.receipt.transactionHash)).size, 3);
  assert.equal(result.receipts[0]!.launch.originalDeployer, address(400));
  assert.equal(result.receipts[0]!.launch.creatorFeeRecipientAtLaunch, null);
  assert.equal(result.receipts[0]!.receipt.topics.length, 4);
  assert.ok(result.limitations.some(s => /not L1 finality/.test(s)));
});

test('a transaction with multiple launches cannot count twice as distinct evidence', async () => {
  const sharedTx = { ...launch(1, 0), blockNumber: 100n, blockHash: blockHash(100n) };
  const result = await collectPonsReceiptProof(
    mockClient([launch(0), sharedTx, launch(2), launch(3)]), opts
  );
  assert.equal(new Set(result.receipts.map(x => x.receipt.transactionHash)).size, 3);
  await assert.rejects(collectPonsReceiptProof(
    mockClient([launch(0), sharedTx, launch(2)]), opts
  ), /PONS_PROOF_THREE_DISTINCT_TX_REQUIRED/);
});

test('a source-only log or a transaction that failed cannot masquerade as a real receipt', async () => {
  await assert.rejects(collectPonsReceiptProof(
    mockClient(undefined, { changeReceipt: receipt => ({...receipt, logs: []}) }), opts
  ), /PONS_PROOF_RECEIPT_LOG_MISSING/);
  await assert.rejects(collectPonsReceiptProof(
    mockClient(undefined, { changeReceipt: receipt => ({...receipt, status:'reverted'}) }), opts
  ), /PONS_PROOF_RECEIPT_HEADER_CONFLICT/);
});

test('receipt-level ABI conflict, wrong log topic, and missing receipt fail closed', async () => {
  await assert.rejects(collectPonsReceiptProof(mockClient(undefined, {
    changeReceipt: receipt => ({
      ...receipt, logs: [{
        ...receipt.logs[0],
        data: encodeAbiParameters(abiData, [address(1), 0n, 999n])
      }]
    })
  }), opts), /PONS_PROOF_RECEIPT_EVENT_CONFLICT/);
  await assert.rejects(collectPonsReceiptProof(mockClient(undefined, {
    changeReceipt: receipt => ({
      ...receipt, logs: [{
        ...receipt.logs[0],
        topics: [hex(1), ...receipt.logs[0].topics.slice(1)]
      }]
    })
  }), opts), /PONS_PROOF_RECEIPT_TOPIC_MISMATCH/);
  await assert.rejects(collectPonsReceiptProof(
    mockClient(undefined, { throwReceipt: true }), opts
  ), /RPC_429/);
});

test('bad historical code, wrong chain, insufficient head buffer, and unbounded scan never produce a proof', async () => {
  await assert.rejects(collectPonsReceiptProof(mockClient(undefined, {chainId:5042}), opts), /PONS_CHAIN_ID_DRIFT/);
  await assert.rejects(collectPonsReceiptProof(mockClient(undefined, {bytecode:'0x6002'}), opts), /PONS_FACTORY_CODE_HASH_DRIFT/);
  await assert.rejects(collectPonsReceiptProof(mockClient(undefined, {head:120n}), opts), /PONS_PROOF_HEAD_BUFFER_REQUIRED/);
  await assert.rejects(collectPonsReceiptProof(mockClient(), {
    ...opts, fromBlock: 1n, toBlock: 6001n
  }), /PONS_PROOF_SCAN_SPAN_UNBOUNDED/);
  await assert.rejects(collectPonsReceiptProof(mockClient(), {
    ...opts, maxWindows: 13
  }), /PONS_PROOF_WINDOW_LIMIT/);
});

test('post-receipt interior block reorg invalidates the entire bundle', async () => {
  await assert.rejects(collectPonsReceiptProof(
    mockClient(undefined, {lateReorg:true}), opts
  ), /PONS_PROOF_LATE_REORG|PONS_SCAN_REORG/);
});
