import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { parseSiweMessage } from 'viem/siwe';
import { D1_SCHEMA_SQL } from '../src/cloudflare/d1Schema.js';
import {
  D1HolderAuthStore, createHolderChallenge, proveHolderWallet
} from '../src/cloudflare/holderAuth.js';
import {
  D1PonsCandidateAuthStore, PONS_AUTH_POLICY, PONS_AUTH_PURPOSE,
  PONS_CHALLENGE_TTL_MS, PONS_SESSION_TTL_MS,
  createPonsChallenge, provePonsWallet
} from '../src/cloudflare/ponsCandidateAuth.js';
import { FixtureHolderEligibilitySource } from '../src/holder/eligibility.js';
import { D1CompatDatabase } from './support/d1Compat.js';

const OWNER=privateKeyToAccount(('0x'+'11'.repeat(32)) as Hex);
const OTHER=privateKeyToAccount(('0x'+'22'.repeat(32)) as Hex);
const ORIGIN='https://binrat.example';
const NOW=1_800_000_000_000;
async function openDb():Promise<D1CompatDatabase> {
  const db=new D1CompatDatabase();
  await db.exec(D1_SCHEMA_SQL);
  return db;
}

test('Pons SIWE binds chain, purpose, resource, origin and issues FREE candidate only',async()=>{
  const db=await openDb();
  try {
    const store=new D1PonsCandidateAuthStore(db);
    const c=await createPonsChallenge(store,{wallet:OWNER.address,origin:ORIGIN,nowMs:NOW});
    const msg=parseSiweMessage(c.message);
    assert.equal(msg.chainId,4663);
    assert.equal(msg.requestId,PONS_AUTH_PURPOSE);
    assert.equal(msg.uri,ORIGIN+'/api/pons-candidate/session');
    assert.deepEqual(msg.resources,[ORIGIN+'/api/rat-radar/watchlist?depth=full']);
    assert.equal(c.policyId,PONS_AUTH_POLICY);
    const signed=await OWNER.signMessage({message:c.message});
    const issued=await provePonsWallet(store,{
      nonce:c.nonce,message:c.message,signature:signed,origin:ORIGIN,nowMs:NOW+1
    });
    assert.equal(issued.session.chainId,4663);
    assert.equal(issued.session.accessTier,'FREE');
    assert.equal(issued.session.expiresAtMs-issued.session.issuedAtMs,PONS_SESSION_TTL_MS);
    assert.equal((await store.getSession(issued.token,NOW+2,ORIGIN))?.wallet,OWNER.address.toLowerCase());
    assert.equal(await store.getSession(issued.token,NOW+2,'https://other.example'),null);
    assert.equal(await store.getSession(issued.token,NOW+2,ORIGIN,'binrat.pons-candidate/v2'),null);
    assert.equal(await store.getSession(issued.token,issued.session.expiresAtMs,ORIGIN),null);
    const saved=await db.prepare(
      'SELECT session_hash,chain_id,access_tier FROM pons_candidate_auth_sessions LIMIT 1'
    ).first<{session_hash:string;chain_id:number;access_tier:string}>();
    assert.ok(saved);
    assert.notEqual(saved.session_hash,issued.token);
    assert.equal(saved.chain_id,4663);
    assert.equal(saved.access_tier,'FREE');
    assert.equal(await new D1HolderAuthStore(db).getSession(issued.token,NOW+2),null);
  } finally {db.close();}
});

test('existing Arc 5042 HOLDER session cannot be used in Pons realm',async()=>{
  const db=await openDb();
  try {
    const old=new D1HolderAuthStore(db);
    const pons=new D1PonsCandidateAuthStore(db);
    const arc=await createHolderChallenge(old,{wallet:OWNER.address,origin:ORIGIN,nowMs:NOW});
    assert.equal(parseSiweMessage(arc.message).chainId,5042);
    const sig=await OWNER.signMessage({message:arc.message});
    const proof=await proveHolderWallet(old,new FixtureHolderEligibilitySource({
      [OWNER.address]:10n
    },10n),{
      nonce:arc.nonce,message:arc.message,signature:sig,origin:ORIGIN,nowMs:NOW+1
    });
    assert.equal(proof.session.accessTier,'HOLDER');
    assert.equal(await pons.getSession(proof.token,NOW+2,ORIGIN),null);
    await assert.rejects(provePonsWallet(pons,{
      nonce:arc.nonce,message:arc.message,signature:sig,origin:ORIGIN,nowMs:NOW+2
    }),/PONS_AUTH_CHALLENGE_USED_OR_UNKNOWN/);
  } finally {db.close();}
});

test('wrong origin, altered payload, wrong signer and replay are rejected',async()=>{
  const db=await openDb();
  try {
    const store=new D1PonsCandidateAuthStore(db);
    const c=await createPonsChallenge(store,{wallet:OWNER.address,origin:ORIGIN,nowMs:NOW});
    const sig=await OWNER.signMessage({message:c.message});
    const proof={nonce:c.nonce,message:c.message,signature:sig,origin:ORIGIN,nowMs:NOW+1};
    await assert.rejects(provePonsWallet(store,{
      ...proof,origin:'https://binrat.example.evil'
    }),/PONS_AUTH_CHALLENGE_AUTHORITY_INVALID/);
    await assert.rejects(provePonsWallet(store,{
      ...proof,message:c.message+' altered'
    }),/PONS_AUTH_CHALLENGE_TAMPERED/);
    await assert.rejects(provePonsWallet(store,{
      ...proof,signature:await OTHER.signMessage({message:c.message})
    }),/PONS_AUTH_SIGNATURE_WALLET_MISMATCH/);
    await provePonsWallet(store,proof);
    await assert.rejects(provePonsWallet(store,proof),/PONS_AUTH_CHALLENGE_USED_OR_UNKNOWN/);
  } finally {db.close();}
});

test('concurrent nonce use succeeds at most once',async()=>{
  const db=await openDb();
  try {
    const store=new D1PonsCandidateAuthStore(db);
    const c=await createPonsChallenge(store,{wallet:OWNER.address,origin:ORIGIN,nowMs:NOW});
    const sig=await OWNER.signMessage({message:c.message});
    const input={nonce:c.nonce,message:c.message,signature:sig,origin:ORIGIN,nowMs:NOW+1};
    const outcomes=await Promise.allSettled([
      provePonsWallet(store,input),provePonsWallet(store,input)
    ]);
    assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(outcomes.filter(x=>x.status==='rejected').length,1);
  } finally {db.close();}
});

test('exact expiry, malformed origin/clock and zero wallet are rejected',async()=>{
  const db=await openDb();
  try {
    const store=new D1PonsCandidateAuthStore(db);
    const c=await createPonsChallenge(store,{wallet:OWNER.address,origin:ORIGIN,nowMs:NOW});
    const sig=await OWNER.signMessage({message:c.message});
    await assert.rejects(provePonsWallet(store,{
      nonce:c.nonce,message:c.message,signature:sig,origin:ORIGIN,
      nowMs:NOW+PONS_CHALLENGE_TTL_MS
    }),/PONS_AUTH_CHALLENGE_EXPIRED/);
    await assert.rejects(createPonsChallenge(store,{
      wallet:OWNER.address,origin:'http://not-local.example',nowMs:NOW
    }),/PONS_AUTH_ORIGIN_INVALID/);
    await assert.rejects(createPonsChallenge(store,{
      wallet:'0x0000000000000000000000000000000000000000',origin:ORIGIN,nowMs:NOW
    }),/PONS_AUTH_WALLET_INVALID/);
    await assert.rejects(createPonsChallenge(store,{
      wallet:OWNER.address,origin:ORIGIN,nowMs:Number.NaN
    }),/PONS_AUTH_TIME_INVALID/);
    assert.equal(await store.getSession('malformed',NOW,ORIGIN),null);
  } finally {db.close();}
});

test('D1 CHECK refuses chain 5042 rows and HOLDER tier in candidate realm',async()=>{
  const db=await openDb();
  try {
    const store=new D1PonsCandidateAuthStore(db);
    const c=await createPonsChallenge(store,{wallet:OWNER.address,origin:ORIGIN,nowMs:NOW});
    await assert.rejects(db.prepare(
      'UPDATE pons_candidate_auth_challenges SET chain_id=5042 WHERE nonce=?'
    ).bind(c.nonce).run());
    const sig=await OWNER.signMessage({message:c.message});
    const issued=await provePonsWallet(store,{
      nonce:c.nonce,message:c.message,signature:sig,origin:ORIGIN,nowMs:NOW+1
    });
    await assert.rejects(store.saveSession('b'.repeat(64),{
      ...issued.session,accessTier:'HOLDER' as 'FREE'
    }),/PONS_AUTH_SESSION_AUTHORITY_INVALID/);
    const saved=await db.prepare('SELECT session_hash FROM pons_candidate_auth_sessions LIMIT 1')
      .first<{session_hash:string}>();
    assert.ok(saved);
    await assert.rejects(db.prepare(
      'UPDATE pons_candidate_auth_sessions SET access_tier=? WHERE session_hash=?'
    ).bind('HOLDER',saved.session_hash).run());
    assert.equal((await store.getSession(issued.token,NOW+2,ORIGIN))?.accessTier,'FREE');
  } finally {db.close();}
});

test('additive standalone migration repeats safely; old Arc sessions retain semantics',async()=>{
  const db=await openDb();
  try {
    const old=new D1HolderAuthStore(db);
    const c=await createHolderChallenge(old,{wallet:OWNER.address,origin:ORIGIN,nowMs:NOW});
    const sig=await OWNER.signMessage({message:c.message});
    const issued=await proveHolderWallet(old,new FixtureHolderEligibilitySource({
      [OWNER.address]:10n
    },10n),{
      nonce:c.nonce,message:c.message,signature:sig,origin:ORIGIN,nowMs:NOW+1
    });
    const migration=await readFile(
      new URL('../migrations/20260924_pons_candidate_auth_v1.sql',import.meta.url),'utf8'
    );
    await db.exec(migration);
    await db.exec(migration);
    assert.equal((await old.getSession(issued.token,NOW+2))?.accessTier,'HOLDER');
    assert.equal(await new D1PonsCandidateAuthStore(db).getSession(issued.token,NOW+2,ORIGIN),null);
  } finally {db.close();}
});
