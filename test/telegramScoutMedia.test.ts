import assert from 'node:assert/strict';
import test from 'node:test';
import { editScoutPoster, scoutPosterUrl, scoutResultMood, sendScoutDiggingPoster } from '../src/telegram/scoutMedia.js';
import type { ScoutProjection } from '../src/telegram/scout.js';
import { SCOUT_SCHEMA_VERSION } from '../src/telegram/scout.js';

function projection(counts: number[]): ScoutProjection {
  return {
    schemaVersion:SCOUT_SCHEMA_VERSION,chainId:5042,source:'ARCPAD',role:'ARCPAD_REPORTED_CREATOR',
    asOfBlock:'100',historyCoverage:'UNVERIFIED',windowStartMs:1000,windowEndMs:2000,
    observedInWindow:counts.length,excludedNoTimestamp:0,excludedConflictingTimestamp:0,
    candidates:counts.map((count,i)=>({
      role:'ARCPAD_REPORTED_CREATOR',address:'0x'+(i+1).toString(16).padStart(40,'0'),
      launchCount14d:count,latestLaunchTimestampMs:1700000000000,launches:[]
    })),
    metrics:{marketCapUsd:null,volume24hUsd:null,
      reason:'NO_VERIFIED_USD_PRICE_OR_CIRCULATING_SUPPLY_OR_COMPLETE_SWAP_VOLUME'},
    recommendationBoundary:'Not a trading recommendation.'
  };
}
const ok=()=>new Response(JSON.stringify({ok:true,result:{message_id:77}}),{status:200});
test('Scout moods use only source-derived first-party state assets with strict HTTPS origin',()=>{
  assert.equal(scoutResultMood(null),'error');
  assert.equal(scoutResultMood(projection([])),'empty-paws');
  assert.equal(scoutResultMood(projection([1])),'evidence-found');
  assert.equal(scoutResultMood(projection([1,2])),'repeat-creator');
  assert.equal(scoutPosterUrl('https://binrat.test'),'https://binrat.test/assets/telegram/digging.png');
  assert.throws(()=>scoutPosterUrl('http://binrat.test'),/ORIGIN_INVALID/);
  assert.throws(()=>scoutPosterUrl('https://user:pass@binrat.test'),/ORIGIN_INVALID/);
});
test('Scout sends one digging image and edits its media/caption on the SAME message, no callback buttons',async()=>{
  const calls:Array<{endpoint:string;data:any}>=[];
  const fetchMock:typeof fetch=async(input,init)=>{
    calls.push({endpoint:String(input).split('/').pop()!,data:JSON.parse(String(init?.body))});
    return ok();
  };
  const chat=49,origin='https://binrat.test',token='test';
  const id=await sendScoutDiggingPoster(token,chat,origin,fetchMock);
  assert.equal(id,77);
  await editScoutPoster(token,chat,id,'Found one indexed source-backed creator.',projection([2]),origin,fetchMock);
  assert.deepEqual(calls.map(c=>c.endpoint),['sendPhoto','editMessageMedia']);
  assert.match(calls[0]!.data.photo,/\/assets\/telegram\/digging\.png$/);
  assert.equal(calls[1]!.data.message_id,id);
  assert.match(calls[1]!.data.media.media,/\/assets\/telegram\/repeat-creator\.png$/);
  assert.equal(calls[1]!.data.media.caption,'Found one indexed source-backed creator.');
  assert.equal(calls[1]!.data.reply_markup.inline_keyboard[0][0].callback_data,undefined);
  assert.match(calls[1]!.data.reply_markup.inline_keyboard[0][0].url,/\/api\/creator\/0x/);
});
test('Unsupported mood media falls back to caption edit of existing message; transient errors preserve retry fence',async()=>{
  const calls:string[]=[];
  const permanent:typeof fetch=async(input,init)=>{
    const endpoint=String(input).split('/').pop()!;
    calls.push(endpoint);
    const body=JSON.parse(String(init?.body));
    assert.equal(body.message_id,77);
    return endpoint==='editMessageMedia'
      ? new Response(JSON.stringify({ok:false,description:'Bad Request: failed to get HTTP URL content'}),{status:400})
      : ok();
  };
  await editScoutPoster('test',5,77,'No source-timestamped launches.',projection([]),'https://binrat.test',permanent);
  assert.deepEqual(calls,['editMessageMedia','editMessageCaption']);
  let attempts=0;
  const transient:typeof fetch=async(input)=>{
    attempts++;
    assert.match(String(input),/editMessageMedia$/);
    return new Response(JSON.stringify({ok:false}),{status:502});
  };
  await assert.rejects(editScoutPoster('test',5,77,'Source unavailable',null,'https://binrat.test',transient),
    /TELEGRAM_SCOUT_EDIT_FAILED/);
  assert.equal(attempts,1,'no duplicate and no caption fallback on transient failure');
});

test('Replay after a committed Telegram edit accepts only explicit message-is-not-modified',async()=>{
  const requestMedia:string[]=[];
  const applied:typeof fetch=async(input)=>{
    requestMedia.push(String(input).split('/').pop()!);
    return new Response(JSON.stringify({ok:false,description:'Bad Request: message is not modified'}),{status:400});
  };
  await editScoutPoster('test',5,77,'Already sent',projection([1]),'https://binrat.test',applied);
  assert.deepEqual(requestMedia,['editMessageMedia'],'already applied media must not trigger a second API edit');
  const fallback:string[]=[];
  const captionAlreadyApplied:typeof fetch=async(input)=>{
    const endpoint=String(input).split('/').pop()!;
    fallback.push(endpoint);
    return endpoint==='editMessageMedia'
      ? new Response(JSON.stringify({ok:false,description:'Bad Request: failed to get HTTP URL content'}),{status:400})
      : new Response(JSON.stringify({ok:false,description:'Bad Request: message is not modified'}),{status:400});
  };
  await editScoutPoster('test',5,77,'Already sent',projection([]),'https://binrat.test',captionAlreadyApplied);
  assert.deepEqual(fallback,['editMessageMedia','editMessageCaption']);
  let requests=0;
  const unknown400:typeof fetch=async()=>{requests++;
    return new Response(JSON.stringify({ok:false,description:'Bad Request: message not found'}),{status:400});
  };
  await assert.rejects(editScoutPoster('test',5,77,'No edit proof',projection([]),'https://binrat.test',unknown400),
    /TELEGRAM_SCOUT_EDIT_FAILED/);
  assert.equal(requests,2,'unknown 400 is NOT silently accepted');
});
