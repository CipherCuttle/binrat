import { getAddress, isAddress } from 'viem';

export type HolderAccessTier = 'FREE' | 'HOLDER';

export type HolderEligibilityStatus =
  | 'TEST_FIXTURE_ELIGIBLE'
  | 'TEST_FIXTURE_BELOW_THRESHOLD'
  | 'TOKEN_AUTHORITY_NOT_CONFIGURED'
  | 'TOKEN_AUTHORITY_INVALID'
  | 'TOKEN_BALANCE_SOURCE_NOT_IMPLEMENTED';

export interface HolderEligibilityDecision {
  wallet: `0x${string}`;
  accessTier: HolderAccessTier;
  policyId: string;
  status: HolderEligibilityStatus;
}

export interface HolderEligibilitySource {
  evaluate(wallet: `0x${string}`): Promise<HolderEligibilityDecision>;
}

export interface HolderPolicyEnv {
  BINRAT_HOLDER_GATE_ENABLED?: string;
  BINRAT_HOLDER_TOKEN_ADDRESS?: string;
  BINRAT_HOLDER_THRESHOLD?: string;
}

export class ProductionHolderEligibilitySource implements HolderEligibilitySource {
  constructor(private readonly env: HolderPolicyEnv) {}

  async evaluate(wallet: `0x${string}`): Promise<HolderEligibilityDecision> {
    const normalized = normalizeWallet(wallet);
    const config = productionConfigStatus(this.env);
    return {
      wallet: normalized,
      accessTier: 'FREE',
      policyId: 'binrat.holder-production/0.1',
      status: config
    };
  }
}

export class FixtureHolderEligibilitySource implements HolderEligibilitySource {
  private readonly balances = new Map<string, bigint>();

  constructor(
    balances: Readonly<Record<string, bigint>>,
    private readonly threshold: bigint,
    private readonly policyId = 'TEST_BINRAT_HOLDER_POLICY_V0'
  ) {
    if (threshold <= 0n) throw new Error('TEST_HOLDER_THRESHOLD_INVALID');
    if (!policyId.startsWith('TEST_')) throw new Error('TEST_HOLDER_POLICY_ID_INVALID');
    for (const [wallet, balance] of Object.entries(balances)) {
      if (balance < 0n) throw new Error('TEST_HOLDER_BALANCE_INVALID');
      this.balances.set(normalizeWallet(wallet), balance);
    }
  }

  async evaluate(wallet: `0x${string}`): Promise<HolderEligibilityDecision> {
    const normalized = normalizeWallet(wallet);
    const eligible = (this.balances.get(normalized) ?? 0n) >= this.threshold;
    return {
      wallet: normalized,
      accessTier: eligible ? 'HOLDER' : 'FREE',
      policyId: this.policyId,
      status: eligible ? 'TEST_FIXTURE_ELIGIBLE' : 'TEST_FIXTURE_BELOW_THRESHOLD'
    };
  }
}

export function productionConfigStatus(env: HolderPolicyEnv): Extract<
  HolderEligibilityStatus,
  'TOKEN_AUTHORITY_NOT_CONFIGURED' | 'TOKEN_AUTHORITY_INVALID' | 'TOKEN_BALANCE_SOURCE_NOT_IMPLEMENTED'
> {
  const enabled = env.BINRAT_HOLDER_GATE_ENABLED?.trim();
  const token = env.BINRAT_HOLDER_TOKEN_ADDRESS?.trim();
  const threshold = env.BINRAT_HOLDER_THRESHOLD?.trim();
  const anyConfigured = enabled !== undefined || token !== undefined || threshold !== undefined;

  if (!anyConfigured) return 'TOKEN_AUTHORITY_NOT_CONFIGURED';
  if (enabled !== 'true' && enabled !== 'false') return 'TOKEN_AUTHORITY_INVALID';
  if (enabled === 'false') {
    return token === undefined && threshold === undefined
      ? 'TOKEN_AUTHORITY_NOT_CONFIGURED'
      : 'TOKEN_AUTHORITY_INVALID';
  }
  if (
    !token ||
    !isAddress(token, { strict: false }) ||
    token.toLowerCase() === '0x0000000000000000000000000000000000000000' ||
    !threshold ||
    !/^[1-9][0-9]*$/.test(threshold)
  ) return 'TOKEN_AUTHORITY_INVALID';

  // Deliberately fail closed. A canonical token address and threshold are necessary but
  // not sufficient: production HOLDER requires a separately reviewed ERC-20 balance source.
  return 'TOKEN_BALANCE_SOURCE_NOT_IMPLEMENTED';
}

function normalizeWallet(wallet: string): `0x${string}` {
  if (!isAddress(wallet, { strict: false })) throw new Error('HOLDER_WALLET_INVALID');
  return getAddress(wallet).toLowerCase() as `0x${string}`;
}
