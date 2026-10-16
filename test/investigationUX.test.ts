import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterDiscoverableCases, groupDeployerCases, investigationHref, readCasebook, sectionForPath, toggleSavedCase } from '../web-v2/src/investigationUX.js';

const a = 'a'.repeat(64), b = 'b'.repeat(64), c = 'c'.repeat(64);
const cases = [
 { name:'Rat Coin',symbol:'RAT',token:'0x0000000000000000000000000000000000000001',reportedCreatorAddress:'0x1111111111111111111111111111111111111111',priorLaunches:0 },
 { name:'Repeat Duck',symbol:'DUCK',token:'0x0000000000000000000000000000000000000002',reportedCreatorAddress:'0x2222222222222222222222222222222222222222',priorLaunches:2 },
];
test('route selection preserves the real V3 /bag Case path',()=>{
 assert.equal(sectionForPath('/'), 'find');
 assert.equal(sectionForPath('/trails'), 'trails');
 assert.equal(sectionForPath('/saved'), 'saved');
 assert.equal(sectionForPath('/crew'), 'crew');
 assert.equal(sectionForPath('/status'), 'status');
 assert.equal(sectionForPath('/bag/'+a), 'find');
 assert.equal(sectionForPath('/unimplemented-arc-radar'), 'find');
});
test('deployer groups retain exact verified Cases and order without borrowing historical counts',()=>{
 const input=[cases[0],cases[1],{...cases[0],token:'0x3',priorLaunches:8}];
 const groups=groupDeployerCases(input);
 assert.equal(groups.length,2);
 assert.deepEqual(groups[0].cases,[input[0],input[2]]);
 assert.equal(groups[0].cases.length,2); // not 8 from the separate recurrence field
 assert.deepEqual(input,[cases[0],cases[1],{...cases[0],token:'0x3',priorLaunches:8}]);
});
test('preview hrefs preserve nested entry for reload, modified clicks and exact Case IDs',()=>{
 const location='https://raw.githack.com/CipherCuttle/binrat/binrat-v3-githack-v2-20261016/preview/githack/index.html?view=saved#old';
 for(const path of ['/', '/trails', '/saved', '/crew', '/status', '/bag/'+a, '/#vl-finds']) {
  const preview=new URL(investigationHref(path,location,true),'https://raw.githack.com');
  assert.equal(preview.pathname,new URL(location).pathname);
  assert.equal(preview.searchParams.get('case'),path.startsWith('/bag/')?a:null);
  assert.equal(preview.searchParams.get('view'),['/trails','/saved','/crew','/status'].includes(path)?path.slice(1):null);
  assert.equal(investigationHref(path,location,false),path);
 }
});
test('Casebook accepts only exact 64-character digest IDs, deduplicates and caps',()=>{
 assert.deepEqual(readCasebook(JSON.stringify([a,a,'../data',b.toUpperCase(),b,c])),[a,b,c]);
 assert.deepEqual(readCasebook('not json'),[]);
 assert.deepEqual(readCasebook(JSON.stringify(Array(100).fill(a).map((_,i)=>i.toString(16).padStart(64,'0')))).length,50);
 assert.deepEqual(readCasebook('x'.repeat(8193)),[]);
});
test('Casebook toggles without resurrecting a stale or untrusted ID',()=>{
 assert.deepEqual(toggleSavedCase([],a),[a]);
 assert.deepEqual(toggleSavedCase([a,b],a),[b]);
 assert.deepEqual(toggleSavedCase([a],'not_a_case'),[a]);
 assert.deepEqual(toggleSavedCase([a],b),[b,a]);
});
test('Pons search uses verified visible data only, not network or synthetic ranking',()=>{
 assert.deepEqual(filterDiscoverableCases(cases,'rat',false).map(x=>x.symbol),['RAT']);
 assert.deepEqual(filterDiscoverableCases(cases,'duck',true).map(x=>x.symbol),['DUCK']);
 assert.deepEqual(filterDiscoverableCases(cases,'RAT',true),[]);
 assert.deepEqual(filterDiscoverableCases(cases,'222222',false).map(x=>x.symbol),['DUCK']);
 assert.deepEqual(filterDiscoverableCases(cases,'Not indexed',false),[]);
 assert.equal(filterDiscoverableCases(cases,'',true).length,1);
});
