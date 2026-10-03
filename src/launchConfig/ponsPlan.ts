import { getAddress, isAddress } from 'viem';
import { sha256Hex } from '../evidence/canonical.js';

export const PONS_LAUNCH_PLAN_SCHEMA_VERSION = 'binrat.pons-launch-plan/0.1' as const;
export const PONS_LAUNCH_PLAN_VERSION = 'BINRAT_PONS_LAUNCH_PLAN_V1' as const;
export const PONS_LAUNCH_PLAN_DIGEST = '55dcacc142d252bab1410ce8166521cf9a4fe1dd43a8af941eb3220257104c11' as const;
export const PONS_LAUNCH_CHAIN_ID = 4663 as const;
export const PONS_V2_FACTORY_V1 = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e' as const;
export const PONS_V2_FACTORY_CODE_HASH_V1 =
  '0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84' as const;
export const PONS_VAULT_LAUNCHER_V1 = '0x1770c356eB9312079b9A00e26a8CF4b0a1473dBA' as const;
export const PONS_VAULT_REGISTRY_V1 = '0xaA9C86049A258D4A076d3eF367F69C231C9746D5' as const;
export const PONS_STAKE_BURN_FACTORY_V1 = '0x537483c5B33e2192CfB202d7C50d58975524B047' as const;

export interface PonsLaunchPlanV1 {
  schemaVersion: typeof PONS_LAUNCH_PLAN_SCHEMA_VERSION;
  planVersion: typeof PONS_LAUNCH_PLAN_VERSION;
  frozenOn: '2026-10-03';
  status: 'PLANNING_ONLY';
  chainId: typeof PONS_LAUNCH_CHAIN_ID;
  planDigest: string;
  [key: string]: unknown;
}

export async function derivePonsLaunchPlanDigest(value: unknown): Promise<string> {
  const input = record(value);
  const { planDigest: _planDigest, ...material } = input;
  return sha256Hex(material);
}

export async function validatePonsLaunchPlan(value: unknown): Promise<PonsLaunchPlanV1> {
  const input = record(value);
  if (
    input.schemaVersion !== PONS_LAUNCH_PLAN_SCHEMA_VERSION ||
    input.planVersion !== PONS_LAUNCH_PLAN_VERSION ||
    input.frozenOn !== '2026-10-03' ||
    input.status !== 'PLANNING_ONLY' ||
    input.chainId !== PONS_LAUNCH_CHAIN_ID
  ) throw new Error('PONS_LAUNCH_PLAN_HEADER_INVALID');

  const rail = record(input.launchRail);
  const pons = record(rail.ponsFactory);
  const launcher = record(rail.ponsVaultLauncher);
  const registry = record(rail.ponsVaultRegistry);
  const stakeBurn = record(rail.stakeBurnFactory);

  if (
    rail.railId !== 'pons-v2-vault-stake-burn-candidate-v1' ||
    rail.pairAsset !== 'NATIVE_ETH_CANDIDATE' ||
    checksum(pons.address) !== PONS_V2_FACTORY_V1 ||
    pons.runtimeCodeHash !== PONS_V2_FACTORY_CODE_HASH_V1 ||
    checksum(launcher.address) !== PONS_VAULT_LAUNCHER_V1 ||
    checksum(registry.address) !== PONS_VAULT_REGISTRY_V1 ||
    checksum(stakeBurn.address) !== PONS_STAKE_BURN_FACTORY_V1 ||
    rail.ponsNativeBuybackEnabled !== 'CANDIDATE_FALSE_NOT_FROZEN'
  ) throw new Error('PONS_LAUNCH_PLAN_RAIL_INVALID');

  const unresolved = record(input.unresolvedImmutableInputs);
  for (const key of [
    'launchConfigId','expectedEconomics','creatorTaxBps','openingBuyWei',
    'stakeLockPeriodSeconds','minimumFeesBeforeRun','workingRatMinStakeRaw'
  ]) if (unresolved[key] !== null) throw new Error('PONS_LAUNCH_PLAN_IMMUTABLES_PREMATURELY_FROZEN');

  const risk = record(input.upstreamRisk);
  if (
    risk.ponsVaultPublicSourceStatus !== 'UNRESOLVED' ||
    risk.ponsVaultThirdPartyAuditStatus !== 'NOT_COMPLETED_PER_PUBLIC_DOCS' ||
    risk.launchMechanicsGate !== 'BLOCKED_UPSTREAM_VERIFICATION'
  ) throw new Error('PONS_LAUNCH_PLAN_UPSTREAM_RISK_INVALID');

  const historical = record(input.historicalPredecessor);
  if (
    historical.chainId !== 5042 ||
    historical.launchConfig !== 'docs/BINRAT_LAUNCH_CONFIG_V0.json' ||
    historical.launchGateMatrix !== 'docs/LAUNCH_GATE_MATRIX_V0.json' ||
    historical.authority !== 'HISTORICAL_ONLY_NOT_PONS_AUTHORITY'
  ) throw new Error('PONS_LAUNCH_PLAN_HISTORY_INVALID');

  const authorization = record(input.authorization);
  if (
    authorization.marketingAuthorized !== false ||
    authorization.launchAuthorized !== false ||
    authorization.explicitOwnerLaunchAuthorityState !== 'NOT_GRANTED'
  ) throw new Error('PONS_LAUNCH_PLAN_AUTHORIZATION_ESCALATION');

  if (input.planDigest !== PONS_LAUNCH_PLAN_DIGEST) throw new Error('PONS_LAUNCH_PLAN_DIGEST_INVALID');
  if (await derivePonsLaunchPlanDigest(input) !== PONS_LAUNCH_PLAN_DIGEST) {
    throw new Error('PONS_LAUNCH_PLAN_DIGEST_MISMATCH');
  }
  return input as unknown as PonsLaunchPlanV1;
}

function record(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PONS_LAUNCH_PLAN_INVALID');
  return value as Record<string, any>;
}
function checksum(value: unknown): string {
  if (typeof value !== 'string' || !isAddress(value, { strict: false })) throw new Error('PONS_LAUNCH_PLAN_ADDRESS_INVALID');
  return getAddress(value);
}
