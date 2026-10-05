import { readFileSync, statSync } from 'node:fs';
import { prepareCaptureDirectory, executeCapture, auditCapture } from '../dist/src/workforce/capture.js';
import { parseStrictJson, scoreComparison } from '../dist/src/workforce/competence.js';

const args = process.argv.slice(2), [command, target, third, digest] = args;
if (command === 'prepare' && args.length === 3) {
  if (statSync(target).size > 8192) throw new Error('CONFIG_TOO_LARGE');
  const plan = await prepareCaptureDirectory(parseStrictJson(readFileSync(target, 'utf8')), third);
  console.log(JSON.stringify({ directory: third, planDigest: plan.planDigest, model: plan.config.modelId,
    provider: plan.config.providerSlug, assignments: plan.requests.length, reservedMicrousd: plan.reservationMicrousd,
    providerCalls: 0, executionAuthorized: false }));
} else if (command === 'run' && args.length === 4 && third === '--execute') {
  const result = await executeCapture(target, digest, process.env.BINRAT_EVAL_OPENROUTER_API_KEY ?? '');
  console.log(JSON.stringify(result));
  if (result.outcome !== 'COMPLETE') process.exitCode = 1;
} else if (command === 'audit' && args.length === 2) {
  const audit = await auditCapture(target);
  const score = await scoreComparison(audit.comparison);
  console.log(JSON.stringify({ ...audit, score }, null, 2));
  if (!audit.summary.complete || !['SPECIALIST_ADVANTAGE_ON_THIS_PACK', 'NO_SPECIALIST_ADVANTAGE_ON_THIS_PACK'].includes(score.verdict)) {
    process.exitCode = 1;
  }
} else {
  console.error('Usage: capture-rat-competence.mjs prepare <config.json> <new-directory> | run <directory> --execute <exact-plan-digest> | audit <directory>');
  process.exitCode = 2;
}
