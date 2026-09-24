import type { RatConversationContext, RatIntent, RatUnderstanding } from './nlp.js';
import { understandRatMessage } from './nlp.js';
import {
  BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS,
  BINRAT_TREASURY_ADDRESS,
  LAUNCH_CONFIG_DIGEST
} from '../launchConfig/config.js';
import { REQUIRED_LAUNCH_GATE_IDS } from '../launchConfig/gateMatrix.js';
import {
  validatePonsDiscoveryManifest,
  type PonsDiscoveryManifest
} from '../launchConfig/ponsDiscovery.js';
import {
  validatePonsSuccessorCandidate,
  type PonsSuccessorCandidate
} from '../launchConfig/ponsCutover.js';
import {
  makeRatAnswerPlan,
  renderRatVoice,
  type RatAnswerPlan,
  type RenderedRatReply
} from './voice.js';

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
    explicitOwnerLaunchAuthorityState?: string;
  };
  launchConfiguration?: {
    treasuryAddress: string;
    projectFeeRecipientAddress: string;
    tokenAddressState: string;
    accountingActive: boolean;
    holderGateStatus: string;
    configDigest?: string;
  };
  tokenLaunchSuccessor?: PonsSuccessorCandidate;
  tokenLaunchDiscovery?: PonsDiscoveryManifest;
  launchGateStatus?: {
    matrix: string;
    matrixDigest: string;
    statuses: Record<string, string>;
    blockingGateCount: number;
  };
  invariant: string;
}

export interface RatConfig {
  apiBaseUrl: string;
  siteUrl: string;
  manifest: CapabilityManifest;
  manifestMode?: 'LOCAL_ONLY' | 'REMOTE_FAIL_CLOSED';
}

type FetchLike = typeof fetch;

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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

function expectSchema(value: Record<string, unknown>, expected: string): void {
  if (value.schemaVersion !== expected) throw new Error('PUBLIC_API_CONTRACT_MISMATCH');
}

function capabilityStatus(key: string, manifest: CapabilityManifest): string {
  const state = manifest.capabilities[key];
  if (!state) return 'UNKNOWN';
  const parts = [state.engineeringStatus, state.deploymentStatus, state.publicStatus].filter(Boolean);
  return parts.join(' / ') || 'UNKNOWN';
}

function failClosedManifest(local: CapabilityManifest): CapabilityManifest {
  return {
    ...local,
    launchAuthorization: {
      ...local.launchAuthorization,
      status: 'UNVERIFIED_REMOTE_STATUS',
      marketingAuthorized: false,
      launchAuthorized: false,
      tokenState: local.launchAuthorization.tokenState === 'NOT_LAUNCHED' ? 'NOT_LAUNCHED' : 'UNVERIFIED'
    }
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
  if (
    launch.status !== 'BLOCKED' ||
    launch.marketingAuthorized !== false ||
    launch.launchAuthorized !== false ||
    launch.tokenState !== 'NOT_LAUNCHED'
  ) throw new Error('CAPABILITY_MANIFEST_AUTHORIZATION_ESCALATION');
  if (root.launchConfiguration !== undefined) {
    const config = record(root.launchConfiguration);
    if (
      config.configDigest !== LAUNCH_CONFIG_DIGEST ||
      config.treasuryAddress !== BINRAT_TREASURY_ADDRESS ||
      config.projectFeeRecipientAddress !== BINRAT_PROJECT_FEE_RECIPIENT_ADDRESS ||
      config.tokenAddressState !== 'NOT_YET_CREATED' ||
      config.accountingActive !== false ||
      config.holderGateStatus !== 'TOKEN_AUTHORITY_NOT_CONFIGURED'
    ) throw new Error('CAPABILITY_MANIFEST_LAUNCH_CONFIG_INVALID');
  }
  if (root.tokenLaunchSuccessor !== undefined) {
    validatePonsSuccessorCandidate(root.tokenLaunchSuccessor);
    if (launch.explicitOwnerLaunchAuthorityState !== undefined &&
        launch.explicitOwnerLaunchAuthorityState !== 'NOT_GRANTED') {
      throw new Error('CAPABILITY_MANIFEST_PONS_AUTHORITY_ESCALATION');
    }
    if (root.launchConfiguration === undefined) {
      throw new Error('CAPABILITY_MANIFEST_PONS_LEGACY_CONTEXT_MISSING');
    }
  }
  if (root.tokenLaunchDiscovery !== undefined) {
    validatePonsDiscoveryManifest(root.tokenLaunchDiscovery,root.tokenLaunchSuccessor);
  }
  if (root.launchGateStatus !== undefined) {
    const gateStatus = record(root.launchGateStatus);
    const statuses = record(gateStatus.statuses);
    if (
      gateStatus.matrix !== 'docs/LAUNCH_GATE_MATRIX_V0.json' ||
      typeof gateStatus.matrixDigest !== 'string' ||
      !/^[0-9a-f]{64}$/.test(gateStatus.matrixDigest) ||
      gateStatus.blockingGateCount !== 2
    ) throw new Error('CAPABILITY_MANIFEST_LAUNCH_GATES_INVALID');
    const ids = Object.keys(statuses).sort();
    if (JSON.stringify(ids) !== JSON.stringify([...REQUIRED_LAUNCH_GATE_IDS].sort())) {
      throw new Error('CAPABILITY_MANIFEST_LAUNCH_GATES_INVALID');
    }
    for (const id of REQUIRED_LAUNCH_GATE_IDS) {
      if (!VALID_GATE_STATUSES.has(statuses[id] as string)) {
        throw new Error(`CAPABILITY_MANIFEST_LAUNCH_GATE_STATUS_INVALID:${id}`);
      }
    }
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

const VALID_GATE_STATUSES = new Set([
  'SATISFIED',
  'PARTIAL',
  'BLOCKED_FUTURE_EVENT',
  'BLOCKED_OWNER_INPUT',
  'BLOCKED_LEGAL'
]);

async function getJson(
  path: string,
  config: RatConfig,
  fetchImpl: FetchLike
): Promise<{ ok: boolean; status: number; value: Record<string, unknown> }> {
  const response = await fetchImpl(`${trimSlash(config.apiBaseUrl)}${path}`, {
    headers: { accept: 'application/json' }
  });
  let parsed: unknown = {};
  try { parsed = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, value: record(parsed) };
}

async function currentManifest(config: RatConfig, fetchImpl: FetchLike): Promise<CapabilityManifest> {
  if (config.manifestMode !== 'REMOTE_FAIL_CLOSED') return config.manifest;
  try {
    const result = await getJson('/api/capabilities', config, fetchImpl);
    if (!result.ok) return failClosedManifest(config.manifest);
    return validateCapabilityManifest(result.value);
  } catch {
    return failClosedManifest(config.manifest);
  }
}

function staticPlan(
  understanding: RatUnderstanding,
  config: RatConfig,
  manifest: CapabilityManifest
): RatAnswerPlan | null {
  switch (understanding.intent) {
    case 'WHY':
      return makeRatAnswerPlan('WHY', 'RUMMAGING', { site: trimSlash(config.siteUrl) }, [], [], ['STATIC_PRODUCT_THESIS']);
    case 'ROADMAP':
      return makeRatAnswerPlan('ROADMAP', 'NEUTRAL', {
        intelligenceV1: capabilityStatus('intelligenceV1', manifest),
        replayLab: capabilityStatus('replayLab', manifest),
        telegramRatV0: capabilityStatus('telegramRatV0', manifest),
        dumpsterLedger: capabilityStatus('dumpsterLedger', manifest),
        ratDenV0: capabilityStatus('ratDenV0', manifest),
        ratWatchV0: capabilityStatus('ratWatchV0', manifest),
        dumpsterRaidsV0: capabilityStatus('dumpsterRaidsV0', manifest),
        launchAuthorization: manifest.launchAuthorization.status
      }, [], [], ['CAPABILITY_MANIFEST']);
    case 'TOKEN': {
      const launch = manifest.launchAuthorization;
      const tokenState = launch.tokenState ?? 'UNKNOWN';
      return makeRatAnswerPlan('TOKEN', 'NEUTRAL', {
        tokenState,
        launchAuthorization: launch.status,
        marketingAuthorized: boolLabel(launch.marketingAuthorized),
        launchAuthorized: boolLabel(launch.launchAuthorized),
        treasury: manifest.launchConfiguration?.treasuryAddress ?? 'NOT_CONFIGURED',
        projectFeeRecipient: manifest.launchConfiguration?.projectFeeRecipientAddress ?? 'NOT_CONFIGURED',
        selectedTokenRail: manifest.tokenLaunchSuccessor
          ? 'Pons V2 on Robinhood 4663 (blocked planning candidate)' : undefined,
        researchNetwork: manifest.tokenLaunchSuccessor
          ? 'Arc 5042 (research only)' : undefined,
        ponsTreasury: manifest.tokenLaunchSuccessor ? 'NOT_VERIFIED' : undefined,
        ponsCreatorFeeRecipient: manifest.tokenLaunchSuccessor ? 'NOT_VERIFIED' : undefined,
        legacyArcRoleContext: manifest.tokenLaunchSuccessor
          ? 'Historical ArcPad V0 declarations only; not proof of Pons custody.' : undefined,
        ponsListingStatus: manifest.tokenLaunchDiscovery?.status,
        officialWebsiteStatus: manifest.tokenLaunchDiscovery ? 'NOT_VERIFIED' : undefined,
        officialTelegramStatus: manifest.tokenLaunchDiscovery ? 'NOT_VERIFIED' : undefined,
        officialXStatus: manifest.tokenLaunchDiscovery ? 'NOT_VERIFIED' : undefined,
        verifiedRepository: manifest.tokenLaunchDiscovery?.verifiedGithub,
        tokenAddressState: manifest.launchConfiguration?.tokenAddressState ?? 'UNKNOWN',
        holderGateStatus: manifest.launchConfiguration?.holderGateStatus ?? 'UNKNOWN',
        tokenMessage: tokenState === 'NOT_LAUNCHED'
          ? 'no official $BINRAT token is launched yet.'
          : 'reporting the canonical manifest state only.',
        invariant: manifest.invariant
      }, [], [], ['CAPABILITY_MANIFEST']);
    }
    case 'PROOF':
      return makeRatAnswerPlan('PROOF', 'NEUTRAL', { invariant: manifest.invariant }, [], [], ['BINRAT_DOCTRINE']);
    case 'HELP':
      return makeRatAnswerPlan('HELP', 'RUMMAGING', {}, [], [], ['TELEGRAM_RAT_V0']);
    case 'BUY_BOUNDARY':
      return makeRatAnswerPlan('BUY_BOUNDARY', 'BOUNDARY', {}, [], [], ['CLAIM_BOUNDARY']);
    case 'SAFETY_BOUNDARY':
      return makeRatAnswerPlan('SAFETY_BOUNDARY', 'BOUNDARY', {}, [], [], ['CLAIM_BOUNDARY']);
    case 'CLARIFY':
      return makeRatAnswerPlan('CLARIFY', 'EMPTY_PAWS', {}, [], [], ['RAT_NLP_V0_5']);
    default:
      return null;
  }
}

async function statusPlan(config: RatConfig, fetchImpl: FetchLike, manifest: CapabilityManifest): Promise<RatAnswerPlan> {
  try {
    const result = await getJson('/api/health', config, fetchImpl);
    const h = result.value;
    if (
      !result.ok ||
      typeof h.indexReady !== 'boolean' ||
      typeof h.observationReady !== 'boolean' ||
      typeof h.historyBackfillComplete !== 'boolean'
    ) {
      return makeRatAnswerPlan('STATUS', 'STUCK_IN_A_PIPE', {
        index: `UNAVAILABLE / HTTP ${result.status}`,
        launchCount: 0,
        checkpointBlock: 'NONE',
        history: 'UNKNOWN',
        observations: 'UNKNOWN',
        telegramStatus: capabilityStatus('telegramRatV0', manifest)
      }, [], ['the rat will not invent a healthy status.'], ['/api/health']);
    }
    const ready = h.indexReady === true;
    const obs = h.observationReady === true;
    const history = h.historyBackfillComplete === true;
    return makeRatAnswerPlan('STATUS', ready && obs ? (history ? 'RUMMAGING' : 'DIGGING') : 'STUCK_IN_A_PIPE', {
      index: ready ? 'READY' : 'DEGRADED',
      launchCount: numberValue(h.launchCount),
      checkpointBlock: stringValue(h.checkpointBlock, 'NONE'),
      history: history ? 'COMPLETE' : 'IN PROGRESS / UNVERIFIED',
      observations: obs ? 'READY' : 'PARTIAL / DEGRADED',
      telegramStatus: capabilityStatus('telegramRatV0', manifest),
      ...(h.lastSyncError ? { indexError: stringValue(h.lastSyncError) } : {}),
      ...(h.lastObservationError ? { observationError: stringValue(h.lastObservationError) } : {})
    }, [], [], ['/api/health']);
  } catch {
    return makeRatAnswerPlan('STATUS', 'STUCK_IN_A_PIPE', {
      index: 'UNREACHABLE',
      launchCount: 0,
      checkpointBlock: 'NONE',
      history: 'UNKNOWN',
      observations: 'UNKNOWN',
      telegramStatus: capabilityStatus('telegramRatV0', manifest)
    }, [], ['public read plane unreachable. the rat will not guess.'], ['/api/health']);
  }
}

async function creatorPlan(
  understanding: RatUnderstanding,
  config: RatConfig,
  fetchImpl: FetchLike
): Promise<RatAnswerPlan> {
  const address = understanding.argument;
  if (!ADDRESS_RE.test(address)) {
    return makeRatAnswerPlan('CREATOR_HISTORY', 'EMPTY_PAWS', { invalidInput: true });
  }
  try {
    const result = await getJson(`/api/creator/${address.toLowerCase()}`, config, fetchImpl);
    if (result.status === 404) return makeRatAnswerPlan('CREATOR_HISTORY', 'EMPTY_PAWS', { notFound: true });
    if (!result.ok) {
      return makeRatAnswerPlan(
        'CREATOR_HISTORY',
        'STUCK_IN_A_PIPE',
        { notFound: true },
        [],
        [`Creator File unavailable / HTTP ${result.status}.`]
      );
    }
    expectSchema(result.value, 'binrat.creator-file/0.1');
    const c = result.value;
    const receipt = record(c.receipt);
    const receiptId = stringValue(receipt.receiptId, '');
    if (
      !ADDRESS_RE.test(stringValue(c.reportedCreatorAddress, '')) ||
      typeof c.indexedLaunchCount !== 'number' ||
      typeof c.historyCoverage !== 'string'
    ) throw new Error('PUBLIC_API_CONTRACT_MISMATCH');

    const indexedLaunchCount = numberValue(c.indexedLaunchCount);
    return makeRatAnswerPlan('CREATOR_HISTORY', indexedLaunchCount > 1 ? 'SMELLS_FAMILIAR' : 'RUMMAGING', {
      creator: stringValue(c.reportedCreatorAddress),
      indexedLaunchCount,
      firstIndexedBlock: stringValue(c.firstIndexedBlock),
      lastIndexedBlock: stringValue(c.lastIndexedBlock),
      historyCoverage: stringValue(c.historyCoverage),
      receipt: receiptId || 'UNKNOWN',
      identityRiskLanguage: understanding.identityRiskLanguage
    }, receiptId ? [receiptId] : [], [], [`/api/creator/${address.toLowerCase()}`]);
  } catch {
    return makeRatAnswerPlan(
      'CREATOR_HISTORY',
      'STUCK_IN_A_PIPE',
      { notFound: true },
      [],
      ['Creator File lookup failed or violated the public API contract. no invented scraps.']
    );
  }
}

async function bagPlan(
  id: string,
  receiptOnly: boolean,
  config: RatConfig,
  fetchImpl: FetchLike
): Promise<RatAnswerPlan> {
  if (!BAG_ID_RE.test(id)) {
    return receiptOnly
      ? makeRatAnswerPlan('RECEIPT', 'EMPTY_PAWS', { invalidInput: true })
      : makeRatAnswerPlan('BAG', 'EMPTY_PAWS', { invalidInput: true });
  }
  try {
    const result = await getJson(`/api/bag/${encodeURIComponent(id)}`, config, fetchImpl);
    if (result.status === 404) {
      return receiptOnly
        ? makeRatAnswerPlan('RECEIPT', 'EMPTY_PAWS', { notFound: true })
        : makeRatAnswerPlan('BAG', 'EMPTY_PAWS', { notFound: true });
    }
    if (!result.ok) throw new Error('PUBLIC_API_UNAVAILABLE');
    expectSchema(result.value, 'binrat.public-feed/0.1');

    const bag = record(result.value.bag);
    const receipt = record(result.value.receipt);
    const receiptId = stringValue(receipt.receiptId, '');
    if (!BAG_ID_RE.test(stringValue(bag.id, ''))) throw new Error('PUBLIC_API_CONTRACT_MISMATCH');

    if (receiptOnly) {
      return makeRatAnswerPlan('RECEIPT', 'RUMMAGING', {
        launchId: stringValue(bag.id, id),
        receipt: receiptId || 'UNKNOWN',
        asOfBlock: stringValue(result.value.asOfBlock),
        historyCoverage: stringValue(result.value.historyCoverage)
      }, receiptId ? [receiptId] : [], [], [`/api/bag/${id}`]);
    }

    const trail = record(bag.trashTrail);
    return makeRatAnswerPlan('BAG', 'RUMMAGING', {
      symbol: stringValue(bag.symbol, '?'),
      name: stringValue(bag.name, 'unnamed'),
      launchId: stringValue(bag.id, id),
      creator: stringValue(bag.reportedCreatorAddress),
      priorLaunchCount: numberValue(trail.priorLaunchCount),
      historyCoverage: stringValue(trail.coverage),
      receipt: receiptId || 'UNKNOWN'
    }, receiptId ? [receiptId] : [], [], [`/api/bag/${id}`]);
  } catch {
    return receiptOnly
      ? makeRatAnswerPlan('RECEIPT', 'STUCK_IN_A_PIPE', { notFound: true }, [], ['receipt lookup failed or violated the public API contract.'])
      : makeRatAnswerPlan('BAG', 'STUCK_IN_A_PIPE', { notFound: true }, [], ['launch lookup failed or violated the public API contract. no invented scraps.']);
  }
}

async function replayPlan(id: string, config: RatConfig, fetchImpl: FetchLike): Promise<RatAnswerPlan> {
  if (!BAG_ID_RE.test(id)) return makeRatAnswerPlan('REPLAY', 'EMPTY_PAWS', { invalidInput: true });
  try {
    const result = await getJson(`/api/bag/${encodeURIComponent(id)}/replay`, config, fetchImpl);
    if (result.status === 404) return makeRatAnswerPlan('REPLAY', 'EMPTY_PAWS', { notFound: true });
    if (!result.ok) throw new Error('PUBLIC_API_UNAVAILABLE');
    expectSchema(result.value, 'binrat.replay-bundle/0.1');

    const launch = record(result.value.launch);
    const intelligence = record(result.value.intelligence);
    const receipt = record(result.value.receipt);
    const receiptId = stringValue(receipt.receiptId, '');
    const stagesRaw = Array.isArray(result.value.stages) ? result.value.stages : null;
    if (
      !stagesRaw ||
      typeof intelligence.observationCoverage !== 'string' ||
      !receiptId.startsWith('binrat-replay:')
    ) throw new Error('PUBLIC_API_CONTRACT_MISMATCH');

    const stages = stagesRaw
      .map((value) => record(value))
      .map((stage) => `${stringValue(stage.label)} ${stringValue(stage.status)}`)
      .join(' → ');

    return makeRatAnswerPlan('REPLAY', 'RUMMAGING', {
      symbol: stringValue(launch.symbol, '?'),
      name: stringValue(launch.name, 'unnamed'),
      stages: stages || 'UNKNOWN',
      observationCoverage: stringValue(intelligence.observationCoverage),
      historyCoverage: stringValue(result.value.historyCoverage),
      receipt: receiptId
    }, [receiptId], [], [`/api/bag/${id}/replay`]);
  } catch {
    return makeRatAnswerPlan(
      'REPLAY',
      'STUCK_IN_A_PIPE',
      { notFound: true },
      [],
      ['replay lookup failed or violated the public API contract. no invented timeline.']
    );
  }
}

async function addressLookupPlan(
  understanding: RatUnderstanding,
  config: RatConfig,
  fetchImpl: FetchLike
): Promise<RatAnswerPlan> {
  const address = understanding.argument.toLowerCase();
  if (!ADDRESS_RE.test(address)) {
    return makeRatAnswerPlan('ADDRESS_LOOKUP', 'EMPTY_PAWS', {
      address: understanding.argument || 'UNKNOWN',
      role: 'UNKNOWN',
      roles: 'NONE'
    });
  }

  try {
    const result = await getJson('/api/feed', config, fetchImpl);
    if (!result.ok) throw new Error('PUBLIC_API_UNAVAILABLE');
    expectSchema(result.value, 'binrat.public-feed/0.1');
    if (!Array.isArray(result.value.bags)) throw new Error('PUBLIC_API_CONTRACT_MISMATCH');

    const roles = new Set<'TOKEN' | 'POOL' | 'REPORTED_CREATOR'>();
    const bagIds = new Set<string>();

    for (const value of result.value.bags) {
      const bag = record(value);
      const bagId = stringValue(bag.id, '');
      if (stringValue(bag.token, '').toLowerCase() === address) {
        roles.add('TOKEN');
        if (BAG_ID_RE.test(bagId)) bagIds.add(bagId);
      }
      if (stringValue(bag.pool, '').toLowerCase() === address) {
        roles.add('POOL');
        if (BAG_ID_RE.test(bagId)) bagIds.add(bagId);
      }
      if (stringValue(bag.reportedCreatorAddress, '').toLowerCase() === address) {
        roles.add('REPORTED_CREATOR');
      }
    }

    if (roles.size === 0) {
      return makeRatAnswerPlan('ADDRESS_LOOKUP', 'EMPTY_PAWS', {
        address,
        role: 'UNKNOWN',
        roles: 'NONE'
      }, [], [], ['/api/feed']);
    }

    if (roles.size === 1 && roles.has('REPORTED_CREATOR')) {
      return creatorPlan(
        { ...understanding, intent: 'CREATOR_HISTORY', argument: address },
        config,
        fetchImpl
      );
    }

    if (roles.size === 1 && bagIds.size === 1 && (roles.has('TOKEN') || roles.has('POOL'))) {
      return bagPlan([...bagIds][0]!, false, config, fetchImpl);
    }

    return makeRatAnswerPlan('ADDRESS_LOOKUP', 'NEUTRAL', {
      address,
      role: 'AMBIGUOUS',
      roles: [...roles].sort().join(', ')
    }, [], [], ['/api/feed']);
  } catch {
    return makeRatAnswerPlan('ADDRESS_LOOKUP', 'STUCK_IN_A_PIPE', {
      address,
      role: 'UNKNOWN',
      roles: 'UNAVAILABLE'
    }, [], ['address-role lookup failed or violated the public API contract.'], ['/api/feed']);
  }
}

async function resolvePlan(
  understanding: RatUnderstanding,
  config: RatConfig,
  fetchImpl: FetchLike
): Promise<RatAnswerPlan> {
  const manifest = await currentManifest(config, fetchImpl);
  const fixed = staticPlan(understanding, config, manifest);
  if (fixed) return fixed;
  if (understanding.intent === 'STATUS') return statusPlan(config, fetchImpl, manifest);
  if (understanding.intent === 'CREATOR_HISTORY') return creatorPlan(understanding, config, fetchImpl);
  if (understanding.intent === 'ADDRESS_LOOKUP') return addressLookupPlan(understanding, config, fetchImpl);
  if (understanding.intent === 'BAG') return bagPlan(understanding.argument, false, config, fetchImpl);
  if (understanding.intent === 'RECEIPT') return bagPlan(understanding.argument, true, config, fetchImpl);
  if (understanding.intent === 'REPLAY') return replayPlan(understanding.argument, config, fetchImpl);
  return makeRatAnswerPlan('CLARIFY', 'EMPTY_PAWS', {});
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
