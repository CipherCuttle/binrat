import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramBotApiClient, redactTelegramSecrets } from '../src/telegram/configApi.js';
import { applyTelegramConfig, diffTelegramConfig, planTelegramConfig, type TelegramConfigApi } from '../src/telegram/configManager.js';
import { telegramProductConfig } from '../src/telegram/config.js';

class FakeApi implements TelegramConfigApi {
  calls: Array<{method:string;body:Record<string,unknown>}> = [];
  photo=true;
  state={name:'old',description:'old',shortDescription:'old',menuButton:{type:'commands'} as Record<string,unknown>,commands:[[],[]] as unknown[][],webhook:telegramProductConfig.webhook.url};
  async call<T>(method:string,body:Record<string,unknown>={}):Promise<T>{
    this.calls.push({method,body});
    if(method==='getMe') return {id:99,is_bot:true,first_name:'BINRAT',username:'BinratBot'} as T;
    if(method==='getMyName') return {name:this.state.name} as T;
    if(method==='getMyDescription') return {description:this.state.description} as T;
    if(method==='getMyShortDescription') return {short_description:this.state.shortDescription} as T;
    if(method==='getChatMenuButton') return this.state.menuButton as T;
    if(method==='getWebhookInfo') return {url:this.state.webhook} as T;
    if(method==='getUserProfilePhotos') return {total_count:this.photo?1:0,photos:this.photo?[[{file_id:'x',file_unique_id:'y'}]]:[]} as T;
    if(method==='getMyCommands') { const type=(body.scope as {type:string}).type; return this.state.commands[type==='default'?0:1] as T; }
    if(method==='setMyName') this.state.name=String(body.name);
    if(method==='setMyDescription') this.state.description=String(body.description);
    if(method==='setMyShortDescription') this.state.shortDescription=String(body.short_description);
    if(method==='setChatMenuButton') this.state.menuButton=body.menu_button as Record<string,unknown>;
    if(method==='setMyCommands') { const type=(body.scope as {type:string}).type; this.state.commands[type==='default'?0:1]=body.commands as unknown[]; }
    return true as T;
  }
  async setProfilePhoto():Promise<boolean>{this.photo=true;this.calls.push({method:'setMyProfilePhoto',body:{}});return true;}
}

test('configuration diff includes scoped commands and Mini App menu drift', async () => {
  const plan=await planTelegramConfig(new FakeApi());
  assert.equal(plan.diffs.find(row=>row.key==='MENU BUTTON')?.status,'update_required');
  assert.equal(plan.diffs.filter(row=>row.key.startsWith('COMMANDS ')).length,2);
  assert.equal(plan.diffs.find(row=>row.key==='WEBHOOK')?.status,'unchanged');
});

test('apply changes only drift and is idempotent', async () => {
  const api=new FakeApi(); api.photo=false;
  await applyTelegramConfig(api);
  const mutations=api.calls.filter(call=>call.method.startsWith('set')).length;
  assert.equal(mutations,7);
  api.calls=[];
  const result=await applyTelegramConfig(api);
  assert.equal(api.calls.filter(call=>call.method.startsWith('set')).length,0);
  assert.equal(result.some(row=>row.status==='update_required'),false);
});

test('unexpected webhook drift blocks every mutation', async () => {
  const api=new FakeApi(); api.state.webhook='https://unexpected.example/webhook';
  await assert.rejects(()=>applyTelegramConfig(api),/TELEGRAM_CONFIG_BLOCKED:WEBHOOK/);
  assert.equal(api.calls.some(call=>call.method.startsWith('set')),false);
});

test('BotFather-only username drift is blocking, never presented as an API update', () => {
  const actual={me:{id:1,is_bot:true,first_name:'BINRAT',username:'WrongBot'},name:'BINRAT',description:telegramProductConfig.description,shortDescription:telegramProductConfig.shortDescription,commands:telegramProductConfig.commandScopes.map(x=>[...x.commands]),menuButton:telegramProductConfig.menuButton,webhook:{url:telegramProductConfig.webhook.url},profilePhotoPresent:true};
  const row=diffTelegramConfig(actual).find(item=>item.key==='BOT USERNAME');
  assert.equal(row?.status,'blocked');
  assert.equal(row?.method,undefined);
});

test('Bot API client parses ok and respects retry_after', async () => {
  let calls=0; const sleeps:number[]=[];
  const fetchImpl=async()=>{calls++;return calls===1
    ? new Response(JSON.stringify({ok:false,parameters:{retry_after:2}}),{status:429,headers:{'content-type':'application/json'}})
    : new Response(JSON.stringify({ok:true,result:{name:'BINRAT'}}),{status:200,headers:{'content-type':'application/json'}});};
  const api=new TelegramBotApiClient('123456:secret-token-value-long-enough',fetchImpl as typeof fetch,async ms=>{sleeps.push(ms);});
  assert.deepEqual(await api.call('getMyName'),{name:'BINRAT'});
  assert.deepEqual(sleeps,[2000]);
});

test('token redaction covers exact tokens and Bot API URLs', () => {
  const token='123456789:abcdefghijklmnopqrstuvwxyzABCDE12345';
  const redacted=redactTelegramSecrets(`failed https://api.telegram.org/bot${token}/getMe ${token}`,token);
  assert.equal(redacted.includes(token),false);
  assert.match(redacted,/REDACTED_TELEGRAM_TOKEN/);
});

test('readback drift treats profile presence honestly', () => {
  const actual={me:{id:1,is_bot:true,first_name:'BINRAT',username:'BinratBot'},name:'BINRAT',description:telegramProductConfig.description,shortDescription:telegramProductConfig.shortDescription,commands:telegramProductConfig.commandScopes.map(x=>[...x.commands]),menuButton:telegramProductConfig.menuButton,webhook:{url:telegramProductConfig.webhook.url},profilePhotoPresent:true};
  const rows=diffTelegramConfig(actual);
  assert.equal(rows.find(row=>row.key==='PROFILE PHOTO')?.status,'verification_unavailable');
  assert.equal(rows.find(row=>row.key==='MENU BUTTON')?.status,'unchanged');
});
