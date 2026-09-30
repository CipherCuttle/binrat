#!/usr/bin/env node
// Dedicated recovery for the reviewed Pons identity + catch-up throughput incident.
// This path performs no migration, Telegram mutation, or feature activation.
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { classifyPonsRecovery } from './ponsRecoveryVerdict.mjs';

const WORKER = 'binrat-edge-v0';
const DB_ID = '46814564-1a41-449a-88e5-c1349eed3a27';
const WORKER_URL = 'https://binrat-edge-v0.pettevik.workers.dev';
const PRODUCTION_SHA = 'b65cc4f51061e6d12a3f0ce84048ea910e3fde6b';
const STALLED_CHECKPOINT = 76_047_765n;
const CONFLICTING_LAUNCH = '7b403ecf591fc3d03e0de2ceec4bb78c023ed38e28c1aa1e4f56ce4d577695a1';
const CONFIRMATION = 'DEPLOY_PONS_CATCHUP_THROUGHPUT_RECOVERY';
const CONFIG = 'wrangler.pons-catchup-recovery.generated.jsonc';
const WRANGLER = ['dlx', 'wrangler@4.135.0'];
const ALLOWED_DIFF = new Set([
  'scripts/deploy-pons-catchup-recovery.mjs',
  'cloudflare/wrangler.example.jsonc',
  'src/cloudflare/deploymentBindingParity.ts',
  'src/cloudflare/syncQueue.ts',
  'src/cloudflare/d1Store.ts',
  'src/core/identity.ts',
  'src/indexer/syncLaunches.ts',
  'src/pons/ponsSource.ts',
  'scripts/ponsRecoveryVerdict.mjs',
  'test/cloudflareSyncQueue.test.ts',
  'test/d1StoreParity.test.ts',
  'test/deploymentBindingParity.test.ts',
  'test/ponsRecoveryVerdict.test.ts',
  'test/sync.test.ts'
]);
let previousVersion = null;
let promotionAttempted = false;

function note(message, detail) {
  console.log(detail === undefined ? message : `${message} ${JSON.stringify(detail)}`);
}
function gate(value, code) {
  if (!value) throw new Error(code);
}
function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30_000
  }).trim();
}
function cli(args, timeout = 180_000) {
  try {
    return execFileSync('pnpm', [...WRANGLER, ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout, env: process.env
    }).trim();
  } catch (error) {
    throw new Error(`WRANGLER_FAILED:${args.slice(0, 3).join(':')}:${error.status ?? 'UNKNOWN'}`);
  }
}
function jsonOutput(output) {
  const starts = [output.indexOf('{'), output.indexOf('[')].filter(index => index >= 0);
  gate(starts.length > 0, 'WRANGLER_JSON_MISSING');
  return JSON.parse(output.slice(Math.min(...starts)));
}
function walk(value, visitor) {
  if (!value || typeof value !== 'object') return null;
  const found = visitor(value);
  if (found !== null && found !== undefined) return found;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const nested = walk(child, visitor);
    if (nested !== null && nested !== undefined) return nested;
  }
  return null;
}
function uuid(value) {
  return typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function activeVersion(status) {
  return walk(status, value => {
    const id = value.version_id ?? value.versionId;
    const percentage = value.percentage ?? value.percent ?? value.traffic;
    return uuid(id) && (percentage === 100 || percentage === '100' || percentage === 1 || percentage === '1')
      ? id : null;
  });
}
function taggedVersion(versions, tag) {
  return walk(versions, value => {
    const id = value.version_id ?? value.versionId ?? value.id;
    const versionTag = value.tag ?? value.annotations?.['workers/tag'];
    return versionTag === tag && uuid(id) ? id : null;
  });
}
function bindings(version) {
  const list = walk(version, value => Array.isArray(value?.bindings) ? value.bindings : null);
  gate(Array.isArray(list), 'VERSION_BINDINGS_MISSING');
  return new Map(list.map(binding => [binding.name, binding]));
}
function plain(bindingMap, name) {
  const binding = bindingMap.get(name);
  return binding?.type === 'plain_text' && typeof binding.text === 'string' ? binding.text : null;
}
function parseJsonc(path) {
  return JSON.parse(readFileSync(path, 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1'));
}
function query(config, sql) {
  const result = jsonOutput(cli([
    'd1', 'execute', DB_ID, '--remote', '--yes', '--json', '--command', sql, '--config', config
  ]));
  const rows = walk(result, value => Array.isArray(value?.results) ? value.results : null);
  gate(Array.isArray(rows), 'D1_QUERY_RESULTS_MISSING');
  return rows;
}
async function getJson(path) {
  const response = await fetch(WORKER_URL + path, { signal: AbortSignal.timeout(20_000) });
  const body = await response.json().catch(() => null);
  gate(response.ok && body && typeof body === 'object', `HTTP_READ_FAILED:${path}`);
  return body;
}
function deploymentStatus() {
  return jsonOutput(cli(['deployments', 'status', '--name', WORKER, '--json']));
}
function version(id) {
  return jsonOutput(cli(['versions', 'view', id, '--name', WORKER, '--json']));
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function ponsRuntime(config) {
  const runtime = query(config, 'SELECT source_verified,live_caught_up,last_sync_error,updated_at_ms FROM binrat_runtime_state WHERE chain_id=4663 LIMIT 1;')[0];
  gate(runtime && (runtime.source_verified === 0 || runtime.source_verified === 1), 'PONS_RUNTIME_MISSING');
  return {
    sourceVerified: runtime.source_verified === 1,
    liveCaughtUp: runtime.live_caught_up === 1,
    lastSyncError: runtime.last_sync_error,
    updatedAtMs: runtime.updated_at_ms
  };
}
function requirePrivateBindings(bindingMap, expectedRelease, requireTelegramUi = false) {
  gate(plain(bindingMap, 'BINRAT_RELEASE_SHA') === expectedRelease, 'RELEASE_SHA_BINDING_MISMATCH');
  gate(plain(bindingMap, 'BINRAT_AUTONOMOUS_RAT_ENABLED') === 'false', 'AUTONOMOUS_RAT_NOT_OFF');
  gate(!requireTelegramUi || plain(bindingMap, 'BINRAT_TELEGRAM_UI_V2_ENABLED') === 'false', 'TELEGRAM_UI_V2_NOT_OFF');
  gate(plain(bindingMap, 'BINRAT_TELEGRAM_MEDIA_ENABLED') === 'false', 'TELEGRAM_MEDIA_NOT_OFF');
  gate(plain(bindingMap, 'BINRAT_HOLDER_GATE_ENABLED') === 'false', 'HOLDER_GATE_NOT_OFF');
  gate(plain(bindingMap, 'BINRAT_HOLDER_WALLET_AUTH_ENABLED') === 'false', 'HOLDER_WALLET_AUTH_NOT_OFF');
  gate(!bindingMap.has('BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED') ||
    plain(bindingMap, 'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED') === 'false', 'PUBLIC_RAT_NOT_OFF');
  gate(plain(bindingMap, 'ROBINHOOD_RPC_URL') === 'https://rpc.ordofi.network', 'RPC_AUTHORITY_DRIFT');
}

gate(process.env.PONS_RECOVERY_CONFIRMATION === CONFIRMATION, 'RECOVERY_CONFIRMATION_INVALID');
const reviewedSha = process.env.PONS_RECOVERY_REVIEWED_SHA?.trim() ?? '';
gate(/^[0-9a-f]{40}$/.test(reviewedSha), 'REVIEWED_SHA_INVALID');
gate(git(['rev-parse', 'HEAD']) === reviewedSha, 'REVIEWED_SHA_NOT_CHECKED_OUT');
gate(git(['status', '--porcelain']) === '', 'WORKTREE_NOT_CLEAN');
execFileSync('git', ['merge-base', '--is-ancestor', PRODUCTION_SHA, reviewedSha], { stdio: 'ignore' });
const changed = git(['diff', '--name-only', `${PRODUCTION_SHA}..${reviewedSha}`]).split('\n').filter(Boolean);
gate(changed.length > 0 && changed.every(path => ALLOWED_DIFF.has(path)), 'HOTFIX_SCOPE_EXCEEDED');
note('Reviewed identity + throughput SHA and bounded diff verified.', { reviewedSha, changed });

const beforeService = await getJson('/health');
const beforeHealth = await getJson('/api/health');
gate(beforeService.releaseSha === PRODUCTION_SHA, 'PRODUCTION_LINEAGE_CHANGED');
gate(beforeHealth.chainId === 4663, 'WRONG_CHAIN');
gate(beforeHealth.runtimeFresh === true, 'PONS_RUNTIME_STALE');
gate(
  beforeHealth.lastSyncError === 'SYNC_TIMEOUT_ERROR' ||
    (beforeHealth.lastSyncError === null && beforeHealth.indexReady === false && beforeHealth.liveCaughtUp === false),
  'UNEXPECTED_PREEXISTING_SYNC_ERROR'
);
gate(BigInt(beforeHealth.checkpointBlock) >= STALLED_CHECKPOINT, 'INCIDENT_CHECKPOINT_REGRESSED');

previousVersion = activeVersion(deploymentStatus());
gate(previousVersion, 'ACTIVE_VERSION_NOT_RESOLVED');
const active = version(previousVersion);
const activeBindings = bindings(active);
  requirePrivateBindings(activeBindings, PRODUCTION_SHA);
gate(activeBindings.get('DB')?.type === 'd1' &&
  (activeBindings.get('DB')?.id ?? activeBindings.get('DB')?.database_id) === DB_ID, 'D1_TARGET_CHANGED');

const cfg = parseJsonc('cloudflare/wrangler.example.jsonc');
cfg.d1_databases[0].database_id = DB_ID;
cfg.keep_vars = true;
cfg.vars = Object.fromEntries(
  [...activeBindings.values()]
    .filter(binding => binding.type === 'plain_text')
    .map(binding => [binding.name, binding.text])
);
cfg.vars.BINRAT_RELEASE_SHA = reviewedSha;
cfg.vars.BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS = '4096';
cfg.vars.BINRAT_PONS_CATCHUP_MAX_BATCHES = '4';
cfg.vars.BINRAT_PONS_CATCHUP_WORK_BUDGET_MS = '60000';
cfg.vars.BINRAT_PONS_NEAR_HEAD_BLOCKS = '2048';
cfg.vars.BINRAT_PONS_MAX_CANONICAL_LAUNCH_BLOCKS = '128';
cfg.vars.BINRAT_AUTONOMOUS_RAT_ENABLED = 'false';
cfg.vars.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED = 'false';
cfg.vars.BINRAT_TELEGRAM_UI_V2_ENABLED = 'false';
cfg.vars.BINRAT_TELEGRAM_MEDIA_ENABLED = 'false';
cfg.vars.BINRAT_HOLDER_GATE_ENABLED = 'false';
cfg.vars.BINRAT_HOLDER_WALLET_AUTH_ENABLED = 'false';
writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));

const schema = query(CONFIG, "SELECT (SELECT group_concat(name, ',') FROM pragma_table_info('launches')) AS columns, (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='binrat_invariant_guard') AS guard_count;")[0];
gate(typeof schema?.columns === 'string' && schema.columns.split(',').includes('authority_json') &&
  schema.columns.split(',').includes('observed_at_ms') && Number(schema.guard_count) === 1,
  'D1_SCHEMA_INCOMPATIBLE');
const beforeCounts = query(CONFIG, 'SELECT chain_id,COUNT(*) AS launch_count FROM launches GROUP BY chain_id ORDER BY chain_id;');
const beforeConflict = query(CONFIG, `SELECT * FROM launches WHERE launch_id='${CONFLICTING_LAUNCH}' LIMIT 1;`)[0];
gate(beforeConflict?.launch_id === CONFLICTING_LAUNCH, 'CONFLICTING_LAUNCH_MISSING');

execFileSync('pnpm', ['exec', 'tsx', '-e', [
  "import {PonsLaunchSource} from './src/pons/ponsSource.ts';",
  "(async()=>{const source=new PonsLaunchSource({rpcUrl:'https://rpc.ordofi.network'});",
  'await source.assertAuthority(76047766n);})().catch(error=>{console.error(error);process.exit(1)});'
].join(' ')], { stdio: 'inherit', timeout: 30_000 });
note('Chain 4663 and Pons factory authority verified from canonical RPC.');

try {
  const tag = `pons-catchup-recovery-${reviewedSha.slice(0, 12)}`;
  cli([
    'versions', 'upload', '--config', CONFIG, '--keep-vars', '--strict', '--tag', tag,
    '--message', `Pons identity and catch-up recovery ${reviewedSha.slice(0, 12)}`
  ]);
  const candidateVersion = taggedVersion(jsonOutput(cli(['versions', 'list', '--name', WORKER, '--json'])), tag);
  gate(candidateVersion && candidateVersion !== previousVersion, 'CANDIDATE_VERSION_NOT_RESOLVED');
  const candidate = version(candidateVersion);
  requirePrivateBindings(bindings(candidate), reviewedSha, true);
  execFileSync('pnpm', [
    'verify:production-binding-parity', '--', '--worker', WORKER,
    '--active-version', previousVersion, '--candidate-version', candidateVersion, '--config', CONFIG
  ], { stdio: 'inherit', timeout: 180_000, env: process.env });
  note('Candidate uploaded dark with binding parity and exact reviewed SHA.', { previousVersion, candidateVersion });

  promotionAttempted = true;
  cli([
    'versions', 'deploy', `${candidateVersion}@100%`, '--name', WORKER, '--yes',
    '--message', `Pons identity and catch-up recovery ${reviewedSha.slice(0, 12)}`
  ]);

  const samples = [];
  for (let attempt = 1; attempt <= 16; attempt += 1) {
    const snapshot = await getJson('/api/health');
    const runtime = ponsRuntime(CONFIG);
    const sample = {
      atMs: Date.now(), checkpoint: BigInt(snapshot.checkpointBlock), target: BigInt(snapshot.targetBlock),
      backlog: BigInt(snapshot.targetBlock) - BigInt(snapshot.checkpointBlock),
      chainId: snapshot.chainId, sourceVerified: runtime.sourceVerified,
      runtimeFresh: snapshot.runtimeFresh, lastSyncError: runtime.lastSyncError,
      indexReady: snapshot.indexReady, liveCaughtUp: runtime.liveCaughtUp,
      candidateActive: activeVersion(deploymentStatus()) === candidateVersion
    };
    const previousSample = samples.at(-1);
    const elapsedMs = previousSample ? sample.atMs - previousSample.atMs : 0;
    const checkpointVelocity = previousSample && elapsedMs > 0
      ? Number(sample.checkpoint - previousSample.checkpoint) / elapsedMs * 1_000 : null;
    const targetVelocity = previousSample && elapsedMs > 0
      ? Number(sample.target - previousSample.target) / elapsedMs * 1_000 : null;
    const catchupHeadRatio = checkpointVelocity !== null && targetVelocity !== null && targetVelocity > 0
      ? checkpointVelocity / targetVelocity : null;
    samples.push(sample);
    note('Recovery health sample.', {
      attempt, chainId: snapshot.chainId, checkpointBlock: snapshot.checkpointBlock,
      headBlock: snapshot.headBlock, targetBlock: snapshot.targetBlock,
      launchCount: snapshot.launchCount, indexReady: snapshot.indexReady,
      sourceVerified: runtime.sourceVerified, liveCaughtUp: runtime.liveCaughtUp, lastSyncError: runtime.lastSyncError,
      runtimeFresh: snapshot.runtimeFresh, backlog: sample.backlog.toString(),
      checkpointVelocity, targetVelocity, catchupHeadRatio
    });
    gate(snapshot.chainId === 4663, 'POSTDEPLOY_WRONG_CHAIN');
    gate(BigInt(snapshot.checkpointBlock) >= STALLED_CHECKPOINT, 'CHECKPOINT_REGRESSED');
    const observedVerdict = classifyPonsRecovery(samples);
    if (observedVerdict === 'PASS' || observedVerdict === 'FAIL') break;
    await sleep(15_000);
  }
  const recoveryVerdict = classifyPonsRecovery(samples);
  if (recoveryVerdict === 'RECOVERY_PROGRESSING' || recoveryVerdict === 'RECOVERY_RETRYING') {
    note(`PONS_${recoveryVerdict}`, {
      reviewedSha, candidateVersion,
      checkpointBefore: samples[0].checkpoint.toString(), checkpointAfter: samples.at(-1).checkpoint.toString(),
      backlogBefore: samples[0].backlog.toString(), backlogAfter: samples.at(-1).backlog.toString()
    });
  } else {
    gate(recoveryVerdict === 'PASS', 'PONS_RECOVERY_FAILED');
    const healthy = samples.at(-1);

    const deployed = activeVersion(deploymentStatus());
    gate(deployed === candidateVersion, 'CANDIDATE_NOT_AT_100_PERCENT');
    requirePrivateBindings(bindings(version(candidateVersion)), reviewedSha, true);
    const afterService = await getJson('/health');
    gate(afterService.releaseSha === reviewedSha, 'DEPLOYED_RELEASE_SHA_MISMATCH');
    const afterCounts = query(CONFIG, 'SELECT chain_id,COUNT(*) AS launch_count FROM launches GROUP BY chain_id ORDER BY chain_id;');
    const uniqueness = query(CONFIG, "SELECT COUNT(*) AS rows,COUNT(DISTINCT launch_id) AS unique_launches,COUNT(DISTINCT CASE WHEN chain_id=4663 THEN token END) AS unique_pons_tokens FROM launches;")[0];
    const afterConflict = query(CONFIG, `SELECT * FROM launches WHERE launch_id='${CONFLICTING_LAUNCH}' LIMIT 1;`)[0];
    gate(JSON.stringify(afterConflict) === JSON.stringify(beforeConflict), 'PREEXISTING_LAUNCH_MUTATED');
    const beforeByChain = new Map(beforeCounts.map(row => [Number(row.chain_id), Number(row.launch_count)]));
    const afterByChain = new Map(afterCounts.map(row => [Number(row.chain_id), Number(row.launch_count)]));
    gate((afterByChain.get(4663) ?? 0) >= (beforeByChain.get(4663) ?? 0), 'PONS_LAUNCH_ROWS_DELETED');
    gate((afterByChain.get(5042) ?? 0) === (beforeByChain.get(5042) ?? 0), 'CROSS_CHAIN_LAUNCH_STATE_CHANGED');
    gate(Number(uniqueness.rows) === Number(uniqueness.unique_launches), 'LAUNCH_ID_UNIQUENESS_FAILED');
    gate(Number(uniqueness.unique_pons_tokens) === (afterByChain.get(4663) ?? 0), 'PONS_TOKEN_UNIQUENESS_FAILED');
    note('PONS_RECOVERY_PASS', {
      reviewedSha, previousVersion, candidateVersion,
      checkpointBefore: beforeHealth.checkpointBlock,
      checkpointAfter: healthy.checkpoint.toString(),
      launchCountsBefore: beforeCounts,
      launchCountsAfter: afterCounts
    });
  }
} catch (error) {
  if (promotionAttempted && previousVersion) {
    try {
      cli([
        'versions', 'deploy', `${previousVersion}@100%`, '--name', WORKER, '--yes',
      '--message', 'Rollback after failed Pons catch-up recovery'
      ]);
      note('ROLLBACK_PASS', { previousVersion });
    } catch {
      note('ROLLBACK_FAILED_MANUAL_ACTION_REQUIRED', { previousVersion });
    }
  }
  throw error;
} finally {
  rmSync(CONFIG, { force: true });
}
