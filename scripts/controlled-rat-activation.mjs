export const ACTIVATION_MODE = Object.freeze({
  TEXT_PRIVATE: 'autonomous-text-private',
  TELEGRAM_UI_V2_PRIVATE: 'telegram-ui-v2-private'
});

export const UI_V2_CONFIRMATION = 'ENABLE_PRIVATE_TELEGRAM_UI_V2';
export const REVIEWED_TELEGRAM_UI_V2_PRODUCT_SHA = '6b6ddeda1d64803f8afcc01373079a8313bb93ba';
export const PRODUCT_RUNTIME_PATHS = Object.freeze([
  'src/autonomous',
  'src/telegram',
  'src/cloudflare/worker.ts',
  'src/cloudflare/syncQueue.ts',
  'src/cloudflare/d1Schema.ts',
  'src/pons',
  'web',
  'package.json',
  'pnpm-lock.yaml'
]);
export const PROMPT_MIGRATION = 'cloudflare/migrations/20260930_telegram_ui_v2_prompts.sql';
const EXPECTED_PROMPT_COLUMNS = [
  'chat_id:INTEGER:1:1', 'user_id:INTEGER:1:2', 'action:TEXT:1:0',
  'source_update_id:INTEGER:1:0', 'card_message_id:INTEGER:1:0',
  'prompt_message_id:INTEGER:1:0', 'created_at_ms:INTEGER:1:0', 'expires_at_ms:INTEGER:1:0'
].join('|');

export function parseActivationMode(value) {
  return value === ACTIVATION_MODE.TEXT_PRIVATE || value === ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE
    ? value : null;
}

export function activationGateError(mode, context) {
  if (!parseActivationMode(mode)) return 'ACTIVATION_MODE_INVALID';
  const expectedRef = mode === ACTIVATION_MODE.TEXT_PRIVATE
    ? 'refs/heads/feat/binrat-robinhood-live-rat-v1'
    : 'refs/heads/feat/binrat-telegram-ux-v2';
  if (context.ref !== expectedRef) return 'REF_NOT_CONTROLLED_RAT_BRANCH';
  if (mode === ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE) {
    if (context.eventName !== 'workflow_dispatch') return 'TELEGRAM_UI_V2_DISPATCH_ONLY';
    if (context.confirmation !== UI_V2_CONFIRMATION) return 'TELEGRAM_UI_V2_CONFIRMATION_REQUIRED';
  }
  return null;
}

export function candidateVars(mode, releaseSha) {
  if (!parseActivationMode(mode)) throw new Error('ACTIVATION_MODE_INVALID');
  if (!/^[0-9a-f]{40}$/.test(releaseSha ?? '')) throw new Error('RELEASE_SHA_INVALID');
  const uiV2 = mode === ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE;
  return {
    BINRAT_PONS_MAX_BATCH_BLOCKS: '512',
    BINRAT_AUTONOMOUS_RAT_ENABLED: 'true',
    BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED: 'false',
    BINRAT_TELEGRAM_UI_V2_ENABLED: uiV2 ? 'true' : 'false',
    BINRAT_TELEGRAM_MEDIA_ENABLED: uiV2 ? 'true' : 'false',
    BINRAT_RELEASE_SHA: releaseSha
  };
}

/** The remote query serializes pragma_table_info in this deterministic shape. */
export function promptSchemaDecision(snapshot) {
  if (!snapshot?.tableSql) return 'MISSING';
  const table = String(snapshot.tableSql).replaceAll(/\s+/g, ' ').trim();
  const index = String(snapshot.expiryIndexSql ?? '').replaceAll(/\s+/g, ' ').trim();
  if (snapshot.columnShape !== EXPECTED_PROMPT_COLUMNS ||
      !/^CREATE TABLE rat_ui_prompts \(/i.test(table) ||
      !/action TEXT NOT NULL CHECK\s*\(\s*action\s*=\s*'DIG'\s*\)/i.test(table) ||
      !/PRIMARY KEY\s*\(\s*chat_id\s*,\s*user_id\s*\)/i.test(table) ||
      !/^CREATE INDEX idx_rat_ui_prompts_expiry ON rat_ui_prompts\s*\(\s*expires_at_ms\s*\)$/i.test(index)) {
    return 'INCOMPATIBLE';
  }
  return 'COMPATIBLE';
}

export function promptSchemaPlan(decision) {
  if (decision === 'COMPATIBLE') return { action:'ALREADY_PRESENT', migration:null };
  if (decision === 'MISSING') return { action:'APPLY_EXACT_MIGRATION', migration:PROMPT_MIGRATION };
  return { action:'SAFE_STOP', migration:null };
}

export function rollbackSchemaNotice(promptSchemaApplied) {
  return promptSchemaApplied
    ? 'ROLLBACK_CODE_ONLY: additive Telegram prompt schema retained.'
    : null;
}
