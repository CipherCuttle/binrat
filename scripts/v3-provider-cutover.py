#!/usr/bin/env python3
"""One bounded V3 cutover. Provider credentials and asset JWTs remain in memory.

Commands: selftest (offline), guards (GETs only), stage (one version upload,
no traffic change), deploy (one traffic cutover), rollback (104 only).
Approval is supplied by the owner's final sprint instruction and local hashed
acceptance receipts; this tool cannot modify DNS, data, secrets, or schedules.
"""
from __future__ import annotations
import argparse
import base64
import concurrent.futures
import hashlib
import json
import mimetypes
import os
import re
import secrets
import subprocess
import sys
import tomllib
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = ROOT / '.artifacts/v3-production'
STATE = ROOT / '.artifacts/v3-provider-state'
AUTHORITY = ROOT.parent / 'binrat-backend-release-20261009'
ACCOUNT = '8927d39146b901d0f463b971a1d039e6'
WORKER = 'binrat-edge-v0'
HEALTHY = '1139147d-3587-4105-8348-daa135542bad'
BACKEND_SHA = '16994bf1e331441f75d2ebba5f1d8d6226e7ebc6'
MODULE_SHA = '2634728884ac8327ccaaa2118f1c94f8237a893e57a604fd6af35ee65b32ee22'
DB = '46814564-1a41-449a-88e5-c1349eed3a27'
QUEUE_ID = 'c4e67ab772474f08b31648bcc0a7852b'
PREFIX = '/accounts/' + ACCOUNT
SCRIPT = PREFIX + '/workers/scripts/' + WORKER
API = 'https://api.cloudflare.com/client/v4'
SITE = 'https://binrat.tech'
CACHE = Path.home() / '.cache/pnpm/dlx'
RUNTIME_KEYS = ('compatibility_date', 'compatibility_flags', 'usage_model', 'limits',
                'observability', 'logpush', 'placement', 'tail_consumers', 'keep_assets')
BOOKKEEPING_KEYS = {'id', 'number', 'startup_time_ms', 'main_module', 'annotations',
                    'urls', 'source', 'created_on', 'bindings', 'env', 'assets',
                    'author_id', 'author_email', 'modules'}
TOKENS: list[str] = []


def require(condition, code):
    if not condition:
        raise RuntimeError(code)


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def compact(value):
    return json.dumps(value, separators=(',', ':'), ensure_ascii=False).encode()


def read(path):
    return json.loads(Path(path).read_text())


def save(name, value):
    STATE.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(value, indent=2) + '\n'
    require(not any(t and t in raw for t in TOKENS), 'CREDENTIAL_IN_RECEIPT')
    require(not re.search(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', raw), 'JWT_IN_RECEIPT')
    (STATE / name).write_text(raw)


def once(name, value):
    STATE.mkdir(parents=True, exist_ok=True)
    # O_EXCL also closes the concurrent invocation race. Never auto-remove.
    fd = os.open(STATE / name, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, 'w') as output:
        output.write(json.dumps(value, indent=2) + '\n')


def pinned_wrangler():
    candidates = sorted(CACHE.glob('*/**/node_modules/.pnpm/wrangler@4.135.0/node_modules/wrangler/package.json'))
    require(bool(candidates), 'PINNED_WRANGLER_NOT_INSTALLED')
    path = candidates[0]
    require(read(path)['version'] == '4.135.0', 'WRANGLER_VERSION_DRIFT')
    return path.parent


def oauth():
    path = Path.home() / '.config/.wrangler/config/default.toml'
    config = tomllib.loads(path.read_text())
    expiration = datetime.fromisoformat(config['expiration_time'].replace('Z', '+00:00'))
    if (expiration - datetime.now(timezone.utc)).total_seconds() < 120:
        result = subprocess.run(['node', str(pinned_wrangler() / 'bin/wrangler.js'), 'whoami'],
                                capture_output=True, timeout=45)
        require(result.returncode == 0, 'LOCAL_OAUTH_REFRESH_FAILED')
        config = tomllib.loads(path.read_text())
        require(datetime.fromisoformat(config['expiration_time'].replace('Z', '+00:00')) > datetime.now(timezone.utc),
                'LOCAL_OAUTH_REFRESH_FAILED')
    token = config['oauth_token']
    TOKENS.append(token)
    return token


def curl(url, method='GET', body=None, content_type=None, token=None):
    # Config stdin prevents credentials from entering argv; memfd avoids JWT or
    # secret payload files. No retries or provider redirects are permitted.
    config = 'request = ' + json.dumps(method) + '\n'
    config += 'header = ' + json.dumps('User-Agent: BINRAT-V3-bounded-release/1') + '\n'
    if token:
        config += 'header = ' + json.dumps('Authorization: Bearer ' + token) + '\n'
    if content_type:
        config += 'header = ' + json.dumps('Content-Type: ' + content_type) + '\n'
    fd = None
    try:
        if body is not None:
            fd = os.memfd_create('binrat-release-body', 0)
            with os.fdopen(os.dup(fd), 'wb') as output:
                output.write(body)
            os.lseek(fd, 0, os.SEEK_SET)
            config += 'data-binary = ' + json.dumps('@/proc/self/fd/' + str(fd)) + '\n'
        result = subprocess.run(['curl', '-4', '--silent', '--show-error', '--max-time', '100',
                                 '--config', '-', url, '--write-out', '\n%{http_code}'],
                                input=config.encode(), capture_output=True,
                                pass_fds=(fd,) if fd is not None else (), timeout=105)
        require(result.returncode == 0, 'BOUNDED_HTTPS_TRANSPORT_FAILURE')
        raw, status = result.stdout.rsplit(b'\n', 1)
        return int(status), raw
    finally:
        if fd is not None:
            os.close(fd)


def api(path, method='GET', body=None, raw=None, content_type='application/json', token=None):
    require(path.startswith(PREFIX + '/'), 'ACCOUNT_SELECTOR_REJECTED')
    if method != 'GET':
        require(method == 'POST' and path in {
            SCRIPT + '/assets-upload-session', PREFIX + '/workers/assets/upload?base64=true',
            SCRIPT + '/versions?bindings_inherit=strict', SCRIPT + '/deployments'}, 'MUTATION_SELECTOR_REJECTED')
    if body is not None:
        raw = compact(body)
    status, response = curl(API + path, method, raw, content_type if raw is not None else None, token or oauth())
    try:
        value = json.loads(response)
    except Exception:
        raise RuntimeError('PROVIDER_NON_JSON_RESPONSE') from None
    if status not in (200, 201) or value.get('success') is not True:
        save('provider-rejection-' + str(datetime.now().timestamp()).replace('.', '') + '.json', {
            'observedAt': now(), 'path': path, 'method': method, 'httpStatus': status,
            'errorCodes': [error.get('code') for error in value.get('errors', [])]})
        raise RuntimeError('PROVIDER_REJECTED_OPERATION')
    return value['result']


def public(path, base=SITE, json_body=False):
    require(path.startswith('/') and urllib.parse.urlsplit(base).scheme == 'https', 'PUBLIC_SELECTOR_REJECTED')
    # curl -L can leak auth in general; public requests use bounded same-origin
    # redirects explicitly. HTML index aliases are the only expected redirects.
    for attempt in range(3):
        status, raw = curl(base + path)
        if status in (301, 302, 303, 307, 308):
            parsed = urllib.parse.urlsplit(path)
            require(parsed.path.endswith('index.html'), 'UNEXPECTED_PUBLIC_REDIRECT')
            path = parsed.path[:-len('index.html')] + ('?' + parsed.query if parsed.query else '')
            continue
        receipt = {'observedAt': now(), 'httpStatus': status, 'sha256': digest(raw), 'bytes': len(raw)}
        if json_body:
            try:
                receipt['result'] = json.loads(raw)
            except Exception:
                raise RuntimeError('PUBLIC_NON_JSON_RESPONSE') from None
        return receipt
    raise RuntimeError('PUBLIC_REDIRECT_BOUND_EXHAUSTED')


def binding_map(bindings):
    result = {}
    for item in bindings:
        require(item.get('name') not in result, 'DUPLICATE_BINDING_NAME')
        value = dict(item)
        if value.get('type') == 'secret_text':
            value = {'name': value['name'], 'type': 'secret_text'}
        result[value['name']] = value
    return result


def module_identity(version):
    result = []
    for module in version['modules']:
        raw = base64.b64decode(module['content_base64'], validate=True)
        result.append({'name': module['name'], 'bytes': len(raw), 'sha256': digest(raw)})
    require(result == [{'name': 'worker.js', 'bytes': 2298388, 'sha256': MODULE_SHA}], 'EXACT_BACKEND_MODULE_MISMATCH')
    return result


def runtime_identity(beta, stable):
    require(not (set(beta) - set(RUNTIME_KEYS) - BOOKKEEPING_KEYS), 'UNRECOGNIZED_VERSION_METADATA')
    runtime = {'logpush': False, 'placement': {}, 'tail_consumers': [],
               **{key: beta[key] for key in RUNTIME_KEYS if key in beta}}
    script_runtime = stable['resources']['script_runtime']
    for key in RUNTIME_KEYS:
        if key in script_runtime:
            require(key not in runtime or runtime[key] == script_runtime[key], 'RUNTIME_READ_MODEL_MISMATCH')
            runtime[key] = script_runtime[key]
    require(runtime.get('compatibility_date') == '2026-09-18' and runtime.get('compatibility_flags') == ['nodejs_compat'],
            'RUNTIME_AUTHORITY_DRIFT')
    return runtime


def version_read(vid):
    stable = api(SCRIPT + '/versions/' + vid)
    beta = api(PREFIX + '/workers/workers/' + WORKER + '/versions/' + vid + '?include=modules')
    return {'versionId': vid, 'number': stable['number'], 'modules': module_identity(beta),
            'bindings': binding_map(beta['bindings']), 'runtime': runtime_identity(beta, stable),
            'assetConfig': beta['assets']['config'], 'urls': beta.get('urls', []),
            'scriptHandlers': stable['resources']['script'].get('handlers'),
            'namedHandlers': stable['resources']['script'].get('named_handlers')}


def active():
    deployment = max(api(SCRIPT + '/deployments')['deployments'], key=lambda item: item['created_on'])
    require(len(deployment['versions']) == 1 and deployment['versions'][0]['percentage'] == 100, 'PRODUCTION_SPLIT_OR_DRIFT')
    return deployment


def guard_active(expected=HEALTHY, require_latest=True):
    deployment = active()
    require(deployment['versions'][0]['version_id'] == expected, 'ACTIVE_PRODUCTION_VERSION_DRIFT')
    if require_latest:
        items = api(SCRIPT + '/versions')['items']
        require(items[0]['id'] == expected, 'STRICT_LATEST_INHERITANCE_SOURCE_DRIFT')
    return deployment


def package_read():
    manifest = read(PACKAGE / 'manifest.json')
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    require(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT, text=True).strip() == '', 'SOURCE_NOT_CLEAN')
    require(manifest['schemaVersion'] == 'binrat.v3-static-release/1' and manifest['sourceSha'] == sha and manifest['sourceClean'] is True,
            'EXACT_SOURCE_SHA_MISMATCH')
    require(manifest['backendSourceSha'] == BACKEND_SHA and manifest['backendVersionCandidate'] == HEALTHY,
            'PACKAGE_BACKEND_AUTHORITY_MISMATCH')
    require(digest((PACKAGE / 'worker.js').read_bytes()) == MODULE_SHA and (PACKAGE / 'worker.js').stat().st_size == 2298388,
            'PACKAGE_MODULE_MISMATCH')
    for kind in ('cutover', 'rollback'):
        files = manifest[kind]
        require(len(files) == len({item['path'] for item in files}), 'DUPLICATE_ASSET_PATH')
        require(digest(compact(files)) == manifest[kind + 'Digest'], 'ASSET_MANIFEST_DIGEST_MISMATCH')
        expected = set()
        for item in files:
            path = Path(item['path'])
            require(not path.is_absolute() and '..' not in path.parts, 'UNSAFE_ASSET_PATH')
            file = PACKAGE / kind / 'site' / path
            require(file.is_file() and not file.is_symlink(), 'ASSET_SPECIAL_FILE')
            raw = file.read_bytes()
            require(len(raw) == item['bytes'] and digest(raw) == item['sha256'], 'ASSET_BYTES_MISMATCH')
            expected.add(item['path'])
        actual = {str(path.relative_to(PACKAGE / kind / 'site')) for path in (PACKAGE / kind / 'site').rglob('*') if path.is_file()}
        require(actual == expected, 'EXTRA_OR_MISSING_ASSET')
    require(len(manifest['rollback']) == 33, 'ROLLBACK_ASSET_COUNT_MISMATCH')
    require(manifest['assetConfig']['not_found_handling'] == 'single-page-application', 'SPA_ROUTE_CONFIG_MISMATCH')
    require(manifest['assetConfig']['run_worker_first'] == ['/api', '/api/*', '/health', '/telegram/*', '/__candidate/*'], 'API_ROUTE_PRECEDENCE_MISMATCH')
    return manifest


def billing_guard(gates):
    baseline = read(gates['billingBaselinePath'])
    current = read(gates['billingCurrentPath'])
    require(current['readbackSource'] == 'AUTHENTICATED_OWNER_BROWSER_READ_ONLY' and current['scope'] == 'ACCOUNT_WIDE', 'BILLING_EVIDENCE_UNAUTHENTICATED')
    elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(current['observedAt'].replace('Z', '+00:00'))).total_seconds()
    require(0 <= elapsed < 600, 'BILLING_RECEIPT_TOO_OLD')
    incremental = float(current['computedUsageUsd']) - float(baseline['computedUsageUsd'])
    require(0 <= incremental <= 1 and float(current['displayedRemainingUsd']) >= 5, 'OWNER_BUDGET_STOP')
    return {'observedAt': current['observedAt'], 'usageUsd': current['computedUsageUsd'],
            'incrementalUsd': incremental, 'remainingUsd': current['displayedRemainingUsd']}


def acceptance(manifest):
    gates = read(PACKAGE / 'acceptance-gates.json')
    require(gates['allPass'] is True and gates['sourceSha'] == manifest['sourceSha'], 'MANDATORY_ACCEPTANCE_NOT_PASS')
    names = ('backend', 'frontend', 'security', 'hostileReview', 'targetedRereview')
    require(all(gates.get('checks', {}).get(name) is True for name in names), 'MANDATORY_CHECK_NOT_PASS')
    receipts = gates.get('reviewReceipts', [])
    require(len(receipts) >= 1, 'REVIEW_RECEIPT_MISSING')
    for item in receipts:
        require(digest(Path(item['path']).read_bytes()) == item['sha256'], 'REVIEW_RECEIPT_DRIFT')
    return gates, billing_guard(gates)


def verify_assets(files, base):
    def verify(item):
        receipt = public('/' + item['path'] + '?v3_guard=' + secrets.token_hex(4), base)
        receipt['path'] = item['path']
        receipt['matches'] = receipt['httpStatus'] == 200 and receipt['sha256'] == item['sha256'] and receipt['bytes'] == item['bytes']
        return receipt
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        results = list(pool.map(verify, files))
    require(all(item['matches'] for item in results), 'STATIC_ASSET_IDENTITY_MISMATCH')
    return results


def health(base):
    receipt = public('/health?v3_guard=' + secrets.token_hex(4), base, True)
    value = receipt.get('result', {})
    require(receipt['httpStatus'] == 200 and value.get('releaseSha') == BACKEND_SHA, 'HEALTH_BACKEND_SHA_MISMATCH')
    for key in ('repliesEnabled', 'conversationEnabled', 'aiEnabled', 'feedbackEnabled', 'autonomousRatEnabled',
                'autonomousRatPublicEnabled', 'telegramUiV2Enabled', 'telegramMediaEnabled'):
        require(value.get(key) is False, 'UNAPPROVED_CAPABILITY_ENABLED')
    return receipt


def fresh_read(base=SITE):
    status = public('/api/status?v3_guard=' + secrets.token_hex(4), base, True)
    value = status.get('result', {})
    require(status['httpStatus'] == 200 and value.get('chainId') == 4663 and value.get('state') == 'FRESH_VERIFIED', 'PRODUCTION_READ_PLANE_NOT_FRESH')
    return status


def immutable_preview(identity):
    url = 'https://' + identity['versionId'][:8] + '-' + WORKER + '.pettevik.workers.dev'
    require(url in identity['urls'], 'IMMUTABLE_PREVIEW_MISSING')
    return url


def guards():
    manifest = package_read()
    deployment = guard_active()
    identity = version_read(HEALTHY)
    require(identity['number'] == 104, 'HEALTHY_VERSION_NUMBER_DRIFT')
    bindings = identity['bindings']
    require(bindings['DB']['id'] == DB and bindings['SYNC_QUEUE']['queue_name'] == 'binrat-sync-v0', 'RESOURCE_AUTHORITY_DRIFT')
    require(len([b for b in bindings.values() if b['type'] == 'secret_text']) == 10, 'PROTECTED_SECRET_INVENTORY_DRIFT')
    settings = api(SCRIPT + '/settings')
    require(binding_map(settings['bindings']) == bindings, 'MUTABLE_SETTINGS_BINDING_DRIFT')
    settings_runtime = {key: settings[key] for key in RUNTIME_KEYS if key in settings}
    require(settings_runtime == identity['runtime'], 'MUTABLE_SETTINGS_RUNTIME_DRIFT')
    cron = api(SCRIPT + '/schedules')
    queue = api(PREFIX + '/queues/' + QUEUE_ID)
    require([s['cron'] for s in cron['schedules']] == ['* * * * *'], 'PRODUCTION_CRON_DRIFT')
    require(queue['queue_name'] == 'binrat-sync-v0' and len(queue['consumers']) == 1 and queue['consumers'][0]['script'] == WORKER,
            'PRODUCTION_QUEUE_DRIFT')
    previous = verify_assets(manifest['rollback'], SITE)
    preview = immutable_preview(identity)
    rollback_assets = verify_assets(manifest['rollback'], preview)
    receipt = {'verdict': 'PASS', 'checkedAt': now(), 'sourceSha': manifest['sourceSha'], 'activeDeployment': deployment,
               'healthyIdentity': identity, 'currentPreviousAssets': previous, 'rollbackImmutablePreview': preview,
               'rollbackAssets': rollback_assets, 'rollbackHealth': health(preview), 'productionHealth': health(SITE),
               'productionStatus': fresh_read(), 'cron': cron, 'queue': queue, 'trafficChanged': False}
    require(active() == deployment, 'TRAFFIC_CHANGED_DURING_GUARDS')
    save('guards.json', receipt)
    return receipt


def hash_manifest(manifest):
    wrangler = pinned_wrangler()
    # Exact algorithm from installed Wrangler4.135.0 deploy helper:
    # BLAKE3(base64(file bytes) + extension without dot).hex[0:32].
    javascript = "const fs=require('fs'),path=require('path');const blake=require(require.resolve('blake3-wasm',{paths:[process.argv[1]]}));const input=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(Object.fromEntries(input.map(f=>{const raw=fs.readFileSync(f.file);return ['/'+f.path,{hash:blake.hash(raw.toString('base64')+path.extname(f.path).substring(1)).toString('hex').slice(0,32),size:raw.length}]}))));"
    files = [{'path': item['path'], 'file': str(PACKAGE / 'cutover/site' / item['path'])} for item in manifest['cutover']]
    result = subprocess.run(['node', '-e', javascript, str(wrangler)], input=compact(files), capture_output=True, timeout=45)
    require(result.returncode == 0, 'PINNED_ASSET_HASHER_FAILED')
    return {'manifest': json.loads(result.stdout)}


def multipart(parts):
    boundary = 'BINRAT-V3-' + secrets.token_hex(24)
    result = []
    for name, filename, content_type, raw in parts:
        header = '--' + boundary + '\r\nContent-Disposition: form-data; name="' + name + '"'
        if filename:
            header += '; filename="' + filename + '"'
        result.append((header + '\r\nContent-Type: ' + content_type + '\r\n\r\n').encode() + raw + b'\r\n')
    result.append(('--' + boundary + '--\r\n').encode())
    return b''.join(result), 'multipart/form-data; boundary=' + boundary


def normalized_config(config):
    return {'base_path': '/', **config}


def compare_stage(identity, healthy, manifest):
    require(identity['bindings'] == healthy['bindings'], 'STAGED_BINDING_MISMATCH')
    require(identity['runtime'] == healthy['runtime'], 'STAGED_RUNTIME_METADATA_MISMATCH')
    require(identity['scriptHandlers'] == healthy['scriptHandlers'] and identity['namedHandlers'] == healthy['namedHandlers'], 'STAGED_HANDLER_MISMATCH')
    require(identity['assetConfig'] == normalized_config(manifest['assetConfig']), 'STAGED_ASSET_ROUTING_MISMATCH')


def preview_routes(base, manifest):
    home = public('/', base)
    require(home['httpStatus'] == 200 and home['sha256'] == next(f['sha256'] for f in manifest['cutover'] if f['path'] == 'index.html'), 'PREVIEW_HOME_IDENTITY_MISMATCH')
    status = fresh_read(base)
    feed = public('/api/launches/latest?v3_guard=' + secrets.token_hex(4), base, True)
    require(feed['httpStatus'] == 200 and feed['result']['chainId'] == 4663 and len(feed['result']['launches']) > 0, 'PREVIEW_FEED_INVALID')
    launch = feed['result']['launches'][0]
    case_id = launch['launchId']
    case = public('/api/bag/' + case_id + '?v3_guard=' + secrets.token_hex(4), base, True)
    require(case['httpStatus'] == 200 and case['result']['chainId'] == 4663 and case['result']['bag']['id'] == case_id, 'PREVIEW_CASE_INVALID')
    routes = {}
    for path in ('/bag/' + case_id, '/?case=' + case_id, '/visual-lab', '/unknown-v3-route'):
        route = public(path, base)
        require(route['httpStatus'] == 200 and route['sha256'] == home['sha256'], 'PREVIEW_SPA_ROUTE_FAILURE')
        routes[path] = route
    unknown_api = public('/api/unknown-v3-read-route', base, True)
    require(unknown_api['httpStatus'] == 404 and unknown_api['result'].get('error') == 'NOT_IN_READ_ONLY_RELEASE', 'API_FELL_THROUGH_TO_HTML')
    return {'home': home, 'status': status, 'feed': feed, 'case': case, 'routes': routes, 'unknownApi': unknown_api, 'health': health(base)}


def stage():
    manifest = package_read()
    gates, budget = acceptance(manifest)
    require(not (STATE / 'stage-issued.json').exists(), 'SECOND_STAGE_FORBIDDEN')
    guarded = guards()
    healthy = guarded['healthyIdentity']
    once('stage-issued.json', {'issuedAt': now(), 'sourceSha': manifest['sourceSha'], 'cutoverDigest': manifest['cutoverDigest'],
                               'healthyVersion': HEALTHY, 'trafficChanged': False, 'billing': budget})
    asset_manifest = hash_manifest(manifest)
    session = api(SCRIPT + '/assets-upload-session', 'POST', body=asset_manifest)
    jwt = session.get('jwt')
    buckets = session.get('buckets')
    require(isinstance(jwt, str) and isinstance(buckets, list), 'INVALID_ASSET_SESSION')
    TOKENS.append(jwt)
    byhash = {}
    for path, item in asset_manifest['manifest'].items():
        byhash.setdefault(item['hash'], path[1:])
    requested = [hash_value for bucket in buckets for hash_value in bucket]
    require(len(requested) == len(set(requested)) and all(h in byhash for h in requested), 'UNAPPROVED_UPLOAD_BUCKET')
    completion = jwt if not buckets else None
    save('asset-session.json', {'observedAt': now(), 'bucketCount': len(buckets), 'requestedHashes': requested, 'assetCount': len(manifest['cutover']), 'tokenRetained': False})
    for index, bucket in enumerate(buckets):
        parts = []
        for hash_value in bucket:
            path = byhash[hash_value]
            content_type = mimetypes.guess_type(path)[0] or 'application/octet-stream'
            parts.append((hash_value, hash_value, content_type, base64.b64encode((PACKAGE / 'cutover/site' / path).read_bytes())))
        data, content_type = multipart(parts)
        uploaded = api(PREFIX + '/workers/assets/upload?base64=true', 'POST', raw=data, content_type=content_type, token=jwt)
        if uploaded.get('jwt'):
            completion = uploaded['jwt']
            TOKENS.append(completion)
        save('asset-bucket-' + str(index + 1) + '.json', {'observedAt': now(), 'hashes': bucket, 'completionReceived': bool(uploaded.get('jwt')), 'tokenRetained': False})
    require(isinstance(completion, str) and completion, 'ASSET_COMPLETION_MISSING')
    require(guard_active() == guarded['activeDeployment'], 'PRODUCTION_CHANGED_DURING_ASSET_UPLOAD')
    require(version_read(HEALTHY) == healthy, 'HEALTHY_IDENTITY_CHANGED_DURING_STAGE')
    billing_guard(gates)
    metadata = {**healthy['runtime'], 'main_module': 'worker.js',
                'bindings': [{'name': name, 'type': 'inherit', 'version_id': 'latest'} for name in healthy['bindings']],
                'assets': {'jwt': completion, 'config': manifest['assetConfig']},
                'annotations': {'workers/commit_sha': manifest['sourceSha'], 'workers/message': 'BINRAT React V3 assets; exact verified16994bf backend'}}
    data, content_type = multipart([('metadata', None, 'application/json', compact(metadata)),
                                    ('worker.js', 'worker.js', 'application/javascript+module', (PACKAGE / 'worker.js').read_bytes())])
    once('version-upload-issued.json', {'issuedAt': now(), 'sourceSha': manifest['sourceSha'], 'inheritsFromLatestGuardedId': HEALTHY,
                                      'moduleSha256': MODULE_SHA, 'strictBindingInheritance': True, 'trafficChanged': False})
    uploaded = api(SCRIPT + '/versions?bindings_inherit=strict', 'POST', raw=data, content_type=content_type)
    vid = uploaded['id']
    save('staged-upload.json', {'observedAt': now(), 'versionId': vid, 'sourceSha': manifest['sourceSha'], 'trafficChanged': False})
    require(active() == guarded['activeDeployment'], 'STAGING_CHANGED_PRODUCTION_TRAFFIC')
    staged = version_read(vid)
    compare_stage(staged, healthy, manifest)
    base = immutable_preview(staged)
    assets = verify_assets(manifest['cutover'], base)
    routes = preview_routes(base, manifest)
    require(active() == guarded['activeDeployment'], 'TRAFFIC_CHANGED_DURING_PREVIEW_VERIFICATION')
    save('staged-verdict.json', {'verdict': 'PASS', 'checkedAt': now(), 'sourceSha': manifest['sourceSha'], 'versionId': vid,
                               'healthyIdentity': healthy, 'stagedIdentity': staged, 'cutoverDigest': manifest['cutoverDigest'],
                               'immutablePreview': base, 'assets': assets, 'routes': routes, 'trafficChanged': False})
    return {'verdict': 'STAGED_PASS', 'sourceSha': manifest['sourceSha'], 'versionId': vid, 'preview': base, 'trafficChanged': False}


def deploy():
    manifest = package_read()
    gates, budget = acceptance(manifest)
    staged = read(STATE / 'staged-verdict.json')
    require(staged['verdict'] == 'PASS' and staged['sourceSha'] == manifest['sourceSha'] and staged['cutoverDigest'] == manifest['cutoverDigest'], 'STAGED_ACCEPTANCE_MISMATCH')
    vid = staged['versionId']
    current = guard_active(HEALTHY, False)
    require(api(SCRIPT + '/versions')['items'][0]['id'] == vid, 'LATEST_STAGED_VERSION_DRIFT')
    identity = version_read(vid)
    compare_stage(identity, version_read(HEALTHY), manifest)
    require(identity == staged['stagedIdentity'], 'STAGED_IDENTITY_CHANGED')
    require(version_read(HEALTHY) == staged['healthyIdentity'], 'ROLLBACK_VERSION_CHANGED')
    rollback_base = immutable_preview(staged['healthyIdentity'])
    verify_assets(manifest['rollback'], rollback_base)
    health(rollback_base)
    fresh_read()
    health(SITE)
    preview_routes(immutable_preview(identity), manifest)
    require(active() == current, 'PRODUCTION_DRIFT_BEFORE_DEPLOY')
    budget = billing_guard(gates)
    once('deploy-issued.json', {'issuedAt': now(), 'sourceSha': manifest['sourceSha'], 'versionId': vid, 'rollbackVersion': HEALTHY, 'billing': budget})
    deployed = api(SCRIPT + '/deployments', 'POST', body={'strategy': 'percentage', 'versions': [{'version_id': vid, 'percentage': 100}],
                    'annotations': {'workers/message': 'Owner-authorized BINRAT React V3 exact-module asset cutover'}})
    save('deployment.json', {'observedAt': now(), 'result': deployed, 'versionId': vid, 'sourceSha': manifest['sourceSha']})
    require(guard_active(vid, False)['versions'][0]['version_id'] == vid, 'DEPLOYMENT_READBACK_MISMATCH')
    return {'verdict': 'DEPLOYED', 'versionId': vid, 'sourceSha': manifest['sourceSha'], 'rollbackVersion': HEALTHY}


def rollback():
    # Rollback must remain available after build/source/billing failures. Its
    # authority is the exact verified version104 + its independently proven33
    # assets, never historical broken102 and never an arbitrary version input.
    require((STATE / 'deploy-issued.json').exists(), 'NO_SPRINT_CUTOVER_TO_ROLLBACK')
    staged = read(STATE / 'staged-verdict.json')
    issued = read(STATE / 'deploy-issued.json')
    require(staged['verdict'] == 'PASS' and staged['versionId'] == issued['versionId'], 'ROLLBACK_SPRINT_IDENTITY_MISMATCH')
    current = guard_active(staged['versionId'], False)
    healthy = version_read(HEALTHY)
    require(healthy == staged['healthyIdentity'], 'ROLLBACK_VERSION_IDENTITY_CHANGED')
    manifest = read(PACKAGE / 'manifest.json')
    require(manifest['backendVersionCandidate'] == HEALTHY and len(manifest['rollback']) == 33, 'ROLLBACK_MANIFEST_AUTHORITY_MISMATCH')
    require(digest(compact(manifest['rollback'])) == manifest['rollbackDigest'], 'ROLLBACK_MANIFEST_DIGEST_MISMATCH')
    base = immutable_preview(healthy)
    assets = verify_assets(manifest['rollback'], base)
    healthy_response = health(base)
    require(active() == current, 'PRODUCTION_CHANGED_BEFORE_ROLLBACK')
    once('rollback-issued.json', {'issuedAt': now(), 'fromVersion': staged['versionId'], 'toVersion': HEALTHY,
                                 'moduleSha256': MODULE_SHA, 'independentAssetsVerified': 33})
    result = api(SCRIPT + '/deployments', 'POST', body={'strategy': 'percentage', 'versions': [{'version_id': HEALTHY, 'percentage': 100}],
                 'annotations': {'workers/message': 'BINRAT V3 controlled asset rollback to verifiedhealthy104'}})
    guard_active(HEALTHY, False)
    save('rollback.json', {'verdict': 'PASS', 'observedAt': now(), 'result': result, 'healthyIdentity': healthy,
                          'independentAssets': assets, 'independentHealth': healthy_response,
                          'productionAssets': verify_assets(manifest['rollback'], SITE), 'productionHealth': health(SITE)})
    return {'verdict': 'ROLLED_BACK', 'versionId': HEALTHY}


def selftest():
    # Failure controls are exercised without credentials, network or mutations.
    count = 0
    for condition, code in [(False, 'STALE_GATE'), (False, 'MODULE_DRIFT'), (False, 'WRONG_BINDING'), (False, 'BUDGET_STOP')]:
        try:
            require(condition, code)
        except RuntimeError as error:
            require(str(error) == code, 'FAULT_CONTROL_FAILED')
            count += 1
    secret = binding_map([{'name': 'RPC', 'type': 'secret_text', 'text': 'must-not-survive'}])
    require(secret == {'RPC': {'name': 'RPC', 'type': 'secret_text'}}, 'SECRET_SANITIZER_FAILED')
    fixture = {'bindings': {'DB': {'id': DB}}, 'runtime': {'compatibility_date': '2026-09-18'},
               'scriptHandlers': ['fetch'], 'namedHandlers': [], 'assetConfig': normalized_config({'not_found_handling': 'single-page-application'})}
    for field in ('bindings', 'runtime', 'scriptHandlers', 'assetConfig'):
        altered = dict(fixture)
        altered[field] = {'changed': True}
        try:
            compare_stage(altered, fixture, {'assetConfig': {'not_found_handling': 'single-page-application'}})
        except RuntimeError:
            count += 1
        else:
            raise RuntimeError('STAGED_DRIFT_NOT_REJECTED')
    body, content_type = multipart([('metadata', None, 'application/json', b'{}'), ('worker.js', 'worker.js', 'application/javascript+module', b'export{}')])
    require(b'name="worker.js"; filename="worker.js"' in body and content_type.startswith('multipart/form-data; boundary='), 'MULTIPART_SELFTEST_FAILED')
    return {'verdict': 'OFFLINE_SELFTEST_PASS', 'faultControls': count, 'credentialReads': False, 'remoteMutation': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('selftest', 'guards', 'stage', 'deploy', 'rollback'))
    args = parser.parse_args()
    try:
        result = globals()[args.command]()
        print(json.dumps(result if args.command != 'guards' else {'verdict': 'GUARDS_PASS', 'sourceSha': result['sourceSha'], 'rollbackVersion': HEALTHY, 'oldAssets': 33}))
    except Exception as error:
        code = str(error) if re.fullmatch(r'[A-Z0-9_]+', str(error)) else type(error).__name__
        save('failure-' + args.command + '.json', {'verdict': 'BLOCKED', 'observedAt': now(), 'command': args.command,
                                                'failingGate': code, 'stageIssued': (STATE / 'stage-issued.json').exists(),
                                                'deployIssued': (STATE / 'deploy-issued.json').exists(),
                                                'recovery': 'Inspect persisted request marker and Cloudflare active deployment; never blindly retry.'})
        print(json.dumps({'verdict': 'BLOCKED', 'command': args.command, 'failingGate': code}))
        raise SystemExit(1) from None


if __name__ == '__main__':
    main()
