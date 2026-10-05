/** Explicitly invoked experiment adapter. Never imported by production entrypoints. */
import { constants, closeSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { canonicalJson, sha256Hex } from '../evidence/canonical.js';
import { parseStrictJson, prepareComparison, type Capture, type RecordedComparison } from './competence.js';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const KEY_ENDPOINT = 'https://openrouter.ai/api/v1/key';
const RESERVE = 10_000, COUNT = 26, MAX_BODY = 65_536;
export interface CaptureConfig {
  schemaVersion: 'binrat.capture-config/1'; modelId: string; providerSlug: string; responseProvider: string;
  maxCostMicrousd: number; expiresAt: string;
  maxPrice: { promptMicrousdPerMillion: number; completionMicrousdPerMillion: number };
}
const configValid = new Ajv2020({ strict: true, allErrors: true }).compile(
  JSON.parse(readFileSync(resolve('contracts/rat-workforce/competence/CAPTURE_CONFIG_V1.schema.json'), 'utf8'))
);
interface RequestBody {
  model: string; temperature: 0; max_tokens: 1024; stream: false;
  messages: Array<{ role: 'user'; content: string }>;
  provider: { only: string[]; order: string[]; allow_fallbacks: false; require_parameters: true;
    max_price: { prompt: number; completion: number; request: 0 } };
}
interface Request {
  assignmentId: string; promptDigest: string; evidenceDigest: string; body: RequestBody; requestDigest: string;
}
export interface CapturePlan {
  schemaVersion: 'binrat.capture-plan/1'; packDigest: string; runnerDigest: string;
  config: CaptureConfig; reservationMicrousd: number; requests: Request[]; planDigest: string;
}
interface Reservation {
  schemaVersion: 'binrat.capture-reservation/1'; planDigest: string; index: number;
  assignmentId: string; requestDigest: string; reservedMicrousd: number; dispatchedAt: string;
}
interface Receipt {
  schemaVersion: 'binrat.provider-receipt/1'; reservationDigest: string;
  outcome: 'CAPTURED' | 'HTTP_ERROR' | 'TRANSPORT_UNKNOWN' | 'RESPONSE_REJECTED';
  response: { status: number; body: string; truncated: boolean; redacted: boolean } | null;
  capture: Capture | null; receiptDigest: string;
}
interface Started { planDigest: string; keyFingerprint: string; startedAt: string }

/** Exact decimal ceiling: never under-reserve by binary floating point rounding. */
export function usdToMicrousd(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('INVALID_COST');
  const match = String(value).match(/^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/)!;
  const fraction = match[2] ?? '', scale = 6 + Number(match[3] ?? 0) - fraction.length;
  const digits = BigInt(match[1] + fraction);
  const result = scale >= 0 ? digits * 10n ** BigInt(scale) :
    (digits + 10n ** BigInt(-scale) - 1n) / 10n ** BigInt(-scale);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('INVALID_COST');
  return Number(result);
}
export async function createCapturePlan(input: unknown): Promise<CapturePlan> {
  if (!configValid(input)) throw new Error('CAPTURE_CONFIG_INVALID');
  const config = structuredClone(input) as CaptureConfig;
  const expiry = Date.parse(config.expiresAt);
  if (!Number.isFinite(expiry) || new Date(expiry).toISOString() !== config.expiresAt) throw new Error('INVALID_EXPIRY');
  // This pack has exactly 26 attempts. No cheaper partial comparison or reuse of released reservations.
  if (config.maxCostMicrousd !== COUNT * RESERVE) throw new Error('FULL_PACK_RESERVATION_REQUIRED');
  const rate = config.maxPrice;
  const upper = (8192n * BigInt(rate.promptMicrousdPerMillion) +
    1024n * BigInt(rate.completionMicrousdPerMillion) + 999_999n) / 1_000_000n;
  if (upper > BigInt(RESERVE)) throw new Error('PRICE_CEILING_EXCEEDS_ASSIGNMENT_BUDGET');
  const comparison = await prepareComparison();
  if (comparison.assignments.length !== COUNT) throw new Error('PACK_SIZE_CHANGED');
  const requests: Request[] = [];
  for (const a of comparison.assignments) {
    const body: RequestBody = {
      model: config.modelId, temperature: 0, max_tokens: 1024, stream: false,
      messages: [{ role: 'user', content: a.prompt }],
      provider: { only: [config.providerSlug], order: [config.providerSlug], allow_fallbacks: false,
        require_parameters: true, max_price: { prompt: rate.promptMicrousdPerMillion / 1_000_000,
          completion: rate.completionMicrousdPerMillion / 1_000_000, request: 0 } }
    };
    requests.push({ assignmentId: a.assignmentId, promptDigest: a.promptDigest, evidenceDigest: a.evidenceDigest,
      body, requestDigest: await sha256Hex({ endpoint: ENDPOINT, body }) });
  }
  const content = { schemaVersion: 'binrat.capture-plan/1' as const, packDigest: comparison.packDigest,
    runnerDigest: await sha256Hex({ module: readFileSync(new URL(import.meta.url), 'utf8'),
      configSchema: readFileSync(resolve('contracts/rat-workforce/competence/CAPTURE_CONFIG_V1.schema.json'), 'utf8') }),
    config, reservationMicrousd: COUNT * RESERVE, requests };
  return { ...content, planDigest: await sha256Hex(content) };
}

function syncDirectory(directory: string): void {
  const fd = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
/** Exclusive, durable files. A partial file after a crash blocks execution; never repair or replay it. */
function persist(directory: string, name: string, value: unknown): void {
  const fd = openSync(resolve(directory, name), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
    constants.O_NOFOLLOW, 0o600);
  try { writeFileSync(fd, JSON.stringify(value, null, 2) + '\n'); fsyncSync(fd); } finally { closeSync(fd); }
  syncDirectory(directory);
}
function read(directory: string, name: string): unknown {
  const fd = openSync(resolve(directory, name), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (!fstatSync(fd).isFile() || fstatSync(fd).size > 1_048_576) throw new Error('CAPTURE_FILE_TOO_LARGE');
    const text = readFileSync(fd, 'utf8');
    if (Buffer.byteLength(text) > 1_048_576) throw new Error('CAPTURE_FILE_TOO_LARGE');
    return parseStrictJson(text);
  } finally { closeSync(fd); }
}
function directoryPath(path: string): string {
  const directory = resolve(path);
  if (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink()) throw new Error('INVALID_RUN_DIRECTORY');
  return directory;
}
export async function prepareCaptureDirectory(config: unknown, path: string): Promise<CapturePlan> {
  const plan = await createCapturePlan(config);
  const directory = resolve(path);
  mkdirSync(directory, { mode: 0o700 }); syncDirectory(resolve(directory, '..'));
  persist(directory, 'plan.json', plan);
  return plan;
}
async function checkedPlan(directory: string): Promise<CapturePlan> {
  const stored = read(directory, 'plan.json') as CapturePlan;
  const current = await createCapturePlan(stored.config);
  if (canonicalJson(stored) !== canonicalJson(current)) throw new Error('PLAN_OR_PROTOCOL_CHANGED');
  return current;
}

type Transport = (url: string, init: RequestInit) => Promise<Response>;
async function boundedBody(response: Response): Promise<{ body: string; truncated: boolean }> {
  if (!response.body) return { body: '', truncated: false };
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return { body: Buffer.concat(chunks).toString('utf8'), truncated: false };
      if (size + value.byteLength > MAX_BODY) {
        chunks.push(value.subarray(0, MAX_BODY - size));
        await reader.cancel(); return { body: Buffer.concat(chunks).toString('utf8'), truncated: true };
      }
      chunks.push(value); size += value.byteLength;
    }
  } finally { reader.releaseLock(); }
}
async function call(transport: Transport, url: string, apiKey: string, body?: RequestBody) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await transport(url, { method: body ? 'POST' : 'GET', redirect: 'error',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
    const result = await boundedBody(response);
    // Credentials never enter durable artifacts, even if an upstream error echoes the bearer token.
    const scrubbed = result.body.split(apiKey).join('[REDACTED]').split(JSON.stringify(apiKey).slice(1, -1)).join('[REDACTED]');
    return { status: response.status, ...result, body: scrubbed, redacted: scrubbed !== result.body };
  } finally { clearTimeout(timer); }
}
async function keyLimit(transport: Transport, key: string, cap: number) {
  const response = await call(transport, KEY_ENDPOINT, key);
  if (response.status !== 200 || response.truncated || response.redacted) throw new Error('KEY_PREFLIGHT_FAILED');
  const { data } = parseStrictJson(response.body) as { data: Record<string, unknown> };
  const amount = (field: string) => {
    try { return usdToMicrousd(data[field]); }
    catch { throw new Error(`KEY_PREFLIGHT_INVALID_FIELD: ${field}`); }
  };
  const limit = amount('limit'), remaining = amount('limit_remaining'), usage = amount('usage');
  const failures = [
    ...(data.limit_reset !== null ? ['limit_reset must be null'] : []),
    ...(data.include_byok_in_limit !== true ? ['include_byok_in_limit must be true'] : []),
    ...(limit <= 0 || limit > cap ? ['limit must be positive and at most the approved cap'] : []),
    ...(remaining <= 0 || remaining > limit ? ['limit_remaining must be positive and no greater than limit'] : []),
    ...(usage > limit ? ['usage exceeds limit'] : []),
    ...(data.byok_usage !== 0 ? ['byok_usage must be zero'] : [])
  ];
  if (failures.length) throw new Error(`CAPPED_KEY_SETTINGS_REQUIRED: ${failures.join('; ')}`);
  // Remaining credit rounds down; caps and reported charges round up.
  return { limitMicrousd: limit, remainingMicrousd: Math.min(remaining, Math.floor((data.limit_remaining as number) * 1_000_000)) };
}
function decodeCapture(plan: CapturePlan, request: Request, response: NonNullable<Receipt['response']>): Capture {
  if (response.status !== 200 || response.truncated || response.redacted) throw new Error('RESPONSE_REJECTED');
  const parsed = parseStrictJson(response.body) as {
    id: unknown; model: unknown; provider: unknown; error?: unknown;
    choices: Array<{ index: unknown; finish_reason: unknown; message: { content: unknown; tool_calls?: unknown } }>;
    usage: { prompt_tokens: number; completion_tokens: number; cost: unknown; is_byok?: unknown };
  };
  if (parsed.error || typeof parsed.id !== 'string' || !parsed.id || parsed.model !== plan.config.modelId ||
      parsed.provider !== plan.config.responseProvider || parsed.choices.length !== 1 ||
      parsed.choices[0].index !== 0 || parsed.choices[0].finish_reason !== 'stop' ||
      parsed.choices[0].message.tool_calls != null || parsed.usage.is_byok === true) throw new Error('RESPONSE_REJECTED');
  const rawOutput = parsed.choices[0].message.content;
  const { prompt_tokens: inputTokens, completion_tokens: outputTokens } = parsed.usage;
  const costMicrousd = usdToMicrousd(parsed.usage.cost);
  if (typeof rawOutput !== 'string' || rawOutput.length === 0 || rawOutput.length > 16_384 ||
      !Number.isSafeInteger(inputTokens) || inputTokens <= 0 || inputTokens > 8192 ||
      !Number.isSafeInteger(outputTokens) || outputTokens <= 0 || outputTokens > 1024 || costMicrousd > RESERVE) {
    throw new Error('RESPONSE_REJECTED');
  }
  // Deliberately do not parse/repair investigator output. Invalid answers must reach #124's grader unchanged.
  return { assignmentId: request.assignmentId, promptDigest: request.promptDigest, evidenceDigest: request.evidenceDigest,
    rawOutput, usage: { calls: 1, inputTokens, outputTokens, costMicrousd } };
}

export async function executeCapture(path: string, authorizationDigest: string, apiKey: string,
  transport: Transport = fetch): Promise<{ attempted: number; outcome: 'COMPLETE' | 'HALTED' }> {
  const directory = directoryPath(path), plan = await checkedPlan(directory);
  if (authorizationDigest !== plan.planDigest) throw new Error('EXACT_PLAN_AUTHORIZATION_REQUIRED');
  if (Date.now() >= Date.parse(plan.config.expiresAt)) throw new Error('AUTHORIZATION_EXPIRED');
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(apiKey)) throw new Error('API_KEY_REQUIRED');
  // Permanent one-shot lock: no restart, retry, stale-lock deletion or parallel execution of this directory.
  persist(directory, 'run.started.json', { planDigest: plan.planDigest,
    keyFingerprint: await sha256Hex({ key: apiKey }), startedAt: new Date().toISOString() } satisfies Started);
  for (const [index, request] of plan.requests.entries()) {
    if (Date.now() >= Date.parse(plan.config.expiresAt)) return { attempted: index, outcome: 'HALTED' };
    // Recheck the dedicated provider cap before each dispatch. No mutations of keys, credits or account config.
    const keyState = await keyLimit(transport, apiKey, plan.config.maxCostMicrousd);
    if (keyState.remainingMicrousd < RESERVE || Date.now() >= Date.parse(plan.config.expiresAt)) {
      return { attempted: index, outcome: 'HALTED' };
    }
    const reservation: Reservation = { schemaVersion: 'binrat.capture-reservation/1', planDigest: plan.planDigest,
      index, assignmentId: request.assignmentId, requestDigest: request.requestDigest,
      reservedMicrousd: RESERVE, dispatchedAt: new Date().toISOString() };
    // Entire fixed reservation stays consumed, including errors, ambiguous sends, and unused provider headroom.
    if ((index + 1) * RESERVE > plan.config.maxCostMicrousd) throw new Error('LOCAL_BUDGET_EXHAUSTED');
    persist(directory, `${index}.reserved.json`, reservation);
    let response: Receipt['response'] = null, capture: Capture | null = null;
    let outcome: Receipt['outcome'] = 'TRANSPORT_UNKNOWN';
    try {
      response = await call(transport, ENDPOINT, apiKey, request.body);
      outcome = response.status === 200 ? 'RESPONSE_REJECTED' : 'HTTP_ERROR';
      capture = decodeCapture(plan, request, response); outcome = 'CAPTURED';
    } catch { /* Never persist exception text that might contain credentials. Unknown charges stay reserved. */ }
    const content = { schemaVersion: 'binrat.provider-receipt/1' as const,
      reservationDigest: await sha256Hex(reservation), outcome, response, capture };
    persist(directory, `${index}.receipt.json`, { ...content, receiptDigest: await sha256Hex(content) });
    if (outcome !== 'CAPTURED') return { attempted: index + 1, outcome: 'HALTED' };
  }
  return { attempted: COUNT, outcome: 'COMPLETE' };
}

/** Offline audit regenerates every capture from raw local provider receipts. Hashes are not billing attestation. */
export async function auditCapture(path: string) {
  const directory = directoryPath(path), plan = await checkedPlan(directory);
  const started = read(directory, 'run.started.json') as Started;
  if (started.planDigest !== plan.planDigest) throw new Error('START_BINDING_INVALID');
  const captures: Capture[] = []; let attempted = 0, ambiguous = 0, stopped = false;
  const exists = (name: string) => { try { lstatSync(resolve(directory, name)); return true; }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; } };
  for (const [index, request] of plan.requests.entries()) {
    const reserved = exists(`${index}.reserved.json`), received = exists(`${index}.receipt.json`);
    if (!reserved) { if (received) throw new Error('RECEIPT_WITHOUT_RESERVATION'); stopped = true; continue; }
    if (stopped) throw new Error('RESERVATION_AFTER_HALT_OR_GAP');
    const reservation = read(directory, `${index}.reserved.json`) as Reservation;
    if (reservation.schemaVersion !== 'binrat.capture-reservation/1' || reservation.planDigest !== plan.planDigest ||
        reservation.index !== index || reservation.assignmentId !== request.assignmentId ||
        reservation.requestDigest !== request.requestDigest || reservation.reservedMicrousd !== RESERVE) throw new Error('RESERVATION_INVALID');
    attempted++;
    if (!received) { ambiguous++; stopped = true; continue; }
    const receipt = read(directory, `${index}.receipt.json`) as Receipt;
    const { receiptDigest, ...content } = receipt;
    if (receipt.schemaVersion !== 'binrat.provider-receipt/1' || receipt.reservationDigest !== await sha256Hex(reservation) ||
        receiptDigest !== await sha256Hex(content)) throw new Error('RECEIPT_BINDING_INVALID');
    if (receipt.outcome === 'CAPTURED') {
      const capture = decodeCapture(plan, request, receipt.response!);
      if (canonicalJson(capture) !== canonicalJson(receipt.capture)) throw new Error('CAPTURE_DERIVATION_INVALID');
      captures.push(capture);
    } else { if (receipt.capture !== null) throw new Error('FAILED_RECEIPT_HAS_CAPTURE'); ambiguous++; stopped = true; }
  }
  const comparison: RecordedComparison = { schemaVersion: 'binrat.recorded-comparison/1', packDigest: plan.packDigest,
    provenance: 'RECORDED_UNVERIFIED_OUTPUTS', cohort: { modelId: plan.config.modelId, temperature: 0,
      maxInputTokens: 8192, maxOutputTokens: 1024 }, captures };
  return { comparison, summary: { attempted, captured: captures.length, ambiguousOrRejected: ambiguous,
    reservedMicrousd: attempted * RESERVE, capturedProviderReportedCostMicrousd: captures.reduce((sum, c) => sum + c.usage.costMicrousd, 0),
    complete: captures.length === COUNT, provenance: 'LOCAL_PROVIDER_RECEIPTS_UNATTESTED', modelCompetence: 'UNPROVEN' } };
}
