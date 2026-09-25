// k6 isolated-staging driver; NEVER run on production or Workers Free.
// Example only after explicit spend approval:
// BINRAT_BENCH_APPROVED=YES BINRAT_BENCH_ISOLATED_PAID=YES
// BINRAT_BENCH_STAGING_URL=https://separate-staging.workers.dev
// BINRAT_BENCH_ALLOWED_HOST=separate-staging.workers.dev k6 run bench/k6-capacity.js
import http from 'k6/http';
import { check, sleep } from 'k6';
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
// 1K think-time VUs + an arrival-rate lane approximate a 100 RPS total workload.
// Arc-only mode deliberately does not pretend it covers 4663 or 1K sessions.
const openSessionPollsPerSecond = fullContract ? 25 : 0;
const cacheMode = __ENV.BINRAT_BENCH_CACHE_MODE ?? 'warm';
if (!['cold','warm'].includes(cacheMode)) throw new Error('BENCH_CACHE_MODE_INVALID');
export const options = {
  scenarios: smoke
    ? { smoke: { executor: 'constant-arrival-rate', rate: 10, timeUnit: '1s', duration: '30s',
      preAllocatedVUs: 20, maxVUs: 60 } }
    : {
      warmup: { executor: 'constant-arrival-rate', rate: 50, timeUnit: '1s', duration: '2m',
        preAllocatedVUs: 200, maxVUs: 500 },
      steady: { executor: 'constant-arrival-rate', startTime: '3m', rate: profile.steady.rps - openSessionPollsPerSecond,
        timeUnit: '1s', duration: '30m', preAllocatedVUs: 1000, maxVUs: 1600 },
      burst: { executor: 'constant-arrival-rate', startTime: '34m', rate: profile.burst.rps - openSessionPollsPerSecond,
        timeUnit: '1s', duration: '5m', preAllocatedVUs: 1000, maxVUs: 2000 },
      ...(fullContract ? { openSessions: {
        executor: 'constant-vus', vus: 1000, startTime: '3m', duration: '36m',
        exec: 'sessionPoll'
      }} : {})
    },
  thresholds: {
    'checks': ['rate>0.99'],
    'http_req_failed': ['rate<0.01'],
    'successful_cached_ms': fullContract ? ['p(95)<500','p(99)<1500'] : [],
    'cache_evidence': fullContract ? [cacheMode === 'cold' ? 'rate<0.05' : 'rate>0.80'] : [],
    'semantic_success': ['rate>0.99'],
    'dropped_iterations': ['count==0']
  }
};
const cacheMs = new Trend('successful_cached_ms', true);
const cacheEvidence = new Rate('cache_evidence');
const successRate = new Rate('semantic_success');
function expectedChain() {
  return fullContract && (__VU % 2 === 0) ? 4663 : 5042;
}
function exercise(path, targetChain, cacheCandidate = false) {
  // The request tag is diagnostic only; ONLY the independently observed response
  // can satisfy coverage. If the backend silently returns Arc for 4663, FAIL.
  const query = fullContract ? `?chainId=${targetChain}` : '';
  const response = http.get(base + path + query, {
    headers: { 'X-Binrat-Benchmark': 'isolated-staging' },
    tags: { route: path, intendedChain: String(targetChain) }
  });
  let body = null;
  try { body = response.json(); } catch (_) {}
  const chainVerified = !fullContract || (
    body && body.chainId === targetChain &&
    body.sourceVerified === true &&
    typeof body.asOfBlockHash === 'string' &&
    /^0x[0-9a-fA-F]{64}$/.test(body.asOfBlockHash) &&
    body.coverage?.status === 'VERIFIED' &&
    Number.isSafeInteger(body.freshness?.updatedAtMs)
  );
  const correct = response.status === 200 && body && typeof body === 'object' &&
    (path !== '/api/health' || body.ok === true) &&
    (path !== '/api/feed' || body.schemaVersion === 'binrat.public-feed/0.1') &&
    // Account/Pro remain deliberate fail-closed placeholders until real schema exists.
    (path !== '/api/account/usage' && path !== '/api/research/pro-export') &&
    chainVerified;
  successRate.add(!!correct);
  check(response, { 'semantic response 200 with verified source chain': () => !!correct });
  const cacheMarker = response.headers['X-Binrat-Cache-Status'] ??
    response.headers['x-binrat-cache-status'];
  const cacheHit = cacheMarker === 'HIT';
  if (fullContract && cacheCandidate) cacheEvidence.add(!!cacheHit);
  if (correct && cacheHit && cacheCandidate) cacheMs.add(response.timings.duration);
}
export default function () {
  // Full-contract is intentionally NOT runnable successfully until the G2A/G2B
  // contracts exist. Do not substitute Arc data or mock billing.
  const bucket = (__VU * 7919 + __ITER * 37) % 100;
  const targetChain = expectedChain();
  let path = '/api/health';
  if (bucket < 45) path = '/api/feed';
  else if (bucket < 70) path = '/api/capabilities';
  else if (bucket < 85) path = '/api/rat-radar/watchlist';
  else if (fullContract && bucket < 95) path = '/api/account/usage';
  else if (fullContract) path = '/api/research/pro-export';
  exercise(path, targetChain, bucket < 70);
}
export function sessionPoll() {
  // A VU approximates a think-time client, NOT a browser/WebSocket connection.
  const chain = expectedChain();
  // Initial staggering matters: 1K simultaneous first polls are NOT ~25 RPS.
  sleep(30 + (__VU % 21));
  exercise('/api/feed', chain, true);
}
