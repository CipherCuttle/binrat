#!/usr/bin/env node
// Read-only proof harness for the canonical Case private preview. It never
// uploads, deploys, promotes, migrates, configures Telegram, or sends a queue
// message. Release activation remains an owner-controlled operation elsewhere.
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKER = 'binrat-edge-v0';
const WRANGLER = ['dlx', 'wrangler@4.135.0'];
const FUNDING_TABLES = Object.freeze([
  'pons_funding_receipts',
  'pons_funding_scan_state',
  'pons_funding_retry_state'
]);
export const FUNDING_SCHEMA_SQL = `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${FUNDING_TABLES.map(name => `'${name}'`).join(',')}) ORDER BY name`;

export function exactSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);
}

export function exactReleaseErrors(expected, actual) {
  const errors = [];
  if (!exactSha(expected)) errors.push('RELEASE_SHA_INVALID');
  if (!exactSha(actual)) errors.push('CHECKOUT_SHA_INVALID');
  if (!errors.length && expected.toLowerCase() !== actual.toLowerCase()) errors.push('RELEASE_SHA_MISMATCH');
  return errors;
}

export function activeVersionId(status) {
  return walk(status, value => {
    const id = value?.version_id ?? value?.versionId;
    const traffic = value?.percentage ?? value?.percent ?? value?.traffic;
    return typeof id === 'string' && uuid(id) && (traffic === 100 || traffic === '100' || traffic === 1 || traffic === '1')
      ? id : null;
  });
}

export function versionBinding(version, name) {
  return walk(version, value => value?.name === name && typeof value?.type === 'string' ? value : null);
}

export function previewBindingErrors(version, releaseSha) {
  const errors = [];
  const requiredFalse = [
    'BINRAT_AUTONOMOUS_RAT_ENABLED',
    'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED',
    'BINRAT_TELEGRAM_UI_V2_ENABLED',
    'BINRAT_TELEGRAM_MEDIA_ENABLED'
  ];
  for (const name of requiredFalse) {
    const binding = versionBinding(version, name);
    if (binding?.type !== 'plain_text' || binding.text !== 'false') errors.push(`PREVIEW_FLAG_NOT_OFF:${name}`);
  }
  const funding = versionBinding(version, 'BINRAT_PONS_FUNDING_ENABLED');
  if (funding && (funding.type !== 'plain_text' || funding.text !== 'false')) {
    errors.push('PONS_FUNDING_CYCLE_NOT_OFF');
  }
  const release = versionBinding(version, 'BINRAT_RELEASE_SHA');
  if (release?.type !== 'plain_text' || release.text !== releaseSha) errors.push('VERSION_RELEASE_SHA_MISMATCH');
  const db = versionBinding(version, 'DB');
  if (db?.type !== 'd1' || !databaseId(db)) errors.push('VERSION_D1_BINDING_MISSING');
  return errors;
}

export function isReadOnlySql(sql) {
  const normalized = typeof sql === 'string' ? sql.trim().replace(/\s+/g, ' ') : '';
  return /^SELECT\b/i.test(normalized) && !/;|\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|VACUUM|PRAGMA|ATTACH|DETACH)\b/i.test(normalized);
}

export function fundingSchemaErrors(result) {
  const found = new Set();
  walkAll(result, value => {
    if (typeof value?.name === 'string' && FUNDING_TABLES.includes(value.name)) found.add(value.name);
  });
  return FUNDING_TABLES.filter(name => !found.has(name)).map(name => `FUNDING_SCHEMA_MISSING:${name}`);
}

export function ponsHealthErrors(health) {
  const errors = [];
  if (health?.ok !== true) errors.push('PONS_HEALTH_NOT_OK');
  if (health?.chainId !== 4663) errors.push('PONS_CHAIN_ID_INVALID');
  if (health?.indexReady !== true || health?.liveCaughtUp !== true || health?.runtimeFresh !== true) {
    errors.push('PONS_NOT_CANONICAL_READY');
  }
  if (health?.lastSyncError !== null) errors.push('PONS_SYNC_ERROR_PRESENT');
  return errors;
}

export function caseBundleErrors(body, launchId) {
  const errors = [];
  const expected = typeof launchId === 'string' ? launchId.toLowerCase() : '';
  const current = body?.case?.current?.launchId?.toLowerCase();
  const asOf = body?.case?.asOfBlock;
  if (body?.case?.caseVersion !== 'BINRAT_CASE_MODEL_V1') errors.push('CASE_VERSION_INVALID');
  if (current !== expected) errors.push('CASE_TARGET_MISMATCH');
  if (typeof asOf !== 'string' || !/^(0|[1-9]\d*)$/.test(asOf)) errors.push('CASE_AS_OF_INVALID');
  if (body?.trashTrail?.presentationVersion !== 'BINRAT_PONS_TRASH_TRAIL_PRESENTATION_V1') errors.push('TRASH_TRAIL_VERSION_INVALID');
  if (!Array.isArray(body?.trashTrail?.launches)) errors.push('TRASH_TRAIL_LAUNCHES_INVALID');
  if (body?.replay?.replayVersion !== 'BINRAT_PONS_REPLAY_LAB_V1') errors.push('REPLAY_VERSION_INVALID');
  if (body?.replay?.semantics !== 'KNOWABLE_AS_OF_BLOCK') errors.push('REPLAY_SEMANTICS_INVALID');
  if (body?.replay?.targetLaunchKnown !== true || body?.replay?.targetLaunch?.launchId?.toLowerCase() !== expected) {
    errors.push('REPLAY_TARGET_MISMATCH');
  }
  if (body?.replay?.asOfBlock !== asOf) errors.push('REPLAY_AS_OF_MISMATCH');
  if (!Array.isArray(body?.replay?.previousLaunches)) errors.push('REPLAY_PREVIOUS_INVALID');
  for (const handoff of body?.case?.handoffs ?? []) {
    if (handoff?.targetLaunchId?.toLowerCase() !== expected) errors.push('CASE_HANDOFF_TARGET_MISMATCH');
  }
  return errors;
}

function uuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function databaseId(binding) {
  const id = binding.id ?? binding.database_id;
  return typeof id === 'string' && uuid(id) ? id : null;
}

function walk(value, visit) {
  if (!value || typeof value !== 'object') return null;
  const direct = visit(value);
  if (direct) return direct;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const nested = walk(child, visit);
    if (nested) return nested;
  }
  return null;
}

function walkAll(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const child of Array.isArray(value) ? value : Object.values(value)) walkAll(child, visit);
}

function gate(errors) {
  if (errors.length) throw new Error(errors.join(','));
}

function cli(args) {
  return execFileSync('pnpm', [...WRANGLER, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000, env: process.env
  }).trim();
}

function jsonCli(args) {
  const output = cli(args);
  const start = [output.indexOf('{'), output.indexOf('[')].filter(index => index >= 0);
  if (!start.length) throw new Error('WRANGLER_JSON_MISSING');
  return JSON.parse(output.slice(Math.min(...start)));
}

function version(id) {
  return jsonCli(['versions', 'view', id, '--name', WORKER, '--json']);
}

function writeReadOnlyD1Config(id) {
  mkdirSync('.artifacts', { recursive: true });
  const path = '.artifacts/case-private-preview-readonly-d1.jsonc';
  writeFileSync(path, JSON.stringify({
    name: 'binrat-case-private-preview-readonly',
    main: 'src/cloudflare/worker.ts',
    compatibility_date: '2026-09-18',
    d1_databases: [{ binding: 'DB', database_name: 'binrat-v0', database_id: id }]
  }, null, 2));
  return path;
}

function fundingSchema(versionJson) {
  if (!isReadOnlySql(FUNDING_SCHEMA_SQL)) throw new Error('FUNDING_SCHEMA_QUERY_NOT_READ_ONLY');
  const id = databaseId(versionBinding(versionJson, 'DB'));
  if (!id) throw new Error('VERSION_D1_BINDING_MISSING');
  const config = writeReadOnlyD1Config(id);
  return jsonCli(['d1', 'execute', 'DB', '--remote', '--yes', '--json', '--command', FUNDING_SCHEMA_SQL, '--config', config]);
}

function assertExactCheckout(expected) {
  const checkout = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  gate(exactReleaseErrors(expected, checkout));
}

function productionBindingParity(active, candidate) {
  execFileSync('pnpm', [
    'verify:production-binding-parity', '--', '--worker', WORKER,
    '--active-version', active, '--candidate-version', candidate,
    '--config', 'cloudflare/wrangler.example.jsonc'
  ], { stdio: 'inherit', env: process.env });
}

async function getJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  return { response, body: await response.json().catch(() => null) };
}

function signedInitData(token, tester) {
  if (!/^[1-9]\d{3,16}$/.test(tester)) throw new Error('TESTER_ID_INVALID');
  if (!token) throw new Error('TELEGRAM_TOKEN_MISSING');
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'binrat-canonical-case-private-preview',
    user: JSON.stringify({ id: Number(tester), first_name: 'BINRAT Case preview' })
  };
  const check = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(check).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

async function preflight(args) {
  const [releaseSha, candidateVersion] = args;
  assertExactCheckout(releaseSha);
  if (!uuid(candidateVersion ?? '')) throw new Error('CANDIDATE_VERSION_INVALID');
  const active = activeVersionId(jsonCli(['deployments', 'status', '--name', WORKER, '--json']));
  if (!active) throw new Error('ACTIVE_VERSION_NOT_RESOLVED');
  const candidate = version(candidateVersion);
  gate(previewBindingErrors(candidate, releaseSha));
  productionBindingParity(active, candidateVersion);
  gate(fundingSchemaErrors(fundingSchema(candidate)));
  console.log(JSON.stringify({
    status: 'CASE_PRIVATE_PREVIEW_PREFLIGHT_PASS', releaseSha, activeVersion: active, candidateVersion,
    fundingCycle: 'OFF', operations: 'READ_ONLY'
  }));
}

async function liveSmoke(args) {
  const [releaseSha, expectedVersion, workerUrl, tester] = args;
  assertExactCheckout(releaseSha);
  if (!uuid(expectedVersion ?? '')) throw new Error('EXPECTED_VERSION_INVALID');
  if (!/^https:\/\//.test(workerUrl ?? '')) throw new Error('WORKER_URL_INVALID');
  const active = activeVersionId(jsonCli(['deployments', 'status', '--name', WORKER, '--json']));
  if (active !== expectedVersion) throw new Error('ACTIVE_VERSION_MISMATCH');
  const deployed = version(expectedVersion);
  gate(previewBindingErrors(deployed, releaseSha));
  gate(fundingSchemaErrors(fundingSchema(deployed)));

  const health = await getJson(`${workerUrl}/health`);
  if (!health.response.ok || health.body?.ok !== true || health.body?.releaseSha !== releaseSha) {
    throw new Error('LIVE_RELEASE_SHA_MISMATCH');
  }
  if (health.body.autonomousRatEnabled !== false || health.body.autonomousRatPublicEnabled !== false ||
      health.body.telegramUiV2Enabled !== false || health.body.telegramMediaEnabled !== false) {
    throw new Error('LIVE_PREVIEW_FLAGS_NOT_OFF');
  }
  const pons = await getJson(`${workerUrl}/api/health`);
  if (!pons.response.ok) throw new Error('PONS_HEALTH_REQUEST_FAILED');
  gate(ponsHealthErrors(pons.body));
  const latest = await getJson(`${workerUrl}/api/launches/latest`);
  if (!latest.response.ok || latest.body?.chainId !== 4663 || !Array.isArray(latest.body?.launches)) {
    throw new Error('PUBLIC_LATEST_LAUNCHES_SMOKE_FAILED');
  }

  const app = await fetch(`${workerUrl}/app/app.js`, { signal: AbortSignal.timeout(20_000) });
  const appText = await app.text();
  if (!app.ok || !appText.includes('/api/miniapp/case-intelligence') ||
      appText.includes('/api/miniapp/trash-trail') || appText.includes('/api/miniapp/replay')) {
    throw new Error('MINI_APP_SINGLE_CASE_ENDPOINT_REGRESSION');
  }

  const initData = signedInitData(process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '', tester ?? '');
  const bootstrap = await getJson(`${workerUrl}/api/miniapp/bootstrap`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData })
  });
  const candidates = Array.isArray(bootstrap.body?.latestLaunches)
    ? bootstrap.body.latestLaunches.filter(item => /^[0-9a-f]{64}$/i.test(item?.launchId ?? '')).slice(0, 10) : [];
  if (!bootstrap.response.ok || !candidates.length) throw new Error('MINI_APP_BOOTSTRAP_FAILED');

  let result = null;
  let launchId = null;
  for (const candidate of candidates) {
    const attempt = await getJson(`${workerUrl}/api/miniapp/case-intelligence`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData, launchId: candidate.launchId })
    });
    if (attempt.response.ok) { result = attempt.body; launchId = candidate.launchId; break; }
  }
  if (!result || !launchId) throw new Error('CASE_INTELLIGENCE_FAILED_ALL_CANDIDATES');
  gate(caseBundleErrors(result, launchId));
  console.log(JSON.stringify({
    status: 'CASE_PRIVATE_PREVIEW_LIVE_SMOKE_PASS', releaseSha, activeVersion: active,
    launchId, asOfBlock: result.case.asOfBlock, fundingCycle: 'OFF', operations: 'READ_ONLY'
  }));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'preflight') return preflight(args);
  if (command === 'live-smoke') return liveSmoke(args);
  throw new Error('USAGE: case-private-preview-verify.mjs <preflight|live-smoke> ...');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
