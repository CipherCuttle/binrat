// k6 isolated-staging driver; NEVER run on production or Workers Free.
// Example only after explicit spend approval:
// BINRAT_BENCH_APPROVED=YES BINRAT_BENCH_ISOLATED_PAID=YES
// BINRAT_BENCH_STAGING_URL=https://separate-staging.workers.dev
// BINRAT_BENCH_ALLOWED_HOST=separate-staging.workers.dev k6 run bench/k6-capacity.js
import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const profile = JSON.parse(open('./capacity-profile.v1.json'));
const base = __ENV.BINRAT_BENCH_STAGING_URL ?? '';
const allowedHost = __ENV.BINRAT_BENCH_ALLOWED_HOST ?? '';
const mode = __ENV.BINRAT_BENCH_MODE ?? 'smoke';
const fullContract = mode === 'full-contract';
const hostname = /^https:\/\/([a-z0-9.-]+)(?:\/)?$/.exec(base)?.[1] ?? '';
if (__ENV.BINRAT_BENCH_APPROVED !== 'YES' || __ENV.BINRAT_BENCH_ISOLATED_PAID !== 'YES' ||
    !hostname || hostname !== allowedHost || hostname === 'binrat-edge-v0.pettevik.workers.dev' ||
    !['smoke','arc-only','full-contract'].includes(mode)) {
  throw new Error('BENCH_BLOCKED: explicit spend approval, isolated Paid staging, allowlisted host and mode required');
}
if (fullContract && __ENV.BINRAT_BENCH_FULL_CONTRACT_READY !== 'YES') {
  throw new Error('BENCH_BLOCKED: actual cache, account, premium and dual-chain contracts not yet implemented');
}
const smoke = mode === 'smoke';
export const options = {
  scenarios: smoke
    ? { smoke: { executor: 'constant-arrival-rate', rate: 10, timeUnit: '1s', duration: '30s',
      preAllocatedVUs: 20, maxVUs: 60 } }
    : {
      warmup: { executor: 'constant-arrival-rate', rate: 50, timeUnit: '1s', duration: '2m',
        preAllocatedVUs: 200, maxVUs: 500 },
      steady: { executor: 'constant-arrival-rate', startTime: '3m', rate: profile.steady.rps,
        timeUnit: '1s', duration: '30m', preAllocatedVUs: 1000, maxVUs: 1600 },
      burst: { executor: 'constant-arrival-rate', startTime: '34m', rate: profile.burst.rps,
        timeUnit: '1s', duration: '5m', preAllocatedVUs: 1000, maxVUs: 2000 }
    },
  thresholds: {
    'checks': ['rate>0.99'],
    'http_req_failed': ['rate<0.01'],
    'successful_cached_ms': fullContract ? ['p(95)<500','p(99)<1500'] : [],
    'cache_evidence': fullContract ? ['rate>0.60'] : []
  }
};
const cacheMs = new Trend('successful_cached_ms', true);
const cacheEvidence = new Rate('cache_evidence');
const successRate = new Rate('semantic_success');
export default function () {
  // Only actual GET routes in arc-only/smoke. Full-contract deliberately fails until
  // independent 4663 reads, server-side quotas and premium routes are integrated.
  const bucket = (__VU * 7919 + __ITER * 37) % 100;
  let path = '/api/health';
  if (bucket < 45) path = '/api/feed';
  else if (bucket < 70) path = '/api/capabilities';
  else if (bucket < 85) path = '/api/rat-radar/watchlist';
  else if (fullContract && bucket < 95) path = '/api/account/usage'; // not shipped
  else if (fullContract) path = '/api/research/pro-export'; // not shipped
  const response = http.get(base + path, { headers: { 'X-Binrat-Benchmark': 'isolated-staging' },
    tags: { route: path, chain: fullContract && (__VU % 2) === 0 ? '4663' : '5042' } });
  let body = null;
  try { body = response.json(); } catch (_) {}
  const correct = response.status === 200 && body && typeof body === 'object' &&
    (path !== '/api/health' || body.ok === true) &&
    (path !== '/api/feed' || body.schemaVersion === 'binrat.public-feed/0.1') &&
    (path !== '/api/account/usage' && path !== '/api/research/pro-export');
  successRate.add(!!correct);
  check(response, { 'semantic response 200 (errors never fast success)': () => !!correct });
  const cacheMarker = response.headers['X-Binrat-Cache-Status'] ?? response.headers['x-binrat-cache-status'];
  const hit = cacheMarker === 'HIT';
  if (fullContract) cacheEvidence.add(!!hit);
  if (correct && hit) cacheMs.add(response.timings.duration);
}
