import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramBotApiClient, redactTelegramSecrets } from '../src/telegram/configApi.js';
import {
  activatePrivateTesterMenu, applyTelegramConfig, diffTelegramConfig, normalizeMenuButton, planTelegramConfig,
  restorePrivateTesterMenu, snapshotPrivateTesterMenu, verifyMenuButton, type TelegramConfigApi
} from '../src/telegram/configManager.js';
import { telegramProductConfig } from '../src/telegram/config.js';

const tester = '123456789';
const commands = { type: 'commands' } as Record<string, unknown>;
const webApp = { type: 'web_app', text: 'OPEN BINRAT', web_app: { url: 'https://binrat-edge-v0.pettevik.workers.dev/app/' } } as Record<string, unknown>;

class FakeApi implements TelegramConfigApi {
  calls: Array<{method:string;body:Record<string,unknown>}> = [];
  photo = true;
  state = { name:'old', description:'old', shortDescription:'old', globalMenu:commands, testerMenu:{type:'default'} as Record<string,unknown>, commands:[[],[]] as unknown[][], webhook:telegramProductConfig.webhook.url };
  testerReadbacks: Record<string, unknown>[] = [];
  async call<T>(method:string, body:Record<string,unknown>={}):Promise<T> {
    this.calls.push({method,body});
    if(method==='getMe') return {id:99,is_bot:true,first_name:'BINRAT',username:'BinratBot'} as T;
    if(method==='getMyName') return {name:this.state.name} as T;
    if(method==='getMyDescription') return {description:this.state.description} as T;
    if(method==='getMyShortDescription') return {short_description:this.state.shortDescription} as T;
    if(method==='getChatMenuButton') return (body.chat_id ? this.testerReadbacks.shift() ?? this.state.testerMenu : this.state.globalMenu) as T;
    if(method==='getWebhookInfo') return {url:this.state.webhook} as T;
    if(method==='getUserProfilePhotos') return {total_count:this.photo?1:0,photos:this.photo?[[{file_id:'x',file_unique_id:'y'}]]:[]} as T;
    if(method==='getMyCommands') { const type=(body.scope as {type:string}).type; return this.state.commands[type==='default'?0:1] as T; }
    if(method==='setMyName') this.state.name=String(body.name);
    if(method==='setMyDescription') this.state.description=String(body.description);
    if(method==='setMyShortDescription') this.state.shortDescription=String(body.short_description);
    if(method==='setChatMenuButton') {
      if (body.chat_id) this.state.testerMenu=body.menu_button as Record<string,unknown>;
      else this.state.globalMenu=body.menu_button as Record<string,unknown>;
    }
    if(method==='setMyCommands') { const type=(body.scope as {type:string}).type; this.state.commands[type==='default'?0:1]=body.commands as unknown[]; }
    return true as T;
  }
  async setProfilePhoto():Promise<boolean>{this.photo=true;this.calls.push({method:'setMyProfilePhoto',body:{}});return true;}
}
const noWait = async () => {};

test('global configuration preserves the default commands menu and is idempotent', async () => {
  const plan=await planTelegramConfig(new FakeApi());
  assert.equal(plan.diffs.find(row=>row.key==='GLOBAL MENU BUTTON')?.status,'unchanged');
  const api=new FakeApi(); api.photo=false;
  await applyTelegramConfig(api);
  assert.equal(api.calls.filter(call=>call.method.startsWith('set')).length,6);
  assert.equal(api.calls.some(call=>call.method==='setChatMenuButton'),false);
  api.calls=[];
  const result=await applyTelegramConfig(api);
  assert.equal(api.calls.filter(call=>call.method.startsWith('set')).length,0);
  assert.equal(result.some(row=>row.status==='update_required'),false);
});

test('private activation mutates only the controlled tester scope and preserves global commands', async () => {
  const api = new FakeApi();
  const snapshot = await snapshotPrivateTesterMenu(api, tester);
  await activatePrivateTesterMenu(api, tester, telegramProductConfig, noWait, [0], snapshot);
  const menuSets = api.calls.filter(call=>call.method==='setChatMenuButton');
  assert.deepEqual(menuSets, [{ method:'setChatMenuButton', body:{chat_id:Number(tester),menu_button:webApp} }]);
  assert.deepEqual(api.state.globalMenu,commands);
  assert.deepEqual(api.state.testerMenu,webApp);
});

test('bounded tester readback accepts delayed Bot API propagation', async () => {
  const api = new FakeApi();
  api.testerReadbacks = [commands, commands, webApp];
  await verifyMenuButton(api, normalizeMenuButton(webApp), tester, noWait, [0, 0, 0]);
});

test('persistent, wrong-text, and wrong-URL menu readback fail closed', async () => {
  for (const wrong of [commands, { ...webApp, text:'WRONG' }, { ...webApp, web_app:{url:'https://binrat-edge-v0.pettevik.workers.dev/app'} }]) {
    const api = new FakeApi(); api.state.testerMenu=wrong;
    await assert.rejects(() => verifyMenuButton(api, normalizeMenuButton(webApp), tester, noWait, [0,0]), /TELEGRAM_MENU_BUTTON_VERIFY_FAILED/);
  }
});

test('menu normalization ignores irrelevant metadata but rejects malformed or unknown authority', () => {
  assert.deepEqual(normalizeMenuButton({...webApp, future_metadata:{ignored:true}}), {type:'web_app',text:'OPEN BINRAT',url:'https://binrat-edge-v0.pettevik.workers.dev/app/'});
  assert.throws(()=>normalizeMenuButton({type:'web_app',text:'OPEN BINRAT',web_app:{}}),/TELEGRAM_MENU_BUTTON_MALFORMED/);
  assert.throws(()=>normalizeMenuButton({type:'future'}),/TELEGRAM_MENU_BUTTON_MALFORMED/);
});

test('postdeploy failure can restore the exact pre-rollout tester menu', async () => {
  const api = new FakeApi(); api.state.testerMenu=commands;
  const snapshot = await snapshotPrivateTesterMenu(api, tester);
  await activatePrivateTesterMenu(api, tester, telegramProductConfig, noWait, [0], snapshot);
  await restorePrivateTesterMenu(api, snapshot, noWait, [0]);
  assert.deepEqual(api.state.testerMenu, commands);
  assert.deepEqual(api.state.globalMenu, commands);
});

test('only the exact failed-run global Web App drift is repaired to commands', async () => {
  const api = new FakeApi(); api.state.globalMenu=webApp;
  const snapshot = await snapshotPrivateTesterMenu(api, tester);
  await activatePrivateTesterMenu(api, tester, telegramProductConfig, noWait, [0], snapshot);
  const globalSets=api.calls.filter(call=>call.method==='setChatMenuButton' && !call.body.chat_id);
  assert.deepEqual(globalSets,[{method:'setChatMenuButton',body:{menu_button:commands}}]);
  assert.deepEqual(api.state.globalMenu,commands);
  const unexpected = new FakeApi(); unexpected.state.globalMenu={type:'web_app',text:'OTHER',web_app:{url:'https://other.example/'}};
  await assert.rejects(()=>activatePrivateTesterMenu(unexpected,tester,telegramProductConfig,noWait,[0]),/TELEGRAM_GLOBAL_MENU_UNEXPECTED/);
});

test('unexpected webhook drift blocks every global config mutation', async () => {
  const api=new FakeApi(); api.state.webhook='https://unexpected.example/webhook';
  await assert.rejects(()=>applyTelegramConfig(api),/TELEGRAM_CONFIG_BLOCKED:WEBHOOK/);
  assert.equal(api.calls.some(call=>call.method.startsWith('set')),false);
});

test('BotFather-only username drift is blocking, never presented as an API update', () => {
  const actual={me:{id:1,is_bot:true,first_name:'BINRAT',username:'WrongBot'},name:'BINRAT',description:telegramProductConfig.description,shortDescription:telegramProductConfig.shortDescription,commands:telegramProductConfig.commandScopes.map(x=>[...x.commands]),menuButton:{type:'commands'} as const,webhook:{url:telegramProductConfig.webhook.url},profilePhotoPresent:true};
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
