export const LAUNCH_PRESSURE_VERSION = 'BINRAT_LAUNCH_PRESSURE_V0' as const;

export type LaunchPressureSignalKind =
  | 'PRODUCTION_CHAIN_CONFIG'
  | 'PRODUCTION_DEPLOYMENT'
  | 'PRODUCTION_INFRA'
  | 'AUDIT_REMEDIATION'
  | 'RELEASE_CANDIDATE'
  | 'TOKEN_DISTRIBUTION';

export type LaunchPressureState =
  | 'BUILDING'
  | 'HARDENING'
  | 'PRODUCTION_PREP'
  | 'ARMED';

export interface LaunchPressureReceipt {
  observedOn: string;
  kind: LaunchPressureSignalKind;
  sourceRef: string;
}

export interface LaunchPressureInput {
  projectId: string;
  receipts: readonly LaunchPressureReceipt[];
}

export interface LaunchPressureActiveSignal {
  kind: LaunchPressureSignalKind;
  observedOn: string;
  ageDays: number;
  sourceRef: string;
}

export interface LaunchPressureResult {
  version: typeof LAUNCH_PRESSURE_VERSION;
  projectId: string;
  asOf: string;
  state: LaunchPressureState;
  active90d: LaunchPressureActiveSignal[];
  active60d: LaunchPressureActiveSignal[];
  active30d: LaunchPressureActiveSignal[];
  hardSignalKinds30d: LaunchPressureSignalKind[];
  ignoredFutureReceipts: number;
}

/**
 * Preregistered Launch Pressure V0 rule.
 *
 * P1 PRODUCTION_CHAIN_CONFIG  - production/mainnet chain or genesis configuration
 * P2 PRODUCTION_DEPLOYMENT    - production contracts or production deployer activity
 * P3 PRODUCTION_INFRA         - production RPC/explorer/bridge infrastructure
 * P4 AUDIT_REMEDIATION        - final audit remediation / fix-review closure
 * P5 RELEASE_CANDIDATE        - release candidate, code freeze, or mainnet release tag
 * P6 TOKEN_DISTRIBUTION       - token genesis/distribution/TGE infrastructure
 *
 * State transitions intentionally require multiple *distinct signal families*.
 * Repeated receipts from the same family never multiply evidence.
 */
export function evaluateLaunchPressure(
  input: LaunchPressureInput,
  asOf: string
): LaunchPressureResult {
  assertProjectId(input.projectId);
  const asOfMs = parseIsoDay(asOf, 'LAUNCH_PRESSURE_AS_OF_INVALID');

  const valid = input.receipts.map(validateReceipt);
  const observed = valid.filter((receipt) =>
    parseIsoDay(receipt.observedOn, 'LAUNCH_PRESSURE_RECEIPT_DATE_INVALID') <= asOfMs
  );
  const ignoredFutureReceipts = valid.length - observed.length;

  // Correlated receipts from the same family collapse to the freshest observation.
  const latestByKind = new Map<LaunchPressureSignalKind, LaunchPressureReceipt>();
  for (const receipt of observed) {
    const previous = latestByKind.get(receipt.kind);
    if (!previous || previous.observedOn < receipt.observedOn) {
      latestByKind.set(receipt.kind, receipt);
    }
  }

  const active = [...latestByKind.values()]
    .map((receipt): LaunchPressureActiveSignal => ({
      ...receipt,
      ageDays: Math.floor(
        (asOfMs - parseIsoDay(receipt.observedOn, 'LAUNCH_PRESSURE_RECEIPT_DATE_INVALID')) / 86_400_000
      )
    }))
    .sort((a, b) => a.ageDays - b.ageDays || a.kind.localeCompare(b.kind));

  const active90d = active.filter((signal) => signal.ageDays <= 90);
  const active60d = active.filter((signal) => signal.ageDays <= 60);
  const active30d = active.filter((signal) => signal.ageDays <= 30);

  const hardSignalKinds30d = active30d
    .filter((signal) => isHardSignal(signal.kind))
    .map((signal) => signal.kind)
    .sort();

  const hasIrreversible30d = active30d.some((signal) =>
    signal.kind === 'PRODUCTION_DEPLOYMENT' || signal.kind === 'TOKEN_DISTRIBUTION'
  );

  let state: LaunchPressureState = 'BUILDING';
  if (active90d.length >= 1) state = 'HARDENING';

  if (
    active60d.length >= 2
    && active60d.some((signal) => isHardSignal(signal.kind))
  ) {
    state = 'PRODUCTION_PREP';
  }

  if (
    active30d.length >= 3
    && hardSignalKinds30d.length >= 2
    && hasIrreversible30d
  ) {
    state = 'ARMED';
  }

  return {
    version: LAUNCH_PRESSURE_VERSION,
    projectId: input.projectId,
    asOf,
    state,
    active90d,
    active60d,
    active30d,
    hardSignalKinds30d,
    ignoredFutureReceipts
  };
}

function isHardSignal(kind: LaunchPressureSignalKind): boolean {
  return kind === 'PRODUCTION_DEPLOYMENT'
    || kind === 'PRODUCTION_INFRA'
    || kind === 'RELEASE_CANDIDATE'
    || kind === 'TOKEN_DISTRIBUTION';
}

function validateReceipt(receipt: LaunchPressureReceipt): LaunchPressureReceipt {
  parseIsoDay(receipt.observedOn, 'LAUNCH_PRESSURE_RECEIPT_DATE_INVALID');
  if (!receipt.sourceRef.trim()) throw new Error('LAUNCH_PRESSURE_SOURCE_REQUIRED');
  return receipt;
}

function assertProjectId(projectId: string): void {
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(projectId)) {
    throw new Error('LAUNCH_PRESSURE_PROJECT_ID_INVALID');
  }
}

function parseIsoDay(value: string, error: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(error);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    throw new Error(error);
  }
  return parsed;
}
