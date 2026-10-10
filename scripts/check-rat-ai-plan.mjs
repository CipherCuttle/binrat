// Read-only, no deploy and no inference. Outputs no API tokens or account IDs.
const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!token || !/^[a-f0-9]{32}$/i.test(account ?? '')) {
  console.error('PLAN_CHECK: CREDENTIALS_MISSING');
  process.exit(2);
}
const response = await fetch(
  'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(account) + '/subscriptions',
  { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(15000) }
).catch(() => null);
if (!response) { console.log('PLAN_CHECK: NETWORK_UNAVAILABLE'); process.exit(2); }
const data = await response.json().catch(() => null);
if (!response.ok || data?.success !== true || !Array.isArray(data.result)) {
  console.log('PLAN_CHECK: BILLING_READ_UNAVAILABLE HTTP_' + response.status);
  process.exit(2);
}
const summaries = data.result.map(row => ({
  id: String(row?.rate_plan?.id ?? '').toLowerCase(),
  name: String(row?.rate_plan?.public_name ?? '').toLowerCase(),
  state: String(row?.state ?? '').toLowerCase(),
  price: typeof row?.price === 'number' ? row.price : null
}));
const workers = summaries.filter(s =>
  s.name.includes('workers') || /\bworkers?\b/.test(s.id)
);
console.log('PLAN_CHECK: BILLING_READ_OK');
console.log('WORKERS_SUBSCRIPTIONS: ' +
  JSON.stringify(workers.map(s => ({plan:s.name, rateId:s.id, state:s.state, price:s.price}))));
if (workers.some(s =>
  /paid|standard/i.test(s.name + ' ' + s.id) &&
  !['cancelled','expired','failed'].includes(s.state)
)) console.log('WORKERS_PLAN: PAID');
else if (workers.some(s =>
  /free/i.test(s.name + ' ' + s.id) &&
  !['cancelled','expired','failed'].includes(s.state)
)) console.log('WORKERS_PLAN: FREE');
else console.log('WORKERS_PLAN: UNKNOWN');
