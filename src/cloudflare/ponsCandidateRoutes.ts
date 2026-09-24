import { createHash } from 'node:crypto';
import type { D1DatabaseLike } from './d1Types.js';
import {
  D1PonsCandidateAuthStore,
  PONS_AUTH_CHAIN_ID,
  PONS_AUTH_POLICY,
  PONS_AUTH_PURPOSE,
  createPonsChallenge,
  provePonsWallet
} from './ponsCandidateAuth.js';

/**
 * TEST CANDIDATE ROUTER ONLY. The production Worker's default dependencies
 * cannot enable it, even if somebody sets the environment toggle.
 * Every successfully authenticated session remains FREE.
 */
const WINDOW_MS = 60_000;
const CHALLENGE_LIMIT_PER_IP = 6;
const CHALLENGE_LIMIT_PER_WALLET = 3;
const PROOF_LIMIT_PER_IP = 12;
const MAX_BODY_BYTES = 4 * 1024;

function response(status: number, body: unknown): Response {
  return Response.json(body, {
    status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

function rateKey(scope: string, subject: string): string {
  return createHash('sha256').update(scope).update('\0').update(subject).digest('hex');
}

/**
 * Atomic SQLite/D1 upsert of a fixed 60-second window. The subsequent read
 * may conservatively reject some concurrent requests; it cannot grant excess
 * requests beyond the threshold. Raw client IPs are never persisted.
 */
async function limit(
  db: D1DatabaseLike, scope: string, subject: string,
  nowMs: number, maxHits: number
): Promise<boolean> {
  const key = rateKey(scope, subject);
  await db.prepare(
    'INSERT INTO pons_candidate_route_limits (bucket_key,window_start_ms,hits) VALUES (?,?,1) ' +
    'ON CONFLICT(bucket_key) DO UPDATE SET ' +
    'hits=CASE WHEN window_start_ms <= excluded.window_start_ms - ? THEN 1 ELSE hits+1 END, ' +
    'window_start_ms=CASE WHEN window_start_ms <= excluded.window_start_ms - ? ' +
    'THEN excluded.window_start_ms ELSE window_start_ms END'
  ).bind(key, nowMs, WINDOW_MS, WINDOW_MS).run();
  const row = await db.prepare(
    'SELECT hits,window_start_ms FROM pons_candidate_route_limits WHERE bucket_key=? LIMIT 1'
  ).bind(key).first<{ hits: number; window_start_ms: number }>();
  if (!row || !Number.isInteger(row.hits) || row.window_start_ms > nowMs) {
    throw new Error('PONS_CANDIDATE_RATE_STATE_INVALID');
  }
  return row.hits <= maxHits;
}

function clientBucket(request: Request): string {
  // CF-Connecting-IP is an edge-supplied hint, NOT independent user identity.
  // An absent/invalid value shares one restrictive "unknown" bucket.
  const supplied = request.headers.get('cf-connecting-ip')?.trim() ?? '';
  return /^[0-9a-fA-F:.]{3,45}$/.test(supplied) ? supplied.toLowerCase() : 'unknown';
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) {
    throw new Error('PONS_CANDIDATE_CONTENT_TYPE_INVALID');
  }
  const length = Number(request.headers.get('content-length') ?? '0');
  if (!Number.isFinite(length) || length > MAX_BODY_BYTES) throw new Error('PONS_CANDIDATE_BODY_TOO_LARGE');
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new Error('PONS_CANDIDATE_BODY_TOO_LARGE');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('PONS_CANDIDATE_JSON_INVALID'); }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('PONS_CANDIDATE_JSON_INVALID');
  }
  return parsed as Record<string, unknown>;
}

function errorResponse(error: unknown): Response {
  const raw = error instanceof Error ? error.message : '';
  const code = /^PONS_(?:AUTH|CANDIDATE)_[A-Z0-9_]+$/.test(raw)
    ? raw : 'PONS_CANDIDATE_UNAVAILABLE';
  const status = code === 'PONS_CANDIDATE_RATE_LIMITED' ? 429
    : code === 'PONS_CANDIDATE_ORIGIN_MISMATCH' ? 403
    : code === 'PONS_CANDIDATE_CONTENT_TYPE_INVALID' ? 415
    : code === 'PONS_CANDIDATE_BODY_TOO_LARGE' ? 413
    : code.startsWith('PONS_AUTH_SIGNATURE_WALLET_MISMATCH') ||
      code.includes('CHALLENGE_EXPIRED') || code.includes('CHALLENGE_USED') ? 401
    : code === 'PONS_CANDIDATE_UNAVAILABLE' || code === 'PONS_CANDIDATE_RATE_STATE_INVALID' ||
      code === 'PONS_AUTH_SESSION_PERSISTENCE_FAILED' ? 503
    : 400;
  return response(status, { error: code });
}

export async function handlePonsCandidateRoute(
  request: Request, pathname: string, origin: string,
  db: D1DatabaseLike, nowMs: number
): Promise<Response> {
  const store = new D1PonsCandidateAuthStore(db);
  try {
    const isChallenge = pathname === '/api/pons-candidate/challenge';
    const isProof = pathname === '/api/pons-candidate/session';
    const isMe = pathname === '/api/pons-candidate/me';
    if (!isChallenge && !isProof && !isMe) return response(404, { error: 'NOT_FOUND' });
    if ((isChallenge || isProof) && request.method !== 'POST' ||
        isMe && request.method !== 'GET') return response(405, { error: 'METHOD_NOT_ALLOWED' });
    const claimedOrigin = request.headers.get('origin');
    if ((isChallenge || isProof) && claimedOrigin !== origin ||
        isMe && claimedOrigin !== null && claimedOrigin !== origin) {
      throw new Error('PONS_CANDIDATE_ORIGIN_MISMATCH');
    }
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new Error('PONS_CANDIDATE_UNAVAILABLE');
    }
    if (isMe) {
      const match = request.headers.get('authorization')?.match(/^Bearer ([0-9a-f]{64})$/);
      if (!match) return response(401, { error: 'PONS_CANDIDATE_SESSION_REQUIRED' });
      const session = await store.getSession(match[1]!, nowMs, origin);
      if (!session) return response(401, { error: 'PONS_CANDIDATE_SESSION_INVALID' });
      return response(200, {
        schemaVersion: 'binrat.pons-candidate-session-view/1',
        wallet: session.wallet, chainId: session.chainId, policyId: session.policyId,
        accessTier: 'FREE', candidateOnly: true, holderAccessGranted: false,
        expiresAtMs: session.expiresAtMs
      });
    }

    const ip = clientBucket(request);
    if (!(await limit(
      db, isChallenge ? 'challenge-ip' : 'proof-ip', ip,
      nowMs, isChallenge ? CHALLENGE_LIMIT_PER_IP : PROOF_LIMIT_PER_IP
    ))) throw new Error('PONS_CANDIDATE_RATE_LIMITED');
    const body = await jsonBody(request);
    if (isChallenge) {
      const wallet = typeof body.wallet === 'string' ? body.wallet : '';
      if (/^0x[0-9a-fA-F]{40}$/.test(wallet) &&
          !(await limit(db, 'challenge-wallet', wallet.toLowerCase(),
            nowMs, CHALLENGE_LIMIT_PER_WALLET))) {
        throw new Error('PONS_CANDIDATE_RATE_LIMITED');
      }
      const challenge = await createPonsChallenge(store, { wallet, origin, nowMs });
      return response(201, {
        schemaVersion: 'binrat.pons-candidate-challenge/1',
        nonce: challenge.nonce, message: challenge.message,
        wallet: challenge.wallet, chainId: PONS_AUTH_CHAIN_ID,
        policyId: PONS_AUTH_POLICY, purpose: PONS_AUTH_PURPOSE,
        expiresAtMs: challenge.expiresAtMs, transactionSigning: false,
        productionHolderEligibilityActive: false
      });
    }

    const result = await provePonsWallet(store, {
      nonce: typeof body.nonce === 'string' ? body.nonce : '',
      message: typeof body.message === 'string' ? body.message : '',
      signature: typeof body.signature === 'string' ? body.signature : '',
      origin, nowMs
    });
    return response(201, {
      schemaVersion: 'binrat.pons-candidate-session/1',
      token: result.token, tokenType: 'Bearer',
      wallet: result.session.wallet, chainId: PONS_AUTH_CHAIN_ID,
      policyId: PONS_AUTH_POLICY, accessTier: 'FREE',
      candidateOnly: true, holderAccessGranted: false,
      issuedAtMs: result.session.issuedAtMs,
      expiresAtMs: result.session.expiresAtMs,
      transactionSigning: false, productionHolderEligibilityActive: false
    });
  } catch (error) {
    return errorResponse(error);
  }
}
