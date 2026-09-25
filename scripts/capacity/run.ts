import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { runVirtualLoad, simulateFanout, FakeAtomicQuota } from '../../src/capacity/synthetic.js';

const profile = JSON.parse(readFileSync(new URL('../../bench/capacity-profile.v1.json', import.meta.url), 'utf8')) as {
  steady: { rps: number; durationSeconds: number; requests: number };
  burst: { rps: number; durationSeconds: number; requests: number };
  openSessions: number; targetDAU: number;
};
const smoke = process.argv.includes('--smoke');
const start = performance.now();
const steady = runVirtualLoad(smoke ? 10 : profile.steady.rps, smoke ? 30 : profile.steady.durationSeconds, 16, 90);
const burst = smoke ? null : runVirtualLoad(profile.burst.rps, profile.burst.durationSeconds, 16, 90);
const coldSerial = runVirtualLoad(100, 30, 1, 0);
const cacheProfiles = [0, 50, 90, 99].map((hit) => {
  const result = runVirtualLoad(100, 30, 16, hit);
  return { hitPct: hit, actualSyntheticHits: result.simulatedCacheHits,
    actualSyntheticMisses: result.simulatedCacheMisses,
    virtualMixedP95Ms: result.endToEndP95Ms,
    virtualCandidateOnlyP95Ms: result.candidateOnlyP95Ms,
    virtualCandidateOnlyP99Ms: result.candidateOnlyP99Ms };
});
const fanout = simulateFanout(profile.targetDAU);
const quota = new FakeAtomicQuota(100);
const outcomes = await Promise.all(Array.from({ length: profile.openSessions }, (_, i) => quota.reserve('synthetic-' + i)));
const result = {
  schemaVersion: 'binrat.synthetic-baseline/1',
  measurementType: 'VIRTUAL_TIME_MODEL_AND_LOCAL_WALL_TIME_NOT_LIVE_CAPACITY',
  liveStagingTest: 'NOT_RUN_NO_SPENDING_AUTHORITY',
  smoke, profileTargetDAU: profile.targetDAU,
  virtualSteady: steady, virtualBurst: burst, virtualColdSerialCounterexample: coldSerial,
  cacheProfiles, fanout, quota: { simultaneousAttempts: outcomes.length, accepted: outcomes.filter(Boolean).length, remaining: quota.getRemaining() },
  modelWallTimeMs: Math.round(performance.now() - start)
};
console.log(JSON.stringify(result));
if (coldSerial.endToEndP95Ms < 500 ||
    cacheProfiles[0]!.virtualCandidateOnlyP95Ms <= cacheProfiles[3]!.virtualCandidateOnlyP95Ms ||
    cacheProfiles[0]!.actualSyntheticHits !== 0 ||
    cacheProfiles[3]!.actualSyntheticHits <= cacheProfiles[0]!.actualSyntheticHits ||
    fanout.unique !== profile.targetDAU ||
    fanout.peakPerSecond > 25 || fanout.drainSeconds >= 900 ||
    outcomes.length !== profile.openSessions || outcomes.filter(Boolean).length !== 100 ||
    steady.distribution.PUBLIC_CACHED !== steady.requests * 0.7) process.exitCode = 1;
