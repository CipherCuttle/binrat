#!/usr/bin/env node
// One-shot controlled private Autonomous Rat rollout. Uploads a candidate first,
// verifies parity, then promotes. It never merges, changes token/Holder authority,
// or mutates the Telegram webhook. UI V2 may add only its exact prompt schema.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, appendFileSync, existsSync } from 'node:fs';
import {
  ACTIVATION_MODE, PRODUCT_RUNTIME_PATHS, PROMPT_MIGRATION,
  REVIEWED_TELEGRAM_UI_V2_PRODUCT_SHA, activationGateError, candidateVars,
  parseActivationMode, promptSchemaDecision, promptSchemaPlan, rollbackSchemaNotice
} from './controlled-rat-activation.mjs';

const WORKER = 'binrat-edge-v0';
const DB = 'binrat-v0';
const DB_ID = '46814564-1a41-449a-88e5-c1349eed3a27';
const WORKER_URL = 'https://binrat-edge-v0.pettevik.workers.dev';
const CONFIG = 'wrangler.controlled-rat.generated.jsonc';
const SECRETS = '/tmp/binrat-controlled-rat-secrets.json';
const WRANGLER = ['dlx', 'wrangler@4.135.0'];
const summary = process.env.GITHUB_STEP_SUMMARY;
let promotionAttempted = false;
let previousVersion = null;

function note(line) {
  console.log(line);
  if (summary) appendFileSync(summary, line + '\n');
}
function gate(ok, code) { if (!ok) throw new Error(code); }
function cli(args, opts = {}) {
  try {
    return execFileSync('pnpm', [...WRANGLER, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: opts.timeout ?? 120_000,
      env: process.env
    }).trim();
  } catch (error) {
    throw new Error('WRANGLER_FAILED:' + args.slice(0, 3).join(':') + ':' + (error.status ?? 'UNKNOWN'));
  }
}
function jsonFromOutput(output) {
  const positions = [output.indexOf('{'), output.indexOf('[')].filter(i => i >= 0);
  gate(positions.length > 0, 'WRANGLER_JSON_MISSING');
  return JSON.parse(output.slice(Math.min(...positions)));
}
function uuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function walk(value, visit) {
  if (!value || typeof value !== 'object') return null;
  const hit = visit(value);
  if (hit) return hit;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const nested = walk(child, visit);
    if (nested) return nested;
  }
  return null;
}
function activeVersionFrom(status) {
  return walk(status, value => {
    const id = value.version_id ?? value.versionId;
    const pct = value.percentage ?? value.percent ?? value.traffic;
    const hundred = pct === 100 || pct === '100' || pct === 1 || pct === '1';
    return uuid(id) && hundred ? id : null;
  });
}
function taggedVersionFrom(list, tag) {
  return walk(list, value => {
    if (value.tag !== tag) return null;
    const id = value.version_id ?? value.versionId ?? value.id;
    return uuid(id) ? id : null;
  });
}
function plainBinding(version, name) {
  return walk(version, value =>
    value?.name === name && value?.type === 'plain_text' && typeof value?.text === 'string'
      ? value.text.trim() : null
  );
}
function binding(version, name) {
  return walk(version, value => value?.name === name && typeof value?.type === 'string' ? value : null);
}
async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const body = await response.json().catch(() => null);
  gate(response.ok && body && typeof body === 'object', 'HTTP_PREFLIGHT_FAILED');
  return body;
}
async function webhookUrl(token) {
  if (!token) return null;
  const response = await fetch('https://api.telegram.org/bot' + token + '/getWebhookInfo', {
    signal: AbortSignal.timeout(20_000)
  });
  const body = await response.json().catch(() => null);
  gate(response.ok && body?.ok === true, 'TELEGRAM_WEBHOOK_READBACK_FAILED');
  return String(body.result?.url ?? '');
}
function parseJsonc(path) {
  return JSON.parse(
    readFileSync(path, 'utf8')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/,\s*([}\]])/g, '$1')
  );
}
function testerFromFeedbackMarker(config) {
  const sql = [
    "SELECT CASE WHEN COUNT(*) = 1 THEN MAX(user_id) ELSE NULL END AS user_id, COUNT(*) AS matches",
    "FROM rat_feedback",
    "WHERE body = 'binrat-controlled-rat-id-0929';"
  ].join(' ');
  const output = jsonFromOutput(cli([
    'd1','execute','DB','--remote','--yes','--json','--command',sql,'--config',config
  ]));
  const row = walk(output, value =>
    Number.isFinite(Number(value.matches)) && Object.hasOwn(value, 'user_id') ? value : null
  );
  gate(row, 'CONTROLLED_RAT_TESTER_MARKER_RESULT_MISSING');
  gate(Number(row.matches) === 1, 'CONTROLLED_RAT_TESTER_MARKER_NOT_UNIQUE');
  const id = String(row.user_id ?? '').trim();
  gate(/^[1-9]\d{3,16}$/.test(id), 'CONTROLLED_RAT_TESTER_MARKER_ID_INVALID');
  return id;
}

function d1Preflight(config) {
  const sql = [
    "SELECT",
    "  (SELECT COUNT(*) FROM rat_v1_outbox WHERE chain_id != 4663 AND state IN ('PENDING','SENDING','UNKNOWN')) AS stale_outbox,",
    "  (SELECT COUNT(*) FROM rat_v1_watches WHERE chain_id != 4663 AND enabled = 1) AS stale_watches;"
  ].join(' ');
  const output = jsonFromOutput(cli([
    'd1','execute','DB','--remote','--yes','--json','--command',sql,'--config',config
  ]));
  const row = walk(output, value =>
    Number.isFinite(Number(value.stale_outbox)) && Number.isFinite(Number(value.stale_watches))
      ? value : null
  );
  gate(row, 'D1_PREFLIGHT_RESULT_MISSING');
  gate(Number(row.stale_outbox) === 0, 'STALE_CROSS_CHAIN_OUTBOX');
  gate(Number(row.stale_watches) === 0, 'STALE_CROSS_CHAIN_WATCH');
}
function promptSchemaSnapshot(config) {
  const sql = [
    "SELECT",
    "  (SELECT sql FROM sqlite_master WHERE type='table' AND name='rat_ui_prompts') AS table_sql,",
    "  (SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_rat_ui_prompts_expiry') AS expiry_index_sql,",
    "  COALESCE((SELECT group_concat(shape, '|') FROM (",
    "    SELECT name || ':' || upper(type) || ':' || \"notnull\" || ':' || pk AS shape",
    "    FROM pragma_table_info('rat_ui_prompts') ORDER BY cid",
    "  )), '') AS column_shape;"
  ].join(' ');
  const output = jsonFromOutput(cli([
    'd1','execute','DB','--remote','--yes','--json','--command',sql,'--config',config
  ]));
  const row = walk(output, value => Object.hasOwn(value ?? {}, 'table_sql') &&
    Object.hasOwn(value ?? {}, 'expiry_index_sql') && Object.hasOwn(value ?? {}, 'column_shape') ? value : null);
  gate(row, 'TELEGRAM_UI_PROMPT_SCHEMA_RESULT_MISSING');
  return { tableSql: row.table_sql, expiryIndexSql: row.expiry_index_sql, columnShape: String(row.column_shape ?? '') };
}
function ensurePromptSchema(config) {
  const initial = promptSchemaPlan(promptSchemaDecision(promptSchemaSnapshot(config)));
  if (initial.action === 'SAFE_STOP') throw new Error('TELEGRAM_UI_PROMPT_SCHEMA_INCOMPATIBLE');
  if (initial.action === 'ALREADY_PRESENT') {
    note('TELEGRAM_UI_PROMPT_SCHEMA_ALREADY_PRESENT');
    return false;
  }
  gate(initial.migration === PROMPT_MIGRATION && existsSync(initial.migration), 'TELEGRAM_UI_PROMPT_MIGRATION_MISSING');
  // This is the sole D1 mutation for UI V2 activation. Never run a broad migration set.
  cli(['d1','execute','DB','--remote','--yes','--file',initial.migration,'--config',config], { timeout:180_000 });
  gate(promptSchemaDecision(promptSchemaSnapshot(config)) === 'COMPATIBLE', 'TELEGRAM_UI_PROMPT_SCHEMA_VERIFY_FAILED');
  note('TELEGRAM_UI_PROMPT_SCHEMA_APPLIED');
  return true;
}
function deploymentStatus() {
  return jsonFromOutput(cli(['deployments','status','--name',WORKER,'--json']));
}

const mode = parseActivationMode(process.env.CONTROLLED_RAT_ACTIVATION_MODE);
gate(mode, 'ACTIVATION_MODE_INVALID');
const activationError = activationGateError(mode, {
  ref: process.env.GITHUB_REF,
  eventName: process.env.GITHUB_EVENT_NAME,
  confirmation: process.env.CONTROLLED_RAT_UI_V2_CONFIRMATION
});
gate(activationError === null, activationError ?? 'ACTIVATION_GATE_FAILED');
gate(process.env.CONTROLLED_RAT_DEPLOY_APPROVED === 'true',
  'CONTROLLED_RAT_DEPLOY_APPROVAL_CLOSED');
gate(Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim()) &&
  Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()), 'CLOUDFLARE_CREDENTIALS_MISSING');

let tester = (process.env.CONTROLLED_RAT_ALLOWED_USER_ID?.trim() ||
  process.env.CONTROLLED_RAT_ALLOWED_USER_ID_FALLBACK?.trim() || '');

execFileSync('git', ['diff','--quiet',REVIEWED_TELEGRAM_UI_V2_PRODUCT_SHA + '..' + process.env.GITHUB_SHA,
  '--',...PRODUCT_RUNTIME_PATHS], { stdio: 'inherit' });
note('Reviewed runtime product paths unchanged since ' + REVIEWED_TELEGRAM_UI_V2_PRODUCT_SHA + '.');

const plan = execFileSync('node', ['scripts/check-rat-ai-plan.mjs'], {
  encoding: 'utf8', stdio: ['ignore','pipe','pipe'], env: process.env, timeout: 30_000
});
gate(plan.includes('WORKERS_PLAN: PAID'), 'WORKERS_PAID_NOT_VERIFIED');
note('Cloudflare Workers Paid verified by read-only account subscription check.');

const beforeHealth = await getJson(WORKER_URL + '/health');
gate(beforeHealth.ok === true && beforeHealth.service === 'binrat-cloudflare-edge',
  'LIVE_WORKER_HEALTH_FAILED');
const beforePons = await getJson(WORKER_URL + '/api/health');
note('Pons preflight ' + JSON.stringify({
  ok: beforePons.ok,
  chainId: beforePons.chainId,
  indexReady: beforePons.indexReady,
  checkpointBlock: beforePons.checkpointBlock,
  headBlock: beforePons.headBlock,
  targetBlock: beforePons.targetBlock,
  liveCaughtUp: beforePons.liveCaughtUp,
  launchCount: beforePons.launchCount,
  historyBackfillComplete: beforePons.historyBackfillComplete,
  lastSyncError: beforePons.lastSyncError,
  runtimeFresh: beforePons.runtimeFresh,
  runtimeUpdatedAtMs: beforePons.runtimeUpdatedAtMs
}));
gate(beforePons.ok === true && beforePons.chainId === 4663 &&
  beforePons.indexReady === true && beforePons.liveCaughtUp === true &&
  beforePons.lastSyncError === null, 'PONS_PREFLIGHT_NOT_HEALTHY');

const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
const beforeWebhook = await webhookUrl(botToken);
if (beforeWebhook !== null) {
  gate(beforeWebhook === WORKER_URL + '/telegram/webhook', 'TELEGRAM_WEBHOOK_PREDEPLOY_MISMATCH');
}

const cfg = parseJsonc('cloudflare/wrangler.example.jsonc');
cfg.d1_databases[0].database_id = DB_ID;
cfg.vars = candidateVars(mode, process.env.GITHUB_SHA);
cfg.keep_vars = true;
writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
d1Preflight(CONFIG);
note('D1 preflight PASS: no enabled/pending non-4663 autonomous Watch state.');

const current = deploymentStatus();
previousVersion = activeVersionFrom(current);
gate(previousVersion, 'ACTIVE_VERSION_NOT_RESOLVED');
const activeConfig = jsonFromOutput(cli([
  'versions','view',previousVersion,'--name',WORKER,'--json'
]));

if (!tester) {
  tester = plainBinding(activeConfig, 'RAT_FEEDBACK_ADMIN_USER_ID') || '';
}
if (!tester) tester = testerFromFeedbackMarker(CONFIG);
gate(/^[1-9]\d{3,16}$/.test(tester), 'CONTROLLED_RAT_TESTER_ID_MISSING_OR_INVALID');
const secrets = { BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID: tester };
if (mode === ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE) {
  const existingCandidateGate = binding(activeConfig, 'RAT_CANDIDATE_ALLOWED_USER_ID');
  if (existingCandidateGate?.type === 'plain_text') {
    gate(existingCandidateGate.text === tester, 'CANDIDATE_GATE_TESTER_MISMATCH');
  } else {
    gate(!existingCandidateGate || existingCandidateGate.type === 'secret_text', 'CONTROLLED_UI_V2_CANDIDATE_GATE_INVALID');
    // A secret candidate gate cannot be read. Supply the same selected tester to
    // the candidate explicitly so both ingress gates resolve to one principal.
    secrets.RAT_CANDIDATE_ALLOWED_USER_ID = tester;
  }
}
writeFileSync(SECRETS, JSON.stringify(secrets));
note('Controlled tester identity resolved from protected configuration or exact D1 marker.');
let promptSchemaApplied = false;
try {
  // The read-only schema probe and its one exact additive migration happen
  // before candidate upload, but inside cleanup/rollback handling.
  promptSchemaApplied = mode === ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE && ensurePromptSchema(CONFIG);
  const tag = 'controlled-rat-' + process.env.GITHUB_SHA.slice(0, 12);
  cli([
    'versions','upload','--config',CONFIG,'--keep-vars','--strict',
    '--secrets-file',SECRETS,'--tag',tag,
    '--message',mode === ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE ? 'BINRAT private Telegram UX V2' : 'BINRAT controlled private Autonomous Rat'
  ], { timeout: 180_000 });
  rmSync(SECRETS, { force: true });

  const versions = jsonFromOutput(cli(['versions','list','--name',WORKER,'--json']));
  const candidateVersion = taggedVersionFrom(versions, tag);
  gate(candidateVersion, 'CANDIDATE_VERSION_NOT_RESOLVED');
  gate(candidateVersion !== previousVersion, 'CANDIDATE_VERSION_EQUALS_ACTIVE');

  execFileSync('pnpm', [
    'verify:production-binding-parity','--',
    '--worker',WORKER,
    '--active-version',previousVersion,
    '--candidate-version',candidateVersion,
    '--config',CONFIG,
    mode === ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE ? '--controlled-telegram-ui-v2-activation' : '--controlled-rat-activation'
  ], { stdio: 'inherit', env: process.env, timeout: 180_000 });
  note('Candidate binding parity PASS; candidate remained non-live until this point.');

  // Treat a transport-ambiguous promotion result as potentially live. A
  // best-effort code rollback is safer than assuming the candidate stayed dark.
  promotionAttempted = true;
  cli([
    'versions','deploy',candidateVersion + '@100%','--name',WORKER,'--yes',
    '--message',mode === ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE ? 'BINRAT private Telegram UX V2' : 'BINRAT controlled private Autonomous Rat'
  ], { timeout: 180_000 });
  const afterHealth = await getJson(WORKER_URL + '/health');
  gate(afterHealth.ok === true && afterHealth.releaseSha === process.env.GITHUB_SHA,
    'POSTDEPLOY_RELEASE_SHA_MISMATCH');
  const afterPons = await getJson(WORKER_URL + '/api/health');
  gate(afterPons.ok === true && afterPons.chainId === 4663 &&
    afterPons.indexReady === true && afterPons.liveCaughtUp === true &&
    afterPons.lastSyncError === null, 'POSTDEPLOY_PONS_NOT_HEALTHY');

  const diagnostic = await fetch(WORKER_URL + '/__candidate/pons-bootstrap', {
    signal: AbortSignal.timeout(20_000)
  });
  gate(diagnostic.status === 404, 'CANDIDATE_DIAGNOSTIC_STILL_EXPOSED');

  const afterWebhook = await webhookUrl(botToken);
  if (beforeWebhook !== null) gate(afterWebhook === beforeWebhook, 'TELEGRAM_WEBHOOK_CHANGED');

  const deployed = activeVersionFrom(deploymentStatus());
  gate(deployed === candidateVersion, 'CANDIDATE_NOT_AT_100_PERCENT');
  if (mode === ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE) {
    const deployedConfig = jsonFromOutput(cli(['versions','view',candidateVersion,'--name',WORKER,'--json']));
    for (const [name, value] of Object.entries(candidateVars(mode, process.env.GITHUB_SHA))) {
      if (name === 'BINRAT_RELEASE_SHA') continue;
      gate(plainBinding(deployedConfig,name) === value, 'POSTDEPLOY_BINDING_MISMATCH:' + name);
    }
    const deployedCandidateGate = binding(deployedConfig,'RAT_CANDIDATE_ALLOWED_USER_ID');
    gate(binding(deployedConfig,'BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID')?.type === 'secret_text' &&
      (deployedCandidateGate?.type === 'secret_text' ||
        (deployedCandidateGate?.type === 'plain_text' && deployedCandidateGate.text === tester)),
    'POSTDEPLOY_TESTER_BINDING_MISSING');
    note('PRIVATE_TELEGRAM_UX_V2_DEPLOYMENT_PASS: candidate live at 100%; single private tester only; UI V2 ON; Telegram media ON; public autonomous mode OFF; prompt schema verified; webhook unchanged; no merge performed.');
  } else {
    note('CONTROLLED_RAT_DEPLOYMENT_PASS: candidate is live at 100%; autonomous scope remains one private tester.');
    note('Public autonomous mode OFF. Telegram UI V2 OFF. Telegram media OFF. No merge performed.');
  }
} catch (error) {
  if (promotionAttempted && previousVersion) {
    try {
      cli([
        'versions','deploy',previousVersion + '@100%','--name',WORKER,'--yes',
        '--message','Automatic rollback after controlled Rat postdeploy failure'
      ], { timeout: 180_000 });
      note('ROLLBACK_PASS: previous Worker version restored to 100%.');
    } catch {
      note('ROLLBACK_FAILED: manual Cloudflare rollback required immediately.');
    }
  }
  const schemaNotice = rollbackSchemaNotice(promptSchemaApplied);
  if (schemaNotice) note(schemaNotice);
  throw error;
} finally {
  rmSync(SECRETS, { force: true });
}
