import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRepliesEnabled } from '../src/telegram/control.js';

test('reply enable gate defaults closed', () => {
  assert.equal(parseRepliesEnabled(undefined), false);
  assert.equal(parseRepliesEnabled(''), false);
  assert.equal(parseRepliesEnabled(' false '), false);
});

test('reply enable gate requires literal true', () => {
  assert.equal(parseRepliesEnabled('true'), true);
  assert.equal(parseRepliesEnabled('TRUE'), true);
});

test('invalid reply enable values fail config validation', () => {
  assert.throws(() => parseRepliesEnabled('yes'), /INVALID_CONFIG:TELEGRAM_REPLIES_ENABLED/);
  assert.throws(() => parseRepliesEnabled('1'), /INVALID_CONFIG:TELEGRAM_REPLIES_ENABLED/);
});
