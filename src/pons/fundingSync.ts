import type { Hex } from '../core/types.js';
import {
  readPonsPrelaunchNativeInbound,
  verifyPonsPrelaunchNativeInboundReceipt,
  type PonsFundingLaunch,
  type PonsFundingSource,
  type PonsPrelaunchNativeInboundReceipt
} from './fundingProvenance.js';

export const PONS_FUNDING_FAILURE_RETRY_MS = 5 * 60_000;

export interface PonsFundingScanStore {
  listCandidates(limit:number, nowMs:number):Promise<PonsFundingLaunch[]>;
  put(receipt:PonsPrelaunchNativeInboundReceipt):Promise<'INSERTED'|'DUPLICATE'>;
  markComplete(
    launch:PonsFundingLaunch,
    state:'FOUND'|'NONE',
    nowMs:number
  ):Promise<void>;
  markFailure(
    launch:PonsFundingLaunch,
    code:string,
    retryAfterMs:number,
    nowMs:number
  ):Promise<void>;
  countRemaining(nowMs:number):Promise<number>;
}

export interface PonsFundingSyncReport {
  attempted:number;
  inserted:number;
  duplicates:number;
  noInbound:number;
  failed:number;
  remaining:number;
}

export async function syncPonsFundingProvenance(
  source:PonsFundingSource,
  store:PonsFundingScanStore,
  options:{limit:number;nowMs:number;failureRetryMs?:number}
):Promise<PonsFundingSyncReport> {
  if (!Number.isSafeInteger(options.limit) || options.limit<1 || options.limit>12) {
    throw new Error('PONS_FUNDING_LIMIT_INVALID');
  }
  if (!Number.isSafeInteger(options.nowMs) || options.nowMs<0) {
    throw new Error('PONS_FUNDING_NOW_INVALID');
  }
  const failureRetryMs=options.failureRetryMs ?? PONS_FUNDING_FAILURE_RETRY_MS;
  if (!Number.isSafeInteger(failureRetryMs) || failureRetryMs<1_000 || failureRetryMs>86_400_000) {
    throw new Error('PONS_FUNDING_RETRY_MS_INVALID');
  }

  const launches=await store.listCandidates(options.limit,options.nowMs);
  if (launches.length===0) {
    return {attempted:0,inserted:0,duplicates:0,noInbound:0,failed:0,remaining:0};
  }

  await source.assertAuthority();

  let inserted=0;
  let duplicates=0;
  let noInbound=0;
  let failed=0;

  for (const launch of launches) {
    try {
      const receipt=await readPonsPrelaunchNativeInbound(source,launch);
      if (!receipt) {
        await store.markComplete(launch,'NONE',options.nowMs);
        noInbound+=1;
        continue;
      }
      await verifyPonsPrelaunchNativeInboundReceipt(receipt);
      const result=await store.put(receipt);
      if (result==='INSERTED') inserted+=1;
      else duplicates+=1;
      await store.markComplete(launch,'FOUND',options.nowMs);
    } catch(error) {
      failed+=1;
      await store.markFailure(
        launch,
        fundingErrorCode(error),
        options.nowMs+failureRetryMs,
        options.nowMs
      );
    }
  }

  return {
    attempted:launches.length,
    inserted,
    duplicates,
    noInbound,
    failed,
    remaining:await store.countRemaining(options.nowMs)
  };
}

export function fundingErrorCode(error:unknown):string {
  const raw=error instanceof Error ? error.message : String(error);
  const code=raw.split(':',1)[0]?.trim() || 'PONS_FUNDING_UNKNOWN';
  return /^[A-Z0-9_]{1,120}$/.test(code) ? code : 'PONS_FUNDING_UNKNOWN';
}

export type { PonsFundingLaunch, PonsFundingSource, PonsPrelaunchNativeInboundReceipt, Hex };
