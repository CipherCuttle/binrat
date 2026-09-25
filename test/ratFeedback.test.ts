import assert from 'node:assert/strict';
import test from 'node:test';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import {
  parseRatFeedback, saveRatFeedback, deleteRatFeedback, pruneRatFeedback,
  validateRatFeedbackBody
} from '../src/cloudflare/ratFeedback.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const DAY = Date.UTC(2026, 8, 25, 8);
const body = 'The radar would be easier with a saved filter.';

test('only explicit /feedback commands capture submitted text', () => {
  assert.equal(parseRatFeedback('I have feedback: improve radar'), null);
  assert.equal(parseRatFeedback('rat /feedback add this'), null);
  assert.deepEqual(parseRatFeedback('/feedback'), { action: 'HELP' });
  assert.deepEqual(parseRatFeedback('/feedback privacy'), { action: 'HELP' });
  assert.deepEqual(parseRatFeedback('/feedback delete'), { action: 'DELETE' });
  assert.deepEqual(parseRatFeedback('/feedback@BinratBot IDEA: Better radar!'), {
    action: 'SUBMIT', kind: 'IDEA', body: 'Better radar!'
  });
  assert.deepEqual(parseRatFeedback('/feedback bug - The watch button is broken.'), {
    action: 'SUBMIT', kind: 'BUG', body: 'The watch button is broken.'
  });
  assert.equal(validateRatFeedbackBody('okay'), 'TOO_SHORT');
  assert.equal(validateRatFeedbackBody('X'.repeat(1201)), 'TOO_LONG');
  assert.equal(validateRatFeedbackBody('private key: 0x' + 'a'.repeat(64)), 'SENSITIVE');
  assert.equal(validateRatFeedbackBody(body), 'OK');
});

test('feedback D1 stores only explicitly submitted text with dedupe and deletion', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const first = await saveRatFeedback(db, 81, 100, 100, 'IDEA', body, DAY);
    assert.equal(first.state, 'SAVED');
    assert.equal((await saveRatFeedback(db, 81, 100, 100, 'IDEA', body, DAY)).state, 'ALREADY_SAVED');
    const rows = await db.prepare(
      'SELECT update_id,user_id,kind,body FROM rat_feedback WHERE user_id=?'
    ).bind(100).all<{ update_id: number; user_id: number; kind: string; body: string }>();
    assert.deepEqual(rows.results, [{ update_id: 81, user_id: 100, kind: 'IDEA', body }]);
    await assert.rejects(
      saveRatFeedback(db, 81, 200, 200, 'IDEA', body, DAY),
      /RAT_FEEDBACK_UPDATE_CONFLICT/
    );
    assert.equal(await deleteRatFeedback(db, 200), 0, 'other user cannot delete feedback');
    assert.equal(await deleteRatFeedback(db, 100), 1);
    assert.equal((await db.prepare('SELECT * FROM rat_feedback').all()).results?.length, 0);
    assert.equal((await db.prepare(
      "SELECT * FROM rat_feedback_budget WHERE principal='USER:100'"
    ).all()).results?.length, 0);
  } finally { db.close(); }
});

test('feedback admits at most three submissions per Telegram user daily', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    for (let index = 0; index < 3; index++) {
      assert.equal((await saveRatFeedback(db, index + 1, 10 + index, 45,
        'BUG', body, DAY)).state, 'SAVED');
    }
    assert.equal((await saveRatFeedback(db, 4, 90, 45, 'BUG', body, DAY)).state, 'USER_LIMIT');
    assert.equal((await saveRatFeedback(db, 5, 90, 45, 'BUG', body, DAY + 86_400_000)).state,
      'SAVED');
    const global = await db.prepare(
      "SELECT attempts FROM rat_feedback_budget WHERE day_utc=? AND principal='GLOBAL'"
    ).bind(Math.floor(DAY / 86_400_000)).first<{ attempts: number }>();
    assert.equal(global?.attempts, 3, 'rejected user must not spend global budget');
  } finally { db.close(); }
});

test('feedback globally caps 100 submissions per day, even when submitted concurrently', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    const receipt = await Promise.all(Array.from({ length: 120 }, (_, i) =>
      saveRatFeedback(db, i + 1, 1000 + i, 2000 + i, 'GENERAL', body, DAY)));
    assert.equal(receipt.filter(x => x.state === 'SAVED').length, 100);
    assert.equal(receipt.filter(x => x.state === 'GLOBAL_LIMIT').length, 20);
    const count = await db.prepare('SELECT COUNT(*) AS n FROM rat_feedback').first<{ n: number }>();
    assert.equal(count?.n, 100);
  } finally { db.close(); }
});

test('feedback expires after 90 days but keeps newer submissions and trims old quotas', async () => {
  const db = new D1CompatDatabase(); await db.exec(D1_SCHEMA_SQL);
  try {
    assert.equal((await saveRatFeedback(db, 11, 20, 30, 'BUG', body, DAY)).state, 'SAVED');
    assert.equal((await saveRatFeedback(db, 12, 20, 30, 'BUG', body,
      DAY + 85 * 86_400_000)).state, 'SAVED');
    await pruneRatFeedback(db, DAY + 91 * 86_400_000);
    const rows = await db.prepare(
      'SELECT update_id FROM rat_feedback ORDER BY update_id'
    ).all<{ update_id: number }>();
    assert.deepEqual(rows.results, [{ update_id: 12 }]);
  } finally { db.close(); }
});
