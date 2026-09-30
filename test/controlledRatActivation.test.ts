import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { D1CompatDatabase } from './support/d1Compat.js';

const helper = pathToFileURL(new URL('../scripts/controlled-rat-activation.mjs',import.meta.url).pathname).href;
function evaluate<T>(expression:string): T {
  const source=`import * as h from ${JSON.stringify(helper)}; console.log(JSON.stringify(${expression}));`;
  return JSON.parse(execFileSync(process.execPath,['--input-type=module','--eval',source],{encoding:'utf8'}));
}

test('UI V2 activation is dispatch-only, exact-branch and exact-confirmation gated', () => {
  const sha='a'.repeat(40);
  assert.equal(evaluate<string>(`h.activationGateError(h.ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE,{ref:'refs/heads/codex/telegram-as-code-private-v2',eventName:'workflow_dispatch',confirmation:h.UI_V2_CONFIRMATION,reviewedSha:'${sha}',githubSha:'${sha}'})`),null);
  assert.equal(evaluate(`h.activationGateError(h.ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE,{ref:'refs/heads/feat/binrat-telegram-ux-v2',eventName:'push',confirmation:h.UI_V2_CONFIRMATION,reviewedSha:'${sha}',githubSha:'${sha}'})`),'TELEGRAM_UI_V2_DISPATCH_ONLY');
  assert.equal(evaluate(`h.activationGateError(h.ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE,{ref:'refs/heads/other',eventName:'workflow_dispatch',confirmation:h.UI_V2_CONFIRMATION,reviewedSha:'${sha}',githubSha:'${sha}'})`),'REF_NOT_CONTROLLED_RAT_BRANCH');
  assert.equal(evaluate(`h.activationGateError(h.ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE,{ref:'refs/heads/feat/binrat-telegram-ux-v2',eventName:'workflow_dispatch',confirmation:'wrong',reviewedSha:'${sha}',githubSha:'${sha}'})`),'TELEGRAM_UI_V2_CONFIRMATION_REQUIRED');
  assert.equal(evaluate(`h.activationGateError(h.ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE,{ref:'refs/heads/feat/binrat-telegram-ux-v2',eventName:'workflow_dispatch',confirmation:h.UI_V2_CONFIRMATION,reviewedSha:'${'b'.repeat(40)}',githubSha:'${sha}'})`),'TELEGRAM_UI_V2_REVIEWED_SHA_MISMATCH');
});

test('workflow keeps UI V2 off the push trigger and exposes only explicit dispatch modes', () => {
  const workflow=readFileSync(new URL('../.github/workflows/controlled-rat-private-rollout.yml',import.meta.url),'utf8');
  assert.match(workflow,/push:\n\s+branches:\n\s+- feat\/binrat-robinhood-live-rat-v1/);
  assert.doesNotMatch(workflow,/push:\n\s+branches:[\s\S]*feat\/binrat-telegram-ux-v2/);
  assert.match(workflow,/activation_mode:[\s\S]*telegram-ui-v2-private/);
  assert.match(workflow,/confirmation:[\s\S]*ENABLE_PRIVATE_TELEGRAM_UI_V2/);
  assert.match(workflow,/reviewed_sha:[\s\S]*Exact 40-character commit SHA/);
  assert.match(workflow,/CONTROLLED_RAT_ACTIVATION_MODE/);
});

test('activation modes generate only their explicit private flag sets', () => {
  const sha='6b6ddeda1d64803f8afcc01373079a8313bb93ba';
  const text=evaluate<Record<string,string>>(`h.candidateVars(h.ACTIVATION_MODE.TEXT_PRIVATE,'${sha}')`);
  const ui=evaluate<Record<string,string>>(`h.candidateVars(h.ACTIVATION_MODE.TELEGRAM_UI_V2_PRIVATE,'${sha}')`);
  assert.deepEqual([text.BINRAT_AUTONOMOUS_RAT_ENABLED,text.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED,text.BINRAT_TELEGRAM_UI_V2_ENABLED,text.BINRAT_TELEGRAM_MEDIA_ENABLED],['true','false','false','false']);
  assert.deepEqual([ui.BINRAT_AUTONOMOUS_RAT_ENABLED,ui.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED,ui.BINRAT_TELEGRAM_UI_V2_ENABLED,ui.BINRAT_TELEGRAM_MEDIA_ENABLED],['true','false','true','true']);
  assert.deepEqual(
    [ui.BINRAT_PONS_MAX_BATCH_BLOCKS,ui.BINRAT_PONS_CATCHUP_MAX_BATCH_BLOCKS,ui.BINRAT_PONS_CATCHUP_MAX_BATCHES,ui.BINRAT_PONS_CATCHUP_WORK_BUDGET_MS,ui.BINRAT_PONS_NEAR_HEAD_BLOCKS,ui.BINRAT_PONS_MAX_CANONICAL_LAUNCH_BLOCKS],
    ['512','4096','4','60000','2048','128']
  );
});

test('candidate version lookup accepts the Wrangler annotation tag but no untagged or malformed version', () => {
  const tag='controlled-rat-aaaaaaaaaaaa';
  const candidate={id:'89d74e01-ce7f-44cb-a777-c2a5fa283747',annotations:{'workers/tag':tag}};
  assert.equal(evaluate(`h.taggedVersionIdFromList(${JSON.stringify([candidate])},'${tag}')`),candidate.id);
  assert.equal(evaluate(`h.taggedVersionIdFromList(${JSON.stringify([{id:candidate.id,annotations:{}}])},'${tag}')`),null);
  assert.equal(evaluate(`h.taggedVersionIdFromList(${JSON.stringify([{id:'not-a-version',annotations:{'workers/tag':tag}}])},'${tag}')`),null);
});

test('postdeploy acceptance requires the exact reviewed release SHA', () => {
  const sha='c'.repeat(40);
  assert.equal(evaluate(`h.isExactPostdeployRelease({ok:true,releaseSha:'${sha}'},'${sha}')`),true);
  assert.equal(evaluate(`h.isExactPostdeployRelease({ok:true,releaseSha:'${'d'.repeat(40)}'},'${sha}')`),false);
  assert.equal(evaluate(`h.isExactPostdeployRelease({ok:false,releaseSha:'${sha}'},'${sha}')`),false);
});

test('committed example defaults retain all autonomous Telegram flags off', () => {
  const example=readFileSync(new URL('../cloudflare/wrangler.example.jsonc',import.meta.url),'utf8');
  for (const flag of [
    'BINRAT_AUTONOMOUS_RAT_ENABLED',
    'BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED',
    'BINRAT_TELEGRAM_UI_V2_ENABLED',
    'BINRAT_TELEGRAM_MEDIA_ENABLED'
  ]) assert.match(example,new RegExp(`"${flag}"\\s*:\\s*"false"`));
});

test('runtime deployment requires the explicitly reviewed exact checkout SHA', () => {
  const script=readFileSync(new URL('../scripts/deploy-controlled-rat.mjs',import.meta.url),'utf8');
  assert.match(script,/checkoutSha === process\.env\.GITHUB_SHA && checkoutSha === process\.env\.CONTROLLED_RAT_REVIEWED_SHA/);
  assert.doesNotMatch(script,/git', \['diff'/);
});

test('prompt schema preflight accepts only the exact additive shape and selects only its migration', () => {
  const compatible={tableSql:"CREATE TABLE rat_ui_prompts (chat_id INTEGER NOT NULL, user_id INTEGER NOT NULL, action TEXT NOT NULL CHECK(action = 'DIG'), source_update_id INTEGER NOT NULL, card_message_id INTEGER NOT NULL, prompt_message_id INTEGER NOT NULL, created_at_ms INTEGER NOT NULL, expires_at_ms INTEGER NOT NULL, PRIMARY KEY(chat_id,user_id))",expiryIndexSql:'CREATE INDEX idx_rat_ui_prompts_expiry ON rat_ui_prompts(expires_at_ms)',columnShape:'chat_id:INTEGER:1:1|user_id:INTEGER:1:2|action:TEXT:1:0|source_update_id:INTEGER:1:0|card_message_id:INTEGER:1:0|prompt_message_id:INTEGER:1:0|created_at_ms:INTEGER:1:0|expires_at_ms:INTEGER:1:0'};
  assert.equal(evaluate(`h.promptSchemaDecision(${JSON.stringify(compatible)})`),'COMPATIBLE');
  assert.deepEqual(evaluate(`h.promptSchemaPlan('MISSING')`),{action:'APPLY_EXACT_MIGRATION',migration:'cloudflare/migrations/20260930_telegram_ui_v2_prompts.sql'});
  assert.equal(evaluate(`h.promptSchemaDecision(${JSON.stringify({...compatible,columnShape:'chat_id:INTEGER:1:1'})})`),'INCOMPATIBLE');
  assert.equal(evaluate(`h.promptSchemaDecision({tableSql:null,expiryIndexSql:null,columnShape:''})`),'MISSING');
});

test('the exact local prompt migration produces the schema accepted by the future remote preflight', async () => {
  const db=new D1CompatDatabase();
  try {
    await db.exec(readFileSync(new URL('../cloudflare/migrations/20260930_telegram_ui_v2_prompts.sql',import.meta.url),'utf8'));
    const table=await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='rat_ui_prompts'").first<{sql:string}>();
    const index=await db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_rat_ui_prompts_expiry'").first<{sql:string}>();
    const shape=await db.prepare("SELECT group_concat(shape, '|') AS column_shape FROM (SELECT name || ':' || upper(type) || ':' || \"notnull\" || ':' || pk AS shape FROM pragma_table_info('rat_ui_prompts') ORDER BY cid)").first<{column_shape:string}>();
    assert.equal(evaluate(`h.promptSchemaDecision(${JSON.stringify({tableSql:table?.sql,expiryIndexSql:index?.sql,columnShape:shape?.column_shape})})`),'COMPATIBLE');
  } finally { db.close(); }
});

test('activation harness never includes a prompt-table drop and retains additive schema on rollback', () => {
  const script=readFileSync(new URL('../scripts/deploy-controlled-rat.mjs',import.meta.url),'utf8');
  assert.match(script,/--file',initial\.migration/);
  assert.doesNotMatch(script,/DROP\s+TABLE\s+rat_ui_prompts/i);
  assert.match(script,/Candidate binding parity PASS; candidate remained non-live until this point\.'\);\n\n  \/\/ Treat a transport-ambiguous promotion result[\s\S]*promotionAttempted = true/);
  assert.match(script,/if \(promotionAttempted && previousVersion\)/);
  assert.equal(evaluate(`h.rollbackSchemaNotice(true)`),'ROLLBACK_CODE_ONLY: additive Telegram prompt schema retained.');
});
