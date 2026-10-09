// Offline packaging only. Never authenticates, uploads, or deploys a Worker.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = process.cwd();
const authority = resolve(process.env.BINRAT_BACKEND_RELEASE_WORKTREE ?? '../binrat-backend-release-20261009');
const frozen = join(authority, '.artifacts/backend-release-20261009');
const oldAssets = join(authority, '.artifacts/production-release-20261009/upload-10057/retained-assets');
const frontdoor = join(root, '.artifacts/v3-frontdoor');
const out = join(root, '.artifacts/v3-production');
const providerState = join(root, '.artifacts/v3-provider-state');
assert.ok(!existsSync(providerState) || readdirSync(providerState).every(name => !/issued|staged|deployment|rollback/.test(name)),
  'Provider operation already issued; frozen release must not be repackaged');
const hash = raw => createHash('sha256').update(raw).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const backendSha = '16994bf1e331441f75d2ebba5f1d8d6226e7ebc6';
assert.equal(git(['status', '--porcelain']), '', 'Release source must be committed and clean');
assert.equal(git(['diff', backendSha, '--', 'src', 'cloudflare', 'web', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json']), '', 'Backend, authority, and lockfiles must remain unchanged');
const manifest = JSON.parse(readFileSync(join(frontdoor, 'manifest.json')));
assert.equal(manifest.sourceSha, git(['rev-parse', 'HEAD']));
assert.equal(manifest.sourceDirty, false);
assert.equal(manifest.mode, 'V3_PONS_READONLY_PRODUCTION');
const archive = join(frozen, 'binrat-backend-16994bf.tar.gz');
assert.equal(hash(readFileSync(archive)), '12014b63ded4c9f5bae1efb0fdef4d65378998e968aa2de812ce1cdd1fe68cda');
const module = execFileSync('tar', ['-xOf', archive, 'bundle/worker.js'], { maxBuffer: 4_000_000 });
assert.equal(hash(module), '2634728884ac8327ccaaa2118f1c94f8237a893e57a604fd6af35ee65b32ee22');
const previous = JSON.parse(readFileSync(join(frozen, 'production-assets-manifest.json'))).files;
assert.equal(previous.length, 33);
// Only ignored local output is replaced. Current production remains untouched.
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'rollback/site'), { recursive: true });
mkdirSync(join(out, 'cutover/site'), { recursive: true });
writeFileSync(join(out, 'worker.js'), module);
function put(base, path, raw) {
  assert.ok(!path.startsWith('/') && !path.split('/').includes('..'));
  mkdirSync(resolve(base, path, '..'), { recursive: true });
  writeFileSync(join(base, path), raw);
}
for (const file of previous) {
  const raw = readFileSync(join(oldAssets, file.path));
  assert.equal(hash(raw), file.expectedSha256, file.path);
  put(join(out, 'rollback/site'), file.path, raw);
  // Keep previous resources for already open tabs, while retiring legacy HTML.
  if (!file.path.endsWith('.html')) put(join(out, 'cutover/site'), file.path, raw);
}
for (const file of manifest.files) {
  const raw = readFileSync(join(frontdoor, 'site', file.path));
  assert.equal(hash(raw), file.sha256, file.path);
  assert.equal(raw.length, file.bytes, file.path);
  put(join(out, 'cutover/site'), file.path, raw);
}
function inventory(base, prefix = '') {
  return readdirSync(join(base, prefix), { withFileTypes: true }).flatMap(item => {
    const path = prefix + item.name;
    if (item.isDirectory()) return inventory(base, path + '/');
    assert.ok(item.isFile(), 'No symlinks or special files');
    const raw = readFileSync(join(base, path));
    return [{ path, bytes: raw.length, sha256: hash(raw) }];
  }).sort((a, b) => a.path.localeCompare(b.path));
}
const cutover = inventory(join(out, 'cutover/site'));
const rollback = inventory(join(out, 'rollback/site'));
assert.equal(cutover.filter(f => f.path.endsWith('.html')).length, 1);
assert.equal(rollback.length, 33);
const receipt = {
  schemaVersion: 'binrat.v3-static-release/1', sourceSha: manifest.sourceSha, sourceClean: true,
  backendSourceSha: backendSha, backendVersionCandidate: '1139147d-3587-4105-8348-daa135542bad',
  backendModule: { path: 'worker.js', bytes: module.length, sha256: hash(module) },
  assetConfig: { html_handling: 'auto-trailing-slash', not_found_handling: 'single-page-application',
    run_worker_first: manifest.cloudflareRoutingProposal.run_worker_first },
  cutover, cutoverDigest: hash(JSON.stringify(cutover)), rollback, rollbackDigest: hash(JSON.stringify(rollback)),
  previousResourcesRetained: 31, legacyHtmlRetiredAtCutover: ['index.html', 'app/index.html'],
  providerIdentityVerified: false, backendAcceptanceVerified: false, rollbackProviderVerified: false,
  deploymentAuthorizedByThisArtifact: false, remoteMutation: false,
};
writeFileSync(join(out, 'manifest.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ verdict: 'OFFLINE_PACKAGE_PASS', sourceSha: receipt.sourceSha,
  moduleSha256: receipt.backendModule.sha256, cutoverFiles: cutover.length, rollbackFiles: rollback.length,
  cutoverDigest: receipt.cutoverDigest, providerGates: 'REQUIRED', remoteMutation: false }));
