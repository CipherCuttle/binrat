import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import worker from '../src/cloudflare/worker.js';
import { capacityRoute, capacityBudgetGuard, instrumentD1, makeD1CapacityMeter } from '../src/capacity/foundation.js';
import {
  runVirtualLoad, FakeRpc, FakeD1, FakeImmutableReceipts,
  FakeTelegram, FakeAtomicQuota, FakeSignedPayment, simulateFanout
} from '../src/capacity/synthetic.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const profile = JSON.parse(readFileSync(new URL('../bench/capacity-profile.v1.json', import.meta.url), 'utf8')) as {
  targetDAU: number; openSessions: number;
  steady: { rps: number; durationSeconds: number; requests: number };
  workload: Record<string, number>;
  spend: { stagingAuthorized: boolean; stagingMaxUsd: number };
};

test('G0 target contract is explicit, zero-spend and machine checked', () => {
  assert.equal(profile.targetDAU, 10_000);
  assert.equal(profile.openSessions, 1_000);
  assert.equal(profile.steady.requests, 180_000);
  assert.equal(Object.values(profile.workload).reduce((a, b) => a + b, 0), 100);
  assert.equal(profile.spend.stagingAuthorized, false);
  assert.equal(profile.spend.stagingMaxUsd, 0);
});
test('route telemetry replaces wallet/launch addresses with templates and guard stays OFF by default', async () => {
  const request = new Request('https://binrat.example/api/bag/private-id/replay?token=private');
  assert.deepEqual(capacityRoute(request), { route: '/api/bag/:id/replay', costClass: 'PREMIUM' });
  assert.equal(capacityBudgetGuard(request, {}), null);
  assert.equal(capacityBudgetGuard(request, { BINRAT_CAPACITY_GUARDS_ENABLED: 'true' }), null);
  const shed = capacityBudgetGuard(request, {
    BINRAT_CAPACITY_GUARDS_ENABLED: 'true', BINRAT_OPTIONAL_WORK_MODE: 'SHED_OPTIONAL'
  });
  assert.equal(shed?.status, 503);
  assert.equal(shed?.headers.get('retry-after'), '60');
  const raw = new Request('https://binrat.example/api/bag/private-id');
  assert.equal(capacityBudgetGuard(raw, {
    BINRAT_CAPACITY_GUARDS_ENABLED: 'true', BINRAT_OPTIONAL_WORK_MODE: 'SHED_OPTIONAL'
  }), null);
});
test('staged runtime guard does not alter unflagged public status or receipt route handling', async () => {
  const db = new D1CompatDatabase();
  try {
    const env = { DB: db, BINRAT_CAPACITY_GUARDS_ENABLED: 'true', BINRAT_OPTIONAL_WORK_MODE: 'SHED_OPTIONAL' };
    const health = await worker.fetch(new Request('https://binrat.example/health'), env);
    assert.equal(health.status, 200);
    const shed = await worker.fetch(new Request('https://binrat.example/api/bag/fixture/replay'), env);
    assert.equal(shed.status, 503);
    assert.equal((await shed.json() as { error: string }).error, 'OPTIONAL_CAPACITY_SHED');
    const unset = await worker.fetch(new Request('https://binrat.example/api/bag/fixture/replay'), { DB: db });
    // Original semantics: stale/uninitialized D1 is not ready. No new guard error.
    assert.notEqual((await unset.json() as { error?: string }).error, 'OPTIONAL_CAPACITY_SHED');
  } finally { db.close(); }
});
test('metered D1 batch unwrap preserves transaction and reports unknown scan counts honestly', async () => {
  const db = new D1CompatDatabase();
  try {
    await db.exec('CREATE TABLE quota_fixture (id INTEGER PRIMARY KEY, balance INTEGER NOT NULL)');
    const meter = makeD1CapacityMeter();
    const measured = instrumentD1(db, meter);
    const res = await measured.batch([
      measured.prepare('INSERT INTO quota_fixture(id,balance) VALUES (?,?)').bind(1, 2),
      measured.prepare('INSERT INTO quota_fixture(id,balance) VALUES (?,?)').bind(2, 3)
    ]);
    assert.ok(res.every((r) => r.success));
    assert.equal((await measured.prepare('SELECT balance FROM quota_fixture WHERE id = ?').bind(1).first<{balance: number}>())?.balance, 2);
    assert.equal((await measured.prepare('SELECT * FROM quota_fixture').all()).results?.length, 2);
    assert.equal(meter.operations, 4);
    assert.equal(meter.rowsWrittenReported, 2);
    assert.equal(meter.rowsReadUnknown, 2);
    assert.equal(meter.rowsReturned, 3);
  } finally { db.close(); }
});
test('deterministic 100 RPS workload includes all four classes and rejects cold single-lane baseline', () => {
  const cold = runVirtualLoad(100, 30, 1, 0);
  const warm = runVirtualLoad(100, 30, 16, 90);
  assert.equal(cold.requests, 3_000);
  assert.deepEqual(warm.distribution, {
    PUBLIC_CACHED: 2100, PUBLIC_MISS: 450, ACCOUNT: 300, PREMIUM: 150
  });
  assert.ok(cold.endToEndP95Ms >= 500); // intentional failing architecture baseline
  assert.ok(warm.endToEndP95Ms < cold.endToEndP95Ms);
  assert.equal(warm.kind, 'VIRTUAL_ONLY_NOT_WORKER_CAPACITY');
});
test('RPC 429 and timeout do not turn into empty healthy source data', async () => {
  await assert.rejects(new FakeRpc('429').getBlockHash(100), (e: Error & {status?: number}) => e.status === 429);
  await assert.rejects(new FakeRpc('TIMEOUT').getBlockHash(100), /RPC_TIMEOUT/);
  assert.equal((await new FakeRpc().getBlockHash(4663)).length, 66);
});
test('synthetic D1 failed write preserves prior receipt and synthetic reorg cannot overwrite immutable identity', () => {
  const db = new FakeD1(); db.write('5042:evidence', 'hash-original'); db.failWrites = true;
  assert.throws(() => db.write('5042:evidence', 'hash-tampered'), /D1_SYNTHETIC_WRITE_REJECTED/);
  assert.equal(db.get('5042:evidence'), 'hash-original');
  const receipts = new FakeImmutableReceipts();
  assert.equal(receipts.put(5042, '0x01', '0xabc', 0, 'hash-1'), 'INSERTED');
  assert.equal(receipts.put(5042, '0x01', '0xabc', 0, 'hash-1'), 'DUPLICATE');
  assert.throws(() => receipts.put(5042, '0x01', '0xabc', 0, 'hash-fork'), /REORG_IDENTITY_FENCE/);
  assert.equal(receipts.put(4663, '0x01', '0xabc', 0, 'hash-fork'), 'INSERTED');
});
test('10K fake alert recipients drain under 25/sec with replay dedup and synthetic retry', () => {
  const result = simulateFanout(10_000);
  assert.deepEqual(result, {
    unique: 10_000, retries: 1, drainSeconds: 400, peakPerSecond: 25, duplicateDeliveries: 0
  });
  const sender = new FakeTelegram();
  assert.equal(sender.send('4663:fixture:chat-1'), 'SENT');
  assert.equal(sender.send('4663:fixture:chat-1'), 'DUPLICATE');
  assert.equal(sender.count(), 1);
});
test('1K simultaneous fake quota reservations cannot exceed 100 prepaid units', async () => {
  const quota = new FakeAtomicQuota(100);
  const accepted = await Promise.all(Array.from({ length: 1_000 }, (_, i) => quota.reserve('attempt-' + i)));
  assert.equal(accepted.filter(Boolean).length, 100);
  assert.equal(quota.getRemaining(), 0);
  assert.equal(await quota.reserve('attempt-0'), true);
  assert.equal(quota.getRemaining(), 0);
});
test('spoofed fake payment callback, replay, out-of-order renewal and refund fail closed', () => {
  const payments = new FakeSignedPayment('ONLY_FAKE_CI_KEY');
  const paid = JSON.stringify({ id: 'evt-1', account: 'synthetic', revision: 1, action: 'PAID' });
  assert.throws(() => payments.receive(paid, 'f'.repeat(64)), /PAYMENT_SIGNATURE_INVALID/);
  assert.equal(payments.active('synthetic'), false);
  assert.equal(payments.receive(paid, payments.sign(paid)), 'APPLIED');
  assert.equal(payments.receive(paid, payments.sign(paid)), 'REPLAY');
  const refunded = JSON.stringify({ id: 'evt-2', account: 'synthetic', revision: 2, action: 'REFUND' });
  assert.equal(payments.receive(refunded, payments.sign(refunded)), 'APPLIED');
  assert.equal(payments.active('synthetic'), false);
  const stale = JSON.stringify({ id: 'evt-3', account: 'synthetic', revision: 1, action: 'PAID' });
  assert.equal(payments.receive(stale, payments.sign(stale)), 'STALE');
  assert.equal(payments.active('synthetic'), false);
});
