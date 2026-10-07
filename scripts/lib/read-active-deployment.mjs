// Read-only, scoped provider verification. Credentials stay in process memory.
export async function readActiveDeployment({accountId,token,workerName},fetchImpl=fetch) {
  if(!/^[0-9a-f]{32}$/.test(accountId??'')||!token||!['binrat-edge-v0','binrat-read-plane-stability-candidate'].includes(workerName))
    throw new Error('LIVE_PROVIDER_READBACK_REQUIRED');
  const response=await fetchImpl('https://api.cloudflare.com/client/v4/accounts/'+accountId+'/workers/scripts/'+encodeURIComponent(workerName)+'/deployments',
    {method:'GET',redirect:'error',headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error('LIVE_PROVIDER_READBACK_UNAVAILABLE');
  const text=await response.text();if(text.length>1_000_000) throw new Error('PROVIDER_RESPONSE_TOO_LARGE');
  const value=JSON.parse(text),active=value.result?.deployments?.[0];
  if(value.success!==true||!active||active.versions?.length!==1||active.versions[0].percentage!==100||
    !/^[0-9a-f-]{36}$/.test(active.versions[0].version_id)) throw new Error('LIVE_PROVIDER_DEPLOYMENT_UNVERIFIED');
  return {workerName,workerRevisionId:active.versions[0].version_id,capturedAtMs:Date.now()};
}
export function assertStableDeployment(expected,observed) {
  if(expected.workerName!==observed.workerName||expected.workerRevisionId!==observed.workerRevisionId)
    throw new Error('DEPLOYMENT_CHANGED_DURING_ACCEPTANCE');
}
