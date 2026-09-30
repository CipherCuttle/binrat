import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyCandidateManifest, verifyWorkerBindingParity, type WorkerVersionConfiguration } from '../src/cloudflare/deploymentBindingParity.js';

function version(): WorkerVersionConfiguration {
  return {
    resources: {
      bindings: [
        { name: 'DB', type: 'd1', id: 'db-id' },
        { name: 'SYNC_QUEUE', type: 'queue', queue_name: 'queue-name' },
        { name: 'AI', type: 'ai' },
        { name: 'TELEGRAM_BOT_TOKEN', type: 'secret_text' },
        { name: 'TELEGRAM_WEBHOOK_SECRET', type: 'secret_text' },
        { name: 'RAT_CONVERSATION_ENABLED', type: 'plain_text', text: 'true' },
        { name: 'BINRAT_RELEASE_SHA', type: 'plain_text', text: 'old' }
      ],
      script_runtime: {
        compatibility_date: '2026-09-18', compatibility_flags: ['nodejs_compat'],
        assets: { serve_directly: true, raw_run_worker_first: false, base_path: '/' }
      }
    }
  };
}

test('binding parity preserves active resources while allowing only the approved release additions', () => {
  const active = version();
  const candidate = version();
  candidate.resources!.bindings![6]!.text = 'new';
  candidate.resources!.bindings!.push(
    { name: 'BINRAT_PONS_MAX_BATCH_BLOCKS', type: 'plain_text', text: '512' },
    { name: 'BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS', type: 'plain_text', text: '4096' },
    { name: 'BINRAT_PONS_CATCHUP_MAX_BATCHES', type: 'plain_text', text: '4' },
    { name: 'BINRAT_PONS_CATCHUP_WORK_BUDGET_MS', type: 'plain_text', text: '60000' },
    { name: 'BINRAT_PONS_NEAR_HEAD_BLOCKS', type: 'plain_text', text: '2048' },
    { name: 'BINRAT_PONS_MAX_CANONICAL_LAUNCH_BLOCKS', type: 'plain_text', text: '128' },
    { name: 'ROBINHOOD_RPC_URL', type: 'plain_text', text: 'https://rpc.ordofi.network' },
    { name: 'BINRAT_AUTONOMOUS_RAT_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'BINRAT_TELEGRAM_MEDIA_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'BINRAT_TELEGRAM_UI_V2_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'RAT_CANDIDATE_SMOKE_ENABLED', type: 'plain_text', text: 'true' },
    { name: 'RAT_CANDIDATE_SMOKE_SECRET', type: 'secret_text' }
  );
  assert.deepEqual(verifyWorkerBindingParity(active, candidate), { ok: true, errors: [] });
});

test('binding parity refuses an altered temporary diagnostic gate', () => {
  const active = version();
  const candidate = version();
  candidate.resources!.bindings!.push(
    { name: 'RAT_CANDIDATE_SMOKE_ENABLED', type: 'plain_text', text: 'false' }
  );
  const result = verifyWorkerBindingParity(active, candidate);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('CANDIDATE_BINDING_UNAUTHORIZED:RAT_CANDIDATE_SMOKE_ENABLED'));
});

test('binding parity permits only disabling the temporary diagnostic gate', () => {
  const active = version();
  active.resources!.bindings!.push({ name: 'RAT_CANDIDATE_SMOKE_ENABLED', type: 'plain_text', text: 'true' });
  const candidate = version();
  candidate.resources!.bindings!.push({ name: 'RAT_CANDIDATE_SMOKE_ENABLED', type: 'plain_text', text: 'false' });
  assert.deepEqual(verifyWorkerBindingParity(active, candidate), { ok: true, errors: [] });
});

test('binding parity fails closed when Workers AI disappears or a target changes', () => {
  const active = version();
  const candidate = version();
  candidate.resources!.bindings = candidate.resources!.bindings!.filter((binding) => binding.name !== 'AI');
  candidate.resources!.bindings![0]!.id = 'other-db';
  const result = verifyWorkerBindingParity(active, candidate);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('CANDIDATE_REQUIRED_BINDING_MISSING:AI'));
  assert.ok(result.errors.includes('CANDIDATE_BINDING_MISSING:AI'));
  assert.ok(result.errors.includes('D1_TARGET_CHANGED:DB'));
});

test('candidate manifest requires known-good bindings and flag-off Pons configuration', () => {
  const pass = verifyCandidateManifest({ name: 'binrat-edge-v0', ai: { binding: 'AI' }, triggers: { crons: ['* * * * *'] }, assets: { directory: './web' }, vars: {
    BINRAT_AUTONOMOUS_RAT_ENABLED: 'false', BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED: 'false',
    BINRAT_TELEGRAM_MEDIA_ENABLED: 'false', BINRAT_TELEGRAM_UI_V2_ENABLED: 'false', BINRAT_PONS_MAX_BATCH_BLOCKS: '512',
    BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS: '4096', BINRAT_PONS_CATCHUP_MAX_BATCHES: '4',
    BINRAT_PONS_CATCHUP_WORK_BUDGET_MS: '60000', BINRAT_PONS_NEAR_HEAD_BLOCKS: '2048', BINRAT_PONS_MAX_CANONICAL_LAUNCH_BLOCKS: '128'
  } });
  assert.deepEqual(pass, { ok: true, errors: [] });
  const fail = verifyCandidateManifest({ name: 'binrat-edge-v0', triggers: { crons: [] }, assets: { directory: './web' } });
  assert.equal(fail.ok, false);
  assert.ok(fail.errors.includes('AI_BINDING_MISSING_FROM_MANIFEST'));
  assert.ok(fail.errors.includes('CRON_PARITY_FAILED'));
  assert.ok(fail.errors.includes('AUTONOMOUS_RAT_NOT_FLAG_OFF'));
});
