import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { draftCommsEventWithModel } from '../dist/src/comms/modelWriter.js';
import { createOpenRouterCommsWriter } from '../dist/src/comms/openRouterWriter.js';

const outputPath = process.env.BINRAT_COMMS_SHADOW_OUTPUT;
if (!outputPath) throw new Error('COMMS_SHADOW_OUTPUT_REQUIRED');

mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });

const apiKey =
  process.env.BINRAT_COMMS_OPENROUTER_API_KEY ||
  process.env.BINRAT_EVAL_OPENROUTER_API_KEY;

const event = {
  id: 'comms-writer-pr139-engineering-pass-v2',
  occurredAt: '2026-10-06T12:13:00Z',
  type: 'FEATURE_CHANGE',
  lifecycle: 'ENGINEERING_PASS',
  visibility: 'PUBLIC_OK',
  publicAuthorized: false,
  headline: "COMMS RAT CAN WRITE. IT STILL CAN'T POST.",
  summary:
    'The model-backed Comms Rat writer passed repository CI on draft PR #139 at exact head fa0a1095dbb02d7312746cac031dc334223c51f3. It generates X and Telegram drafts behind the deterministic claim gate. No publisher path is wired.',
  userValue: 2,
  novelty: 3,
  repetitionPenalty: 0,
  risk: 'LOW',
  evidence: [
    { kind: 'PR', ref: '#139' },
    {
      kind: 'COMMIT',
      ref: 'fa0a1095dbb02d7312746cac031dc334223c51f3',
    },
    { kind: 'CI', ref: '37461437621', status: 'PASS' },
    { kind: 'DOC', ref: 'docs/comms/MODEL_WRITER_V1.md' },
  ],
};

const baseReport = {
  schemaVersion: 'binrat.comms-shadow-live-experiment/1',
  sourceHead: 'fa0a1095dbb02d7312746cac031dc334223c51f3',
  modelRequested: 'openai/gpt-4.1-mini',
  event,
};

try {
  if (!apiKey) throw new Error('OPENROUTER_KEY_MISSING');

  const writer = createOpenRouterCommsWriter({
    apiKey,
    model: 'openai/gpt-4.1-mini',
    timeoutMs: 30_000,
  });

  const result = await draftCommsEventWithModel(event, writer);

  if (result.bundle.publishAllowed !== false) {
    throw new Error('PUBLISH_AUTHORITY_ESCALATION');
  }
  if (result.bundle.requiresHumanApproval !== true) {
    throw new Error('HUMAN_APPROVAL_REMOVED');
  }
  if (result.bundle.decision !== 'QUEUE') {
    throw new Error('UNAUTHORIZED_EVENT_NOT_QUEUED');
  }
  if (result.writerReceipt.acceptedByDeterministicGate !== false) {
    throw new Error('UNAUTHORIZED_EVENT_ADMITTED');
  }

  const report = {
    ...baseReport,
    outcome: 'CAPTURED',
    result,
  };

  writeFileSync(outputPath, JSON.stringify(report, null, 2), {
    flag: 'wx',
    mode: 0o600,
  });

  console.log(
    JSON.stringify(
      {
        outcome: report.outcome,
        model: result.writerReceipt.model,
        decision: result.bundle.decision,
        publishAllowed: result.bundle.publishAllowed,
        requiresHumanApproval: result.bundle.requiresHumanApproval,
        violationCodes: result.bundle.violations.map((item) => item.code),
        x: result.bundle.drafts.x,
        telegram: result.bundle.drafts.telegram,
        writerReceipt: result.writerReceipt,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'UNKNOWN_COMMS_SHADOW_ERROR';

  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        ...baseReport,
        outcome: 'ERROR',
        error: message,
      },
      null,
      2,
    ),
    { flag: 'wx', mode: 0o600 },
  );

  throw error;
}
