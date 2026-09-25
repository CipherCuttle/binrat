#!/usr/bin/env node
// Provision/verify only the isolated BINRAT AI Gateway. Refuse public AI if not enforced.
// No model calls, no Telegram calls, no other gateway or account setting touched.
const ID = 'binrat-rat-capped-v1';
const API = 'https://api.cloudflare.com/client/v4/accounts/';
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !/^[0-9a-f]{32}$/i.test(account ?? '')) throw new Error('GATEWAY_CREDENTIALS_MISSING');
const endpoint = API + account + '/ai-gateway/gateways/' + ID;
const daily = {
  id: 'binrat-rat-5c-day', enabled: true, limit: 0.05,
  limitType: 'cost', window: 86400, technique: 'fixed'
};
const monthly = {
  id: 'binrat-rat-50c-month', enabled: true, limit: 0.50,
  limitType: 'cost', window: 2592000, technique: 'sliding'
};
const desired = {
  id: ID,
  cache_invalidate_on_update: true,
  cache_ttl: 0,
  collect_logs: false,
  rate_limiting_interval: 60,
  rate_limiting_limit: 3,
  rate_limiting_technique: 'sliding',
  retry_max_attempts: 1,
  workers_ai_billing_mode: 'postpaid',
  spend_limits: { enabled: true, rules: [daily, monthly] }
};
function safeError(status, body) {
  const code = Array.isArray(body?.errors) ? body.errors.map(e=>Number(e.code)).filter(Number.isInteger).slice(0,4) : [];
  throw new Error('RAT_GATEWAY_CONFIGURATION_REJECTED:HTTP_' + status + ':CODES_' + code.join(','));
}
async function call(method, url, body) {
  let response;
  try {
    response = await fetch(url, {
      method, headers: {
        Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(18000)
    });
  } catch {
    throw new Error('RAT_GATEWAY_API_NETWORK_UNAVAILABLE');
  }
  const data = await response.json().catch(() => null);
  return { status: response.status, ok: response.ok && data?.success === true, data };
}
let read = await call('GET',endpoint);
if (read.status === 404) {
  const create = await call('POST', API + account + '/ai-gateway/gateways', desired);
  if (!create.ok) safeError(create.status, create.data);
  console.log('RAT_GATEWAY: CREATED_DEDICATED');
} else if (!read.ok) {
  safeError(read.status, read.data);
}
read = await call('GET',endpoint);
if (!read.ok) safeError(read.status, read.data);
let result = read.data.result;
const normalize = (x) => ({
  id:x?.id, cap:x?.rate_limiting_limit, interval:x?.rate_limiting_interval,
  billing:x?.workers_ai_billing_mode,
  logged:x?.collect_logs,
  spendEnabled:x?.spend_limits?.enabled,
  rules:x?.spend_limits?.rules?.map(r=>({id:r.id,limit:r.limit,limitType:r.limitType,window:r.window,enabled:r.enabled}))
});
function matches(x) {
  if (x?.id !== ID || x?.rate_limiting_limit !== 3 ||
      x?.rate_limiting_interval !== 60 || x?.collect_logs !== false ||
      x?.spend_limits?.enabled !== true ||
      x?.workers_ai_billing_mode !== 'postpaid') return false;
  const rules = x.spend_limits?.rules ?? [];
  return [daily,monthly].every(rule =>
    rules.some(actual =>
      actual.id === rule.id && actual.enabled === true &&
      actual.limitType === 'cost' && actual.limit === rule.limit &&
      actual.window === rule.window
    )
  );
}
if (!matches(result)) {
  // Update ONLY this exact BINRAT gateway and verify fresh readback. Never modify
  // the default gateway or another app's controls.
  const update = await call('PUT',endpoint, desired);
  if (!update.ok) safeError(update.status, update.data);
  const check = await call('GET',endpoint);
  if (!check.ok) safeError(check.status, check.data);
  result=check.data.result;
}
if (!matches(result)) {
  console.log('RAT_GATEWAY_READBACK: '+JSON.stringify(normalize(result)));
  throw new Error('RAT_GATEWAY_COST_RULES_NOT_VERIFIED');
}
console.log('RAT_GATEWAY_READBACK: VERIFIED; dedicated; 3 req/min; USD 0.05/day and 0.50/30days; zero persistent request logging; Workers AI standard billing.');
console.log('GATEWAY_LIMITATION: cost attribution is eventually consistent; D1 30-call/day gate remains the independent admission ceiling.');
