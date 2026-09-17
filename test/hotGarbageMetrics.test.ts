import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import { computeHotGarbageMetrics, decideHotGarbage, reconcileTokenSets } from '../src/experiment/hotGarbageMetrics.js';

function launch(index: number, creator: Hex, metadata: Partial<Pick<LaunchObserved, 'website' | 'twitter' | 'telegram'>> = {}): LaunchObserved {
  const nibble = index.toString(16).padStart(40, '0');
  return {
    chainId: 5042,
    blockNumber: BigInt(100 + index),
    blockHash: `0x${index.toString(16).padStart(64, '0')}` as Hex,
    observedAtMs: index,
    launchId: `launch-${index}`,
    eventId: `event-${index}`,
    source: 'ARCPAD',
    launcher: '0x24196cd6e534cfce8f480b53e70809b68ea86f29',
    txHash: `0x${(1000 + index).toString(16).padStart(64, '0')}` as Hex,
    logIndex: index,
    token: `0x${nibble}` as Hex,
    creator,
    pool: `0x${(5000 + index).toString(16).padStart(40, '0')}` as Hex,
    name: `Token ${index}`,
    symbol: `T${index}`,
    imageUri: '',
    website: metadata.website ?? '',
    twitter: metadata.twitter ?? '',
    telegram: metadata.telegram ?? ''
  };
}

test('metrics count repeated reported creator addresses without inferring identity', () => {
  const a = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
  const b = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex;
  const launches = [
    launch(1, a, { website: 'https://one.example' }),
    launch(2, a, { twitter: 'https://x.com/example' }),
    launch(3, a),
    launch(4, b, { telegram: 'https://t.me/example' })
  ];
  const metrics = computeHotGarbageMetrics(launches);
  assert.deepEqual(metrics, {
    launchCount: 4,
    uniqueCreatorAddresses: 2,
    repeatCreatorAddresses: 1,
    launchesFromRepeatCreatorAddresses: 3,
    maxLaunchesByOneCreatorAddress: 3,
    metadata: {
      withWebsite: 1,
      withTwitter: 1,
      withTelegram: 1,
      withAnySocialOrWebsite: 3
    }
  });
});

test('volume gates are frozen at 10 and 25 launches', () => {
  assert.equal(decideHotGarbage(0), 'ARCPAD_ONLY_TOO_SPARSE');
  assert.equal(decideHotGarbage(9), 'ARCPAD_ONLY_TOO_SPARSE');
  assert.equal(decideHotGarbage(10), 'ADD_SECOND_SOURCE');
  assert.equal(decideHotGarbage(24), 'ADD_SECOND_SOURCE');
  assert.equal(decideHotGarbage(25), 'CONTINUE_ARCPAD_ONLY');
});

test('reconciliation is case-insensitive and reports both directional capture rates', () => {
  const a = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as Hex;
  const b = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as Hex;
  const c = '0xcccccccccccccccccccccccccccccccccccccccc' as Hex;
  const result = reconcileTokenSets(
    [a.toUpperCase() as Hex, b],
    [a, c]
  );
  assert.equal(result.onchainCount, 2);
  assert.equal(result.apiCount, 2);
  assert.equal(result.inBoth, 1);
  assert.deepEqual(result.missingFromApi, [b]);
  assert.deepEqual(result.missingFromOnchain, [c]);
  assert.equal(result.onchainCapturePercentAgainstApi, 50);
  assert.equal(result.apiCapturePercentAgainstOnchain, 50);
  assert.equal(result.agreementPercentAgainstUnion, 33.3333);
});
