import { createHash, randomBytes } from 'node:crypto';
import { getAddress, isAddress, verifyMessage, type Hex } from 'viem';
import { createSiweMessage, parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import { ARC_CHAIN_ID } from '../arc/chain.js';
import type {
  HolderAccessTier,
  HolderEligibilityDecision,
  HolderEligibilitySource
} from '../holder/eligibility.js';
import type { D1DatabaseLike, D1ResultLike } from './d1Types.js';

export const HOLDER_CHALLENGE_TTL_MS = 5 * 60_000;
export const HOLDER_SESSION_TTL_MS = 15 * 60_000;
export const HOLDER_GATE_REQUEST_ID = 'BINRAT_HOLDER_GATE_V0';
export const HOLDER_GATE_STATEMENT =
  'Authorize short-lived BINRAT Holder Gate V0 access. This does not sign a transaction.';

export interface HolderChallenge {
  nonce: string;
  wallet: `0x${string}`;
  domain: string;
  uri: string;
  message: string;
  issuedAtMs: number;
  expiresAtMs: number;
  consumedAtMs: number | null;
}

export interface HolderSession {
  wallet: `0x${string}`;
  accessTier: HolderAccessTier;
  policyId: string;
  eligibilityStatus: HolderEligibilityDecision['status'];
  issuedAtMs: number;
  expiresAtMs: number;
}

export class D1HolderAuthStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async putChallenge(challenge: HolderChallenge): Promise<'INSERTED' | 'COLLISION'> {
    const result = await this.db.prepare(`
      INSERT OR IGNORE INTO holder_auth_challenges (
        nonce,wallet,domain,uri,message,issued_at_ms,expires_at_ms,consumed_at_ms
      ) VALUES (?,?,?,?,?,?,?,NULL)
    `).bind(
      challenge.nonce,
      challenge.wallet,
      challenge.domain,
      challenge.uri,
      challenge.message,
      challenge.issuedAtMs,
      challenge.expiresAtMs
    ).run();
    return changes(result) === 1 ? 'INSERTED' : 'COLLISION';
  }

  async getChallenge(nonce: string): Promise<HolderChallenge | null> {
    const row = await this.db.prepare(`
      SELECT nonce,wallet,domain,uri,message,issued_at_ms,expires_at_ms,consumed_at_ms
      FROM holder_auth_challenges WHERE nonce = ? LIMIT 1
    `).bind(nonce).first<ChallengeRow>();
    return row ? {
      nonce: row.nonce,
      wallet: row.wallet as `0x${string}`,
      domain: row.domain,
      uri: row.uri,
      message: row.message,
      issuedAtMs: row.issued_at_ms,
      expiresAtMs: row.expires_at_ms,
      consumedAtMs: row.consumed_at_ms
    } : null;
  }

  async consumeChallenge(nonce: string, nowMs: number): Promise<boolean> {
    const result = await this.db.prepare(`
      UPDATE holder_auth_challenges
      SET consumed_at_ms = ?
      WHERE nonce = ? AND consumed_at_ms IS NULL AND expires_at_ms > ?
    `).bind(nowMs, nonce, nowMs).run();
    return changes(result) === 1;
  }

  async putSession(token: string, session: HolderSession): Promise<void> {
    const result = await this.db.prepare(`
      INSERT INTO holder_auth_sessions (
        session_hash,wallet,access_tier,policy_id,eligibility_status,
        issued_at_ms,expires_at_ms,invalidated_at_ms
      ) VALUES (?,?,?,?,?,?,?,NULL)
    `).bind(
      sessionDigest(token),
      session.wallet,
      session.accessTier,
      session.policyId,
      session.eligibilityStatus,
      session.issuedAtMs,
      session.expiresAtMs
    ).run();
    if (changes(result) !== 1) throw new Error('HOLDER_SESSION_PERSISTENCE_FAILED');
  }

  async getSession(token: string, nowMs: number): Promise<HolderSession | null> {
    const row = await this.db.prepare(`
      SELECT wallet,access_tier,policy_id,eligibility_status,issued_at_ms,expires_at_ms
      FROM holder_auth_sessions
      WHERE session_hash = ? AND invalidated_at_ms IS NULL AND expires_at_ms > ?
      LIMIT 1
    `).bind(sessionDigest(token), nowMs).first<SessionRow>();
    if (!row) return null;
    if (row.access_tier !== 'FREE' && row.access_tier !== 'HOLDER') {
      throw new Error('HOLDER_SESSION_TIER_INVALID');
    }
    return {
      wallet: row.wallet as `0x${string}`,
      accessTier: row.access_tier,
      policyId: row.policy_id,
      eligibilityStatus: row.eligibility_status as HolderEligibilityDecision['status'],
      issuedAtMs: row.issued_at_ms,
      expiresAtMs: row.expires_at_ms
    };
  }
}

export async function createHolderChallenge(
  store: D1HolderAuthStore,
  input: { wallet: string; origin: string; nowMs: number }
): Promise<HolderChallenge> {
  if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) throw new Error('HOLDER_TIME_INVALID');
  if (!isAddress(input.wallet, { strict: false })) throw new Error('HOLDER_WALLET_INVALID');
  const url = new URL(input.origin);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('HOLDER_ORIGIN_INVALID');
  }
  const wallet = getAddress(input.wallet).toLowerCase() as `0x${string}`;
  const issuedAt = new Date(input.nowMs);
  const expiresAtMs = input.nowMs + HOLDER_CHALLENGE_TTL_MS;
  const expirationTime = new Date(expiresAtMs);
  const uri = `${url.origin}/api/holder/session`;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nonce = randomBytes(16).toString('hex');
    const message = createSiweMessage({
      address: getAddress(wallet),
      chainId: ARC_CHAIN_ID,
      domain: url.host,
      expirationTime,
      issuedAt,
      nonce,
      requestId: HOLDER_GATE_REQUEST_ID,
      resources: [`${url.origin}/api/rat-radar/watchlist?depth=full`],
      scheme: url.protocol.slice(0, -1),
      statement: HOLDER_GATE_STATEMENT,
      uri,
      version: '1'
    });
    const challenge: HolderChallenge = {
      nonce,
      wallet,
      domain: url.host,
      uri,
      message,
      issuedAtMs: input.nowMs,
      expiresAtMs,
      consumedAtMs: null
    };
    if (await store.putChallenge(challenge) === 'INSERTED') return challenge;
  }
  throw new Error('HOLDER_NONCE_COLLISION');
}

export async function proveHolderWallet(
  store: D1HolderAuthStore,
  eligibility: HolderEligibilitySource,
  input: { nonce: string; message: string; signature: string; origin: string; nowMs: number }
): Promise<{ token: string; session: HolderSession }> {
  if (!/^[A-Za-z0-9]{8,128}$/.test(input.nonce)) throw new Error('HOLDER_NONCE_INVALID');
  if (!/^0x[0-9a-fA-F]{130}$/.test(input.signature)) throw new Error('HOLDER_SIGNATURE_INVALID');
  const challenge = await store.getChallenge(input.nonce);
  if (!challenge || challenge.consumedAtMs !== null) throw new Error('HOLDER_CHALLENGE_USED_OR_UNKNOWN');
  if (input.nowMs >= challenge.expiresAtMs) throw new Error('HOLDER_CHALLENGE_EXPIRED');
  if (input.message !== challenge.message) throw new Error('HOLDER_CHALLENGE_TAMPERED');

  const origin = new URL(input.origin);
  const parsed = parseSiweMessage(input.message);
  if (
    challenge.domain !== origin.host ||
    challenge.uri !== `${origin.origin}/api/holder/session` ||
    parsed.chainId !== ARC_CHAIN_ID ||
    parsed.uri !== challenge.uri ||
    parsed.requestId !== HOLDER_GATE_REQUEST_ID ||
    parsed.statement !== HOLDER_GATE_STATEMENT ||
    !validateSiweMessage({
      address: challenge.wallet,
      domain: challenge.domain,
      message: parsed,
      nonce: challenge.nonce,
      scheme: origin.protocol.slice(0, -1),
      time: new Date(input.nowMs)
    })
  ) throw new Error('HOLDER_CHALLENGE_AUTHORITY_INVALID');

  let signatureValid = false;
  try {
    signatureValid = await verifyMessage({
      address: challenge.wallet,
      message: challenge.message,
      signature: input.signature as Hex
    });
  } catch {}
  if (!signatureValid) throw new Error('HOLDER_SIGNATURE_WALLET_MISMATCH');

  const decision = await eligibility.evaluate(challenge.wallet);
  if (decision.wallet !== challenge.wallet) throw new Error('HOLDER_ELIGIBILITY_WALLET_MISMATCH');
  if (!(await store.consumeChallenge(challenge.nonce, input.nowMs))) {
    throw new Error('HOLDER_CHALLENGE_USED_OR_EXPIRED');
  }

  const token = randomBytes(32).toString('hex');
  const session: HolderSession = {
    wallet: challenge.wallet,
    accessTier: decision.accessTier,
    policyId: decision.policyId,
    eligibilityStatus: decision.status,
    issuedAtMs: input.nowMs,
    expiresAtMs: input.nowMs + HOLDER_SESSION_TTL_MS
  };
  await store.putSession(token, session);
  return { token, session };
}

export function bearerToken(request: Request): string | null {
  const value = request.headers.get('authorization');
  if (!value) return null;
  const match = value.match(/^Bearer ([0-9a-f]{64})$/);
  return match?.[1] ?? null;
}

function sessionDigest(token: string): string {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error('HOLDER_SESSION_TOKEN_INVALID');
  return createHash('sha256').update(token).digest('hex');
}

function changes(result: D1ResultLike): number {
  return Number(result.meta?.changes ?? 0);
}

interface ChallengeRow {
  nonce: string;
  wallet: string;
  domain: string;
  uri: string;
  message: string;
  issued_at_ms: number;
  expires_at_ms: number;
  consumed_at_ms: number | null;
}

interface SessionRow {
  wallet: string;
  access_tier: string;
  policy_id: string;
  eligibility_status: string;
  issued_at_ms: number;
  expires_at_ms: number;
}
