export interface WorkerBinding {
  name: string;
  type: string;
  text?: string;
  id?: string;
  database_id?: string;
  queue_name?: string;
}

export interface WorkerVersionConfiguration {
  resources?: {
    bindings?: WorkerBinding[];
    script_runtime?: {
      assets?: { serve_directly?: boolean; raw_run_worker_first?: boolean; base_path?: string };
      compatibility_date?: string;
      compatibility_flags?: string[];
    };
  };
}

export interface BindingParityResult { ok: boolean; errors: string[] }

const REQUIRED_BINDINGS = ['DB', 'SYNC_QUEUE', 'AI', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'] as const;
const ALLOWED_ADDITIONS = new Map<string, Pick<WorkerBinding, 'type' | 'text'>>([
  ['BINRAT_PONS_MAX_BATCH_BLOCKS', { type: 'plain_text', text: '512' }],
  ['BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS', { type: 'plain_text', text: '4096' }],
  ['BINRAT_PONS_CATCHUP_MAX_BATCHES', { type: 'plain_text', text: '4' }],
  ['BINRAT_PONS_CATCHUP_WORK_BUDGET_MS', { type: 'plain_text', text: '60000' }],
  ['BINRAT_PONS_NEAR_HEAD_BLOCKS', { type: 'plain_text', text: '2048' }],
  ['BINRAT_PONS_MAX_CANONICAL_LAUNCH_BLOCKS', { type: 'plain_text', text: '128' }],
  ['ROBINHOOD_RPC_URL', { type: 'plain_text', text: 'https://rpc.ordofi.network' }],
  ['BINRAT_AUTONOMOUS_RAT_ENABLED', { type: 'plain_text', text: 'false' }],
  ['BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED', { type: 'plain_text', text: 'false' }],
  ['BINRAT_TELEGRAM_MEDIA_ENABLED', { type: 'plain_text', text: 'false' }],
  ['BINRAT_TELEGRAM_UI_V2_ENABLED', { type: 'plain_text', text: 'false' }],
  // Temporary read-only candidate diagnostic gate. It may never be promoted as
  // an arbitrary variable or a plain-text credential.
  ['RAT_CANDIDATE_SMOKE_ENABLED', { type: 'plain_text', text: 'true' }],
  ['RAT_CANDIDATE_SMOKE_SECRET', { type: 'secret_text' }]
]);
const ALLOWED_VALUE_CHANGES = new Set(['BINRAT_RELEASE_SHA']);

/**
 * Fail closed before promotion if a candidate loses any active production
 * binding, changes an existing target, or adds an unapproved release binding.
 * Secrets are compared by binding name/type only, never by value.
 */
export function verifyWorkerBindingParity(
  active: WorkerVersionConfiguration,
  candidate: WorkerVersionConfiguration
): BindingParityResult {
  const errors: string[] = [];
  const activeBindings = bindingMap(active, 'active', errors);
  const candidateBindings = bindingMap(candidate, 'candidate', errors);
  for (const name of REQUIRED_BINDINGS) {
    if (!activeBindings.has(name)) errors.push(`ACTIVE_REQUIRED_BINDING_MISSING:${name}`);
    if (!candidateBindings.has(name)) errors.push(`CANDIDATE_REQUIRED_BINDING_MISSING:${name}`);
  }

  for (const [name, before] of activeBindings) {
    const after = candidateBindings.get(name);
    if (!after) { errors.push(`CANDIDATE_BINDING_MISSING:${name}`); continue; }
    compareBinding(before, after, errors);
  }
  for (const [name, binding] of candidateBindings) {
    if (!activeBindings.has(name)) {
      const allowed = ALLOWED_ADDITIONS.get(name);
      if (!allowed || allowed.type !== binding.type ||
          (allowed.text !== undefined && allowed.text !== binding.text)) {
        errors.push(`CANDIDATE_BINDING_UNAUTHORIZED:${name}`);
      }
    }
  }

  const beforeRuntime = active.resources?.script_runtime;
  const afterRuntime = candidate.resources?.script_runtime;
  if (!beforeRuntime || !afterRuntime) errors.push('SCRIPT_RUNTIME_MISSING');
  else {
    if (beforeRuntime.compatibility_date !== afterRuntime.compatibility_date) errors.push('COMPATIBILITY_DATE_CHANGED');
    if (!sameStrings(beforeRuntime.compatibility_flags, afterRuntime.compatibility_flags)) errors.push('COMPATIBILITY_FLAGS_CHANGED');
    if (!sameJson(beforeRuntime.assets, afterRuntime.assets)) errors.push('STATIC_ASSETS_CHANGED');
  }
  return { ok: errors.length === 0, errors };
}

export function verifyCandidateManifest(config: unknown): BindingParityResult {
  const value = config as {
    name?: unknown; ai?: { binding?: unknown }; triggers?: { crons?: unknown }; assets?: { directory?: unknown };
    vars?: Record<string, unknown>;
  };
  const errors: string[] = [];
  if (value.name !== 'binrat-edge-v0') errors.push('WORKER_NAME_MISMATCH');
  if (value.ai?.binding !== 'AI') errors.push('AI_BINDING_MISSING_FROM_MANIFEST');
  if (!Array.isArray(value.triggers?.crons) || value.triggers!.crons.length !== 1 || value.triggers!.crons[0] !== '* * * * *') {
    errors.push('CRON_PARITY_FAILED');
  }
  if (value.assets?.directory !== './web') errors.push('STATIC_ASSET_MANIFEST_FAILED');
  if (value.vars?.BINRAT_AUTONOMOUS_RAT_ENABLED !== 'false') errors.push('AUTONOMOUS_RAT_NOT_FLAG_OFF');
  if (value.vars?.BINRAT_TELEGRAM_MEDIA_ENABLED !== 'false') errors.push('TELEGRAM_MEDIA_NOT_FLAG_OFF');
  if (value.vars?.BINRAT_PONS_MAX_BATCH_BLOCKS !== '512') errors.push('PONS_BATCH_BOUND_INVALID');
  if (value.vars?.BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS !== '4096') errors.push('PONS_CATCHUP_BATCH_BOUND_INVALID');
  if (value.vars?.BINRAT_PONS_CATCHUP_MAX_BATCHES !== '4') errors.push('PONS_CATCHUP_BATCH_COUNT_INVALID');
  if (value.vars?.BINRAT_PONS_CATCHUP_WORK_BUDGET_MS !== '60000') errors.push('PONS_CATCHUP_WORK_BUDGET_INVALID');
  if (value.vars?.BINRAT_PONS_NEAR_HEAD_BLOCKS !== '2048') errors.push('PONS_NEAR_HEAD_BOUND_INVALID');
  if (value.vars?.BINRAT_PONS_MAX_CANONICAL_LAUNCH_BLOCKS !== '128') errors.push('PONS_CANONICAL_DENSITY_BOUND_INVALID');
  if (value.vars?.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED !== 'false') errors.push('PUBLIC_RAT_NOT_FLAG_OFF');
  if (value.vars?.BINRAT_TELEGRAM_UI_V2_ENABLED !== 'false') errors.push('TELEGRAM_UI_V2_NOT_FLAG_OFF');
  return { ok: errors.length === 0, errors };
}

function bindingMap(value: WorkerVersionConfiguration, label: string, errors: string[]): Map<string, WorkerBinding> {
  const result = new Map<string, WorkerBinding>();
  for (const binding of value.resources?.bindings ?? []) {
    if (!binding.name || !binding.type || result.has(binding.name)) {
      errors.push(`${label.toUpperCase()}_BINDING_INVALID`);
      continue;
    }
    result.set(binding.name, binding);
  }
  return result;
}

function compareBinding(before: WorkerBinding, after: WorkerBinding, errors: string[]): void {
  if (before.type !== after.type) { errors.push(`BINDING_TYPE_CHANGED:${before.name}`); return; }
  if (before.type === 'd1' && (before.id ?? before.database_id) !== (after.id ?? after.database_id)) {
    errors.push(`D1_TARGET_CHANGED:${before.name}`);
  }
  if (before.type === 'queue' && before.queue_name !== after.queue_name) errors.push(`QUEUE_TARGET_CHANGED:${before.name}`);
  const disablesCandidateDiagnostic = before.name === 'RAT_CANDIDATE_SMOKE_ENABLED' &&
    before.text === 'true' && after.text === 'false';
  if (before.type === 'plain_text' && !ALLOWED_VALUE_CHANGES.has(before.name) && !disablesCandidateDiagnostic && before.text !== after.text) {
    errors.push(`VARIABLE_CHANGED:${before.name}`);
  }
}

function sameStrings(left: string[] | undefined, right: string[] | undefined): boolean {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}
function sameJson(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right); }
