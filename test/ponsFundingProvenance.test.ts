import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import {
  buildPonsPrelaunchNativeInboundReceipt,
  projectFundingSourceRecurrence,
  readPonsPrelaunchNativeInbound,
  verifyPonsPrelaunchNativeInboundReceipt,
  type PonsFundingLaunch,
  type PonsFundingSource
} from '../src/pons/fundingProvenance.js';

function addr(n:number):Hex {
  return `0x${n.toString(16).padStart(40,'0')}` as Hex;
}
function hash(n:number):Hex {
  return `0x${n.toString(16).padStart(64,'0')}` as Hex;
}
function launch(id:string,deployer:Hex,block:number):PonsFundingLaunch {
  return {
    launchId:id.repeat(64),
    deployer,
    blockNumber:BigInt(block),
    blockHash:hash(block)
  };
}

function sourceFor(input:{
  launch:PonsFundingLaunch;
  sourceAddress:Hex;
  transferBlock:number;
  transferValueWei:bigint;
  transferTxHash?:Hex;
  mutateLaunchHashOnSecondRead?:boolean;
  canonicalMismatch?:boolean;
}):PonsFundingSource {
  const txHash=input.transferTxHash ?? hash(9000+input.transferBlock);
  let launchReads=0;
  return {
    async assertAuthority() {},
    async getBlockPoint(blockNumber) {
      if (blockNumber===input.launch.blockNumber) {
        launchReads+=1;
        return {
          blockNumber,
          blockHash: input.mutateLaunchHashOnSecondRead && launchReads>1
            ? hash(Number(blockNumber)+1)
            : input.launch.blockHash,
          timestampMs: Number(blockNumber)*1000
        };
      }
      return {
        blockNumber,
        blockHash:hash(Number(blockNumber)),
        timestampMs:Number(blockNumber)*1000
      };
    },
    async findLatestExternalNativeInbound(deployer,throughBlockInclusive) {
      assert.equal(deployer,input.launch.deployer);
      assert.equal(throughBlockInclusive,input.launch.blockNumber-1n);
      return {
        from:input.sourceAddress,
        to:input.launch.deployer,
        txHash,
        blockNumber:BigInt(input.transferBlock),
        valueWei:input.transferValueWei
      };
    },
    async getTransaction(requestedHash) {
      assert.equal(requestedHash,txHash);
      return {
        hash:txHash,
        from:input.canonicalMismatch ? addr(999) : input.sourceAddress,
        to:input.launch.deployer,
        valueWei:input.transferValueWei,
        blockNumber:BigInt(input.transferBlock)
      };
    }
  };
}

test('prelaunch native inbound receipt is deterministic, exact-address and tamper-evident', async () => {
  const value=launch('a',addr(42),200);
  const input={
    launch:value,
    sourceAddress:addr(7),
    transferTxHash:hash(1234),
    transferBlock:190n,
    transferBlockHash:hash(190),
    transferTimestampMs:190_000,
    valueWei:981_996_853_844_616n
  };
  const first=await buildPonsPrelaunchNativeInboundReceipt(input);
  const second=await buildPonsPrelaunchNativeInboundReceipt(input);
  assert.deepEqual(first,second);
  assert.equal(first.sourceAddress,addr(7));
  assert.equal(first.deployer,addr(42));
  assert.equal(first.valueWei,981_996_853_844_616n);
  await assert.doesNotReject(verifyPonsPrelaunchNativeInboundReceipt(first));
  await assert.rejects(
    verifyPonsPrelaunchNativeInboundReceipt({...first,valueWei:first.valueWei+1n}),
    /PONS_FUNDING_RECEIPT_INVALID/
  );
});

test('funding read verifies canonical transaction and binds transfer strictly before launch', async () => {
  const value=launch('b',addr(42),200);
  const receipt=await readPonsPrelaunchNativeInbound(
    sourceFor({
      launch:value,
      sourceAddress:addr(8),
      transferBlock:190,
      transferValueWei:1_000_000_000_000_000n
    }),
    value
  );
  assert.ok(receipt);
  assert.equal(receipt.sourceAddress,addr(8));
  assert.equal(receipt.deployer,addr(42));
  assert.equal(receipt.transferBlock,190n);
  assert.equal(receipt.launchBlock,200n);
});

test('funding read fails closed on canonical transaction mismatch and launch reorg', async () => {
  const value=launch('c',addr(42),200);
  await assert.rejects(
    readPonsPrelaunchNativeInbound(
      sourceFor({
        launch:value,
        sourceAddress:addr(8),
        transferBlock:190,
        transferValueWei:1n,
        canonicalMismatch:true
      }),
      value
    ),
    /PONS_FUNDING_TRANSFER_CANONICAL_MISMATCH/
  );
  await assert.rejects(
    readPonsPrelaunchNativeInbound(
      sourceFor({
        launch:value,
        sourceAddress:addr(8),
        transferBlock:190,
        transferValueWei:1n,
        mutateLaunchHashOnSecondRead:true
      }),
      value
    ),
    /PONS_FUNDING_LAUNCH_REORG_DURING_READ/
  );
});

test('funding receipt rejects same-block/future transfer and malformed evidence', async () => {
  const value=launch('d',addr(42),200);
  await assert.rejects(
    buildPonsPrelaunchNativeInboundReceipt({
      launch:value,
      sourceAddress:addr(8),
      transferTxHash:hash(1),
      transferBlock:200n,
      transferBlockHash:hash(200),
      transferTimestampMs:1,
      valueWei:1n
    }),
    /PONS_FUNDING_TRANSFER_NOT_PRELAUNCH/
  );
  await assert.rejects(
    buildPonsPrelaunchNativeInboundReceipt({
      launch:value,
      sourceAddress:'0x1234' as Hex,
      transferTxHash:hash(1),
      transferBlock:199n,
      transferBlockHash:hash(199),
      transferTimestampMs:1,
      valueWei:1n
    }),
    /PONS_FUNDING_SOURCE_INVALID/
  );
  await assert.rejects(
    buildPonsPrelaunchNativeInboundReceipt({
      launch:value,
      sourceAddress:addr(8),
      transferTxHash:hash(1),
      transferBlock:199n,
      transferBlockHash:hash(199),
      transferTimestampMs:1,
      valueWei:0n
    }),
    /PONS_FUNDING_TRANSFER_VALUE_INVALID/
  );
});

test('same funding source projection requires at least two distinct deployers and launches', async () => {
  const source=addr(99);
  const first=await buildPonsPrelaunchNativeInboundReceipt({
    launch:launch('e',addr(10),200),
    sourceAddress:source,
    transferTxHash:hash(10),
    transferBlock:190n,
    transferBlockHash:hash(190),
    transferTimestampMs:190_000,
    valueWei:10n
  });
  const sameDeployer=await buildPonsPrelaunchNativeInboundReceipt({
    launch:launch('f',addr(10),300),
    sourceAddress:source,
    transferTxHash:hash(11),
    transferBlock:290n,
    transferBlockHash:hash(290),
    transferTimestampMs:290_000,
    valueWei:11n
  });
  const secondDeployer=await buildPonsPrelaunchNativeInboundReceipt({
    launch:launch('1',addr(11),400),
    sourceAddress:source,
    transferTxHash:hash(12),
    transferBlock:390n,
    transferBlockHash:hash(390),
    transferTimestampMs:390_000,
    valueWei:12n
  });

  assert.deepEqual(await projectFundingSourceRecurrence([first,sameDeployer]),[]);
  const projected=await projectFundingSourceRecurrence([first,sameDeployer,secondDeployer]);
  assert.equal(projected.length,1);
  assert.equal(projected[0]?.sourceAddress,source);
  assert.equal(projected[0]?.distinctDeployers,2);
  assert.equal(projected[0]?.distinctLaunches,3);
});

test('different source addresses never collapse into a funding cluster', async () => {
  const first=await buildPonsPrelaunchNativeInboundReceipt({
    launch:launch('2',addr(20),200),
    sourceAddress:addr(100),
    transferTxHash:hash(20),
    transferBlock:190n,
    transferBlockHash:hash(190),
    transferTimestampMs:190_000,
    valueWei:10n
  });
  const second=await buildPonsPrelaunchNativeInboundReceipt({
    launch:launch('3',addr(21),300),
    sourceAddress:addr(101),
    transferTxHash:hash(21),
    transferBlock:290n,
    transferBlockHash:hash(290),
    transferTimestampMs:290_000,
    valueWei:10n
  });
  assert.deepEqual(await projectFundingSourceRecurrence([first,second]),[]);
});
