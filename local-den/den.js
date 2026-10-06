const $ = id => document.getElementById(id);
const token = document.querySelector('meta[name="binrat-local-token"]').content;
const phases = { READY:'Ready', WAITING:'Waiting for replay', FOUND:'Found something', EXPIRED:'Replay ended', EXHAUSTED:'Budget spent', CANCELLED:'Cancelled', HALTED:'Halted' };
const outcomes = { PENDING:'The job is saved. Run the next replay step when you return.', SUPPORTED_FINDING:'A funded recipient later deployed on Pons. The supplied receipts support this change.', NO_FINDING_IN_REPLAY_WINDOW:'No supported launch was found in this synthetic tape. This says nothing about real chain activity.', INCOMPLETE_COVERAGE:'The replay ended with missing history. This cannot be treated as a clean result.', TOOL_BUDGET_EXHAUSTED:'The original replay budget stopped work. No Case or notification was admitted.', LOCAL_STEP_LIMIT:'The local step limit stopped this replay.', OWNER_CANCELLED:'Cancelled. No later replay step will run for this job.', SOURCE_REJECTED:'A source receipt failed validation. The last completed prefix is retained; no retry runs automatically.' };
const claimLabels = { NATIVE_TRANSFER_OBSERVED:'The supplied transfer funded this recipient.', RECIPIENT_NOT_SEEN_IN_WINDOW:'The recipient was absent from the supplied history window.', PONS_REPORTED_DEPLOYER_LAUNCH:'Pons reported a deployment by this recipient.', FUNDING_PRECEDES_LAUNCH:'The funding transaction occurred before the launch.' };
const scenarioNames = { 'recorded-pons-funding':'Recorded funding relation', 'local-den-finding':'Later launch', 'local-den-no-launch':'No later launch', 'local-den-incomplete-history':'Missing history', 'local-den-exhausted':'Budget stop' };
let jobs = [], selected = '', busy = false, stale = true, requestId = null, reloadSession = false;
const live = message => { $('notice').textContent = message; };
function text(tag, value, className) { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; }
function nextBlock(job) { const cursor = BigInt(job.receipt?.throughBlock ?? '-1'); return (job.replaySteps ?? ['100','101','125','130']).find(block => BigInt(block) > cursor); }
function controls() {
  $('start').disabled = busy || stale || jobs.length >= 24;
  $('scenario').disabled = busy || stale;
  $('refresh').disabled = busy; $('retry').disabled = busy;
  const job = jobs.find(item => item.jobId === selected);
  const active = job?.verification === 'VERIFIED' && ['READY','WAITING'].includes(job.phase);
  $('advance').disabled = busy || stale || !active || !nextBlock(job);
  $('cancel').disabled = busy || stale || !active;
  $('export').disabled = busy || stale || !job;
  for (const node of document.querySelectorAll('.job-item')) node.disabled = busy;
}
function render() {
  $('jobs').replaceChildren(); $('empty').hidden = jobs.length > 0;
  for (const job of jobs) {
    const button = text('button', '', 'job-item'); button.type = 'button'; button.dataset.job = job.jobId;
    button.setAttribute('aria-pressed', String(selected === job.jobId));
    button.append(text('strong', scenarioNames[job.evalId] ?? 'Funding trail'), text('span', job.verification === 'VERIFIED' ? phases[job.phase] : 'Receipts unavailable'), text('small', `REPLAY · ${job.jobId.slice(-8)}`));
    button.addEventListener('click', () => choose(job.jobId, true)); $('jobs').append(button);
  }
  const job = jobs.find(item => item.jobId === selected); $('detail').hidden = !job;
  $('case').hidden = true; $('notification').hidden = true; $('receipts').hidden = true;
  if (job) {
    const verified = job.verification === 'VERIFIED'; const recorded = job.mode === 'LOCAL_RECORDED_REPLAY'; $('detail').dataset.phase = verified ? job.phase : 'HALTED';
    $('job-label').textContent = `${scenarioNames[job.evalId] ?? 'FUNDING TRAIL'} · REPLAY ${job.jobId.slice(-8)}`;
    $('detail-title').textContent = verified ? phases[job.phase] : 'Receipts unavailable';
    $('phase').textContent = verified ? job.phase : 'UNVERIFIED';
    $('outcome').textContent = verified ? outcomes[job.outcome] : 'This saved job failed verification. Its source and journal are retained for export; controls are paused.';
    const incomplete = !verified || job.receipt?.status === 'DEGRADED' || job.phase === 'HALTED';
    $('coverage').className = incomplete ? 'coverage warning' : 'coverage';
    $('coverage').textContent = !verified ? 'Saved evidence unavailable or unverified.' : recorded ? 'Provider-reported RPC responses · retrospective · recipient history unavailable.' : incomplete ? 'Incomplete or unavailable coverage · synthetic evidence only.' : 'Declared synthetic fixture window only · no live evidence.';
    $('timeline').dataset.mode = recorded ? 'recorded' : 'synthetic'; $('timeline').replaceChildren(); $('metrics').replaceChildren();
    if (verified) {
      for (const [block, name] of (recorded ? [[job.deadlineBlock,'Captured evidence']] : [['100','Funding'],['101','History'],['125','Later receipts'],['130','Deadline']])) {
        const step = text('li', name); step.append(text('small', `Block ${block}`));
        if (job.receipt && BigInt(job.receipt.throughBlock) >= BigInt(block)) step.className = 'complete';
        $('timeline').append(step);
      }
      for (const [label, value] of [['Replay tools',`${job.usage.toolCalls} / ${job.budget.maxToolCalls}`],['Handoffs',`${job.usage.handoffs} / ${job.budget.maxHandoffs}`],['Deadline',`Block ${job.deadlineBlock}`],['Model spend','$0.00']]) {
        const group = text('div', '', 'metric'); group.append(text('dt', label), text('dd', value)); $('metrics').append(group);
      }
      $('return-note').textContent = job.phase === 'HALTED' ? 'Usage describes the last completed prefix. Failed replay attempts are uncounted. The journal is preserved.' : 'Saved in your local SQLite file. Nothing runs while you are away.';
      if (job.localCase) {
        $('case').hidden = false; $('case-provenance').textContent = recorded ? 'RECORDED CASE · RETROSPECTIVE RELATION' : 'SYNTHETIC CASE · SUPPORTED CHANGE'; $('claims').replaceChildren();
        for (const claim of job.localCase.diff.addedClaims) $('claims').append(text('li', `${claimLabels[claim.kind]} Receipts: ${claim.evidenceRefs.join(', ')}.`));
        $('finding-id').textContent = `Finding ${job.localCase.findingId}`;
      }
      if (job.notification) { $('notification').hidden = false; $('notification-text').textContent = job.notification.text; }
      if (job.receipt?.evidence.length) {
        $('receipts').hidden = false; $('receipt-caption').textContent = recorded ? 'Recorded receipt availability' : 'Synthetic receipt availability'; $('receipt-summary').textContent = `Saved receipts (${job.receipt.evidence.length})`;
        $('receipt-rows').replaceChildren();
        for (const receipt of job.receipt.evidence) {
          const row = text('tr', ''); row.append(text('td', receipt.id), text('td', receipt.blockNumber), text('td', receipt.availableAtBlock)); $('receipt-rows').append(row);
        }
      }
    } else $('return-note').textContent = 'Export is raw, unverified evidence. It does not admit claims or alerts.';
    $('advance').hidden = !verified || !['READY','WAITING'].includes(job.phase);
    $('cancel').hidden = $('advance').hidden;
  }
  controls();
}
function choose(id, focus = false) { selected = id; history.replaceState(null, '', `#job=${encodeURIComponent(id)}`); render(); if (focus) $('detail').focus(); }
async function api(path, method = 'GET', data) {
  const response = await fetch(path, { method, headers: { 'x-binrat-local-token': token, ...(method === 'POST' ? {'content-type':'application/json'} : {}) },
    ...(data !== undefined ? {body:JSON.stringify(data)} : {}), signal:AbortSignal.timeout(12000), cache:'no-store' });
  const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'LOCAL_DEN_FAILED'); return result;
}
async function refresh() {
  const data = await api('/api/jobs');
  if (!['LOCAL_REPLAY','LOCAL_SYNTHETIC_REPLAY'].includes(data.mode) || !Array.isArray(data.jobs) || data.jobs.length > 24 || data.jobs.some(job => {
    if (!job || typeof job.jobId !== 'string' || !/^[a-zA-Z0-9_:-]{1,100}$/.test(job.jobId)) return true;
    if (job.verification === 'FAILED') return typeof job.error !== 'string';
    return job.verification !== 'VERIFIED' || !['LOCAL_SYNTHETIC_REPLAY','LOCAL_RECORDED_REPLAY'].includes(job.mode) || !Object.hasOwn(phases,job.phase) ||
      !Object.hasOwn(outcomes,job.outcome) || !Array.isArray(job.replaySteps) || !job.replaySteps.length || job.replaySteps.length > 32 || job.replaySteps.some(block => typeof block !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(block)) || !job.budget || !job.usage ||
      !Number.isInteger(job.usage.toolCalls) || !Number.isInteger(job.budget.maxToolCalls) ||
      job.usage.toolCalls < 0 || job.usage.toolCalls > job.budget.maxToolCalls ||
      !Number.isInteger(job.usage.handoffs) || !Number.isInteger(job.budget.maxHandoffs) ||
      job.usage.handoffs < 0 || job.usage.handoffs > job.budget.maxHandoffs ||
      job.usage.modelCalls !== 0 || job.usage.costMicrousd !== 0 ||
      typeof job.deadlineBlock !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(job.deadlineBlock) ||
      (job.receipt && (typeof job.receipt.throughBlock !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(job.receipt.throughBlock) || !Array.isArray(job.receipt.evidence))) ||
      (job.phase === 'FOUND' && (!job.localCase?.diff || !Array.isArray(job.localCase.diff.addedClaims) || !job.notification)) ||
      (job.notification && (job.notification.state !== 'PREPARED_ONLY' || job.notification.deliveryAuthorized !== false));
  })) throw new Error('LOCAL_RESPONSE_INVALID');
  jobs = data.jobs; stale = false; reloadSession = false; $('retry').textContent = 'Refresh saved jobs'; $('error').hidden = true;
  if (requestId && jobs.some(job => job.jobId === `local-den-${requestId}`)) {
    selected = `local-den-${requestId}`; requestId = null;
    history.replaceState(null,'',`#job=${encodeURIComponent(selected)}`);
  }
  if (!jobs.some(job => job.jobId === selected)) selected = jobs[0]?.jobId ?? '';
  render(); live(jobs.length ? `${jobs.length} saved replay ${jobs.length === 1 ? 'job' : 'jobs'}. No background work is running.` : 'The Den is empty. Start a replay job.');
}
async function action(operation, message = 'Saved.', focusDetail = false) {
  if (busy) return; busy = true; controls(); live('Checking saved receipts…');
  try { await operation(); await refresh(); live(message); if (focusDetail && !$('detail').hidden) $('detail').focus(); }
  catch (error) {
    stale = true; $('error').hidden = false;
    reloadSession = error.message === 'LOCAL_TOKEN_REQUIRED';
    $('retry').textContent = reloadSession ? 'Reload local Den' : 'Refresh saved jobs';
    $('error-text').textContent = reloadSession ? 'The local server session changed. Reload the Den to reconnect; saved jobs are retained.' :
      error.message === 'LOCAL_DEN_CAPACITY' ? 'This local Den has reached its 24-job limit. Existing evidence is retained.' :
      'Could not confirm a fresh result. The saved screen may be stale. Refresh before another action; nothing is retried automatically.';
    live('Controls paused until a successful refresh.'); $('retry').focus();
  } finally { busy = false; controls(); }
}
$('start-form').addEventListener('submit', event => {
  event.preventDefault(); if (busy || stale) return;
  requestId ??= crypto.randomUUID();
  action(async () => { const job = await api('/api/jobs','POST',{scenario:$('scenario').value,requestId}); selected = job.jobId;
    history.replaceState(null,'',`#job=${encodeURIComponent(selected)}`); requestId = null; }, 'Replay job saved. You can leave and return.', true);
});
$('advance').addEventListener('click', () => {
  const job = jobs.find(item => item.jobId === selected); if (!job || stale || busy) return;
  action(() => api(`/api/jobs/${encodeURIComponent(selected)}/advance`,'POST',{throughBlock:nextBlock(job)}), 'Replay checkpoint saved.', true);
});
$('cancel').addEventListener('click', () => { if (!stale && !busy) action(() => api(`/api/jobs/${encodeURIComponent(selected)}/cancel`,'POST',{}),'Replay job cancelled.', true); });
$('export').addEventListener('click', () => {
  if (stale || busy) return;
  action(async () => { const value = await api(`/api/jobs/${encodeURIComponent(selected)}/export`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = `${selected}-evidence.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }, 'Raw evidence exported. It is labelled unverified.');
});
$('refresh').addEventListener('click', () => action(async () => {}, 'Saved jobs refreshed.'));
$('retry').addEventListener('click', () => { if (reloadSession) location.reload(); else action(async () => {}, 'Saved jobs refreshed.'); });
try { selected = decodeURIComponent(location.hash.startsWith('#job=') ? location.hash.slice(5) : ''); } catch { selected = ''; }
action(async () => {}, 'Saved Den opened. Offline replay only.', Boolean(selected));
