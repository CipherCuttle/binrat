import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlleyWorld } from "./VisualLab";
import caseScene from "../public/visual-lab/case-scenes/case-neon-alley.webp";
import { loadPonsPreview, loadPonsCreatorTrail, type PonsCase, type PonsPreview, type PonsCreatorTrail } from "./pons-readonly-preview.mjs";
import "./visual-lab.css";

type Stage = "WHAT" | "TRAIL" | "RECEIPTS" | "NEXT";
const stages: Stage[] = ["WHAT", "TRAIL", "RECEIPTS", "NEXT"];
const sourceRoute = "/api/launches/latest";
const candidateSite = import.meta.env.VITE_BINRAT_V3_CANDIDATE === "1";
const productionSite = import.meta.env.VITE_BINRAT_V3_PRODUCTION === "1";
const tokenLabel = (item: PonsCase) => item.symbol || item.token.slice(0, 10) + "…";
function requestedCase() {
  const query = new URLSearchParams(window.location.search);
  if (query.has("case")) return query.get("case") || "INVALID_CASE";
  return /^\/bag\/([0-9a-f]{64})\/?$/.exec(window.location.pathname)?.[1] ?? null;
}

/** Same-origin Pons Cases for the approved V3 entry and isolated read preview. */
export function PonsCasePreview() {
  const [data, setData] = useState<PonsPreview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(requestedCase);
  const [stage, setStage] = useState<Stage>("WHAT");
  const [trail, setTrail] = useState<PonsCreatorTrail | null>(null);
  const [trailError, setTrailError] = useState("");
  const [trailLoading, setTrailLoading] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const stageTabs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastVerified = useRef<PonsPreview | null>(null);

  useEffect(() => {
    const navigate = () => { setSelectedId(requestedCase()); setStage("WHAT"); };
    window.addEventListener("popstate", navigate);
    return () => window.removeEventListener("popstate", navigate);
  }, []);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    setLoading(true);
    loadPonsPreview({ signal: controller.signal, previous: lastVerified.current }).then((verified) => {
      if (!mounted) return;
      lastVerified.current = verified;
      setSelectedId((id) => id === null ? verified.cases[0]?.id ?? null : id);
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
    if (expiry == null || expiry <= clock) return;
    const delay = Math.max(0, Math.min(2147483647, expiry - Date.now() + 1));
    const handle = window.setTimeout(() => setClock(Date.now()), delay);
    return () => window.clearTimeout(handle);
  }, [data, clock]);

  useEffect(() => {
    // A suspended tab or restored page may resume before its expiry timer fires.
    const updateClock = () => setClock(Date.now());
    document.addEventListener("visibilitychange", updateClock);
    window.addEventListener("pageshow", updateClock);
    return () => {
      document.removeEventListener("visibilitychange", updateClock);
      window.removeEventListener("pageshow", updateClock);
    };
  }, []);

  const cases = data?.cases ?? [];
  // Select first only on initial load. Never silently replace a lost selected Case.
  const active: PonsCase | undefined =
    selectedId === null ? cases[0] : cases.find((item) => item.id === selectedId);
  const isFresh = !error && data?.freshness === "FRESH_VERIFIED" &&
    data.status.freshnessValidUntilMs !== null && data.status.freshnessValidUntilMs > clock;
  const readState = !data ? (loading ? "LOADING" : "UNAVAILABLE") :
    isFresh ? "FRESH_VERIFIED" : "STALE_VERIFIED";
  const activeStageIndex = stages.indexOf(stage);

  useEffect(() => { setTrail(null); setTrailError(""); }, [selectedId, data]);
  useEffect(() => {
    if (stage !== "TRAIL" || !active || !data) return;
    let mounted = true;
    const controller = new AbortController();
    setTrailLoading(true); setTrailError("");
    loadPonsCreatorTrail({ item: active, snapshot: data, signal: controller.signal })
      .then((verified) => { if (mounted) { setTrail(verified); setTrailLoading(false); } })
      .catch((cause: unknown) => { if (mounted) { setTrail(null); setTrailLoading(false); setTrailError(cause instanceof Error ? cause.message : "TRAIL_UNAVAILABLE"); } });
    return () => { mounted = false; controller.abort(); };
  }, [stage, active, data]);

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
  function selectCase(id: string) {
    setSelectedId(id);
    setStage("WHAT");
    if (candidateSite) {
      const url = new URL(window.location.href);
      url.pathname = "/";
      url.searchParams.delete("visual");
      url.searchParams.delete("ponsPreview");
      url.searchParams.set("case", id);
      window.history.pushState(window.history.state, "", url.pathname + url.search);
    }
  }

  return <div className="visual-lab vl-pons-preview" data-material="pearl">
    <AlleyWorld />
    <a className="vl-skip" href="#vl-case">Skip to Case</a>
    <header className="vl-topbar">
      <a className="vl-brand" href={candidateSite ? "/" : "/visual-lab"}><strong>BINRAT</strong><span>HE GETS THE SCRAPS.<br />YOU GET THE RECEIPTS.</span></a>
      <div className="vl-command">
        <span>PONS / ROBINHOOD 4663</span>
        <div className="vl-lab-stamp"><span>{productionSite ? "REAL LAUNCHES. CHECKABLE RECEIPTS." : "ISOLATED CANDIDATE PREVIEW"}</span><b>PONS READ-ONLY · {readState}</b></div>
        <button type="button" className="vl-utility" onClick={refresh} disabled={loading}>{loading ? "CHECKING…" : "RECHECK"}</button>
      </div>
    </header>
    <aside className="vl-scout-label"><span className="vl-live">RAT ZERO <b>{isFresh ? "SCOUT / LIVE" : "SCOUT / " + (loading ? "CHECKING" : "PAUSED")}</b></span><p>Find launches.<br /><strong>Check the trail.</strong></p></aside>
    <main className="vl-workspace">
      <section className="vl-discovery" id="vl-finds" aria-label="Validated Pons launches">
        <header><h2>{isFresh ? "FRESH FINDS" : "INDEXED FINDS"}</h2><span>{readState} · CHECKPOINT {data?.status.checkpointBlock ?? "UNKNOWN"}</span></header>
        {error && <p role="alert">READ DEGRADED: {data ? "Last verified snapshot retained, now STALE." : "No verified Cases available."} ({error})</p>}
        {!data && <p role="status">{loading ? "Checking source and cryptographic digest…" : "Pons evidence is unavailable. Nothing was substituted."}</p>}
        {data && cases.length === 0 && <p role="status">Verified empty feed at this checkpoint. No Cases to open.</p>}
        {data && cases.length > 0 && <div className="vl-find-rail">
          {cases.map((item) => <button type="button" key={item.id} aria-label={"Open Case " + item.id} className={"vl-find " + (active?.id === item.id ? "active" : "")}
            aria-pressed={active?.id === item.id} onClick={() => selectCase(item.id)}>
            <span className="vl-find-mark">{item.symbol.slice(0, 1) || "?"}</span><span><strong>{tokenLabel(item)}</strong><small>BLOCK {item.block}</small></span>
          </button>)}
        </div>}
      </section>
      {!data && loading && <article className="vl-hero-surface vl-loading-case" aria-busy="true" aria-label="Checking Pons Cases">
        <div className="vl-case-topline">RAT ZERO / CHECKING THE RECEIPTS</div>
        <div className="vl-case-hero"><div className="vl-case-art vl-skeleton" /><div className="vl-case-intro"><h1>THE RAT'S ON IT.</h1><p>Checking real Pons launches and their source receipts.</p></div></div>
        <div className="vl-case-steps vl-skeleton" /><div className="vl-stage"><p>Verified Cases appear here. A missing source stays unavailable.</p></div>
      </article>}
      {data && selectedId && !active && <div className="vl-evidence-surface vl-missing-case"><p role="alert">Selected Case unavailable in this verified checkpoint. No replacement Case was selected.</p><a className="vl-utility" href="/">RETURN TO FINDS →</a></div>}
      {data && active && <article id="vl-case" className="vl-hero-surface" data-case={active.id}>
        <div className="vl-case-topline"><span>RAT ZERO / CASE <b>{active.id.slice(0, 10)}…</b></span><span className="vl-case-status">{readState}</span></div>
        <div className="vl-case-hero">
          <figure className="vl-case-art"><img src={caseScene} alt="Decorative neon BINRAT alley illustration" /><figcaption>ILLUSTRATION ONLY · NOT EVIDENCE</figcaption></figure>
          <div className="vl-case-intro">
            <span className="vl-alert">RAT ZERO FOUND A PONS LAUNCH.</span>
            <h1>{active.priorLaunches > 0 ? "SMELLS FAMILIAR." : isFresh ? "FRESH SCRAP." : "INDEXED SCRAP."}</h1>
            <p>{active.priorLaunches > 0
              ? "Same deployer. " + active.priorLaunches + " earlier indexed launches. Rat Zero brings the trail and receipts."
              : "A real Pons launch. Rat Zero brings the reported deployer and receipts. Earlier history is unknown."}</p>
            <div className="vl-chips"><span>{tokenLabel(active)}</span><span>HISTORY PARTIAL</span><span>NO VERDICT</span></div>
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
            <i>{String(index + 1).padStart(2, "0")}</i><strong>{name === "WHAT" ? "WHY" : name}</strong><small>{["Why he brought it", "Known recurrence", "Verified source", "Your next move"][index]}</small>
          </button>)}
        </div>
        <section role="tabpanel" id={"vl-panel-" + stage} aria-labelledby={"vl-tab-" + stage} className="vl-stage" tabIndex={0}>
          {stage === "WHAT" && <div className="vl-what">
            <div><span className="vl-eyebrow">WHY HE BROUGHT IT</span><h2>{tokenLabel(active)} · observed at block {active.block}</h2>
              <p>{active.priorLaunches > 0 ? "This reported deployer appears on earlier indexed launches. Follow the source records before drawing a conclusion." : "Pons reported this launch. No earlier matching launch is recorded in our partial index. Missing history is not a clean bill."}</p>
              <p className="vl-address">REPORTED DEPLOYER <code>{active.reportedCreatorAddress}</code></p></div>
            <div className="vl-evidence-surface"><div className="vl-section-title">REPORTED LAUNCH</div>
              <p>Token {active.token}. Transaction {active.txHash}. This observation is bound to the verified checkpoint and digest.</p>
              {(!active.name || !active.symbol) && <p>Token name: {active.name || "Not provided"}. Symbol: {active.symbol || "Not provided"}. Missing metadata was not inferred.</p>}</div>
          </div>}
          {stage === "TRAIL" && <div className="vl-trail-view"><div className="vl-stage-heading"><div><span className="vl-eyebrow">FOLLOW THE TRAIL</span><h2>{active.priorLaunches > 0 ? "Address recurrence in this index." : "History is unknown."}</h2></div></div>
            <p>{active.priorLaunches > 0 ? String(active.priorLaunches) + " earlier indexed launches share the Pons-reported deployer. A shared address does not establish a shared human identity." : "Zero matching earlier launches in this partial index does not prove a clean history."}</p>
            {trailLoading && <p role="status">Checking the deployer's latest source records…</p>}
            {trailError && <p role="status">Trail unavailable at this checkpoint. Recheck the feed to try again. ({trailError})</p>}
            {trail && <><ol className="vl-source-trail">{trail.launches.map((launch) => <li key={launch.launchId}><span className="vl-eyebrow">BLOCK {launch.blockNumber}{launch.launchId === active.id ? " · THIS CASE" : ""}</span><strong>{launch.symbol || launch.token.slice(0, 10) + "…"}</strong><code>{launch.token}</code><a className="vl-text-action" href={"/api/bag/" + launch.launchId} target="_blank" rel="noreferrer">SOURCE RECORD ↗</a></li>)}</ol><p className="vl-provenance">Latest four verified launches at most. Older records are omitted; this is partial history.</p></>}
            <a className="vl-text-action" href={"/api/creator/" + active.reportedCreatorAddress + "/summary"} target="_blank" rel="noreferrer">OPEN DEPLOYER SOURCE ↗</a></div>}
          {stage === "RECEIPTS" && <div className="vl-receipts-view"><div className="vl-stage-heading"><div><span className="vl-eyebrow">CHECK THE RECEIPTS</span><h2>Exact source-bound record.</h2></div></div>
            <details className="vl-receipt"><summary><strong>Pons indexed launch and checkpoint</strong> · EXPAND</summary>
              <div className="vl-receipt-body"><dl><div><dt>Chain</dt><dd>Pons / Robinhood 4663</dd></div><div><dt>Block</dt><dd>{active.block}</dd></div><div><dt>Source receipt</dt><dd>{active.receipt}</dd></div><div><dt>Feed digest</dt><dd>{active.feedDigest}</dd></div><div><dt>Verified at</dt><dd>{new Date(data.status.verifiedAtMs).toISOString()}</dd></div><div><dt>Source</dt><dd><a href={sourceRoute} target="_blank" rel="noreferrer">Same-origin Pons public feed ↗</a> · <a href={"/api/bag/" + active.id} target="_blank" rel="noreferrer">Exact Case source ↗</a></dd></div><div><dt>Limits</dt><dd>Partial index. Optional intelligence and replay are not shown. Human ownership, intent, sellability and profitability remain unknown.</dd></div></dl>
                <pre tabIndex={0}>{JSON.stringify({ chainId: 4663, launchId: active.id, token: active.token, txHash: active.txHash, reportedDeployer: active.reportedCreatorAddress, blockNumber: active.block, checkpointBlock: data.status.checkpointBlock, checkpointBlockHash: data.status.checkpointBlockHash, feedDigest: data.status.feedDigest, priorLaunchCount: active.priorLaunches, coverage: "PARTIAL" }, null, 2)}</pre>
              </div></details><p className="vl-provenance">Feed/status digest binding is checked. This UI does not independently verify transaction execution from RPC.</p></div>}
          {stage === "NEXT" && <div className="vl-next-view"><span className="vl-eyebrow">YOUR NEXT MOVE</span><h2>Inspect, then decide.</h2>
            <p>Return for new verified finds. Open the Telegram Rat to check your actual access; opening the bot creates no Watch or alert.</p>
            <a className="vl-utility" href="https://t.me/BinratBot" target="_blank" rel="noopener noreferrer">OPEN TELEGRAM RAT ↗</a>
            <div className="vl-evidence-surface"><div className="vl-section-title">WATCH <span>UNAVAILABLE ON THIS SITE</span></div><p>WATCH IS NOT TRIPWIRE. Tripwire is BUILDING; Sniffer is PROVING. Working Rat is PLANNED; entitlement is inactive.</p><p>$BINRAT has not launched. No staking, payments, trading or wallet actions are available here.</p></div>
          </div>}
        </section>
        <div className="vl-case-bottom"><p>PARTIAL INDEX · DEPLOYER ADDRESS IS NOT A HUMAN IDENTITY · NO BUY/SELL RECOMMENDATION</p></div>
      </article>}
      <footer className="vl-footer"><a className="vl-utility" href="https://t.me/BinratBot" target="_blank" rel="noopener noreferrer">TELEGRAM RAT ↗</a><p>{productionSite ? "REAL PONS FINDS · PARTIAL HISTORY · CHECK THE RECEIPTS" : "PONS READ-ONLY EXPERIMENT · SOURCE IS THE CURRENT SAME-ORIGIN API · NO PRODUCTION AUTHORITY"}</p>
        {data && <span>{readState} · Verified {new Date(data.status.verifiedAtMs).toISOString()} · Freshness expires {data.status.freshnessValidUntilMs === null ? "UNKNOWN" : new Date(data.status.freshnessValidUntilMs).toISOString()} · {data.status.lastSyncError ?? "No reported sync error"}</span>}
      </footer>
    </main>
  </div>;
}
