import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';

test('tracked live D1 schema stays byte-equivalent to runtime schema authority', () => {
  const liveSql = readFileSync(new URL('../cloudflare/schema.sql', import.meta.url), 'utf8');
  assert.equal(liveSql.trim(), D1_SCHEMA_SQL.trim());
});
