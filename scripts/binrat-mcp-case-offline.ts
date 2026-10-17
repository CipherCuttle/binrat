#!/usr/bin/env -S pnpm exec tsx
/**
 * BINRAT MCP V0.2, still OFFLINE: independently verified historical Case
 * via the original canonical Case verifier, never an inferred current state.
 */
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyCaseEnvelope} from '../src/public/caseEvidence.js';
import {loadCapturedPons,runStdio} from './binrat-mcp-offline.mjs';

const EVIDENCE_PATH='docs/receipts/sprint-a1-2-contract/old-case-envelope.json';
const EVIDENCE_BLOB='ac4258f22bb32643b4829a699f7c5bf4720690ba';
const EVIDENCE_ID='742ed5c2d361c11d5a4da715e35e6c189a9b61ae4a433a937a96111360d7ab01';
const EVIDENCE_MAX_BYTES=65536;

/** Always pin source identity first, then independently validate every Case record. */
export async function loadVerifiedCaseMcp(root=process.cwd()){
  const snapshot=loadCapturedPons(root);
  const file=readFileSync(resolve(root,EVIDENCE_PATH));
  if(file.byteLength>EVIDENCE_MAX_BYTES)throw new Error('MCP_CASE_EVIDENCE_SIZE_LIMIT');
  const blob=createHash('sha1').update('blob '+file.byteLength+'\0').update(file).digest('hex');
  if(blob!==EVIDENCE_BLOB)throw new Error('MCP_CASE_EVIDENCE_SOURCE_DRIFT');
  const sha256=createHash('sha256').update(file).digest('hex');
  let raw:unknown;
  try{raw=JSON.parse(file.toString('utf8'));}catch{throw new Error('MCP_CASE_EVIDENCE_JSON_INVALID');}
  const material=(raw as {material?:{publication?:unknown}}|null)?.material;
  if(!material||!material.publication)throw new Error('MCP_CASE_EVIDENCE_MATERIAL_INVALID');
  // This call rederives canonical launch/event IDs, provenance and all digests.
  const witness=await verifyCaseEnvelope(raw,EVIDENCE_ID,material.publication as Parameters<typeof verifyCaseEnvelope>[2]);
  const m=witness.material;
  const target=m.records[0]!.launch;
  const fromEarlierFeed=snapshot.feed.launches.find(x=>x.launchId===EVIDENCE_ID);
  if(!fromEarlierFeed||fromEarlierFeed.token!==target.token||
     fromEarlierFeed.deployer!==target.creator||
     fromEarlierFeed.txHash!==target.txHash||
     fromEarlierFeed.blockNumber!==target.blockNumber||
     fromEarlierFeed.factId!==m.records[0]!.provenance.factId||
     BigInt(m.publication.checkpointBlock)<BigInt(snapshot.feed.sourceCheckpoint)||
     m.publication.verifiedAtMs<snapshot.status.verifiedAtMs||
     m.publication.feedDigest===snapshot.feed.feedDigest)
    throw new Error('MCP_CASE_CROSS_CAPTURE_BINDING_INVALID');

  // Output all 20 canonical evidence references but no attacker-controlled metadata.
  // All fields originate in the exact pinned, independently validated envelope.
  const records=m.records.map(r=>Object.freeze({
    launchId:r.launch.launchId,eventId:r.launch.eventId,
    reportedDeployer:r.launch.creator,token:r.launch.token,
    blockNumber:r.launch.blockNumber,blockHash:r.launch.blockHash,
    txHash:r.launch.txHash,logIndex:r.launch.logIndex,
    authorityDigest:r.authorityDigest,
    provenanceFactId:r.provenance.factId,evidenceDigest:r.provenance.evidenceDigest
  }));
  return Object.freeze({...snapshot,verifiedCase:Object.freeze({
    caseId:m.caseId,reportedDeployer:target.creator,token:target.token,
    caseDigest:witness.digest,priorLaunchCount:m.priorLaunchCount,
    publication:Object.freeze({...m.publication}),records:Object.freeze(records),
    source:Object.freeze({path:EVIDENCE_PATH,gitBlob:blob,sha256,
      schemaVersion:m.schemaVersion,projectionVersion:m.projectionVersion,
      reconstruction:m.reconstruction,archivedPublication:false,pointInTimeReplay:false,
      live:false,validatedBy:'src/public/caseEvidence.ts::verifyCaseEnvelope'})
  })});
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  loadVerifiedCaseMcp().then(runStdio).catch(err=>{
    process.stderr.write('BINRAT_MCP_CASE_OFFLINE_STOP:'+
      (err instanceof Error?err.message:'UNKNOWN')+'\n');
    process.exitCode=1;
  });
}
