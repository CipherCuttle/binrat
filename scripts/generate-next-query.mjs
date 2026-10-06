// Independent synthetic fixtures. No selector, replay, scorer or earlier oracle imports.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const normalize = v => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, normalize(v[k])])) : v;
const hash = v => createHash('sha256').update(JSON.stringify(normalize(v))).digest('hex');
const seal = value => ({...value, digest: hash(value)});
const registration = JSON.parse(readFileSync('test/fixtures/workforce/next-query/registration-v1.json', 'utf8'));
const [split, destination] = process.argv.slice(2);
if (!['development','evaluation'].includes(split) || !destination || process.argv.length !== 4) {
  throw new Error('Usage: generate-next-query.mjs development|evaluation NEW_FILE');
}
const count = split === 'development' ? registration.developmentPerStratum : registration.evaluationPerStratum;
const cases = [];
for (const stratum of registration.strata) for (let variant = 0; variant < count; variant++) {
  const index = cases.length;
  const digest = role => hash({seed: registration.seed, split, index, role});
  const address = role => `0x${digest(role).slice(0,40)}`;
  const id = `query-${digest('task').slice(0,16)}`, D = 10000 + index * 100;
  const funder = address('funder'), start = D - 80, end = D + 80;
  const blockHash = block => `0x${digest(`block-${block}`)}`;
  const candidates = [], outcomes = {};
  const eligibleIndex = variant % 3;
  for (let j = 0; j < 3; j++) {
    const recipient = address(`recipient-${j}`), F = D - 30 + j * 3;
    const queryId = `${id}-${digest(`query-${j}`).slice(0,8)}`;
    const base = (role, kind, block, available) => ({id: `${id}-${role}-${j}`, kind, chainId:4663,
      blockNumber:String(block), availableAtBlock:String(available), blockHash:blockHash(block)});
    const funding = seal({...base('funding','NATIVE_TRANSFER',F,F+1), from:funder, to:recipient,
      txHash:`0x${digest(`funding-tx-${j}`)}`, valueWei:String(1000+parseInt(digest(`amount-${j}`).slice(0,6),16))});
    let success = stratum === 'ONE_ELIGIBLE' ? j === eligibleIndex :
      stratum === 'MULTIPLE_ELIGIBLE' ? j !== eligibleIndex :
      stratum === 'NO_ELIGIBLE' ? false : variant % 3 !== 1 && j === eligibleIndex;
    const complete = stratum === 'NO_ELIGIBLE' && variant % 3 === 1 ||
      stratum === 'COVERAGE_AND_BUDGET' && variant % 3 === 0 && !success ? false : true;
    const seen = !success && complete && (stratum !== 'COVERAGE_AND_BUDGET' || variant % 3 !== 2);
    const history = seal({...base('history','RECIPIENT_WINDOW',D+1,D+1), recipient,
      fromBlock:String(start), toBlock:String(F-1), complete, seen});
    const hasLaunch = success || stratum === 'NO_ELIGIBLE' && variant % 3 !== 2 ||
      stratum === 'COVERAGE_AND_BUDGET' && variant % 3 === 0;
    const later = hasLaunch ? [seal({...base('launch','PONS_LAUNCH',D+8,D+12), creator:recipient,
      launcher:'0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e', token:address(`token-${j}`),
      pool:address(`pool-${j}`), txHash:`0x${digest(`launch-tx-${j}`)}`, logIndex:j})] : [];
    const job = {schemaVersion:'binrat.rat-job/1', mode:'OFFLINE_REPLAY', jobId:`${id}-job-${j}`, leadRat:'SNIFFER',
      subject:{chainId:4663,entityType:'WALLET',entityId:funder},objective:'FOLLOW_FUNDER_TO_FUTURE_PONS_LAUNCH',
      authority:{research:true,network:false,provider:false,delivery:false,capital:false},
      budget:{maxToolCalls:5,maxHandoffs:1,maxModelCalls:0,maxCostMicrousd:0},window:{fromBlock:String(start),toBlock:String(end)}};
    const fundingClaim = {kind:'NATIVE_TRANSFER_OBSERVED',subject:{chainId:4663,entityType:'WALLET',entityId:recipient},
      evidenceRefs:[funding.id],scope:'DECLARED_FIXTURE_WINDOW_ONLY'};
    candidates.push({queryId,tool:'READ_RECIPIENT_WINDOW_FIXTURE',costQueries:1,job,fundingReceipt:funding,
      fundingClaim,canonicalBlockHash:funding.blockHash,fromBlock:String(start),toBlock:String(F-1)});
    // Independently author the allowed artifacts and eligibility from the recorded source semantics.
    const claim = (kind,type,refs) => ({kind,subject:{chainId:4663,entityType:type,entityId:recipient},
      evidenceRefs:refs,scope:'DECLARED_FIXTURE_WINDOW_ONLY'});
    const eligibleAlert = complete && !seen && later.length > 0;
    const allowedClaims = [fundingClaim, ...(complete && !seen ? [claim('RECIPIENT_NOT_SEEN_IN_WINDOW','WALLET',[history.id])] : []),
      ...(eligibleAlert ? [claim('PONS_REPORTED_DEPLOYER_LAUNCH','CREATOR',[later[0].id]),
        claim('FUNDING_PRECEDES_LAUNCH','CREATOR',[funding.id,later[0].id])] : [])];
    outcomes[queryId] = {history,later,canonicalBlocks:Object.fromEntries([history,...later].map(e=>[e.blockNumber,e.blockHash])),
      expected:{eligibleAlert,allowedClaims,handoff:complete && !seen ? {subject:{chainId:4663,entityType:'CREATOR',entityId:recipient},
        createdAtBlock:String(D+1),afterBlock:String(F),evidenceRefs:[funding.id,history.id]} : null}};
  }
  // Scramble catalog presentation independently of answer and transfer value.
  candidates.sort((a,b)=>hash({seed:registration.seed,query:a.queryId}).localeCompare(hash({seed:registration.seed,query:b.queryId})));
  const taskContent = {schemaVersion:'binrat.next-query-task/1',provenance:'SYNTHETIC_OFFLINE_REPLAY',taskId:id,
    decisionBlock:String(D),budget:{maxQueries:stratum==='COVERAGE_AND_BUDGET' && variant%3===1 ? 0 : 1},candidates};
  const task = {...taskContent,taskDigest:hash(taskContent)};
  const content = {taskId:id,stratum,variant,task,outcomes};
  cases.push({...content,caseDigest:hash(content)});
}
const content = {schemaVersion:'binrat.next-query-pack/1',provenance:'SYNTHETIC_MODEL_UNRUN',split,
  registrationDigest:hash(registration),generatorDigest:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),cases};
const pack = {...content,packDigest:hash(content)};
writeFileSync(destination,JSON.stringify(pack,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({split,cases:cases.length,packDigest:pack.packDigest,modelCalls:0}));
