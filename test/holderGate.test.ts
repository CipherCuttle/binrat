import assert from 'node:assert/strict';
import test from 'node:test';
import { privateKeyToAccount } from 'viem/accounts';
import { ARC_CHAIN_ID } from '../src/arc/chain.js';
import {
  D1HolderAuthStore,
  HOLDER_CHALLENGE_TTL_MS,
  HOLDER_SESSION_TTL_MS,
  createHolderChallenge,
  proveHolderWallet
} from '../src/cloudflare/holderAuth.js';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import { D1RatRadarStore } from '../src/cloudflare/ratRadarStore.js';
import { D1RuntimeStateStore } from '../src/cloudflare/runtimeState.js';
import { D1Store } from '../src/cloudflare/d1Store.js';
import { handleWorkerRequest, type BinratWorkerEnv, type WorkerDeps } from '../src/cloudflare/worker.js';
import { deriveEventId, deriveLaunchId } from '../src/core/identity.js';
import type { Hex, LaunchObserved } from '../src/core/types.js';
import {
  FixtureHolderEligibilitySource,
  ProductionHolderEligibilitySource
} from '../src/holder/eligibility.js';
import { buildProvenanceFact } from '../src/intelligence/provenance.js';
import { deriveRatRadarSwapReceipt } from '../src/ratRadar/activity.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const HOLDER = privateKeyToAccount(`0x${'11'.repeat(32)}`);
const OTHER = privateKeyToAccount(`0x${'22'.repeat(32)}`);
const ORIGIN = 'https://binrat.example';

test('holder eligibility fixtures are explicit and production configuration always fails closed', async () => {
  const fixture = new FixtureHolderEligibilitySource(
    { [HOLDER.address]: 1_000n },
    500n
  );
  assert.equal((await fixture.evaluate(HOLDER.address)).accessTier, 'HOLDER');
  assert.equal((await fixture.evaluate(OTHER.address)).accessTier, 'FREE');

  const absent = await new ProductionHolderEligibilitySource({}).evaluate(HOLDER.address);
  assert.equal(absent.accessTier, 'FREE');
  assert.equal(absent.status, 'TOKEN_AUTHORITY_NOT_CONFIGURED');

  const malformed = await new ProductionHolderEligibilitySource({
    BINRAT_HOLDER_GATE_ENABLED: 'true',
    BINRAT_HOLDER_TOKEN_ADDRESS: 'not-an-address',
    BINRAT_HOLDER_THRESHOLD: 'TEST'
  }).evaluate(HOLDER.address);
  assert.equal(malformed.accessTier, 'FREE');
  assert.equal(malformed.status, 'TOKEN_AUTHORITY_INVALID');

  const configuredButUnavailable = await new ProductionHolderEligibilitySource({
    BINRAT_HOLDER_GATE_ENABLED: 'true',
    BINRAT_HOLDER_TOKEN_ADDRESS: address(900),
    BINRAT_HOLDER_THRESHOLD: '1000000'
  }).evaluate(HOLDER.address);
  assert.equal(configuredButUnavailable.accessTier, 'FREE');
  assert.equal(configuredButUnavailable.status, 'TOKEN_BALANCE_SOURCE_NOT_IMPLEMENTED');
});

test('SIWE holder proof rejects tampering, impersonation, replay, cross-domain use and expiry', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  const store = new D1HolderAuthStore(db);
  const eligibility = new FixtureHolderEligibilitySource({ [HOLDER.address]: 10n }, 10n);
  const nowMs = 1_800_000_000_000;
  try {
    const first = await createHolderChallenge(store, {
      wallet: HOLDER.address,
      origin: ORIGIN,
      nowMs
    });
    const second = await createHolderChallenge(store, {
      wallet: HOLDER.address,
      origin: ORIGIN,
      nowMs
    });
    assert.notEqual(first.nonce, second.nonce);
    assert.match(first.message, /BINRAT Holder Gate V0 access/);
    assert.match(first.message, /Chain ID: 5042/);

    const validSignature = await HOLDER.signMessage({ message: first.message });
    await assert.rejects(
      proveHolderWallet(store, eligibility, {
        nonce: first.nonce,
        message: `${first.message} modified`,
        signature: validSignature,
        origin: ORIGIN,
        nowMs: nowMs + 1
      }),
      /HOLDER_CHALLENGE_TAMPERED/
    );

    const wrongSignature = await OTHER.signMessage({ message: first.message });
    await assert.rejects(
      proveHolderWallet(store, eligibility, {
        nonce: first.nonce,
        message: first.message,
        signature: wrongSignature,
        origin: ORIGIN,
        nowMs: nowMs + 2
      }),
      /HOLDER_SIGNATURE_WALLET_MISMATCH/
    );

    await assert.rejects(
      proveHolderWallet(store, eligibility, {
        nonce: first.nonce,
        message: first.message,
        signature: validSignature,
        origin: 'https://attacker.example',
        nowMs: nowMs + 3
      }),
      /HOLDER_CHALLENGE_AUTHORITY_INVALID/
    );

    const issued = await proveHolderWallet(store, eligibility, {
      nonce: first.nonce,
      message: first.message,
      signature: validSignature,
      origin: ORIGIN,
      nowMs: nowMs + 4
    });
    assert.equal(issued.session.wallet, HOLDER.address.toLowerCase());
    assert.equal(issued.session.accessTier, 'HOLDER');
    assert.equal((await store.getSession(issued.token, issued.session.expiresAtMs - 1))?.accessTier, 'HOLDER');
    assert.equal(await store.getSession(issued.token, issued.session.expiresAtMs), null);
    assert.equal(issued.session.expiresAtMs - issued.session.issuedAtMs, HOLDER_SESSION_TTL_MS);

    await assert.rejects(
      proveHolderWallet(store, eligibility, {
        nonce: first.nonce,
        message: first.message,
        signature: validSignature,
        origin: ORIGIN,
        nowMs: nowMs + 5
      }),
      /HOLDER_CHALLENGE_USED_OR_UNKNOWN/
    );

    const expiredSignature = await HOLDER.signMessage({ message: second.message });
    await assert.rejects(
      proveHolderWallet(store, eligibility, {
        nonce: second.nonce,
        message: second.message,
        signature: expiredSignature,
        origin: ORIGIN,
        nowMs: nowMs + HOLDER_CHALLENGE_TTL_MS
      }),
      /HOLDER_CHALLENGE_EXPIRED/
    );

    const storedChallenge = await db.prepare(
      'SELECT * FROM holder_auth_challenges WHERE nonce = ?'
    ).bind(first.nonce).first<Record<string, unknown>>();
    assert.ok(storedChallenge);
    assert.equal('signature' in storedChallenge, false);
    const storedSession = await db.prepare(
      'SELECT session_hash FROM holder_auth_sessions LIMIT 1'
    ).first<{ session_hash: string }>();
    assert.ok(storedSession);
    assert.notEqual(storedSession.session_hash, issued.token);
  } finally {
    db.close();
  }
});

test('historical Arc public depth routes stay retired for free, forged and holder sessions',async()=>{
  const db=new D1CompatDatabase();await db.exec(D1_SCHEMA_SQL);
  try {
    const env={DB:db};
    for(const headers of [{} as Record<string,string>,{authorization:`Bearer ${'a'.repeat(64)}`}]) {
      const response=await handleWorkerRequest(new Request(`${ORIGIN}/api/rat-radar/watchlist?depth=full`,{headers}),env);
      assert.equal(response.status,410);assert.equal((await response.json() as any).error,'LEGACY_ARC_RADAR_RETIRED');
    }
  } finally {db.close();}
});

test('production wallet-auth write surface is disabled unless explicitly enabled', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  try {
    const response = await handleWorkerRequest(
      jsonRequest(`${ORIGIN}/api/holder/challenge`, { wallet: HOLDER.address }),
      { DB: db },
      { externalFetch: fetch, now: Date.now }
    );
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'HOLDER_WALLET_AUTH_NOT_ENABLED' });
    const count = await db.prepare(
      'SELECT COUNT(*) AS count FROM holder_auth_challenges'
    ).first<{ count: number }>();
    assert.equal(count?.count, 0);
  } finally {
    db.close();
  }
});

test('enabled wallet auth with absent production token authority still issues FREE only', async () => {
  const db = new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  try {
    const env: BinratWorkerEnv = {
      DB: db,
      BINRAT_HOLDER_WALLET_AUTH_ENABLED: 'true'
    };
    const deps: WorkerDeps = { externalFetch: fetch, now: Date.now };
    const session = await createWorkerSession(HOLDER, env, deps);
    assert.equal(session.accessTier, 'FREE');
    assert.equal(session.eligibilityStatus, 'TOKEN_AUTHORITY_NOT_CONFIGURED');
  } finally {
    db.close();
  }
});

async function createWorkerSession(
  account: typeof HOLDER,
  env: BinratWorkerEnv,
  deps: WorkerDeps
): Promise<{ token: string; accessTier: string; eligibilityStatus: string; expiresAtMs: number }> {
  const challengeResponse = await handleWorkerRequest(
    jsonRequest(`${ORIGIN}/api/holder/challenge`, { wallet: account.address }),
    env,
    deps
  );
  assert.equal(challengeResponse.status, 201);
  const challenge = await challengeResponse.json() as { nonce: string; message: string };
  const signature = await account.signMessage({ message: challenge.message });
  const sessionResponse = await handleWorkerRequest(
    jsonRequest(`${ORIGIN}/api/holder/session`, {
      nonce: challenge.nonce,
      message: challenge.message,
      signature
    }),
    env,
    deps
  );
  assert.equal(sessionResponse.status, 201);
  return sessionResponse.json() as Promise<{
    token: string;
    accessTier: string;
    eligibilityStatus: string;
    expiresAtMs: number;
  }>;
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function commonCandidate(candidate: WatchCandidate) {
  return {
    rank: candidate.rank,
    observedRecipientAddress: candidate.observedRecipientAddress,
    distinctLaunchCount: candidate.distinctLaunchCount,
    acquisitionReceiptCount: candidate.acquisitionReceiptCount,
    medianFirstEntryBlockDelta: candidate.medianFirstEntryBlockDelta,
    earliestFirstEntryBlockDelta: candidate.earliestFirstEntryBlockDelta,
    latestSeenBlock: candidate.latestSeenBlock,
    reasonCodes: candidate.reasonCodes,
    reasons: candidate.reasons
  };
}

async function makeLaunch(blockNumber: bigint, seed: number): Promise<LaunchObserved> {
  const launcher = address(10 + seed);
  const txHash = hex64(20 + seed);
  const token = address(30 + seed);
  return {
    launchId: await deriveLaunchId({ chainId: ARC_CHAIN_ID, launcher, txHash, token }),
    eventId: await deriveEventId({ chainId: ARC_CHAIN_ID, launcher, txHash, logIndex: seed }),
    chainId: ARC_CHAIN_ID,
    blockNumber,
    blockHash: hex64(Number(blockNumber)),
    observedAtMs: Number(blockNumber) * 1_000,
    source: 'ARCPAD',
    launcher,
    txHash,
    logIndex: seed,
    token,
    creator: address(40 + seed),
    pool: address(50 + seed),
    name: `Holder Gate ${seed}`,
    symbol: `HG${seed}`,
    imageUri: '',
    website: '',
    twitter: '',
    telegram: ''
  };
}

async function makeSwap(
  launch: LaunchObserved,
  blockNumber: bigint,
  logIndex: number,
  recipient: Hex
) {
  return deriveRatRadarSwapReceipt({
    chainId: ARC_CHAIN_ID,
    launchId: launch.launchId,
    pool: launch.pool,
    token: launch.token,
    token0: launch.token,
    token1: address(999),
    blockNumber,
    blockHash: hex64(Number(blockNumber)),
    txHash: hex64(Number(blockNumber) * 100 + logIndex),
    logIndex,
    sender: address(600 + logIndex),
    recipient,
    amount0: -100n,
    amount1: 50n,
    sqrtPriceX96: 1_000n,
    liquidity: 2_000n,
    tick: 5
  });
}

function address(seed: number): Hex {
  return `0x${seed.toString(16).padStart(40, '0').slice(-40)}` as Hex;
}

function hex64(seed: number): Hex {
  return `0x${seed.toString(16).padStart(64, '0').slice(-64)}` as Hex;
}

interface WatchCandidate {
  rank: number;
  observedRecipientAddress: string;
  distinctLaunchCount: number;
  acquisitionReceiptCount: number;
  medianFirstEntryBlockDelta: number;
  earliestFirstEntryBlockDelta: number;
  latestSeenBlock: string;
  reasonCodes: string[];
  reasons: string[];
}

interface WatchlistBody {
  candidates: WatchCandidate[];
}

interface HolderWatchlistBody extends WatchlistBody {
  schemaVersion: string;
  access: { accessTier: string; wallet: string };
  candidates: Array<WatchCandidate & {
    publicEvidencePaths: string[];
    totalObservedReceiptCount: number;
  }>;
}
