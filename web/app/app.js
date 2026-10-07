const tg = window.Telegram?.WebApp;
const state = { initData: tg?.initData || '', data: null, view: 'home', viewStack: [], casePayload: null, caseContext: null, caseRequestId: 0 };
const byId = id => document.getElementById(id);
const el = (tag, className, text) => { const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=text; return node; };

function syncTelegramBackButton() {
  const back=tg?.BackButton;
  if(!back) return;
  if(state.view==='home') back.hide();
  else back.show();
}
function show(id,{remember=true}={}) {
  const previous=state.view;
  if(id!=='case') state.caseRequestId+=1;
  if(id==='home') state.viewStack=[];
  else if(remember && previous && previous!==id) state.viewStack.push(previous);
  state.view=id;
  document.querySelectorAll('.view').forEach(node => node.classList.toggle('active',node.id===id));
  document.querySelectorAll('nav button').forEach(node => node.classList.toggle('selected',node.dataset.view===id));
  syncTelegramBackButton();
  window.scrollTo({top:0,behavior:'instant'});
}
function backView() {
  const prior=state.viewStack.pop() || 'home';
  show(prior,{remember:false});
}
tg?.BackButton?.onClick?.(backView);
document.addEventListener('click', event => {
  const target=event.target.closest('[data-view]'); if(target) show(target.dataset.view);
});

function sourceReady(health) {
  return health?.ok && health.chainId===4663 && health.indexReady && health.liveCaughtUp && health.lastSyncError===null;
}
function healthLine(health) {
  return sourceReady(health)
    ? 'PONS 4663 · READY'
    : 'Source unavailable or outside verified freshness. No new conclusion.';
}
function shortReference(value) {
  const raw=String(value||'');
  return raw.length>20 ? `${raw.slice(0,10)}…${raw.slice(-8)}` : raw;
}
function launchLabel(launch) {
  if(!launch) return 'UNKNOWN LAUNCH';
  const symbol=String(launch.symbol||'').trim();
  if(symbol) return `$${symbol}`;
  const name=String(launch.name||'').trim();
  return name || shortReference(launch.token);
}
function candidateForAddress(data,address) {
  const target=String(address||'').toLowerCase();
  return (data.rats?.candidates||[]).find(candidate=>String(candidate.entity?.entityId||'').toLowerCase()===target) || null;
}
function watchLabels(data,watch) {
  const candidate=candidateForAddress(data,watch.entityId);
  const launches=candidate
    ? [candidate.latestLaunch,...(candidate.previousLaunches||[])]
    : (data.latestLaunches||[]).filter(launch=>String(launch.deployer||'').toLowerCase()===String(watch.entityId||'').toLowerCase());
  return [...new Set(launches.filter(Boolean).map(launchLabel))].slice(0,3);
}
function setCaseHeading(kicker,title) {
  byId('case-kicker').textContent=kicker;
  byId('case-title').textContent=title;
}

function renderBootstrap(data) {
  state.data=data;
  byId('health').textContent=healthLine(data.sourceHealth);
  byId('source-badge').textContent=sourceReady(data.sourceHealth)?'PONS 4663 READY':'NOT READY';

  const launches=byId('launch-list'); launches.replaceChildren();
  if(!data.latestLaunches?.length) launches.append(el('div','panel','Empty paws. No fresh Pons launches are available at this checkpoint.'));
  for(const launch of data.latestLaunches||[]) {
    const card=el('article','card');
    const recurrence=launch.priorLaunchCount>0
      ? `Same Pons-reported deployer appeared on ${launch.priorLaunchCount} earlier indexed launch${launch.priorLaunchCount===1?'':'es'}.`
      : 'No earlier launch from this exact Pons-reported deployer is in current indexed coverage.';
    card.append(
      el('p','eyebrow',launch.priorLaunchCount>0?'FAMILIAR TRAIL':'NEW SCRAP'),
      el('h3','',launchLabel(launch)),
      el('p','fact',recurrence),
      el('p','meta',`Pons-reported deployer ${shortReference(launch.deployer)} · block ${launch.blockNumber}`)
    );
    const whyButton=el('button','inspect','WHY THIS?');
    whyButton.type='button';
    whyButton.addEventListener('click',()=>loadCaseIntelligence({
      launchId:launch.launchId,
      caseId:null,
      returnView:'launches'
    }));
    card.append(whyButton);
    launches.append(card);
  }

  const rats=byId('rat-list'); rats.replaceChildren();
  const candidates=data.rats?.candidates||[];
  if(!candidates.length) rats.append(el('div','panel','Empty paws. Nothing fresh in the bin is leaving a familiar trail right now.'));
  for(const [index,candidate] of candidates.entries()) {
    const card=el('article','card');
    const latest=candidate.latestLaunch||{};
    const previous=(candidate.previousLaunches||[]).slice(0,3).map(launchLabel);
    card.append(
      el('p','eyebrow',`FOUND SOMETHING · ${index+1}/${candidates.length}`),
      el('h3','',launchLabel(latest)),
      el('p','fact',previous.length
        ? `This exact Pons-reported deployer also launched ${previous.join(' · ')}.`
        : 'This exact Pons-reported deployer has older indexed launches in the bin.'),
      el('p','meta',`Exact Pons-reported deployer across ${candidate.recurrenceCount} indexed launches.`),
      el('p','unknown','Not a verdict. Human identity, intent, safety and future outcome stay unknown.')
    );
    const button=el('button','primary','DIG DEEPER');
    button.type='button';
    button.addEventListener('click',()=>loadCaseIntelligence({launchId:latest.launchId,caseId:candidate.caseId,returnView:'rats'}));
    card.append(button);
    rats.append(card);
  }

  const watches=byId('watch-list'); watches.replaceChildren();
  if(!data.watches?.length) watches.append(el('div','panel','Empty paws. Nothing is on Watch yet.'));
  for(const watch of data.watches||[]) {
    const labels=watchLabels(data,watch);
    const card=el('article','card');
    card.append(
      el('p','eyebrow','RAT WATCH'),
      el('h3','',labels.length?labels.join(' · '):shortReference(watch.entityId)),
      el('p','fact',"I'll squeak if this exact deployer launches again."),
      el('p','meta',`Pons-reported deployer ${shortReference(watch.entityId)}`)
    );
    watches.append(card);
  }

  const features=byId('feature-state'); features.replaceChildren();
  const f=data.features||{};
  features.append(
    el('p','eyebrow','PRIVATE TEST STATE'),
    el('p','',`Autonomous Rat: ${f.autonomousRatEnabled?'ON':'OFF'}`),
    el('p','',`Telegram UI V2: ${f.telegramUiV2Enabled?'ON':'OFF'}`),
    el('p','',`Telegram media: ${f.telegramMediaEnabled?'ON':'OFF'}`),
    el('p','',`Public Rat: ${f.autonomousRatPublicEnabled?'ON':'OFF'}`)
  );
}

function renderTrashTrail(root,trashTrail) {
  root.replaceChildren();
  root.append(
    el('p','eyebrow',trashTrail.heading||'TRASH TRAIL'),
    el('p','',trashTrail.deck||'What happened the other times this exact deployer showed up?'),
    el('p','fact',trashTrail.summary?.coverageText||'Outcome trail unavailable.')
  );

  for(const launch of trashTrail.launches||[]) {
    const card=el('article','card');
    card.append(
      el('p','eyebrow','PRIOR LAUNCH'),
      el('h3','',launch.label||'UNKNOWN LAUNCH'),
      el('p','meta',launch.memoryText||'Outcome trail unavailable.'),
      el('p','meta',launch.labelSource==='PERSISTED_TOKEN_IDENTITY'
        ? `Persisted token label receipt · ${shortReference(launch.token)}`
        : launch.labelSource==='CANONICAL_LAUNCH'
          ? `Canonical launch label · ${shortReference(launch.token)}`
          : `Token address fallback · ${shortReference(launch.token)}`)
    );
    for(const observation of launch.observations||[]) {
      const line=observation.valueText && observation.quoteLabel
        ? `${observation.horizonLabel} — ${observation.valueText} ${observation.quoteLabel}`
        : `${observation.horizonLabel} — ${observation.state}`;
      card.append(el('p',observation.state==='COMPLETE'?'fact':'meta',line));
    }
    if(launch.highestObservedText) {
      card.append(el('p','meta',`Highest retained sample among 5m / 1h / 24h only — not ATH: ${launch.highestObservedText}`));
    }
    root.append(card);
  }

  if(trashTrail.summary?.canOfferRatWatch) {
    const watch=el('article','panel');
    watch.append(
      el('p','eyebrow','RAT WATCH'),
      el('p','',"There is enough remembered outcome evidence to show Watch for this exact source-reported deployer."),
      el('p','meta','Watch changes stay in Telegram chat in this read-only Mini App.')
    );
    const button=el('button','inspect','SEE RAT WATCH');
    button.type='button';
    button.dataset.view='watches';
    watch.append(button);
    root.append(watch);
  }

  root.append(el('p','note',trashTrail.footer||'Observed history, not a prediction.'));
}


function handoffFor(caseModel,kind) {
  return (caseModel?.handoffs||[]).find(item=>item.kind===kind && item.available===true) || null;
}
function addCaseBack(root,label='BACK TO WHY') {
  const back=el('button','inspect',label);
  back.type='button';
  back.addEventListener('click',()=>{
    if(state.casePayload) renderCaseWhy(state.casePayload,state.caseContext||{});
  });
  root.append(back);
}
function renderCaseWhy(payload,context={}) {
  state.casePayload=payload;
  state.caseContext=context;
  show('case');
  setCaseHeading('FOUND SOMETHING.','WHY');
  const root=byId('case-file');
  root.replaceChildren();

  const caseModel=payload.case||{};
  const current=caseModel.current||{};
  const facts=caseModel.facts||[];
  const head=el('article','card');
  head.append(
    el('p','eyebrow','CURRENT CASE'),
    el('h3','',current.label||shortReference(current.token)||'UNKNOWN LAUNCH'),
    el('p','fact',facts.length
      ? `${facts.length} evidence-backed reason${facts.length===1?'':'s'} worth keeping.`
      : 'No additional positive case reason is verified at this checkpoint.'),
    el('p','meta',`Pons-reported deployer ${shortReference(current.deployer)} · as of block ${caseModel.asOfBlock||'—'}`)
  );
  root.append(head);

  if(!facts.length) {
    const empty=el('article','panel');
    empty.append(
      el('p','eyebrow','NOTHING ELSE VERIFIED YET'),
      el('p','','Missing evidence stays missing. The rat does not turn absence into a clean bill of health.')
    );
    root.append(empty);
  }

  for(const fact of facts) {
    const card=el('article','card');
    card.append(
      el('p','eyebrow',`${fact.evidenceClass||'EVIDENCE'} · ${fact.evidence?.source||'CASE'}`),
      el('h3','',fact.label||'FOUND SOMETHING'),
      el('p','fact',fact.detail||'Evidence-backed case fact.'),
      el('p','meta',`${fact.evidence?.refs?.length||0} retained reference${fact.evidence?.refs?.length===1?'':'s'}`)
    );
    if(fact.caveat) card.append(el('p','unknown',fact.caveat));
    root.append(card);
  }

  const actions=el('article','panel');
  actions.append(el('p','eyebrow','DIG DEEPER'));

  const trash=handoffFor(caseModel,'TRASH_TRAIL');
  if(trash) {
    const button=el('button','primary',trash.label||'OPEN TRASH TRAIL');
    button.type='button';
    button.addEventListener('click',()=>renderCaseTrashTrail(payload,context));
    actions.append(button);
  }

  const replay=handoffFor(caseModel,'REPLAY');
  if(replay) {
    const button=el('button','inspect',replay.label||'REPLAY THIS MOMENT');
    button.type='button';
    button.addEventListener('click',()=>renderCaseReplay(payload,context));
    actions.append(button);
  }

  const watch=handoffFor(caseModel,'WATCH_DEPLOYER');
  if(watch) {
    const button=el('button','inspect',watch.label||'WATCH DEPLOYER');
    button.type='button';
    button.addEventListener('click',()=>show('watches'));
    actions.append(button);
  }

  if(context.caseId) {
    const receipts=el('button','inspect','OPEN RECEIPTS');
    receipts.type='button';
    receipts.addEventListener('click',()=>loadCase(context.caseId));
    actions.append(receipts);
  }

  const back=el('button','inspect',context.returnView==='launches'?'BACK TO LATEST LAUNCHES':'BACK TO FRESH GARBAGE');
  back.type='button';
  back.addEventListener('click',()=>show(context.returnView==='launches'?'launches':'rats'));
  actions.append(back);
  root.append(actions);

  const boundary=el('article','panel');
  boundary.append(
    el('p','eyebrow','CLAIM BOUNDARY'),
    el('p','unknown',caseModel.boundaries?.deployerIdentity||'A deployer address is not proof of a human identity.'),
    el('p','unknown',caseModel.boundaries?.recommendation||'Evidence is not a trading recommendation or prediction.')
  );
  root.append(boundary);
}
function renderCaseTrashTrail(payload,context={}) {
  show('case');
  setCaseHeading('THE RAT REMEMBERS.','TRASH TRAIL');
  const root=byId('case-file');
  renderTrashTrail(root,payload.trashTrail||{
    heading:'TRASH TRAIL',
    deck:'No prior outcome trail is available in this Case payload.',
    summary:{coverageText:'No retained outcome trail.',canOfferRatWatch:false},
    launches:[],
    footer:'Missing evidence stays missing.'
  });
  addCaseBack(root);
}
function replayObservationLine(observation) {
  const state=String(observation?.state||'UNKNOWN');
  const observed=observation?.observedBlock ? ` · receipt block ${observation.observedBlock}` : '';
  return `${observation?.horizonLabel||'?'} — ${state}${observed}`;
}
function renderReplayLaunch(root,launch,label) {
  const card=el('article','card');
  const identity=launch?.tokenIdentity;
  card.append(
    el('p','eyebrow',label),
    el('h3','',identity?.symbol?(`$${identity.symbol}`):(identity?.name||shortReference(launch?.token)||'UNKNOWN LAUNCH')),
    el('p','fact',`Launch block ${launch?.launchBlock||'—'} · provenance ${launch?.provenance?.state||'MISSING'}`),
    el('p','meta',`Pons-reported deployer ${shortReference(launch?.deployer)}`)
  );
  if(identity) card.append(el('p','meta',`Token identity became knowable by block ${identity.observedBlock}.`));
  for(const observation of launch?.observations||[]) {
    card.append(el('p',observation.state==='COMPLETE'?'fact':'meta',replayObservationLine(observation)));
  }
  root.append(card);
}
function renderCaseReplay(payload,context={}) {
  show('case');
  setCaseHeading('POINT-IN-TIME.','REPLAY');
  const root=byId('case-file');
  root.replaceChildren();

  const replay=payload.replay||{};
  const intro=el('article','panel');
  intro.append(
    el('p','eyebrow','KNOWABLE AS OF BLOCK'),
    el('p','fact',`Block ${replay.asOfBlock||payload.case?.asOfBlock||'—'}`),
    el('p','meta','Only retained evidence knowable at or before this block is shown. Later receipts do not leak backward.')
  );
  root.append(intro);

  if(replay.targetLaunch) renderReplayLaunch(root,replay.targetLaunch,'CURRENT LAUNCH');
  for(const launch of replay.previousLaunches||[]) renderReplayLaunch(root,launch,'PRIOR EXACT-DEPLOYER LAUNCH');

  const boundary=el('article','panel');
  boundary.append(
    el('p','eyebrow','REPLAY BOUNDARY'),
    el('p','unknown',replay.boundaries?.ingestionAudit||'Replay shows block-knowable retained evidence, not proof of historical daemon ingestion time.'),
    el('p','meta',`Replay digest ${shortReference(replay.outputDigest)}`)
  );
  root.append(boundary);
  addCaseBack(root);
}
async function loadCaseIntelligence(context) {
  const launchId=String(context?.launchId||'').toLowerCase();
  const requestId=++state.caseRequestId;
  show('case');
  setCaseHeading('FOUND SOMETHING.','WHY');
  const root=byId('case-file');
  root.replaceChildren(el('div','panel','Digging through the receipts…'));

  if(!/^[0-9a-f]{64}$/i.test(launchId)) {
    root.replaceChildren(el('div','panel error',"I can't tie this finding to a canonical Pons launch."));
    return;
  }

  try {
    const payload=await api('/api/miniapp/case-intelligence',{launchId});
    if(requestId!==state.caseRequestId) return;
    renderCaseWhy(payload,{...context,launchId});
  } catch(error) {
    if(requestId!==state.caseRequestId) return;
    root.replaceChildren(el('div','panel error',"Lost the trail. I can't verify this Case right now."));
  }
}

async function api(path, body) {
  const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData:state.initData,...body})});
  const data=await response.json().catch(()=>({error:'INVALID_RESPONSE'})); if(!response.ok) throw new Error(data.error||`HTTP_${response.status}`); return data;
}
async function loadCase(caseId) {
  show('case');
  setCaseHeading('PROOF','RECEIPTS');
  const root=byId('case-file');
  root.replaceChildren(el('div','panel','Checking the receipts…'));
  try {
    const {receipt}=await api('/api/miniapp/case',{caseId});
    root.replaceChildren();
    setCaseHeading(receipt.chainId===4663?'PROOF / PONS 4663':'PROOF / HISTORICAL EVIDENCE','RECEIPTS');
    const ponsDeployer=receipt.chainId===4663 && receipt.subject?.entityType==='CREATOR';
    const head=el('article','card');
    head.append(
      el('p','eyebrow','RETAINED CASE'),
      el('h3','',shortReference(receipt.subject.entityId)),
      el('p','fact',ponsDeployer
        ? `Receipts connect ${receipt.evidenceRefs?.length||0} launch${receipt.evidenceRefs?.length===1?'':'es'} to this exact Pons-reported deployer.`
        : `Receipts connect ${receipt.evidenceRefs?.length||0} retained launch${receipt.evidenceRefs?.length===1?'':'es'} to this case subject.`),
      el('p','meta',`Coverage ${receipt.coverage.status} · as of block ${receipt.coverage.asOfBlock} · up to ${receipt.coverage.limit} retained records.`)
    );
    root.append(head);
    for(const ref of receipt.evidenceRefs||[]) {
      const card=el('article','card');
      card.append(
        el('p','eyebrow','OBSERVED LAUNCH'),
        el('h3','',shortReference(ref.token||ref.launchId)),
        el('p','fact',`Block ${ref.blockNumber} · log ${ref.logIndex}`),
        el('p','meta',`launch ${ref.launchId}`),
        el('p','meta',`tx ${ref.txHash}`),
        el('p','meta',`block hash ${ref.blockHash}`),
        el('p','meta',`fact ${ref.factId}`)
      );
      root.append(card);
    }
    const boundary=el('article','panel');
    boundary.append(
      el('p','eyebrow','CLAIM BOUNDARY'),
      el('p','unknown','Human identity, intent, safety, profitability and future outcome remain unknown. Same address does not establish the same human identity.')
    );
    const back=el('button','inspect','BACK');
    back.type='button';
    back.addEventListener('click',backView);
    root.append(boundary,back);
  } catch(error) {
    root.replaceChildren(el('div','panel error',"Lost the trail. I can't verify this receipt right now."));
  }
}

async function start() {
  tg?.ready(); tg?.expand(); syncTelegramBackButton();
  if(location.hostname.endsWith('.workers.dev')) fetch('/health').then(r=>r.json()).then(h=>{if(!state.data) byId('health').textContent=`Service ${h.ok?'online':'unavailable'} · release ${h.releaseSha||'unknown'}`;}).catch(()=>{});
  if(!state.initData) {
    byId('health').textContent='Telegram context unavailable. Open @BinratBot to access private Rat data.';
    byId('source-badge').textContent='TELEGRAM ONLY';
    byId('launch-list').append(el('div','panel','Private launch data is available inside the authenticated Telegram Mini App.'));
    byId('rat-list').append(el('div','panel','Fresh Garbage is available inside the authenticated Telegram Mini App session.'));
    byId('watch-list').append(el('div','panel','Authentication required.'));
    return;
  }
  try {
    const data=await api('/api/miniapp/bootstrap',{});
    renderBootstrap(data);
    const params=new URL(location.href).searchParams;
    const requestedCase=params.get('case');
    const requestedView=params.get('view');
    if(requestedCase) await loadCase(requestedCase);
    else if(['home','launches','rats','watches','about'].includes(requestedView)) show(requestedView);
  }
  catch(error) {
    byId('health').classList.add('error');
    byId('health').textContent=`Private access unavailable: ${error.message}`;
    byId('source-badge').textContent='LOCKED';
  }
}
start();
