import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  evaluateCommsDraftAttempt,
  failedCommsEvalCase,
  summarizeCommsEval,
} from '../dist/src/comms/eval.js';
import { draftCommsEventWithModel } from '../dist/src/comms/modelWriter.js';
import { createOpenRouterCommsWriter } from '../dist/src/comms/openRouterWriter.js';

const outputPath = process.env.BINRAT_COMMS_EVAL_OUTPUT;
if (!outputPath) throw new Error('COMMS_EVAL_OUTPUT_REQUIRED');

const apiKey =
  process.env.BINRAT_COMMS_OPENROUTER_API_KEY ||
  process.env.BINRAT_EVAL_OPENROUTER_API_KEY;
if (!apiKey) throw new Error('OPENROUTER_KEY_MISSING');

const cases = JSON.parse(
  readFileSync(
    new URL('../docs/comms/eval/historical-v1.json', import.meta.url),
    'utf8',
  ),
);

if (!Array.isArray(cases) || cases.length !== 12) {
  throw new Error('COMMS_EVAL_CASES_INVALID');
}

mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });

const writer = createOpenRouterCommsWriter({
  apiKey,
  model: 'openai/gpt-4.1-mini',
  timeoutMs: 30_000,
});

const results = [];
for (const testCase of cases) {
  const startedAt = Date.now();
  try {
    const attempt = await draftCommsEventWithModel(testCase.event, writer);
    results.push(
      evaluateCommsDraftAttempt(testCase, attempt, Date.now() - startedAt),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'UNKNOWN_COMMS_EVAL_ERROR';
    results.push(
      failedCommsEvalCase(testCase, message, Date.now() - startedAt),
    );
  }
}

const summary = summarizeCommsEval(results);
const report = {
  schemaVersion: 'binrat.comms-shadow-eval-report/1',
  model: 'openai/gpt-4.1-mini',
  maxProviderAttempts: 12,
  retries: 0,
  publicationAuthority: false,
  summary,
  results,
};

writeFileSync(outputPath, JSON.stringify(report, null, 2), {
  flag: 'wx',
  mode: 0o600,
});

console.log(JSON.stringify(summary, null, 2));

if (summary.modelCallSuccesses !== 12) process.exitCode = 2;
else if (summary.unsupportedClaimFailures > 0) process.exitCode = 3;
