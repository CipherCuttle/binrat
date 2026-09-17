import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { projectPublicFeed } from '../src/public/project.js';

const CHAIN_ID = 5042;
const CREATOR_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
const CREATOR_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex;
const AS_OF_HASH = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as Hex;

async function launch(input: {
  block: bigint;
  logIndex: number;
  token: Hex;
  creator: Hex;
  symbol: string;
}): Promise<LaunchObserved> {
  const blockHex = input.block.toString(16).padStart(64, '0');
  const launcher = '0x1111111111111111111111111111111111111111' as Hex;
  const txHash = `0x${blockHex}` as Hex;
  const launchId = await deriveLaunchId({ chainId: CHAIN_ID, launcher, txHash, token: input.token });
  const eventId = await deriveEventId({ chainId: CHAIN_ID, launcher, txHash, logIndex: input.logIndex });
  return {
    launchId,
    eventId,
    chainId: CHAIN_ID,
    blockNumber: input.block,
    blockHash: `0x${blockHex}` as Hex,
    observedAtMs: 1_000,
    source: 'ARCPAD',
    launcher,
    txHash,
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
  const a1 = await launch({ block: 100n, logIndex: 0, token: '0x1000000000000000000000000000000000000001', creator: CREATOR_A, symbol: 'OLD1' });
  const a2 = await launch({ block: 101n, logIndex: 0, token: '0x1000000000000000000000000000000000000002', creator: CREATOR_A, symbol: 'OLD2' });
  const b1 = await launch({ block: 102n, logIndex: 0, token: '0x2000000000000000000000000000000000000001', creator: CREATOR_B, symbol: 'OTHER' });
  const a3 = await launch({ block: 103n, logIndex: 0, token: '0x1000000000000000000000000000000000000003', creator: CREATOR_A, symbol: 'NEW' });
  const launches = [a1, a2, b1, a3];
  const facts = await Promise.all(launches.map(buildProvenanceFact));

  const input = {
    chainId: CHAIN_ID,
    asOfBlock: 103n,
    asOfBlockHash: AS_OF_HASH,
    launches,
    facts
  };

  const forward = await projectPublicFeed(input);
  const reversed = await projectPublicFeed({ ...input, launches: [...launches].reverse(), facts: [...facts].reverse() });

  assert.deepEqual(forward, reversed);
  assert.equal(forward.historyCoverage, 'UNVERIFIED');
  assert.equal(forward.receipt.historyCoverage, 'UNVERIFIED');
  assert.equal(forward.bags[0]?.id, a3.launchId);
  assert.equal(forward.bags[0]?.reportedCreatorAddress, CREATOR_A);
  assert.equal(forward.bags[0]?.trashTrail.priorLaunchCount, 2);
  assert.equal(forward.bags[0]?.trashTrail.coverage, 'UNVERIFIED');
  assert.deepEqual(forward.bags[0]?.trashTrail.prior.map((item) => item.launchId), [a1.launchId, a2.launchId]);
  assert.equal(forward.bags[0]?.evidence.find((item) => item.code === 'REPORTED_CREATOR_PRIOR_LAUNCHES')?.state, 'NOTED');
  assert.match(forward.receipt.receiptId, /^binrat-public:[0-9a-f]{64}$/);

  const serialized = JSON.stringify(forward).toLowerCase();
  assert.equal(serialized.includes('deployer'), false);
  assert.equal(serialized.includes('walletowner'), false);
  assert.equal(serialized.includes('buy_eligible'), false);
  assert.equal(serialized.includes('safe score'), false);
});

test('absence of prior history is always unknown in PUBLIC_PROJECTION_V0', async () => {
  const only = await launch({ block: 100n, logIndex: 0, token: '0x3000000000000000000000000000000000000001', creator: CREATOR_A, symbol: 'ONLY' });
  const fact = await buildProvenanceFact(only);

  const feed = await projectPublicFeed({
    chainId: CHAIN_ID,
    asOfBlock: 100n,
    asOfBlockHash: AS_OF_HASH,
    launches: [only],
    facts: [fact]
  });

  assert.equal(feed.historyCoverage, 'UNVERIFIED');
  assert.equal(feed.bags[0]?.evidence.find((item) => item.code === 'PRIOR_HISTORY_NOT_ESTABLISHED')?.state, 'UNKNOWN');
  assert.equal(feed.bags[0]?.evidence.some((item) => item.code === 'NO_PRIOR_INDEXED_LAUNCH'), false);
});

test('public projection fails closed on future or mismatched provenance input', async () => {
  const item = await launch({ block: 101n, logIndex: 0, token: '0x4000000000000000000000000000000000000001', creator: CREATOR_A, symbol: 'FUTURE' });
  const fact = await buildProvenanceFact(item);

  await assert.rejects(
    projectPublicFeed({
      chainId: CHAIN_ID,
      asOfBlock: 100n,
      asOfBlockHash: AS_OF_HASH,
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
      launches: [item],
      facts: [tampered]
    }),
    /PUBLIC_FACT_AUTHORITY_MISMATCH/
  );
});

test('public projection recomputes launch and event identity', async () => {
  const item = await launch({ block: 105n, logIndex: 0, token: '0x4500000000000000000000000000000000000001', creator: CREATOR_A, symbol: 'IDENTITY' });
  const fact = await buildProvenanceFact(item);

  await assert.rejects(
    projectPublicFeed({
      chainId: CHAIN_ID,
      asOfBlock: 105n,
      asOfBlockHash: AS_OF_HASH,
      launches: [{ ...item, launchId: `${item.launchId}:tampered` }],
      facts: [fact]
    }),
    /PUBLIC_LAUNCH_IDENTITY_MISMATCH/
  );

  await assert.rejects(
    projectPublicFeed({
      chainId: CHAIN_ID,
      asOfBlock: 105n,
      asOfBlockHash: AS_OF_HASH,
      launches: [{ ...item, eventId: `${item.eventId}:tampered` }],
      facts: [fact]
    }),
    /PUBLIC_LAUNCH_IDENTITY_MISMATCH/
  );
});

test('public projection recomputes provenance fact identity and digest', async () => {
  const item = await launch({ block: 110n, logIndex: 0, token: '0x5000000000000000000000000000000000000001', creator: CREATOR_A, symbol: 'HASH' });
  const fact = await buildProvenanceFact(item);

  await assert.rejects(
    projectPublicFeed({
      chainId: CHAIN_ID,
      asOfBlock: 110n,
      asOfBlockHash: AS_OF_HASH,
      launches: [item],
      facts: [{ ...fact, factId: `${fact.factId}:tampered` }]
    }),
    /PUBLIC_FACT_INTEGRITY_MISMATCH/
  );

  await assert.rejects(
    projectPublicFeed({
      chainId: CHAIN_ID,
      asOfBlock: 110n,
      asOfBlockHash: AS_OF_HASH,
      launches: [item],
      facts: [{ ...fact, evidenceDigest: '0'.repeat(64) }]
    }),
    /PUBLIC_FACT_INTEGRITY_MISMATCH/
  );
});

test('public projection rejects malformed as-of authority', async () => {
  await assert.rejects(
    projectPublicFeed({
      chainId: CHAIN_ID,
      asOfBlock: 0n,
      asOfBlockHash: '0x1234' as Hex,
      launches: [],
      facts: []
    }),
    /PUBLIC_AS_OF_BLOCK_HASH_INVALID/
  );
});
