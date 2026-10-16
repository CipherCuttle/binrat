import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { AlleyWorld } from "./VisualLab";
import caseScene from "../public/visual-lab/case-scenes/case-neon-alley.webp";
import { loadPonsPreview, loadPonsCreatorTrail, inspectPonsHistoricalSource, type PonsCase, type PonsPreview, type PonsCreatorTrail } from "./pons-readonly-preview.mjs";
import { loadHistoricalCase, type HistoricalCaseItem } from "./historicalCase";
import type { CaseEnvelope } from "../../src/public/caseEvidence.js";
import "./visual-lab.css";
import "./frontdoor-discovery.css";
import { InvestigationNav } from "./InvestigationNav";
import { DeployerGroups, FindRow, SavedCases, shortAddress, tokenLabel } from "./InvestigationPanels";
import { filterDiscoverableCases, investigationHref, readCasebook, readCaseNotes, sectionForPath, sharedDeployerLeads, toggleSavedCase, updateCaseNote, type InvestigationSection } from "./investigationUX";
import "./investigation-shell.css";
import { ShinyText, SpotlightCard, StarBorder } from "./ReactBitsStarter";
import "./ReactBitsStarter.css";

type Stage = "WHAT" | "TRAIL" | "RECEIPTS";
const stages: Stage[] = ["WHAT", "TRAIL", "RECEIPTS"];
const sourceRoute = "/api/launches/latest";
const CASEBOOK_KEY = "binrat-v3-casebook-v1";
const CASE_NOTES_KEY = "binrat-v3-case-notes-v1";
const gitHackPreview = import.meta.env.VITE_BINRAT_GITHACK_PREVIEW === "1";
function currentSection(): InvestigationSection {
  if (requestedCase() && typeof window.history.state?.invOrigin === "string") return sectionForPath(window.history.state.invOrigin);
  if (gitHackPreview) {
    const view = new URLSearchParams(window.location.search).get("view");
    return sectionForPath(view ? "/" + view : "/");
  }
  return sectionForPath(window.location.pathname);
}
/** Static GitHack has no SPA rewrite. Keep the exact Case in query, without changing production routes. */
function navigationUrl(route: string) {
  return investigationHref(route, window.location.href, gitHackPreview);
}

const candidateSite = import.meta.env.VITE_BINRAT_V3_CANDIDATE === "1";
const productionSite = import.meta.env.VITE_BINRAT_V3_PRODUCTION === "1";
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
  const [section, setSection] = useState<InvestigationSection>(() => currentSection());
  const [search, setSearch] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try { return readCasebook(window.localStorage.getItem(CASEBOOK_KEY)); } catch { return []; }
  });
  const [casebookPersistent, setCasebookPersistent] = useState(true);
  const [caseNotes, setCaseNotes] = useState(() => {
    try { return readCaseNotes(window.localStorage.getItem(CASE_NOTES_KEY)); }
    catch { return readCaseNotes(null); }
  });
  const [notesPersistent, setNotesPersistent] = useState(true);
  const [historical, setHistorical] = useState<{ id: string; snapshot: PonsPreview; state: "VERIFIED_HISTORICAL" | "HISTORICAL_SOURCE_ONLY" | "UNAVAILABLE"; error: string; envelope?: CaseEnvelope; item?: HistoricalCaseItem } | null>(null);
  const [stage, setStage] = useState<Stage>("WHAT");
  const [trail, setTrail] = useState<PonsCreatorTrail | null>(null);
  const [trailError, setTrailError] = useState("");
  const [trailLoading, setTrailLoading] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const caseRef = useRef<HTMLElement>(null);
  const findsRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const returningCase = useRef<string | null>(null);
  const stageTabs = useRef<(HTMLButtonElement | null)[]>([]);
  const lastVerified = useRef<PonsPreview | null>(null);

  useEffect(() => {
    const navigate = () => {
      const id = requestedCase();
      setSelectedId(id); setSection(currentSection());
      setStage("WHAT"); setShareNotice("");
    };
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
  const familiarAddresses = new Set(cases.filter(item => item.priorLaunches > 0).map(item => item.reportedCreatorAddress));
  const trailCases = cases.filter(item => familiarAddresses.has(item.reportedCreatorAddress));
  const filtered = filterDiscoverableCases(section === "trails" ? trailCases : cases, search, false);
  const sharedLeads = sharedDeployerLeads(cases);
  const firstSharedLead = sharedLeads[0];
  const historyMatchCount = cases.filter(item => item.priorLaunches > 0).length;
  const visibleCases = expanded ? filtered : filtered.slice(0, 6);
  const earlierVisibleCases = active && !isHistorical ? cases.filter(item => item.id !== active.id && item.reportedCreatorAddress === active.reportedCreatorAddress && BigInt(item.block) < BigInt(active.block)) : [];
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
    } else mainRef.current?.focus({ preventScroll: true });
  }, [selectedId, caseReady, section]);

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
  function openSharedDeployer(address: string) {
    navigateSection("/trails");
    // Search is limited to current already-verified Case records; no RPC or new history.
    setSearch(address);
  }
  function navigateSection(path: string) {
    window.history.pushState(null, "", navigationUrl(path));
    setSection(sectionForPath(path)); setSelectedId(null); setStage("WHAT");
    setShareNotice(""); setExpanded(false); setSearch("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function editCaseNote(id: string, value: string) {
    if (!savedIds.includes(id)) return;
    const next = updateCaseNote(caseNotes, id, value);
    try { window.localStorage.setItem(CASE_NOTES_KEY, JSON.stringify(next)); setNotesPersistent(true); }
    catch { setNotesPersistent(false); }
    setCaseNotes(next);
  }
  function toggleCasebook(id: string) {
    const next = toggleSavedCase(savedIds, id);
    try { window.localStorage.setItem(CASEBOOK_KEY, JSON.stringify(next)); setCasebookPersistent(true); }
    catch { setCasebookPersistent(false); }
    setSavedIds(next);
    if (!next.includes(id) && Object.hasOwn(caseNotes, id)) {
      const cleaned = updateCaseNote(caseNotes, id, "");
      try { window.localStorage.setItem(CASE_NOTES_KEY, JSON.stringify(cleaned)); setNotesPersistent(true); }
      catch { setNotesPersistent(false); }
      setCaseNotes(cleaned);
    }
  }
  function selectCase(id: string) {
    returningCase.current = id;
    setSelectedId(id);
    setStage("WHAT");
    setShareNotice("");
    window.history.pushState({ invOrigin: section === "find" ? "/" : "/" + section }, "", navigationUrl("/bag/" + id));
  }
  function returnToFinds() {
    window.history.pushState(null, "", navigationUrl(section === "find" ? "/#vl-finds" : "/" + section));
    setSelectedId(null); setStage("WHAT"); setShareNotice("");
  }
  function openCaseLink(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault(); selectCase(id);
  }
  function startDigging() {
    window.history.replaceState(window.history.state, "", navigationUrl("/#vl-finds"));
    findsRef.current?.focus({ preventScroll: true });
    findsRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  async function copyCaseLink() {
    if (!active) return;
    const url = new URL(navigationUrl("/bag/" + active.id), window.location.origin).href;
    try { await navigator.clipboard.writeText(url); setShareNotice("Case link copied."); }
    catch { setShareNotice("Copy the exact Case link from your browser’s address bar."); }
  }

  return <div className="inv-layout">
    <InvestigationNav section={section} hasCase={Boolean(selectedId)} savedCount={savedIds.length} isFresh={Boolean(isFresh)} onNavigate={navigateSection} hrefForPath={navigationUrl} />
    <div className="visual-lab vl-pons-preview a1-frontdoor" data-material="pearl" data-view={selectedId ? "case" : section}>
    <a className="vl-skip" href={selectedId ? "#vl-case" : (section === "find" || section === "trails") ? "#vl-finds" : "#inv-main"}>Skip to {selectedId ? "Case" : "investigation"}</a>
    <header className="vl-topbar">
      <a className="vl-brand" href={navigationUrl("/")}><strong>BINRAT</strong></a>
      <div className="inv-location"><span className="vl-eyebrow">YOUR WORKSPACE</span><span>{selectedId ? "CASE FILE" : section === "find" ? "THE DUMPSTER" : section === "trails" ? "DEPLOYER TRAILS" : section === "saved" ? "CASEBOOK" : section === "crew" ? "THE CREW" : "SOURCE STATUS"}</span></div>
      <div className="vl-command">
        <div className="vl-lab-stamp"><span>{gitHackPreview ? "RECORDED PONS WINDOW" : productionSite ? "PONS / ROBINHOOD CHAIN" : candidateSite ? "CANDIDATE · PONS" : "PONS READ PREVIEW"}</span><b data-read-state={readState}>{loading ? "Checking source…" : isFresh ? "Publication checked" : data ? "Updates paused · earlier receipts" : "Source unavailable"}</b></div>
        <button type="button" className="vl-utility" onClick={refresh} disabled={loading}>{loading ? "CHECKING…" : "RECHECK"}</button>
      </div>
    </header>
    <main ref={mainRef} tabIndex={-1} className="vl-workspace" id="inv-main">
      {!selectedId && (section === "find" || section === "trails") && <>
      {section === "find" && <section className="a1-hero inv-arrival" aria-labelledby="a1-title">
        <div className="inv-arrival-scene"><AlleyWorld /></div>
        <div className="inv-arrival-copy"><span className="vl-eyebrow">RAT ZERO / PONS SCOUT</span>
        <h1 id="a1-title">THE RAT<br /><span>REMEMBERS.</span></h1>
        <p>Pons launches. Earlier history. Open a Case and check the receipts.</p>
        <button className="inv-arrival-action" onClick={startDigging}>START DIGGING <span aria-hidden="true">↓</span></button></div>
        <span className="inv-scene-caption">RAT ZERO · SCOUT</span>
      </section>}
      <section ref={findsRef} tabIndex={-1} className="vl-discovery a1-discovery" id="vl-finds" aria-labelledby="a1-finds-title">
        <header><div><span className="vl-eyebrow">{section === "trails" ? "COMPARE THE RECORDS" : "THE DUMPSTER / PONS"}</span><h2 id="a1-finds-title">{section === "trails" ? "SMELLS FAMILIAR." : isFresh ? "RIGHT NOW IN THE BIN." : data ? "What Rat Zero found." : "WHAT DID THE RAT FIND?"}</h2></div>{data && <span className="inv-count-badge">{filtered.length} {section === "trails" ? "MATCHING CASES" : "FINDS"}</span>}</header>
        {section === "trails" && <p className="inv-tool-note">Compare launches reported from the same address. These groups cover this launch window; a match says nothing about returns or human ownership.</p>}
        <div className="inv-discovery-tools"><label className="inv-search"><span>SEARCH THIS WINDOW</span>
          <input type="search" maxLength={128} value={search} onChange={(e) => { setSearch(e.target.value); setExpanded(false); }} placeholder="Token, symbol, address…" />
        </label>{section === "find" && <button className="vl-utility inv-trails-shortcut" onClick={() => navigateSection("/trails")}>COMPARE DEPLOYERS <span aria-hidden="true">↗</span></button>}</div>
        <p className="a1-coverage">{data ? <>{gitHackPreview ? "Recorded" : isFresh ? "Checked" : "Last source check"} <time dateTime={new Date(data.status.verifiedAtMs).toISOString()}>{new Date(data.status.verifiedAtMs).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time> · {cases.length} launches · partial history.</> : "Pons / Robinhood Chain · partial launch history."}</p>
        {error && <p role="alert">{data ? "Updates paused. Last verified snapshot retained, now stale. Recheck to try again." : "We could not verify the Pons source. Recheck to try again."}</p>}
        {!data && <p role="status">{loading ? "Rat Zero is checking the source. Launches appear here once verified." : "Pons launches are unavailable. Recheck to try again. Nothing was substituted."}</p>}
        {data && cases.length === 0 && <p role="status">Verified empty feed at this checkpoint. No launches to open yet. Recheck for new finds.</p>}
        {data && cases.length > 0 && filtered.length === 0 && <div className="inv-empty-state" role="status"><h3>{search.trim() ? "Nothing in this window." : "No earlier matches here."}</h3><p>{search.trim() ? "Try another token or address. Only these published launches were searched." : "No earlier match in our partial index. Older history remains unknown."}</p>{search.trim() && <button className="vl-utility" onClick={() => setSearch("")}>CLEAR SEARCH</button>}</div>}
        {data && section === "find" && !search.trim() && (firstSharedLead || historyMatchCount > 0) && <SpotlightCard className="inv-evidence-lead" aria-label="Relationships in this recorded launch window">
          <ShinyText className="inv-evidence-lead-tag">RAT ZERO / VERIFIED CONNECTION</ShinyText>
          <span className="inv-evidence-lead-fact">{firstSharedLead
            ? firstSharedLead.caseIds.length + " launches share one reported deployer in this window"
            : historyMatchCount + " launches have earlier indexed deployer activity"}</span>
          <StarBorder className="inv-evidence-lead-action" onClick={() => firstSharedLead
            ? openSharedDeployer(firstSharedLead.address) : navigateSection("/trails")}>
            {firstSharedLead ? "COMPARE THOSE CASES ↗" : "INSPECT MATCHES ↗"}
          </StarBorder>
          <small>Address match only. No ownership, risk or profit claim.</small>
        </SpotlightCard>}
        {data && filtered.length > 0 && (section === "trails" ? <DeployerGroups cases={filtered} onOpen={selectCase} /> : <div className="vl-find-rail a1-find-grid">{visibleCases.map(item => <FindRow key={item.id} item={item} onOpen={selectCase} />)}</div>)}
        {section === "find" && !expanded && filtered.length > 6 && <button className="vl-utility a1-more" onClick={() => setExpanded(true)}>SHOW ALL {filtered.length} LAUNCHES <span aria-hidden="true">↓</span></button>}
        <details className="inv-source-limits"><summary>What these finds tell you</summary><p>Launch order comes from indexed blocks. Earlier-launch counts refer to the Pons-reported deployer in partial history. They do not identify a human, predict returns or show safety. Source freshness describes the publication check, not launch age.</p></details>
      </section>
      </>}
      {!selectedId && section === "saved" && <SavedCases ids={savedIds} cases={cases} notes={caseNotes} persistent={casebookPersistent && notesPersistent} onOpen={selectCase} onRemove={toggleCasebook} onFind={() => navigateSection("/")} onNoteChange={editCaseNote} />}
      {!selectedId && section === "crew" && <section className="inv-workbench" aria-labelledby="inv-crew-heading">
        <span className="vl-eyebrow">THE WORKFORCE</span><h1 id="inv-crew-heading">ONE RAT DIGGING. MORE IN THE WORKS.</h1><p>The Scout brings the Case. The rest of the crew is being built and tested.</p>
        <div className="inv-crew-list">
          <article><div className="inv-crew-art inv-crew-scout"><img src="/crew/rat-avatar-48.png" alt="Rat Zero" /></div><div><span className="vl-eyebrow">SCOUT</span><h2>RAT ZERO</h2><span className="inv-crew-state">{isFresh ? "SOURCE CHECKED" : loading ? "CHECKING" : data ? "EARLIER FINDS / UPDATES PAUSED" : "SOURCE UNAVAILABLE"}</span><p>Finds Pons launches. Brings the reported addresses, indexed history and source receipts into a Case.</p><button className="vl-utility" onClick={() => navigateSection("/")}>SEE HIS FINDS →</button></div></article>
          <article><div className="inv-crew-art"><img src="/crew/tripwire.png" alt="Tripwire" /></div><div><span className="vl-eyebrow">WATCHER</span><h2>TRIPWIRE · BUILDING</h2><p>Planned job: stay behind and alert you when a declared event happens. No active Watch or alert delivery on this site.</p></div></article>
          <article><div className="inv-crew-art"><img src="/crew/sniffer.png" alt="Sniffer" /></div><div><span className="vl-eyebrow">TRAIL HUNTER</span><h2>SNIFFER · PROVING</h2><p>Funding-trail investigations are being tested. Public autonomous work and prediction are not established.</p></div></article>
        </div>
        <div className="inv-local-note">WORKING RAT · PLANNED · entitlement inactive. $BINRAT has not launched.</div>
      </section>}
      {!selectedId && section === "status" && <section className="inv-workbench" aria-labelledby="inv-status-heading">
        <span className="vl-eyebrow">SOURCE & CAPABILITY STATUS</span><h1 id="inv-status-heading">CHECK THE SOURCE.</h1>
        <dl className="inv-status-list"><div><dt>Current read</dt><dd>{readState}</dd></div>
          <div><dt>Last verified at</dt><dd>{data ? new Date(data.status.verifiedAtMs).toLocaleString() : "Unavailable"}</dd></div>
          <div><dt>Visible indexed launches</dt><dd>{data ? cases.length : "Unavailable"}</dd></div>
          <div><dt>Historical coverage</dt><dd>PARTIAL / do not infer absence</dd></div>
          <div><dt>Tripwire / Sniffer</dt><dd>BUILDING / PROVING · NOT PUBLIC LIVE</dd></div></dl>
        <p>Source freshness is not launch age. Saved Cases are not Watches or notifications.</p>
        <button className="vl-utility" onClick={refresh}>RECHECK SOURCE →</button>
      </section>}
      {selectedId && <div className="a1-case-navigation"><button className="vl-utility inv-case-back" onClick={returnToFinds}>← {section === "saved" ? "BACK TO CASEBOOK" : section === "trails" ? "BACK TO TRAILS" : "BACK TO FINDS"}</button>{active && <button className="vl-utility" onClick={copyCaseLink}>COPY CASE LINK</button>}{active && <button className="vl-utility inv-save-case" aria-pressed={savedIds.includes(active.id)} onClick={() => toggleCasebook(active.id)}>{savedIds.includes(active.id) ? (casebookPersistent ? "SAVED ON THIS DEVICE" : "SAVED FOR THIS SESSION") : "SAVE CASE"}</button>}<span role="status">{shareNotice}</span></div>}
      {selectedId && !data && loading && <article ref={caseRef} tabIndex={-1} id="vl-case" className="vl-hero-surface vl-loading-case" aria-busy="true" aria-label="Checking Pons Cases">
        <div className="vl-case-topline">RAT ZERO / CHECKING THE RECEIPTS</div>
        <div className="vl-case-hero"><div className="vl-case-art vl-skeleton" /><div className="vl-case-intro"><h1>THE RAT'S ON IT.</h1><p>Checking real Pons launches and their source receipts.</p></div></div>
        <div className="vl-case-steps vl-skeleton" /><div className="vl-stage"><p>Verified Cases appear here. A missing source stays unavailable.</p></div>
      </article>}
      {selectedId && !loading && !active && <article ref={caseRef} tabIndex={-1} id="vl-case" aria-label="Requested Case unavailable" className="vl-hero-surface vl-missing-case" data-historical-state={checkingHistorical ? "CHECKING" : historicalResult?.state ?? "UNAVAILABLE"}>
        <h1>{checkingHistorical ? "CHECKING EXACT SOURCE." : historicalResult?.state === "HISTORICAL_SOURCE_ONLY" ? "HISTORICAL SOURCE ONLY." : "CASE UNAVAILABLE."}</h1>
        <p role={checkingHistorical ? "status" : "alert"}>{checkingHistorical ? "This Case is outside the latest launch window. Checking its exact source record…" : historicalResult?.state === "HISTORICAL_SOURCE_ONLY" ? "The exact source record exists, but its historical projection cannot be verified by this UI. No replacement Case was selected." : data ? "The exact historical source is unavailable or could not be validated. No replacement Case was selected." : "The Pons source is unavailable. Recheck to try again; your exact Case link is preserved."}</p>
        <p>{gitHackPreview ? "This recorded preview only includes the captured launch window. Cases outside it cannot be reopened here." : "The link still points to your exact Case. We need a verifiable source record to show its finding."}</p>
        <details className="inv-source-limits"><summary>Exact Case and source details</summary><p>Historical records use a separate publication projection with unverified history. This link preserves the launch identity, not an archived publication.</p>{historicalResult?.error && <p className="vl-provenance">Source check: {historicalResult.error}</p>}<p className="vl-address">REQUESTED CASE <code>{selectedId}</code></p></details>
        {!gitHackPreview && /^[0-9a-f]{64}$/.test(selectedId) && <a className="vl-utility" href={"/api/bag/" + selectedId} target="_blank" rel="noreferrer">CHECK EXACT SOURCE RECORD ↗</a>}
      </article>}
      {data && active && <article ref={caseRef} tabIndex={-1} aria-label={"Case " + tokenLabel(active)} id="vl-case" className="vl-hero-surface a1-active-case" data-case={active.id} data-projection={isHistorical ? "HISTORICAL" : "LATEST"}>
        <div className="vl-case-topline"><span>CASE FILE / PONS <b>{active.id.slice(0, 10)}…</b></span><span className="vl-case-status" data-read-state={readState}>{isHistorical ? "HISTORICAL · DIGEST CHECKED" : isFresh ? "SOURCE CHECKED" : "UPDATES PAUSED"}</span></div>
        {error && <p role="alert">Last verified snapshot retained, now stale. Recheck to try again.</p>}
        <div className="vl-case-hero">
          <figure className="vl-case-art"><img src={caseScene} alt="Decorative neon BINRAT alley illustration" /><figcaption>ILLUSTRATION ONLY · NOT EVIDENCE</figcaption></figure>
          <div className="vl-case-intro">
            <span className="vl-alert">{active.priorLaunches > 0 ? "SMELLS FAMILIAR." : "FOUND SOMETHING."}</span>
            <h1>{active.name.trim() || active.symbol.trim() ? tokenLabel(active) : shortAddress(active.token)}</h1>
            <p>{active.priorLaunches > 0
              ? "Pons recorded this launch. The reported deployer also appears on " + active.priorLaunches + (isHistorical ? " earlier indexed launches in this returned window." : " earlier indexed launches.")
              : "Pons recorded this launch. No earlier matching deployer appears in our partial index. Older history is unknown."}</p>
            <div className="vl-chips"><span>{active.name.trim() || active.symbol.trim() ? shortAddress(active.token) : "NAME NOT REPORTED"}</span><span>{isHistorical ? "PARTIAL · UP TO 20 RECORDS" : "HISTORY PARTIAL"}</span></div>
          </div>
        </div>
        {isHistorical && <p className="a12-history-notice">Historical launch observation at block {active.block}, reconstructed from the indexed source at published checkpoint {active.asOfBlock}. {isFresh ? "Publication source checked." : "Publication updates paused; evidence is stale."} This is not an immutable archived publication or a historical point-in-time replay. The same-origin index supplies source authority; the browser checks digest, identity and provenance derivation without independently querying the chain.</p>}
        <div className="vl-case-steps" role="tablist" aria-label="Pons Case journey">
          {stages.map((name, index) => <button key={name} ref={(node) => { stageTabs.current[index] = node; }}
            id={"vl-tab-" + name} role="tab" aria-selected={name === stage}
            aria-controls={"vl-panel-" + name} tabIndex={name === stage ? 0 : -1}
            className={name === stage ? "active" : ""} onClick={() => advance(name)} onKeyDown={onStageKey}>
            <strong>{name === "WHAT" ? "SUMMARY" : name}</strong><small>{["What was found", "Compare history", "Check the source"][index]}</small>
          </button>)}
        </div>
        <section role="tabpanel" id={"vl-panel-" + stage} aria-labelledby={"vl-tab-" + stage} className="vl-stage" tabIndex={0}>
          {stage === "WHAT" && <div className="vl-what">
            <div><span className="vl-eyebrow">WHAT YOU CAN CHECK</span><h2>{active.priorLaunches > 0 ? "Pull on the earlier history." : "Start with the launch record."}</h2>
              <p>{active.priorLaunches > 0 ? "Compare the launches tied to this reported address. The match is a starting point for investigation; it does not establish ownership, intent or returns." : "The source records a launch and a deployer address. A missing earlier match does not prove a clean history."}</p>
              <div className="inv-case-actions"><button className="vl-primary" onClick={() => advance("TRAIL", true)}>FOLLOW THE TRAIL →</button><button className="vl-utility" onClick={() => advance("RECEIPTS", true)}>CHECK RECEIPTS →</button></div></div>
            <dl className="inv-case-facts"><div><dt>Reported deployer</dt><dd>{shortAddress(active.reportedCreatorAddress)}</dd></div><div><dt>Earlier indexed launches</dt><dd>{active.priorLaunches} <small>· {isHistorical ? "returned window only" : "partial history"}</small></dd></div><div><dt>Observed launch block</dt><dd>{active.block}</dd></div><div><dt>Source</dt><dd>Pons / Robinhood 4663</dd></div></dl>
          </div>}
          {stage === "TRAIL" && <div className="vl-trail-view"><div className="vl-stage-heading"><div><span className="vl-eyebrow">REPORTED DEPLOYER · {shortAddress(active.reportedCreatorAddress)}</span><h2>{active.priorLaunches > 0 ? "Same address. Earlier records." : "Earlier history is unknown."}</h2></div></div>
            <p>{active.priorLaunches > 0 ? String(active.priorLaunches) + " earlier indexed launches share the Pons-reported deployer. A shared address does not establish a shared human identity." : "Zero matching earlier launches in this partial index does not prove a clean history."}</p>
            {!isHistorical && <section className="inv-related-cases" aria-label="Earlier Cases in this launch window"><h3>Earlier Cases in this launch window</h3>{earlierVisibleCases.length > 0 ? <div className="a1-find-grid">{earlierVisibleCases.map(item => <FindRow key={item.id} item={item} onOpen={selectCase} compact />)}</div> : <p>No earlier matching Case appears in these {cases.length} launches. Older indexed records may exist outside this window.</p>}<p className="vl-provenance">{earlierVisibleCases.length} related Cases shown here. This is a subset of the launch window, not the full earlier-launch count.</p></section>}
            {isHistorical && <><ol className="vl-source-trail">{historicalEnvelope!.material.records.map(({launch}) => <li key={launch.launchId}><span className="vl-eyebrow">BLOCK {launch.blockNumber}{launch.launchId === active.id ? " · THIS CASE" : ""}</span><strong>{launch.name || launch.symbol || "Unnamed launch"}</strong><code>{launch.token}</code>{launch.launchId !== active.id && <a className="vl-text-action" href={navigationUrl("/bag/" + launch.launchId)} onClick={e => openCaseLink(e, launch.launchId)}>OPEN EXACT CASE →</a>}</li>)}</ol><p className="vl-provenance">{active.priorLaunches} earlier indexed launches in this returned window of {historicalEnvelope!.material.records.length} records through this Case. At most 20 records; older history is not enumerated. This count uses the historical reconstruction projection, not the latest-feed count.</p></>}
            {trailLoading && !isHistorical && <p role="status">Checking the deployer's latest source records…</p>}
            {trailError && !isHistorical && <p role="status">{gitHackPreview ? "The extended deployer source is not included in this recorded preview. Compare the captured Cases above." : "The extended trail is unavailable at this checkpoint. The verified Cases above remain available."}</p>}
            {trail && !isHistorical && <><h3>Extended deployer source</h3><ol className="vl-source-trail">{trail.launches.map((launch) => <li key={launch.launchId}><span className="vl-eyebrow">BLOCK {launch.blockNumber}{launch.launchId === active.id ? " · THIS CASE" : ""}</span><strong>{launch.name || launch.symbol || shortAddress(launch.token)}</strong><code>{launch.token}</code>{launch.launchId !== active.id && <a className="vl-text-action" href={navigationUrl("/bag/" + launch.launchId)} onClick={e => openCaseLink(e, launch.launchId)}>OPEN EXACT CASE →</a>}</li>)}</ol><p className="vl-provenance">Latest four verified launches at most. Older records are omitted; this is partial history.</p></>}
            {!gitHackPreview && !isHistorical && <a className="vl-text-action" href={"/api/creator/" + active.reportedCreatorAddress + "/summary"} target="_blank" rel="noreferrer">OPEN DEPLOYER SOURCE ↗</a>}</div>}
          {stage === "RECEIPTS" && <div className="vl-receipts-view"><div className="vl-stage-heading"><div><span className="vl-eyebrow">CHECK THE RECEIPTS</span><h2>Exact source-bound record.</h2></div></div>
            <details className="vl-receipt"><summary><strong>Pons indexed launch and checkpoint</strong> · EXPAND</summary>
              <div className="vl-receipt-body"><dl><div><dt>Chain</dt><dd>Pons / Robinhood 4663</dd></div><div><dt>Block</dt><dd>{active.block}</dd></div><div><dt>Token</dt><dd>{active.token}</dd></div><div><dt>Reported deployer</dt><dd>{active.reportedCreatorAddress}</dd></div><div><dt>Transaction</dt><dd>{active.txHash}</dd></div><div><dt>Source receipt</dt><dd>{active.receipt}</dd></div><div><dt>{isHistorical ? "Case evidence digest" : "Feed digest"}</dt><dd>{isHistorical ? historicalEnvelope!.digest : currentCase!.feedDigest}</dd></div><div><dt>Verified at</dt><dd>{new Date(data.status.verifiedAtMs).toISOString()}</dd></div><div><dt>Source</dt><dd>{gitHackPreview ? "Recorded source only; no live API in this preview." : <><a href={isHistorical ? "/api/bag/" + active.id + "/evidence" : sourceRoute} target="_blank" rel="noreferrer">{isHistorical ? "Canonical Case evidence envelope ↗" : "Same-origin Pons public feed ↗"}</a> · <a href={"/api/bag/" + active.id} target="_blank" rel="noreferrer">Exact Case source ↗</a></>}</dd></div><div><dt>Limits</dt><dd>Partial index. Optional intelligence and replay are not shown. Human ownership, intent, sellability and profitability remain unknown.</dd></div></dl>
                <pre tabIndex={0}>{JSON.stringify(isHistorical ? historicalEnvelope : { chainId: 4663, launchId: active.id, token: active.token, txHash: active.txHash, reportedDeployer: active.reportedCreatorAddress, blockNumber: active.block, checkpointBlock: data.status.checkpointBlock, checkpointBlockHash: data.status.checkpointBlockHash, feedDigest: data.status.feedDigest, priorLaunchCount: active.priorLaunches, coverage: "PARTIAL" }, null, 2)}</pre>
              </div></details><p className="vl-provenance">{isHistorical ? "Case digest, canonical launch/event identities, provenance derivation, window count and publication binding are checked. The index is the source authority; this is not independent RPC verification or archived replay." : "Feed/status digest binding is checked. This UI does not independently verify transaction execution from RPC."}</p></div>}
        </section>
        <div className="inv-case-return"><div><span className="vl-eyebrow">PICK THIS UP LATER</span><p>{savedIds.includes(active.id) ? "This Case link is in your Casebook." : "Keep this exact Case in your Casebook."} Saving creates no Watch or alerts.</p></div><button className="vl-utility" onClick={() => savedIds.includes(active.id) ? navigateSection("/saved") : toggleCasebook(active.id)}>{savedIds.includes(active.id) ? "OPEN CASEBOOK →" : "KEEP THIS CASE →"}</button></div>
        <div className="vl-case-bottom"><p>Partial history · shared address ≠ shared owner · no buy/sell recommendation</p></div>
      </article>}
      <footer className="vl-footer"><p>HE GETS THE SCRAPS. YOU GET THE RECEIPTS.</p><a href="https://t.me/BinratBot" target="_blank" rel="noopener noreferrer">TELEGRAM RAT ↗</a></footer>
    </main>
    </div>
  </div>;
}
