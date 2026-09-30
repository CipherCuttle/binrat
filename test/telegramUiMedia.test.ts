import assert from 'node:assert/strict';
import test from 'node:test';
import { editCard, sendCard } from '../src/telegram/ui/client.js';
import type { RatCard } from '../src/telegram/ui/types.js';

const card:RatCard={rendererVersion:'binrat.telegram-ui/2.0',view:'HOME',media:'idle-neutral',caption:'🐀 card',keyboard:[]};

test('UI V2 media flag selects text or approved photo transport and definitive photo rejection falls back once', async () => {
  const textCalls:string[]=[];
  const text:typeof fetch=async url=>{textCalls.push(String(url).split('/').at(-1)!);return Response.json({ok:true,result:{message_id:1}});};
  await sendCard('token',77,'https://binrat.example',card,false,text);
  assert.deepEqual(textCalls,['sendMessage']);
  const mediaCalls:string[]=[];
  const media:typeof fetch=async (url,init)=>{mediaCalls.push(String(url).split('/').at(-1)!);assert.match(String(init?.body),/assets\/telegram\/idle-neutral\.png/);return Response.json({ok:true,result:{message_id:2}});};
  await sendCard('token',77,'https://binrat.example',card,true,media);
  assert.deepEqual(mediaCalls,['sendPhoto']);
  const fallbackCalls:string[]=[];
  const fallback:typeof fetch=async url=>{const method=String(url).split('/').at(-1)!;fallbackCalls.push(method);return method==='sendPhoto'?new Response(JSON.stringify({ok:false}),{status:400}):Response.json({ok:true,result:{message_id:3}});};
  await sendCard('token',77,'https://binrat.example',card,true,fallback);
  assert.deepEqual(fallbackCalls,['sendPhoto','sendMessage']);
});

test('media disabled edits do not fetch or replace Rat artwork', async () => {
  const calls:Array<{method:string;body:string}>=[];
  const api:typeof fetch=async (url,init)=>{calls.push({method:String(url).split('/').at(-1)!,body:String(init?.body)});return Response.json({ok:true,result:{message_id:1}});};
  await editCard('token',77,1,'https://binrat.example',card,false,api);
  assert.deepEqual(calls.map(call=>call.method),['editMessageCaption']);
  assert.doesNotMatch(calls[0]!.body,/assets\/telegram/);
});
