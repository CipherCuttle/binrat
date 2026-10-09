#!/usr/bin/env python3
"""Read-only A1.3 identity, health and rollback evidence. No mutation API exists here."""
import argparse, base64, concurrent.futures, hashlib, json, re, subprocess, tomllib
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '.artifacts/a1-3-evidence'
ACCOUNT = '8927d39146b901d0f463b971a1d039e6'
WORKER = 'binrat-edge-v0'
VERSION = 'abe4c68d-e38e-4591-889b-77b2ca2abfe7'
PREFIX = '/accounts/' + ACCOUNT
SCRIPT = PREFIX + '/workers/scripts/' + WORKER
PRODUCTION = 'https://binrat.tech'
PREVIEW = 'https://abe4c68d-binrat-edge-v0.pettevik.workers.dev'
MODULE = '2634728884ac8327ccaaa2118f1c94f8237a893e57a604fd6af35ee65b32ee22'
TOKEN = None

def now(): return datetime.now(timezone.utc).isoformat()
def sha(raw): return hashlib.sha256(raw).hexdigest()
def save(name, value):
    OUT.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(value, indent=2) + '\n'
    assert not TOKEN or TOKEN not in raw
    (OUT / name).write_text(raw)

def get(url, authenticated=False):
    assert url.startswith('https://')
    config = 'request = "GET"\n'
    if authenticated:
        assert url.startswith('https://api.cloudflare.com/client/v4/')
        config += 'header = ' + json.dumps('Authorization: Bearer ' + TOKEN) + '\n'
    result = subprocess.run(['curl', '-4', '--silent', '--show-error', '--max-time', '25',
        '--config', '-', '--write-out', '\n%{http_code}', url], input=config.encode(), capture_output=True, timeout=30)
    assert result.returncode == 0, 'GET_TRANSPORT_FAILED'
    raw, status = result.stdout.rsplit(b'\n', 1)
    return int(status), raw

def api(path):
    assert path.startswith(PREFIX+'/') or path.startswith('/zones')
    status, raw = get('https://api.cloudflare.com/client/v4'+path, True)
    value = json.loads(raw)
    assert status == 200 and value['success'], (path,status,[e.get('code') for e in value.get('errors',[])])
    return value['result']

def bindings(items):
    return {b['name']: {'name':b['name'],'type':'secret_text'} if b['type']=='secret_text' else b for b in items}

def identity():
    active = max(api(SCRIPT+'/deployments')['deployments'], key=lambda d:d['created_on'])
    assert active['versions'] == [{'version_id':VERSION,'percentage':100}], 'ACTIVE_AUTHORITY_DRIFT'
    stable = api(SCRIPT+'/versions/'+VERSION)
    beta = api(PREFIX+'/workers/workers/'+WORKER+'/versions/'+VERSION+'?include=modules')
    modules = []
    for m in beta['modules']:
        raw = base64.b64decode(m['content_base64'],validate=True)
        modules.append({'name':m['name'],'bytes':len(raw),'sha256':sha(raw)})
        assert m['name']=='worker.js' and sha(raw)==MODULE
        OUT.mkdir(parents=True,exist_ok=True);(OUT/'rollback-worker.js').write_bytes(raw)
    assert stable['number']==105 and len(modules)==1
    bound=bindings(beta['bindings']); settings=api(SCRIPT+'/settings')
    assert bound==bindings(settings['bindings']), 'SETTINGS_BINDING_DRIFT'
    latest=api(SCRIPT+'/versions')['items'][0]
    assert latest['id']==VERSION, 'LATEST_INHERITANCE_AUTHORITY_DRIFT'
    domain=[d for d in api(PREFIX+'/workers/domains') if d['hostname']=='binrat.tech']
    assert len(domain)==1 and domain[0]['service']==WORKER
    cron=api(SCRIPT+'/schedules');queue=api(PREFIX+'/queues/c4e67ab772474f08b31648bcc0a7852b')
    assert [s['cron'] for s in cron['schedules']]==['* * * * *']
    assert queue['queue_name']=='binrat-sync-v0' and queue['consumers_total_count']==1
    assert queue['consumers'][0]['script']==WORKER
    return {'at':now(),'versionId':VERSION,'number':105,'deploymentId':active['id'],'traffic':active['versions'],
        'modules':modules,'bindings':bound,'runtime':stable['resources']['script_runtime'],
        'annotations':stable['annotations'],'assetConfig':beta['assets']['config'],
        'urls':beta.get('urls',[]),'schedules':cron,'queue':queue,'domain':domain,
        'routes':api('/zones/'+domain[0]['zone_id']+'/workers/routes'),'latestVersion':latest['id'],
        'secretValuesRead':False,'mutations':0}

def snapshot(base):
    result={'at':now(),'origin':base,'gets':{}}
    for route in ['/health','/api/status','/api/launches/latest']:
        status,raw=get(base+route);result['gets'][route]={'http':status,'sha256':sha(raw),'body':json.loads(raw)}
    return result

def assets():
    manifest=json.loads((ROOT/'.artifacts/v3-frontdoor/manifest.json').read_text())
    paths={f['path'] for f in manifest['files'] if not re.match(r'assets/frontdoor-candidate-.*\.(js|css)$',f['path'])}
    paths.update(p.removeprefix('web/') for p in subprocess.check_output(['git','ls-tree','-r','--name-only','16994bf','web'],cwd=ROOT,text=True).splitlines() if not p.endswith('.html'))
    # Discover the active entry and all absolute resource references transitively.
    def fetch_path(path):
        assert '..' not in Path(path).parts and not path.startswith('/')
        a,raw=get(PRODUCTION+'/'+path);b,other=get(PREVIEW+'/'+path)
        fallback=path!='index.html' and raw.lstrip().lower().startswith((b'<!doctype html',b'<html'))
        valid=a==200 and b==200 and raw==other and not fallback
        if valid:
            dest=OUT/'rollback-site'/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
        return {'path':path,'productionHttp':a,'previewHttp':b,'bytes':len(raw),'sha256':sha(raw),
            'previewSha256':sha(other),'verified':valid,'spaFallback':fallback}, raw
    done={};pending=paths
    while pending:
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            results=list(pool.map(fetch_path,sorted(pending)))
        pending=set()
        for info,raw in results:
            done[info['path']]=info
            if info['verified'] and info['path'].endswith(('.js','.css','.html')):
                for match in re.finditer(r'''["'(](\/(?:assets|fonts|crew|telegram)/[^"'()\s?#]+|/favicon\.png)''',raw.decode()):
                    path=match.group(1)[1:]
                    if path not in done:pending.add(path)
    verified=[x for x in done.values() if x['verified']]
    assert any(re.match(r'assets/frontdoor-candidate-.*\.js$',x['path']) for x in verified)
    assert any(re.match(r'assets/frontdoor-candidate-.*\.css$',x['path']) for x in verified)
    assert all(f['path'] in {x['path'] for x in verified} for f in manifest['files'] if not re.match(r'assets/frontdoor-candidate-.*\.(js|css)$',f['path']))
    return {'at':now(),'versionId':VERSION,'verdict':'PASS','verifiedAssets':verified,
        'unavailableLegacyPaths':[x for x in done.values() if not x['verified']],
        'scope':'Deployed V3 resources plus known retained legacy paths; the provider version retains its complete bound asset snapshot.',
        'providerAssetEnumerationClaimed':False,'mutations':0}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--phase',choices=['before','after'],required=True);parser.add_argument('--assets',action='store_true');args=parser.parse_args()
    auth=tomllib.loads((Path.home()/'.config/.wrangler/config/default.toml').read_text());TOKEN=auth['oauth_token']
    assert datetime.fromisoformat(auth['expiration_time'].replace('Z','+00:00'))>datetime.now(timezone.utc), 'EXISTING_AUTH_EXPIRED_NO_REFRESH_PERFORMED'
    i=identity();save('provider-'+args.phase+'.json',i)
    s=[snapshot(base) for base in [PRODUCTION,PREVIEW]];save('public-'+args.phase+'.json',s)
    print(json.dumps({'phase':args.phase,'identity':'PASS','number':105,'deploymentId':i['deploymentId'],
        'states':{v['origin']:v['gets']['/api/status']['body']['state'] for v in s},'mutations':0}),flush=True)
    if args.assets:
        receipt=assets();save('rollback-assets.json',receipt);print('ROLLBACK_ASSETS_PASS '+str(len(receipt['verifiedAssets'])),flush=True)
