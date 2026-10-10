// ONE bounded read/write Workers AI model smoke. No bot deploy, no Telegram messages.
// Keep its prompt equivalent to the production harmless-banter lane.
const token = process.env.CLOUDFLARE_API_TOKEN;
const id = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !/^[a-f0-9]{32}$/i.test(id ?? '')) throw Error('SMOKE_CREDENTIALS_MISSING');
const request = {
  messages: [
    {role:'system', content:'You are BINRAT, a brief dry slightly feral but friendly Telegram rat. Harmless small talk only. No facts, URLs, numbers, launch or token claims. Reply ONLY in compact JSON: {"kind":"BANTER","text":"one brief line"}. Never use markdown.'},
    {role:'user',content:'hello rat, do you nap?'}
  ],
  max_completion_tokens: 160,
  temperature: 0.4,
  stream: false,
  chat_template_kwargs: {enable_thinking: false}
};
const api = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(id) + '/ai/run/@cf/zai-org/glm-4.7-flash';
const response = await fetch(api, {
  method:'POST', headers:{Authorization:'Bearer '+token,'content-type':'application/json'},
  body: JSON.stringify(request),
  signal: AbortSignal.timeout(45000)
}).catch(() => null);
if (!response) { console.log('SMOKE_RESULT: NETWORK_UNAVAILABLE'); process.exit(1); }
const payload=await response.json().catch(()=>null);
const res=payload?.result??{};
const text=typeof res.response==='string'?res.response:res.choices?.[0]?.message?.content;
let isValid=false;let length=0;
if(typeof text==='string'){
  length=text.length;
  try{
    const json=JSON.parse(text.trim());
    isValid=json?.kind==='BANTER' && typeof json?.text==='string' &&
      json.text.length>0 && json.text.length<=450 && !/[\r\n]/.test(json.text);
  }catch{}
}
console.log('SMOKE_HTTP_STATUS: '+response.status);
console.log('SMOKE_CLOUDFLARE_SUCCESS: '+(payload?.success===true));
console.log('SMOKE_RESULT_FORMAT: '+(typeof text==='string'?'text':JSON.stringify(Object.keys(res))));
console.log('SMOKE_BANTER_JSON_VALID: '+isValid);
console.log('SMOKE_CONTENT_CHARS: '+length);
console.log('SMOKE_USAGE: '+JSON.stringify(res.usage??null));
console.log('SMOKE_FINISH_REASON: '+String(res.choices?.[0]?.finish_reason??'UNKNOWN'));
if(!response.ok || payload?.success!==true || !isValid) process.exit(1);
