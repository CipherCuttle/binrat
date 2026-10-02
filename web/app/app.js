const tg = window.Telegram?.WebApp;
const state = {
  initData: tg?.initData || '',
  hot: null,
  latest: null,
  watches: [],
  view: 'home',
  viewStack: [],
  indexSurfaceReady: false
};
const byId = id => document.getElementById(id);
const el = (tag, className, text) => {
  const node=document.createElement(tag);
  if(className) node.className=className;
  if(text!==undefined) node.textContent=text;
  return node;
};

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
  const target=event.target.closest('[data-view]');
  if(target) show(target.dataset.view);
});

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
function setCaseHeading(kicker,title) {
  byId('case-kicker').textContent=kicker;
  byId('case-title').textContent=title;
}
function knownLaunches() {
  const hot=(state.hot?.candidates||[]).flatMap(candidate => [
    candidate.latestLaunch,
    ...(candidate.previousLaunches||[])
  ]);
  const latest=state.latest?.launches||[];
  return [...hot,...latest].filter(Boolean);
}
function watchLabels(watch) {
  const target=String(watch.entityId||'').toLowerCase();
  const labels=knownLaunches()
    .filter(launch => String(launch.deployer||'').toLowerCase()===target)
    .map(launchLabel);
  return [...new Set(labels)].slice(0,3);
}
function surfaceError(root,message,retry) {
  root.replaceChildren();
  const panel=el('div','panel error',message);
  const button=el('button','inspect','TRY AGAIN');
  button.type='button';
  button.addEventListener('click',retry);
  root.append(panel,button);
}
function markIndexReady() {
  state.indexSurfaceReady=true;
  byId('source-badge').textContent='LIVE';
}

function renderHot(hotGarbage) {
  state.hot=hotGarbage;
  const root=byId('hot-list');
  root.replaceChildren();
  const candidates=hotGarbage?.candidates||[];
  if(!candidates.length) {
    root.append(el('div','panel','Empty paws. No recent repeat-deployer trail is hot enough to show right now.'));
    return;
  }
  for(const [index,candidate] of candidates.entries()) {
    const latest=candidate.latestLaunch||{};
    const prior=Math.max(1,Number(candidate.recurrenceCount||1)-1);
    const remembered=Number(candidate.memory?.rememberedPriorLaunches||0);
    const receipts=Number(candidate.memory?.outcomeReceipts||0);
    const card=el('article','card');
    card.append(
      el('p','eyebrow',`HOT GARBAGE · ${index+1}/${candidates.length}`),
      el('h3','',launchLabel(latest)),
      el('p','fact',`Same paws launched ${prior} time${prior===1?'':'s'} before.`)
    );
    if(remembered>0) {
      card.append(el('p','meta',`Rat memory: ${receipts} outcome receipt${receipts===1?'':'s'} across ${remembered} older launch${remembered===1?'':'es'}.`));
    } else {
      card.append(el('p','meta','Older launches found. Outcome memory is still thin.'));
    }
    const button=el('button','primary','DIG');
    button.type='button';
    button.addEventListener('click',()=>renderTrail({
      latestLaunch:latest,
      previousLaunches:candidate.previousLaunches||[],
      deployer:candidate.deployer,
      recurrenceCount:candidate.recurrenceCount,
      memory:candidate.memory,
      origin:'hot'
    }));
    card.append(button);
    root.append(card);
  }
}

function renderLatest(data) {
  state.latest=data;
  const root=byId('launch-list');
  root.replaceChildren();
  const launches=data?.launches||[];
  if(!launches.length) {
    root.append(el('div','panel','Empty paws. No new indexed launches are available right now.'));
    return;
  }
  for(const launch of launches) {
    const prior=Number(launch.priorLaunchCount||0);
    const card=el('article','card');
    card.append(
      el('p','eyebrow',prior>0?'FAMILIAR PAWS':'NEW DROP'),
      el('h3','',launchLabel(launch)),
      el('p','fact',prior>0
        ? `Same paws launched ${prior} time${prior===1?'':'s'} before.`
        : 'First indexed launch from these paws in current coverage.')
    );
    const button=el('button','primary','DIG');
    button.type='button';
    button.addEventListener('click',()=>renderTrail({
      latestLaunch:launch,
      previousLaunches:[],
      deployer:launch.deployer,
      recurrenceCount:prior+1,
      memory:null,
      origin:'launches'
    }));
    card.append(button);
    root.append(card);
  }
}

function renderWatches(data) {
  state.watches=data?.watches||[];
  const root=byId('watch-list');
  root.replaceChildren();
  if(!state.watches.length) {
    root.append(el('div','panel','Empty paws. Nothing is on Rat Watch yet.'));
    return;
  }
  for(const watch of state.watches) {
    const labels=watchLabels(watch);
    const card=el('article','card');
    card.append(
      el('p','eyebrow','RAT WATCH'),
      el('h3','',labels.length?labels.join(' · '):'WATCHED PAWS'),
      el('p','fact',"I'll squeak if these paws launch again."),
      el('p','meta',shortReference(watch.entityId))
    );
    root.append(card);
  }
}

function renderRatTrap(root,ratTrap) {
  root.replaceChildren();
  root.append(
    el('p','eyebrow',ratTrap.heading||'RAT TRAP'),
    el('p','',ratTrap.deck||'What happened the other times these paws showed up?'),
    el('p','fact',ratTrap.summary?.coverageText||'Outcome trail unavailable.')
  );

  for(const launch of ratTrap.launches||[]) {
    const card=el('article','card');
    card.append(
      el('p','eyebrow','PRIOR LAUNCH'),
      el('h3','',launch.label||'UNKNOWN LAUNCH'),
      el('p','meta',launch.memoryText||'Outcome trail unavailable.')
    );
    if(launch.highestObservedText) {
      card.append(el('p','fact',`Highest supported sample: ${launch.highestObservedText}`));
    }
    root.append(card);
  }

  if(ratTrap.summary?.canOfferRatWatch) {
    const watch=el('article','panel');
    watch.append(
      el('p','eyebrow','RAT WATCH'),
      el('p','','Enough remembered history to keep these paws on Rat Watch.'),
      el('p','meta','Watch changes stay in Telegram chat in this read-only Mini App.')
    );
    const button=el('button','inspect','SEE RAT WATCH');
    button.type='button';
    button.dataset.view='watches';
    watch.append(button);
    root.append(watch);
  }

  root.append(el('p','note',ratTrap.footer||'Observed history, not a prediction.'));
}

async function openReceiptsForDeployer(deployer,button) {
  if(!/^0x[0-9a-f]{40}$/i.test(String(deployer||''))) return;
  const previous=button.textContent;
  button.disabled=true;
  button.textContent='DIGGING…';
  try {
    const {receipt}=await api('/api/miniapp/dig',{deployer});
    renderReceipt(receipt);
  } catch {
    button.textContent="LOST THE TRAIL";
    button.classList.add('error');
    return;
  }
  button.textContent=previous;
  button.disabled=false;
}

async function renderTrail(input) {
  show('case');
  setCaseHeading('DUG IT UP.','TRASH TRAIL');
  const root=byId('case-file');
  root.replaceChildren();

  const latest=input.latestLaunch||{};
  const previous=(input.previousLaunches||[]).slice(0,3).map(launchLabel);
  const prior=Math.max(0,Number(input.recurrenceCount||1)-1);
  const head=el('article','card');
  head.append(
    el('p','eyebrow','CURRENT DROP'),
    el('h3','',launchLabel(latest)),
    el('p','fact',prior>0
      ? `Same paws have ${prior} earlier indexed launch${prior===1?'':'es'}.`
      : 'No earlier indexed launch from these paws is in current coverage.')
  );
  if(previous.length) head.append(el('p','meta',`Recent scraps: ${previous.join(' · ')}`));
  if(input.memory?.rememberedPriorLaunches>0) {
    head.append(el('p','meta',`Rat memory: ${input.memory.outcomeReceipts} outcome receipts retained.`));
  }
  root.append(head);

  const trap=el('article','panel');
  trap.append(
    el('p','eyebrow','RAT TRAP'),
    el('p','','Checking what happened after the other launches from these paws…')
  );
  root.append(trap);

  const receipts=el('button','primary','RECEIPTS');
  receipts.type='button';
  receipts.addEventListener('click',()=>openReceiptsForDeployer(input.deployer,receipts));
  const back=el('button','inspect','BACK');
  back.type='button';
  back.addEventListener('click',backView);
  root.append(receipts,back);

  if(!/^[0-9a-f]{64}$/i.test(String(latest.launchId||''))) {
    trap.replaceChildren(
      el('p','eyebrow','RAT TRAP'),
      el('p','','I cannot tie this trail to a current Pons launch yet.')
    );
    return;
  }

  try {
    const {ratTrap}=await api('/api/miniapp/rat-trap',{launchId:latest.launchId});
    renderRatTrap(trap,ratTrap);
  } catch {
    trap.replaceChildren(
      el('p','eyebrow','RAT TRAP'),
      el('p','','Lost part of the trail. I cannot verify the outcome memory right now.')
    );
  }
}

async function api(path,body) {
  const response=await fetch(path,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({initData:state.initData,...body})
  });
  const data=await response.json().catch(()=>({error:'INVALID_RESPONSE'}));
  if(!response.ok) throw new Error(data.error||`HTTP_${response.status}`);
  return data;
}

function renderReceipt(receipt) {
  show('case');
  setCaseHeading(receipt.chainId===4663?'PROOF / PONS 4663':'PROOF / HISTORICAL EVIDENCE','RECEIPTS');
  const root=byId('case-file');
  root.replaceChildren();
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
}

async function loadCase(caseId) {
  show('case');
  setCaseHeading('PROOF','RECEIPTS');
  const root=byId('case-file');
  root.replaceChildren(el('div','panel','Checking the receipts…'));
  try {
    const {receipt}=await api('/api/miniapp/case',{caseId});
    renderReceipt(receipt);
  } catch {
    root.replaceChildren(el('div','panel error',"Lost the trail. I can't verify this receipt right now."));
  }
}

async function loadHot() {
  const root=byId('hot-list');
  root.replaceChildren(el('div','panel','Sniffing through the fresh trash…'));
  try {
    const {hotGarbage}=await api('/api/miniapp/hot',{});
    renderHot(hotGarbage);
    markIndexReady();
    return true;
  } catch {
    surfaceError(root,'Rat lost the scent. Hot Garbage is unavailable right now.',loadHot);
    return false;
  }
}

async function loadLatest() {
  const root=byId('launch-list');
  root.replaceChildren(el('div','panel','Checking the newest scraps…'));
  try {
    const data=await api('/api/miniapp/latest',{});
    renderLatest(data);
    markIndexReady();
    return true;
  } catch {
    surfaceError(root,'Rat lost the scent. New Drops are unavailable right now.',loadLatest);
    return false;
  }
}

async function loadWatches() {
  const root=byId('watch-list');
  root.replaceChildren(el('div','panel','Checking the tripwires…'));
  try {
    const data=await api('/api/miniapp/watches',{});
    renderWatches(data);
    return true;
  } catch {
    surfaceError(root,'Rat Watch is unavailable right now. Hot Garbage and New Drops can still work.',loadWatches);
    return false;
  }
}

async function start() {
  tg?.ready();
  tg?.expand();
  syncTelegramBackButton();

  if(!state.initData) {
    byId('source-badge').textContent='TELEGRAM ONLY';
    byId('hot-list').append(el('div','panel','Hot Garbage is available inside the authenticated Telegram Mini App.'));
    byId('launch-list').append(el('div','panel','New Drops are available inside the authenticated Telegram Mini App.'));
    byId('watch-list').append(el('div','panel','Authentication required.'));
    return;
  }

  const [hotOk,latestOk]=await Promise.all([loadHot(),loadLatest(),loadWatches()]).then(([hot,latest])=>[hot,latest]);
  if(!hotOk && !latestOk) byId('source-badge').textContent='QUIET';

  const params=new URL(location.href).searchParams;
  const requestedCase=params.get('case');
  const requestedView=params.get('view');
  if(requestedCase) await loadCase(requestedCase);
  else if(['home','hot','launches','watches','about'].includes(requestedView)) show(requestedView);
}
start();
