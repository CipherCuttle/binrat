import type { RatConversationContext, RatIntent, RatUnderstanding } from './nlp.js';
import { understandRatMessage } from './nlp.js';
import { renderRatVoice, type RatAnswerPlan, type RatMood, type RenderedRatReply } from './voice.js';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const BAG_ID_RE = /^[0-9a-fA-F]{64}$/;

export interface CapabilityState {
  engineeringStatus?: string;
  deploymentStatus?: string;
  publicStatus?: string;
  phase?: string;
}

export interface CapabilityManifest {
  schemaVersion: string;
  capabilities: Record<string, CapabilityState>;
  launchAuthorization: {
    status: string;
    marketingAuthorized: boolean;
    launchAuthorized: boolean;
    tokenState?: string;
  };
  invariant: string;
}

export interface RatConfig {
  apiBaseUrl: string;
  siteUrl: string;
  manifest: CapabilityManifest;
}

type FetchLike = typeof fetch;

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = 'UNKNOWN'): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function boolLabel(value: boolean): string {
  return value ? 'YES' : 'NO';
}

function capabilityStatus(key: string, config: RatConfig): string {
  const state = config.manifest.capabilities[key];
  if (!state) return 'UNKNOWN';
  const parts = [state.engineeringStatus, state.deploymentStatus, state.publicStatus].filter(Boolean);
  return parts.join(' / ') || 'UNKNOWN';
}

function plan(
  intent: RatIntent,
  mood: RatMood,
  facts: RatAnswerPlan['facts'] = {},
  receiptIds: string[] = [],
  caveats: string[] = [],
  sourceRefs: string[] = []
): RatAnswerPlan {
  return {
    schemaVersion: 'binrat.rat-answer-plan/0.1',
    intent,
    mood,
    facts,
    receiptIds,
    caveats,
    sourceRefs
  };
}

export function validateCapabilityManifest(value: unknown): CapabilityManifest {
  const root = record(value);
  const launch = record(root.launchAuthorization);
  const capabilities = record(root.capabilities);
  if (
    root.schemaVersion !== 'binrat.capability-manifest/0.1' ||
    typeof root.invariant !== 'string' ||
    typeof launch.status !== 'string' ||
    typeof launch.marketingAuthorized !== 'boolean' ||
    typeof launch.launchAuthorized !== 'boolean'
  ) {
    throw new Error('CAPABILITY_MANIFEST_INVALID');
  }
  for (const state of Object.values(capabilities)) {
    if (!state || typeof state !== 'object') throw new Error('CAPABILITY_MANIFEST_INVALID');
    const engineeringStatus = (state as Record<string, unknown>).engineeringStatus;
    if (engineeringStatus !== undefined && typeof engineeringStatus !== 'string') {
      throw new Error('CAPABILITY_MANIFEST_INVALID');
    }
  }
  return value as CapabilityManifest;
}

async function getJson(path: string, config: RatConfig, fetchImpl: FetchLike): Promise<{ ok: boolean; status: number; value: Record<string, unknown> }> {
  const response = await fetchImpl(`${trimSlash(config.apiBaseUrl)}${path}`, {
    headers: { accept: 'application/json' }
  });
  let parsed: unknown = {};
  try { parsed = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, value: record(parsed) };
}

function staticPlan(understanding: RatUnderstanding, config: RatConfig): RatAnswerPlan | null {
  switch (understanding.intent) {
    case 'WHY':
      return plan('WHY', 'RUMMAGING', { site: trimSlash(config.siteUrl) }, [], [], ['STATIC_PRODUCT_THESIS']);
    case 'ROADMAP':
      return plan('ROADMAP', 'NEUTRAL', {
        intelligenceV1: capabilityStatus('intelligenceV1', config),
        replayLab: capabilityStatus('replayLab', config),
        telegramRatV0: capabilityStatus('telegramRatV0', config),
        dumpsterLedger: capabilityStatus('dumpsterLedger', config),
        ratDenV0: capabilityStatus('ratDenV0', config),
        ratWatchV0: capabilityStatus('ratWatchV0', config),
        dumpsterRaidsV0: capabilityStatus('dumpsterRaidsV0', config),
        launchAuthorization: config.manifest.launchAuthorization.status
      }, [], [], ['CAPABILITY_MANIFEST']);
    case 'TOKEN': {
      const launch = config.manifest.launchAuthorization;
      const tokenState = launch.tokenState ?? 'UNKNOWN';
      return plan('TOKEN', 'NEUTRAL', {
        tokenState,
        launchAuthorization: launch.status,
        marketingAuthorized: boolLabel(launch.marketingAuthorized),
        launchAuthorized: boolLabel(launch.launchAuthorized),
        tokenMessage: tokenState === 'NOT_LAUNCHED'
          ? 'no official $BINRAT token is launched yet.'
          : 'reporting the canonical manifest state only.',
        invariant: config.manifest.invariant
      }, [], [], ['CAPABILITY_MANIFEST']);
    }
    case 'PROOF':
      return plan('PROOF', 'NEUTRAL', { invariant: config.manifest.invariant }, [], [], ['BINRAT_DOCTRINE']);
    case 'HELP':
      return plan('HELP', 'RUMMAGING', {}, [], [], ['TELEGRAM_RAT_V0']);
    case 'BUY_BOUNDARY':
      return plan('BUY_BOUNDARY', 'BOUNDARY', {}, [], [], ['CLAIM_BOUNDARY']);
    case 'SAFETY_BOUNDARY':
      return plan('SAFETY_BOUNDARY', 'BOUNDARY', {}, [], [], ['CLAIM_BOUNDARY']);
    case 'CLARIFY':
      return plan('CLARIFY', 'EMPTY_PAWS', {}, [], [], ['RAT_NLP_V0_5']);
    default:
      return null;
  }
}

async function statusPlan(config: RatConfig, fetchImpl: FetchLike): Promise<RatAnswerPlan> {
  try {
    const result = await getJson('/api/health', config, fetchImpl);
    if (!result.ok) {
      return plan('STATUS', 'STUCK_IN_A_PIPE', {
        index: `UNAVAILABLE / HTTP ${result.status}`,
        launchCount: 0,
        checkpointBlock: 'NONE',
        history: 'UNKNOWN',
        observations: 'UNKNOWN',
        telegramStatus: capabilityStatus('telegramRatV0', config)
      }, [], ['the rat will not invent a healthy status.'], ['/api/health']);
    }
    const h = result.value;
    const ready = h.indexReady === true;
    const obs = h.observationReady === true;
    const history = h.historyBackfillComplete === true;
    return plan('STATUS', ready && obs ? (history ? 'RUMMAGING' : 'DIGGING') : 'STUCK_IN_A_PIPE', {
      index: ready ? 'READY' : 'DEGRADED',
      launchCount: numberValue(h.launchCount),
      checkpointBlock: stringValue(h.checkpointBlock, 'NONE'),
      history: history ? 'COMPLETE' : 'IN PROGRESS / UNVERIFIED',
      observations: obs ? 'READY' : 'PARTIAL / DEGRADED',
      telegramStatus: capabilityStatus('telegramRatV0', config),
      ...(h.lastSyncError ? { indexError: stringValue(h.lastSyncError) } : {}),
      ...(h.lastObservationError ? { observationError: stringValue(h.lastObservationError) } : {})
    }, [], [], ['/api/health']);
  } catch {
    return plan('STATUS', 'STUCK_IN_A_PIPE', {
      index: 'UNREACHABLE',
      launchCount: 0,
      checkpointBlock: 'NONE',
      history: 'UNKNOWN',
      observations: 'UNKNOWN',
      telegramStatus: capabilityStatus('telegramRatV0', config)
    }, [], ['public read plane unreachable. the rat will not guess.'], ['/api/health']);
  }
}

async function creatorPlan(understanding: RatUnderstanding, config: RatConfig, fetchImpl: FetchLike): Promise<RatAnswerPlan> {
  const address = understanding.argument;
  if (!ADDRESS_RE.test(address)) return plan('CREATOR_HISTORY', 'EMPTY_PAWS', { invalidInput: true });
  try {
    const result = await getJson(`/api/creator/${address.toLowerCase()}`, config, fetchImpl);
    if (result.status === 404) return plan('CREATOR_HISTORY', 'EMPTY_PAWS', { notFound: true });
    if (!result.ok) return plan('CREATOR_HISTORY', 'STUCK_IN_A_PIPE', { notFound: true }, [], [`Creator File unavailable / HTTP ${result.status}.`]);
    const c = result.value;
    const receipt = record(c.receipt);
    const receiptId = stringValue(receipt.receiptId, '');
    const indexedLaunchCount = numberValue(c.indexedLaunchCount);
    return plan('CREATOR_HISTORY', indexedLaunchCount > 1 ? 'SMELLS_FAMILIAR' : 'RUMMAGING', {
      creator: stringValue(c.reportedCreatorAddress),
      indexedLaunchCount,
      firstIndexedBlock: stringValue(c.firstIndexedBlock),
      lastIndexedBlock: stringValue(c.lastIndexedBlock),
      historyCoverage: stringValue(c.historyCoverage),
      receipt: receiptId || 'UNKNOWN',
      identityRiskLanguage: understanding.identityRiskLanguage
    }, receiptId ? [receiptId] : [], [], [`/api/creator/${address.toLowerCase()}`]);
  } catch {
    return plan('CREATOR_HISTORY', 'STUCK_IN_A_PIPE', { notFound: true }, [], ['Creator File lookup failed. no invented scraps.']);
  }
}

async function bagPlan(id: string, receiptOnly: boolean, config: RatConfig, fetchImpl: FetchLike): Promise<RatAnswerPlan> {
  const intent: RatIntent = receiptOnly ? 'RECEIPT' : 'BAG';
  if (!BAG_ID_RE.test(id)) return plan(intent, 'EMPTY_PAWS', { invalidInput: true });
  try {
    const result = await getJson(`/api/bag/${encodeURIComponent(id)}`, config, fetchImpl);
    if (result.status === 404) return plan(intent, 'EMPTY_PAWS', { notFound: true });
    if (!result.ok) return plan(intent, 'STUCK_IN_A_PIPE', { notFound: true }, [], [`launch lookup unavailable / HTTP ${result.status}.`]);
    const bag = record(result.value.bag);
    const receipt = record(result.value.receipt);
    const receiptId = stringValue(receipt.receiptId, '');
    if (receiptOnly) {
      return plan('RECEIPT', 'RUMMAGING', {
        launchId: stringValue(bag.id, id),
        receipt: receiptId || 'UNKNOWN',
        asOfBlock: stringValue(result.value.asOfBlock),
        historyCoverage: stringValue(result.value.historyCoverage)
      }, receiptId ? [receiptId] : [], [], [`/api/bag/${id}`]);
    }
    const trail = record(bag.trashTrail);
    return plan('BAG', 'RUMMAGING', {
      symbol: stringValue(bag.symbol, '?'),
      name: stringValue(bag.name, 'unnamed'),
      launchId: stringValue(bag.id, id),
      creator: stringValue(bag.reportedCreatorAddress),
      priorLaunchCount: numberValue(trail.priorLaunchCount),
      historyCoverage: stringValue(trail.coverage),
      receipt: receiptId || 'UNKNOWN'
    }, receiptId ? [receiptId] : [], [], [`/api/bag/${id}`]);
  } catch {
    return plan(intent, 'STUCK_IN_A_PIPE', { notFound: true }, [], ['launch lookup failed. no invented scraps.']);
  }
}

async function replayPlan(id: string, config: RatConfig, fetchImpl: FetchLike): Promise<RatAnswerPlan> {
  if (!BAG_ID_RE.test(id)) return plan('REPLAY', 'EMPTY_PAWS', { invalidInput: true });
  try {
    const result = await getJson(`/api/bag/${encodeURIComponent(id)}/replay`, config, fetchImpl);
    if (result.status === 404) return plan('REPLAY', 'EMPTY_PAWS', { notFound: true });
    if (!result.ok) return plan('REPLAY', 'STUCK_IN_A_PIPE', { notFound: true }, [], [`replay unavailable / HTTP ${result.status}.`]);
    const launch = record(result.value.launch);
    const intelligence = record(result.value.intelligence);
    const receipt = record(result.value.receipt);
    const receiptId = stringValue(receipt.receiptId, '');
    const stagesRaw = Array.isArray(result.value.stages) ? result.value.stages : [];
    const stages = stagesRaw
      .map((value) => record(value))
      .map((stage) => `${stringValue(stage.label)} ${stringValue(stage.status)}`)
      .join(' → ');
    return plan('REPLAY', 'RUMMAGING', {
      symbol: stringValue(launch.symbol, '?'),
      name: stringValue(launch.name, 'unnamed'),
      stages: stages || 'UNKNOWN',
      observationCoverage: stringValue(intelligence.observationCoverage),
      historyCoverage: stringValue(result.value.historyCoverage),
      receipt: receiptId || 'UNKNOWN'
    }, receiptId ? [receiptId] : [], [], [`/api/bag/${id}/replay`]);
  } catch {
    return plan('REPLAY', 'STUCK_IN_A_PIPE', { notFound: true }, [], ['replay lookup failed. no invented timeline.']);
  }
}

async function resolvePlan(
  understanding: RatUnderstanding,
  config: RatConfig,
  fetchImpl: FetchLike
): Promise<RatAnswerPlan> {
  const fixed = staticPlan(understanding, config);
  if (fixed) return fixed;
  if (understanding.intent === 'STATUS') return statusPlan(config, fetchImpl);
  if (understanding.intent === 'CREATOR_HISTORY') return creatorPlan(understanding, config, fetchImpl);
  if (understanding.intent === 'BAG') return bagPlan(understanding.argument, false, config, fetchImpl);
  if (understanding.intent === 'RECEIPT') return bagPlan(understanding.argument, true, config, fetchImpl);
  if (understanding.intent === 'REPLAY') return replayPlan(understanding.argument, config, fetchImpl);
  return plan('CLARIFY', 'EMPTY_PAWS');
}

export async function renderRatReplyDetailed(
  text: string,
  config: RatConfig,
  fetchImpl: FetchLike = fetch,
  context: RatConversationContext = {}
): Promise<RenderedRatReply | null> {
  const understanding = understandRatMessage(text, context);
  if (!understanding) return null;
  const answerPlan = await resolvePlan(understanding, config, fetchImpl);
  return renderRatVoice(answerPlan);
}

export async function renderRatReply(
  text: string,
  config: RatConfig,
  fetchImpl: FetchLike = fetch,
  context: RatConversationContext = {}
): Promise<string | null> {
  return (await renderRatReplyDetailed(text, config, fetchImpl, context))?.text ?? null;
}
