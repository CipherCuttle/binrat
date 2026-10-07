import { mkdir, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { keccak256, parseTransaction, recoverTransactionAddress, type Hex, type PublicClient } from 'viem';
import { canonicalJson } from '../evidence/canonical.js';
import { requireCondition, seal, type PonsLaunchManifest } from './ponsLaunchManifest.js';
import { cloneArmInputs, preSendRevalidation, validateExecutionEnvelope, type ArmInputs, type ArmReceipt, type FinalExecutionEnvelope } from './ponsExecutionEnvelope.js';
import { preSendExactCall } from './ponsLaunchRehearsal.js';
import type { AuthoritySnapshot } from './ponsFreshAuthority.js';

export async function verifySignedEnvelope(m: PonsLaunchManifest, e: FinalExecutionEnvelope, signed: Hex): Promise<Hex> {
  [m,e]=structuredClone([m,e]);
  await validateExecutionEnvelope(m,e,e.createdAtMs);
  const tx = parseTransaction(signed);
  requireCondition(tx.type === 'eip1559' && tx.chainId === e.chainId && tx.nonce === Number(e.nonce) && tx.to?.toLowerCase() === e.to.toLowerCase() && tx.data === e.calldata && tx.value === BigInt(e.valueWei) && tx.gas === BigInt(e.gasLimit) && tx.maxFeePerGas === BigInt(e.maxFeePerGasWei) && tx.maxPriorityFeePerGas === BigInt(e.maxPriorityFeePerGasWei) && (!tx.accessList || tx.accessList.length === 0), 'SIGNED_ENVELOPE_MISMATCH');
  requireCondition(signed.startsWith('0x02') && (await recoverTransactionAddress({serializedTransaction:signed as `0x02${string}`})).toLowerCase() === m.wallet.address.toLowerCase(), 'SIGNED_WALLET_MISMATCH');
  return keccak256(signed);
}
export interface SendJournalRecord {
  schemaVersion: 'binrat.pons-send-journal/1'; state: 'SEND_INTENT' | 'BROADCAST' | 'RECONCILE';
  chainId: 4663; from: string; nonce: string; manifestDigest: string; envelopeDigest: string; armDigest: string;
  signedTransaction: Hex; localSignedTxHash: Hex; signedEnvelopeDigest:string; sendInvocationLimit: 1; persistedAtMs: number;
}
export interface SignedEnvelopeAttachment {schemaVersion:'binrat.pons-signed-envelope/1';manifestDigest:string;envelopeDigest:string;localSignedTxHash:Hex;signedTransaction:Hex;digest:string}
/** Attach an already signed transaction to its authorized envelope; this never signs. */
export async function bindSignedEnvelope(m:PonsLaunchManifest,e:FinalExecutionEnvelope,signed:Hex):Promise<SignedEnvelopeAttachment> {
  [m,e]=structuredClone([m,e]);
  const localSignedTxHash=await verifySignedEnvelope(m,e,signed);
  return seal({schemaVersion:'binrat.pons-signed-envelope/1' as const,manifestDigest:m.digest,envelopeDigest:e.digest,localSignedTxHash,signedTransaction:signed});
}
export interface SingleSendTransport { retryCount:0; sendRaw:(bytes:Hex)=>Promise<Hex> }
/** One HTTP invocation, no redirects or transport retries; never installed by the read-only CLI. */
export function singleSendHttpTransport(url:string,timeoutMs:number,fetcher:typeof fetch=fetch):SingleSendTransport {
  requireCondition(new URL(url).protocol === 'https:' && Number.isSafeInteger(timeoutMs) && timeoutMs > 0,'SEND_TRANSPORT_POLICY_INVALID');
  let used=false;
  return {retryCount:0,sendRaw:async(bytes)=>{
    requireCondition(!used,'SEND_TRANSPORT_ALREADY_USED'); used=true;
    const response=await fetcher(url,{method:'POST',redirect:'error',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_sendRawTransaction',params:[bytes]}),signal:AbortSignal.timeout(timeoutMs)});
    requireCondition(response.ok,'SEND_RPC_UNCERTAIN');
    const result=await response.json() as {result?:Hex;error?:unknown};
    requireCondition(!result.error && typeof result.result === 'string' && /^0x[a-fA-F0-9]{64}$/.test(result.result),'SEND_RPC_UNCERTAIN');
    return result.result;
  }};
}
export class PonsLaunchJournal {
  constructor(private readonly directory: string,private readonly clock:()=>number=Date.now) {}
  private path(e: FinalExecutionEnvelope) { return join(this.directory,`${e.chainId}-${e.from.toLowerCase()}-${e.nonce}.json`); }
  async read(e: FinalExecutionEnvelope): Promise<SendJournalRecord | null> {
    try { return JSON.parse(await readFile(this.path(e),'utf8')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }
  async sendOnce(input: {
    authority: ArmInputs; armed: ArmReceipt; signedTransaction: Hex;
    /** Must collect immediate fresh reads; it must not return a cached armed snapshot. */
    revalidate: () => Promise<{snapshot: AuthoritySnapshot; nowMs: number; headNumber: bigint}>;
    transport:SingleSendTransport;
    client:PublicClient;
  }): Promise<{state:'BROADCAST' | 'RECONCILE'; transactionHash:Hex}> {
    const authority=cloneArmInputs(input.authority),armed=structuredClone(input.armed),signedBytes=input.signedTransaction;
    const revalidate=input.revalidate,sendRaw=input.transport.sendRaw.bind(input.transport),client=input.client;
    const {manifest:m,envelope:e} = authority;
    requireCondition(input.transport.retryCount === 0,'SEND_TRANSPORT_RETRIES_FORBIDDEN');
    const signedEnvelope=await bindSignedEnvelope(m,e,signedBytes),transactionHash=signedEnvelope.localSignedTxHash;
    const fresh = structuredClone(await revalidate());
    await preSendRevalidation(authority,armed,fresh.snapshot,this.clock(),fresh.headNumber);
    requireCondition(fresh.snapshot.observedAtMs >= armed.armedAtMs, 'PRE_SEND_READ_NOT_IMMEDIATE');
    await mkdir(this.directory,{recursive:true,mode:0o700});
    // Exclusive creation is the cross-process nonce lock. Never clear/retry it automatically.
    const handle = await open(this.path(e),'wx',0o600);
    const record: SendJournalRecord = {schemaVersion:'binrat.pons-send-journal/1',state:'SEND_INTENT',chainId:4663,from:e.from,nonce:e.nonce,manifestDigest:m.digest,envelopeDigest:e.digest,armDigest:armed.digest,signedTransaction:signedBytes,localSignedTxHash:transactionHash,signedEnvelopeDigest:signedEnvelope.digest,sendInvocationLimit:1,persistedAtMs:this.clock()};
    try { await handle.writeFile(canonicalJson(record)); await handle.sync(); }
    finally { await handle.close(); }
    // fsync the directory too: a crash must not lose the exclusive send-intent filename.
    const directory = await open(this.directory,'r');
    try { await directory.sync(); } finally { await directory.close(); }
    // Re-read after durable persistence, immediately before the network invocation.
    const startedAt=this.clock(), finalRead=structuredClone(await revalidate());
    requireCondition(finalRead.snapshot.observedAtMs >= startedAt,'PRE_SEND_READ_NOT_IMMEDIATE');
    await preSendRevalidation(authority,armed,finalRead.snapshot,this.clock(),finalRead.headNumber);
    await preSendExactCall(client,m,e,finalRead.snapshot);
    const [nonce,pendingNonce,balance,code]=await Promise.all([client.getTransactionCount({address:e.from,blockTag:'latest'}),client.getTransactionCount({address:e.from,blockTag:'pending'}),client.getBalance({address:e.from,blockTag:'latest'}),client.getCode({address:e.from,blockTag:'latest'})]);
    requireCondition(String(nonce) === e.nonce && String(pendingNonce) === e.nonce,'ARMED_WALLET_NONCE_DRIFT_ABORT');
    requireCondition(balance >= BigInt(e.valueWei)+BigInt(e.approvedFeeCeilingWei) && code !== undefined && keccak256(code) === m.wallet.codeHash,'ARMED_WALLET_FUNDS_OR_CODE_ABORT');
    const sendAt=this.clock();
    requireCondition(sendAt < e.expiresAtMs && sendAt < armed.expiresAtMs && sendAt-finalRead.snapshot.observedAtMs <= authority.budget.maxAgeMs,'PRE_SEND_EXPIRED_OR_STALE_ABORT');
    try {
      // A transport MUST have automatic retries disabled. This module invokes it exactly once.
      const returned = await sendRaw(signedBytes);
      requireCondition(returned.toLowerCase() === transactionHash.toLowerCase(), 'SEND_RETURN_HASH_MISMATCH');
      return {state:'BROADCAST',transactionHash};
    } catch { return {state:'RECONCILE',transactionHash}; }
  }
  async reconcile(e: FinalExecutionEnvelope, lookup: (hash: Hex) => Promise<{state:'PENDING' | 'CONFIRMED' | 'NOT_FOUND' | 'REORGED'; envelopeMatches:boolean}>): Promise<{state:'RECONCILE' | 'CONFIRMED'; transactionHash:Hex}> {
    const record = await this.read(e);
    requireCondition(record && record.schemaVersion === 'binrat.pons-send-journal/1' && record.envelopeDigest === e.digest && record.manifestDigest === e.manifestDigest && record.nonce === e.nonce && record.from === e.from && record.sendInvocationLimit === 1 && keccak256(record.signedTransaction) === record.localSignedTxHash, 'RECONCILE_JOURNAL_INVALID');
    const observed = await lookup(record.localSignedTxHash);
    return {state:observed.state === 'CONFIRMED' && observed.envelopeMatches ? 'CONFIRMED' : 'RECONCILE',transactionHash:record.localSignedTxHash};
  }
}
