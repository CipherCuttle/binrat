"""One bounded read-only Pons tripwire evidence capture. No RPC or Telegram."""
import hashlib
import json
import re
import subprocess
import tomllib
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent
REPO = OUT.parents[2]
ACCOUNT = '8927d39146b901d0f463b971a1d039e6'
WORKER = 'binrat-edge-v0'
D1 = '46814564-1a41-449a-88e5-c1349eed3a27'
SOURCE = '30564864f5d406414f0c09c4d2ba2be5d1e79ab8'
IDS = ['c91989e87923beeae04c3377e0e08bf6912c0c13bff8fad75f2da9fa71a61558',
       'cf87c2a1efedc264ea7ca58be141504f1a06c96ecd5315878f42ac7f0b9c19e1']
AUTH = tomllib.loads((Path.home() / '.config/.wrangler/config/default.toml').read_text())
assert datetime.fromisoformat(AUTH['expiration_time'].replace('Z', '+00:00')) > datetime.now(timezone.utc), 'AUTH_EXPIRED'
TOKEN = AUTH['oauth_token']
LEDGER = []


def now():
    return datetime.now(timezone.utc).isoformat()


def save(name, value):
    raw = json.dumps(value, indent=2) + '\n'
    assert TOKEN not in raw
    (OUT / name).write_text(raw)


def fetch(url, body=None):
    assert url.startswith('https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + '/')
    config = 'request = ' + json.dumps('POST' if body is not None else 'GET') + '\n'
    config += 'header = ' + json.dumps('Authorization: Bearer ' + TOKEN) + '\n'
    if body is not None:
        assert re.match(r'^(SELECT|EXPLAIN QUERY PLAN SELECT)\b', body['sql']) and ';' not in body['sql']
        config += 'header = "Content-Type: application/json"\ndata = ' + json.dumps(json.dumps(body)) + '\n'
    p = subprocess.run(['curl', '-4', '--silent', '--show-error', '--max-time', '25', '--config', '-',
                        '--write-out', '\n%{http_code}', url], input=config.encode(), capture_output=True, timeout=30)
    assert p.returncode == 0, 'TRANSPORT_FAILED'
    raw, status = p.stdout.rsplit(b'\n', 1)
    assert status == b'200', ('HTTP_FAILED', int(status))
    parsed = json.loads(raw)
    assert parsed['success'], [x.get('code') for x in parsed.get('errors', [])]
    return parsed['result']


def api(path, body=None):
    return fetch('https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + path, body)


def query(label, sql, params, cap):
    plan = api('/d1/database/' + D1 + '/query', {'sql': 'EXPLAIN QUERY PLAN ' + sql, 'params': params})[0]
    assert plan['success'] and not any('SCAN ' in r['detail'].upper() for r in plan['results']), 'UNBOUNDED_SCAN_REJECTED'
    assert plan['meta']['rows_written'] == 0 and plan['meta']['changed_db'] is False
    save(label + '-plan.json', plan)
    result = api('/d1/database/' + D1 + '/query', {'sql': sql, 'params': params})[0]
    assert result['success'] and result['meta']['rows_read'] <= cap
    assert result['meta']['rows_written'] == 0 and result['meta']['changed_db'] is False
    save(label + '.json', result)
    LEDGER.append({'label': label, 'capturedAt': now(), 'sql': sql, 'params': params, 'readCap': cap,
                   'plan': plan['results'], 'planMeta': plan['meta'], 'meta': result['meta'],
                   'returnedRows': len(result['results'])})
    save('query-ledger.json', LEDGER)
    print(label, 'rows_read=', result['meta']['rows_read'], 'rows_written=', result['meta']['rows_written'])
    return result['results']


script = '/workers/scripts/' + WORKER
deployment = max(api(script + '/deployments')['deployments'], key=lambda r: r['created_on'])
assert len(deployment['versions']) == 1 and deployment['versions'][0]['percentage'] == 100
version_id = deployment['versions'][0]['version_id']
version = api(script + '/versions/' + version_id)
settings = api(script + '/settings')
bindings = {b['name']: ({'name': b['name'], 'type': b['type']} if b['type'] == 'secret_text' else b)
            for b in settings['bindings']}
assert version['number'] == 106 and bindings['BINRAT_RELEASE_SHA']['text'] == SOURCE
save('production-identity-current.json', {'capturedAt': now(), 'worker': WORKER, 'number': version['number'],
     'versionId': version_id, 'deployment': deployment, 'bindings': bindings,
     'runtime': version['resources']['script_runtime'], 'secretValuesRead': False, 'productionMutations': 0})

frame_sql = '''SELECT r.*,c.block_number AS checkpoint_block,c.block_hash AS checkpoint_block_hash,
 s.checkpoint_block AS published_checkpoint_block,s.checkpoint_block_hash AS published_checkpoint_block_hash,
 s.feed_digest,s.verified_at_ms,s.publication_version
 FROM binrat_runtime_state r JOIN chain_checkpoints c ON c.chain_id=r.chain_id
 JOIN binrat_public_snapshots s ON s.chain_id=r.chain_id WHERE r.chain_id=? LIMIT 1'''
before = query('frame-before', frame_sql, [4663], 6)[0]
launch_sql = '''SELECT l.*,f.fact_id,f.evidence_digest,f.payload_json,
 (f.chain_id=l.chain_id AND f.launch_id=l.launch_id AND f.creator=l.creator
 AND f.observed_block=l.block_number AND f.observed_block_hash=l.block_hash
 AND f.log_index=l.log_index AND f.source_event_id=l.event_id) AS column_binding
 FROM launches l JOIN provenance_facts f ON f.launch_id=l.launch_id AND f.chain_id=l.chain_id
 WHERE l.launch_id IN (?,?) AND l.chain_id=4663 AND l.source='PONS_V2'
 ORDER BY CAST(l.block_number AS INTEGER),l.log_index,l.launch_id LIMIT 2'''
rows = query('launch-pair-current', launch_sql, IDS, 8)
assert len(rows) == 2 and [r['launch_id'] for r in rows] == IDS
after = query('frame-after', frame_sql, [4663], 6)[0]

canonical = lambda v: json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
digest = lambda v: hashlib.sha256(canonical(v).encode()).hexdigest()
for row in rows:
    authority = json.loads(row['authority_json'])
    assert row['source'] == authority['source'] == 'PONS_V2' and row['chain_id'] == authority['chainId'] == 4663
    assert row['creator'] == authority['creator'] == '0x0e1651aec67b2a049a4fa6aeb6c1c305aabfc35b'
    assert row['column_binding'] == 1
    bindings_to_check = {'launch_id': 'launchId', 'event_id': 'eventId', 'block_number': 'blockNumber',
      'block_hash': 'blockHash', 'launcher': 'launcher', 'tx_hash': 'txHash', 'log_index': 'logIndex',
      'token': 'token', 'creator': 'creator', 'pool': 'pool', 'name': 'name', 'symbol': 'symbol',
      'image_uri': 'imageUri', 'website': 'website', 'twitter': 'twitter', 'telegram': 'telegram'}
    assert all(row[k] == authority[v] for k, v in bindings_to_check.items())
    assert canonical(authority) == row['authority_json']
    assert digest({'kind': 'BINRAT_PONS_V2_LAUNCH_V1', 'chainId': 4663, 'launcher': row['launcher'],
                   'txHash': row['tx_hash'], 'token': row['token']}) == row['launch_id']
    assert digest({'kind': 'BINRAT_PONS_V2_EVENT_V1', 'chainId': 4663, 'launcher': row['launcher'],
                   'txHash': row['tx_hash'], 'logIndex': row['log_index']}) == row['event_id']
    fact = json.loads(row['payload_json'])
    assert canonical(fact) == row['payload_json'] and fact['kind'] == 'PONS_REPORTED_DEPLOYER'
    supplied = fact.pop('evidenceDigest')
    assert digest(fact) == supplied == row['evidence_digest']
assert int(rows[0]['block_number']) < int(rows[1]['block_number'])
assert all(r['source_verified'] == 1 and r['live_caught_up'] == 1 and r['last_sync_error'] is None for r in [before, after])
assert all(int(r['target_block']) >= int(rows[1]['block_number']) for r in [before, after])
assert all(0 <= datetime.now(timezone.utc).timestamp() * 1000 - r['updated_at_ms'] < 180_000 for r in [before, after])

fixture = {'schemaVersion': 'binrat.pons-tripwire-production-evidence/1',
 'provenance': 'ACTUAL_PRODUCTION_D1_CAPTURE_RETROSPECTIVE_REPLAY',
 'capture': {'capturedAt': now(), 'sourceSha': SOURCE, 'workerNumber': version['number'], 'workerVersionId': version_id,
    'd1RowsRead': sum(r['meta']['rows_read'] + r['planMeta']['rows_read'] for r in LEDGER),
    'd1RowsWritten': 0, 'rpcReads': 0, 'productionMutations': 0},
 'scope': 'Real canonical production launches replayed offline in chronological block order. Opt-in/restart/mock delivery occur only in local tests. This establishes no historical production subscription or real Telegram alert. Canonical block timestamps were not captured and must not be inferred from indexing time.',
 'chainId': 4663, 'deployer': rows[0]['creator'], 'openedCaseLaunchId': IDS[0], 'laterMatchingLaunchId': IDS[1],
 'replayBoundary': {'afterBlock': rows[0]['block_number'], 'beforeBlock': rows[1]['block_number'], 'watchOptInExistsOnlyLocally': True},
 'launches': rows, 'validation': {'launchIdsRecomputed': 2, 'eventIdsRecomputed': 2, 'provenanceDigestsRecomputed': 2,
    'columnBindingsValid': 2, 'authorityColumnsCanonical': 2, 'sameExactPonsReportedDeployer': True, 'strictlyLaterBlock': True},
 'missingSourceFields': ['canonicalBlockTimestampMs', 'productionWatchOptIn'],
 'productionRuntimeAtCapture': after,
 'publicationStableAcrossCapture': before['publication_version'] == after['publication_version']}
fixture_path = REPO / 'test/fixtures/pons-tripwire-production.json'
fixture_path.write_text(json.dumps(fixture, indent=2) + '\n')
save('capture-summary.json', {'capturedAt': now(), 'fixtureSha256': hashlib.sha256(fixture_path.read_bytes()).hexdigest(),
    'fixtureBytes': fixture_path.stat().st_size, 'validation': fixture['validation'], 'cost': fixture['capture'],
    'publicationBefore': before['publication_version'], 'publicationAfter': after['publication_version']})
print('IDENTITY', version['number'], version_id, 'VALIDATION PASS', fixture['capture']['d1RowsRead'], 'read / 0 written')
