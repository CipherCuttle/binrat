import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { AppLink, CopyButton, CoverageStamp } from "../Primitives";
import { REPLAY_HORIZONS, replayStagesForBag, type ReplayHorizon, type ReplayStage } from "../evidenceIntegrity";
import { loadLiveReplayBundle, type DataMode } from "../data";
import { RecipientActivityPanel } from "../RecipientActivityPanel";
import type { LiveReplayBundle } from "../liveAdapter";
import type { Bag, PublicFeed, RadarWatchlist } from "../types";
import s from "./MobileExperience.module.css";

type Go = (path: string) => void;
export type Bookmark = { kind: "bag" | "radar"; id: string; mode: DataMode };
const KEY = "binrat-mobile-bookmarks-v1";
const short = (text: string) => text.length > 15 ? text.slice(0, 8) + "…" + text.slice(-6) : text;

export function useMobileBookmarks() {
  const [saved, setSaved] = useState<Bookmark[]>(() => {
    try {
      const data: unknown = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(data) ? data.filter((x): x is Bookmark =>
        x && (x.kind === "bag" || x.kind === "radar") &&
        (x.mode === "DEMO" || x.mode === "LIVE") &&
        typeof x.id === "string" && x.id.length > 0 && x.id.length <= 128).slice(0, 50) : [];
    } catch { return []; }
  });
  const [persistent, setPersistent] = useState(true);
  const contains = (x: Bookmark) => saved.some(y => y.kind === x.kind && y.id.toLowerCase() === x.id.toLowerCase() && y.mode === x.mode);
  const toggle = (x: Bookmark) => {
    const next = contains(x) ? saved.filter(y => !(y.kind === x.kind && y.id.toLowerCase() === x.id.toLowerCase() && y.mode === x.mode)) : [x, ...saved].slice(0, 50);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { setPersistent(false); }
    setSaved(next);
  };
  return { saved, contains, toggle, persistent };
}
type Bookmarks = ReturnType<typeof useMobileBookmarks>;
function Icon({ name }: { name: "discover" | "radar" | "saved" | "more" }) {
  const paths = {
    discover: <><path d="m3 10 9-7 9 7v11H3z"/><path d="m9 14 3 3 4-5"/></>,
    radar: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7"/></>,
    saved: <path d="M5 3h14v18l-7-5-7 5z"/>,
    more: <path d="M4 6h16M4 12h16M4 18h16"/>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function MobileShell({ page, mode, checkpoint, navigate, children }: {
  page: string; mode: DataMode; checkpoint: string | null; navigate: Go; children: ReactNode;
}) {
  const current = page === "radar" ? "Radar" : page === "saved" ? "Saved" : ["more", "ledger", "replay", "watch", "binrat", "method"].includes(page) ? "More" : "Discover";
  const tabs = [{ label: "Discover", name: "discover", path: "/" }, { label: "Radar", name: "radar", path: "/radar" }, { label: "Saved", name: "saved", path: "/saved" }, { label: "More", name: "more", path: "/more" }] as const;
  return <div className={s.shell}>
    <header className={s.header}>
      <AppLink href="/" navigate={navigate} className={s.brand} ariaLabel="BINRAT Discover">
        <span className={s.logo}>BR<span>↗</span></span><span>BINRAT<small>RECEIPTS DECIDE TRUTH.</small></span>
      </AppLink>
      <div className={s.status}><i/><b>{mode === "DEMO" ? "DEMO" : "LIVE"}</b><small>ARC · 5042</small></div>
    </header>
    <div className={s.rail}><span>FIELD TERMINAL / {current.toUpperCase()}</span><span>{checkpoint ? "BLOCK " + checkpoint : "INDEX NOT READY"}</span></div>
    <main id="content" tabIndex={-1} className={s.main}>{children}</main>
    <nav className={s.nav} aria-label="Mobile primary navigation">{tabs.map(t =>
      <AppLink key={t.path} href={t.path} navigate={navigate} className={current === t.label ? s.navActive : s.navItem} ariaCurrent={current === t.label ? "page" : undefined}>
        <Icon name={t.name}/><span>{t.label}</span>
      </AppLink>)}</nav>
  </div>;
}
function Lead({ eyebrow, title, sub, aside }: { eyebrow: string; title: string; sub: string; aside?: ReactNode }) {
  return <header className={s.lead}><span className={s.eyebrow}>↗ &nbsp;{eyebrow}</span><div className={s.leadTitle}><h1>{title}<em>.</em></h1>{aside}</div><p>{sub}</p></header>;
}
function Coverage({ state }: { state: Bag["trashTrail"]["coverage"] }) {
  return <span className={s.coverage} data-state={state.toLowerCase()}><i/>{state}</span>;
}
function Save({ item, bookmarks, label }: { item: Bookmark; bookmarks: Bookmarks; label: string }) {
  const selected = bookmarks.contains(item);
  return <button type="button" className={selected ? s.saveActive : s.save} onClick={() => bookmarks.toggle(item)} aria-pressed={selected}
    aria-label={selected ? "Remove " + label + " from saved files" : "Save " + label + " on this device"}>
    <Icon name="saved"/>{selected ? "SAVED" : "SAVE"}
  </button>;
}
function LaunchCard({ bag, mode, bookmarks, navigate, featured = false }: {
  bag: Bag; mode: DataMode; bookmarks: Bookmarks; navigate: Go; featured?: boolean;
}) {
  const item: Bookmark = { kind: "bag", id: bag.id, mode };
  return <article className={featured ? s.feature : s.launch}>
    <div className={s.cardHead}><span>{featured ? "LATEST INDEXED / " : "FILE / "}BLK {bag.blockNumber}</span><Coverage state={bag.trashTrail.coverage}/></div>
    <AppLink href={"/bag/" + bag.id} navigate={navigate} className={s.cardBody} ariaLabel={"Open " + bag.symbol + " dossier"}>
      <div className={s.symbol}><strong>{"$" + bag.symbol}</strong><span>{bag.name}</span></div>
      <div className={s.prior}><strong>{String(bag.trashTrail.priorLaunchCount).padStart(2, "0")}</strong><small>PRIOR INDEXED<br/>BAGS</small></div>
      <div className={s.creator}><span>REPORTED CREATOR</span><code>{short(bag.reportedCreatorAddress)}</code></div>
    </AppLink>
    <div className={s.cardFoot}><span>{mode === "DEMO" ? "SYNTHETIC FILE" : "PUBLIC INDEX"} / ARC 5042</span>
      <div><Save item={item} bookmarks={bookmarks} label={"bag " + bag.symbol}/><AppLink className={s.open} href={"/bag/" + bag.id} navigate={navigate}>OPEN FILE ↗</AppLink></div></div>
  </article>;
}
export function MobileDiscover({ feed, radar, mode, bookmarks, navigate }: {
  feed: PublicFeed; radar: RadarWatchlist | null; mode: DataMode; bookmarks: Bookmarks; navigate: Go;
}) {
  const [search, setSearch] = useState("");
  const [repeats, setRepeats] = useState(false);
  const matches = feed.bags.filter(bag =>
    (bag.symbol + " " + bag.name + " " + bag.reportedCreatorAddress).toLowerCase().includes(search.toLowerCase()) &&
    (!repeats || bag.trashTrail.priorLaunchCount > 0));
  const lead = radar?.candidates[0];
  return <div className={s.screen}>
    <Lead eyebrow="ARC / LAUNCH MEMORY" title="Discover" sub={mode === "DEMO" ?
      "Explore synthetic dossiers. Demo observations are not chain proof." : "Latest indexed launches and the evidence available right now."}
      aside={<span className={s.counter}>{feed.bags.length} IN VIEW</span>}/>
    <div className={s.sectionHead}><div><small>01 / NEW IN THE BIN</small><h2>Fresh evidence</h2></div><small>BLOCK {feed.asOfBlock}</small></div>
    <div className={s.filters}><label className={s.search}>⌕<span className="sr-only">Search tokens or addresses</span>
      <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Token / reported creator"/></label>
      <button type="button" aria-pressed={repeats} onClick={() => setRepeats(v => !v)} className={repeats ? s.filterActive : s.filter}>↻ REPEATS</button></div>
    {matches.length ? <div className={s.feed}>{matches.map((bag, index) =>
      <LaunchCard key={bag.id} bag={bag} featured={index === 0} mode={mode} bookmarks={bookmarks} navigate={navigate}/>)}</div> :
      <div className={s.empty}><strong>NOTHING IN THIS BAG.</strong><p>No indexed launch matches the current filter.</p></div>}
    {lead && <section className={s.teaser}><small>02 / RADAR SIGNAL</small><div><strong>{lead.distinctLaunchCount}</strong><p>distinct indexed launches share an observed recipient address.</p>
      <AppLink href={"/radar/address/" + lead.observedRecipientAddress} navigate={navigate} ariaLabel="Inspect radar recipient">↗</AppLink></div>
      <span>OBSERVED ROLE / NOT A BUY RECOMMENDATION</span></section>}
    <p className={s.boundary}>NO SCORE. NO BUY CALL. NO HUMAN IDENTITY INFERENCE.</p>
  </div>;
}
export function MobileRadar({ radar, mode, selectedAddress, bookmarks, navigate }: {
  radar: RadarWatchlist; mode: DataMode; selectedAddress?: string; bookmarks: Bookmarks; navigate: Go;
}) {
  const selected = selectedAddress ? radar.candidates.find(x => x.observedRecipientAddress.toLowerCase() === selectedAddress.toLowerCase()) : radar.candidates[0];
  return <div className={s.screen}>
    <Lead eyebrow="02 / OBSERVED RECURRENCE" title="Rat Radar" sub="Inspect recurring observed recipients and actual receipts, not trading signals."
      aside={<span className={s.counter}>{radar.candidates.length} SHOWN</span>}/>
    <div className={s.coverageBar}><span>INDEXED LAUNCHES <b>{radar.coverage.indexedLaunchCount}</b></span><span>OBSERVED ADDRESSES <b>{radar.coverage.distinctRecipientAddressCount}</b></span></div>
    {selected ? <section className={s.radarCard}>
      <div className={s.cardHead}><span>OPEN FILE / {String(selected.rank).padStart(2, "0")}</span><Coverage state={radar.coverage.historyCoverage}/></div>
      <span className={s.meta}>OBSERVED V3 SWAP RECIPIENT</span><h2>{short(selected.observedRecipientAddress)}</h2>
      <div className={s.stats}><div><strong>{selected.distinctLaunchCount}</strong><small>DISTINCT<br/>LAUNCHES</small></div>
        <div><strong>+{selected.medianFirstEntryBlockDelta}</strong><small>MEDIAN ENTRY<br/>BLOCK DELTA</small></div>
        <div><strong>{selected.acquisitionReceiptCount}</strong><small>ACQUISITION<br/>RECEIPTS</small></div></div>
      <div className={s.radarActions}><Save item={{ kind: "radar", id: selected.observedRecipientAddress, mode }} bookmarks={bookmarks} label="radar address"/>
        <CopyButton value={selected.observedRecipientAddress} label="observed recipient address"/></div>
      <p className={s.role}>This address is not a reported creator or an identified person.</p>
      <details className={s.details}><summary>REASONS AND SOURCE RECEIPTS <b>＋</b></summary>
        {selected.reasons.map((reason, i) => <p key={reason}><b>0{i + 1}</b> {reason}</p>)}
        <span className={s.meta}>{mode === "DEMO" ? "SYNTHETIC IDS / NOT CHAIN RECEIPTS" : "PUBLIC ACTIVITY IDS"}</span>
        {selected.evidenceActivityIds.map(id => <div className={s.proof} key={id}><code>{id}</code><CopyButton value={id} label="activity identifier"/>
          {mode === "LIVE" && /^[0-9a-f]{64}$/i.test(id) && <a href={"/api/rat-radar/activity/" + id} target="_blank" rel="noopener noreferrer">PUBLIC JSON ↗</a>}</div>)}
        <span>RADAR CHECKPOINT {radar.asOfBlock} · <CoverageStamp state={radar.coverage.historyCoverage}/></span>
      </details>
    </section> : <div className={s.empty}><strong>NO MATCHING RADAR FILE.</strong><p>No other recipient was substituted.</p></div>}
    {(selected || (selectedAddress && /^0x[0-9a-f]{40}$/i.test(selectedAddress))) &&
      <RecipientActivityPanel key={selected?.observedRecipientAddress ?? selectedAddress}
        address={selected?.observedRecipientAddress ?? selectedAddress!} mode={mode} shortlistCheckpoint={radar.asOfBlock}/>}
    <div className={s.sectionHead}><div><small>PUBLIC SHORTLIST</small><h2>Other files</h2></div></div>
    <div className={s.radarList}>{radar.candidates.map(x =>
      <AppLink key={x.observedRecipientAddress} href={"/radar/address/" + x.observedRecipientAddress} navigate={navigate}
        className={x.observedRecipientAddress === selected?.observedRecipientAddress ? s.radarRowActive : s.radarRow}
        ariaCurrent={x.observedRecipientAddress === selected?.observedRecipientAddress ? "page" : undefined}>
        <b>{String(x.rank).padStart(2, "0")}</b><span><strong>{short(x.observedRecipientAddress)}</strong><small>OBSERVED RECIPIENT</small></span>
        <em>{x.distinctLaunchCount}<small>LAUNCHES</small></em> ↗</AppLink>)}</div>
    <p className={s.boundary}>{radar.method.identityBoundary} {radar.method.recommendationBoundary}</p>
  </div>;
}
export function MobileBag({ bag, mode, bookmarks, navigate }: { bag: Bag; mode: DataMode; bookmarks: Bookmarks; navigate: Go }) {
  const [stage, setStage] = useState<ReplayHorizon>("LAUNCH");
  const [liveReplay, setLiveReplay] = useState<LiveReplayBundle | null>(null);
  const [replayError, setReplayError] = useState("");
  useEffect(() => {
    if (mode !== "LIVE") return;
    let current = true; setLiveReplay(null); setReplayError("");
    loadLiveReplayBundle(bag.id).then(x => { if (current) setLiveReplay(x); })
      .catch((e: unknown) => { if (current) setReplayError(e instanceof Error ? e.message : "REPLAY_UNAVAILABLE"); });
    return () => { current = false; };
  }, [bag.id, mode]);
  const missing = (): ReplayStage => ({ state: "MISSING", value: "NO VALIDATED REPLAY STAGE", note: "This exact Bag has no separately validated Replay stage loaded." });
  const stages: Record<ReplayHorizon, ReplayStage> = mode === "DEMO" ? replayStagesForBag(bag, mode)
    : liveReplay?.stages ?? { LAUNCH: missing(), "5m": missing(), "1h": missing(), "24h": missing() };
  const replayKeys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = REPLAY_HORIZONS.indexOf(stage);
    const j = e.key === "ArrowRight" ? (i + 1) % 4 : e.key === "ArrowLeft" ? (i + 3) % 4 : e.key === "Home" ? 0 : e.key === "End" ? 3 : -1;
    if (j < 0) return; e.preventDefault(); setStage(REPLAY_HORIZONS[j]);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[j]?.focus();
  };
  return <div className={s.screen}>
    <AppLink href="/dumpster" navigate={navigate} className={s.back}>← BACK TO DISCOVER</AppLink>
    <Lead eyebrow={"BAG DOSSIER / BLOCK " + bag.blockNumber} title={"$" + bag.symbol} sub={bag.name} aside={<Coverage state={bag.trashTrail.coverage}/>}/>
    <section className={s.bagOverview}><span className={s.meta}>SOURCE / ARCPAD · ARC 5042</span>
      <div className={s.bagNumbers}><div><strong>{bag.trashTrail.priorLaunchCount}</strong><span>PRIOR INDEXED<br/>LAUNCHES</span></div>
        <div><strong>{bag.evidence.length}</strong><span>EVIDENCE<br/>ITEMS</span></div></div>
      <div className={s.creatorLine}><small>REPORTED CREATOR ADDRESS</small><code>{short(bag.reportedCreatorAddress)}</code>
        <AppLink href={"/creator/" + bag.reportedCreatorAddress} navigate={navigate}>OPEN CREATOR FILE ↗</AppLink></div>
      <div className={s.bagButtons}><Save item={{kind:"bag",id:bag.id,mode}} bookmarks={bookmarks} label={"bag " + bag.symbol}/>
        <a href="#mobile-replay" className={s.primary}>INSPECT REPLAY ↓</a></div></section>
    <section className={s.evidence}><div className={s.sectionHead}><div><small>01 / WHAT WE KNOW</small><h2>Evidence</h2></div><Coverage state={bag.trashTrail.coverage}/></div>
      {bag.evidence.map(x => <p key={x.text} className={s.evidenceRow}><b>{x.state}</b><span>{x.text}</span></p>)}
      <details className={s.details}><summary>LAUNCH FACTS & SOURCE IDS <b>＋</b></summary>
        {([["TOKEN CONTRACT",bag.token],["TRANSACTION HASH",bag.txHash],["BAG ID / NOT RECEIPT",bag.id]] as const).map(([label,value]) =>
          <div className={s.proof} key={label}><small>{label}</small><code>{value}</code><CopyButton label={label} value={value}/></div>)}</details></section>
    <section id="mobile-replay" className={s.replay} tabIndex={-1}>
      <div className={s.sectionHead}><div><small>02 / FROZEN EVIDENCE</small><h2>Replay Lab</h2></div></div>
      <p>What was knowable at each horizon? Missing stages remain missing.</p>
      <div className={s.replayTabs} role="tablist" aria-label="Frozen observation horizon">{REPLAY_HORIZONS.map((x,i) =>
        <button key={x} type="button" role="tab" id={"mobile-replay-tab-"+i} aria-controls="mobile-replay-readout"
          aria-selected={stage === x} tabIndex={stage === x ? 0 : -1} onKeyDown={replayKeys} onClick={() => setStage(x)}
          className={stage === x ? s.tabActive : s.tab}><small>0{i+1}</small><strong>{x}</strong><span>{stages[x].state}</span></button>)}</div>
      <div id="mobile-replay-readout" role="tabpanel" tabIndex={0} aria-live="polite" className={s.readout}
        aria-labelledby={"mobile-replay-tab-"+REPLAY_HORIZONS.indexOf(stage)}><small>CASE AT {stage} / {stages[stage].state}</small>
        <strong>{stages[stage].value}</strong><p>{stages[stage].note}</p></div>
      {mode === "LIVE" && <div className={s.authority}>{replayError ? <p role="alert">REPLAY UNAVAILABLE: {replayError}. No demo or feed stages substituted.</p> :
        !liveReplay ? <p role="status">LOADING SEPARATELY CHECKPOINTED LIVE REPLAY…</p> :
          <><small>REPLAY BLOCK {liveReplay.asOfBlock} · <CoverageStamp state={liveReplay.historyCoverage}/></small>
            <div className={s.proof}><code>{liveReplay.receipt.receiptId}</code><CopyButton label="Replay receipt" value={liveReplay.receipt.receiptId}/></div>
            <p>Structural validation only. Backend remains cryptographic authority.</p></>}</div>}</section>
    <section className={s.next}><small>03 / FOLLOW THE TRAIL</small><h2>One address. More bags?</h2>
      <p>Reported address equality is not proof of human identity or common control.</p>
      <AppLink href={"/creator/" + bag.reportedCreatorAddress} navigate={navigate} className={s.primary}>OPEN CREATOR HISTORY ↗</AppLink></section>
  </div>;
}
export function MobileSaved({ feed, radar, mode, bookmarks, navigate }: { feed: PublicFeed | null; radar: RadarWatchlist | null; mode: DataMode; bookmarks: Bookmarks; navigate: Go }) {
  const items=bookmarks.saved.filter(x=>x.mode===mode);
  return <div className={s.screen}><Lead eyebrow="03 / LOCAL CASEBOOK" title="Saved" sub="Bookmarks on this device. Saving never starts a Telegram Watch subscription."/>
    <p className={s.savedNote}>{bookmarks.persistent ? "LOCAL / NO SERVER SYNC" : "STORAGE UNAVAILABLE / SESSION ONLY"}</p>
    {items.length ? items.map(item => {
      const bag=item.kind==="bag"?feed?.bags.find(x=>x.id===item.id):undefined;
      const recipient=item.kind==="radar"?radar?.candidates.find(x=>x.observedRecipientAddress.toLowerCase()===item.id.toLowerCase()):undefined;
      return <article className={s.savedCard} key={item.kind+item.id}><small>{item.kind==="bag"?"SAVED BAG":"SAVED RADAR RECIPIENT"}</small>
        {bag||recipient?<AppLink href={item.kind==="bag"?"/bag/"+item.id:"/radar/address/"+item.id} navigate={navigate} className={s.savedLink}>
          {bag?"$"+bag.symbol:short(recipient!.observedRecipientAddress)} ↗</AppLink>:<p>Not present at this checkpoint. Nothing substituted.</p>}
        <button type="button" onClick={()=>bookmarks.toggle(item)}>REMOVE ×</button></article>;
    }) : <div className={s.empty}><strong>YOUR CASEBOOK IS EMPTY.</strong><p>Save a Bag or Radar address to revisit it here.</p>
      <AppLink href="/" navigate={navigate} className={s.primary}>FIND A FILE ↗</AppLink></div>}
  </div>;
}
export function MobileMore({ mode, navigate }: { mode: DataMode; navigate: Go }) {
  const links=[["RAT WATCH","Creator-only Telegram watches","/watch"],["REPLAY FILES","Frozen observation histories","/replay"],
    ["DUMPSTER LEDGER","Funding disclosure and authority","/ledger"],["$BINRAT STATUS","Current token state","/binrat"],
    ["THE METHOD","Evidence and ranking rules","/method"]];
  return <div className={s.screen}><Lead eyebrow="04 / FIELD MANUAL" title="More" sub="Methods, transparency and other product instruments."/>
    <div className={s.moreList}>{links.map(([title,description,path],i)=>
      <AppLink key={path} href={path} navigate={navigate} className={s.moreRow}><b>0{i+1}</b><span><strong>{title}</strong><small>{description}</small></span><em>↗</em></AppLink>)}</div>
    <div className={s.moreMascot}><img src={import.meta.env.BASE_URL+"binrat-hero.webp"} alt="" loading="lazy"/><div><strong>THE RAT REMEMBERS.</strong>
      <p>DEGEN DECIDES ATTENTION.<br/>RECEIPTS DECIDE TRUTH.</p><small>{mode==="DEMO"?"DETERMINISTIC DEMO":"PUBLIC LIVE"}</small></div></div>
  </div>;
}
