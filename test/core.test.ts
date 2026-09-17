import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson, sha256Hex } from '../src/evidence/canonical.js';
import { deriveLaunchId, sameLaunchAuthority } from '../src/core/identity.js';
import type { LaunchObserved } from '../src/core/types.js';
import { buildProvenanceFact, projectProvenanceEdges } from '../src/intelligence/provenance.js';

function launch(id: string, creator: `0x${string}`, blockNumber: bigint, logIndex: number): LaunchObserved {
  return {
    chainId: 5042,
    blockNumber,
    blockHash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
    observedAtMs: Number(blockNumber),
    launchId: id,
    eventId: `event-${id}`,
    source: 'ARCPAD',
    launcher: '0x24196cd6e534cfce8f480b53e70809b68ea86f29',
    txHash: `0x${(1000 + logIndex + Number(blockNumber)).toString(16).padStart(64, '0')}`,
    logIndex,
    token: `0x${id.padStart(40, '0')}`,
    creator,
    pool: `0x${(`f${id}`).padStart(40, '0')}`,
    name: id,
    symbol: id.toUpperCase(),
    imageUri: '', website: '', twitter: '', telegram: ''
  };
}

test('canonical json and hash are deterministic', async () => {
  assert.equal(canonicalJson({ b: 2, a: 1n }), '{"a":"1","b":2}');
  assert.equal(await sha256Hex({ b: 2, a: 1n }), await sha256Hex({ a: 1n, b: 2 }));
});

test('launch identity is stable across case normalization', async () => {
  const lower = await deriveLaunchId({
    chainId: 5042,
    launcher: '0x24196cd6e534cfce8f480b53e70809b68ea86f29',
    txHash: `0x${'ab'.repeat(32)}`,
    token: `0x${'cd'.repeat(20)}`
  });
  const upper = await deriveLaunchId({
    chainId: 5042,
    launcher: '0x24196CD6e534cfCE8F480B53E70809b68Ea86F29',
    txHash: `0x${'AB'.repeat(32)}`,
    token: `0x${'CD'.repeat(20)}`
  });
  assert.equal(lower, upper);
});

test('observation time is not chain authority', () => {
  const a = launch('a1', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 10n, 1);
  assert.equal(sameLaunchAuthority(a, { ...a, observedAtMs: a.observedAtMs + 999 }), true);
  assert.equal(sameLaunchAuthority(a, { ...a, symbol: 'DIFF' }), false);
});

test('provenance projection is deterministic and keeps reported creator as an address', async () => {
  const creatorA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
  const creatorB = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as const;
  const launches = [launch('a1', creatorA, 10n, 1), launch('b1', creatorB, 10n, 2), launch('a2', creatorA, 10n, 3), launch('a3', creatorA, 12n, 0)];
  const facts = await Promise.all(launches.map(buildProvenanceFact));
  assert.ok(facts.every((fact) => fact.kind === 'ARCPAD_REPORTED_CREATOR'));
  const edges = await projectProvenanceEdges(facts);
  assert.deepEqual(await projectProvenanceEdges([...facts].reverse()), edges);
  const reported = edges.filter((edge) => edge.kind === 'REPORTED_CREATOR');
  assert.equal(reported.length, 4);
  assert.ok(reported.every((edge) => edge.to.startsWith('address:5042:')));
  const previous = edges.filter((edge) => edge.kind === 'PREVIOUS_LAUNCH');
  assert.equal(previous.length, 2);
  assert.ok(previous.every((edge) => edge.evidenceClass === 'DERIVED_ONCHAIN'));
  assert.ok(edges.every((edge) => edge.evidenceDigest.length === 64));
});
