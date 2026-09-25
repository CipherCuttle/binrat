import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const root = new URL('../evidence/pons/4663/2026-09-25/', import.meta.url);
const manifest = readJson(new URL('manifest.json', root));
const solid = readJson(new URL('solidrpc.receipt-proof.json', root));
const tenderly = readJson(new URL('tenderly.receipt-proof.json', root));

assert.equal(manifest.schemaVersion, 'BINRAT_PONS_4663_INDEPENDENT_EVIDENCE_V1');
assert.equal(manifest.verdict, 'INDEPENDENTLY_VERIFIED_THREE_RECEIPTS');
assert.equal(manifest.chainId, 4663);
assert.equal(manifest.receipts.length, 3);
assert.equal(new Set(manifest.receipts.map((x) => x.transactionHash)).size, 3);
assert.equal(new Set(manifest.receipts.map((x) => x.token)).size, 3);
assert.equal(solid.providerId, 'solidrpc-public');
assert.equal(tenderly.providerId, 'tenderly-public-gateway');
assert.notEqual(solid.providerId, tenderly.providerId);
assert.equal(manifest.providers.find((x) => x.id === solid.providerId)?.proofFile, 'solidrpc.receipt-proof.json');
assert.equal(manifest.providers.find((x) => x.id === tenderly.providerId)?.proofFile, 'tenderly.receipt-proof.json');

const core = (proof) => ({
  chainId: proof.chainId,
  factory: proof.factory,
  expectedHistoricalFactoryCodeHash: proof.expectedHistoricalFactoryCodeHash,
  receipts: proof.receipts
});
assert.deepEqual(core(solid), core(tenderly));
assert.deepEqual(
  solid.receipts.map(summary),
  manifest.receipts.map((x) => ({
    transactionHash: x.transactionHash,
    blockNumber: x.blockNumber,
    blockHash: x.blockHash,
    logIndex: x.logIndex,
    token: x.token,
    curve: x.curve,
    originalDeployer: x.originalDeployer,
    pairToken: x.pairToken
  }))
);
const digest = createHash('sha256').update(stableJson(core(solid))).digest('hex');
assert.equal(digest, manifest.receiptCoreSha256);
for (const proof of [solid, tenderly]) {
  assert.equal(proof.receiptCount, 3);
  assert.equal(proof.chainId, manifest.chainId);
  assert.equal(proof.factory.toLowerCase(), manifest.factory.toLowerCase());
  for (const item of proof.receipts) {
    assert.equal(item.receipt.status, 'success');
    assert.equal(item.receipt.emitter.toLowerCase(), manifest.factory.toLowerCase());
    assert.equal(item.receipt.topics[0].toLowerCase(), manifest.eventTopic0);
    assert.equal(item.receipt.topics.length, 4);
    assert.equal(item.launch.creatorFeeRecipientAtLaunch, null);
    assert.equal(item.receipt.transactionHash.toLowerCase(), item.launch.txHash.toLowerCase());
    assert.equal(item.receipt.blockNumber, item.launch.blockNumber);
    assert.equal(item.receipt.blockHash.toLowerCase(), item.launch.blockHash.toLowerCase());
    assert.equal(item.receipt.logIndex, item.launch.logIndex);
    assert.equal(item.receipt.topics[1].slice(-40).toLowerCase(), item.launch.token.slice(2).toLowerCase());
    assert.equal(item.receipt.topics[2].slice(-40).toLowerCase(), item.launch.curve.slice(2).toLowerCase());
    assert.equal(item.receipt.topics[3].slice(-40).toLowerCase(), item.launch.originalDeployer.slice(2).toLowerCase());
    assert.equal(/^0x[0-9a-f]{192}$/i.test(item.receipt.data), true);
    const words = item.receipt.data.slice(2).match(/.{64}/g);
    assert.ok(words);
    assert.equal('0x' + words[0].slice(-40), item.launch.pairToken.toLowerCase());
    assert.equal(BigInt('0x' + words[1]), BigInt(item.launch.launchConfigId));
    assert.equal(BigInt('0x' + words[2]), BigInt(item.launch.graduationThreshold));
  }
}
process.stdout.write(JSON.stringify({ ok: true, receiptCoreSha256: digest, receiptCount: 3 }) + '\n');

function summary(item) {
  return {
    transactionHash: item.receipt.transactionHash,
    blockNumber: item.receipt.blockNumber,
    blockHash: item.receipt.blockHash,
    logIndex: item.receipt.logIndex,
    token: item.launch.token,
    curve: item.launch.curve,
    originalDeployer: item.launch.originalDeployer,
    pairToken: item.launch.pairToken
  };
}
function readJson(url) { return JSON.parse(readFileSync(url, 'utf8')); }
function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
  }
  return JSON.stringify(value);
}
