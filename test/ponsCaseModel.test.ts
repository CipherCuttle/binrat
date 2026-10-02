import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import {
  buildBinratCaseModel,
  type BinratCaseCurrentLaunch,
  type BinratReplayCaseInput,
  type BinratTrashTrailCaseInput
} from '../src/pons/caseModel.js';
import type { PonsFundingRecurrenceReadModel } from '../src/cloudflare/ponsFundingRecurrenceReadModel.js';

const addr=(n:number)=>('0x'+n.toString(16).padStart(40,'0')) as Hex;
const launchId='a'.repeat(64);

function current():BinratCaseCurrentLaunch {
  return {
    chainId:4663,
    launchId,
    token:addr(1),
    deployer:addr(2),
    label:'$RAT',
    labelSource:'PERSISTED_TOKEN_IDENTITY'
  };
}

function trash(overrides:Partial<BinratTrashTrailCaseInput>={}):BinratTrashTrailCaseInput {
  return {
    targetLaunchId:launchId,
    asOfBlock:'1000',
    presentationVersion:'BINRAT_PONS_TRASH_TRAIL_PRESENTATION_V1',
    previousLaunches:3,
    launchesWithAnyMemory:2,
    launchesWithFullMemory:1,
    coverageText:'I know what happened next for 2 of 3 prior launches.',
    canOfferRatWatch:true,
    ...overrides
  };
}

function replay(overrides:Partial<BinratReplayCaseInput>={}):BinratReplayCaseInput {
  return {
    targetLaunchId:launchId,
    asOfBlock:'1000',
    replayVersion:'BINRAT_PONS_REPLAY_LAB_V1',
    semantics:'KNOWABLE_AS_OF_BLOCK',
    targetLaunchKnown:true,
    outputDigest:'b'.repeat(64),
    ...overrides
  };
}

function funding(
  overrides:Partial<PonsFundingRecurrenceReadModel>={}
):PonsFundingRecurrenceReadModel {
  return {
    schemaVersion:'binrat.pons-funding-recurrence/0.1',
    chainId:4663,
    asOfBlock:'1000',
    currentLaunchId:launchId,
    currentFunding:{
      sourceAddress:addr(9),
      transferTxHash:'0x'+'1'.repeat(64) as Hex,
      transferBlock:'900',
      transferTimestampMs:1_000_000,
      valueWei:'1000000000000000'
    },
    sameFundingSource:{
      label:'SAME FUNDING SOURCE',
      sourceAddress:addr(9),
      distinctDeployersAtLeast:2,
      distinctLaunchesAtLeast:3,
      relatedLaunches:[
        {launchId:'c'.repeat(64),deployer:addr(3),launchBlock:'800',transferBlock:'700',valueWei:'1'},
        {launchId:'d'.repeat(64),deployer:addr(4),launchBlock:'850',transferBlock:'750',valueWei:'2'},
        {launchId,              deployer:addr(2),launchBlock:'950',transferBlock:'900',valueWei:'3'}
      ]
    },
    recurrenceCoverage:{status:'COMPLETE',verifiedReceipts:3,truncated:false},
    caveat:'Exact source-address recurrence only; does not establish common ownership, control, team, or person.',
    ...overrides
  };
}

test('Case Model composes factual reasons and valid handoffs without scores',async()=>{
  const model=await buildBinratCaseModel({
    current:current(),
    asOfBlock:1000n,
    trashTrail:trash(),
    replay:replay(),
    funding:funding()
  });

  assert.deepEqual(model.facts.map((item)=>item.kind),[
    'SAME_FUNDING_SOURCE',
    'PRIOR_LAUNCH_HISTORY',
    'OUTCOME_MEMORY',
    'PRELAUNCH_FUNDING_OBSERVED'
  ]);
  assert.deepEqual(model.handoffs.map((item)=>item.kind),[
    'TRASH_TRAIL',
    'REPLAY',
    'WATCH_DEPLOYER'
  ]);
  assert.equal(model.coverage.trashTrail,'AVAILABLE');
  assert.equal(model.coverage.replay,'AVAILABLE');
  assert.equal(model.coverage.funding,'POSITIVE_FACTS');
  assert.match(model.caseDigest,/^[0-9a-f]{64}$/);

  const serialized=JSON.stringify(model);
  assert.doesNotMatch(serialized,/WATCH_FUNDER|score|win rate|profitability|buy signal|sell signal/i);
  assert.match(serialized,/Pons-reported deployer/);
  assert.match(serialized,/not proof of a human identity|does not establish common ownership/i);
});

test('Case Model does not turn missing positive funding evidence into a negative claim',async()=>{
  const emptyFunding:PonsFundingRecurrenceReadModel={
    schemaVersion:'binrat.pons-funding-recurrence/0.1',
    chainId:4663,
    asOfBlock:'1000',
    currentLaunchId:launchId,
    currentFunding:null,
    sameFundingSource:null,
    recurrenceCoverage:{status:'COMPLETE',verifiedReceipts:0,truncated:false},
    caveat:'Exact source-address recurrence only; does not establish common ownership, control, team, or person.'
  };

  const model=await buildBinratCaseModel({
    current:current(),
    asOfBlock:1000n,
    trashTrail:trash({previousLaunches:0,launchesWithAnyMemory:0,launchesWithFullMemory:0,canOfferRatWatch:false}),
    replay:null,
    funding:emptyFunding
  });

  assert.deepEqual(model.facts,[]);
  assert.deepEqual(model.handoffs,[]);
  assert.equal(model.coverage.funding,'NO_POSITIVE_FACT');
  assert.match(model.boundaries.fundingAbsence,/does not mean the deployer was not funded/i);
  assert.doesNotMatch(JSON.stringify(model),/NOT FUNDED|NO FUNDING|UNFUNDED/i);
});

test('Case Model keeps handoffs honest when only some downstream surfaces are supported',async()=>{
  const model=await buildBinratCaseModel({
    current:current(),
    asOfBlock:1000n,
    trashTrail:trash({canOfferRatWatch:false}),
    replay:null,
    funding:null
  });

  assert.deepEqual(model.handoffs.map((item)=>item.kind),['TRASH_TRAIL']);
  assert.equal(model.coverage.replay,'NOT_PROVIDED');
  assert.equal(model.coverage.funding,'NOT_PROVIDED');
});

test('Case Model rejects cross-time or cross-target sibling inputs',async()=>{
  await assert.rejects(
    buildBinratCaseModel({
      current:current(),
      asOfBlock:1000n,
      trashTrail:trash({asOfBlock:'999'})
    }),
    /BINRAT_CASE_TRASH_TRAIL_BLOCK_MISMATCH/
  );

  await assert.rejects(
    buildBinratCaseModel({
      current:current(),
      asOfBlock:1000n,
      replay:replay({targetLaunchId:'f'.repeat(64)})
    }),
    /BINRAT_CASE_REPLAY_TARGET_MISMATCH/
  );

  await assert.rejects(
    buildBinratCaseModel({
      current:current(),
      asOfBlock:1000n,
      funding:funding({asOfBlock:'1001'})
    }),
    /BINRAT_CASE_FUNDING_BLOCK_MISMATCH/
  );
});

test('Case Model digest is deterministic and changes when factual inputs change',async()=>{
  const input={
    current:current(),
    asOfBlock:1000n,
    trashTrail:trash(),
    replay:replay(),
    funding:funding()
  };
  const one=await buildBinratCaseModel(input);
  const two=await buildBinratCaseModel(input);
  assert.equal(one.caseDigest,two.caseDigest);

  const changed=await buildBinratCaseModel({
    ...input,
    trashTrail:trash({previousLaunches:4,launchesWithAnyMemory:2,launchesWithFullMemory:1})
  });
  assert.notEqual(changed.caseDigest,one.caseDigest);
});

test('Case Model rejects malformed recurrence claims below the factual threshold',async()=>{
  await assert.rejects(
    buildBinratCaseModel({
      current:current(),
      asOfBlock:1000n,
      funding:funding({
        sameFundingSource:{
          label:'SAME FUNDING SOURCE',
          sourceAddress:addr(9),
          distinctDeployersAtLeast:1,
          distinctLaunchesAtLeast:2,
          relatedLaunches:[
            {launchId,deployer:addr(2),launchBlock:'950',transferBlock:'900',valueWei:'3'}
          ] as never
        }
      })
    }),
    /BINRAT_CASE_FUNDING_RECURRENCE_INVALID/
  );
});
