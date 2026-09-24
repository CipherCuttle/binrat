import { useEffect, useState } from "react";
import { loadLiveRecipientActivity, type PublicRadarActivity, type PublicRecipientActivity } from "./recipientActivity";
import type { DataMode } from "./data";
import { CopyButton } from "./Primitives";

const isAddress = (value: string) => /^0x[0-9a-f]{40}$/i.test(value);
const short = (value: string) => value.length > 20 ? value.slice(0, 10) + "…" + value.slice(-8) : value;

/** Exact validated activity, not an inferred activity-type classification. */
function ActivityEvidenceSheet({ activity, checkpoint, onClose }: {
  activity: PublicRadarActivity; checkpoint: string; onClose: () => void;
}) {
  const fields: Array<[string, string]> = [
    ["ACTIVITY ID", activity.activityId], ["EVIDENCE DIGEST", activity.evidenceDigest],
    ["BLOCK", activity.blockNumber], ["BLOCK HASH", activity.blockHash],
    ["TRANSACTION", activity.txHash], ["LOG INDEX", String(activity.logIndex)],
    ["LAUNCH ID", activity.launchId], ["POOL", activity.pool],
    ["LAUNCHED TOKEN", activity.token], ["SENDER / PROTOCOL ROLE", activity.sender],
    ["RECIPIENT / PROTOCOL ROLE", activity.recipient],
    ["TOKEN SIDE", activity.tokenSide], ["SIGNED TOKEN DELTA", activity.launchedTokenDelta],
    ["BACKEND FLOW LABEL", activity.launchedTokenFlow],
  ];
  return <section className="ns-activity-sheet" aria-labelledby="activity-sheet-title">
    <header className="ns-paper-head"><span>04 / EXACT PUBLIC OBJECT</span>
      <button type="button" onClick={onClose}>CLOSE ×</button></header>
    <h3 id="activity-sheet-title">ACTIVITY EVIDENCE</h3>
    <p className="ns-note">ARC 5042 · V3 SWAP RECIPIENT · ACTIVITY CHECKPOINT {checkpoint}</p>
    <dl className="ns-facts">{fields.map(([label, value]) => <div key={label}>
      <dt>{label}</dt><dd><code>{value}</code><CopyButton label={label.toLowerCase()} value={value}/></dd>
    </div>)}</dl>
    <a className="ns-raw-link" target="_blank" rel="noopener noreferrer"
      href={"/api/rat-radar/activity/" + encodeURIComponent(activity.activityId)}>
      OPEN EXACT PUBLIC ACTIVITY JSON ↗
    </a>
    <p className="ns-caution">Structural validation only. This evidence digest came from the backend and has not been independently rehashed here. Protocol roles do not establish human identity or trading intent.</p>
  </section>;
}

/** Independent GET for an exact address. A failure or a non-shortlisted address is never substituted. */
export function RecipientActivityPanel({ address, mode, shortlistCheckpoint }: {
  address: string; mode: DataMode; shortlistCheckpoint?: string;
}) {
  const [data, setData] = useState<PublicRecipientActivity | null>(null);
  const [pending, setPending] = useState(mode === "LIVE");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setData(null); setError(null); setSelectedId(null);
    if (mode !== "LIVE" || !isAddress(address)) { setPending(false); return; }
    setPending(true);
    loadLiveRecipientActivity(address)
      .then(result => { if (active) setData(result); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "RAT_RADAR_RECIPIENT_ACTIVITY_UNAVAILABLE");
      })
      .finally(() => { if (active) setPending(false); });
    return () => { active = false; };
  }, [address, mode]);
  const selected = data?.activities.find(activity => activity.activityId === selectedId);
  return <section className="ns-recipient" aria-label={"Recipient activity for " + address}>
    <header className="ns-paper-head"><span>03 / OBSERVED RECIPIENT FILE</span><span>{mode} · ARC 5042</span></header>
    <h3>RECIPIENT FILE</h3>
    <div className="ns-address"><code>{address}</code><CopyButton label="exact recipient address" value={address}/></div>
    {shortlistCheckpoint && <p className="ns-note">SHORTLIST CHECKPOINT {shortlistCheckpoint}. Recipient activity is loaded at its own checkpoint.</p>}
    {mode === "DEMO" ? <p className="ns-status">SYNTHETIC SHORTLIST. This demo does not invent individual activity receipts. Switch to PUBLIC LIVE to query this address.</p> :
      pending ? <p role="status" className="ns-status">LOADING EXACT PUBLIC RECIPIENT ACTIVITY…</p> :
      error ? <p role="alert" className="ns-error">ACTIVITY UNAVAILABLE: {error}. No count or alternate address was substituted.</p> :
      !data ? <p role="status" className="ns-status">NO PUBLIC ACTIVITY RESPONSE LOADED.</p> :
      <>
        <div className="ns-stats" aria-label="Exact recipient activity facts">
          <div><span>INDEXED ACTIVITIES</span><strong>{data.activityCount}</strong></div>
          <div><span>ACTIVITY AS OF BLOCK</span><strong>{data.asOfBlock}</strong></div>
          <div><span>EVIDENCED ROLE</span><strong>V3 SWAP RECIPIENT</strong></div>
        </div>
        {data.activities.length === 0 ? <p className="ns-status">This exact recipient has an indexed empty result at block {data.asOfBlock}; the endpoint did not fail.</p> :
          <div className="ns-activity-list" aria-label="Exact public activity objects">
            <h4>INDEXED ACTIVITY / {data.activityCount}</h4>
            {data.activities.map(activity => <button key={activity.activityId} type="button"
              className={selectedId === activity.activityId ? "ns-activity-row selected" : "ns-activity-row"}
              aria-expanded={selectedId === activity.activityId}
              onClick={() => setSelectedId(current => current === activity.activityId ? null : activity.activityId)}>
              <span><b>{short(activity.activityId)}</b><small>ID · BLOCK {activity.blockNumber}</small></span>
              <span><b>{activity.launchedTokenFlow}</b><small>BACKEND FLOW LABEL</small></span>
              <span aria-hidden="true">↗</span>
            </button>)}
          </div>}
        {selected && <ActivityEvidenceSheet activity={selected} checkpoint={data.asOfBlock} onClose={() => setSelectedId(null)}/>}
        <p className="ns-caution">{data.identityBoundary} Recurrence is not a safety score or investment recommendation.</p>
      </>}
  </section>;
}
