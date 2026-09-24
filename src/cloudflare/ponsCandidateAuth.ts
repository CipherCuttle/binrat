import { createHash, randomBytes } from 'node:crypto';
import { getAddress, isAddress, verifyMessage, type Hex } from 'viem';
import { createSiweMessage, parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import type { D1DatabaseLike, D1ResultLike } from './d1Types.js';

/** A distinct candidate-only Robinhood realm. No Worker route or HOLDER authority. */
export const PONS_AUTH_CHAIN_ID = 4663 as const;
export const PONS_AUTH_POLICY = 'binrat.pons-candidate/v1' as const;
export const PONS_AUTH_PURPOSE = 'BINRAT_PONS_CANDIDATE_V1' as const;
export const PONS_CHALLENGE_TTL_MS = 300_000;
export const PONS_SESSION_TTL_MS = 900_000;
const STATEMENT = 'Authenticate for BINRAT Pons candidate access only. No transaction or holder entitlement.';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface PonsChallenge {
  nonce: string;
  wallet: Hex;
  domain: string;
  uri: string;
  message: string;
  chainId: typeof PONS_AUTH_CHAIN_ID;
  policyId: typeof PONS_AUTH_POLICY;
  issuedAtMs: number;
  expiresAtMs: number;
  consumedAtMs: number | null;
}
export interface PonsSession {
  wallet: Hex;
  domain: string;
  originUrl: string;
  chainId: typeof PONS_AUTH_CHAIN_ID;
  policyId: typeof PONS_AUTH_POLICY;
  accessTier: 'FREE';
  issuedAtMs: number;
  expiresAtMs: number;
}
type ChallengeRow = {
  nonce: string; wallet: string; domain: string; uri: string; message: string;
  chain_id: number; policy_id: string; issued_at_ms: number; expires_at_ms: number;
  consumed_at_ms: number | null;
};
type SessionRow = {
  wallet: string; domain: string; origin_url: string; chain_id: number; policy_id: string; access_tier: string;
  issued_at_ms: number; expires_at_ms: number;
};

function validateOrigin(raw: string): URL {
  let origin: URL;
  try { origin = new URL(raw); } catch { throw new Error('PONS_AUTH_ORIGIN_INVALID'); }
  if (
    raw !== origin.origin ||
    (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && origin.hostname === 'localhost')) ||
    origin.username !== '' || origin.password !== ''
  ) throw new Error('PONS_AUTH_ORIGIN_INVALID');
  return origin;
}
function validNow(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000;
}
function hashToken(token: string): string {
  if (!/^[0-9a-f]{64}$/.test(token)) throw new Error('PONS_AUTH_SESSION_TOKEN_INVALID');
  return createHash('sha256').update(token).digest('hex');
}
function written(row: D1ResultLike): boolean { return Number(row.meta?.changes ?? 0) === 1; }

export class D1PonsCandidateAuthStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async putChallenge(c: PonsChallenge): Promise<boolean> {
    const row = await this.db.prepare(
      'INSERT OR IGNORE INTO pons_candidate_auth_challenges ' +
      '(nonce,wallet,domain,uri,message,chain_id,policy_id,issued_at_ms,expires_at_ms,consumed_at_ms) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,NULL)'
    ).bind(c.nonce,c.wallet,c.domain,c.uri,c.message,c.chainId,c.policyId,c.issuedAtMs,c.expiresAtMs).run();
    return written(row);
  }

  async getChallenge(nonce: string): Promise<PonsChallenge | null> {
    const row = await this.db.prepare(
      'SELECT nonce,wallet,domain,uri,message,chain_id,policy_id,issued_at_ms,expires_at_ms,consumed_at_ms ' +
      'FROM pons_candidate_auth_challenges WHERE nonce=? LIMIT 1'
    ).bind(nonce).first<ChallengeRow>();
    if (!row || row.chain_id !== PONS_AUTH_CHAIN_ID || row.policy_id !== PONS_AUTH_POLICY) return null;
    return {
      nonce:row.nonce,wallet:row.wallet as Hex,domain:row.domain,uri:row.uri,message:row.message,
      chainId:PONS_AUTH_CHAIN_ID,policyId:PONS_AUTH_POLICY,issuedAtMs:row.issued_at_ms,
      expiresAtMs:row.expires_at_ms,consumedAtMs:row.consumed_at_ms
    };
  }

  async consume(c: PonsChallenge, nowMs: number): Promise<boolean> {
    const row = await this.db.prepare(
      'UPDATE pons_candidate_auth_challenges SET consumed_at_ms=? WHERE nonce=? AND wallet=? ' +
      'AND domain=? AND chain_id=4663 AND policy_id=? AND consumed_at_ms IS NULL AND expires_at_ms>?'
    ).bind(nowMs,c.nonce,c.wallet,c.domain,PONS_AUTH_POLICY,nowMs).run();
    return written(row);
  }

  async saveSession(token: string, s: PonsSession): Promise<void> {
    if (
      s.chainId !== PONS_AUTH_CHAIN_ID || s.policyId !== PONS_AUTH_POLICY ||
      s.accessTier !== 'FREE' ||
      s.originUrl !== validateOrigin(s.originUrl).origin ||
      s.domain !== validateOrigin(s.originUrl).host
    ) throw new Error('PONS_AUTH_SESSION_AUTHORITY_INVALID');
    const row = await this.db.prepare(
      'INSERT INTO pons_candidate_auth_sessions ' +
      '(session_hash,wallet,domain,origin_url,chain_id,policy_id,access_tier,issued_at_ms,expires_at_ms,invalidated_at_ms) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,NULL)'
    ).bind(hashToken(token),s.wallet,s.domain,s.originUrl,s.chainId,s.policyId,s.accessTier,s.issuedAtMs,s.expiresAtMs).run();
    if (!written(row)) throw new Error('PONS_AUTH_SESSION_PERSISTENCE_FAILED');
  }

  async getSession(
    token: string, nowMs: number, expectedOrigin: string,
    expectedPolicy: string = PONS_AUTH_POLICY
  ): Promise<PonsSession | null> {
    if (!validNow(nowMs) || !/^[0-9a-f]{64}$/.test(token) || expectedPolicy !== PONS_AUTH_POLICY) return null;
    let origin: URL;
    try { origin = validateOrigin(expectedOrigin); } catch { return null; }
    const row = await this.db.prepare(
      'SELECT wallet,domain,origin_url,chain_id,policy_id,access_tier,issued_at_ms,expires_at_ms ' +
      'FROM pons_candidate_auth_sessions WHERE session_hash=? AND domain=? AND origin_url=? AND chain_id=4663 ' +
      'AND policy_id=? AND access_tier=? AND invalidated_at_ms IS NULL AND expires_at_ms>? LIMIT 1'
    ).bind(hashToken(token),origin.host,origin.origin,PONS_AUTH_POLICY,'FREE',nowMs).first<SessionRow>();
    if (!row || row.chain_id !== PONS_AUTH_CHAIN_ID || row.policy_id !== expectedPolicy ||
      row.access_tier !== 'FREE' || row.domain !== origin.host || row.origin_url !== origin.origin) return null;
    return {
      wallet:row.wallet as Hex,domain:row.domain,originUrl:row.origin_url,chainId:PONS_AUTH_CHAIN_ID,
      policyId:PONS_AUTH_POLICY,accessTier:'FREE',issuedAtMs:row.issued_at_ms,expiresAtMs:row.expires_at_ms
    };
  }
}

export async function createPonsChallenge(
  store: D1PonsCandidateAuthStore,
  input: { wallet: string; origin: string; nowMs: number }
): Promise<PonsChallenge> {
  if (!validNow(input.nowMs)) throw new Error('PONS_AUTH_TIME_INVALID');
  const origin = validateOrigin(input.origin);
  if (!isAddress(input.wallet,{strict:false}) || input.wallet.toLowerCase() === ZERO_ADDRESS) {
    throw new Error('PONS_AUTH_WALLET_INVALID');
  }
  const wallet = getAddress(input.wallet).toLowerCase() as Hex;
  const uri = origin.origin + '/api/pons-candidate/session';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nonce = randomBytes(16).toString('hex');
    const message = createSiweMessage({
      address:getAddress(wallet),chainId:PONS_AUTH_CHAIN_ID,domain:origin.host,
      expirationTime:new Date(input.nowMs+PONS_CHALLENGE_TTL_MS),issuedAt:new Date(input.nowMs),
      nonce,requestId:PONS_AUTH_PURPOSE,
      resources:[origin.origin+'/api/rat-radar/watchlist?depth=full'],
      scheme:origin.protocol.slice(0,-1),statement:STATEMENT,uri,version:'1'
    });
    const c: PonsChallenge = {
      nonce,wallet,domain:origin.host,uri,message,chainId:PONS_AUTH_CHAIN_ID,
      policyId:PONS_AUTH_POLICY,issuedAtMs:input.nowMs,
      expiresAtMs:input.nowMs+PONS_CHALLENGE_TTL_MS,consumedAtMs:null
    };
    if (await store.putChallenge(c)) return c;
  }
  throw new Error('PONS_AUTH_NONCE_COLLISION');
}

export async function provePonsWallet(
  store: D1PonsCandidateAuthStore,
  input: { nonce: string; message: string; signature: string; origin: string; nowMs: number }
): Promise<{ token: string; session: PonsSession }> {
  if (!validNow(input.nowMs)) throw new Error('PONS_AUTH_TIME_INVALID');
  if (!/^[0-9a-f]{32}$/.test(input.nonce)) throw new Error('PONS_AUTH_NONCE_INVALID');
  if (!/^0x[0-9a-fA-F]{130}$/.test(input.signature)) throw new Error('PONS_AUTH_SIGNATURE_INVALID');
  const c = await store.getChallenge(input.nonce);
  if (!c || c.consumedAtMs !== null) throw new Error('PONS_AUTH_CHALLENGE_USED_OR_UNKNOWN');
  if (input.nowMs < c.issuedAtMs || input.nowMs >= c.expiresAtMs) throw new Error('PONS_AUTH_CHALLENGE_EXPIRED');
  if (input.message !== c.message) throw new Error('PONS_AUTH_CHALLENGE_TAMPERED');
  const origin = validateOrigin(input.origin);
  const parsed = parseSiweMessage(input.message);
  if (
    origin.host !== c.domain || c.uri !== origin.origin+'/api/pons-candidate/session' ||
    parsed.chainId !== PONS_AUTH_CHAIN_ID || parsed.uri !== c.uri ||
    parsed.requestId !== PONS_AUTH_PURPOSE || parsed.statement !== STATEMENT ||
    parsed.resources?.length !== 1 ||
    parsed.resources[0] !== origin.origin+'/api/rat-radar/watchlist?depth=full' ||
    !validateSiweMessage({
      address:c.wallet,domain:c.domain,message:parsed,nonce:c.nonce,
      scheme:origin.protocol.slice(0,-1),time:new Date(input.nowMs)
    })
  ) throw new Error('PONS_AUTH_CHALLENGE_AUTHORITY_INVALID');

  let verified=false;
  try { verified=await verifyMessage({
    address:c.wallet,message:c.message,signature:input.signature as Hex
  }); } catch {}
  // EOA-only candidate. Contract wallets require separately reviewed EIP-1271.
  if (!verified) throw new Error('PONS_AUTH_SIGNATURE_WALLET_MISMATCH');
  if (!(await store.consume(c,input.nowMs))) throw new Error('PONS_AUTH_CHALLENGE_USED_OR_EXPIRED');
  const token=randomBytes(32).toString('hex');
  const session: PonsSession={
    wallet:c.wallet,domain:c.domain,originUrl:origin.origin,chainId:PONS_AUTH_CHAIN_ID,policyId:PONS_AUTH_POLICY,
    accessTier:'FREE',issuedAtMs:input.nowMs,expiresAtMs:input.nowMs+PONS_SESSION_TTL_MS
  };
  await store.saveSession(token,session);
  return {token,session};
}
