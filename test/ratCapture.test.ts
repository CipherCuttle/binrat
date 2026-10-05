import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256Hex } from '../src/evidence/canonical.js';
import { createCapturePlan, prepareCaptureDirectory, executeCapture, auditCapture, usdToMicrousd,
  type CaptureConfig } from '../src/workforce/capture.js';
import { scoreComparison } from '../src/workforce/competence.js';

// Every response is a synthetic transport fixture. No provider key, remote call or model output is used.
const KEY = 'synthetic-key-0000000000';
const config = (): CaptureConfig => ({ schemaVersion: 'binrat.capture-config/1', modelId: 'synthetic/fixed-v1',
  providerSlug: 'synthetic', responseProvider: 'Synthetic', maxCostMicrousd: 260000,
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  maxPrice: { promptMicrousdPerMillion: 500000, completionMicrousdPerMillion: 1000000 } });
const keyData = () => ({ data: { limit: 0.26, limit_remaining: 0.26, limit_reset: null,
  include_byok_in_limit: true, usage: 0, byok_usage: 0 } });
const completion = () => ({ id: 'synthetic-generation-id', model: 'synthetic/fixed-v1', provider: 'Synthetic',
  choices: [{ index: 0, finish_reason: 'stop', message: { content: '{"invalidAnswer":true}' } }],
  usage: { prompt_tokens: 1600, completion_tokens: 500, cost: 0.0000001, is_byok: false } });
async function sandbox(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'binrat-capture-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'run'), plan = await prepareCaptureDirectory(config(), dir);
  return { dir, plan };
}
function transport(options: { key?: unknown; result?: unknown; status?: number;
  body?: string; fail?: boolean; inspect?: (url: string, init: RequestInit) => void } = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  return { calls, send: async (url: string, init: RequestInit) => {
    calls.push({ url, init }); options.inspect?.(url, init);
    if (url.endsWith('/key')) return Response.json(options.key ?? keyData());
    if (options.fail) throw new Error(`ambiguous error echoes ${KEY}`);
    return new Response(options.body ?? JSON.stringify(options.result ?? completion()), { status: options.status ?? 200 });
  } };
}
test('capture planning makes zero calls, pins same cohort and all 26 counterbalanced requests', async () => {
  const original = globalThis.fetch; globalThis.fetch = async () => { throw new Error('NO_NETWORK'); };
  try {
    const p = await createCapturePlan(config()); assert.equal(p.requests.length, 26); assert.equal(p.reservationMicrousd, 260000);
    for (const r of p.requests) {
      assert.equal(r.body.model, p.config.modelId); assert.equal(r.body.temperature, 0); assert.equal(r.body.max_tokens, 1024);
      assert.equal(r.body.stream, false); assert.deepEqual(r.body.provider.only, ['synthetic']);
      assert.equal(r.body.provider.allow_fallbacks, false); assert.equal(r.body.provider.require_parameters, true);
      assert.deepEqual(r.body.provider.max_price, { prompt: 0.5, completion: 1, request: 0 });
      assert.ok(!r.body.messages[0].content.includes('"oracle"'));
    }
    assert.equal(p.requests[0].evidenceDigest, p.requests[1].evidenceDigest);
    assert.notEqual(p.requests[0].promptDigest, p.requests[1].promptDigest);
  } finally { globalThis.fetch = original; }
});
test('configuration rejects routing aliases, arbitrary endpoints, extra settings, low caps and excessive prices', async () => {
  for (const bad of [{ ...config(), modelId: 'openrouter/auto' }, { ...config(), modelId: 'openrouter/auto:free' },
    { ...config(), endpoint: 'https://evil.test' },
    { ...config(), temperature: 1 }, { ...config(), maxCostMicrousd: 10000 }, { ...config(), expiresAt: 'tomorrow' },
    { ...config(), maxPrice: { promptMicrousdPerMillion: 10000000, completionMicrousdPerMillion: 0 } }]) {
    await assert.rejects(createCapturePlan(bad));
  }
});
test('exact decimal monetary conversion rounds up including sub-microUSD and exponent notation', () => {
  assert.equal(usdToMicrousd(0), 0); assert.equal(usdToMicrousd(0.26), 260000);
  assert.equal(usdToMicrousd(0.00000001), 1); assert.equal(usdToMicrousd(0.000001000000001), 2);
  for (const v of [null, undefined, '0.01', -1, NaN, Infinity, 1e20]) assert.throws(() => usdToMicrousd(v));
});
test('wrong authorization and expired plans stop before any request or permanent run lock', async t => {
  const { dir, plan } = await sandbox(t), mock = transport();
  await assert.rejects(executeCapture(dir, 'wrong', KEY, mock.send), /EXACT_PLAN/); assert.equal(mock.calls.length, 0);
  const expired = config(); expired.expiresAt = '2020-01-01T00:00:00.000Z';
  const other = join(dir, '..', 'expired'), p = await prepareCaptureDirectory(expired, other);
  await assert.rejects(executeCapture(other, p.planDigest, KEY, mock.send), /EXPIRED/); assert.equal(mock.calls.length, 0);
  assert.ok(plan.planDigest);
});
test('fresh nonresetting dedicated capped key is mandatory; preflight never dispatches a model call on failure', async t => {
  const bad = [ { limit: null }, { limit: 1 }, { limit_reset: 'daily' }, { usage: 0.001 },
    { byok_usage: 0.001 }, { include_byok_in_limit: false }, { limit_remaining: null } ];
  for (const changes of bad) {
    const { dir, plan } = await sandbox(t), key = keyData(); Object.assign(key.data, changes);
    const mock = transport({ key }); await assert.rejects(executeCapture(dir, plan.planDigest, KEY, mock.send));
    assert.equal(mock.calls.length, 1); assert.ok(mock.calls[0].url.endsWith('/key'));
  }
});
test('successful synthetic capture dispatches once per assignment, durable reservation precedes each POST and audit rederives raw answers', async t => {
  const { dir, plan } = await sandbox(t); let index = 0;
  const mock = transport({ inspect: (url, init) => {
    assert.equal(init.redirect, 'error'); assert.ok(init.signal); assert.equal((init.headers as Record<string, string>).Authorization, `Bearer ${KEY}`);
    if (!url.endsWith('/key')) {
      const reserved = JSON.parse(readFileSync(join(dir, `${index}.reserved.json`), 'utf8'));
      assert.equal(reserved.assignmentId, plan.requests[index].assignmentId); assert.equal(reserved.reservedMicrousd, 10000);
      assert.deepEqual(JSON.parse(init.body as string), plan.requests[index++].body);
    }
  } });
  assert.deepEqual(await executeCapture(dir, plan.planDigest, KEY, mock.send), { attempted: 26, outcome: 'COMPLETE' });
  assert.equal(mock.calls.length, 52); const audit = await auditCapture(dir);
  assert.equal(audit.summary.complete, true); assert.equal(audit.summary.reservedMicrousd, 260000);
  assert.equal(audit.summary.capturedProviderReportedCostMicrousd, 26); assert.equal(audit.comparison.captures[0].rawOutput, '{"invalidAnswer":true}');
  const score = await scoreComparison({ ...audit.comparison, provenance: 'SYNTHETIC_TEST_OUTPUTS' });
  assert.equal(score.verdict, 'NO_MODEL_EVIDENCE'); assert.equal(score.metrics.SNIFFER.invalidOutputs, 13);
  await assert.rejects(executeCapture(dir, plan.planDigest, KEY, mock.send), /EEXIST/); assert.equal(mock.calls.length, 52);
});
test('competing executions of the same directory cannot double-dispatch or repeat preflight', async t => {
  const { dir, plan } = await sandbox(t), mock = transport({ fail: true });
  const results = await Promise.allSettled([executeCapture(dir, plan.planDigest, KEY, mock.send), executeCapture(dir, plan.planDigest, KEY, mock.send)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(mock.calls.filter(c => c.init.method === 'POST').length, 1);
});
test('HTTP errors, transport ambiguity and missing usage halt without retries and retain full reservation', async t => {
  for (const options of [{ status: 429, body: '{"error":"rate limit"}' }, { fail: true }, { result: {} }]) {
    const { dir, plan } = await sandbox(t), mock = transport(options);
    assert.deepEqual(await executeCapture(dir, plan.planDigest, KEY, mock.send), { attempted: 1, outcome: 'HALTED' });
    const audit = await auditCapture(dir); assert.equal(audit.summary.reservedMicrousd, 10000);
    assert.equal(audit.summary.ambiguousOrRejected, 1); assert.equal(audit.summary.captured, 0);
    assert.equal((await scoreComparison(audit.comparison)).verdict, 'INCOMPLETE_COMPARISON');
    assert.equal(mock.calls.length, 2);
    assert.ok(!readFileSync(join(dir, '0.receipt.json'), 'utf8').includes(KEY));
  }
});
test('model/provider drift, truncation, tool calls and usage/cost overruns fail closed with raw receipt retained', async t => {
  const bad: any[] = [ { model: 'synthetic/other' }, { provider: 'Other' }, { error: { code: 500 } },
    { usage: { prompt_tokens: 8193, completion_tokens: 1, cost: 0 } },
    { usage: { prompt_tokens: 1, completion_tokens: 1025, cost: 0 } },
    { usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0.010001 } },
    { usage: { prompt_tokens: 1, completion_tokens: 1, cost: 0, is_byok: true } },
    { choices: [{ index: 0, finish_reason: 'length', message: { content: '{}' } }] },
    { choices: [{ index: 0, finish_reason: 'stop', message: { content: '{}', tool_calls: [] } }] } ];
  for (const change of bad) {
    const { dir, plan } = await sandbox(t), mock = transport({ result: { ...completion(), ...change } });
    assert.equal((await executeCapture(dir, plan.planDigest, KEY, mock.send)).outcome, 'HALTED');
    const receipt = JSON.parse(readFileSync(join(dir, '0.receipt.json'), 'utf8'));
    assert.equal(receipt.outcome, 'RESPONSE_REJECTED'); assert.ok(receipt.response.body);
    assert.equal((await auditCapture(dir)).summary.complete, false);
  }
});
test('oversized bodies are bounded and credentials echoed by upstream are redacted before persistence', async t => {
  for (const body of ['x'.repeat(70000), JSON.stringify({ error: KEY })]) {
    const { dir, plan } = await sandbox(t), mock = transport({ body });
    await executeCapture(dir, plan.planDigest, KEY, mock.send);
    const text = readFileSync(join(dir, '0.receipt.json'), 'utf8'), receipt = JSON.parse(text);
    assert.ok(!text.includes(KEY)); assert.ok(Buffer.byteLength(receipt.response.body) <= 65536);
    assert.equal(receipt.response.truncated || receipt.response.redacted, true);
  }
});
test('provider key remaining credit and fresh status are rechecked before later reservations', async t => {
  const { dir, plan } = await sandbox(t); let count = 0;
  const mock = transport({ inspect: (url) => { if (url.endsWith('/key')) count++; } });
  const send = async (url: string, init: RequestInit) => {
    const response = await mock.send(url, init);
    if (url.endsWith('/key') && count === 2) return Response.json({ data: { ...keyData().data, usage: 0.251, limit_remaining: 0.009 } });
    return response;
  };
  assert.deepEqual(await executeCapture(dir, plan.planDigest, KEY, send), { attempted: 1, outcome: 'HALTED' });
  assert.equal((await auditCapture(dir)).summary.reservedMicrousd, 10000);
});
test('changed plan bindings, raw receipt tampering and re-sealed fabricated capture derivations are rejected offline', async t => {
  const { dir, plan } = await sandbox(t), mock = transport({ fail: true });
  await executeCapture(dir, plan.planDigest, KEY, mock.send);
  const path = join(dir, '0.receipt.json'), original = JSON.parse(readFileSync(path, 'utf8'));
  writeFileSync(path, JSON.stringify({ ...original, outcome: 'CAPTURED' })); await assert.rejects(auditCapture(dir), /BINDING/);
  const fake = { ...original, outcome: 'CAPTURED', response: { status: 200, body: JSON.stringify(completion()), truncated: false, redacted: false },
    capture: { rawOutput: 'counterfeit' } }; delete fake.receiptDigest;
  writeFileSync(path, JSON.stringify({ ...fake, receiptDigest: await sha256Hex(fake) })); await assert.rejects(auditCapture(dir), /DERIVATION/);
  const altered = structuredClone(plan); altered.requests[0].body.temperature = 1 as 0;
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(altered)); await assert.rejects(auditCapture(dir), /PROTOCOL_CHANGED/);
});
test('crash after dispatch reservation and before response persistence remains charged locally and never repeats', async t => {
  const { dir, plan } = await sandbox(t), mock = transport({ fail: true });
  await executeCapture(dir, plan.planDigest, KEY, mock.send); rmSync(join(dir, '0.receipt.json'));
  const audit = await auditCapture(dir); assert.equal(audit.summary.reservedMicrousd, 10000); assert.equal(audit.summary.ambiguousOrRejected, 1);
  await assert.rejects(executeCapture(dir, plan.planDigest, KEY, mock.send), /EEXIST/); assert.equal(mock.calls.length, 2);
});
test('expiry during key preflight prevents dispatch, and fractional remaining credit never rounds into a reservation', async t => {
  const { dir, plan } = await sandbox(t), originalNow = Date.now;
  const mock = transport({ inspect: () => { Date.now = () => Date.parse(plan.config.expiresAt); } });
  try { assert.deepEqual(await executeCapture(dir, plan.planDigest, KEY, mock.send), { attempted: 0, outcome: 'HALTED' }); }
  finally { Date.now = originalNow; }
  assert.equal(mock.calls.length, 1);
  const other = await sandbox(t), key = keyData(); key.data.limit_remaining = 0.009999999999;
  const small = transport({ key }); assert.equal((await executeCapture(other.dir, other.plan.planDigest, KEY, small.send)).attempted, 0);
});
test('duplicate provider keys, stream failures and timeout-like transport failures never retry', async t => {
  const { dir, plan } = await sandbox(t);
  const duplicate = transport({ body: '{"model":"first","model":"synthetic/fixed-v1"}' });
  assert.equal((await executeCapture(dir, plan.planDigest, KEY, duplicate.send)).outcome, 'HALTED');
  for (const failure of ['timeout', 'stream']) {
    const next = await sandbox(t); let attempts = 0;
    const send = async (url: string) => {
      if (url.endsWith('/key')) return Response.json(keyData()); attempts++;
      if (failure === 'timeout') throw new DOMException('Timeout', 'AbortError');
      return new Response(new ReadableStream({ start(controller) { controller.error(new Error('read failure')); } }));
    };
    assert.equal((await executeCapture(next.dir, next.plan.planDigest, KEY, send)).outcome, 'HALTED'); assert.equal(attempts, 1);
    assert.equal((await auditCapture(next.dir)).summary.reservedMicrousd, 10000);
  }
});
test('symlinked directories and plan files cannot redirect execution or audit', async t => {
  const { dir, plan } = await sandbox(t), alias = join(dir, '..', 'alias'), mock = transport();
  symlinkSync(dir, alias); await assert.rejects(executeCapture(alias, plan.planDigest, KEY, mock.send), /INVALID_RUN_DIRECTORY/);
  const original = readFileSync(join(dir, 'plan.json')); rmSync(join(dir, 'plan.json'));
  writeFileSync(join(dir, '..', 'copied.json'), original); symlinkSync(join(dir, '..', 'copied.json'), join(dir, 'plan.json'));
  await assert.rejects(executeCapture(dir, plan.planDigest, KEY, mock.send)); assert.equal(mock.calls.length, 0);
});
test('compiled CLI prepares offline and exits nonzero for a mocked halted run and incomplete audit', t => {
  const root = mkdtempSync(join(tmpdir(), 'binrat-capture-cli-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const preload = join(root, 'mock.mjs');
  writeFileSync(preload, `globalThis.fetch = async url => url.endsWith('/key') ? Response.json(${JSON.stringify(keyData())}) : new Response('{"error":"synthetic rate limit"}', {status:429});`);
  const file = join(root, 'config.json'), dir = join(root, 'run'); writeFileSync(file, JSON.stringify(config()));
  const cli = (...args: string[]) => spawnSync(process.execPath, ['--import', preload, 'scripts/capture-rat-competence.mjs', ...args],
    { encoding: 'utf8', env: { ...process.env, BINRAT_EVAL_OPENROUTER_API_KEY: KEY } });
  const prepared = cli('prepare', file, dir); assert.equal(prepared.status, 0, prepared.stderr);
  const metadata = JSON.parse(prepared.stdout); assert.equal(metadata.providerCalls, 0); assert.equal(metadata.executionAuthorized, false);
  const run = cli('run', dir, '--execute', metadata.planDigest); assert.equal(run.status, 1, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), { attempted: 1, outcome: 'HALTED' });
  const audit = cli('audit', dir); assert.equal(audit.status, 1, audit.stderr);
  assert.equal(JSON.parse(audit.stdout).score.verdict, 'INCOMPLETE_COMPARISON');
});
