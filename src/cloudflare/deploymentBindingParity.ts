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
export interface BindingParityOptions {
  /** Existing text-only controlled private activation. */
  controlledRatActivation?: boolean;
  /** Explicit private Telegram UI V2 activation; never a general toggle. */
  controlledTelegramUiV2Activation?: boolean;
}

const REQUIRED_BINDINGS = ['DB', 'SYNC_QUEUE', 'AI', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'] as const;
const ALLOWED_ADDITIONS = new Map<string, Pick<WorkerBinding, 'type' | 'text'>>([
  ['BINRAT_PONS_MAX_BATCH_BLOCKS', { type: 'plain_text', text: '1024' }],
  ['BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS', { type: 'plain_text', text: '4096' }],
  ['BINRAT_PONS_CATCHUP_MAX_BATCHES', { type: 'plain_text', text: '4' }],
  ['BINRAT_PONS_CATCHUP_WORK_BUDGET_MS', { type: 'plain_text', text: '60000' }],
  ['BINRAT_PONS_NEAR_HEAD_BLOCKS', { type: 'plain_text', text: '2048' }],
  ['BINRAT_PONS_MAX_CANONICAL_LAUNCH_BLOCKS', { type: 'plain_text', text: '128' }],
  ['ROBINHOOD_RPC_URL', { type: 'plain_text', text: 'https://rpc.ordofi.network' }],
  ['BINRAT_AUTONOMOUS_RAT_ENABLED', { type: 'plain_text', text: 'false' }],
  ['BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED', { type: 'plain_text', text: 'false' }],
  ['BINRAT_TELEGRAM_UI_V2_ENABLED', { type: 'plain_text', text: 'false' }],
  ['BINRAT_TELEGRAM_MEDIA_ENABLED', { type: 'plain_text', text: 'false' }],
  ['BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID', { type: 'secret_text' }],
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
  candidate: WorkerVersionConfiguration,
  options: BindingParityOptions = {}
): BindingParityResult {
  const errors: string[] = [];
  const mode = controlledMode(options, errors);
  const activeBindings = bindingMap(active, 'active', errors);
  const candidateBindings = bindingMap(candidate, 'candidate', errors);
  for (const name of REQUIRED_BINDINGS) {
    if (!activeBindings.has(name)) errors.push(`ACTIVE_REQUIRED_BINDING_MISSING:${name}`);
    if (!candidateBindings.has(name)) errors.push(`CANDIDATE_REQUIRED_BINDING_MISSING:${name}`);
  }

  for (const [name, before] of activeBindings) {
    const after = candidateBindings.get(name);
    if (!after) { errors.push(`CANDIDATE_BINDING_MISSING:${name}`); continue; }
    compareBinding(before, after, errors, mode);
  }
  for (const [name, binding] of candidateBindings) {
    if (!activeBindings.has(name)) {
      const allowed = ALLOWED_ADDITIONS.get(name);
      if (!controlledAddition(name,binding,mode) && (!allowed || allowed.type !== binding.type ||
          (allowed.text !== undefined && allowed.text !== binding.text))) {
        errors.push(`CANDIDATE_BINDING_UNAUTHORIZED:${name}`);
      }
    }
  }

  if (mode !== null) {
    requireCompatibleActivationSource(activeBindings, mode, errors);
    const master = candidateBindings.get('BINRAT_AUTONOMOUS_RAT_ENABLED');
    const publicMode = candidateBindings.get('BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED');
    const uiV2 = candidateBindings.get('BINRAT_TELEGRAM_UI_V2_ENABLED');
    const media = candidateBindings.get('BINRAT_TELEGRAM_MEDIA_ENABLED');
    const tester = candidateBindings.get('BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID');
    if (master?.type !== 'plain_text' || master.text !== 'true') errors.push('CONTROLLED_RAT_MASTER_NOT_ENABLED');
    if (publicMode?.type !== 'plain_text' || publicMode.text !== 'false') errors.push('CONTROLLED_RAT_PUBLIC_MODE_NOT_DISABLED');
    if (uiV2?.type !== 'plain_text' || uiV2.text !== (mode === 'UI_V2' ? 'true' : 'false')) errors.push('CONTROLLED_RAT_UI_V2_MODE_INVALID');
    if (media?.type !== 'plain_text' || media.text !== (mode === 'UI_V2' ? 'true' : 'false')) errors.push('CONTROLLED_RAT_MEDIA_MODE_INVALID');
    if (!tester || tester.type !== 'secret_text') errors.push('CONTROLLED_RAT_TESTER_BINDING_MISSING');
    if (mode === 'UI_V2') {
      const candidateGate = candidateBindings.get('RAT_CANDIDATE_ALLOWED_USER_ID');
      if (!candidateGate || (candidateGate.type !== 'secret_text' && candidateGate.type !== 'plain_text')) {
        errors.push('CONTROLLED_UI_V2_CANDIDATE_GATE_MISSING');
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

/**
 * A first private activation must start from OFF. A later UI-V2 private update may
 * start from the exact already-private state, but never from a partial/public state.
 */
function requireCompatibleActivationSource(
  activeBindings: Map<string, WorkerBinding>,
  mode: 'TEXT' | 'UI_V2',
  errors: string[]
): void {
  const publicMode = activeBindings.get('BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED');
  if (publicMode && (publicMode.type !== 'plain_text' || publicMode.text !== 'false')) {
    errors.push('CONTROLLED_RAT_PUBLIC_SOURCE_NOT_DISABLED');
    return;
  }

  const master = activeBindings.get('BINRAT_AUTONOMOUS_RAT_ENABLED');
  const ui = activeBindings.get('BINRAT_TELEGRAM_UI_V2_ENABLED');
  const media = activeBindings.get('BINRAT_TELEGRAM_MEDIA_ENABLED');
  const value = (binding: WorkerBinding | undefined) =>
    binding?.type === 'plain_text' ? binding.text : undefined;

  if (mode === 'TEXT') {
    if (master && value(master) !== 'false') errors.push('CONTROLLED_RAT_MASTER_SOURCE_NOT_DISABLED');
    if (ui && value(ui) !== 'false') errors.push('CONTROLLED_RAT_UI_V2_SOURCE_NOT_DISABLED');
    if (media && value(media) !== 'false') errors.push('CONTROLLED_RAT_MEDIA_SOURCE_NOT_DISABLED');
    return;
  }

  const state = [value(master), value(ui), value(media)];
  if (state.every(item => item === undefined || item === 'false')) return;

  if (state.every(item => item === 'true')) {
    const tester = activeBindings.get('BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID');
    const candidateGate = activeBindings.get('RAT_CANDIDATE_ALLOWED_USER_ID');
    if (tester?.type !== 'secret_text') errors.push('CONTROLLED_UI_V2_SOURCE_TESTER_MISSING');
    if (!candidateGate || (candidateGate.type !== 'secret_text' && candidateGate.type !== 'plain_text')) {
      errors.push('CONTROLLED_UI_V2_SOURCE_CANDIDATE_GATE_MISSING');
    }
    return;
  }

  errors.push('CONTROLLED_UI_V2_SOURCE_STATE_INVALID');
}

export function verifyCandidateManifest(config: unknown, options: BindingParityOptions = {}): BindingParityResult {
  const value = config as {
    name?: unknown; ai?: { binding?: unknown }; triggers?: { crons?: unknown }; assets?: { directory?: unknown };
    vars?: Record<string, unknown>;
  };
  const errors: string[] = [];
  const mode = controlledMode(options, errors);
  if (value.name !== 'binrat-edge-v0') errors.push('WORKER_NAME_MISMATCH');
  if (value.ai?.binding !== 'AI') errors.push('AI_BINDING_MISSING_FROM_MANIFEST');
  if (!Array.isArray(value.triggers?.crons) || value.triggers!.crons.length !== 1 || value.triggers!.crons[0] !== '* * * * *') {
    errors.push('CRON_PARITY_FAILED');
  }
  if (value.assets?.directory !== './web') errors.push('STATIC_ASSET_MANIFEST_FAILED');
  const expectedRat = mode === null ? 'false' : 'true';
  if (value.vars?.BINRAT_AUTONOMOUS_RAT_ENABLED !== expectedRat) {
    errors.push(mode === null ? 'AUTONOMOUS_RAT_NOT_FLAG_OFF' : 'CONTROLLED_RAT_MASTER_NOT_ENABLED');
  }
  if (value.vars?.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED !== 'false') errors.push('AUTONOMOUS_RAT_PUBLIC_MODE_NOT_DISABLED');
  const uiExpected = mode === 'UI_V2' ? 'true' : 'false';
  if (value.vars?.BINRAT_TELEGRAM_UI_V2_ENABLED !== uiExpected) errors.push(mode === 'UI_V2' ? 'CONTROLLED_RAT_UI_V2_NOT_ENABLED' : 'TELEGRAM_UI_V2_NOT_FLAG_OFF');
  if (value.vars?.BINRAT_TELEGRAM_MEDIA_ENABLED !== uiExpected) errors.push(mode === 'UI_V2' ? 'CONTROLLED_RAT_MEDIA_NOT_ENABLED' : 'TELEGRAM_MEDIA_NOT_FLAG_OFF');
  if (value.vars?.BINRAT_PONS_MAX_BATCH_BLOCKS !== '1024') errors.push('PONS_BATCH_BOUND_INVALID');
  if (value.vars?.BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS !== '4096') errors.push('PONS_CATCHUP_BATCH_BOUND_INVALID');
  if (value.vars?.BINRAT_PONS_CATCHUP_MAX_BATCHES !== '4') errors.push('PONS_CATCHUP_BATCH_COUNT_INVALID');
  if (value.vars?.BINRAT_PONS_CATCHUP_WORK_BUDGET_MS !== '60000') errors.push('PONS_CATCHUP_WORK_BUDGET_INVALID');
  if (value.vars?.BINRAT_PONS_NEAR_HEAD_BLOCKS !== '2048') errors.push('PONS_NEAR_HEAD_BOUND_INVALID');
  if (value.vars?.BINRAT_PONS_MAX_CANONICAL_LAUNCH_BLOCKS !== '128') errors.push('PONS_CANONICAL_DENSITY_BOUND_INVALID');
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

function compareBinding(
  before: WorkerBinding,
  after: WorkerBinding,
  errors: string[],
  mode: 'TEXT' | 'UI_V2' | null
): void {
  if (before.type !== after.type) { errors.push(`BINDING_TYPE_CHANGED:${before.name}`); return; }
  if (before.type === 'd1' && (before.id ?? before.database_id) !== (after.id ?? after.database_id)) {
    errors.push(`D1_TARGET_CHANGED:${before.name}`);
  }
  if (before.type === 'queue' && before.queue_name !== after.queue_name) errors.push(`QUEUE_TARGET_CHANGED:${before.name}`);
  const disablesCandidateDiagnostic = before.name === 'RAT_CANDIDATE_SMOKE_ENABLED' &&
    before.text === 'true' && after.text === 'false';
  const controlledRatToggle = mode !== null && before.name === 'BINRAT_AUTONOMOUS_RAT_ENABLED' && before.text === 'false' && after.text === 'true';
  const uiV2Toggle = mode === 'UI_V2' && before.name === 'BINRAT_TELEGRAM_UI_V2_ENABLED' && before.text === 'false' && after.text === 'true';
  const mediaToggle = mode === 'UI_V2' && before.name === 'BINRAT_TELEGRAM_MEDIA_ENABLED' && before.text === 'false' && after.text === 'true';
  const controlledPonsSteadyUpgrade = mode !== null && before.name === 'BINRAT_PONS_MAX_BATCH_BLOCKS' &&
    before.text === '512' && after.text === '1024';
  if (before.type === 'plain_text' && !ALLOWED_VALUE_CHANGES.has(before.name) &&
      !disablesCandidateDiagnostic && !controlledRatToggle && !uiV2Toggle && !mediaToggle &&
      !controlledPonsSteadyUpgrade && before.text !== after.text) {
    errors.push(`VARIABLE_CHANGED:${before.name}`);
  }
}
function controlledMode(options: BindingParityOptions, errors: string[]): 'TEXT' | 'UI_V2' | null {
  if (options.controlledRatActivation && options.controlledTelegramUiV2Activation) {
    errors.push('CONTROLLED_ACTIVATION_MODE_AMBIGUOUS');
    return null;
  }
  return options.controlledTelegramUiV2Activation ? 'UI_V2' : options.controlledRatActivation ? 'TEXT' : null;
}
function controlledAddition(name: string, binding: WorkerBinding, mode: 'TEXT' | 'UI_V2' | null): boolean {
  if (mode === null) return false;
  if (name === 'BINRAT_AUTONOMOUS_RAT_ENABLED') return binding.type === 'plain_text' && binding.text === 'true';
  if (mode === 'UI_V2' && (name === 'BINRAT_TELEGRAM_UI_V2_ENABLED' || name === 'BINRAT_TELEGRAM_MEDIA_ENABLED')) {
    return binding.type === 'plain_text' && binding.text === 'true';
  }
  if (mode === 'UI_V2' && name === 'TELEGRAM_WEBHOOK_SECRET_NEXT') return binding.type === 'secret_text';
  return mode === 'UI_V2' && name === 'RAT_CANDIDATE_ALLOWED_USER_ID' && binding.type === 'secret_text';
}

/** A visible whole-bot gate must equal the exact autonomous tester. Secrets are set by the harness. */
export function verifyPrivateTesterGate(tester: string, binding: WorkerBinding | undefined): BindingParityResult {
  const errors: string[] = [];
  if (!/^[1-9]\d{3,16}$/.test(tester)) errors.push('CONTROLLED_RAT_TESTER_ID_MISSING_OR_INVALID');
  if (!binding) errors.push('CONTROLLED_UI_V2_CANDIDATE_GATE_MISSING');
  else if (binding.type === 'plain_text' && binding.text !== tester) errors.push('CANDIDATE_GATE_TESTER_MISMATCH');
  else if (binding.type !== 'plain_text' && binding.type !== 'secret_text') errors.push('CONTROLLED_UI_V2_CANDIDATE_GATE_INVALID');
  return { ok: errors.length === 0, errors };
}

function sameStrings(left: string[] | undefined, right: string[] | undefined): boolean {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}
function sameJson(left: unknown, right: unknown): boolean { return JSON.stringify(left) === JSON.stringify(right); }
