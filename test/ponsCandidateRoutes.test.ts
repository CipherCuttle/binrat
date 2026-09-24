import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  handleWorkerRequest, type BinratWorkerEnv, type WorkerDeps
} from '../src/cloudflare/worker.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import {
  D1HolderAuthStore, createHolderChallenge, proveHolderWallet
} from '../src/cloudflare/holderAuth.js';
import { D1PonsCandidateAuthStore } from '../src/cloudflare/ponsCandidateAuth.js';
import { FixtureHolderEligibilitySource } from '../src/holder/eligibility.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const ORIGIN = 'https://binrat.example';
const NOW = 1_800_000_000_000;
const OWNER = privateKeyToAccount(('0x' + '11'.repeat(32)) as Hex);
const OTHER = privateKeyToAccount(('0x' + '22'.repeat(32)) as Hex);

async function openDb() {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  return db;
}
function env(db: D1CompatDatabase, enabled = 'true'): BinratWorkerEnv {
  return { DB: db, BINRAT_PONS_CANDIDATE_ROUTES_ENABLED: enabled };
}
function deps(now: () => number): WorkerDeps {
  return { externalFetch: fetch, now, ponsCandidateTestRoutes: true };
}
function post(path: string, data: object, ip = '192.0.2.3', origin = ORIGIN): Request {
  return new Request(ORIGIN + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', origin,
      'cf-connecting-ip': ip
    },
    body: JSON.stringify(data)
  });
}
function get(path: string, token?: string, origin?: string): Request {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = 'Bearer ' + token;
  if (origin) headers.origin = origin;
  return new Request(ORIGIN + path, { method: 'GET', headers });
}
async function challenge(
  db: D1CompatDatabase, now: () => number, wallet = OWNER.address, ip = '192.0.2.3'
) {
  return handleWorkerRequest(
    post('/api/pons-candidate/challenge', { wallet }, ip),
    env(db), deps(now)
  );
}

test('default Worker cannot expose Pons routes even when env flag is accidentally true', async () => {
  const db = await openDb();
  try {
    const request = post('/api/pons-candidate/challenge', { wallet: OWNER.address });
    const normal = await handleWorkerRequest(request, env(db), {
      externalFetch: fetch, now: () => NOW
    });
    assert.equal(normal.status, 404);
    assert.deepEqual(await normal.json(), { error: 'NOT_FOUND' });
    const disabled = await handleWorkerRequest(
      post('/api/pons-candidate/challenge', { wallet: OWNER.address }),
      env(db, 'false'), deps(() => NOW)
    );
    assert.equal(disabled.status, 404);
    const unset = await handleWorkerRequest(
      post('/api/pons-candidate/challenge', { wallet: OWNER.address }),
      { DB: db }, deps(() => NOW)
    );
    assert.equal(unset.status, 404);
    const stored = await db.prepare(
      'SELECT COUNT(*) as n FROM pons_candidate_auth_challenges'
    ).first<{ n: number }>();
    assert.equal(stored?.n, 0);
  } finally { db.close(); }
});

test('test-only Robinhood challenge -> SIWE proof -> FREE-only introspection is complete', async () => {
  const db = await openDb();
  let clock = NOW;
  try {
    const issued = await challenge(db, () => clock);
    assert.equal(issued.status, 201);
    assert.equal(issued.headers.get('cache-control'), 'no-store');
    const c = await issued.json() as {
      nonce: string; message: string; chainId: number; policyId: string;
      productionHolderEligibilityActive: boolean; transactionSigning: boolean;
    };
    assert.equal(c.chainId, 4663);
    assert.equal(c.policyId, 'binrat.pons-candidate/v1');
    assert.equal(c.transactionSigning, false);
    assert.equal(c.productionHolderEligibilityActive, false);
    const sig = await OWNER.signMessage({ message: c.message });
    clock += 1;
    const proof = await handleWorkerRequest(
      post('/api/pons-candidate/session', {
        nonce: c.nonce, message: c.message, signature: sig
      }),
      env(db), deps(() => clock)
    );
    assert.equal(proof.status, 201);
    const session = await proof.json() as {
      token: string; chainId: number; accessTier: string;
      holderAccessGranted: boolean; productionHolderEligibilityActive: boolean;
      expiresAtMs: number;
    };
    assert.equal(session.chainId, 4663);
    assert.equal(session.accessTier, 'FREE');
    assert.equal(session.holderAccessGranted, false);
    assert.equal(session.productionHolderEligibilityActive, false);
    assert.equal((await new D1HolderAuthStore(db).getSession(session.token, clock)), null);

    const me = await handleWorkerRequest(
      get('/api/pons-candidate/me', session.token), env(db), deps(() => clock)
    );
    assert.equal(me.status, 200);
    const profile = await me.json() as {
      accessTier: string; chainId: number; policyId: string;
      holderAccessGranted: boolean; wallet: string;
    };
    assert.deepEqual({
      tier: profile.accessTier, chain: profile.chainId,
      granted: profile.holderAccessGranted, wallet: profile.wallet
    }, {
      tier: 'FREE', chain: 4663, granted: false, wallet: OWNER.address.toLowerCase()
    });
    const reuse = await handleWorkerRequest(
      post('/api/pons-candidate/session', {
        nonce: c.nonce, message: c.message, signature: sig
      }), env(db), deps(() => clock)
    );
    assert.equal(reuse.status, 401);
    clock = session.expiresAtMs;
    const expired = await handleWorkerRequest(
      get('/api/pons-candidate/me', session.token), env(db), deps(() => clock)
    );
    assert.equal(expired.status, 401);
  } finally { db.close(); }
});

test('Arc HOLDER token and Pons FREE candidate token cannot cross-authenticate', async () => {
  const db = await openDb();
  try {
    const arc = new D1HolderAuthStore(db);
    const c = await createHolderChallenge(arc, {
      wallet: OWNER.address, origin: ORIGIN, nowMs: NOW
    });
    const signature = await OWNER.signMessage({ message: c.message });
    const arcProof = await proveHolderWallet(
      arc,
      new FixtureHolderEligibilitySource({ [OWNER.address]: 10n }, 10n),
      { nonce: c.nonce, message: c.message, signature, origin: ORIGIN, nowMs: NOW + 1 }
    );
    assert.equal(arcProof.session.accessTier, 'HOLDER');
    const wrong = await handleWorkerRequest(
      get('/api/pons-candidate/me', arcProof.token), env(db), deps(() => NOW + 2)
    );
    assert.equal(wrong.status, 401);
    const pons = new D1PonsCandidateAuthStore(db);
    assert.equal(await pons.getSession(arcProof.token, NOW + 2, ORIGIN), null);
  } finally { db.close(); }
});

test('invalid origin and unsupported methods are rejected before DB writes', async () => {
  const db = await openDb();
  try {
    const mismatch = await handleWorkerRequest(
      post('/api/pons-candidate/challenge', {
        wallet: OWNER.address
      }, '192.0.2.8', 'https://impostor.example'),
      env(db), deps(() => NOW)
    );
    assert.equal(mismatch.status, 403);
    const options = await handleWorkerRequest(
      new Request(ORIGIN + '/api/pons-candidate/challenge', { method: 'OPTIONS' }),
      env(db), deps(() => NOW)
    );
    assert.equal(options.status, 405);
    assert.equal(options.headers.get('access-control-allow-origin'), null);
    const badType = await handleWorkerRequest(
      new Request(ORIGIN + '/api/pons-candidate/challenge', {
        method: 'POST', headers: {
          origin: ORIGIN, 'content-type': 'text/plain',
          'cf-connecting-ip': '192.0.2.8'
        }, body: '{}'
      }), env(db), deps(() => NOW)
    );
    assert.equal(badType.status, 415);
    const stored = await db.prepare(
      'SELECT COUNT(*) as n FROM pons_candidate_auth_challenges'
    ).first<{ n: number }>();
    assert.equal(stored?.n, 0);
  } finally { db.close(); }
});

test('IP and wallet challenge limits persist in D1 and reset at next minute', async () => {
  const db = await openDb();
  let now = NOW;
  try {
    const run = (wallet: Hex, ip: string) => challenge(db, () => now, wallet, ip);
    for (let i = 0; i < 6; i += 1) {
      const wallet = ('0x' + (1000 + i).toString(16).padStart(40, '0')) as Hex;
      assert.equal((await run(wallet, '192.0.2.42')).status, 201);
    }
    assert.equal((await run(OTHER.address, '192.0.2.42')).status, 429);
    for (let i = 0; i < 3; i += 1) {
      assert.equal((await run(OWNER.address, '192.0.2.' + (50 + i))).status, 201);
    }
    assert.equal((await run(OWNER.address, '192.0.2.60')).status, 429);
    now += 60_001;
    assert.equal((await run(OWNER.address, '192.0.2.60')).status, 201);
  } finally { db.close(); }
});

test('invalid signer and expired nonce do not mint a candidate session', async () => {
  const db = await openDb();
  try {
    const response = await challenge(db, () => NOW);
    const c = await response.json() as { nonce: string; message: string };
    const wrong = await handleWorkerRequest(
      post('/api/pons-candidate/session', {
        nonce: c.nonce, message: c.message,
        signature: await OTHER.signMessage({ message: c.message })
      }), env(db), deps(() => NOW + 1)
    );
    assert.equal(wrong.status, 401);
    const expired = await handleWorkerRequest(
      post('/api/pons-candidate/session', {
        nonce: c.nonce, message: c.message,
        signature: await OWNER.signMessage({ message: c.message })
      }), env(db), deps(() => NOW + 300_000)
    );
    assert.equal(expired.status, 401);
    const saved = await db.prepare(
      'SELECT COUNT(*) AS n FROM pons_candidate_auth_sessions'
    ).first<{ n: number }>();
    assert.equal(saved?.n, 0);
  } finally { db.close(); }
});

test('missing candidate rate migration returns 503 without writing authentication data', async () => {
  const db = await openDb();
  try {
    await db.exec('DROP TABLE pons_candidate_route_limits');
    const result = await challenge(db, () => NOW);
    assert.equal(result.status, 503);
    const saved = await db.prepare(
      'SELECT COUNT(*) AS n FROM pons_candidate_auth_challenges'
    ).first<{ n: number }>();
    assert.equal(saved?.n, 0);
  } finally { db.close(); }
});
