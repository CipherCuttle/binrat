import { useEffect, useState } from "react";
import { ponsCaseTelegramLink, requestPonsTripwire, telegramInitData, tripwireErrorMessage, type PonsTripwireWatchReceipt } from "./ponsTripwireClient";
import "./pons-tripwire.css";

/** The Case selects an exact reported address; the server derives owner and authority. */
export function PonsTripwireWatch({ caseId, deployer, fresh }: { caseId: string; deployer: string; fresh: boolean }) {
  const [initData, setInitData] = useState("");
  const [watch, setWatch] = useState<PonsTripwireWatchReceipt | null>(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    setLoading(true); setConfirmed(false); setChecked(false); setWatch(null); setError("");
    telegramInitData().then(async (credential) => {
      if (!mounted) return;
      setInitData(credential);
      if (!credential) { setLoading(false); return; }
      const reply = await requestPonsTripwire("status", { initData: credential, caseId, deployer, signal: controller.signal });
      if (mounted) { setWatch(reply.watch); setConfirmed(true); setLoading(false); }
    }).catch((cause: unknown) => {
      if (mounted) { setError(cause instanceof Error ? cause.message : "PONS_TRIPWIRE_UNAVAILABLE"); setLoading(false); }
    });
    return () => { mounted = false; controller.abort(); };
  }, [caseId, deployer, retry]);

  async function mutate(action: "watch" | "cancel") {
    if (busy || !initData || !confirmed || (action === "watch" && (!fresh || !checked))) return;
    setBusy(true); setError("");
    try {
      const reply = await requestPonsTripwire(action, { initData, caseId, deployer });
      if ((action === "watch" && reply.watch?.state !== "ACTIVE") || (action === "cancel" && reply.watch?.state === "ACTIVE")) {
        throw Error("PONS_TRIPWIRE_RESPONSE_INVALID");
      }
      setWatch(reply.watch); setChecked(false); setConfirmed(true);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "PONS_TRIPWIRE_UNAVAILABLE");
      // A lost HTTP reply may hide a committed mutation. Never infer success or retry it blindly.
      setConfirmed(false);
    } finally { setBusy(false); }
  }

  const active = watch?.state === "ACTIVE";
  return <section className="vl-evidence-surface pons-tripwire" aria-label="Watch this Pons deployer" data-watch-state={confirmed ? active ? "ACTIVE" : "INACTIVE" : "UNCONFIRMED"}>
    <div className="vl-section-title">TRIPWIRE <span>{loading ? "CHECKING" : confirmed && active ? "WATCHING" : "OWNER PILOT"}</span></div>
    <h3>WATCH THIS DEPLOYER</h3>
    <p>Get a Telegram alert when this exact Pons-reported address launches again. Open the new Case to inspect its receipts.</p>
    <code className="pons-tripwire-address">{deployer}</code>
    <p className="pons-tripwire-note">Future Pons V2 launches only. No historical alerts. A shared address does not identify a person.</p>
    {loading && <p role="status">Checking your saved Watch…</p>}
    {!loading && !initData && <>
      <a className="vl-utility" href={ponsCaseTelegramLink(caseId)} target="_blank" rel="noopener noreferrer">OPEN THIS CASE IN TELEGRAM ↗</a>
      <p className="pons-tripwire-note">Open the Case button from the bot, then choose Watch. Opening Telegram alone creates no Watch.</p>
    </>}
    {!loading && error && <p role="alert">{tripwireErrorMessage(error)}</p>}
    {!loading && initData && !confirmed && <button className="vl-utility" type="button" onClick={() => setRetry((value) => value + 1)} disabled={busy}>RECHECK SAVED WATCH</button>}
    {!loading && confirmed && active && <>
      <p role="status">Watch saved. Only launches after block <strong>{watch.startBlock}</strong> can alert you. It remains saved when you close this Case.</p>
      {watch.latestNotificationState === "UNKNOWN" && <p role="status">The last Telegram delivery could not be confirmed. That alert will not be sent again. Check the Case directly.</p>}
      {watch.latestNotificationState === "FAILED" && <p role="status">Telegram rejected the last alert. That alert will not be sent again. Check the Case directly.</p>}
      {!fresh && <p role="status">Updates paused. Alerts wait for verified Pons indexing.</p>}
      <button className="vl-utility" type="button" onClick={() => void mutate("cancel")} disabled={busy}>{busy ? "CONFIRMING…" : "CANCEL WATCH"}</button>
    </>}
    {!loading && confirmed && !active && <>
      {watch?.state === "CANCELLED" && <p role="status">Watch cancelled. No new alerts will be prepared. An alert already sending may still arrive.</p>}
      {watch?.state === "REORG" && <p role="status">Watch paused after a chain change. It cannot alert you. Re-arm only after reviewing fresh Pons evidence.</p>}
      {!fresh && <p role="status">Updates paused. Recheck the Case before creating a Watch.</p>}
      <label className="pons-tripwire-consent"><input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} disabled={busy || !fresh} /><span>I want Telegram alerts for future launches by this exact address.</span></label>
      <button className="vl-primary" type="button" onClick={() => void mutate("watch")} disabled={busy || !fresh || !checked}>{busy ? "CONFIRMING…" : "WATCH THIS DEPLOYER"}</button>
    </>}
  </section>;
}
