#!/usr/bin/env node
// Manual-only, zero-traffic Version URL preparation and verification. The only
// remote write this harness supports is Wrangler's `versions upload`, invoked
// by the workflow after all local gates. It never deploys or promotes traffic.
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  FUNDING_SCHEMA_SQL, activeVersionId, caseBundleErrors, exactReleaseErrors,
  fundingSchemaErrors, isReadOnlySql, ponsHealthErrors, previewBindingErrors
} from './case-private-preview-verify.mjs';

export const WORKER = 'binrat-edge-v0';
export const ARTIFACTS = '.artifacts';
export const CANDIDATE_CONFIG = `${ARTIFACTS}/case-version-url-candidate.jsonc`;
export const PRE_UPLOAD_RECEIPT = `${ARTIFACTS}/case-version-url-production-before.json`;
export const UPLOAD_RECEIPT = `${ARTIFACTS}/case-version-url-upload.json`;
export const FINAL_RECEIPT = `${ARTIFACTS}/case-version-url-preview-receipt.json`;
const TEMPLATE = 'cloudflare/wrangler.example.jsonc';
const SAFE_FALSE_FLAGS = Object.freeze([
  'BINRAT_AUTONOMOUS_RAT_ENABLED',
  'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED',
  'BINRAT_TELEGRAM_UI_V2_ENABLED',
  'BINRAT_TELEGRAM_MEDIA_ENABLED'
]);

export function parseJsonc(source) {
  return JSON.parse(source.replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'));
}

export function versionUrlErrors(value, worker = WORKER) {
  try {
    const url = new URL(value);
    const escaped = worker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        url.pathname !== '/' || url.search || url.hash ||
        !/\.workers\.dev$/i.test(url.hostname) ||
        !new RegExp(`^[a-z0-9-]+-${escaped}\\.[a-z0-9-]+\\.workers\\.dev$`, 'i').test(url.hostname)) {
      return ['VERSION_URL_INVALID'];
    }
    if (url.hostname.toLowerCase() === `${worker}.pettevik.workers.dev`) return ['VERSION_URL_IS_PRODUCTION'];
    return [];
  } catch {
    return ['VERSION_URL_INVALID'];
  }
}

/** Parse only the documented machine-readable Wrangler `version-upload` record. */
export function parseVersionUploadReceipt(ndjson, worker = WORKER) {
  const records = String(ndjson).split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`VERSION_UPLOAD_RECEIPT_JSON_INVALID:${index + 1}`); }
  });
  const uploads = records.filter(record => record?.type === 'version-upload');
  if (uploads.length !== 1) throw new Error('VERSION_UPLOAD_RECEIPT_AMBIGUOUS');
  const upload = uploads[0];
  if (upload.worker_name !== worker) throw new Error('VERSION_UPLOAD_WORKER_MISMATCH');
  const ids = [...new Set([upload.version_id, upload.versionId].filter(uuid))];
  if (ids.length !== 1) throw new Error('VERSION_UPLOAD_ID_MISSING_OR_AMBIGUOUS');
  const urls = [...new Set([
    ...(Array.isArray(upload.preview_urls) ? upload.preview_urls : []),
    ...(Array.isArray(upload.version_urls) ? upload.version_urls : [])
  ].filter(value => typeof value === 'string'))];
  if (urls.length !== 1) throw new Error('VERSION_UPLOAD_URL_MISSING_OR_AMBIGUOUS');
  const urlErrors = versionUrlErrors(urls[0], worker);
  if (urlErrors.length) throw new Error(urlErrors.join(','));
  return { candidateVersionId: ids[0], versionUrl: urls[0] };
}

/** Build a candidate config from checked-in shape and active production authority. */
export function prepareCandidateConfig(template, activeVersion, releaseSha) {
  const errors = exactReleaseErrors(releaseSha, releaseSha);
  if (errors.length) throw new Error(errors.join(','));
  const config = structuredClone(template);
  // Wrangler resolves filesystem paths relative to --config. The checked-in
  // template is root-relative, while this generated config lives in .artifacts.
  config.main = artifactRelativePath(config.main, 'CANDIDATE_TEMPLATE_MAIN_INVALID');
  if (config.assets?.directory !== undefined) {
    config.assets.directory = artifactRelativePath(config.assets.directory, 'CANDIDATE_TEMPLATE_ASSETS_INVALID');
  }
  const bindings = bindingMap(activeVersion);
  const db = bindings.get('DB');
  const queue = bindings.get('SYNC_QUEUE');
  const ai = bindings.get('AI');
  const dbId = databaseId(db);
  const queueName = queue?.queue_name;
  if (db?.type !== 'd1' || !dbId) throw new Error('ACTIVE_D1_BINDING_MISSING');
  if (queue?.type !== 'queue' || typeof queueName !== 'string' || !queueName) throw new Error('ACTIVE_QUEUE_BINDING_MISSING');
  if (ai?.type !== 'ai') throw new Error('ACTIVE_AI_BINDING_MISSING');
  const publicSite = bindings.get('BINRAT_PUBLIC_SITE_URL');
  if (config.vars?.BINRAT_PUBLIC_SITE_URL !== undefined &&
      (publicSite?.type !== 'plain_text' || typeof publicSite.text !== 'string' || !publicSite.text)) {
    throw new Error('ACTIVE_PUBLIC_SITE_VALUE_MISSING');
  }
  if (!Array.isArray(config.d1_databases) || config.d1_databases.length !== 1 ||
      !Array.isArray(config.queues?.producers) || config.queues.producers.length !== 1 ||
      !Array.isArray(config.queues?.consumers) || config.queues.consumers.length !== 1) {
    throw new Error('CANDIDATE_TEMPLATE_SHAPE_INVALID');
  }
  config.d1_databases[0].database_id = dbId;
  if (typeof db.database_name === 'string' && db.database_name) config.d1_databases[0].database_name = db.database_name;
  config.queues.producers[0].queue = queueName;
  config.queues.consumers[0].queue = queueName;
  const productionVars = Object.fromEntries([...bindings.values()]
    .filter(binding => binding.type === 'plain_text' && typeof binding.text === 'string')
    .map(binding => [binding.name, binding.text]));
  config.vars = productionVars;
  config.vars.BINRAT_RELEASE_SHA = releaseSha;
  for (const name of SAFE_FALSE_FLAGS) config.vars[name] = 'false';
  if (bindings.has('BINRAT_PONS_FUNDING_ENABLED')) config.vars.BINRAT_PONS_FUNDING_ENABLED = 'false';
  return config;
}

function artifactRelativePath(value, error) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.split('/').includes('..')) {
    throw new Error(error);
  }
  return `../${value.replace(/^\.\//, '')}`;
}

function uuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function databaseId(binding) {
  const value = binding?.id ?? binding?.database_id;
  return uuid(value) ? value : null;
}
function bindingMap(version) {
  const containers = [];
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value?.resources?.bindings)) containers.push(value.resources.bindings);
    for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child);
  };
  visit(version);
  if (containers.length !== 1) throw new Error('VERSION_BINDINGS_AMBIGUOUS');
  const map = new Map();
  for (const binding of containers[0]) {
    if (!binding?.name || !binding?.type || map.has(binding.name)) throw new Error('ACTIVE_BINDING_INVALID');
    map.set(binding.name, binding);
  }
  return map;
}
function gate(errors) { if (errors.length) throw new Error(errors.join(',')); }
function ensureArtifacts() { mkdirSync(ARTIFACTS, { recursive: true }); }
function writeArtifact(path, value) { ensureArtifacts(); writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`); }
function readArtifact(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function cli(args) {
  return execFileSync('pnpm', ['dlx', 'wrangler@4.135.0', ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000,
    env: { ...process.env, WRANGLER_LOG: 'none' }
  }).trim();
}
function jsonCli(args) {
  try { return JSON.parse(cli(args)); } catch { throw new Error('WRANGLER_JSON_INVALID'); }
}
function assertExactCheckout(releaseSha) {
  const checkout = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  gate(exactReleaseErrors(releaseSha, checkout));
}
function activeProductionVersion() {
  const versions = new Set();
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    const id = value.version_id ?? value.versionId;
    const traffic = value.percentage ?? value.percent ?? value.traffic;
    if (uuid(id) && (traffic === 100 || traffic === '100' || traffic === 1 || traffic === '1')) versions.add(id);
    for (const child of Array.isArray(value) ? value : Object.values(value)) visit(child);
  };
  visit(jsonCli(['deployments', 'status', '--name', WORKER, '--json']));
  if (versions.size !== 1) throw new Error('ACTIVE_VERSION_NOT_RESOLVED_OR_AMBIGUOUS');
  return [...versions][0];
}
function version(id) {
  if (!uuid(id)) throw new Error('VERSION_ID_INVALID');
  return jsonCli(['versions', 'view', id, '--name', WORKER, '--json']);
}
function candidateParity(active, candidate, config) {
  const configPath = CANDIDATE_CONFIG;
  execFileSync('pnpm', [
    'verify:production-binding-parity', '--', '--worker', WORKER,
    '--active-version', active, '--candidate-version', candidate,
    '--config', configPath, '--private-preview'
  ], { stdio: 'inherit', timeout: 120_000, env: process.env });
  return { ok: true, config: configPath };
}
function fundingSchema(versionJson) {
  if (!isReadOnlySql(FUNDING_SCHEMA_SQL)) throw new Error('FUNDING_SCHEMA_QUERY_NOT_READ_ONLY');
  const id = databaseId(bindingMap(versionJson).get('DB'));
  if (!id) throw new Error('VERSION_D1_BINDING_MISSING');
  const config = `${ARTIFACTS}/case-version-url-readonly-d1.jsonc`;
  writeFileSync(config, `${JSON.stringify({
    name: 'binrat-case-version-url-readonly', main: '../src/cloudflare/worker.ts',
    compatibility_date: '2026-09-18', d1_databases: [{ binding: 'DB', database_name: 'binrat-v0', database_id: id }]
  }, null, 2)}\n`);
  return jsonCli(['d1', 'execute', 'DB', '--remote', '--yes', '--json', '--command', FUNDING_SCHEMA_SQL, '--config', config]);
}
async function getJson(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  return { response, body: await response.json().catch(() => null) };
}
function signedInitData(token, tester) {
  if (!/^[1-9]\d{3,16}$/.test(tester)) throw new Error('TESTER_ID_INVALID');
  if (!token) throw new Error('TELEGRAM_TOKEN_MISSING');
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'binrat-version-url-preview', user: JSON.stringify({ id: Number(tester), first_name: 'BINRAT Version URL preview' }) };
  const check = Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  return new URLSearchParams({ ...fields, hash: createHmac('sha256', secret).update(check).digest('hex') }).toString();
}
async function httpSmoke(versionUrl, releaseSha, tester) {
  const at = path => new URL(path, versionUrl).href;
  const health = await getJson(at('/health'));
  if (!health.response.ok || health.body?.ok !== true || health.body?.releaseSha !== releaseSha) throw new Error('VERSION_URL_RELEASE_SHA_MISMATCH');
  if (health.body.autonomousRatEnabled !== false || health.body.autonomousRatPublicEnabled !== false ||
      health.body.telegramUiV2Enabled !== false || health.body.telegramMediaEnabled !== false) throw new Error('VERSION_URL_PREVIEW_FLAGS_NOT_OFF');
  const pons = await getJson(at('/api/health'));
  if (!pons.response.ok) throw new Error('PONS_HEALTH_REQUEST_FAILED');
  gate(ponsHealthErrors(pons.body));
  const latest = await getJson(at('/api/launches/latest'));
  if (!latest.response.ok || latest.body?.chainId !== 4663 || !Array.isArray(latest.body?.launches)) throw new Error('PUBLIC_LATEST_LAUNCHES_SMOKE_FAILED');
  const app = await fetch(at('/app/app.js'), { signal: AbortSignal.timeout(20_000) });
  const appText = await app.text();
  if (!app.ok || !appText.includes('/api/miniapp/case-intelligence') || appText.includes('/api/miniapp/trash-trail') || appText.includes('/api/miniapp/replay')) throw new Error('MINI_APP_SINGLE_CASE_ENDPOINT_REGRESSION');
  const initData = signedInitData(process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '', tester);
  const bootstrap = await getJson(at('/api/miniapp/bootstrap'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData }) });
  const candidates = Array.isArray(bootstrap.body?.latestLaunches) ? bootstrap.body.latestLaunches.filter(item => /^[0-9a-f]{64}$/i.test(item?.launchId ?? '')).slice(0, 10) : [];
  if (!bootstrap.response.ok || !candidates.length) throw new Error('MINI_APP_BOOTSTRAP_FAILED');
  let bundle; let launchId;
  for (const candidate of candidates) {
    const attempt = await getJson(at('/api/miniapp/case-intelligence'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData, launchId: candidate.launchId }) });
    if (attempt.response.ok) { bundle = attempt.body; launchId = candidate.launchId; break; }
  }
  if (!bundle || !launchId) throw new Error('CASE_INTELLIGENCE_FAILED_ALL_CANDIDATES');
  gate(caseBundleErrors(bundle, launchId));
  return { ok: true, launchId, asOfBlock: bundle.case.asOfBlock };
}
function safeError(error) { return String(error?.message ?? 'VERSION_URL_PREVIEW_FAILED').split(/[\n\r]/)[0].slice(0, 200); }

async function prepareConfig(args) {
  const [releaseSha] = args;
  assertExactCheckout(releaseSha);
  const activeVersion = activeProductionVersion();
  const config = prepareCandidateConfig(parseJsonc(readFileSync(TEMPLATE, 'utf8')), version(activeVersion), releaseSha);
  ensureArtifacts();
  writeFileSync(CANDIDATE_CONFIG, `${JSON.stringify(config, null, 2)}\n`);
  writeArtifact(`${ARTIFACTS}/case-version-url-config-prepared.json`, { expectedReleaseSha: releaseSha, sourceActiveProductionVersion: activeVersion, worker: WORKER, productionTrafficChanged: false });
  console.log(JSON.stringify({ status: 'VERSION_URL_CONFIG_PREPARED', activeVersion }));
}
async function snapshotProduction(args) {
  const [releaseSha] = args;
  assertExactCheckout(releaseSha);
  const activeVersion = activeProductionVersion();
  if (!readFileSync(CANDIDATE_CONFIG, 'utf8')) throw new Error('CANDIDATE_CONFIG_MISSING');
  writeArtifact(PRE_UPLOAD_RECEIPT, { expectedReleaseSha: releaseSha, preUploadActiveProductionVersion: activeVersion, worker: WORKER, productionTrafficChanged: false });
  console.log(JSON.stringify({ status: 'VERSION_URL_PRODUCTION_SNAPSHOTTED', activeVersion }));
}
async function captureUpload(args) {
  const [releaseSha] = args;
  assertExactCheckout(releaseSha);
  const before = readArtifact(PRE_UPLOAD_RECEIPT);
  try {
    const parsed = parseVersionUploadReceipt(readFileSync(`${ARTIFACTS}/wrangler-version-upload.ndjson`, 'utf8'));
    if (parsed.candidateVersionId === before.preUploadActiveProductionVersion) throw new Error('CANDIDATE_IS_ACTIVE_VERSION');
    writeArtifact(UPLOAD_RECEIPT, { expectedReleaseSha: releaseSha, preUploadActiveProductionVersion: before.preUploadActiveProductionVersion, ...parsed, productionTrafficChanged: false });
    console.log(JSON.stringify({ status: 'VERSION_URL_UPLOAD_CAPTURED', ...parsed }));
  } catch (error) {
    writeArtifact(`${ARTIFACTS}/case-version-url-upload-parse-failure.json`, { expectedReleaseSha: releaseSha, preUploadActiveProductionVersion: before.preUploadActiveProductionVersion, error: safeError(error), productionTrafficChanged: false });
    throw error;
  }
}
async function versionSmoke(args) {
  const [releaseSha, tester] = args;
  assertExactCheckout(releaseSha);
  const before = readArtifact(PRE_UPLOAD_RECEIPT);
  const uploaded = readArtifact(UPLOAD_RECEIPT);
  const receipt = { expectedReleaseSha: releaseSha, preUploadActiveProductionVersion: before.preUploadActiveProductionVersion, uploadedCandidateVersionId: uploaded.candidateVersionId, versionUrl: uploaded.versionUrl, candidateBindingVerification: { ok: false }, fundingSchema: { ok: false, errors: [] }, smokeResult: { ok: false }, postSmokeActiveProductionVersion: null, productionTrafficChanged: false };
  try {
    if (uploaded.expectedReleaseSha !== releaseSha || uploaded.preUploadActiveProductionVersion !== before.preUploadActiveProductionVersion) throw new Error('UPLOAD_RECEIPT_RELEASE_OR_PRODUCTION_MISMATCH');
    gate(versionUrlErrors(uploaded.versionUrl));
    const beforeSmoke = activeProductionVersion();
    if (beforeSmoke !== before.preUploadActiveProductionVersion) throw new Error('ACTIVE_VERSION_CHANGED_BEFORE_SMOKE');
    if (uploaded.candidateVersionId === beforeSmoke) throw new Error('CANDIDATE_BECAME_ACTIVE');
    const candidate = version(uploaded.candidateVersionId);
    gate(previewBindingErrors(candidate, releaseSha));
    receipt.candidateBindingVerification = candidateParity(beforeSmoke, uploaded.candidateVersionId, CANDIDATE_CONFIG);
    const schema = fundingSchema(candidate);
    const schemaErrors = fundingSchemaErrors(schema);
    receipt.fundingSchema = { ok: schemaErrors.length === 0, errors: schemaErrors };
    gate(schemaErrors);
    receipt.smokeResult = await httpSmoke(uploaded.versionUrl, releaseSha, tester);
    const afterSmoke = activeProductionVersion();
    receipt.postSmokeActiveProductionVersion = afterSmoke;
    receipt.productionTrafficChanged = afterSmoke !== before.preUploadActiveProductionVersion;
    if (receipt.productionTrafficChanged) throw new Error('ACTIVE_VERSION_CHANGED_DURING_SMOKE');
    if (uploaded.candidateVersionId === afterSmoke) throw new Error('CANDIDATE_BECAME_ACTIVE');
    writeArtifact(FINAL_RECEIPT, receipt);
    console.log(JSON.stringify({ status: 'VERSION_URL_PRIVATE_PREVIEW_PASS', ...receipt }));
  } catch (error) {
    try {
      const afterFailure = activeProductionVersion();
      receipt.postSmokeActiveProductionVersion = afterFailure;
      receipt.productionTrafficChanged = afterFailure !== before.preUploadActiveProductionVersion;
    } catch { receipt.postSmokeActiveProductionVersion = 'UNRESOLVED'; }
    receipt.smokeResult = { ok: false, error: safeError(error) };
    writeArtifact(FINAL_RECEIPT, receipt);
    throw error;
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'prepare-config') return prepareConfig(args);
  if (command === 'snapshot-production') return snapshotProduction(args);
  if (command === 'capture-upload') return captureUpload(args);
  if (command === 'version-smoke') return versionSmoke(args);
  throw new Error('USAGE: case-version-url-preview.mjs <prepare-config|snapshot-production|capture-upload|version-smoke> ...');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
}
