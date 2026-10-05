import {nextQueryBenchmark,loadQueryPack,queryPacket} from '../dist/src/workforce/nextQuery.js';
globalThis.fetch=async()=>{throw new Error('OFFLINE_QUERY_NETWORK_DENIED');};
const [mode,split]=process.argv.slice(2);
if (process.argv.length!==4 || !['score','prepare'].includes(mode) || !['development','evaluation'].includes(split)) {
  console.error('Usage: eval-next-query.mjs score|prepare development|evaluation');process.exitCode=2;
} else if (mode==='prepare') {
  const pack=await loadQueryPack(split);
  for (const c of pack.cases) console.log(JSON.stringify(await queryPacket(c.task)));
} else {
  const report=await nextQueryBenchmark(split);
  console.log(JSON.stringify(report,null,2));
  if (!report.pipelinePass) process.exitCode=1;
}
