import assert from 'node:assert/strict';
import test from 'node:test';
import { BINRAT_BRAND, BINRAT_TICKER } from '../src/index.js';

test('brand identity is frozen', () => {
  assert.equal(BINRAT_BRAND, 'BINRAT');
  assert.equal(BINRAT_TICKER, '$BINRAT');
});
