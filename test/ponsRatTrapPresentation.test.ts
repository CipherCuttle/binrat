import assert from 'node:assert/strict';
import test from 'node:test';
import type { Hex } from '../src/core/types.js';
import type { PonsRatTrapProjection } from '../src/pons/ratTrapProjection.js';
import { buildRatTrapPresentation } from '../src/pons/ratTrapPresentation.js';

const A='0x00000000000000000000000000000000000000aa' as Hex;
const B='0x00000000000000000000000000000000000000bb' as Hex;
const C='0x00000000000000000000000000000000000000cc' as Hex;

function projection(input:Partial<PonsRatTrapProjection>&Pick<PonsRatTrapProjection,'launches'>):PonsRatTrapProjection {
  const {launches,coverage,...rest}=input;
  return {
    projectionVersion:'BINRAT_PONS_RAT_TRAP_PROJECTION_V1',
    chainId:4663,
    currentLaunchId:'current',
    deployer:A,
    asOfBlock:77753046n,
    asOfTimestampMs:1790895755000,
    previousLaunchCount:launches.length,
    launches,
    coverage:coverage??[],
    ...rest
  };
}

function obs(
  horizonMs:number,
  state:'COMPLETE'|'PARTIAL'|'IMMATURE'|'PENDING',
  raw:bigint|null,
  asset:{kind:'NATIVE_ETH'|'ERC20';address:Hex;decimals:number}|null,
  id:string|null
){
  return {
    horizonMs,state,
    maturityTargetTimestampMs:0,
    observationId:id,
    observedBlock:id?1n:null,
    observedTimestampMs:id?1:null,
    phase:id?'CURVE' as const:null,
    quoteAsset:asset,
    estimatedFdvQuoteRaw:raw,
    missing:[],
    evidenceDigest:id?'digest':null
  };
}

test('presentation leads with sparse memory coverage instead of pretending cohort history is complete',()=>{
  const p=projection({launches:[
    {
      launchId:'newer',token:B,curve:C,deployer:A,symbol:'',name:'',launchBlock:2n,launchTimestampMs:2,
      observations:[
        obs(300_000,'PENDING',null,null,null),
        obs(3_600_000,'PENDING',null,null,null),
        obs(86_400_000,'IMMATURE',null,null,null)
      ],
      highestObserved:null
    },
    {
      launchId:'older',token:C,curve:B,deployer:A,symbol:'OLD',name:'Old',launchBlock:1n,launchTimestampMs:1,
      observations:[
        obs(300_000,'COMPLETE',1_680_000_000_000_000_001n,{kind:'NATIVE_ETH',address:'0x0000000000000000000000000000000000000000',decimals:18},'a'),
        obs(3_600_000,'COMPLETE',1_680_000_000_000_000_001n,{kind:'NATIVE_ETH',address:'0x0000000000000000000000000000000000000000',decimals:18},'b'),
        obs(86_400_000,'COMPLETE',1_680_000_000_000_000_001n,{kind:'NATIVE_ETH',address:'0x0000000000000000000000000000000000000000',decimals:18},'c')
      ],
      highestObserved:{
        estimatedFdvQuoteRaw:1_680_000_000_000_000_001n,
        quoteAsset:{kind:'NATIVE_ETH',address:'0x0000000000000000000000000000000000000000',decimals:18},
        tiedHorizonsMs:[300_000,3_600_000,86_400_000],
        observationIds:['a','b','c']
      }
    }
  ]});

  const out=buildRatTrapPresentation(p);
  assert.equal(out.summary.previousLaunches,2);
  assert.equal(out.summary.launchesWithAnyMemory,1);
  assert.equal(out.summary.launchesWithFullMemory,1);
  assert.equal(out.summary.launchesPendingMemory,1);
  assert.match(out.summary.coverageText,/I know what happened next for 1 of 2 prior launches/);
  assert.match(out.summary.coverageText,/1 trail is still filling in/);
  assert.equal(out.summary.canOfferRatWatch,true);
  assert.equal(out.launches[0]!.memoryState,'PENDING');
  assert.match(out.launches[0]!.memoryText,/haven't got its outcome trail yet/);
});

test('presentation preserves a flat live-production shape as a tie, not a fake peak',()=>{
  const eth={kind:'NATIVE_ETH' as const,address:'0x0000000000000000000000000000000000000000' as Hex,decimals:18};
  const p=projection({launches:[{
    launchId:'flat',token:B,curve:C,deployer:A,symbol:'FLAT',name:'Flat',launchBlock:1n,launchTimestampMs:1,
    observations:[
      obs(300_000,'COMPLETE',1_680_000_000_000_000_013n,eth,'a'),
      obs(3_600_000,'COMPLETE',1_680_000_000_000_000_013n,eth,'b'),
      obs(86_400_000,'COMPLETE',1_680_000_000_000_000_013n,eth,'c')
    ],
    highestObserved:{
      estimatedFdvQuoteRaw:1_680_000_000_000_000_013n,
      quoteAsset:eth,
      tiedHorizonsMs:[300_000,3_600_000,86_400_000],
      observationIds:['a','b','c']
    }
  }]});

  const out=buildRatTrapPresentation(p);
  assert.equal(out.launches[0]!.highestObservedQualifier,'HIGHEST_SUPPORTED_SAMPLE');
  assert.match(out.launches[0]!.highestObservedText??'',/@ 5m \/ 1h \/ 24h/);
  assert.doesNotMatch(out.launches[0]!.highestObservedText??'',/ATH|peak/i);
});

test('ERC20 quote values stay explicitly quote-token denominated and are never called ETH or USD',()=>{
  const quote={kind:'ERC20' as const,address:'0xf3081494b87e8d5fb7960f066e931d1d0e6e3d67' as Hex,decimals:18};
  const p=projection({launches:[{
    launchId:'erc',token:B,curve:C,deployer:A,symbol:'ERC',name:'Erc',launchBlock:1n,launchTimestampMs:1,
    observations:[
      obs(300_000,'COMPLETE',57_369_987_960_778_785_506n,quote,'a'),
      obs(3_600_000,'COMPLETE',74_045_893_817_837_305_463n,quote,'b'),
      obs(86_400_000,'COMPLETE',51_210_215_481_422_931_357n,quote,'c')
    ],
    highestObserved:{
      estimatedFdvQuoteRaw:74_045_893_817_837_305_463n,
      quoteAsset:quote,
      tiedHorizonsMs:[3_600_000],
      observationIds:['b']
    }
  }]});

  const out=buildRatTrapPresentation(p);
  const text=JSON.stringify(out);
  assert.match(out.launches[0]!.highestObservedText??'',/quote tokens/);
  assert.match(out.launches[0]!.highestObservedText??'',/0xf30814…6e3d67/);
  assert.doesNotMatch(text,/USD|\$74|74.*ETH/);
  assert.match(out.footer,/Different quote assets are not compared/);
});

test('PARTIAL receipts remain visible as incomplete evidence and do not produce a value headline',()=>{
  const p=projection({launches:[{
    launchId:'partial',token:B,curve:C,deployer:A,symbol:'PART',name:'Part',launchBlock:1n,launchTimestampMs:1,
    observations:[
      {...obs(300_000,'PARTIAL',null,{kind:'NATIVE_ETH',address:'0x0000000000000000000000000000000000000000',decimals:18},'a'),missing:['V4_POOL_STATE']},
      obs(3_600_000,'PENDING',null,null,null),
      obs(86_400_000,'IMMATURE',null,null,null)
    ],
    highestObserved:null
  }]});

  const out=buildRatTrapPresentation(p);
  assert.equal(out.launches[0]!.memoryState,'PARTIAL');
  assert.equal(out.launches[0]!.highestObservedText,null);
  assert.deepEqual(out.launches[0]!.observations[0]!.missing,['V4_POOL_STATE']);
  assert.match(out.launches[0]!.memoryText,/Trail is still incomplete/);
  assert.equal(out.summary.canOfferRatWatch,false);
});
