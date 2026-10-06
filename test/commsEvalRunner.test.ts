import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const runner = new URL('../scripts/run-comms-shadow-eval-once.mjs', import.meta.url);

function runConfig(apiKey?: string, existing = false) {
  const directory = mkdtempSync(join(tmpdir(), 'binrat-comms-config-'));
  const output = join(directory, 'report.json');
  const env: NodeJS.ProcessEnv = { ...process.env, BINRAT_COMMS_EVAL_OUTPUT: output };
  delete env.BINRAT_COMMS_OPENROUTER_API_KEY;
  delete env.BINRAT_EVAL_OPENROUTER_API_KEY;
  if (apiKey !== undefined) env.BINRAT_EVAL_OPENROUTER_API_KEY = apiKey;
  if (existing) writeFileSync(output, 'frozen receipt');
  try {
    const child = spawnSync(process.execPath, [
      '--import',
      'data:text/javascript,globalThis.fetch=async()=>{throw new Error("TEST_NETWORK_FORBIDDEN")}',
      runner.pathname,
    ], { env, encoding: 'utf8' });
    const content = readFileSync(output, 'utf8');
    return { child, content, mode: statSync(output).mode & 0o777 };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('missing provider config creates a private zero-attempt error receipt', () => {
  const { child, content, mode } = runConfig();
  assert.equal(child.status, 1);
  const report = JSON.parse(content);
  assert.equal(report.outcome, 'ERROR');
  assert.equal(report.stage, 'CONFIGURATION');
  assert.equal(report.error, 'OPENROUTER_KEY_MISSING');
  assert.equal(report.providerAttemptsStarted, 0);
  assert.equal(report.publicationAuthority, false);
  assert.equal(report.summary, null);
  assert.deepEqual(report.results, []);
  assert.equal(mode, 0o600);
});

test('invalid provider config produces a receipt without retaining credentials', () => {
  const key = 'private sentinel key';
  const { child, content } = runConfig(key);
  assert.equal(child.status, 1);
  const report = JSON.parse(content);
  assert.equal(report.error, 'OPENROUTER_API_KEY_INVALID');
  assert.equal(report.providerAttemptsStarted, 0);
  assert.ok(!content.includes(key));
  assert.ok(!child.stderr.includes(key));
});

test('existing frozen receipt is preserved before a valid key can start a call', () => {
  const { child, content } = runConfig('fixture-valid-key-do-not-send', true);
  assert.equal(child.status, 1);
  assert.match(child.stderr, /COMMS_EVAL_OUTPUT_EXISTS/);
  assert.equal(content, 'frozen receipt');
});
