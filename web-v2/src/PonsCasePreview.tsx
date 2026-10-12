import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlleyWorld } from "./VisualLab";
import caseScene from "../public/visual-lab/case-scenes/case-neon-alley.webp";
import { loadPonsPreview, loadPonsCreatorTrail, inspectPonsHistoricalSource, type PonsCase, type PonsPreview, type PonsCreatorTrail } from "./pons-readonly-preview.mjs";
import { loadHistoricalCase, type HistoricalCaseItem } from "./historicalCase";
import type { CaseEnvelope } from "../../src/public/caseEvidence.js";
import "./visual-lab.css";
import "./frontdoor-discovery.css";
import { DiscoveryCrew } from "./DiscoveryCrew";
import { PonsTripwireWatch } from "./PonsTripwireWatch";

type Stage = "WHAT" | "TRAIL" | "RECEIPTS" | "NEXT";
const stages: Stage[] = ["WHAT", "TRAIL", "RECEIPTS", "NEXT"];
const sourceRoute = "/api/launches/latest";
const candidateSite = import.meta.env.VITE_BINRAT_V3_CANDIDATE === "1";
const productionSite = import.meta.env.VITE_BINRAT_V3_PRODUCTION === "1";
const shortAddress = (address: string) => address.slice(0, 6) + "…" + address.slice(-4);
const tokenLabel = (item: Pick<PonsCase, "name" | "symbol">) => item.name.trim() || item.symbol.trim() || "Unnamed launch";
function requestedCase() {
  const query = new URLSearchParams(window.location.search);
  const pathId = /^\/bag\/([0-9a-f]{64})\/?$/.exec(window.location.pathname)?.[1];
  if (pathId) return query.has("case") && query.get("case") !== pathId ? "INVALID_CASE" : pathId;
  if (query.has("case")) return query.get("case") || "INVALID_CASE";
  return null;
}

/** Same-origin Pons Cases for the approved V3 entry and isolated read preview. */
export function PonsCasePreview() {
  const [data, setData] = useState<PonsPreview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(requestedCase);
  const [historical, setHistorical] = useState<{ id: string; snapshot: PonsPreview; state: "VERIFIED_HISTORICAL" | "HISTORICAL_SOURCE_ONLY" | "UNAVAILABLE"; error: string; envelope?: CaseEnvelope; item?: HistoricalCaseItem } | null>(null);
  const [stage, setStage] = useState<Stage>("WHAT");
  const [trail, setTrail] = useState<PonsCreatorTrail | null>(null);
  const [trailError, setTrailError] = useState("");
  const [trailLoading, setTrailLoading] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [filter, setFilter] = useState<"latest" | "familiar">("latest");
  const [expanded, setExpanded] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const caseRef = useRef<HTMLElement>(null);
  const findsRef = useRef<HTMLElement>(null);
  const returningCase = useRef<string | null>(null);
  const stageTabs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastVerified = useRef<PonsPreview | null>(null);

  useEffect(() => {
    const navigate = () => { setSelectedId(requestedCase()); setStage("WHAT"); setShareNotice(""); };
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
  // Discovery starts without a selection. Never replace a lost selected Case.
  const currentCase: PonsCase | undefined =
    selectedId === null ? undefined : cases.find((item) => item.id === selectedId);
  const historicalResult = historical?.id === selectedId && historical.snapshot === data ? historical : null;
  const historicalEnvelope = historicalResult?.state === "VERIFIED_HISTORICAL" ? historicalResult.envelope : undefined;
  const active = currentCase ?? (historicalEnvelope ? historicalResult?.item : undefined);
  const isHistorical = !currentCase && Boolean(historicalEnvelope);
  const checkingHistorical = Boolean(selectedId && /^[0-9a-f]{64}$/.test(selectedId) && data && !currentCase && !historicalResult);
  useEffect(() => {
    if (!selectedId || !/^[0-9a-f]{64}$/.test(selectedId) || !data || currentCase || loading) return;
    let mounted = true;
    const controller = new AbortController();
    loadHistoricalCase({ id: selectedId, snapshot: data, signal: controller.signal })
      .then(({envelope,item}) => { if (mounted) setHistorical({ id: selectedId, snapshot: data, state: "VERIFIED_HISTORICAL", error: "", envelope, item }); })
      .catch(async (cause: unknown) => {
        if (!mounted) return;
        const error = cause instanceof Error ? cause.message : "CASE_EVIDENCE_UNAVAILABLE";
        try {
          const state = await inspectPonsHistoricalSource({ id: selectedId, snapshot: data, signal: controller.signal });
          if (mounted) setHistorical({ id: selectedId, snapshot: data, state, error });
        } catch { if (mounted) setHistorical({ id: selectedId, snapshot: data, state: "UNAVAILABLE", error }); }
      });
    return () => { mounted = false; controller.abort(); };
  }, [selectedId, data, currentCase, loading]);
  const filtered = filter === "familiar" ? cases.filter((item) => item.priorLaunches > 0) : cases;
  const visibleCases = expanded ? filtered : filtered.slice(0, 4);
  const isFresh = !error && data?.freshness === "FRESH_VERIFIED" &&
    data.status.freshnessValidUntilMs !== null && data.status.freshnessValidUntilMs > clock;
  const readState = !data ? (loading ? "LOADING" : "UNAVAILABLE") :
    isFresh ? "FRESH_VERIFIED" : "STALE_VERIFIED";
  const activeStageIndex = stages.indexOf(stage);
  const caseReady = Boolean(active) || (!loading && !checkingHistorical);

  useEffect(() => {
    if (selectedId) {
      caseRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    } else if (window.location.hash === "#vl-finds") {
      const card = returningCase.current && document.getElementById("find-" + returningCase.current);
      (card || findsRef.current)?.focus({ preventScroll: true });
      findsRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [selectedId, caseReady]);

  useEffect(() => { setTrail(null); setTrailError(""); }, [selectedId, data]);
  useEffect(() => {
    if (stage !== "TRAIL" || !currentCase || !data) return;
    let mounted = true;
    const controller = new AbortController();
    setTrailLoading(true); setTrailError("");
    loadPonsCreatorTrail({ item: currentCase, snapshot: data, signal: controller.signal })
      .then((verified) => { if (mounted) { setTrail(verified); setTrailLoading(false); } })
      .catch((cause: unknown) => { if (mounted) { setTrail(null); setTrailLoading(false); setTrailError(cause instanceof Error ? cause.message : "TRAIL_UNAVAILABLE"); } });
    return () => { mounted = false; controller.abort(); };
  }, [stage, currentCase, data]);

  function advance(next: Stage, focus = false) {
    setStage(next);
    if (focus) {
      const tab = stageTabs.current[stages.indexOf(next)];
      tab?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width:700px)").matches) {
        tab?.closest(".vl-case-steps")?.scrollIntoView({ block: "start", behavior: "instant" });
      }
    }
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
    returningCase.current = id;
    setSelectedId(id);
    setStage("WHAT");
    setShareNotice("");
    window.history.pushState(null, "", "/bag/" + id);
  }
  function returnToFinds() {
    window.history.pushState(null, "", "/#vl-finds");
    setSelectedId(null); setStage("WHAT"); setShareNotice("");
  }
  function startDigging() {
    window.history.replaceState(window.history.state, "", "/#vl-finds");
    findsRef.current?.focus({ preventScroll: true });
    findsRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  async function copyCaseLink() {
    if (!active) return;
    const url = new URL("/bag/" + active.id, window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setShareNotice("Case link copied."); }
    catch { setShareNotice("Copy the exact Case link from your browser’s address bar."); }
  }

  return <div className="visual-lab vl-pons-preview a1-frontdoor" data-material="pearl" data-view={selectedId ? "case" : "discovery"}>
    <AlleyWorld />
    <a className="vl-skip" href={selectedId ? "#vl-case" : "#vl-finds"}>Skip to {selectedId ? "Case" : "discovery"}</a>
    <header className="vl-topbar">
      <a className="vl-brand" href="/"><strong>BINRAT</strong><span>HE GETS THE SCRAPS.<br />YOU GET THE RECEIPTS.</span></a>
      <div className="vl-command">
        <div className="vl-lab-stamp"><span>{productionSite ? "PONS / ROBINHOOD CHAIN" : candidateSite ? "ISOLATED CANDIDATE PREVIEW" : "PONS READ PREVIEW"}</span><b data-read-state={readState}>{loading ? "Checking launches…" : isFresh ? "Publication checked" : data ? "Updates paused · earlier receipts" : "Launches unavailable"}</b></div>
        <button type="button" className="vl-utility" onClick={refresh} disabled={loading}>{loading ? "CHECKING…" : "RECHECK"}</button>
      </div>
    </header>
    <aside className="vl-scout-label"><span className="vl-live">RAT ZERO <b>PONS LAUNCH SCOUT</b></span><p>The Rat remembers.<br /><strong>You check the receipts.</strong></p></aside>
    <main className="vl-workspace">
      {!selectedId && <>
      <section className="a1-hero vl-hero-surface" aria-labelledby="a1-title">
        <span className="vl-eyebrow">RAT ZERO / PONS LAUNCH SCOUT</span>
        <h1 id="a1-title">YOU CAN'T WATCH<br />ALL THIS SHIT.<br /><span>RAT ZERO IS DIGGING.</span></h1>
        <p className="a1-support">Indexed Pons launches. Familiar deployer addresses. Receipts you can check.</p>
        <p className="a1-explainer">Rat Zero automatically finds Pons launches and links earlier indexed evidence. Follow reported addresses and inspect receipts. More Rats are in the works.</p>
        <div className="a1-actions"><button className="vl-primary" onClick={startDigging}>START DIGGING <span aria-hidden="true">→</span></button><DiscoveryCrew live={isFresh} checking={loading} /></div>
      </section>
      <section ref={findsRef} tabIndex={-1} className="vl-discovery a1-discovery" id="vl-finds" aria-labelledby="a1-finds-title">
        <header><div><span className="vl-eyebrow">{isFresh ? "SOURCE CHECKED / PONS LAUNCHES" : data ? "EARLIER FINDS / UPDATES PAUSED" : "PONS LAUNCH DISCOVERY"}</span><h2 id="a1-finds-title">{isFresh ? "LATEST IN THE INDEX." : data ? "FROM THE LAST SOURCE CHECK." : "WHAT DID THE RAT FIND?"}</h2></div></header>
        <div className="a1-filters" role="group" aria-label="Launch views"><button className="vl-utility" aria-pressed={filter === "latest"} onClick={() => { setFilter("latest"); setExpanded(false); }}>Latest launches</button><button className="vl-utility" aria-pressed={filter === "familiar"} onClick={() => { setFilter("familiar"); setExpanded(false); }}>Familiar deployers</button></div>
        <p className="a1-coverage">{data ? <>{isFresh ? "Source checked" : "Updates paused · last source check"} <time dateTime={new Date(data.status.verifiedAtMs).toISOString()}>{new Date(data.status.verifiedAtMs).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>. Latest {cases.length} indexed launches · partial history.</> : "Pons / Robinhood Chain · partial launch history."} Publication freshness describes the source check, not launch age. Blocks show launch order. Recurrence counts earlier indexed launches from the same reported address; they establish neither human identity nor profitability.</p>
        {error && <p role="alert">{data ? "Updates paused. Last verified snapshot retained, now stale. Recheck to try again." : "We could not verify the Pons source. Recheck to try again."}</p>}
        {!data && <p role="status">{loading ? "Rat Zero is checking the source. Launches appear here once verified." : "Pons launches are unavailable. Recheck to try again. Nothing was substituted."}</p>}
        {data && cases.length === 0 && <p role="status">Verified empty feed at this checkpoint. No launches to open yet. Recheck for new finds.</p>}
        {data && cases.length > 0 && filtered.length === 0 && <p role="status">No familiar deployers in these launches. No earlier launch matches in our partial index; this does not prove a clean history.</p>}
        {data && filtered.length > 0 && <div className="vl-find-rail a1-find-grid">
          {visibleCases.map((item) => <button type="button" id={"find-" + item.id} key={item.id} aria-label={"Open Case " + tokenLabel(item) + " " + shortAddress(item.token)} data-case-id={item.id} className="vl-find"
            onClick={() => selectCase(item.id)}>
            <span className="vl-find-mark" aria-hidden="true">{item.symbol.trim().slice(0, 1) || "↗"}</span><span className="a1-find-copy"><strong>{tokenLabel(item)}</strong><small className="a1-token">{item.symbol.trim() && item.name.trim() ? item.symbol + " · " : ""}{shortAddress(item.token)} · block {item.block}</small><small className={item.priorLaunches > 0 ? "a1-recurrence" : ""}>{item.priorLaunches > 0 ? "Same deployer · " + item.priorLaunches + " earlier indexed " + (item.priorLaunches === 1 ? "launch" : "launches") : "No earlier match in our partial index"}</small></span><span className="a1-open">OPEN CASE <span aria-hidden="true">↗</span></span>
          </button>)}
        </div>}
        {!expanded && filtered.length > 4 && <button className="vl-utility a1-more" onClick={() => setExpanded(true)}>SHOW ALL {filtered.length} LAUNCHES <span aria-hidden="true">↓</span></button>}
      </section>
      </>}
      {selectedId && <div className="a1-case-navigation"><button className="vl-utility" onClick={returnToFinds}>← BACK TO DISCOVERY</button>{active && <button className="vl-utility" onClick={copyCaseLink}>COPY CASE LINK</button>}<span role="status">{shareNotice}</span></div>}
      {selectedId && !data && loading && <article ref={caseRef} tabIndex={-1} id="vl-case" className="vl-hero-surface vl-loading-case" aria-busy="true" aria-label="Checking Pons Cases">
        <div className="vl-case-topline">RAT ZERO / CHECKING THE RECEIPTS</div>
        <div className="vl-case-hero"><div className="vl-case-art vl-skeleton" /><div className="vl-case-intro"><h1>THE RAT'S ON IT.</h1><p>Checking real Pons launches and their source receipts.</p></div></div>
        <div className="vl-case-steps vl-skeleton" /><div className="vl-stage"><p>Verified Cases appear here. A missing source stays unavailable.</p></div>
      </article>}
      {selectedId && !loading && !active && <article ref={caseRef} tabIndex={-1} id="vl-case" aria-label="Requested Case unavailable" className="vl-hero-surface vl-missing-case" data-historical-state={checkingHistorical ? "CHECKING" : historicalResult?.state ?? "UNAVAILABLE"}>
        <h1>{checkingHistorical ? "CHECKING EXACT SOURCE." : historicalResult?.state === "HISTORICAL_SOURCE_ONLY" ? "HISTORICAL SOURCE ONLY." : "CASE UNAVAILABLE."}</h1>
        <p role={checkingHistorical ? "status" : "alert"}>{checkingHistorical ? "This Case is outside the latest launch window. Checking its exact source record…" : historicalResult?.state === "HISTORICAL_SOURCE_ONLY" ? "The exact source record exists, but its historical projection cannot be verified by this UI. No replacement Case was selected." : data ? "The exact historical source is unavailable or could not be validated. No replacement Case was selected." : "The Pons source is unavailable. Recheck to try again; your exact Case link is preserved."}</p>
        <p>Historical records use a separate publication projection with unverified history. Its digest and recurrence counts are not the latest feed's evidence. This link preserves the launch identity, not an archived publication.</p>
        {historicalResult?.error && <p className="vl-provenance">Source check: {historicalResult.error}</p>}
        <p className="vl-address">REQUESTED CASE <code>{selectedId}</code></p>{/^[0-9a-f]{64}$/.test(selectedId) && <a className="vl-utility" href={"/api/bag/" + selectedId} target="_blank" rel="noreferrer">CHECK EXACT SOURCE RECORD ↗</a>}
      </article>}
      {data && active && <article ref={caseRef} tabIndex={-1} aria-label={"Case " + tokenLabel(active)} id="vl-case" className="vl-hero-surface a1-active-case" data-case={active.id} data-projection={isHistorical ? "HISTORICAL" : "LATEST"}>
        <div className="vl-case-topline"><span>RAT ZERO / CASE <b>{active.id.slice(0, 10)}…</b></span><span className="vl-case-status" data-read-state={readState}>{isHistorical ? "HISTORICAL · DIGEST CHECKED" : isFresh ? "SOURCE CHECKED" : "UPDATES PAUSED"}</span></div>
        {error && <p role="alert">Last verified snapshot retained, now stale. Recheck to try again.</p>}
        <div className="vl-case-hero">
          <figure className="vl-case-art"><img src={caseScene} alt="Decorative neon BINRAT alley illustration" /><figcaption>ILLUSTRATION ONLY · NOT EVIDENCE</figcaption></figure>
          <div className="vl-case-intro">
            <span className="vl-alert">RAT ZERO FOUND A PONS LAUNCH.</span>
            <h1>{active.priorLaunches > 0 ? "SMELLS FAMILIAR." : "INDEXED SCRAP."}</h1>
            <p>{active.priorLaunches > 0
              ? "Same deployer. " + active.priorLaunches + (isHistorical ? " earlier indexed launches in this returned window. Rat Zero brings the trail and receipts." : " earlier indexed launches. Rat Zero brings the trail and receipts.")
              : "A real Pons launch. Rat Zero brings the reported deployer and receipts. Earlier history is unknown."}</p>
            <div className="vl-chips"><span>{tokenLabel(active)} · {shortAddress(active.token)}</span><span>{isHistorical ? "PARTIAL · UP TO 20 RECORDS" : "HISTORY PARTIAL"}</span></div>
            {stage !== "NEXT" ? <button className="vl-primary" onClick={() => advance(stages[activeStageIndex + 1], true)}>
              {stage === "WHAT" ? "FOLLOW THE TRAIL" : stage === "TRAIL" ? "CHECK RECEIPTS" : "REVIEW NEXT ACTIONS"} →
            </button> : <button className="vl-primary" onClick={returnToFinds}>RETURN TO FINDS →</button>}
            {stage !== "NEXT" && <button type="button" className="vl-utility pons-tripwire-case-action" onClick={() => advance("NEXT", true)}>WATCH THIS DEPLOYER →</button>}
          </div>
        </div>
        {isHistorical && <p className="a12-history-notice">Historical launch observation at block {active.block}, reconstructed from the indexed source at published checkpoint {active.asOfBlock}. {isFresh ? "Publication source checked." : "Publication updates paused; evidence is stale."} This is not an immutable archived publication or a historical point-in-time replay. The same-origin index supplies source authority; the browser checks digest, identity and provenance derivation without independently querying the chain.</p>}
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
              <p>Token {active.token}. Transaction {active.txHash}. This observation is bound to the published checkpoint and its source digest.</p>
              {(!active.name || !active.symbol) && <p>Token name: {active.name || "Not provided"}. Symbol: {active.symbol || "Not provided"}. Missing metadata was not inferred.</p>}</div>
          </div>}
          {stage === "TRAIL" && <div className="vl-trail-view"><div className="vl-stage-heading"><div><span className="vl-eyebrow">FOLLOW THE TRAIL</span><h2>{active.priorLaunches > 0 ? "Address recurrence in this index." : "History is unknown."}</h2></div></div>
            <p>{active.priorLaunches > 0 ? String(active.priorLaunches) + " earlier indexed launches share the Pons-reported deployer. A shared address does not establish a shared human identity." : "Zero matching earlier launches in this partial index does not prove a clean history."}</p>
            {isHistorical && <><ol className="vl-source-trail">{historicalEnvelope!.material.records.map(({launch}) => <li key={launch.launchId}><span className="vl-eyebrow">BLOCK {launch.blockNumber}{launch.launchId === active.id ? " · THIS CASE" : ""}</span><strong>{launch.name || launch.symbol || "Unnamed launch"}</strong><code>{launch.token}</code><a className="vl-text-action" href={"/bag/" + launch.launchId}>OPEN EXACT CASE →</a></li>)}</ol><p className="vl-provenance">{active.priorLaunches} earlier indexed launches in this returned window of {historicalEnvelope!.material.records.length} records through this Case. At most 20 records; older history is not enumerated. This count uses the historical reconstruction projection, not the latest-feed count.</p></>}
            {trailLoading && !isHistorical && <p role="status">Checking the deployer's latest source records…</p>}
            {trailError && !isHistorical && <p role="status">Trail unavailable at this checkpoint. Recheck the feed to try again. ({trailError})</p>}
            {trail && !isHistorical && <><ol className="vl-source-trail">{trail.launches.map((launch) => <li key={launch.launchId}><span className="vl-eyebrow">BLOCK {launch.blockNumber}{launch.launchId === active.id ? " · THIS CASE" : ""}</span><strong>{launch.symbol || launch.token.slice(0, 10) + "…"}</strong><code>{launch.token}</code><a className="vl-text-action" href={"/api/bag/" + launch.launchId} target="_blank" rel="noreferrer">SOURCE RECORD ↗</a></li>)}</ol><p className="vl-provenance">Latest four verified launches at most. Older records are omitted; this is partial history.</p></>}
            {!isHistorical && <a className="vl-text-action" href={"/api/creator/" + active.reportedCreatorAddress + "/summary"} target="_blank" rel="noreferrer">OPEN DEPLOYER SOURCE ↗</a>}</div>}
          {stage === "RECEIPTS" && <div className="vl-receipts-view"><div className="vl-stage-heading"><div><span className="vl-eyebrow">CHECK THE RECEIPTS</span><h2>Exact source-bound record.</h2></div></div>
            <details className="vl-receipt"><summary><strong>Pons indexed launch and checkpoint</strong> · EXPAND</summary>
              <div className="vl-receipt-body"><dl><div><dt>Chain</dt><dd>Pons / Robinhood 4663</dd></div><div><dt>Block</dt><dd>{active.block}</dd></div><div><dt>Source receipt</dt><dd>{active.receipt}</dd></div><div><dt>{isHistorical ? "Case evidence digest" : "Feed digest"}</dt><dd>{isHistorical ? historicalEnvelope!.digest : currentCase!.feedDigest}</dd></div><div><dt>Verified at</dt><dd>{new Date(data.status.verifiedAtMs).toISOString()}</dd></div><div><dt>Source</dt><dd><a href={isHistorical ? "/api/bag/" + active.id + "/evidence" : sourceRoute} target="_blank" rel="noreferrer">{isHistorical ? "Canonical Case evidence envelope ↗" : "Same-origin Pons public feed ↗"}</a> · <a href={"/api/bag/" + active.id} target="_blank" rel="noreferrer">Exact Case source ↗</a></dd></div><div><dt>Limits</dt><dd>Partial index. Optional intelligence and replay are not shown. Human ownership, intent, sellability and profitability remain unknown.</dd></div></dl>
                <pre tabIndex={0}>{JSON.stringify(isHistorical ? historicalEnvelope : { chainId: 4663, launchId: active.id, token: active.token, txHash: active.txHash, reportedDeployer: active.reportedCreatorAddress, blockNumber: active.block, checkpointBlock: data.status.checkpointBlock, checkpointBlockHash: data.status.checkpointBlockHash, feedDigest: data.status.feedDigest, priorLaunchCount: active.priorLaunches, coverage: "PARTIAL" }, null, 2)}</pre>
              </div></details><p className="vl-provenance">{isHistorical ? "Case digest, canonical launch/event identities, provenance derivation, window count and publication binding are checked. The index is the source authority; this is not independent RPC verification or archived replay." : "Feed/status digest binding is checked. This UI does not independently verify transaction execution from RPC."}</p></div>}
          {stage === "NEXT" && <div className="vl-next-view"><span className="vl-eyebrow">YOUR NEXT MOVE</span><h2>Inspect, then decide.</h2>
            <PonsTripwireWatch key={active.id} caseId={active.id} deployer={active.reportedCreatorAddress} fresh={Boolean(isFresh)} />
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
