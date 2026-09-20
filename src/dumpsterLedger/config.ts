import { getAddress, isAddress, type Hex } from 'viem';

export const FUNDING_CONFIG_SCHEMA_VERSION = 'binrat.funding-config/0.1' as const;

export type FundingAuthorityStatus =
  | 'TREASURY_AUTHORITY_NOT_CONFIGURED'
  | 'TREASURY_AUTHORITY_INVALID'
  | 'FUNDING_OBSERVATION_SOURCE_NOT_IMPLEMENTED';

export interface CanonicalFundingConfig {
  schemaVersion: typeof FUNDING_CONFIG_SCHEMA_VERSION;
  configVersion: string;
  categoryPolicyVersion: string;
  chainId: number;
  accountingEnabled: true;
  effectiveFromBlock: string;
  tokenAddress: Hex;
  creatorFeeRecipients: readonly Hex[];
  treasuryAddresses: readonly Hex[];
}

export interface FundingConfigResolution {
  status: FundingAuthorityStatus;
  config: CanonicalFundingConfig | null;
}

export function resolveProductionFundingConfig(
  raw: string | undefined,
  expectedChainId: number
): FundingConfigResolution {
  if (!raw?.trim()) return { status: 'TREASURY_AUTHORITY_NOT_CONFIGURED', config: null };
  try {
    const config = validateFundingConfig(JSON.parse(raw), expectedChainId, 'PRODUCTION');
    // Deliberately fail closed. Valid addresses are necessary but do not activate accounting;
    // a separately reviewed immutable on-chain observation source must ship first.
    return { status: 'FUNDING_OBSERVATION_SOURCE_NOT_IMPLEMENTED', config };
  } catch {
    return { status: 'TREASURY_AUTHORITY_INVALID', config: null };
  }
}

export function validateFundingConfig(
  value: unknown,
  expectedChainId: number,
  mode: 'PRODUCTION' | 'TEST_FIXTURE'
): CanonicalFundingConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('FUNDING_CONFIG_INVALID');
  }
  const input = value as Record<string, unknown>;
  const configVersion = string(input.configVersion);
  const categoryPolicyVersion = string(input.categoryPolicyVersion);
  if (
    input.schemaVersion !== FUNDING_CONFIG_SCHEMA_VERSION ||
    input.accountingEnabled !== true ||
    input.chainId !== expectedChainId ||
    !Number.isSafeInteger(input.chainId) ||
    !/^[A-Z0-9_.-]{3,80}$/.test(configVersion) ||
    !/^[A-Z0-9_.-]{3,80}$/.test(categoryPolicyVersion) ||
    !/^(0|[1-9][0-9]*)$/.test(string(input.effectiveFromBlock))
  ) throw new Error('FUNDING_CONFIG_INVALID');
  if (mode === 'TEST_FIXTURE') {
    if (!configVersion.startsWith('TEST_') || !categoryPolicyVersion.startsWith('TEST_')) {
      throw new Error('FUNDING_TEST_CONFIG_UNLABELED');
    }
  } else if (configVersion.startsWith('TEST_') || categoryPolicyVersion.startsWith('TEST_')) {
    throw new Error('FUNDING_FIXTURE_CONFIG_IN_PRODUCTION');
  }

  const tokenAddress = address(input.tokenAddress);
  const creatorFeeRecipients = addresses(input.creatorFeeRecipients);
  const treasuryAddresses = addresses(input.treasuryAddresses);
  if (treasuryAddresses.length === 0) throw new Error('FUNDING_TREASURY_MISSING');
  const authorities = [...creatorFeeRecipients, ...treasuryAddresses];
  if (new Set(authorities).size !== authorities.length || authorities.includes(tokenAddress)) {
    throw new Error('FUNDING_AUTHORITY_AMBIGUOUS');
  }

  return Object.freeze({
    schemaVersion: FUNDING_CONFIG_SCHEMA_VERSION,
    configVersion,
    categoryPolicyVersion,
    chainId: expectedChainId,
    accountingEnabled: true as const,
    effectiveFromBlock: string(input.effectiveFromBlock),
    tokenAddress,
    creatorFeeRecipients: Object.freeze(creatorFeeRecipients),
    treasuryAddresses: Object.freeze(treasuryAddresses)
  });
}

function string(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function address(value: unknown): Hex {
  const candidate = string(value);
  if (!isAddress(candidate, { strict: false })) throw new Error('FUNDING_ADDRESS_INVALID');
  const normalized = getAddress(candidate).toLowerCase() as Hex;
  if (normalized === '0x0000000000000000000000000000000000000000') {
    throw new Error('FUNDING_ADDRESS_INVALID');
  }
  return normalized;
}

function addresses(value: unknown): Hex[] {
  if (!Array.isArray(value)) throw new Error('FUNDING_ADDRESSES_INVALID');
  return value.map(address);
}
