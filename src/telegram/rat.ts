const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

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

function commandFromText(text: string): { command: string; argument: string } | null {
  const normalized = text.trim();
  if (!normalized) return null;

  if (normalized.startsWith('/')) {
    const [rawCommand, ...rest] = normalized.split(/\s+/);
    const command = rawCommand!.slice(1).split('@')[0]!.toLowerCase();
    return { command, argument: rest.join(' ').trim() };
  }

  const lower = normalized.toLowerCase();
  if (!lower.includes('binrat') && !lower.includes('rat')) return null;
  if (lower.includes('roadmap') || lower.includes('next') || lower.includes('coming')) return { command: 'roadmap', argument: '' };
  if (lower.includes('token') || lower.includes('$binrat') || lower.includes('rat credit')) return { command: 'token', argument: '' };
  if (lower.includes('status') || lower.includes('shipped') || lower.includes('progress') || lower.includes('live')) return { command: 'status', argument: '' };
  if (lower.includes('why') || lower.includes('what is') || lower.includes('what does')) return { command: 'why', argument: '' };

  const address = normalized.match(/0x[0-9a-fA-F]{40}/)?.[0];
  if (address) return { command: 'creator', argument: address };
  return null;
}

function capabilityLine(label: string, key: string, config: RatConfig): string {
  const state = config.manifest.capabilities[key];
  if (!state) return `${label}: UNKNOWN`;
  const parts = [state.engineeringStatus, state.deploymentStatus, state.publicStatus].filter(Boolean);
  return `${label}: ${parts.join(' / ')}`;
}

function staticReply(command: string, config: RatConfig): string | null {
  const site = trimSlash(config.siteUrl);
  if (command === 'why') {
    return [
      '🐀 BINRAT remembers what launches try to forget.',
      '',
      'Creator history. Point-in-time observations. Trash Trails. Replayable receipts.',
      'No SAFE/RUG score. No BUY/SELL call. Evidence first.',
      '',
      `Dig through the bin: ${site}`
    ].join('\n');
  }
  if (command === 'roadmap') {
    return [
      '🐀 ROADMAP / CANONICAL STATUS',
      '',
      capabilityLine('Intelligence V1', 'intelligenceV1', config),
      capabilityLine('Replay Lab', 'replayLab', config),
      capabilityLine('Telegram Rat V0', 'telegramRatV0', config),
      capabilityLine('Dumpster Ledger', 'dumpsterLedger', config),
      capabilityLine('Rat Den V0', 'ratDenV0', config),
      capabilityLine('Rat Watch V0', 'ratWatchV0', config),
      capabilityLine('Dumpster Raids V0', 'dumpsterRaidsV0', config),
      '',
      'Sequence: Replay Lab → Telegram Rat → frozen launch mechanics → Dumpster Ledger → Rat Den → minimal Rat Watch → authorization gates.',
      `launch authorization: ${config.manifest.launchAuthorization.status}`
    ].join('\n');
  }
  if (command === 'token') {
    const launch = config.manifest.launchAuthorization;
    const tokenState = launch.tokenState ?? 'UNKNOWN';
    return [
      '🐀 TOKEN STATUS',
      '',
      `token state: ${tokenState}`,
      `launch authorization: ${launch.status}`,
      `marketing authorized: ${launch.marketingAuthorized ? 'YES' : 'NO'}`,
      `launch authorized: ${launch.launchAuthorized ? 'YES' : 'NO'}`,
      '',
      tokenState === 'NOT_LAUNCHED'
        ? 'No $BINRAT token is launched yet.'
        : 'The Rat only reports the canonical manifest state.',
      'Rat Credits are separate, off-chain, non-transferable contribution/coordination units; they are not equity, revenue share, or yield.',
      '',
      `Rule: ${config.manifest.invariant}`
    ].join('\n');
  }
  if (command === 'proof') {
    return [
      '🐀 THE RULES OF THE BIN',
      '',
      'Receipts > scores.',
      'Missing evidence != good evidence.',
      'Future data cannot leak into past views.',
      'Token ownership cannot buy factual authority.',
      'Core BINRAT evidence must stay truthful regardless of $BINRAT market price.',
      '',
      config.manifest.invariant
    ].join('\n');
  }
  if (command === 'faq' || command === 'help' || command === 'start') {
    return [
      '🐀 ask the rat:',
      '/status — live index state',
      '/roadmap — canonical capability state',
      '/why — what BINRAT is',
      '/token — token + launch-authorization state',
      '/creator 0x... — Creator File summary',
      '/bag <launch-id> — launch summary',
      '/receipt <launch-id> — public receipt id',
      '/proof — BINRAT evidence doctrine'
    ].join('\n');
  }
  return null;
}

async function statusReply(config: RatConfig, fetchImpl: FetchLike): Promise<string> {
  try {
    const result = await getJson('/api/health', config, fetchImpl);
    if (!result.ok) return `🐀 STATUS\n\nPublic read plane unavailable (HTTP ${result.status}). The rat will not invent a healthy status.`;
    const h = result.value;
    const ready = h.indexReady === true;
    const obs = h.observationReady === true;
    const history = h.historyBackfillComplete === true;
    return [
      '🐀 STATUS',
      '',
      `index: ${ready ? 'READY' : 'DEGRADED'}`,
      `launches indexed: ${numberValue(h.launchCount)}`,
      `checkpoint block: ${stringValue(h.checkpointBlock, 'NONE')}`,
      `historical backfill: ${history ? 'COMPLETE' : 'IN PROGRESS / UNVERIFIED'}`,
      `observations: ${obs ? 'READY' : 'PARTIAL / DEGRADED'}`,
      `Telegram Rat capability: ${stringValue(config.manifest.capabilities.telegramRatV0?.engineeringStatus)}`,
      h.lastSyncError ? `index error: ${stringValue(h.lastSyncError)}` : '',
      h.lastObservationError ? `observation error: ${stringValue(h.lastObservationError)}` : ''
    ].filter(Boolean).join('\n');
  } catch {
    return '🐀 STATUS\n\nPublic read plane unreachable. The rat will not guess.';
  }
}

async function creatorReply(address: string, config: RatConfig, fetchImpl: FetchLike): Promise<string> {
  if (!ADDRESS_RE.test(address)) return '🐀 invalid creator address. Expected 0x + 40 hex characters.';
  try {
    const result = await getJson(`/api/creator/${address.toLowerCase()}`, config, fetchImpl);
    if (result.status === 404) return '🐀 no indexed Creator File for that address.';
    if (!result.ok) return `🐀 Creator File unavailable (HTTP ${result.status}).`;
    const c = result.value;
    const receipt = record(c.receipt);
    return [
      '🐀 CREATOR FILE',
      '',
      `reported creator: ${stringValue(c.reportedCreatorAddress)}`,
      `indexed launches: ${numberValue(c.indexedLaunchCount)}`,
      `first indexed block: ${stringValue(c.firstIndexedBlock)}`,
      `last indexed block: ${stringValue(c.lastIndexedBlock)}`,
      `history coverage: ${stringValue(c.historyCoverage)}`,
      `receipt: ${stringValue(receipt.receiptId)}`,
      '',
      'Same source-reported address only. This is not proof of common human identity.'
    ].join('\n');
  } catch {
    return '🐀 Creator File lookup failed. The rat will not fill the gap with a guess.';
  }
}

async function bagReply(id: string, receiptOnly: boolean, config: RatConfig, fetchImpl: FetchLike): Promise<string> {
  if (!id || id.length > 256) return '🐀 give me a valid launch id.';
  try {
    const result = await getJson(`/api/bag/${encodeURIComponent(id)}`, config, fetchImpl);
    if (result.status === 404) return '🐀 no indexed launch with that id.';
    if (!result.ok) return `🐀 launch lookup unavailable (HTTP ${result.status}).`;
    const bag = record(result.value.bag);
    const receipt = record(result.value.receipt);
    if (receiptOnly) {
      return [
        '🐀 RECEIPT',
        `launch: ${stringValue(bag.id, id)}`,
        `receipt: ${stringValue(receipt.receiptId)}`,
        `as-of block: ${stringValue(result.value.asOfBlock)}`,
        `history coverage: ${stringValue(result.value.historyCoverage)}`
      ].join('\n');
    }
    const trail = record(bag.trashTrail);
    return [
      '🐀 HOT GARBAGE',
      '',
      `${stringValue(bag.symbol, '?')} — ${stringValue(bag.name, 'unnamed')}`,
      `launch: ${stringValue(bag.id, id)}`,
      `reported creator: ${stringValue(bag.reportedCreatorAddress)}`,
      `prior launches from same reported address: ${numberValue(trail.priorLaunchCount)}`,
      `history coverage: ${stringValue(trail.coverage)}`,
      `receipt: ${stringValue(receipt.receiptId)}`
    ].join('\n');
  } catch {
    return '🐀 launch lookup failed. No invented scraps.';
  }
}

export async function renderRatReply(text: string, config: RatConfig, fetchImpl: FetchLike = fetch): Promise<string | null> {
  const parsed = commandFromText(text);
  if (!parsed) return null;

  const staticText = staticReply(parsed.command, config);
  if (staticText) return staticText;

  if (parsed.command === 'status') return statusReply(config, fetchImpl);
  if (parsed.command === 'creator') return creatorReply(parsed.argument, config, fetchImpl);
  if (parsed.command === 'bag') return bagReply(parsed.argument, false, config, fetchImpl);
  if (parsed.command === 'receipt') return bagReply(parsed.argument, true, config, fetchImpl);

  return null;
}
