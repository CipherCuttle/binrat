const tg = window.Telegram?.WebApp;
const state = { initData: tg?.initData || '', data: null, view: 'home', viewStack: [] };
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
      el('p','eyebrow',launch.priorLaunchCount>0?'FAMILIAR PAWS':'NEW SCRAP'),
      el('h3','',launchLabel(launch)),
      el('p','fact',recurrence),
      el('p','meta',`Deployer ${shortReference(launch.deployer)} · block ${launch.blockNumber}`)
    );
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
    button.addEventListener('click',()=>renderTrail(candidate));
    card.append(button);
    rats.append(card);
  }

  const watches=byId('watch-list'); watches.replaceChildren();
  if(!data.watches?.length) watches.append(el('div','panel','Empty paws. Nothing is on Rat Watch yet.'));
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
      el('p','',"There is enough remembered outcome evidence to show Rat Watch for this exact source-reported deployer."),
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

async function renderTrail(candidate) {
  show('case');
  setCaseHeading('DUG IT UP.','TRASH TRAIL');
  const root=byId('case-file');
  root.replaceChildren();

  const latest=candidate.latestLaunch||{};
  const previous=(candidate.previousLaunches||[]).slice(0,3).map(launchLabel);
  const head=el('article','card');
  head.append(
    el('p','eyebrow','CURRENT LAUNCH'),
    el('h3','',launchLabel(latest)),
    el('p','fact',previous.length
      ? `This exact Pons-reported deployer also launched ${previous.join(' · ')}.`
      : 'This exact Pons-reported deployer has older indexed launches in the bin.'),
    el('p','meta',`Pons-reported deployer ${shortReference(candidate.entity?.entityId)}`)
  );
  root.append(head);

  const trap=el('article','panel');
  trap.append(
    el('p','eyebrow','TRASH TRAIL'),
    el('p','',"Checking what happened after prior launches from this exact Pons-reported deployer…")
  );
  root.append(trap);

  const receipts=el('button','primary','OPEN RECEIPTS');
  receipts.type='button';
  receipts.addEventListener('click',()=>loadCase(candidate.caseId));
  const back=el('button','inspect','BACK TO FRESH GARBAGE');
  back.type='button';
  back.addEventListener('click',backView);
  root.append(receipts,back);

  if(!/^[0-9a-f]{64}$/i.test(String(latest.launchId||''))) {
    trap.replaceChildren(
      el('p','eyebrow','TRASH TRAIL'),
      el('p','',"I can't tie this trail to a current Pons launch yet.")
    );
    return;
  }

  try {
    const {trashTrail}=await api('/api/miniapp/trash-trail',{launchId:latest.launchId});
    renderTrashTrail(trap,trashTrail);
  } catch {
    trap.replaceChildren(
      el('p','eyebrow','TRASH TRAIL'),
      el('p','',"Lost part of the trail. I can't verify the outcome memory right now.")
    );
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
