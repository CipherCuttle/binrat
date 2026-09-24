import { sha256Hex } from '../evidence/canonical.js';
import { validatePonsSuccessorCandidate } from '../launchConfig/ponsCutover.js';
import {
  CONFIGURED_PRODUCTION_AUTHORITIES,
  LAUNCH_MECHANICS_RECEIPT_DIGEST
} from '../launchConfig/config.js';
import type { CapabilityManifest, CapabilityState } from '../telegram/rat.js';
import type { FundingConfigResolution } from './config.js';
import {
  normalizeDumpsterLedgerEntries,
  type DumpsterLedgerEntry,
  type LedgerAssetType
} from './entries.js';

export const DUMPSTER_LEDGER_SCHEMA_VERSION = 'binrat.dumpster-ledger/0.1' as const;
export const DUMPSTER_LEDGER_PROJECTION_VERSION = 'BINRAT_DUMPSTER_LEDGER_V0' as const;

export interface PublicDumpsterLedger {
  schemaVersion: typeof DUMPSTER_LEDGER_SCHEMA_VERSION;
  projectionVersion: typeof DUMPSTER_LEDGER_PROJECTION_VERSION;
  accountingState: 'PRE_LAUNCH_AUTHORITIES_CONFIGURED' | 'FAIL_CLOSED' | 'TEST_FIXTURE';
  chainId: number;
  tokenState: string;
  launchAuthorization: string;
  marketingAuthorized: boolean;
  /** The old address declarations belong to ArcPad V0, never Pons custody proof. */
  historicalRoleScope?: 'ARCPAD_V0_HISTORICAL_ONLY_NOT_PONS';
  successorToken?: {
    status: 'SELECTED_CANDIDATE_BLOCKED';
    tokenChainId: 4663;
    researchChainId: 5042;
    tokenAddress: null;
    treasury: null;
    creatorFeeRecipient: null;
    holderAccessActive: false;
    accountingActive: false;
  };
  configuredAuthorities: typeof CONFIGURED_PRODUCTION_AUTHORITIES & {
    launchMechanicsReceiptDigest: typeof LAUNCH_MECHANICS_RECEIPT_DIGEST;
  };
  fundingAuthority: {
    status: FundingConfigResolution['status'];
    accountingEnabled: false;
    tokenAddress: string | null;
    creatorFeeRecipients: readonly string[];
    treasuryAddresses: readonly string[];
    effectiveFromBlock: string | null;
    configVersion: string | null;
    categoryPolicyVersion: string | null;
  };
  totals: {
    entryCount: number;
    inflowEntryCount: number;
    outflowEntryCount: number;
    tokenInflowsRaw: string;
    tokenOutflowsRaw: string;
    byAsset: Array<{
      assetType: LedgerAssetType;
      tokenAddress: string | null;
      entryCount: number;
      inflowRaw: string;
      outflowRaw: string;
    }>;
  };
  entries: Array<DumpsterLedgerEntry & {
    links: { transaction: null; from: null; to: null };
  }>;
  coverage: {
    status: 'NO_TOKEN_OBSERVATIONS_AVAILABLE' | 'FAIL_CLOSED' | 'TEST_FIXTURE_ONLY';
    fromBlock: string | null;
    throughBlock: string | null;
  };
  observedDataAvailability: {
    tokenAddress: 'NOT_YET_AVAILABLE';
    launchBlock: 'NOT_YET_AVAILABLE';
    launchTransaction: 'NOT_YET_AVAILABLE';
    tokenRelatedInflows: 'NOT_YET_AVAILABLE';
    tokenRelatedOutflows: 'NOT_YET_AVAILABLE';
  };
  utilityStatus: {
    source: 'CAPABILITY_MANIFEST';
    manifestSchemaVersion: string;
    shipped: UtilityStatus[];
    building: UtilityStatus[];
    planned: UtilityStatus[];
  };
  awaitingCanonicalAuthority: string[];
  explanation: string;
  evidenceBoundary: string;
  receipt: {
    manifestDigest: string;
    entryEvidenceDigests: string[];
    outputDigest: string;
    receiptId: string;
  };
}

interface UtilityStatus {
  capability: string;
  engineeringStatus: string;
  deploymentStatus: string;
  publicStatus: string;
}

export async function projectDumpsterLedger(
  manifest: CapabilityManifest,
  funding: FundingConfigResolution,
  values: readonly DumpsterLedgerEntry[],
  source: 'PRODUCTION' | 'TEST_FIXTURE' = 'PRODUCTION'
): Promise<PublicDumpsterLedger> {
  const config = funding.config;
  const successor = manifest.tokenLaunchSuccessor === undefined
    ? null : validatePonsSuccessorCandidate(manifest.tokenLaunchSuccessor);
  // An Arc V0 funding configuration must never masquerade as a Pons ledger.
  if (successor && source === 'PRODUCTION' && config) {
    throw new Error('DUMPSTER_LEDGER_PONS_FUNDING_CROSS_CHAIN_BLOCKED');
  }
  if (
    manifest.launchAuthorization.status !== 'BLOCKED' ||
    manifest.launchAuthorization.marketingAuthorized !== false ||
    manifest.launchAuthorization.launchAuthorized !== false ||
    manifest.launchAuthorization.tokenState !== 'NOT_LAUNCHED'
  ) throw new Error('DUMPSTER_LEDGER_STATUS_CONTRADICTION');
  if (source === 'PRODUCTION' && values.length > 0) {
    throw new Error('DUMPSTER_LEDGER_FIXTURE_LEAK_BLOCKED');
  }
  if (source === 'TEST_FIXTURE' && (!config || !config.configVersion.startsWith('TEST_'))) {
    throw new Error('DUMPSTER_LEDGER_TEST_AUTHORITY_REQUIRED');
  }
  const entries = config ? await normalizeDumpsterLedgerEntries(config, values) : [];
  if (!config && values.length > 0) throw new Error('DUMPSTER_LEDGER_ENTRIES_WITHOUT_AUTHORITY');

  const utility = utilityStatuses(manifest.capabilities);
  const byAsset = aggregateByAsset(entries);
  const tokenKey = config ? `ERC20:${config.tokenAddress}` : null;
  const tokenTotals = tokenKey ? byAsset.find((item) => assetKey(item) === tokenKey) : undefined;
  const accountingState = source === 'TEST_FIXTURE'
    ? 'TEST_FIXTURE' as const
    : funding.status === 'PRELAUNCH_AUTHORITIES_CONFIGURED'
      ? 'PRE_LAUNCH_AUTHORITIES_CONFIGURED' as const
      : 'FAIL_CLOSED' as const;
  const coverageStatus = source === 'TEST_FIXTURE'
    ? 'TEST_FIXTURE_ONLY' as const
    : funding.status === 'PRELAUNCH_AUTHORITIES_CONFIGURED'
      ? 'NO_TOKEN_OBSERVATIONS_AVAILABLE' as const
      : 'FAIL_CLOSED' as const;
  const manifestDigest = await sha256Hex(manifest);
  const output = {
    schemaVersion: DUMPSTER_LEDGER_SCHEMA_VERSION,
    projectionVersion: DUMPSTER_LEDGER_PROJECTION_VERSION,
    accountingState,
    chainId: config?.chainId ?? 5042,
    tokenState: manifest.launchAuthorization.tokenState ?? 'UNVERIFIED',
    launchAuthorization: manifest.launchAuthorization.status,
    marketingAuthorized: manifest.launchAuthorization.marketingAuthorized,
    ...(successor ? {
      historicalRoleScope: 'ARCPAD_V0_HISTORICAL_ONLY_NOT_PONS' as const,
      successorToken: {
        status: successor.status,
        tokenChainId: successor.tokenChainId,
        researchChainId: successor.researchChainId,
        tokenAddress: null as null,
        treasury: null as null,
        creatorFeeRecipient: null as null,
        holderAccessActive: false as const,
        accountingActive: false as const
      }
    } : {}),
    configuredAuthorities: {
      ...CONFIGURED_PRODUCTION_AUTHORITIES,
      launchMechanicsReceiptDigest: LAUNCH_MECHANICS_RECEIPT_DIGEST
    },
    fundingAuthority: {
      status: funding.status,
      accountingEnabled: false as const,
      tokenAddress: config?.tokenAddress ?? null,
      creatorFeeRecipients: config?.creatorFeeRecipients ?? [],
      treasuryAddresses: config?.treasuryAddresses ?? [],
      effectiveFromBlock: config?.effectiveFromBlock ?? null,
      configVersion: config?.configVersion ?? null,
      categoryPolicyVersion: config?.categoryPolicyVersion ?? null
    },
    totals: {
      entryCount: entries.length,
      inflowEntryCount: entries.filter((entry) => entry.direction === 'INFLOW').length,
      outflowEntryCount: entries.filter((entry) => entry.direction === 'OUTFLOW').length,
      tokenInflowsRaw: tokenTotals?.inflowRaw ?? '0',
      tokenOutflowsRaw: tokenTotals?.outflowRaw ?? '0',
      byAsset
    },
    entries: entries.map((entry) => ({
      ...entry,
      // No Arc explorer convention is frozen in this repository. Null is safer than
      // manufacturing a link contract; entry hashes and addresses remain copyable.
      links: { transaction: null, from: null, to: null }
    })),
    coverage: {
      status: coverageStatus,
      fromBlock: entries[0]?.blockNumber ?? null,
      throughBlock: entries.at(-1)?.blockNumber ?? null
    },
    observedDataAvailability: {
      tokenAddress: 'NOT_YET_AVAILABLE' as const,
      launchBlock: 'NOT_YET_AVAILABLE' as const,
      launchTransaction: 'NOT_YET_AVAILABLE' as const,
      tokenRelatedInflows: 'NOT_YET_AVAILABLE' as const,
      tokenRelatedOutflows: 'NOT_YET_AVAILABLE' as const
    },
    utilityStatus: {
      source: 'CAPABILITY_MANIFEST' as const,
      manifestSchemaVersion: manifest.schemaVersion,
      ...utility
    },
    awaitingCanonicalAuthority: config ? [
      'REVIEWED_ON_CHAIN_FUNDING_OBSERVATION_SOURCE'
    ] : [
      'TOKEN_CONTRACT_ADDRESS',
      'EFFECTIVE_FROM_BLOCK',
      'CATEGORY_POLICY_VERSION',
      'EXPLICIT_ACCOUNTING_OBSERVER_ACTIVATION',
      'REVIEWED_ON_CHAIN_FUNDING_OBSERVATION_SOURCE'
    ],
    explanation: source === 'TEST_FIXTURE'
      ? 'TEST fixture projection only. It is not production funding evidence.'
      : config
        ? 'BINRAT is not launched. Canonical funding configuration is present, but production accounting remains disabled until a reviewed on-chain observation source is implemented; totals remain zero.'
        : funding.status === 'TREASURY_AUTHORITY_INVALID'
          ? 'BINRAT is not launched. The supplied funding authority is invalid, so production accounting fails closed and no wallet or balance is presented as truth.'
          : successor
            ? 'BINRAT token launch candidate: Pons on Robinhood 4663. Existing displayed wallet declarations refer to historical ArcPad V0 only. Pons treasury and fee recipient are NOT_VERIFIED; no token, launch receipt, or live accounting exists.'
            : 'BINRAT is not launched. Owner-selected future treasury and project-fee authorities are configured, but no token, launch block, launch transaction, or token-flow observations exist. Production accounting remains disabled.',
    evidenceBoundary: (successor
      ? 'Historical ArcPad wallet roles are NOT Pons owner/fee custody evidence. No Pons accounting or holder access is active. '
      : '') + 'Configured authority is an owner policy declaration, not proof of custody or an observed token role. Zero pre-launch entries mean token observations are not yet available; they do not predict or preclude future flows. Ledger entries must be immutable on-chain facts bound to activated canonical funding authority.'
  };
  const outputDigest = await sha256Hex(output);
  const receiptMaterial = {
    projectionVersion: DUMPSTER_LEDGER_PROJECTION_VERSION,
    manifestDigest,
    entryEvidenceDigests: entries.map((entry) => entry.evidenceDigest),
    outputDigest
  };
  return {
    ...output,
    receipt: {
      ...receiptMaterial,
      receiptId: `binrat-dumpster-ledger:${await sha256Hex(receiptMaterial)}`
    }
  };
}

function aggregateByAsset(entries: readonly DumpsterLedgerEntry[]) {
  const values = new Map<string, {
    assetType: LedgerAssetType;
    tokenAddress: string | null;
    entryCount: number;
    inflowRaw: bigint;
    outflowRaw: bigint;
  }>();
  for (const entry of entries) {
    const key = `${entry.assetType}:${entry.tokenAddress ?? 'NATIVE'}`;
    const total = values.get(key) ?? {
      assetType: entry.assetType,
      tokenAddress: entry.tokenAddress,
      entryCount: 0,
      inflowRaw: 0n,
      outflowRaw: 0n
    };
    total.entryCount += 1;
    if (entry.direction === 'INFLOW') total.inflowRaw += BigInt(entry.amountRaw);
    else total.outflowRaw += BigInt(entry.amountRaw);
    values.set(key, total);
  }
  return [...values.values()]
    .sort((a, b) => assetKey(a).localeCompare(assetKey(b)))
    .map((value) => ({
      assetType: value.assetType,
      tokenAddress: value.tokenAddress,
      entryCount: value.entryCount,
      inflowRaw: value.inflowRaw.toString(),
      outflowRaw: value.outflowRaw.toString()
    }));
}

function assetKey(value: { assetType: LedgerAssetType; tokenAddress: string | null }): string {
  return `${value.assetType}:${value.tokenAddress ?? 'NATIVE'}`;
}

function utilityStatuses(capabilities: Record<string, CapabilityState>) {
  const result = { shipped: [] as UtilityStatus[], building: [] as UtilityStatus[], planned: [] as UtilityStatus[] };
  for (const [capability, state] of Object.entries(capabilities).sort(([a], [b]) => a.localeCompare(b))) {
    const value = {
      capability,
      engineeringStatus: state.engineeringStatus ?? 'UNKNOWN',
      deploymentStatus: state.deploymentStatus ?? 'NOT_DEPLOYED',
      publicStatus: state.publicStatus ?? 'NOT_PUBLIC_LIVE_AUTHORIZED'
    };
    if (state.engineeringStatus === 'PLANNED' || state.engineeringStatus === 'EXPERIMENTAL') {
      result.planned.push(value);
    } else if (
      state.engineeringStatus === 'ENGINEERING_PASS' &&
      (state.publicStatus === 'PUBLIC_LIVE_BETA' ||
        state.publicStatus === 'PRE_LAUNCH_TRANSPARENCY_LIVE' ||
        state.deploymentStatus?.includes('LIVE_VERIFIED'))
    ) {
      result.shipped.push(value);
    } else {
      result.building.push(value);
    }
  }
  return result;
}
