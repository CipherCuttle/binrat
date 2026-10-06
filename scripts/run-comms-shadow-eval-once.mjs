import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  evaluateCommsDraftAttempt,
  failedCommsEvalCase,
  summarizeCommsEval,
} from '../dist/src/comms/eval.js';
import { buildShadowPostBundle } from '../dist/src/comms/commsRat.js';
import {
  buildCommsWriterRequest,
  parseCommsModelDraft,
} from '../dist/src/comms/modelWriter.js';
import { createOpenRouterCommsWriter } from '../dist/src/comms/openRouterWriter.js';
import { sha256Hex } from '../dist/src/evidence/canonical.js';

const outputPath = process.env.BINRAT_COMMS_EVAL_OUTPUT;
if (!outputPath) throw new Error('COMMS_EVAL_OUTPUT_REQUIRED');

// Refuse to spend against a report path that cannot preserve a fresh receipt.
if (existsSync(outputPath)) throw new Error('COMMS_EVAL_OUTPUT_EXISTS');
mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });

const results = [];
let providerAttemptsStarted = 0;
let stage = 'CONFIGURATION';

async function run() {
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

  const writer = createOpenRouterCommsWriter({
    apiKey,
    model: 'openai/gpt-4.1-mini',
    timeoutMs: 30_000,
  });

  stage = 'EVALUATION';

  for (const testCase of cases) {
    const startedAt = Date.now();
    const request = buildCommsWriterRequest(testCase.event);
    let response;

    try {
      providerAttemptsStarted += 1;
      response = await writer.generate(request);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'UNKNOWN_COMMS_PROVIDER_ERROR';
      results.push(
        failedCommsEvalCase(testCase, message, {
          providerCallSucceeded: false,
          durationMs: Date.now() - startedAt,
        }),
      );
      continue;
    }

    let drafts;
    try {
      drafts = parseCommsModelDraft(response.rawOutput);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'UNKNOWN_COMMS_DRAFT_ERROR';
      results.push(
        failedCommsEvalCase(testCase, message, {
          providerCallSucceeded: true,
          inputTokens: response.usage?.inputTokens ?? null,
          outputTokens: response.usage?.outputTokens ?? null,
          durationMs: Date.now() - startedAt,
          rawOutput: response.rawOutput,
        }),
      );
      continue;
    }

    const bundle = buildShadowPostBundle(testCase.event, drafts);
    const attempt = {
      bundle,
      writerReceipt: {
        schemaVersion: 'binrat.comms-writer-receipt/1',
        provider: response.provider,
        model: response.model,
        requestDigest: await sha256Hex(request),
        rawOutputDigest: await sha256Hex(response.rawOutput),
        draftsDigest: await sha256Hex(drafts),
        acceptedByDeterministicGate:
          bundle.decision === 'POST' && bundle.violations.length === 0,
        violationCount: bundle.violations.length,
        ...(response.usage ? { usage: response.usage } : {}),
      },
    };

    results.push(
      evaluateCommsDraftAttempt(testCase, attempt, Date.now() - startedAt),
    );
  }

  const summary = summarizeCommsEval(results);
  const report = {
    schemaVersion: 'binrat.comms-shadow-eval-report/1',
    outcome: 'COMPLETE',
    providerAttemptsStarted,
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

  if (summary.providerCallSuccesses !== 12) process.exitCode = 2;
  else if (summary.draftContractPasses !== 12) process.exitCode = 4;
  else if (summary.unsupportedClaimFailures > 0) process.exitCode = 3;
  else if (summary.automaticCandidates / summary.totalCases < 0.7) process.exitCode = 5;

}

try {
  await run();
} catch (error) {
  // Only fixed config codes are retained; never serialize arbitrary exception
  // text, provider bodies, environment values, or credentials into artifacts.
  const message = error instanceof Error ? error.message : '';
  const safeConfigErrors = new Set([
    'OPENROUTER_KEY_MISSING',
    'OPENROUTER_API_KEY_INVALID',
    'OPENROUTER_MODEL_INVALID',
    'OPENROUTER_TIMEOUT_INVALID',
    'COMMS_EVAL_CASES_INVALID',
  ]);
  const report = {
    schemaVersion: 'binrat.comms-shadow-eval-report/1',
    outcome: 'ERROR',
    stage,
    error: stage === 'CONFIGURATION' && safeConfigErrors.has(message)
      ? message
      : `COMMS_EVAL_${stage}_FAILED`,
    providerAttemptsStarted,
    model: 'openai/gpt-4.1-mini',
    maxProviderAttempts: 12,
    retries: 0,
    publicationAuthority: false,
    summary: results.length > 0 ? summarizeCommsEval(results) : null,
    results,
  };
  writeFileSync(outputPath, JSON.stringify(report, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });
  console.error(report.error);
  process.exitCode = 1;
}
