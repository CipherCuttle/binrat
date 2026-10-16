import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterDiscoverableCases, groupDeployerCases, investigationHref, observationForFind, readCasebook, readCaseNotes, sectionForPath, sharedDeployerLeads, toggleSavedCase, updateCaseNote } from '../web-v2/src/investigationUX.js';

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

test('find explanations never imply safety, opportunity, fresh chain state or verified human identity',()=>{
 const recurrent=observationForFind({priorLaunches:3});
 assert.match(recurrent.label,/3 earlier indexed launches/);
 assert.match(recurrent.action,/Compare/);
 assert.match(recurrent.explanation,/significance unknown/);
 const unmatched=observationForFind({priorLaunches:0});
 assert.match(unmatched.label,/No earlier indexed match/);
 assert.match(unmatched.explanation,/partial records/);
 assert.doesNotMatch([recurrent,unmatched].map(x=>Object.values(x).join(' ')).join(' '),/profitable|alpha|safe to buy|guaranteed/i);
});
test('device-only notes reject invalid IDs, bad types, pollution and excess text',()=>{
 const dirty=JSON.stringify({[a]:'Look at contract.',[b]:'', ['../']: 'unsafe', ['__proto__']:'pollution',[c]:'x'.repeat(281)});
 const parsed=readCaseNotes(dirty);
 assert.equal(parsed[a],'Look at contract.');
 assert.equal(parsed[b],undefined);
 assert.equal(parsed[c],undefined);
 assert.equal(Object.getPrototypeOf(parsed),null);
 assert.deepEqual(Object.keys(readCaseNotes('not-json')),[]);
 assert.deepEqual(Object.keys(readCaseNotes('x'.repeat(20001))),[]);
 assert.equal(updateCaseNote(parsed,'bad', 'hi'),parsed);
 assert.equal(updateCaseNote(parsed,b,'x'.repeat(300))[b].length,280);
 assert.equal(updateCaseNote(parsed,a,' ')[a],undefined);
 assert.equal(Object.keys(updateCaseNote(readCaseNotes(null),a,'Remember')).length,1);
});

test('window relationship is based on distinct exact Cases, not history counts or arbitrary ranking',()=>{
 const address='0x1111111111111111111111111111111111111111';
 const two = [
   { ...cases[0], id:a, priorLaunches:38 },
   { ...cases[0], id:b, priorLaunches:0 },
   { ...cases[0], id:a, priorLaunches:43 }, // repeated projection cannot invent a new Case
   { ...cases[1], id:c, priorLaunches:100 },
 ];
 assert.deepEqual(sharedDeployerLeads(two),[{address,caseIds:[a,b]}]);
 assert.deepEqual(sharedDeployerLeads(two.filter(x=>x.id!==b)),[]);
 assert.deepEqual(sharedDeployerLeads([]),[]);
});
