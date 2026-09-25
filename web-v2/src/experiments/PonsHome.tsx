import {useEffect,useMemo,useState} from "react";
import {AppLink} from "../Primitives";
import {safeTokenPortrait} from "./LaunchPortraitWall";
import {loadPonsPreview,compactAddress,ponsTokenUrl,ponsTxUrl,
 type PonsPreviewSnapshot,type PonsPreviewLaunch} from "../ponsPreview";
import s from "./BentoHome.module.css";
import w from "./LaunchPortraitWall.module.css";
import p from "./PonsHome.module.css";

type Props={navigate:(path:string)=>void; selectedId?:string};
const symbol=(item:PonsPreviewLaunch)=>item.metadata.symbol??compactAddress(item.token);
const title=(item:PonsPreviewLaunch)=>item.metadata.name??"Name unavailable from verified launch calldata";
function safeSocial(raw:string|null){
  if(!raw||raw.length>350)return null;
  try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}
  catch{return null;}
}
function ScanResult({item,snapshot,navigate}: {item:PonsPreviewLaunch;snapshot:PonsPreviewSnapshot;navigate:Props["navigate"]}){
  const older=snapshot.launches.filter(other=>other.id!==item.id&&other.deployer===item.deployer&&
    (BigInt(other.blockNumber)<BigInt(item.blockNumber) ||
    (other.blockNumber===item.blockNumber&&other.logIndex<item.logIndex)));
  const bound=BigInt(snapshot.scannedFromBlock);
  return <section className={p.scanResult} data-testid="pons-scan-result" aria-live="polite">
    <div className={p.scanStamp}><span>THE RAT SCANNED THIS SNAPSHOT</span><span>4663 / CONFIRMED FACTORY LOGS</span></div>
    <h3>{older.length?"FAMILIAR DEPLOYER ADDRESS.":"NO EARLIER MATCH IN THIS WINDOW."}</h3>
    <p>{older.length?
      "The exact deployer address occurs in "+older.length+" older launch"+
      (older.length===1?"":"es")+" inside this bounded Pons factory snapshot.":
      "No older launch from this exact deployer appears inside the retrieved recent window. Earlier or unrelated-wallet history remains unknown."}</p>
    {older.length>0&&<div className={p.matchGrid} data-testid="pons-creator-matches">
      {older.slice(0,5).map(x=><AppLink href={"/pons/"+x.id} navigate={navigate} key={x.id}
        className={p.match} ariaLabel={"Inspect recorded related launch "+symbol(x)}>
        <strong>{symbol(x)}</strong><small>BLOCK {x.blockNumber}</small>
      </AppLink>)}
    </div>}
    <div className={p.coverage}>
      <b>HISTORY LIMIT</b> Only blocks {snapshot.scannedFromBlock}–{snapshot.asOfBlock}.
      Funding transfers, beneficial ownership, early recipients and token profitability were NOT examined.
      A new wallet or common exchange funding cannot be classified from this snapshot.
      Source metadata is user-provided text in verified transaction calldata, not token legitimacy proof.
    </div>
    <div className={p.receipts}>
      <a href={ponsTxUrl(item.txHash)} target="_blank" rel="noreferrer noopener">LAUNCH TRANSACTION ↗</a>
      <a href={ponsTokenUrl(item.token)} target="_blank" rel="noreferrer noopener">TOKEN ON BLOCKSCOUT ↗</a>
      <span>AS OF BLOCK {snapshot.asOfBlock} · MINIMUM {snapshot.confirmationDepth} CONFIRMATIONS</span>
    </div>
    <div className={p.pending}>FUNDING GRAPH HIDDEN: NO VERIFIED FUNDING-PROVENANCE RECEIPTS.
      The widget will appear only after a separate, complete and supported funding trace identifies a concrete link.</div>
  </section>;
}
function Portraits({snapshot,navigate}: {snapshot:PonsPreviewSnapshot;navigate:Props["navigate"]}){
  const [page,setPage]=useState(0),[paused,setPaused]=useState(false);
  const [failed,setFailed]=useState<Set<string>>(new Set());
  const count=Math.ceil(snapshot.launches.length/24);
  useEffect(()=>{setPage(0);setFailed(new Set());},[snapshot.asOfBlockHash]);
  useEffect(()=>{
    if(paused||count<=1||document.visibilityState!=="visible")return;
    const timer=window.setInterval(()=>setPage(n=>(n+1)%count),24_000);
    return()=>window.clearInterval(timer);
  },[count,paused]);
  const shown=snapshot.launches.slice(page*24,(page+1)*24);
  const nCols=Math.min(4,Math.max(1,shown.length));
  const cols=Array.from({length:nCols},(_,i)=>shown.filter((_,j)=>j%nCols===i));
  return <section className={w.section} data-testid="pons-portrait-wall" data-visible-tiles={shown.length}>
    <div className={w.heading}><div><span className={w.kicker}>THE DUMPSTER WINDOW / PONS V2 / ROBINHOOD 4663</span>
      <h2>THE NEWEST IN THE BIN.</h2>
      <p>Confirmed recent factory launches. Source logos appear only when recovered from matching direct-factory calldata.</p>
      </div><div className={w.counter}><strong>{snapshot.launches.length}</strong>
        <span>IN THIS SNAPSHOT<br/>SHOWING {shown.length} · BLOCK {snapshot.asOfBlock}</span></div></div>
    <div className={w.wall} data-testid="pons-wall-viewport"
      onPointerEnter={()=>setPaused(true)} onPointerLeave={()=>setPaused(false)}
      onFocusCapture={()=>setPaused(true)}
      onBlurCapture={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setPaused(false);}}>
      {!shown.length?<div className={w.empty}>NO PONS V2 LAUNCHES IN THIS CAPTURED WINDOW.</div>:
      <div className={w.columns} style={{gridTemplateColumns:"repeat("+nCols+",minmax(0,1fr))"}}>
        {cols.map((col,i)=><div key={i} className={w.column} style={{animationDelay:"-"+i*2+"s"}}>
          {col.map(item=>{
            const image=item.metadata.status==="DIRECT_FACTORY_INPUT"?
              safeTokenPortrait(item.metadata.logo??undefined):null;
            return <AppLink key={item.id} href={"/pons/"+item.id} navigate={navigate}
              className={w.tile} ariaLabel={"Inspect Pons launch "+symbol(item)+" at block "+item.blockNumber}>
              {image&&!failed.has(item.id)?<img src={image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer"
                onError={()=>setFailed(old=>new Set([...old,item.id]))}/>:
                <span className={w.noImage} aria-hidden="true"><b>{symbol(item).slice(0,4)}</b>
                  <small>NO VERIFIED LOGO</small></span>}
              <span className={w.tileCaption}><b>{symbol(item).slice(0,16)}</b><small>#{item.blockNumber}</small></span>
            </AppLink>;
          })}
        </div>)}
      </div>}
      <div className={w.pixelBackground} aria-hidden="true"/>
    </div>
    <footer className={w.footer}><span>RECENT WINDOW ONLY · {snapshot.generatedAt.slice(0,19).replace("T"," ")} UTC · NOT A CONTINUOUS LIVE FEED</span>
      <div className={p.pager}>
        <button type="button" onClick={()=>setPage(n=>Math.max(0,n-1))} disabled={page===0}>← PREV</button>
        <span>{page+1}/{Math.max(1,count)}</span>
        <button type="button" onClick={()=>setPage(n=>Math.min(count-1,n+1))} disabled={page>=count-1}>NEXT →</button>
      </div></footer>
  </section>;
}
export default function PonsHome({navigate,selectedId}:Props){
  const [snapshot,setSnapshot]=useState<PonsPreviewSnapshot|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const [scanned,setScanned]=useState<string|null>(null),[query,setQuery]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    loadPonsPreview(controller.signal).then(value=>{
      if(controller.signal.aborted)return;setSnapshot(value);setError(null);setLoading(false);
    }).catch(e=>{if(controller.signal.aborted)return;
      setSnapshot(null);setError(e instanceof Error?e.message:"PONS_SNAPSHOT_UNAVAILABLE");setLoading(false);});
    return()=>controller.abort();
  },[]);
  useEffect(()=>{setScanned(null);},[selectedId]);
  const selected=selectedId?snapshot?.launches.find(x=>x.id===selectedId):null;
  const matches=useMemo(()=>{
    const normalized=query.toLowerCase().trim();
    if(!normalized||!snapshot)return snapshot?.launches??[];
    return snapshot.launches.filter(item=>[item.token,item.deployer,item.metadata.name,item.metadata.symbol]
      .some(field=>field?.toLowerCase().includes(normalized)));
  },[query,snapshot]);
  const stale=snapshot?Date.now()-Date.parse(snapshot.generatedAt)>60*60*1000:true;
  return <div className={s.home} data-testid="pons-home" data-source-mode="PONS_SNAPSHOT">
    <header className={s.masthead}>
      <AppLink href="/" navigate={navigate} className={s.logo}>BINRAT <small>↗ THE RAT REMEMBERS</small></AppLink>
      <nav aria-label="Pons investigation navigation">
        <AppLink href="/" navigate={navigate}>PONS LAUNCHES</AppLink>
        <a href="https://robinhoodchain.blockscout.com/" target="_blank" rel="noreferrer noopener">BLOCKSCOUT ↗</a>
      </nav>
      <a className={s.sourceSwitch} href={window.location.pathname+"?experiment=bento-v1#/"}>BACK TO DEMO ↗</a>
    </header>
    <div className={s.canvas}>
      <div className={s.hero}>
        <section className={s.intro} aria-labelledby="pons-hero-title">
          <span className={s.eyebrow}>PONS V2 / ROBINHOOD CHAIN / 4663</span>
          <h1 id="pons-hero-title">SNIFF<br/><em>THE BAG.</em></h1>
          <p>Pick a confirmed Pons launch, inspect its source-reported deployer and search for earlier
            appearances inside the captured window. Funding provenance is a separate, unfinished investigation.</p>
          <div className={s.actions}>
            {snapshot?.launches[0]?
              <AppLink className={s.primary} href={"/pons/"+snapshot.launches[0].id} navigate={navigate}>
                SNIFF THE NEWEST LAUNCH ↗</AppLink>:null}
            <a className={s.secondary} href="https://docs.ponsfamily.com/v2" target="_blank" rel="noreferrer noopener">
              PONS SOURCE DOCS ↗</a>
          </div>
          <small className={s.disclosure}>CONFIRMED SOURCE SNAPSHOT · NO BUY/SELL CALL · NO CLEAN-WALLET VERDICT · NO FUNDING CLAIMS</small>
          <div className={s.ratWindow} aria-hidden="true">
            <img src={import.meta.env.BASE_URL+"binrat-hero.webp"} alt="" decoding="async"/>
          </div>
        </section>
        <section className={s.macro+" "+p.terminal} aria-label="Pons snapshot terminal">
          <div className={s.hardware}><span>FIELD UNIT / 4663 · READ ONLY</span><span>FACTORY AUTHORITY / PINNED</span></div>
          <div className={s.screen}>
            <div className={s.macroHead}><div><small>RECEIPT-BOUND SOURCE SNAPSHOT</small>
              <h2>THE PONS TERMINAL</h2></div>
              <span data-testid="pons-snapshot-state" className={snapshot&&!stale?s.good:s.caution}>
                {loading?"CHECKING":error?"UNAVAILABLE":stale?"STALE SNAPSHOT":"CONFIRMED SNAPSHOT"}
              </span></div>
            <div className={s.metrics}>
              <div><small>CAPTURED LAUNCHES</small><strong data-testid="pons-launch-count">{snapshot?snapshot.launches.length:"—"}</strong>
                <span>UP TO 500 · IN A BOUNDED RECENT WINDOW</span></div>
              <div><small>CHECKPOINT BLOCK</small><strong>{snapshot?.asOfBlock??"—"}</strong>
                <span>{snapshot?"MINIMUM 12 CONFIRMATIONS":"NO VALIDATED CHECKPOINT"}</span></div>
            </div>
            <div className={s.feeds}>
              <div><small>RECOVERED SOURCE METADATA</small>
                <strong>{snapshot?snapshot.launches.filter(x=>x.metadata.status==="DIRECT_FACTORY_INPUT").length:"—"}</strong>
                <span>DIRECT FACTORY CALLDATA ONLY</span></div>
              <div><small>FUNDING TRACE</small><strong>—</strong><span>NOT CONNECTED / NO ALLEGATIONS</span></div>
            </div>
            <div className={s.screenFoot} role="status"><span>{error??(snapshot?
              "CAPTURED "+new Date(snapshot.generatedAt).toLocaleString():"FETCHING SOURCE SNAPSHOT…")}</span>
              <span>{snapshot?"FROM BLOCK "+snapshot.scannedFromBlock:"FAIL CLOSED"}</span></div>
          </div>
          <div className={s.hardwareFoot}>STATIC REVIEW SNAPSHOT · NOT REAL-TIME DETECTION · NO D1 WRITE</div>
        </section>
      </div>
      {snapshot?<Portraits snapshot={snapshot} navigate={navigate}/>:
      <section role={loading?"status":"alert"} className={p.unavailable} data-testid="pons-snapshot-unavailable">
        {loading?"FETCHING THE PONS FACTORY SNAPSHOT…":"PONS SOURCE UNAVAILABLE: "+(error??"NOT PUBLISHED")+
          ". NO ARC OR DEMO LAUNCHES WERE SUBSTITUTED."}</section>}
      {snapshot&&<section className={p.workbench} aria-label="Pons investigation workbench">
        <div className={p.workbenchHead}><div><small>THE RAT SCAN / ACTUAL CONFIRMED LOGS</small>
          <h2>{selectedId?"OPEN CASE":"PICK YOUR GARBAGE."}</h2>
          <p>Click a token portrait or search the captured launches. Each scan has an explicit historical coverage limit.</p>
        </div><span>{snapshot.launches.length} CAPTURED / {snapshot.historyCoverage}</span></div>
        {selectedId&&!selected?<div role="alert" className={p.unavailable}>
          NO MATCHING PONS LAUNCH IN THIS EXACT SNAPSHOT. NOTHING WAS SUBSTITUTED.
          <AppLink href="/" navigate={navigate}>BACK TO THE DUMPSTER ↗</AppLink></div>:null}
        {selected&&<article className={p.case} data-testid="pons-case">
          <div className={p.caseTop}><div>
            <small>CONFIRMED FACTORY LAUNCH / BLOCK {selected.blockNumber}</small>
            <h3>{title(selected)} <em>{selected.metadata.symbol??"SYMBOL UNKNOWN"}</em></h3>
            <p>DEPLOYER: <code>{selected.deployer}</code></p>
            <p>TOKEN: <code>{selected.token}</code></p>
            <p>PAIR: {selected.pairToken==="0x0000000000000000000000000000000000000000"?
                "NATIVE ETH":compactAddress(selected.pairToken)}</p>
          </div><div className={p.caseLinks}>
            <a href={ponsTxUrl(selected.txHash)} target="_blank" rel="noreferrer noopener">VERIFY LAUNCH ↗</a>
            {safeSocial(selected.metadata.website)&&
              <a href={safeSocial(selected.metadata.website)!} target="_blank" rel="noreferrer noopener">SOURCE-REPORTED SITE ↗</a>}
          </div></div>
          <button className={p.scanButton} type="button" onClick={()=>setScanned(selected.id)}
            data-testid="pons-scan-button">⌁ {scanned===selected.id?"SCAN AGAIN":"LET THE RAT SNIFF"} ↗</button>
          <p className={p.scanHint}>The ritual examines this exact captured source dataset—no artificial waiting and no invented funding analysis.</p>
          {scanned===selected.id&&<ScanResult item={selected} snapshot={snapshot} navigate={navigate}/>}
        </article>}
        <div className={p.searchPane}><label htmlFor="pons-case-search">SEARCH CAPTURED TOKEN OR DEPLOYER</label>
          <input id="pons-case-search" value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="SYMBOL / NAME / 0x ADDRESS" autoComplete="off" maxLength={120}/>
          <span>{matches.length} OF {snapshot.launches.length} MATCH</span></div>
        <div className={p.records}>
          {matches.slice(0,80).map(item=><AppLink className={p.record} key={item.id}
            href={"/pons/"+item.id} navigate={navigate}>
            <b>{symbol(item)}</b><span>{compactAddress(item.token)}</span>
            <small>{item.previousFromSameDeployerWithinWindow>0?
              item.previousFromSameDeployerWithinWindow+" PRIOR SAME-DEPLOYER LAUNCHES IN WINDOW":
              "NO MATCH OBSERVED IN WINDOW"}</small><span>#{item.blockNumber} ↗</span>
          </AppLink>)}
        </div>
        {matches.length>80&&<p className={p.scanHint}>Showing the first 80 matches. Narrow your search to inspect older captures.</p>}
      </section>}
      <footer className={s.footer}>BINRAT · PONS V2 / 4663 · READ-ONLY SOURCE SNAPSHOT
        <a href="https://docs.ponsfamily.com/v2" target="_blank" rel="noreferrer noopener">PROTOCOL SOURCE ↗</a></footer>
    </div>
  </div>;
}
