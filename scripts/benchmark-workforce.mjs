import {developmentBenchmark, holdoutBenchmark} from '../dist/src/workforce/benchmark.js';
// This CLI is deliberately incapable of provider access, including through accidentally added adapters.
globalThis.fetch = async () => {throw new Error('OFFLINE_BENCHMARK_NETWORK_DENIED');};
const mode = process.argv[2];
if (process.argv.length !== 3 || !['development','holdout'].includes(mode)) {
  console.error('Usage: benchmark-workforce.mjs development|holdout'); process.exitCode = 2;
} else {
  const report = await (mode === 'development' ? developmentBenchmark() : holdoutBenchmark());
  console.log(JSON.stringify(report, null, 2));
  if (mode === 'holdout' && !report.pipelinePass) process.exitCode = 1;
}
