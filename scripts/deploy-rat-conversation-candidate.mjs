#!/usr/bin/env node
// Isolated candidate only. This script never reads production Wrangler config or D1 IDs.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const WORKER = 'binrat-rat-convo-candidate-20260925';
const DB_NAME = 'binrat-rat-convo-candidate-20260925';
const CONFIG = '/tmp/binrat-rat-convo-wrangler.jsonc';
const PROVISION = '/tmp/binrat-rat-convo-provision.jsonc';
const WRANGLER = ['dlx', 'wrangler@4.135.0'];
const summary = process.env.GITHUB_STEP_SUMMARY;

function report(message) {
  console.log(message);
  if (summary) appendFileSync(summary, message + '\n');
}
function must(condition, code) {
  if (!condition) throw new Error(code);
}
function cli(args, opts = {}) {
  try {
    return execFileSync('pnpm', [...WRANGLER, ...args], {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
      input: opts.input, timeout: opts.timeout ?? 90_000,
      env: process.env
    }).trim();
  } catch (error) {
    // Never include stdout/stderr for credential- or secret-bearing commands.
    throw new Error('WRANGLER_FAILED:' + args.slice(0, 3).join(':') +
      ':EXIT_' + (error.status ?? 'UNKNOWN'));
  }
}
function parseWranglerJson(out) {
  const startObj = out.indexOf('{'), startArr = out.indexOf('[');
  const begin = startArr !== -1 && (startObj === -1 || startArr < startObj) ? startArr : startObj;
  must(begin >= 0, 'WRANGLER_JSON_MISSING');
  const bracket = out[begin] === '[' ? ']' : '}';
  const end = out.lastIndexOf(bracket);
  must(end > begin, 'WRANGLER_JSON_TRUNCATED');
  return JSON.parse(out.slice(begin, end + 1));
}
function findUuid(value) {
  if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return value;
  if (!value || typeof value !== 'object') return null;
  for (const [key, item] of Object.entries(value)) {
    if (['uuid', 'database_id', 'id'].includes(key) && typeof item === 'string' && /^[0-9a-f-]{36}$/i.test(item)) return item;
    const found = findUuid(item);
    if (found) return found;
  }
  return null;
}
function getDatabaseId() {
  const out = cli(['d1','info', DB_NAME, '--json','--config', PROVISION]);
  const parsed = parseWranglerJson(out);
  const id = findUuid(parsed);
  must(Boolean(id), 'CANDIDATE_D1_ID_MISSING');
  return id;
}
const manifest = JSON.parse(readFileSync('docs/CAPABILITY_MANIFEST_V0.json', 'utf8'));
must(
  manifest.launchAuthorization?.launchAuthorized === false &&
  manifest.launchAuthorization?.marketingAuthorized === false,
  'LAUNCH_AUTHORITY_NOT_BLOCKED'
);
must(Boolean(process.env.CLOUDFLARE_API_TOKEN), 'CLOUDFLARE_API_TOKEN_NOT_AVAILABLE');
must(Boolean(process.env.CLOUDFLARE_ACCOUNT_ID), 'CLOUDFLARE_ACCOUNT_ID_NOT_AVAILABLE');

const provision = {
  name: WORKER,
  main: 'src/cloudflare/worker.ts',
  compatibility_date: '2026-09-18',
  compatibility_flags: ['nodejs_compat']
};
writeFileSync(PROVISION, JSON.stringify(provision));
let dbId;
try {
  dbId = getDatabaseId();
  report('Candidate D1 already exists (no production database selected).');
} catch (error) {
  // If credentials are invalid or D1 list is inaccessible, do NOT try a create as fallback.
  const list = parseWranglerJson(cli(['d1','list','--json','--config',PROVISION]));
  must(Array.isArray(list), 'D1_LIST_INVALID');
  const existing = list.find(row => row && row.name === DB_NAME);
  if (existing) {
    dbId = findUuid(existing);
    must(Boolean(dbId), 'EXISTING_CANDIDATE_D1_ID_UNKNOWN');
  } else {
    report('Creating new isolated candidate D1.');
    cli(['d1','create',DB_NAME,'--location','weur','--config',PROVISION], {timeout:120_000});
    dbId = getDatabaseId();
  }
}
must(Boolean(dbId), 'CANDIDATE_D1_UNAVAILABLE');

const candidateBotToken = process.env.RAT_CANDIDATE_BOT_TOKEN?.trim() ?? '';
const allowedUserId = process.env.RAT_CANDIDATE_ALLOWED_USER_ID?.trim() ?? '';
// Without a verified separate test bot and explicit tester ID, there is NO Telegram webhook.
let candidateBot = false;
if (candidateBotToken && /^\d{4,16}$/.test(allowedUserId)) {
  const res = await fetch('https://api.telegram.org/bot' + candidateBotToken + '/getMe', {
    signal: AbortSignal.timeout(15_000)
  }).catch(() => null);
  const parsed = res?.ok ? await res.json().catch(() => null) : null;
  const username = String(parsed?.result?.username ?? '').toLowerCase();
  must(parsed?.ok === true && parsed.result?.is_bot === true, 'TEST_BOT_IDENTITY_UNVERIFIED');
  must(username !== 'binratbot' && /(test|sandbox|candidate)/.test(username),
    'REFUSE_TO_REPOINT_PRODUCTION_BOT');
  candidateBot = true;
}
if (candidateBotToken && !candidateBot) {
  report('Candidate bot secret exists but valid tester ID is absent: Telegram stays DISABLED.');
}

const cfg = {
  name: WORKER,
  main: 'src/cloudflare/worker.ts',
  compatibility_date: '2026-09-18',
  compatibility_flags: ['nodejs_compat'],
  workers_dev: true,
  ai: { binding: 'AI' },
  d1_databases: [{ binding: 'DB', database_name: DB_NAME, database_id: dbId }],
  vars: {
    TELEGRAM_REPLIES_ENABLED: candidateBot ? 'true' : 'false',
    RAT_CONVERSATION_ENABLED: 'true',
    RAT_AI_ENABLED: 'false',
    RAT_CANDIDATE_SMOKE_ENABLED: 'true',
    BINRAT_HOLDER_WALLET_AUTH_ENABLED: 'false',
    BINRAT_HOLDER_GATE_ENABLED: 'false',
    ...(candidateBot ? { RAT_CANDIDATE_ALLOWED_USER_ID: allowedUserId } : {})
  }
};
must(cfg.name !== 'binrat-edge-v0' && cfg.d1_databases[0].database_name !== 'binrat-v0',
  'PRODUCTION_TARGET_NOT_ALLOWED');
must(!('queues' in cfg) && !('triggers' in cfg) && !('assets' in cfg),
  'UNEXPECTED_BACKGROUND_PRODUCTION_SIDE_EFFECT');
writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));

report('Applying schema to isolated candidate D1 only.');
cli(['d1','execute','DB','--remote','--yes','--file','cloudflare/schema.sql',
  '--config',CONFIG], {timeout:120_000});
report('Deploying candidate Worker (no queues, crons, assets or production bindings).');
const deploy = cli(['deploy','--config',CONFIG], {timeout:180_000});
const urls = deploy.match(/https:\/\/[a-z0-9.-]+\.workers\.dev/ig) ?? [];
const workerUrl = urls.find(url => new URL(url).hostname.startsWith(WORKER + '.'));
must(Boolean(workerUrl), 'CANDIDATE_DEPLOYED_BUT_URL_UNVERIFIED');
report('Candidate Worker: ' + workerUrl);

cli(['secret','put','CAPABILITY_MANIFEST_JSON','--config',CONFIG], {
  input: JSON.stringify(manifest) + '\n'
});
const smokeSecret = randomBytes(32).toString('hex');
cli(['secret','put','RAT_CANDIDATE_SMOKE_SECRET','--config',CONFIG], {
  input: smokeSecret + '\n'
});
if (candidateBot) {
  cli(['secret','put','TELEGRAM_BOT_TOKEN','--config',CONFIG], {
    input: candidateBotToken + '\n'
  });
  const webhookSecret = randomBytes(32).toString('hex');
  cli(['secret','put','TELEGRAM_WEBHOOK_SECRET','--config',CONFIG], {
    input: webhookSecret + '\n'
  });
  const register = await fetch('https://api.telegram.org/bot' + candidateBotToken + '/setWebhook', {
    method: 'POST', headers: {'content-type':'application/json'},
    body: JSON.stringify({
      url: workerUrl + '/telegram/webhook', secret_token: webhookSecret,
      drop_pending_updates: true, allowed_updates: ['message']
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const body = await register.json().catch(() => null);
  must(register.ok && body?.ok === true, 'CANDIDATE_WEBHOOK_REGISTRATION_FAILED');
  report('Private candidate Telegram webhook enabled only for the configured tester ID. AI replies OFF.');
} else {
  report('Private Telegram test: BLOCKED_NO_SEPARATE_TEST_BOT_OR_TESTER_ID.');
}

const healthResponse = await fetch(workerUrl + '/health', {
  signal: AbortSignal.timeout(20_000)
});
const health = await healthResponse.json();
must(healthResponse.ok && health.service === 'binrat-cloudflare-edge',
  'CANDIDATE_HTTP_HEALTH_FAILED');
must(health.repliesEnabled === candidateBot, 'CANDIDATE_TELEGRAM_FLAG_MISMATCH');
const blocked = await fetch(workerUrl + '/__candidate/rat-smoke', {
  method: 'POST', signal: AbortSignal.timeout(20_000)
});
must(blocked.status === 401, 'PRIVATE_SMOKE_AUTH_NOT_ENFORCED');
report('Candidate health + unauthenticated inference denial: PASS.');

if (process.env.RAT_RUN_AI_SMOKE === 'true') {
  // Only enable after confirming unused account-wide free daily allocation.
  report('Starting ONE fixed-input Workers AI request, daily D1 one-shot gate enforced.');
  const check = await fetch(workerUrl + '/__candidate/rat-smoke', {
    method: 'POST', headers: {'x-binrat-candidate-secret': smokeSecret},
    signal: AbortSignal.timeout(60_000)
  });
  const data = await check.json().catch(() => ({}));
  must(check.ok, 'CANDIDATE_MODEL_SMOKE_FAILED_HTTP_' + check.status);
  report('Model accepted one-shot smoke: ' + Boolean(data.modelReturnedValidBanter));
  report('Provider-reported tokens: ' + JSON.stringify(data.reportedTokenUsage ?? null));
  report('Estimated neurons from reported tokens: ' +
    String(data.estimatedNeuronsFromReportedTokens ?? 'UNAVAILABLE'));
  report('Account-billed neurons: NOT VERIFIED; check Cloudflare Workers AI dashboard.');
} else {
  report('Live AI smoke: SKIPPED (RAT_RUN_AI_SMOKE not explicitly enabled after free-budget verification).');
}
report('ROLLBACK: no production changes. Set candidate flags false or delete only ' + WORKER +
  ' and ' + DB_NAME + ' once testing is finished.');
