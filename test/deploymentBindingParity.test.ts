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
    { name: 'ROBINHOOD_RPC_URL', type: 'plain_text', text: 'https://rpc.ordofi.network' },
    { name: 'BINRAT_AUTONOMOUS_RAT_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'BINRAT_TELEGRAM_MEDIA_ENABLED', type: 'plain_text', text: 'false' },
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

test('controlled Rat activation is an explicit parity mode requiring one secret tester and public/media off', () => {
  const active = version();
  active.resources!.bindings!.push(
    { name: 'BINRAT_AUTONOMOUS_RAT_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'BINRAT_TELEGRAM_MEDIA_ENABLED', type: 'plain_text', text: 'false' }
  );
  const candidate = structuredClone(active);
  candidate.resources!.bindings!.find((binding) => binding.name === 'BINRAT_AUTONOMOUS_RAT_ENABLED')!.text = 'true';
  candidate.resources!.bindings!.push(
    { name: 'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'RAT_CANDIDATE_ALLOWED_USER_ID', type: 'secret_text' }
  );

  const defaultResult = verifyWorkerBindingParity(active, candidate);
  assert.equal(defaultResult.ok, false);
  assert.ok(defaultResult.errors.includes('VARIABLE_CHANGED:BINRAT_AUTONOMOUS_RAT_ENABLED'));

  assert.deepEqual(
    verifyWorkerBindingParity(active, candidate, { controlledRatActivation: true }),
    { ok: true, errors: [] }
  );

  const missingTester = structuredClone(candidate);
  missingTester.resources!.bindings = missingTester.resources!.bindings!.filter(
    (binding) => binding.name !== 'RAT_CANDIDATE_ALLOWED_USER_ID'
  );
  const missing = verifyWorkerBindingParity(active, missingTester, { controlledRatActivation: true });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.includes('CONTROLLED_RAT_TESTER_BINDING_MISSING'));
});

test('controlled Rat manifest cannot accidentally enable public mode or media', () => {
  const base = { name: 'binrat-edge-v0', ai: { binding: 'AI' }, triggers: { crons: ['* * * * *'] },
    assets: { directory: './web' }, vars: { BINRAT_AUTONOMOUS_RAT_ENABLED: 'true',
      BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED: 'false', BINRAT_TELEGRAM_MEDIA_ENABLED: 'false',
      BINRAT_PONS_MAX_BATCH_BLOCKS: '512' } };
  assert.deepEqual(verifyCandidateManifest(base, { controlledRatActivation: true }), { ok: true, errors: [] });

  const publicCandidate = structuredClone(base);
  publicCandidate.vars.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED = 'true';
  const publicResult = verifyCandidateManifest(publicCandidate, { controlledRatActivation: true });
  assert.equal(publicResult.ok, false);
  assert.ok(publicResult.errors.includes('AUTONOMOUS_RAT_PUBLIC_MODE_NOT_DISABLED'));

  const mediaCandidate = structuredClone(base);
  mediaCandidate.vars.BINRAT_TELEGRAM_MEDIA_ENABLED = 'true';
  const mediaResult = verifyCandidateManifest(mediaCandidate, { controlledRatActivation: true });
  assert.equal(mediaResult.ok, false);
  assert.ok(mediaResult.errors.includes('TELEGRAM_MEDIA_NOT_FLAG_OFF'));
});

test('candidate manifest requires known-good bindings and flag-off Pons configuration', () => {
  const pass = verifyCandidateManifest({ name: 'binrat-edge-v0', ai: { binding: 'AI' }, triggers: { crons: ['* * * * *'] }, assets: { directory: './web' }, vars: { BINRAT_AUTONOMOUS_RAT_ENABLED: 'false', BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED: 'false', BINRAT_TELEGRAM_MEDIA_ENABLED: 'false', BINRAT_PONS_MAX_BATCH_BLOCKS: '512' } });
  assert.deepEqual(pass, { ok: true, errors: [] });
  const fail = verifyCandidateManifest({ name: 'binrat-edge-v0', triggers: { crons: [] }, assets: { directory: './web' } });
  assert.equal(fail.ok, false);
  assert.ok(fail.errors.includes('AI_BINDING_MISSING_FROM_MANIFEST'));
  assert.ok(fail.errors.includes('CRON_PARITY_FAILED'));
  assert.ok(fail.errors.includes('AUTONOMOUS_RAT_NOT_FLAG_OFF'));
});
