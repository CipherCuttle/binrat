import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adaptPublicRecipientActivity, loadLiveRecipientActivity } from '../web-v2/src/recipientActivity.js';
const recipient = '0x' + 'a'.repeat(40);
const sender = '0x' + 'b'.repeat(40);
const token = '0x' + 'c'.repeat(40);
const quote = '0x' + 'd'.repeat(40);
const hash = '0x' + 'f'.repeat(64);
const id = '1'.repeat(64);
const base = {
  schemaVersion: 'binrat.rat-radar-address-activity/0.1',
  chainId: 5042, asOfBlock: '120', observedRecipientAddress: recipient,
  activityCount: 1,
  identityBoundary: 'An observed recipient address is not automatically a human trader identity.',
  activities: [{
    schemaVersion: 'binrat.rat-radar-activity/0.1', version: 'binrat.rat-radar-swap/0.1',
    activityId: id, chainId: 5042, launchId: '2'.repeat(64),
    pool: quote, token, token0: token, token1: quote,
    blockNumber: '110', blockHash: hash, txHash: hash, logIndex: 0,
    sender, recipient, tokenSide: 'TOKEN0', amount0: '-42', amount1: '15',
    sqrtPriceX96: '123', liquidity: '456', tick: -10,
    launchedTokenDelta: '-42', launchedTokenFlow: 'POOL_TO_RECIPIENT',
    evidenceDigest: '3'.repeat(64),
    identityBoundary: 'sender and recipient are evidenced protocol roles, not inferred human identities',
  }],
};
const clone = () => structuredClone(base);
const invalid = (value: unknown) => assert.throws(
  () => adaptPublicRecipientActivity(value, recipient),
  /RAT_RADAR_RECIPIENT_ACTIVITY_SCHEMA_INVALID/,
);

test('validates and normalizes the exact requested recipient, without fabricating a proof', () => {
  const v = clone();
  v.observedRecipientAddress = recipient.toUpperCase().replace('0X','0x');
  v.activities[0]!.recipient = recipient.toUpperCase().replace('0X','0x');
  const result = adaptPublicRecipientActivity(v, recipient);
  assert.equal(result.observedRecipientAddress, recipient);
  assert.equal(result.activities[0]?.recipient, recipient);
  assert.equal(result.activities[0]?.launchedTokenDelta, '-42');
  assert.equal(result.asOfBlock, '120');
});

test('validates empty but indexed activity separately from an unavailable endpoint', () => {
  const v = clone();
  v.activities = [];
  v.activityCount = 0;
  assert.deepEqual(adaptPublicRecipientActivity(v, recipient).activities, []);
});

test('rejects wrong address, future activity, duplicated ID and count mismatch', () => {
  const wrong = clone(); wrong.observedRecipientAddress = sender; invalid(wrong);
  const recordWrong = clone(); recordWrong.activities[0]!.recipient = sender; invalid(recordWrong);
  const future = clone(); future.activities[0]!.blockNumber = '121'; invalid(future);
  const count = clone(); count.activityCount = 2; invalid(count);
  const duplicate = clone(); duplicate.activities.push(structuredClone(duplicate.activities[0]!)); duplicate.activityCount = 2; invalid(duplicate);
});

test('rejects malformed ids, inconsistent token side, impossible pool flow and invalid numeric fields', () => {
  const badId = clone(); badId.activities[0]!.activityId = 'not-a-digest'; invalid(badId);
  const badSide = clone(); badSide.activities[0]!.tokenSide = 'TOKEN1'; invalid(badSide);
  const badDelta = clone(); badDelta.activities[0]!.launchedTokenDelta = '42'; invalid(badDelta);
  const badFlow = clone(); badFlow.activities[0]!.launchedTokenFlow = 'CALLBACK_SIDE_TO_POOL'; invalid(badFlow);
  const badTick = clone(); badTick.activities[0]!.tick = Number.NaN; invalid(badTick);
  const badHash = clone(); badHash.activities[0]!.txHash = '0x00'; invalid(badHash);
});

test('never fetches a malformed address and fails closed on upstream HTTP error', async () => {
  let calls = 0;
  const fetcher = (async () => { calls++; return { ok: false, status: 503 } as Response; }) as typeof fetch;
  await assert.rejects(loadLiveRecipientActivity('not-an-address', fetcher), /RAT_RADAR_RECIPIENT_INVALID/);
  assert.equal(calls, 0);
  await assert.rejects(loadLiveRecipientActivity(recipient, fetcher), /RAT_RADAR_RECIPIENT_ACTIVITY_UNAVAILABLE/);
  assert.equal(calls, 1);
});
