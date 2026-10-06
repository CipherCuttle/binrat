import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { request } from 'node:http';
import { startLocalDen, LOCAL_DEN_MAX_JOBS } from '../src/workforce/localDen.js';

async function setup(t: { after: (fn: () => unknown) => void }) {
  const dir = mkdtempSync(join(tmpdir(),'binrat-local-den-')), path = join(dir,'den.sqlite');
  const app = await startLocalDen({ dbPath:path, port:0 });
  t.after(async () => { await app.close(); rmSync(dir,{recursive:true,force:true}); });
  const page = await fetch(app.url); const html = await page.text();
  const token = /name="binrat-local-token" content="([0-9a-f]{64})"/.exec(html)![1]!;
  const call = (route: string, method = 'GET', value?: unknown, override: Record<string,string> = {}) => fetch(`${app.url}${route}`, {
    method, headers: { 'x-binrat-local-token':token, ...(method === 'POST' ? {origin:app.url,'content-type':'application/json'} : {}), ...override },
    ...(value === undefined ? {} : {body:JSON.stringify(value)})
  });
  return {app,path,token,html,call};
}

test('local Den HTML is excluded from the configured public asset directory', () => {
  assert.match(readFileSync('cloudflare/wrangler.example.jsonc','utf8'),/"directory": "\.\/web"/);
  assert.equal(existsSync('local-den/index.html'),true);
  assert.equal(existsSync('web/local-den'),false);
});

test('local Den admits only loopback same-origin token requests and serves an explicit asset allowlist', async t => {
  const {app,call,html,token} = await setup(t);
  assert.match(html,/OFFLINE REPLAY/); assert.match(html,/No live watcher or sends/);
  assert.equal((await fetch(`${app.url}/api/jobs`)).status,403);
  assert.equal((await call('/api/jobs','GET',undefined,{origin:'https://evil.example'})).status,403);
  const reboundStatus = await new Promise<number>(accept => {
    const req = request(`${app.url}/api/jobs`, {headers:{host:'evil.example','x-binrat-local-token':token}}, response => {
      response.resume(); accept(response.statusCode!);
    }); req.end();
  });
  assert.equal(reboundStatus,403);
  assert.equal((await call('/api/jobs','POST',{scenario:'FINDING',requestId:randomUUID()},{origin:''})).status,403);
  assert.equal((await fetch(`${app.url}/den.sqlite`)).status,404);
  assert.equal((await fetch(`${app.url}/../src/server.ts`)).status,404);
  const page = await fetch(app.url);
  assert.match(page.headers.get('content-security-policy')!,/frame-ancestors 'none'/);
  assert.equal(page.headers.get('cache-control'),'no-store');
  assert.equal((await call('/api/jobs?foo=1')).status,404);
  assert.equal((await call('/api/jobs','PUT')).status,405);
});

test('HTTP create is idempotent, cannot reset budgets and exposes only prepared supported findings', async t => {
  const {call} = await setup(t), requestId = randomUUID();
  const start = {scenario:'FINDING',requestId};
  const created = await (await call('/api/jobs','POST',start)).json() as {jobId:string};
  for (const throughBlock of ['100','101','125']) assert.equal((await call(`/api/jobs/${created.jobId}/advance`,'POST',{throughBlock})).status,200);
  const same = await (await call('/api/jobs','POST',start)).json() as {phase:string;revision:number};
  assert.equal(same.phase,'FOUND'); assert.equal(same.revision,3);
  assert.equal((await call('/api/jobs','POST',{...start,scenario:'EXHAUSTED'})).status,409);
  const returned = await (await call('/api/jobs')).json() as {jobs:any[]};
  assert.equal(returned.jobs[0].usage.toolCalls,5);
  assert.equal(returned.jobs[0].notification.deliveryAuthorized,false);
  assert.equal(returned.jobs[0].localCase.provenance,'SYNTHETIC_OFFLINE_REPLAY');
  const evidence = await (await call(`/api/jobs/${created.jobId}/export`)).json() as {mode:string;journal:unknown[]};
  assert.equal(evidence.mode,'UNVERIFIED_LOCAL_JOURNAL_EXPORT'); assert.equal(evidence.journal.length,4);
});

test('HTTP inputs reject wallet substitution, authority expansion, malformed payloads and backward progress without changing receipts', async t => {
  const {app,call,token} = await setup(t), requestId = randomUUID();
  for (const value of [{scenario:'LIVE',requestId},{scenario:'FINDING',requestId,wallet:'0x123'}, {scenario:'FINDING',requestId,delivery:true}]) {
    assert.equal((await call('/api/jobs','POST',value)).status,400);
  }
  assert.equal((await call('/api/jobs','POST',{scenario:'FINDING',requestId},{'content-type':'text/plain'})).status,415);
  assert.equal((await fetch(`${app.url}/api/jobs`,{method:'POST',headers:{origin:app.url,'x-binrat-local-token':token,'content-type':'application/json'},body:'{'})).status,400);
  assert.equal((await call('/api/jobs','POST',{scenario:'FINDING',requestId,oversize:'x'.repeat(3000)})).status,413);
  const job = await (await call('/api/jobs','POST',{scenario:'FINDING',requestId})).json() as {jobId:string};
  await call(`/api/jobs/${job.jobId}/advance`,'POST',{throughBlock:'101'});
  assert.equal((await call(`/api/jobs/${job.jobId}/advance`,'POST',{throughBlock:'100'})).status,400);
  const data = await (await call('/api/jobs')).json() as {jobs:any[]};
  assert.equal(data.jobs[0].revision,1); assert.equal(data.jobs[0].receipt.throughBlock,'101');
});

test('Den expiry, missing coverage, exhaustion and cancellation retain distinct terminal outcomes', async t => {
  const {call} = await setup(t);
  for (const [scenario,outcome] of [['NO_LAUNCH','NO_FINDING_IN_REPLAY_WINDOW'],['INCOMPLETE_HISTORY','INCOMPLETE_COVERAGE'],['EXHAUSTED','TOOL_BUDGET_EXHAUSTED']]) {
    const job = await (await call('/api/jobs','POST',{scenario,requestId:randomUUID()})).json() as {jobId:string};
    const end = await (await call(`/api/jobs/${job.jobId}/advance`,'POST',{throughBlock:'130'})).json() as any;
    assert.equal(end.outcome,outcome); assert.equal(end.localCase,null); assert.equal(end.notification,null);
  }
  const job = await (await call('/api/jobs','POST',{scenario:'FINDING',requestId:randomUUID()})).json() as {jobId:string};
  await call(`/api/jobs/${job.jobId}/cancel`,'POST',{});
  const after = await (await call(`/api/jobs/${job.jobId}/advance`,'POST',{throughBlock:'125'})).json() as any;
  assert.equal(after.phase,'CANCELLED'); assert.equal(after.receipt,null);
});

test('restarting the HTTP server keeps jobs, rotates its session token and admits no automatic work', async t => {
  const dir=mkdtempSync(join(tmpdir(),'binrat-den-restart-')),path=join(dir,'den.sqlite');
  let app=await startLocalDen({dbPath:path,port:0});
  t.after(async()=>{await app.close();rmSync(dir,{recursive:true,force:true});});
  let html=await (await fetch(app.url)).text(), oldToken=/name="binrat-local-token" content="([0-9a-f]{64})"/.exec(html)![1]!;
  const initial=await fetch(`${app.url}/api/jobs`,{method:'POST',headers:{origin:app.url,'content-type':'application/json','x-binrat-local-token':oldToken},body:JSON.stringify({scenario:'FINDING',requestId:randomUUID()})});
  const job=await initial.json() as {jobId:string};
  await app.close(); app=await startLocalDen({dbPath:path,port:0});
  html=await (await fetch(app.url)).text();const token=/name="binrat-local-token" content="([0-9a-f]{64})"/.exec(html)![1]!;
  assert.notEqual(token,oldToken);
  assert.equal((await fetch(`${app.url}/api/jobs`,{headers:{'x-binrat-local-token':oldToken}})).status,403);
  const data=await (await fetch(`${app.url}/api/jobs`,{headers:{'x-binrat-local-token':token}})).json() as {jobs:any[]};
  assert.equal(data.jobs[0].jobId,job.jobId);assert.equal(data.jobs[0].phase,'READY');assert.equal(data.jobs[0].revision,0);
});

test('one damaged journal does not hide other verified jobs and remains exportable as raw evidence', async t => {
  const {call,path}=await setup(t);
  const good=await (await call('/api/jobs','POST',{scenario:'FINDING',requestId:randomUUID()})).json() as {jobId:string};
  const broken=await (await call('/api/jobs','POST',{scenario:'NO_LAUNCH',requestId:randomUUID()})).json() as {jobId:string};
  const db=new Database(path);db.prepare('UPDATE local_rat_journal SET snapshot_json = ? WHERE job_id = ?').run('{}',broken.jobId);db.close();
  const data=await (await call('/api/jobs')).json() as {jobs:any[]};
  assert.equal(data.jobs.find(job=>job.jobId===good.jobId).verification,'VERIFIED');
  assert.equal(data.jobs.find(job=>job.jobId===broken.jobId).verification,'FAILED');
  assert.equal((await call(`/api/jobs/${broken.jobId}/export`)).status,200);
  assert.equal((await call(`/api/jobs/${broken.jobId}/advance`,'POST',{throughBlock:'125'})).status,500);
});

test('bounded persisted Den capacity rejects new jobs while duplicate requests retain their original job', async t => {
  const {call}=await setup(t), first=randomUUID();
  for(let index=0;index<LOCAL_DEN_MAX_JOBS;index++)assert.equal((await call('/api/jobs','POST',{scenario:'FINDING',requestId:index===0?first:randomUUID()})).status,200);
  assert.equal((await call('/api/jobs','POST',{scenario:'FINDING',requestId:randomUUID()})).status,409);
  assert.equal((await call('/api/jobs','POST',{scenario:'FINDING',requestId:first})).status,200);
  const data=await (await call('/api/jobs')).json() as {jobs:unknown[]};assert.equal(data.jobs.length,LOCAL_DEN_MAX_JOBS);
});
