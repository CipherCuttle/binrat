import assert from 'node:assert/strict';
import test from 'node:test';
import { PerChatRateGate, UpdateDeliveryFence, webhookStatusForDuplicateBegin } from '../src/telegram/deliveryGuard.js';

test('delivery fence retries an update after failed delivery release', () => {
  const fence = new UpdateDeliveryFence();
  assert.equal(fence.begin(7), 'ACCEPTED');
  assert.equal(fence.begin(7), 'IN_FLIGHT');
  fence.release(7);
  assert.equal(fence.begin(7), 'ACCEPTED');
  fence.commit(7);
  assert.equal(fence.begin(7), 'SEEN');
});

test('delivery fence rejects invalid ids and bounds committed history', () => {
  const fence = new UpdateDeliveryFence(2);
  assert.equal(fence.begin(-1), 'INVALID');
  for (const id of [1, 2, 3]) {
    assert.equal(fence.begin(id), 'ACCEPTED');
    fence.commit(id);
  }
  assert.equal(fence.begin(1), 'ACCEPTED');
  fence.release(1);
  assert.equal(fence.begin(2), 'SEEN');
  assert.equal(fence.begin(3), 'SEEN');
});

test('per-chat rate gate is isolated by chat and resets on window boundary', () => {
  const gate = new PerChatRateGate(2, 1000);
  assert.equal(gate.allow(11, 100), true);
  assert.equal(gate.allow(11, 200), true);
  assert.equal(gate.allow(11, 300), false);
  assert.equal(gate.allow(12, 300), true);
  assert.equal(gate.allow(11, 1100), true);
});


test('in-flight webhook duplicates remain retryable until the original becomes durable', () => {
  assert.equal(webhookStatusForDuplicateBegin('IN_FLIGHT'), 503);
  assert.equal(webhookStatusForDuplicateBegin('SEEN'), 200);
});
