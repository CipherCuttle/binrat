import assert from 'node:assert/strict';
import test from 'node:test';
import { handleWorkerRequest } from '../src/cloudflare/worker.js';
import { autonomousFixture } from './support/autonomousFixture.js';
import { CREATOR } from './support/autonomousFixture.js';
import { dig } from '../src/autonomous/evidence.js';

function callbackRequest(updateId:number, from:number, chatId:number, type:string, data:string) {
  return new Request('https://fixture.invalid/telegram/webhook',{method:'POST',headers:{'content-type':'application/json','x-telegram-bot-api-secret-token':'fixture-secret'},body:JSON.stringify({update_id:updateId,callback_query:{id:`cb-${updateId}`,from:{id:from},data,message:{message_id:91,chat:{id:chatId,type},from:{id:77}}}})});
}

test('callback acknowledgement precedes card edit and controlled actor is re-authorized', async () => {
  const f=await autonomousFixture(); const calls:string[]=[];
  try {
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true',BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED:'false',BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID:'77'});
    const api:typeof fetch=async (url) => { const method=String(url).split('/').at(-1)!; calls.push(method);
      if(method==='answerCallbackQuery') return Response.json({ok:true,result:true});
      if(method==='editMessageMedia') return Response.json({ok:true,result:{message_id:91}});
      throw new Error('UNEXPECTED_TELEGRAM_'+method); };
    const accepted=await handleWorkerRequest(callbackRequest(880,77,77,'private','br2:h'),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(accepted.status,200); assert.deepEqual(calls,['answerCallbackQuery','editMessageMedia']);
    calls.length=0;
    const denied=await handleWorkerRequest(callbackRequest(881,88,77,'private','br2:h'),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(denied.status,200); assert.deepEqual(calls,['answerCallbackQuery']);
    calls.length=0;
    const group=await handleWorkerRequest(callbackRequest(882,77,-100,'group','br2:h'),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(group.status,200); assert.deepEqual(calls,['answerCallbackQuery']);
  } finally { f.db.close(); }
});

test('FULL callback sends the canonical legacy receipt without truncating the card summary', async () => {
  const f=await autonomousFixture(); const calls:string[]=[];
  try {
    Object.assign(f.env,{BINRAT_TELEGRAM_UI_V2_ENABLED:'true'});
    const receipt=await dig(f.db,{chainId:4663,entityType:'CREATOR',entityId:CREATOR},f.now());
    const api:typeof fetch=async (url) => { const method=String(url).split('/').at(-1)!; calls.push(method);
      if(method==='answerCallbackQuery'||method==='editMessageMedia') return Response.json({ok:true,result:method==='editMessageMedia'?{message_id:91}:true});
      if(method==='sendMessage') return Response.json({ok:true,result:{message_id:92}});
      throw new Error('UNEXPECTED_TELEGRAM_'+method); };
    const response=await handleWorkerRequest(callbackRequest(883,77,77,'private',`br2:f:${receipt.shareId}`),f.env,{now:f.now,externalFetch:api,watchSource:f.source});
    assert.equal(response.status,200); assert.deepEqual(calls,['answerCallbackQuery','sendMessage','editMessageMedia']);
  } finally { f.db.close(); }
});
