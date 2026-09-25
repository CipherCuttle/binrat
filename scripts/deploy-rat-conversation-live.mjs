#!/usr/bin/env node
// One guarded rollout of the existing @BinratBot Worker, never a bot-token cutover.
// Runs in GitHub Actions only, after exact-branch CI and explicit owner deployment authority.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';

const PRODUCTION_WORKER = 'binrat-edge-v0';
const PRODUCTION_DB = 'binrat-v0';
const PRODUCTION_QUEUE = 'binrat-sync-v0';
const WORKER_URL = 'https://binrat-edge-v0.pettevik.workers.dev';
const WEBHOOK_URL = WORKER_URL + '/telegram/webhook';
const CONFIG = '/tmp/binrat-rat-live-wrangler.jsonc';
// Pin the known existing D1 ID from the reviewed Rat Radar live-deploy workflow.
const EXPECTED_DB_ID = '46814564-1a41-449a-88e5-c1349eed3a27';
const WRANGLER = ['dlx', 'wrangler@4.135.0'];
const summary = process.env.GITHUB_STEP_SUMMARY;
function note(line) { console.log(line); if (summary) appendFileSync(summary, line + '\n'); }
function gate(check, code) { if (!check) throw new Error(code); }
function cli(args, opts = {}) {
  try {
    return execFileSync('pnpm', [...WRANGLER, ...args], {
      encoding: 'utf8', stdio: ['pipe','pipe','pipe'],
      timeout: opts.timeout ?? 100_000,
      env: process.env
    }).trim();
  } catch (e) {
    // Deliberately omit stderr/stdout: URLs, token headers and bindings can contain secrets.
    throw new Error('WRANGLER_FAILED:' + args.slice(0, 3).join(':') + ':' + (e.status ?? 'UNKNOWN'));
  }
}
function jsonFromOutput(output) {
  const pos = output.search(/[\[{]/);
  gate(pos >= 0, 'WRANGLER_JSON_MISSING');
  return JSON.parse(output.slice(pos));
}
function findUuid(value) {
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return value;
  if (!value || typeof value !== 'object') return null;
  for (const item of Object.values(value)) {
    const found = findUuid(item);
    if (found) return found;
  }
  return null;
}
async function getJson(url, options = {}) {
  const res = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  const body = await res.json().catch(() => null);
  gate(res.ok && body && typeof body === 'object', 'HTTP_PREFLIGHT_FAILED');
  return body;
}

gate(process.env.GITHUB_REF === 'refs/heads/feat/binrat-rat-conversation-free-ai-v1',
  'REF_NOT_EXACT_APPROVED_BRANCH');
gate(process.env.RAT_LIVE_DEPLOY_APPROVED === 'true',
  'LIVE_DEPLOY_APPROVAL_GATE_CLOSED');
for (const name of ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']) {
  gate(Boolean(process.env[name]?.trim()), 'MISSING_REQUIRED_SECRET:' + name);
}
const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
if (token) {
  const telegram = await getJson('https://api.telegram.org/bot' + token + '/getMe');
  gate(telegram.ok === true && String(telegram.result?.username ?? '').toLowerCase() === 'binratbot',
    'GITHUB_BOT_TOKEN_IS_NOT_BINRATBOT');
  const beforeHook = await getJson('https://api.telegram.org/bot' + token + '/getWebhookInfo');
  gate(beforeHook.ok === true && beforeHook.result?.url === WEBHOOK_URL,
    'EXISTING_BOT_WEBHOOK_DIFFERS_FROM_LIVE_WORKER');
  note('Verified current @BinratBot webhook with its existing GitHub bot token; no cutover.');
} else {
  note('GitHub Telegram bot token absent; require BOTH preinstalled production Worker Telegram secrets. No webhook mutation will occur.');
}

const beforeHealth = await getJson(WORKER_URL + '/health');
gate(beforeHealth.ok === true && beforeHealth.service === 'binrat-cloudflare-edge',
  'LIVE_WORKER_PREDEPLOY_HEALTH_MISMATCH');
note('Existing Worker identity verified; preserving queue, assets, secret bindings and webhook.');
const manifest = JSON.parse(readFileSync('docs/CAPABILITY_MANIFEST_V0.json', 'utf8'));
gate(manifest.launchAuthorization?.launchAuthorized === false &&
  manifest.launchAuthorization?.marketingAuthorized === false,
  'TOKEN_LAUNCH_AUTHORITY_NOT_BLOCKED');

// NO d1 create. NO queue create. Existing D1/queue must resolve exactly.
const provision = '/tmp/binrat-rat-live-provision.jsonc';
writeFileSync(provision, JSON.stringify({
  name: PRODUCTION_WORKER,
  main: 'src/cloudflare/worker.ts',
  compatibility_date: '2026-09-18', compatibility_flags: ['nodejs_compat']
}));
const info = jsonFromOutput(cli(['d1', 'info', PRODUCTION_DB, '--json', '--config', provision]));
gate(findUuid(info) === EXPECTED_DB_ID, 'PRODUCTION_D1_ID_MISMATCH');
cli(['queues','info', PRODUCTION_QUEUE, '--config', provision]);
// Cloudflare exposes secret NAMES only. Use the existing Worker bindings without
// copying, decrypting or exposing token values; fail before any migration/deploy.
const listed = jsonFromOutput(cli(['secret','list','--name',PRODUCTION_WORKER,'--config',provision]));
gate(Array.isArray(listed), 'PRODUCTION_SECRET_METADATA_UNAVAILABLE');
const names = new Set(listed.map(item => item?.name).filter(name => typeof name === 'string'));
gate(names.has('TELEGRAM_BOT_TOKEN') && names.has('TELEGRAM_WEBHOOK_SECRET'),
  'PRODUCTION_TELEGRAM_WORKER_SECRETS_MISSING');
note('Pinned existing D1 and sync queue verified; live Worker already has BOTH Telegram secret bindings. No new infrastructure or bot tokens provisioned.');

const fs = await import('node:fs');
const cfg = JSON.parse(
  readFileSync('cloudflare/wrangler.example.jsonc','utf8')
    .replace(/^\s*\/\/.*$/gm,'')
    .replace(/,\s*([}\]])/g,'$1')
    .replaceAll('REPLACE_WITH_D1_DATABASE_ID', EXPECTED_DB_ID)
    .replaceAll('https://REPLACE_WITH_PUBLIC_SITE', WORKER_URL)
);
gate(cfg.name === PRODUCTION_WORKER &&
  cfg.d1_databases?.[0]?.database_name === PRODUCTION_DB &&
  cfg.d1_databases?.[0]?.database_id === EXPECTED_DB_ID &&
  cfg.queues?.producers?.[0]?.queue === PRODUCTION_QUEUE &&
  cfg.queues?.consumers?.[0]?.queue === PRODUCTION_QUEUE &&
  cfg.assets?.directory === './web', 'PRODUCTION_BINDING_PARITY_FAILED');
gate(cfg.ai?.binding === 'AI', 'AI_BINDING_MISSING');
cfg.vars.TELEGRAM_REPLIES_ENABLED = 'true';
cfg.vars.RAT_CONVERSATION_ENABLED = 'true';
cfg.vars.RAT_FEEDBACK_ENABLED = 'true';
cfg.vars.RAT_AI_ENABLED = process.env.RAT_FREE_PLAN_VERIFIED === 'true'
  ? 'true' : 'false';
cfg.vars.BINRAT_PUBLIC_SITE_URL = process.env.BINRAT_PUBLIC_SITE_URL?.trim() || WORKER_URL;
if (/^[1-9]\d{3,16}$/.test(process.env.RAT_FEEDBACK_ADMIN_USER_ID ?? '')) {
  cfg.vars.RAT_FEEDBACK_ADMIN_USER_ID = process.env.RAT_FEEDBACK_ADMIN_USER_ID;
}
delete cfg.vars.RAT_CANDIDATE_ALLOWED_USER_ID;
delete cfg.vars.RAT_CANDIDATE_SMOKE_ENABLED;
// No candidate-only smoke endpoint activated and never repoint Telegram or create bots.
writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
gate(cfg.vars.RAT_AI_ENABLED !== 'true' || process.env.RAT_FREE_PLAN_VERIFIED === 'true',
  'UNVERIFIED_PAID_INFERENCE_RISK');

// Before touching D1, verify candidate Worker bundles and the original production asset tree
// hasn't diverged from the reviewed live Rat Radar baseline.
cli(['deploy', '--dry-run','--config',CONFIG], {timeout:180_000});
note('Exact candidate Worker bundle: dry-run PASS.');
// Additive-only migrations on the existing D1, never a full schema rewrite.
for (const path of [
  'cloudflare/migrations/20260925_rat_conversation.sql',
  'cloudflare/migrations/20260925_rat_feedback.sql'
]) {
  gate(fs.existsSync(path), 'MISSING_ADDITIVE_MIGRATION');
  cli(['d1','execute','DB','--remote','--yes','--file',path,'--config',CONFIG], {timeout:180_000});
}
const tables = cli(['d1','execute','DB','--remote','--yes','--json','--command',
  "SELECT name FROM sqlite_master WHERE name IN ('rat_conversation_context','rat_ai_daily_budget','rat_feedback','rat_feedback_budget') ORDER BY name;",
  '--config',CONFIG]);
for (const t of ['rat_conversation_context','rat_ai_daily_budget','rat_feedback','rat_feedback_budget']) {
  gate(tables.includes(t), 'LIVE_ADDITIVE_D1_TABLE_MISSING:' + t);
}
note('Both additive migrations applied to verified live D1. Existing chain/evidence tables untouched.');

const result = cli(['deploy','--keep-vars','--config',CONFIG], {timeout:180_000});
gate(result.includes(PRODUCTION_WORKER) || result.includes(WORKER_URL),
  'WRANGLER_DEPLOY_CONFIRMATION_MISSING');
note('Existing Worker deployed; existing secrets retained; bot webhook unchanged.');
const afterHealth = await getJson(WORKER_URL + '/health');
gate(afterHealth.ok === true && afterHealth.repliesEnabled === true &&
  afterHealth.conversationEnabled === true &&
  afterHealth.feedbackEnabled === true &&
  afterHealth.aiEnabled === (cfg.vars.RAT_AI_ENABLED === 'true'),
  'POSTDEPLOY_FEATURE_HEALTH_MISMATCH');
if (token) {
  const afterHook = await getJson('https://api.telegram.org/bot' + token + '/getWebhookInfo');
  gate(afterHook.ok === true && afterHook.result?.url === WEBHOOK_URL,
    'POSTDEPLOY_BOT_WEBHOOK_CHANGED');
  note('Telegram remotely confirmed that the webhook URL remained unchanged.');
} else {
  note('Telegram webhook remote readback not possible without GitHub bot token. Deploy script did not call setWebhook or deleteWebhook. Test Telegram DM to verify routing.');
}
note('LIVE_HEALTH_PASS: Telegram replies ON; 30-minute memory ON; /feedback ON; ' +
  'AI small-talk ' + (afterHealth.aiEnabled ? 'ON' : 'OFF pending Free-plan verification') + '.');
note('TEST NOW: https://t.me/BinratBot  — send /help, /feedback, /feedback idea:..., then /feedback delete.');
note('AI free-use cap remains 10/user/day and 120/global/day; confirm account-wide neurons in Cloudflare.');
