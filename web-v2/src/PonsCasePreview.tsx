import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlleyWorld } from "./VisualLab";
import caseScene from "../public/visual-lab/case-scenes/case-neon-alley.webp";
import { loadPonsPreview, type PonsCase, type PonsPreview } from "./pons-readonly-preview.mjs";
import "./visual-lab.css";

type Stage = "WHAT" | "TRAIL" | "RECEIPTS" | "NEXT";
const stages: Stage[] = ["WHAT", "TRAIL", "RECEIPTS", "NEXT"];

/**
 * Explicit Pons-readonly preview, NOT a production route or entitlement system.
 * If the current same-origin Pons read plane is absent, display unavailability.
 */
export function PonsCasePreview() {
  const [data, setData] = useState<PonsPreview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("WHAT");
  const [clock, setClock] = useState(Date.now());
  const stageTabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    setLoading(true);
    loadPonsPreview({ signal: controller.signal }).then((verified) => {
      if (!mounted) return;
      setData(verified); setClock(Date.now()); setError(""); setLoading(false);
    }).catch((cause: unknown) => {
      if (!mounted) return;
      setError(cause instanceof Error ? cause.message : "PONS_PREVIEW_UNAVAILABLE");
      setLoading(false);
    });
    return () => { mounted = false; controller.abort(); };
  }, [retry]);

  useEffect(() => {
    const expiry = data?.status.freshnessValidUntilMs;
    if (expiry == null) return;
    const delay = Math.max(0, Math.min(2147483647, expiry - Date.now() + 1));
    const handle = window.setTimeout(() => setClock(Date.now()), delay);
    return () => window.clearTimeout(handle);
  }, [data, clock]);

  const cases = data?.cases ?? [];
  // Select first only on initial load. Never silently replace a lost selected Case.
  const active: PonsCase | undefined =
    selectedId === null ? cases[0] : cases.find((item) => item.id === selectedId);
  const isFresh = !error && data?.freshness === "FRESH_VERIFIED" &&
    data.status.freshnessValidUntilMs !== null && data.status.freshnessValidUntilMs > clock;
  const readState = !data ? (loading ? "LOADING" : "UNAVAILABLE") :
    isFresh ? "FRESH_VERIFIED" : "STALE_VERIFIED";
  const activeStageIndex = stages.indexOf(stage);

  function advance(next: Stage, focus = false) {
    setStage(next);
    if (focus) stageTabs.current[stages.indexOf(next)]?.focus({ preventScroll: true });
  }
  function onStageKey(event: KeyboardEvent<HTMLButtonElement>) {
    let n = activeStageIndex;
    if (event.key === "ArrowRight") n = (n + 1) % stages.length;
    else if (event.key === "ArrowLeft") n = (n + stages.length - 1) % stages.length;
    else if (event.key === "Home") n = 0;
    else if (event.key === "End") n = stages.length - 1;
    else return;
    event.preventDefault();
    advance(stages[n], true);
  }
  const refresh = () => setRetry((n) => n + 1);

  return <div className="visual-lab vl-pons-preview" data-material="pearl">
    <AlleyWorld />
    <a className="vl-skip" href="#vl-case">Skip to Case</a>
    <header className="vl-topbar">
      <a className="vl-brand" href="/visual-lab"><strong>BINRAT</strong><span>HE GETS THE SCRAPS.<br />YOU GET THE RECEIPTS.</span></a>
      <div className="vl-command">
        <span>PONS / ROBINHOOD 4663</span>
        <div className="vl-lab-stamp"><span>ISOLATED READ-ONLY PREVIEW</span><b>{readState} · NO WATCH / TRADING AUTHORITY</b></div>
        <button type="button" className="vl-utility" onClick={refresh} disabled={loading}>{loading ? "CHECKING…" : "RECHECK"}</button>
      </div>
    </header>
    <aside className="vl-scout-label"><span className="vl-live">RAT ZERO <b>SCOUT / PRODUCT STAGE</b></span><p>Real receipts.<br /><strong>Bounded claims.</strong></p></aside>
    <main className="vl-workspace">
      <section className="vl-discovery" id="vl-finds" aria-label="Validated Pons launches">
        <header><h2>FRESH FINDS</h2><span>{readState} · CHECKPOINT {data?.status.checkpointBlock ?? "UNKNOWN"}</span></header>
        {error && <p role="alert">READ DEGRADED: {data ? "Last verified snapshot retained, now STALE." : "No verified Cases available."} ({error})</p>}
        {!data && <p role="status">{loading ? "Checking source and cryptographic digest…" : "Pons evidence is unavailable. Nothing was substituted."}</p>}
        {data && cases.length === 0 && <p role="status">Verified empty feed at this checkpoint. No Cases to open.</p>}
        {data && cases.length > 0 && <div className="vl-find-rail">
          {cases.map((item) => <button type="button" key={item.id} className={"vl-find " + (active?.id === item.id ? "active" : "")}
            aria-pressed={active?.id === item.id} onClick={() => { setSelectedId(item.id); setStage("WHAT"); }}>
            <span className="vl-find-mark">{item.symbol.slice(0, 1)}</span><span><strong>{item.symbol || item.token.slice(0, 10)}</strong><small>BLOCK {item.block}</small></span>
          </button>)}
        </div>}
      </section>
      {data && selectedId && !active && <p role="alert">Selected Case unavailable in this verified checkpoint. No replacement Case was selected.</p>}
      {data && active && <article id="vl-case" className="vl-hero-surface" data-case={active.id}>
        <div className="vl-case-topline"><span>RAT ZERO / CASE <b>{active.id.slice(0, 10)}…</b></span><span className="vl-case-status">{readState}</span></div>
        <div className="vl-case-hero">
          <figure className="vl-case-art"><img src={caseScene} alt="Decorative neon BINRAT alley illustration" /><figcaption>ILLUSTRATION ONLY · NOT EVIDENCE</figcaption></figure>
          <div className="vl-case-intro">
            <span className="vl-alert">RAT ZERO FOUND A PONS LAUNCH.</span>
            <h1>{active.priorLaunches > 0 ? "SMELLS FAMILIAR." : "FRESH SCRAP."}</h1>
            <p>{active.priorLaunches > 0
              ? "Pons reported this deployer on " + active.priorLaunches + " earlier indexed launches. The index is partial."
              : "Pons reported a launch. No earlier matching launch is recorded in this bounded index. Earlier history is unknown."}</p>
            <div className="vl-chips"><span>{active.symbol || "UNNAMED"}</span><span>HISTORY PARTIAL</span><span>NO VERDICT</span></div>
            {stage !== "NEXT" ? <button className="vl-primary" onClick={() => advance(stages[activeStageIndex + 1], true)}>
              {stage === "WHAT" ? "FOLLOW THE TRAIL" : stage === "TRAIL" ? "CHECK RECEIPTS" : "REVIEW NEXT ACTIONS"} →
            </button> : <a className="vl-primary" href="#vl-finds">RETURN TO FINDS →</a>}
          </div>
        </div>
        <div className="vl-case-steps" role="tablist" aria-label="Pons Case journey">
          {stages.map((name, index) => <button key={name} ref={(node) => { stageTabs.current[index] = node; }}
            id={"vl-tab-" + name} role="tab" aria-selected={name === stage}
            aria-controls={"vl-panel-" + name} tabIndex={name === stage ? 0 : -1}
            className={name === stage ? "active" : ""} onClick={() => advance(name)} onKeyDown={onStageKey}>
            <i>{String(index + 1).padStart(2, "0")}</i><strong>{name}</strong><small>{["The record", "Known recurrence", "Verified source", "No mutations"][index]}</small>
          </button>)}
        </div>
        <section role="tabpanel" id={"vl-panel-" + stage} aria-labelledby={"vl-tab-" + stage} className="vl-stage" tabIndex={0}>
          {stage === "WHAT" && <div className="vl-what">
            <div><span className="vl-eyebrow">WHY HE BROUGHT IT</span><h2>{active.symbol} · observed at block {active.block}</h2>
              <p>The reported deployer address is {active.reportedCreatorAddress}. The source is Pons V2. Shared human ownership, intent and profitability remain unknown.</p></div>
            <div className="vl-evidence-surface"><div className="vl-section-title">REPORTED LAUNCH</div>
              <p>Token {active.token}. Transaction {active.txHash}. This observation is bound to the verified checkpoint and digest.</p></div>
          </div>}
          {stage === "TRAIL" && <div className="vl-trail-view"><div className="vl-stage-heading"><div><span className="vl-eyebrow">FOLLOW THE TRAIL</span><h2>{active.priorLaunches > 0 ? "Address recurrence in this index." : "History is unknown."}</h2></div></div>
            <p>{active.priorLaunches > 0 ? String(active.priorLaunches) + " earlier indexed launches share the Pons-reported deployer. Their individual records are not included in this bounded preview." : "Zero matching earlier launches in this partial index does not prove a clean history."}</p></div>}
          {stage === "RECEIPTS" && <div className="vl-receipts-view"><div className="vl-stage-heading"><div><span className="vl-eyebrow">CHECK THE RECEIPTS</span><h2>Exact source-bound record.</h2></div></div>
            <details className="vl-receipt"><summary><strong>Pons indexed launch and checkpoint</strong> · EXPAND</summary>
              <div className="vl-receipt-body"><dl><div><dt>Chain</dt><dd>4663</dd></div><div><dt>Block</dt><dd>{active.block}</dd></div><div><dt>Source receipt</dt><dd>{active.receipt}</dd></div><div><dt>Feed digest</dt><dd>{active.feedDigest}</dd></div><div><dt>Verified at</dt><dd>{new Date(data.status.verifiedAtMs).toISOString()}</dd></div></dl>
                <pre tabIndex={0}>{JSON.stringify({ chainId: 4663, launchId: active.id, token: active.token, txHash: active.txHash, reportedDeployer: active.reportedCreatorAddress, blockNumber: active.block, checkpointBlock: data.status.checkpointBlock, checkpointBlockHash: data.status.checkpointBlockHash, feedDigest: data.status.feedDigest, priorLaunchCount: active.priorLaunches, coverage: "PARTIAL" }, null, 2)}</pre>
              </div></details><p className="vl-provenance">Feed/status digest binding is checked. This UI does not independently verify transaction execution from RPC.</p></div>}
          {stage === "NEXT" && <div className="vl-next-view"><span className="vl-eyebrow">YOUR NEXT MOVE</span><h2>Inspect, then decide.</h2>
            <p>This preview cannot start Watch, employ a Rat, connect a wallet or trade. Existing Telegram access must be checked separately.</p>
            <div className="vl-evidence-surface"><div className="vl-section-title">WATCH <span>UNAVAILABLE IN PREVIEW</span></div><p>WATCH IS NOT TRIPWIRE. Tripwire is BUILDING; Sniffer is PROVING.</p></div>
          </div>}
        </section>
        <div className="vl-case-bottom"><p>PARTIAL INDEX · DEPLOYER ADDRESS IS NOT A HUMAN IDENTITY · NO BUY/SELL RECOMMENDATION</p></div>
      </article>}
      <footer className="vl-footer">PONS READ-ONLY EXPERIMENT · NO PRODUCTION AUTHORITY</footer>
    </main>
  </div>;
}
