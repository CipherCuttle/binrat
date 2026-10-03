import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyCandidateManifest, verifyPrivateTesterGate, verifyWorkerBindingParity, type WorkerVersionConfiguration } from '../src/cloudflare/deploymentBindingParity.js';

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

const provenPonsVars: Record<string, string> = {
  BINRAT_PONS_MAX_BATCH_BLOCKS: '1024',
  BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS: '4096',
  BINRAT_PONS_CATCHUP_MAX_BATCHES: '4',
  BINRAT_PONS_CATCHUP_WORK_BUDGET_MS: '60000',
  BINRAT_PONS_NEAR_HEAD_BLOCKS: '2048',
  BINRAT_PONS_MAX_CANONICAL_LAUNCH_BLOCKS: '128'
} as const;

test('binding parity preserves active resources while allowing only the approved release additions', () => {
  const active = version();
  const candidate = version();
  candidate.resources!.bindings![6]!.text = 'new';
  candidate.resources!.bindings!.push(
    { name: 'BINRAT_PONS_MAX_BATCH_BLOCKS', type: 'plain_text', text: '1024' },
    { name: 'BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS', type: 'plain_text', text: '4096' },
    { name: 'BINRAT_PONS_CATCHUP_MAX_BATCHES', type: 'plain_text', text: '4' },
    { name: 'BINRAT_PONS_CATCHUP_WORK_BUDGET_MS', type: 'plain_text', text: '60000' },
    { name: 'BINRAT_PONS_NEAR_HEAD_BLOCKS', type: 'plain_text', text: '2048' },
    { name: 'BINRAT_PONS_MAX_CANONICAL_LAUNCH_BLOCKS', type: 'plain_text', text: '128' },
    { name: 'ROBINHOOD_RPC_URL', type: 'plain_text', text: 'https://rpc.ordofi.network' },
    { name: 'BINRAT_AUTONOMOUS_RAT_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'BINRAT_TELEGRAM_UI_V2_ENABLED', type: 'plain_text', text: 'false' },
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

test('private preview parity permits only explicit safe deactivation and exact release change', () => {
  const active = version();
  active.resources!.bindings!.push(
    { name: 'BINRAT_AUTONOMOUS_RAT_ENABLED', type: 'plain_text', text: 'true' },
    { name: 'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED', type: 'plain_text', text: 'true' },
    { name: 'BINRAT_TELEGRAM_UI_V2_ENABLED', type: 'plain_text', text: 'true' },
    { name: 'BINRAT_TELEGRAM_MEDIA_ENABLED', type: 'plain_text', text: 'true' },
    { name: 'BINRAT_PONS_FUNDING_ENABLED', type: 'plain_text', text: 'true' }
  );
  const candidate = structuredClone(active);
  for (const name of ['BINRAT_AUTONOMOUS_RAT_ENABLED','BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED',
    'BINRAT_TELEGRAM_UI_V2_ENABLED','BINRAT_TELEGRAM_MEDIA_ENABLED','BINRAT_PONS_FUNDING_ENABLED']) {
    candidate.resources!.bindings!.find(binding => binding.name === name)!.text = 'false';
  }
  candidate.resources!.bindings!.find(binding => binding.name === 'BINRAT_RELEASE_SHA')!.text = 'reviewed';
  assert.deepEqual(verifyWorkerBindingParity(active, candidate, { privatePreview: true }), { ok: true, errors: [] });

  const changedDb = structuredClone(candidate);
  changedDb.resources!.bindings!.find(binding => binding.name === 'DB')!.id = 'other-db';
  assert.ok(verifyWorkerBindingParity(active, changedDb, { privatePreview: true }).errors.includes('D1_TARGET_CHANGED:DB'));

  const changedQueue = structuredClone(candidate);
  changedQueue.resources!.bindings!.find(binding => binding.name === 'SYNC_QUEUE')!.queue_name = 'other-queue';
  assert.ok(verifyWorkerBindingParity(active, changedQueue, { privatePreview: true }).errors.includes('QUEUE_TARGET_CHANGED:SYNC_QUEUE'));

  const changedPlainText = structuredClone(candidate);
  changedPlainText.resources!.bindings!.find(binding => binding.name === 'RAT_CONVERSATION_ENABLED')!.text = 'false';
  assert.ok(verifyWorkerBindingParity(active, changedPlainText, { privatePreview: true }).errors.includes('VARIABLE_CHANGED:RAT_CONVERSATION_ENABLED'));

  const unexpected = structuredClone(candidate);
  unexpected.resources!.bindings!.push({ name: 'UNEXPECTED_PREVIEW_BINDING', type: 'plain_text', text: 'false' });
  assert.ok(verifyWorkerBindingParity(active, unexpected, { privatePreview: true }).errors.includes('CANDIDATE_BINDING_UNAUTHORIZED:UNEXPECTED_PREVIEW_BINDING'));
});

test('controlled text Rat activation remains explicit and requires one secret tester with UI/media off', () => {
  const active = version();
  active.resources!.bindings!.push(
    { name: 'BINRAT_AUTONOMOUS_RAT_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'BINRAT_TELEGRAM_UI_V2_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'BINRAT_TELEGRAM_MEDIA_ENABLED', type: 'plain_text', text: 'false' }
  );
  const candidate = structuredClone(active);
  candidate.resources!.bindings!.find((binding) => binding.name === 'BINRAT_AUTONOMOUS_RAT_ENABLED')!.text = 'true';
  candidate.resources!.bindings!.push(
    { name: 'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED', type: 'plain_text', text: 'false' },
    { name: 'BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID', type: 'secret_text' }
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
    (binding) => binding.name !== 'BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID'
  );
  const missing = verifyWorkerBindingParity(active, missingTester, { controlledRatActivation: true });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.includes('CONTROLLED_RAT_TESTER_BINDING_MISSING'));
});

test('controlled text Rat manifest cannot accidentally enable public mode, UI V2 or media', () => {
  const base = { name: 'binrat-edge-v0', ai: { binding: 'AI' }, triggers: { crons: ['* * * * *'] },
    assets: { directory: './web' }, vars: { BINRAT_AUTONOMOUS_RAT_ENABLED: 'true',
      BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED: 'false', BINRAT_TELEGRAM_UI_V2_ENABLED: 'false', BINRAT_TELEGRAM_MEDIA_ENABLED: 'false',
      ...provenPonsVars } };
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

  const uiCandidate = structuredClone(base);
  uiCandidate.vars.BINRAT_TELEGRAM_UI_V2_ENABLED = 'true';
  const uiResult = verifyCandidateManifest(uiCandidate, { controlledRatActivation: true });
  assert.equal(uiResult.ok, false);
  assert.ok(uiResult.errors.includes('TELEGRAM_UI_V2_NOT_FLAG_OFF'));
});

test('controlled activation permits only the exact Pons steady-capacity migration 512 to 1024', () => {
  const active=version();
  active.resources!.bindings!.push(
    { name:'BINRAT_PONS_MAX_BATCH_BLOCKS',type:'plain_text',text:'512' },
    { name:'BINRAT_AUTONOMOUS_RAT_ENABLED',type:'plain_text',text:'true' },
    { name:'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED',type:'plain_text',text:'false' },
    { name:'BINRAT_TELEGRAM_UI_V2_ENABLED',type:'plain_text',text:'true' },
    { name:'BINRAT_TELEGRAM_MEDIA_ENABLED',type:'plain_text',text:'true' },
    { name:'BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID',type:'secret_text' },
    { name:'RAT_CANDIDATE_ALLOWED_USER_ID',type:'secret_text' }
  );
  const candidate=structuredClone(active);
  candidate.resources!.bindings!.find(binding=>binding.name==='BINRAT_PONS_MAX_BATCH_BLOCKS')!.text='1024';

  assert.deepEqual(
    verifyWorkerBindingParity(active,candidate,{controlledTelegramUiV2Activation:true}),
    {ok:true,errors:[]}
  );
  assert.ok(verifyWorkerBindingParity(active,candidate).errors.includes('VARIABLE_CHANGED:BINRAT_PONS_MAX_BATCH_BLOCKS'));

  const oversized=structuredClone(candidate);
  oversized.resources!.bindings!.find(binding=>binding.name==='BINRAT_PONS_MAX_BATCH_BLOCKS')!.text='2048';
  assert.ok(
    verifyWorkerBindingParity(active,oversized,{controlledTelegramUiV2Activation:true})
      .errors.includes('VARIABLE_CHANGED:BINRAT_PONS_MAX_BATCH_BLOCKS')
  );
});

test('controlled UI V2 parity permits first activation and exact private-to-private upgrades', () => {
  const active = version();
  active.resources!.bindings!.push(
    { name:'BINRAT_AUTONOMOUS_RAT_ENABLED',type:'plain_text',text:'false' },
    { name:'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED',type:'plain_text',text:'false' },
    { name:'BINRAT_TELEGRAM_UI_V2_ENABLED',type:'plain_text',text:'false' },
    { name:'BINRAT_TELEGRAM_MEDIA_ENABLED',type:'plain_text',text:'false' }
  );
  const candidate = structuredClone(active);
  for (const name of ['BINRAT_AUTONOMOUS_RAT_ENABLED','BINRAT_TELEGRAM_UI_V2_ENABLED','BINRAT_TELEGRAM_MEDIA_ENABLED']) {
    candidate.resources!.bindings!.find(binding=>binding.name===name)!.text='true';
  }
  candidate.resources!.bindings!.push(
    { name:'BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID',type:'secret_text' },
    { name:'RAT_CANDIDATE_ALLOWED_USER_ID',type:'secret_text' },
    { name:'TELEGRAM_WEBHOOK_SECRET_NEXT',type:'secret_text' }
  );
  assert.deepEqual(verifyWorkerBindingParity(active,candidate,{controlledTelegramUiV2Activation:true}),{ok:true,errors:[]});
  const defaultMode = verifyWorkerBindingParity(active,candidate);
  assert.equal(defaultMode.ok,false);
  assert.ok(defaultMode.errors.includes('VARIABLE_CHANGED:BINRAT_TELEGRAM_UI_V2_ENABLED'));
  assert.ok(defaultMode.errors.includes('CANDIDATE_BINDING_UNAUTHORIZED:TELEGRAM_WEBHOOK_SECRET_NEXT'));

  const alreadyEnabled = structuredClone(candidate);
  assert.deepEqual(verifyWorkerBindingParity(candidate,alreadyEnabled,{controlledTelegramUiV2Activation:true}),{ok:true,errors:[]});

  const partialSource = structuredClone(candidate);
  partialSource.resources!.bindings!.find(binding=>binding.name==='BINRAT_TELEGRAM_MEDIA_ENABLED')!.text='false';
  assert.ok(verifyWorkerBindingParity(partialSource,alreadyEnabled,{controlledTelegramUiV2Activation:true}).errors.includes('CONTROLLED_UI_V2_SOURCE_STATE_INVALID'));

  const publicCandidate = structuredClone(candidate);
  publicCandidate.resources!.bindings!.find(binding=>binding.name==='BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED')!.text='true';
  const publicResult=verifyWorkerBindingParity(active,publicCandidate,{controlledTelegramUiV2Activation:true});
  assert.equal(publicResult.ok,false);
  assert.ok(publicResult.errors.includes('VARIABLE_CHANGED:BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED'));
  assert.ok(publicResult.errors.includes('CONTROLLED_RAT_PUBLIC_MODE_NOT_DISABLED'));

  const unexpected = structuredClone(candidate);
  unexpected.resources!.bindings!.push({name:'UNRELATED_ACTIVATION_BINDING',type:'plain_text',text:'true'});
  assert.ok(verifyWorkerBindingParity(active,unexpected,{controlledTelegramUiV2Activation:true}).errors.includes('CANDIDATE_BINDING_UNAUTHORIZED:UNRELATED_ACTIVATION_BINDING'));
});

test('controlled UI V2 manifest requires private UI/media on while default mode rejects either flag', () => {
  const manifest={name:'binrat-edge-v0',ai:{binding:'AI'},triggers:{crons:['* * * * *']},assets:{directory:'./web'},vars:{
    BINRAT_AUTONOMOUS_RAT_ENABLED:'true',BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED:'false',
    BINRAT_TELEGRAM_UI_V2_ENABLED:'true',BINRAT_TELEGRAM_MEDIA_ENABLED:'true',...provenPonsVars
  }};
  assert.deepEqual(verifyCandidateManifest(manifest,{controlledTelegramUiV2Activation:true}),{ok:true,errors:[]});
  assert.ok(verifyCandidateManifest(manifest).errors.includes('AUTONOMOUS_RAT_NOT_FLAG_OFF'));
  const publicManifest=structuredClone(manifest); publicManifest.vars.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED='true';
  assert.ok(verifyCandidateManifest(publicManifest,{controlledTelegramUiV2Activation:true}).errors.includes('AUTONOMOUS_RAT_PUBLIC_MODE_NOT_DISABLED'));
  const oldCatchupManifest=structuredClone(manifest) as typeof manifest & { vars: Record<string,string> }; oldCatchupManifest.vars.BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS='512';
  assert.ok(verifyCandidateManifest(oldCatchupManifest,{controlledTelegramUiV2Activation:true}).errors.includes('PONS_CATCHUP_BATCH_BOUND_INVALID'));
  const oldSteadyManifest=structuredClone(manifest) as typeof manifest & { vars: Record<string,string> }; oldSteadyManifest.vars.BINRAT_PONS_MAX_BATCH_BLOCKS='512';
  assert.ok(verifyCandidateManifest(oldSteadyManifest,{controlledTelegramUiV2Activation:true}).errors.includes('PONS_BATCH_BOUND_INVALID'));
});

test('visible candidate whole-bot gate must match the exact selected tester', () => {
  assert.deepEqual(verifyPrivateTesterGate('7777',{name:'RAT_CANDIDATE_ALLOWED_USER_ID',type:'plain_text',text:'7777'}),{ok:true,errors:[]});
  const mismatch=verifyPrivateTesterGate('7777',{name:'RAT_CANDIDATE_ALLOWED_USER_ID',type:'plain_text',text:'8888'});
  assert.equal(mismatch.ok,false); assert.ok(mismatch.errors.includes('CANDIDATE_GATE_TESTER_MISMATCH'));
  assert.ok(verifyPrivateTesterGate('7777',undefined).errors.includes('CONTROLLED_UI_V2_CANDIDATE_GATE_MISSING'));
});

test('candidate manifest requires known-good bindings and flag-off Pons configuration', () => {
  const pass = verifyCandidateManifest({ name: 'binrat-edge-v0', ai: { binding: 'AI' }, triggers: { crons: ['* * * * *'] }, assets: { directory: './web' }, vars: { BINRAT_AUTONOMOUS_RAT_ENABLED: 'false', BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED: 'false', BINRAT_TELEGRAM_UI_V2_ENABLED: 'false', BINRAT_TELEGRAM_MEDIA_ENABLED: 'false', ...provenPonsVars } });
  assert.deepEqual(pass, { ok: true, errors: [] });
  const privatePreview = { name: 'binrat-edge-v0', ai: { binding: 'AI' }, triggers: { crons: ['* * * * *'] }, assets: { directory: '../web' }, vars: { BINRAT_AUTONOMOUS_RAT_ENABLED: 'false', BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED: 'false', BINRAT_TELEGRAM_UI_V2_ENABLED: 'false', BINRAT_TELEGRAM_MEDIA_ENABLED: 'false', ...provenPonsVars } };
  assert.deepEqual(verifyCandidateManifest(privatePreview, { privatePreview: true }), { ok: true, errors: [] });
  const fail = verifyCandidateManifest({ name: 'binrat-edge-v0', triggers: { crons: [] }, assets: { directory: './web' } });
  assert.equal(fail.ok, false);
  assert.ok(fail.errors.includes('AI_BINDING_MISSING_FROM_MANIFEST'));
  assert.ok(fail.errors.includes('CRON_PARITY_FAILED'));
  assert.ok(fail.errors.includes('AUTONOMOUS_RAT_NOT_FLAG_OFF'));
});
