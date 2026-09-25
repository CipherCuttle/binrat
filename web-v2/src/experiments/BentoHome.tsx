import { useEffect, useState } from "react";
import { AppLink } from "../Primitives";
import { sourceSwitchHref, publicApiUrl } from "../previewRuntime";
import { readPublicHealth, type PublicHealth } from "../publicHealth";
import type { DataMode } from "../data";
import type { PublicFeed, RadarWatchlist } from "../types";
import LaunchPortraitWall from "./LaunchPortraitWall";
import s from "./BentoHome.module.css";

type Props = {
  feed: PublicFeed | null;
  radar: RadarWatchlist | null;
  feedError: string | null;
  radarError: string | null;
  loaded: boolean;
  readAtMs: number | null;
  mode: DataMode;
  navigate: (path: string) => void;
};
type HealthState = { value: PublicHealth | null; error: string | null; checked: boolean };
const initialHealth: HealthState = { value:null, error:null, checked:false };
const fmt = (value:number) => new Intl.NumberFormat("en-US").format(value);
const shortAddress = (a:string) => a.slice(0,8) + "…" + a.slice(-6);

function usePublicHealth(mode:DataMode):HealthState {
  const [state,setState] = useState<HealthState>(initialHealth);
  useEffect(() => {
    if (mode !== "LIVE") { setState(initialHealth); return; }
    let active = true;
    let pending:AbortController|null = null;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      pending?.abort();
      const req = new AbortController();
      pending = req;
      try {
        const value = await readPublicHealth(req.signal);
        if (active && !req.signal.aborted) setState({value,error:null,checked:true});
      } catch(err) {
        if (active && !req.signal.aborted)
          setState({value:null,error:err instanceof Error?err.message:"PUBLIC_HEALTH_UNAVAILABLE",checked:true});
      }
    };
    void refresh();
    const timer = window.setInterval(() => {void refresh();},60_000);
    const visible = () => { if(document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange",visible);
    return () => {active=false;pending?.abort();window.clearInterval(timer);
      document.removeEventListener("visibilitychange",visible);};
  },[mode]);
  return state;
}

function MacroTerminal({feed,radar,feedError,radarError,loaded,readAtMs,mode}: Omit<Props,"navigate">) {
  const health=usePublicHealth(mode);
  const oldRuntime=health.value?.runtimeUpdatedAtMs === null ? true :
    health.value?.runtimeUpdatedAtMs !== undefined &&
    Date.now()-health.value.runtimeUpdatedAtMs > 180_000;
  const ready=mode==="LIVE" && !!health.value?.ok && !!health.value.indexReady &&
    !!health.value.runtimeFresh && !oldRuntime && health.value.lastSyncError===null;
  const status=mode==="DEMO"?"DEMO FIXTURE":!health.checked?"CHECKING":
    health.error?"UNAVAILABLE":!health.value?.runtimeFresh || oldRuntime?"STALE":ready?"READY":"NOT READY";
  const checkpoints=[health.value?.checkpointBlock,feed?.asOfBlock,radar?.asOfBlock]
    .filter((v):v is string=>!!v);
  const mismatch=mode==="LIVE" && new Set(checkpoints).size>1;
  return <section className={s.macro} aria-labelledby="bento-macro-title">
    <div className={s.hardware}><span>FIELD UNIT / 001 · SALVAGED TELEMETRY</span>
      <span>ARC / 5042 <i aria-hidden="true">●</i></span></div>
    <div className={s.screen}>
      <div className={s.macroHead}><div><small>01 / PUBLIC READ PLANE</small>
          <h2 id="bento-macro-title">THE MACRO TERMINAL</h2></div>
        <span data-testid="bento-health-state" className={ready?s.good:s.caution}>{status}</span></div>
      <div className={s.metrics}>
        <div><small>INDEXED LAUNCHES / HEALTH</small><strong data-testid="bento-launch-count">
          {ready && health.value ? fmt(health.value.launchCount) : "—"}</strong>
          <span>{mode==="DEMO"?"LIVE TOTAL NOT AVAILABLE IN DEMO":
            !health.checked?"AWAITING PUBLIC HEALTH":health.value?.lastSyncError ??
            (health.error??(ready?"HEALTH-VALIDATED TOTAL":"NOT VERIFIED READY"))}</span></div>
        <div><small>HEALTH CHECKPOINT</small><strong>
          {mode==="LIVE" && health.value?.checkpointBlock?health.value.checkpointBlock:"—"}</strong>
          <span>{health.value?.runtimeUpdatedAtMs?
            "SOURCE RUNTIME " + new Date(health.value.runtimeUpdatedAtMs).toLocaleTimeString():
            "NO VERIFIED RUNTIME TIMESTAMP"}</span></div>
      </div>
      <div className={s.feeds}>
        <div><small>02 / INDEPENDENT FEED</small><strong>
            {feed?fmt(feed.bags.length):"—"} <em>RECORDS RETURNED</em></strong>
          <span>{feed?"AS-OF BLOCK "+feed.asOfBlock+" / "+feed.historyCoverage:
            !loaded?"CHECKING":feedError??"UNAVAILABLE"}</span></div>
        <div><small>03 / RADAR</small><strong>
            {radar?fmt(radar.coverage.distinctRecipientAddressCount):"—"} <em>RECIPIENTS</em></strong>
          <span>{radar?"AS-OF BLOCK "+radar.asOfBlock+" / "+radar.coverage.historyCoverage:
            !loaded?"CHECKING":radarError??"UNAVAILABLE"}</span></div>
      </div>
      <div className={s.screenFoot} role="status">
        <span>{mismatch?"DIFFERENT SOURCE CHECKPOINTS / NOT SYNCHRONIZED":
          mode==="DEMO"?"SYNTHETIC DATA / NO LIVE VALIDATION":
          "HEALTH, FEED AND RADAR VALIDATED INDEPENDENTLY"}</span>
        <span>{mode==="LIVE"&&readAtMs?"LOCAL FEED CHECK "+new Date(readAtMs).toLocaleTimeString():"NO BUY / SELL CALLS"}</span>
      </div>
    </div>
    <div className={s.hardwareFoot}><span>UNVERIFIED HISTORY IS NOT A COMPLETE CHAIN AUDIT</span><span>BR / PUBLIC</span></div>
  </section>;
}
function RadarBento({radar,radarError,loaded,mode,navigate}:Pick<Props,"radar"|"radarError"|"loaded"|"mode"|"navigate">) {
  const [repeatOnly,setRepeatOnly]=useState(false);
  const rows=radar?.candidates.filter(x=>!repeatOnly||x.distinctLaunchCount>=2)??[];
  return <section className={s.radar} aria-labelledby="bento-radar-title">
    <div className={s.panelHead}><div><small>02 / INVESTIGATION WORKBENCH</small>
      <h2 id="bento-radar-title">RAT RADAR <span>↗</span></h2>
      <p>Observed recipient recurrence across indexed launches. An address is not a verified human identity.</p></div>
      <AppLink className={s.smallLink} href="/radar" navigate={navigate}>FULL RADAR ↗</AppLink>
    </div>
    <div className={s.filterRow}><span>{mode==="DEMO"?"SYNTHETIC DEMO / ":"PUBLIC WATCHLIST / "}
      {radar?radar.coverage.status+" · "+radar.coverage.historyCoverage:
        !loaded?"CHECKING":"UNAVAILABLE"}</span>
      <button type="button" onClick={()=>setRepeatOnly(x=>!x)} aria-pressed={repeatOnly}>
        {repeatOnly?"SHOW ALL":"REPEAT RECIPIENTS 2+"} ↗</button></div>
    {!radar?<p className={s.empty} role={loaded?"alert":"status"}>
      {!loaded?"CHECKING THE WATCHLIST…":"RADAR UNAVAILABLE / "+(radarError??"NO VALIDATED RESPONSE")}</p>:
      rows.length?<div className={s.radarRows}>{rows.map(x=>
        <div key={x.observedRecipientAddress} className={s.radarRow}>
          <AppLink href={"/radar/address/"+x.observedRecipientAddress} navigate={navigate}
            className={s.address} ariaLabel={"Inspect observed recipient "+x.observedRecipientAddress}>
            <b>#{x.rank}</b><span><strong>{shortAddress(x.observedRecipientAddress)}</strong>
              <small>{x.distinctLaunchCount} DISTINCT LAUNCHES · {x.acquisitionReceiptCount} ACQUISITION RECEIPTS</small></span>
            <span aria-hidden="true">↗</span>
          </AppLink>
          <div className={s.evidence}><span>{x.evidenceActivityIds.length} LINKED ACTIVITY IDS</span>
            {mode==="LIVE"&&x.evidenceActivityIds[0]?
              <a href={publicApiUrl("/api/rat-radar/activity/"+x.evidenceActivityIds[0])}
                rel="noopener noreferrer" target="_blank">RAW PUBLIC RECEIPT ↗</a>:null}</div>
        </div>
      )}</div>:<p className={s.empty}>NO OBSERVED RECIPIENTS MATCH THIS FILTER AT THE CURRENT CHECKPOINT.</p>}
    <footer className={s.radarFoot}>AS-OF {radar?.asOfBlock??"—"} · {radar?.receipt.receiptId??"NO RECEIPT"} · UP TO 5 RANKED OBSERVED ADDRESSES</footer>
  </section>;
}
const paths: Array<[string,string,string,string]> = [
  ["03","DUMPSTER","Recent indexed launches","/dumpster"],
  ["04","REPLAY LAB","Inspect available evidence horizons","/replay"],
  ["05","LEDGER","Prelaunch · financial disclosure","/ledger"],
  ["06","CREATOR FILES","Discover source-reported creator addresses","/dumpster"],
  ["07","WATCH","Telegram confirmation boundary","/watch"],
];
export default function BentoHome(props:Props) {
  const {mode,navigate}=props;
  return <div className={s.home} data-testid="binrat-bento-home" data-source-mode={mode}>
    <header className={s.masthead}>
      <AppLink href="/" navigate={navigate} className={s.logo}>BINRAT <small>↗ THE RAT REMEMBERS</small></AppLink>
      <nav aria-label="BINRAT desktop navigation">
        {(["DUMPSTER","RADAR","REPLAY","LEDGER","WATCH"] as const).map((title,i)=>
          <AppLink key={title} href={["/dumpster","/radar","/replay","/ledger","/watch"][i]!}
            navigate={navigate}>{title}</AppLink>)}
      </nav>
      <a className={s.sourceSwitch} href={window.location.pathname+"?experiment=bento-v1&source=pons#/"}>PONS SNAPSHOT ↗</a>
      <a className={s.sourceSwitch} href={sourceSwitchHref(mode==="DEMO")}>
        {mode==="DEMO"?"DEMO · SWITCH TO LIVE":"PUBLIC SOURCE · SWITCH TO DEMO"} ↗</a>
    </header>
    <div className={s.canvas}>
      <div className={s.hero}>
        <section className={s.intro} aria-labelledby="bento-title">
          <span className={s.eyebrow}>OPEN-SOURCE LAUNCH INTELLIGENCE / ARC 5042</span>
          <h1 id="bento-title">THE RAT<br/><em>REMEMBERS.</em></h1>
          <p>Investigate public launches, recurring addresses and the receipts behind them. No anonymous wallet is automatically a known trader.</p>
          <div className={s.actions}>
            <AppLink className={s.primary} href="/radar" navigate={navigate}>EXPLORE RAT RADAR <span>↗</span></AppLink>
            <AppLink className={s.secondary} href="/dumpster" navigate={navigate}>ENTER THE DUMPSTER ↗</AppLink>
          </div>
          <small className={s.disclosure}>{mode==="DEMO"?"SYNTHETIC DEMO / ALL FIGURES ILLUSTRATIVE":
            "READ-ONLY PUBLIC DATA / INDEPENDENT CHECKPOINTS"} · NO SAFETY SCORE · NO BUY CALL</small>
          <div className={s.ratWindow} aria-hidden="true"><img src={import.meta.env.BASE_URL + "binrat-hero.webp"} alt="" decoding="async"/></div>
        </section>
        <MacroTerminal feed={props.feed} radar={props.radar} feedError={props.feedError}
          radarError={props.radarError} loaded={props.loaded} mode={mode} readAtMs={props.readAtMs}/>
      </div>
      <LaunchPortraitWall feed={props.feed} error={props.feedError} loaded={props.loaded}
        mode={mode} navigate={navigate}/>
      <div className={s.bentoGrid}>
        <RadarBento radar={props.radar} radarError={props.radarError} loaded={props.loaded}
          mode={mode} navigate={navigate}/>
        <div className={s.other} aria-label="BINRAT investigation destinations">
          {paths.map(([index,label,desc,path])=>
            <AppLink key={label} className={s.module} href={path} navigate={navigate}>
              <small>{index} / FUNCTIONAL ROUTE</small><strong>{label}<i aria-hidden="true">↗</i></strong>
              <span>{desc}</span></AppLink>)}
        </div>
      </div>
      <footer className={s.footer}>BINRAT / LAUNCH EVIDENCE · IMAGE ≠ ENDORSEMENT · RECURRENCE ≠ PROFIT
        <AppLink href="/method" navigate={navigate}>SOURCE METHOD & COVERAGE ↗</AppLink></footer>
    </div>
  </div>;
}
