#!/usr/bin/env node
// One-shot controlled Autonomous Rat rollout.
// Uploads a candidate version first, verifies exact binding parity, then promotes.
// No merge, no token/Holder changes, no webhook mutation, no D1 writes.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, appendFileSync } from 'node:fs';

const WORKER = 'binrat-edge-v0';
const DB = 'binrat-v0';
const DB_ID = '46814564-1a41-449a-88e5-c1349eed3a27';
const WORKER_URL = 'https://binrat-edge-v0.pettevik.workers.dev';
const REVIEWED_WORKER_SHA = 'a385a21b9e8400b6b4201aeb76a536eff845cdb8';
const CONFIG = '/tmp/binrat-controlled-rat.jsonc';
const SECRETS = '/tmp/binrat-controlled-rat-secrets.json';
const WRANGLER = ['dlx', 'wrangler@4.135.0'];
const summary = process.env.GITHUB_STEP_SUMMARY;
let promoted = false;
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
function deploymentStatus() {
  return jsonFromOutput(cli(['deployments','status','--name',WORKER,'--json']));
}

gate(process.env.GITHUB_REF === 'refs/heads/feat/binrat-robinhood-live-rat-v1',
  'REF_NOT_CONTROLLED_RAT_BRANCH');
gate(process.env.CONTROLLED_RAT_DEPLOY_APPROVED === 'true',
  'CONTROLLED_RAT_DEPLOY_APPROVAL_CLOSED');
gate(Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim()) &&
  Boolean(process.env.CLOUDFLARE_ACCOUNT_ID?.trim()), 'CLOUDFLARE_CREDENTIALS_MISSING');

const tester = (process.env.CONTROLLED_RAT_ALLOWED_USER_ID?.trim() ||
  process.env.CONTROLLED_RAT_ALLOWED_USER_ID_FALLBACK?.trim() || '');
gate(/^[1-9]\d{3,16}$/.test(tester), 'CONTROLLED_RAT_TESTER_ID_MISSING_OR_INVALID');

execFileSync('git', ['diff','--quiet',REVIEWED_WORKER_SHA + '..' + process.env.GITHUB_SHA,
  '--','src','cloudflare','web','package.json','pnpm-lock.yaml'], { stdio: 'inherit' });
note('Reviewed Worker code unchanged since ' + REVIEWED_WORKER_SHA + '.');

const plan = execFileSync('node', ['scripts/check-rat-ai-plan.mjs'], {
  encoding: 'utf8', stdio: ['ignore','pipe','pipe'], env: process.env, timeout: 30_000
});
gate(plan.includes('WORKERS_PLAN: PAID'), 'WORKERS_PAID_NOT_VERIFIED');
note('Cloudflare Workers Paid verified by read-only account subscription check.');

const beforeHealth = await getJson(WORKER_URL + '/health');
gate(beforeHealth.ok === true && beforeHealth.service === 'binrat-cloudflare-edge',
  'LIVE_WORKER_HEALTH_FAILED');
const beforePons = await getJson(WORKER_URL + '/api/health');
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
cfg.vars = {
  BINRAT_PONS_MAX_BATCH_BLOCKS: '512',
  BINRAT_AUTONOMOUS_RAT_ENABLED: 'true',
  BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED: 'false',
  BINRAT_TELEGRAM_MEDIA_ENABLED: 'false',
  BINRAT_RELEASE_SHA: process.env.GITHUB_SHA
};
cfg.keep_vars = true;
writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
writeFileSync(SECRETS, JSON.stringify({
  BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID: tester
}));
d1Preflight(CONFIG);
note('D1 preflight PASS: no enabled/pending non-4663 autonomous Watch state.');

const current = deploymentStatus();
previousVersion = activeVersionFrom(current);
gate(previousVersion, 'ACTIVE_VERSION_NOT_RESOLVED');

const tag = 'controlled-rat-' + process.env.GITHUB_SHA.slice(0, 12);
cli([
  'versions','upload','--config',CONFIG,'--keep-vars','--strict',
  '--secrets-file',SECRETS,'--tag',tag,
  '--message','BINRAT controlled private Autonomous Rat'
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
  '--controlled-rat-activation'
], { stdio: 'inherit', env: process.env, timeout: 180_000 });
note('Candidate binding parity PASS; candidate remained non-live until this point.');

try {
  cli([
    'versions','deploy',candidateVersion + '@100%','--name',WORKER,'--yes',
    '--message','BINRAT controlled private Autonomous Rat'
  ], { timeout: 180_000 });
  promoted = true;

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
  note('CONTROLLED_RAT_DEPLOYMENT_PASS: candidate is live at 100%; autonomous scope remains one private tester.');
  note('Public autonomous mode OFF. Telegram media OFF. No merge performed.');
} catch (error) {
  if (promoted && previousVersion) {
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
  throw error;
} finally {
  rmSync(SECRETS, { force: true });
}
