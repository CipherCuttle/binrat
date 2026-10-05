import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStrictJson, prepareComparison, scoreComparison } from '../dist/src/workforce/competence.js';

const [command, target] = process.argv.slice(2);
if (command === 'prepare' && target) {
  const plan = await prepareComparison();
  const dir = resolve(target);
  // Fresh output directory: preserve existing files and avoid stale packet mixing.
  mkdirSync(dir, { recursive: false });
  for (const a of plan.assignments) {
    writeFileSync(resolve(dir, `${a.assignmentId}.prompt.txt`), a.prompt, { flag: 'wx' });
  }
  writeFileSync(resolve(dir, 'assignments.json'), JSON.stringify({ ...plan,
    assignments: plan.assignments.map(({ prompt, evidence, ...metadata }) => metadata) }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ directory: dir, assignments: plan.assignments.length, packDigest: plan.packDigest,
    providerCalls: 0, recordedOutputs: 0, modelCompetence: 'UNPROVEN' }));
} else if (command === 'score' && target) {
  if (statSync(target).size > 1_048_576) throw new Error('CAPTURE_FILE_TOO_LARGE');
  const report = await scoreComparison(parseStrictJson(readFileSync(target, 'utf8')));
  console.log(JSON.stringify(report, null, 2));
  if (report.verdict !== 'SPECIALIST_ADVANTAGE_ON_THIS_PACK' && report.verdict !== 'NO_SPECIALIST_ADVANTAGE_ON_THIS_PACK') {
    process.exitCode = 1;
  }
} else {
  console.error('Usage: node scripts/eval-rat-competence.mjs prepare <new-directory> | score <capture-bundle.json>');
  process.exitCode = 2;
}
