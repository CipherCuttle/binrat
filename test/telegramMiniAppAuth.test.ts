import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { verifyTelegramInitData } from '../src/telegram/miniAppAuth.js';

const TOKEN = '123456789:abcdefghijklmnopqrstuvwxyzABCDE12345';
function signed(fields: Record<string,string>): string {
  const check=Object.entries(fields).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  const secret=createHmac('sha256','WebAppData').update(TOKEN).digest();
  const hash=createHmac('sha256',secret).update(check).digest('hex');
  return new URLSearchParams({...fields,hash}).toString();
}

test('verifies Telegram initData and binds private identity to the signed user', () => {
  const now=1_800_000_000_000;
  const input=signed({auth_date:String(Math.floor(now/1000)-5),query_id:'q1',user:JSON.stringify({id:777,first_name:'Rat'})});
  const principal=verifyTelegramInitData(input,TOKEN,now,300);
  assert.deepEqual({userId:principal.userId,chatId:principal.chatId,queryId:principal.queryId},{userId:777,chatId:777,queryId:'q1'});
});

test('includes Telegram optional signature in first-party HMAC data-check-string', () => {
  const now=1_800_000_000_000;
  const input=signed({auth_date:String(Math.floor(now/1000)),signature:'telegram-ed25519-value',user:JSON.stringify({id:777})});
  assert.equal(verifyTelegramInitData(input,TOKEN,now,300).userId,777);
  const removed=new URLSearchParams(input); removed.delete('signature');
  assert.throws(()=>verifyTelegramInitData(removed.toString(),TOKEN,now,300),/MINI_APP_AUTH_INVALID/);
});

test('rejects expired initData', () => {
  const now=1_800_000_000_000;
  const input=signed({auth_date:String(Math.floor(now/1000)-301),user:JSON.stringify({id:777})});
  assert.throws(()=>verifyTelegramInitData(input,TOKEN,now,300),/MINI_APP_AUTH_INVALID/);
});

test('rejects forged browser identity even when another payload was signed', () => {
  const now=1_800_000_000_000;
  const valid=signed({auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:777})});
  const forged=valid.replace(encodeURIComponent('{"id":777}'),encodeURIComponent('{"id":778}'));
  assert.throws(()=>verifyTelegramInitData(forged,TOKEN,now,300),/MINI_APP_AUTH_INVALID/);
});
