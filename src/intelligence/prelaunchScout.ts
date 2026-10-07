export const PRELAUNCH_SCOUT_VERSION = 'BINRAT_PRELAUNCH_SCOUT_V0' as const;

export type PrelaunchSignalKind =
  | 'PUBLIC_CODE'
  | 'TESTNET_DEPLOYMENT'
  | 'CONTRACT_DEPLOYMENT'
  | 'AUDIT'
  | 'INSTITUTIONAL_RELATION'
  | 'PUBLIC_LAUNCH';

export type InstitutionalRelation =
  | 'LEAD_INVESTOR'
  | 'INVESTOR'
  | 'STRATEGIC_INVESTOR'
  | 'LIQUIDITY_PROVIDER'
  | 'MARKET_MAKER'
  | 'WALLET_ADJACENCY'
  | 'UNKNOWN';

export interface PrelaunchSignalReceipt {
  observedOn: string;
  kind: PrelaunchSignalKind;
  sourceRef: string;
  entity?: string;
  relation?: InstitutionalRelation;
}

export interface PrelaunchProjectFixture {
  projectId: string;
  receipts: readonly PrelaunchSignalReceipt[];
}

export type PrelaunchScoutStatus =
  | 'QUALIFIED_WATCH'
  | 'TECHNICAL_ONLY'
  | 'INSUFFICIENT_EVIDENCE'
  | 'ALREADY_LAUNCHED';

export interface PrelaunchScoutResult {
  version: typeof PRELAUNCH_SCOUT_VERSION;
  projectId: string;
  asOf: string;
  status: PrelaunchScoutStatus;
  technicalSignals: PrelaunchSignalKind[];
  backingEntities: string[];
  nonBackingRelations: Array<{ entity: string; relation: InstitutionalRelation }>;
  laterObservedLaunchInFixture: boolean;
  leadDaysToObservedLaunch: number | null;
}

const BACKING_RELATIONS = new Set<InstitutionalRelation>([
  'LEAD_INVESTOR',
  'INVESTOR',
  'STRATEGIC_INVESTOR'
]);

const TECHNICAL_EXECUTION_SIGNALS = new Set<PrelaunchSignalKind>([
  'TESTNET_DEPLOYMENT',
  'CONTRACT_DEPLOYMENT',
  'AUDIT'
]);

export function evaluatePrelaunchProject(
  fixture: PrelaunchProjectFixture,
  asOf: string
): PrelaunchScoutResult {
  assertProjectId(fixture.projectId);
  const asOfMs = parseIsoDay(asOf, 'PRELAUNCH_SCOUT_AS_OF_INVALID');
  const receipts = fixture.receipts.map(validateReceipt).sort(compareReceipts);
  const observed = receipts.filter(
    (receipt) => parseIsoDay(receipt.observedOn, 'PRELAUNCH_SCOUT_RECEIPT_DATE_INVALID') <= asOfMs
  );

  const technicalSet = new Set<PrelaunchSignalKind>();
  const backingEntities = new Set<string>();
  const nonBackingRelations = new Map<string, { entity: string; relation: InstitutionalRelation }>();

  for (const receipt of observed) {
    if (receipt.kind === 'PUBLIC_CODE' || TECHNICAL_EXECUTION_SIGNALS.has(receipt.kind)) {
      technicalSet.add(receipt.kind);
    }
    if (receipt.kind !== 'INSTITUTIONAL_RELATION') continue;

    const entity = receipt.entity!;
    const relation = receipt.relation!;
    if (BACKING_RELATIONS.has(relation)) {
      backingEntities.add(entity);
    } else {
      nonBackingRelations.set(`${entity}\u0000${relation}`, { entity, relation });
    }
  }

  const hasPublicCode = technicalSet.has('PUBLIC_CODE');
  const hasExecutionEvidence = [...TECHNICAL_EXECUTION_SIGNALS].some((kind) => technicalSet.has(kind));
  const alreadyLaunched = observed.some((receipt) => receipt.kind === 'PUBLIC_LAUNCH');

  let status: PrelaunchScoutStatus;
  if (alreadyLaunched) {
    status = 'ALREADY_LAUNCHED';
  } else if (hasPublicCode && hasExecutionEvidence && backingEntities.size > 0) {
    status = 'QUALIFIED_WATCH';
  } else if (hasPublicCode && hasExecutionEvidence) {
    status = 'TECHNICAL_ONLY';
  } else {
    status = 'INSUFFICIENT_EVIDENCE';
  }

  const nextLaunch = nextFutureLaunch(receipts, asOfMs);

  return {
    version: PRELAUNCH_SCOUT_VERSION,
    projectId: fixture.projectId,
    asOf,
    status,
    technicalSignals: [...technicalSet].sort(),
    backingEntities: [...backingEntities].sort(),
    nonBackingRelations: [...nonBackingRelations.values()]
      .sort((a, b) => a.entity.localeCompare(b.entity) || a.relation.localeCompare(b.relation)),
    laterObservedLaunchInFixture: nextLaunch !== null,
    leadDaysToObservedLaunch: status === 'QUALIFIED_WATCH' && nextLaunch !== null
      ? Math.floor((nextLaunch - asOfMs) / 86_400_000)
      : null
  };
}

function nextFutureLaunch(receipts: readonly PrelaunchSignalReceipt[], asOfMs: number): number | null {
  return receipts
    .filter((receipt) => receipt.kind === 'PUBLIC_LAUNCH')
    .map((receipt) => parseIsoDay(receipt.observedOn, 'PRELAUNCH_SCOUT_RECEIPT_DATE_INVALID'))
    .filter((launchMs) => launchMs > asOfMs)
    .sort((a, b) => a - b)[0] ?? null;
}

function validateReceipt(receipt: PrelaunchSignalReceipt): PrelaunchSignalReceipt {
  parseIsoDay(receipt.observedOn, 'PRELAUNCH_SCOUT_RECEIPT_DATE_INVALID');
  if (!receipt.sourceRef.trim()) throw new Error('PRELAUNCH_SCOUT_SOURCE_REQUIRED');

  if (receipt.kind === 'INSTITUTIONAL_RELATION') {
    if (!receipt.entity?.trim()) throw new Error('PRELAUNCH_SCOUT_ENTITY_REQUIRED');
    if (!receipt.relation) throw new Error('PRELAUNCH_SCOUT_RELATION_REQUIRED');
  } else if (receipt.entity !== undefined || receipt.relation !== undefined) {
    throw new Error('PRELAUNCH_SCOUT_RELATION_FIELDS_INVALID');
  }
  return receipt;
}

function compareReceipts(a: PrelaunchSignalReceipt, b: PrelaunchSignalReceipt): number {
  return a.observedOn.localeCompare(b.observedOn)
    || a.kind.localeCompare(b.kind)
    || a.sourceRef.localeCompare(b.sourceRef);
}

function assertProjectId(projectId: string): void {
  if (!/^[a-z0-9][a-z0-9._-]{1,79}$/.test(projectId)) {
    throw new Error('PRELAUNCH_SCOUT_PROJECT_ID_INVALID');
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
