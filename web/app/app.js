const tg = window.Telegram?.WebApp;
const state = { initData: tg?.initData || '', data: null };
const byId = id => document.getElementById(id);
const el = (tag, className, text) => { const node=document.createElement(tag); if(className) node.className=className; if(text!==undefined) node.textContent=text; return node; };

function show(id) {
  document.querySelectorAll('.view').forEach(node => node.classList.toggle('active',node.id===id));
  document.querySelectorAll('nav button').forEach(node => node.classList.toggle('selected',node.dataset.view===id));
  window.scrollTo({top:0,behavior:'instant'});
}
document.addEventListener('click', event => {
  const target=event.target.closest('[data-view]'); if(target) show(target.dataset.view);
});

function healthLine(health) {
  return health?.ok && health.chainId===4663 && health.indexReady && health.liveCaughtUp && health.lastSyncError===null
    ? `PONS 4663 · READY · block ${health.checkpointBlock}` : 'Source unavailable or outside verified freshness. No new conclusion.';
}
function renderBootstrap(data) {
  state.data=data;
  byId('health').textContent=healthLine(data.sourceHealth);
  byId('source-badge').textContent=data.sourceHealth?.ok?'PONS 4663 LIVE':'NOT READY';
  const launches=byId('launch-list'); launches.replaceChildren();
  if(!data.latestLaunches?.length) launches.append(el('div','panel','No canonical Pons launches are available at this checkpoint.'));
  for(const launch of data.latestLaunches||[]) {
    const card=el('article','card');
    card.append(
      el('p','eyebrow',`BLOCK ${launch.blockNumber} · ${launch.priorLaunchCount>0?'REPEAT DEPLOYER':'NEW IN CURRENT INDEX'}`),
      el('h3','',launch.symbol?`${launch.symbol}`:(launch.name||'UNNAMED LAUNCH')),
      el('p','fact',launch.name||launch.token),
      el('p','meta',`Pons-reported deployer ${launch.deployer}`),
      el('p','meta',`${launch.priorLaunchCount} prior indexed launch${launch.priorLaunchCount===1?'':'es'} from these paws.`)
    );
    launches.append(card);
  }
  const rats=byId('rat-list'); rats.replaceChildren();
  if(!data.rats?.candidates?.length) rats.append(el('div','panel','Empty paws. No repeated deployers in current indexed coverage.'));
  for(const candidate of data.rats?.candidates||[]) {
    const card=el('article','card'); card.append(el('p','eyebrow',`RAT ${candidate.rankPosition} · ${candidate.recurrenceCount} INDEXED LAUNCHES`));
    const latest=candidate.latestLaunch||{};
    card.append(el('h3','',latest.symbol?`${latest.symbol} · SAME PAWS`:'SAME PAWS'));
    card.append(el('p','fact',`Latest indexed launch: ${latest.name||latest.token||'unknown'} · block ${latest.blockNumber||'—'}`));
    card.append(el('p','meta',candidate.entity.entityId));
    for(const reason of candidate.reasons||[]) card.append(el('p','meta',reason.text));
    card.append(el('p','unknown','UNKNOWN: identity, intent, safety and future outcome.'));
    const button=el('button','inspect','OPEN CASE'); button.type='button'; button.addEventListener('click',()=>loadCase(candidate.caseId)); card.append(button); rats.append(card);
  }
  const watches=byId('watch-list'); watches.replaceChildren();
  if(!data.watches?.length) watches.append(el('div','panel','Empty paws. No active watches.'));
  for(const watch of data.watches||[]) {
    const card=el('article','card'); card.append(el('p','eyebrow',`${watch.chainId} · ${watch.policy}`)); card.append(el('h3','',watch.entityId)); card.append(el('p','meta',`Future indexed launches after block ${watch.startBlock}.`)); watches.append(card);
  }
  const features=byId('feature-state'); features.replaceChildren();
  const f=data.features||{}; features.append(el('p','',`Autonomous Rat: ${f.autonomousRatEnabled?'ON':'OFF'}`),el('p','',`Telegram UI V2: ${f.telegramUiV2Enabled?'ON':'OFF'}`),el('p','',`Telegram media: ${f.telegramMediaEnabled?'ON':'OFF'}`),el('p','',`Public Rat: ${f.autonomousRatPublicEnabled?'ON':'OFF'}`));
}

async function api(path, body) {
  const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData:state.initData,...body})});
  const data=await response.json().catch(()=>({error:'INVALID_RESPONSE'})); if(!response.ok) throw new Error(data.error||`HTTP_${response.status}`); return data;
}
async function loadCase(caseId) {
  show('case'); const root=byId('case-file'); root.replaceChildren(el('div','panel','Verifying canonical receipt…'));
  try {
    const {receipt}=await api('/api/miniapp/case',{caseId}); root.replaceChildren();
    const head=el('article','card'); head.append(el('p','eyebrow',`${receipt.source} · CHAIN ${receipt.chainId}`),el('h3','',receipt.subject.entityId),el('p','meta',`Coverage ${receipt.coverage.status} · as of block ${receipt.coverage.asOfBlock} · up to ${receipt.coverage.limit} retained records.`)); root.append(head);
    for(const ref of receipt.evidenceRefs||[]) { const card=el('article','card'); card.append(el('p','eyebrow','OBSERVED LAUNCH RECEIPT'),el('h3','',ref.launchId),el('p','fact',`Block ${ref.blockNumber} · log ${ref.logIndex}`),el('p','meta',`tx ${ref.txHash}`),el('p','meta',`block hash ${ref.blockHash}`),el('p','meta',`fact ${ref.factId}`)); root.append(card); }
    const boundary=el('article','panel'); boundary.append(el('p','unknown','UNKNOWN: human identity, intent, safety, profitability and future outcome. Same address does not establish the same human identity.')); root.append(boundary);
  } catch(error) { root.replaceChildren(el('div','panel error',`Case unavailable: ${error.message}`)); }
}

async function start() {
  tg?.ready(); tg?.expand();
  if(location.hostname.endsWith('.workers.dev')) fetch('/health').then(r=>r.json()).then(h=>{if(!state.data) byId('health').textContent=`Service ${h.ok?'online':'unavailable'} · release ${h.releaseSha||'unknown'}`;}).catch(()=>{});
  if(!state.initData) { byId('health').textContent='Telegram context unavailable. Open @BinratBot to access private Rat data.'; byId('source-badge').textContent='TELEGRAM ONLY'; byId('launch-list').append(el('div','panel','Private launch data is available inside the authenticated Telegram Mini App.')); byId('rat-list').append(el('div','panel','Private Rat data is not exposed outside an authenticated Telegram Mini App session.')); byId('watch-list').append(el('div','panel','Authentication required.')); return; }
  try { const data=await api('/api/miniapp/bootstrap',{}); renderBootstrap(data); const requested=new URL(location.href).searchParams.get('case'); if(requested) await loadCase(requested); }
  catch(error) { byId('health').classList.add('error'); byId('health').textContent=`Private access unavailable: ${error.message}`; byId('source-badge').textContent='LOCKED'; }
}
start();
