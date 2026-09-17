import test from 'node:test';
import assert from 'node:assert/strict';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { projectPublicFeed } from '../src/public/project.js';

const CHAIN_ID = 5042;
const CREATOR_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const CREATOR_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex;
const AS_OF_HASH = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as Hex;

function launch(input: {
  id: string;
  block: bigint;
  logIndex: number;
  token: Hex;
  creator: Hex;
  symbol: string;
}): LaunchObserved {
  const blockHex = input.block.toString(16).padStart(64, '0');
  const txTail = input.logIndex.toString(16).padStart(64, '0');
  return {
    launchId: input.id,
    eventId: `event:${input.id}`,
    chainId: CHAIN_ID,
    blockNumber: input.block,
    blockHash: `0x${blockHex}` as Hex,
    observedAtMs: 1_000,
    source: 'ARCPAD',
    launcher: '0x1111111111111111111111111111111111111111',
    txHash: `0x${txTail}` as Hex,
    logIndex: input.logIndex,
    token: input.token,
    creator: input.creator,
    pool: '0x2222222222222222222222222222222222222222',
    name: `${input.symbol} name`,
    symbol: input.symbol,
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

test('public projection is deterministic and makes reported-creator semantics explicit', async () => {
  const a1 = launch({ id: 'a1', block: 100n, logIndex: 0, token: '0x1000000000000000000000000000000000000001', creator: CREATOR_A, symbol: 'OLD1' });
  const a2 = launch({ id: 'a2', block: 101n, logIndex: 0, token: '0x1000000000000000000000000000000000000002', creator: CREATOR_A, symbol: 'OLD2' });
  const b1 = launch({ id: 'b1', block: 102n, logIndex: 0, token: '0x2000000000000000000000000000000000000001', creator: CREATOR_B, symbol: 'OTHER' });
  const a3 = launch({ id: 'a3', block: 103n, logIndex: 0, token: '0x1000000000000000000000000000000000000003', creator: CREATOR_A, symbol: 'NEW' });
  const launches = [a1, a2, b1, a3];
  const facts = await Promise.all(launches.map(buildProvenanceFact));

  const input = {
    chainId: CHAIN_ID,
    asOfBlock: 103n,
    asOfBlockHash: AS_OF_HASH,
    historyCoverage: 'COMPLETE' as const,
    launches,
    facts
  };

  const forward = await projectPublicFeed(input);
  const reversed = await projectPublicFeed({ ...input, launches: [...launches].reverse(), facts: [...facts].reverse() });

  assert.deepEqual(forward, reversed);
  assert.equal(forward.bags[0]?.id, 'a3');
  assert.equal(forward.bags[0]?.reportedCreatorAddress, CREATOR_A);
  assert.equal(forward.bags[0]?.trashTrail.priorLaunchCount, 2);
  assert.deepEqual(forward.bags[0]?.trashTrail.prior.map((item) => item.launchId), ['a1', 'a2']);
  assert.equal(forward.bags[0]?.evidence.find((item) => item.code === 'REPORTED_CREATOR_PRIOR_LAUNCHES')?.state, 'NOTED');
  assert.match(forward.receipt.receiptId, /^binrat-public:[0-9a-f]{64}$/);

  const serialized = JSON.stringify(forward).toLowerCase();
  assert.equal(serialized.includes('deployer'), false);
  assert.equal(serialized.includes('wallet'), false);
  assert.equal(serialized.includes('buy_eligible'), false);
  assert.equal(serialized.includes('safe score'), false);
});

test('absence of prior history stays unknown unless history coverage is complete', async () => {
  const only = launch({ id: 'only', block: 100n, logIndex: 0, token: '0x3000000000000000000000000000000000000001', creator: CREATOR_A, symbol: 'ONLY' });
  const fact = await buildProvenanceFact(only);

  const partial = await projectPublicFeed({
    chainId: CHAIN_ID,
    asOfBlock: 100n,
    asOfBlockHash: AS_OF_HASH,
    historyCoverage: 'PARTIAL',
    launches: [only],
    facts: [fact]
  });
  assert.equal(partial.bags[0]?.evidence.find((item) => item.code === 'PRIOR_HISTORY_NOT_ESTABLISHED')?.state, 'UNKNOWN');

  const complete = await projectPublicFeed({
    chainId: CHAIN_ID,
    asOfBlock: 100n,
    asOfBlockHash: AS_OF_HASH,
    historyCoverage: 'COMPLETE',
    launches: [only],
    facts: [fact]
  });
  assert.equal(complete.bags[0]?.evidence.find((item) => item.code === 'NO_PRIOR_INDEXED_LAUNCH')?.state, 'OBSERVED');
});

test('public projection fails closed on future or mismatched provenance input', async () => {
  const item = launch({ id: 'future', block: 101n, logIndex: 0, token: '0x4000000000000000000000000000000000000001', creator: CREATOR_A, symbol: 'FUTURE' });
  const fact = await buildProvenanceFact(item);

  await assert.rejects(
    projectPublicFeed({
      chainId: CHAIN_ID,
      asOfBlock: 100n,
      asOfBlockHash: AS_OF_HASH,
      historyCoverage: 'UNVERIFIED',
      launches: [item],
      facts: [fact]
    }),
    /PUBLIC_FUTURE_LAUNCH/
  );

  const tampered = { ...fact, creator: CREATOR_B };
  await assert.rejects(
    projectPublicFeed({
      chainId: CHAIN_ID,
      asOfBlock: 101n,
      asOfBlockHash: AS_OF_HASH,
      historyCoverage: 'UNVERIFIED',
      launches: [item],
      facts: [tampered]
    }),
    /PUBLIC_FACT_AUTHORITY_MISMATCH/
  );
});
