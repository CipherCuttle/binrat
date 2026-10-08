import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import alleyDesktop from "../public/visual-lab/scene/alley-bg-desktop.webp";
import alleyMobile from "../public/visual-lab/scene/alley-bg-mobile.webp";
import ratDesktop from "../public/visual-lab/foreground/ratzero-dumpster-desktop.webp";
import ratMobile from "../public/visual-lab/foreground/ratzero-dumpster-mobile.webp";
import foregroundTrash from "../public/visual-lab/foreground/foreground-trash.webp";
import caseScene from "../public/visual-lab/case-scenes/case-neon-alley.webp";
import { labCases, labProvenance, type LabCase, type LabReceipt } from "./visual-lab-fixtures";
import "./visual-lab.css";

type Material = "glass" | "refract" | "pearl";
const steps = ["WHAT", "TRAIL", "RECEIPTS", "NEXT"] as const;
type Step = typeof steps[number];
const stepHints = ["The signal", "The connections", "The evidence", "Your next move"];

function Icon({ kind }: { kind: "folder" | "scan" | "arrow" | "receipt" | "shield" }) {
  const paths = {
    folder: "M3 7V4h6l2 3h10v13H3V7Zm0 0h8",
    scan: "M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M6 12h12m-6-6v12",
    arrow: "M4 12h15m-6-6 6 6-6 6",
    receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6",
    shield: "m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Zm-4 9 3 3 5-6",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}

// Three optical primitives: a layered hero, a quiet evidence inset, a crisp control.
function EvidenceSurface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`vl-evidence-surface ${className}`}>{children}</div>;
}

function AlleyWorld() {
  return <div className="vl-world" aria-hidden="true">
    <picture className="vl-alley">
      <source media="(max-width:700px)" srcSet={alleyMobile} />
      <img src={alleyDesktop} alt="" width={1672} height={941} decoding="async" fetchPriority="high" />
    </picture>
    <picture className="vl-world-trash">
      {/* Avoid downloading the desktop-only trash layer on mobile. */}
      <source media="(max-width:700px)" srcSet="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
      <img src={foregroundTrash} alt="" width={1600} height={533} decoding="async" />
    </picture>
    <div className="vl-world-shade" />
    <picture className="vl-rat-scene">
      <source media="(max-width:700px)" srcSet={ratMobile} />
      <img src={ratDesktop} alt="" width={720} height={900} decoding="async" />
    </picture>
  </div>;
}

function Crew() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const crew = [
    { image: "/crew/rat-avatar-48.png", name: "RAT ZERO", role: "SCOUT", status: "LIVE" },
    { image: "/crew/tripwire.png", name: "TRIPWIRE", role: "WATCHER", status: "BUILDING" },
    { image: "/crew/sniffer.png", name: "SNIFFER", role: "TRAIL HUNTER", status: "PROVING" },
  ];
  return <div className="vl-crew-utility" onKeyDown={(event) => {
    if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
  }}>
    <button ref={toggle} className="vl-utility vl-crew-toggle" aria-expanded={open} aria-controls="vl-crew" onClick={() => setOpen(!open)}>
      <img src="/crew/rat-avatar-48.png" width={32} height={32} alt="" />
      <span>CREW</span><span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <section id="vl-crew" className="vl-crew-popover" aria-label="Crew status">
      <div className="vl-section-title">THE CREW <span>PRODUCT STATUS</span></div>
      {crew.map((rat) => <div className="vl-crew-member" key={rat.name}>
        <img src={rat.image} width={44} height={44} alt="" />
        <div><strong>{rat.name}</strong><span>{rat.role}</span></div>
        <b className={rat.status.toLowerCase()}>{rat.status}</b>
      </div>)}
      <p>Watch is not Tripwire. Persistent Tripwire jobs and Working Rat are not live.</p>
    </section>}
  </div>;
}

function Receipt({ receipt, active }: { receipt: LabReceipt; active: LabCase }) {
  return <details className="vl-receipt">
    <summary><Icon kind="receipt" /><span><strong>{receipt.label}</strong><small>{receipt.id}</small></span><b>SYNTHETIC</b><span className="vl-expand" aria-hidden="true">+</span></summary>
    <div className="vl-receipt-body">
      <dl><div><dt>Source</dt><dd>{labProvenance.source}</dd></div><div><dt>Record</dt><dd>{receipt.id} · {receipt.source}</dd></div><div><dt>Boundary</dt><dd>{labProvenance.boundary}</dd></div></dl>
      <pre tabIndex={0} aria-label={`${receipt.id} fixture JSON`}>{JSON.stringify({ synthetic: true, case: active.symbol, receiptId: receipt.id, source: receipt.source, ...receipt.record }, null, 2)}</pre>
    </div>
  </details>;
}

export function VisualLab() {
  const [material, setMaterial] = useState<Material>("pearl");
  const [activeFind, setActiveFind] = useState(0);
  const [step, setStep] = useState<Step>("WHAT");
  const [watchGate, setWatchGate] = useState(false);
  const [receiptFocus, setReceiptFocus] = useState<string | null>(null);
  const caseRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const active = labCases[activeFind]!;
  const debug = new URLSearchParams(window.location.search).get("visualDebug") === "1";
  const stepIndex = steps.indexOf(step);

  function goStep(next: Step, focus = false) {
    setStep(next);
    if (next !== "RECEIPTS") setReceiptFocus(null);
    if (focus) tabRefs.current[steps.indexOf(next)]?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      const tab = tabRefs.current[steps.indexOf(next)];
      if (window.matchMedia("(max-width:1000px)").matches) tab?.closest("[role=tablist]")?.scrollIntoView({ block: "start" });
    });
  }
  function openCase(index: number) {
    setActiveFind(index); setStep("WHAT"); setWatchGate(false); setReceiptFocus(null);
    caseRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (window.matchMedia("(max-width:700px)").matches) caseRef.current?.scrollIntoView({ block: "start" });
    });
  }
  function inspect(id: string) {
    setReceiptFocus(id); goStep("RECEIPTS", true);
  }
  function onJourneyKey(event: KeyboardEvent<HTMLButtonElement>) {
    let index = stepIndex;
    if (event.key === "ArrowRight") index = (index + 1) % steps.length;
    else if (event.key === "ArrowLeft") index = (index + steps.length - 1) % steps.length;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = steps.length - 1;
    else return;
    event.preventDefault(); goStep(steps[index], true);
  }

  return <div className="visual-lab" data-material={material}>
    <AlleyWorld />
    <a className="vl-skip" href="#vl-case">Skip to active Case</a>
    <header className="vl-topbar">
      <a className="vl-brand" href="/visual-lab" aria-label="BINRAT visual lab home">
        <strong>BINRAT</strong><span>HE GETS THE SCRAPS.<br />YOU GET THE RECEIPTS.</span>
      </a>
      <div className="vl-command">
        <nav aria-label="Visual lab"><a href="#vl-case">CASES</a><a href="#vl-finds">FRESH FINDS</a></nav>
        <div className="vl-lab-stamp"><span>VISUAL LAB</span><b>SYNTHETIC · NO LIVE EVIDENCE</b></div>
        <Crew />
      </div>
    </header>

    <aside className="vl-scout-label" aria-label="Rat Zero identity"><span className="vl-live"><i /> RAT ZERO <b>SCOUT / LIVE</b></span><p>Dirty world.<br /><strong>Clean proof.</strong></p></aside>

    <main className="vl-workspace">
      <section id="vl-finds" className="vl-discovery" aria-labelledby="vl-finds-title">
        <header><h2 id="vl-finds-title"><Icon kind="scan" /> FRESH FINDS</h2><span>FROM THE SYNTHETIC INDEX</span></header>
        <div className="vl-find-rail">
          {labCases.map((find, index) => <button key={find.id} type="button" className={`vl-find ${index === activeFind ? "active" : ""}`} aria-pressed={index === activeFind} aria-label={`Open ${find.symbol} Case`} onClick={() => openCase(index)}>
            <span className={`vl-find-mark ${find.tone}`} aria-hidden="true">{find.mark}</span>
            <span><strong>{find.symbol}</strong><small>{find.discovery}</small></span><span className="vl-find-arrow" aria-hidden="true">↗</span>
          </button>)}
        </div>
      </section>

      <article ref={caseRef} tabIndex={-1} id="vl-case" className="vl-hero-surface" aria-labelledby="vl-case-title" data-case={active.symbol}>
        <div className="vl-case-topline"><span><Icon kind="folder" /> ACTIVE CASE <b>#{active.id}</b></span><span className="vl-case-status"><i /> SYNTHETIC INVESTIGATION</span></div>
        <div className="vl-case-hero">
          <figure className="vl-case-art"><img src={caseScene} width={840} height={473} alt="Pixel-art alley with a neon rat mural and wet sunset reflections" /><figcaption><span>SCENE / {active.symbol}</span>ILLUSTRATION ONLY</figcaption></figure>
          <div className="vl-case-intro"><span className="vl-alert">RAT ZERO FOUND SOMETHING.</span><h1 id="vl-case-title">{active.headline}</h1><p><span className="vl-summary">{active.summary}</span><span className="vl-mobile-significance">{active.explanation}</span></p><div className="vl-chips"><span>{active.symbol}</span><span>{active.history.kind === "observed" ? `${active.history.prior.length} EARLIER MATCHES` : "HISTORY UNKNOWN"}</span><span>NO VERDICT</span></div>
            {step !== "NEXT" ? <button className="vl-primary" onClick={() => goStep(steps[stepIndex + 1], true)}>{["FOLLOW THE TRAIL", "CHECK RECEIPTS", "REVIEW NEXT ACTIONS"][stepIndex]}<Icon kind="arrow" /></button> : <a className="vl-primary" href="#vl-finds">RETURN TO FINDS<Icon kind="arrow" /></a>}
          </div>
        </div>

        <div className="vl-case-steps" role="tablist" aria-label="Case journey">
          {steps.map((name, index) => <button key={name} ref={(node) => { tabRefs.current[index] = node; }} id={`vl-tab-${name}`} role="tab" aria-selected={step === name} aria-controls={`vl-panel-${name}`} tabIndex={step === name ? 0 : -1} className={`${step === name ? "active" : ""} ${index < stepIndex ? "visited" : ""}`} onClick={() => goStep(name)} onKeyDown={onJourneyKey}>
            <i>{String(index + 1).padStart(2, "0")}</i><strong>{name}</strong><small>{stepHints[index]}</small>
          </button>)}
        </div>

        <section className="vl-stage" id={`vl-panel-${step}`} role="tabpanel" aria-labelledby={`vl-tab-${step}`} tabIndex={0} key={`${active.id}-${step}`}>
          {step === "WHAT" && <div className="vl-what">
            <div><span className="vl-eyebrow">WHY HE BROUGHT IT</span><h2>{active.why}</h2><p>{active.explanation}</p></div>
            <EvidenceSurface><div className="vl-section-title"><Icon kind="shield" /> IN THE RECORD</div><ul className="vl-facts">{active.facts.map((fact) => <li key={fact.receiptId}><i /><span>{fact.text}</span><button className="vl-text-action" aria-label={`Inspect ${fact.receiptId}`} onClick={() => inspect(fact.receiptId)}>↗</button></li>)}</ul></EvidenceSurface>
          </div>}
          {step === "TRAIL" && <div className="vl-trail-view">
            <div className="vl-stage-heading"><div><span className="vl-eyebrow">FOLLOW THE TRAIL</span><h2>{active.history.kind === "observed" ? "An address leaves a trail." : "The earlier story is unknown."}</h2></div><span className="vl-meta">{active.history.kind === "observed" ? `${active.history.prior.length} EARLIER MATCHES · PARTIAL INDEX` : "NO VERIFIED EARLIER HISTORY"}</span></div>
            {active.history.kind === "unknown" && <p>{active.history.reason}</p>}
            <ol className="vl-timeline">{[active.current, ...active.history.prior].map((event, index) => <li key={event.receiptId}><time>{event.date}</time><i /><strong>{event.symbol}</strong><span>{event.label}</span><button className="vl-text-action" aria-label={`Inspect ${event.receiptId}`} onClick={() => inspect(event.receiptId)}>RECORD <Icon kind="arrow" /></button>{index === 0 && <span className="vl-current-marker">THIS CASE</span>}</li>)}</ol>
          </div>}
          {step === "RECEIPTS" && <div className="vl-receipts-view">
            <div className="vl-stage-heading"><div><span className="vl-eyebrow">CHECK THE RECEIPTS</span><h2>Open the record. Know its limits.</h2></div><span className="vl-meta">{active.receipts.length} LOCAL {active.receipts.length === 1 ? "RECORD" : "RECORDS"}</span></div>
            <p className="vl-provenance">Synthetic examples, not chain receipts. Expand a record for its fields and source.</p>
            <div ref={(node) => {
              if (node && receiptFocus) {
                const target = node.querySelector<HTMLDetailsElement>(`[data-receipt="${receiptFocus}"] details`);
                if (target) target.open = true;
              }
            }}>{active.receipts.map((receipt) => <div key={receipt.id} data-receipt={receipt.id}><Receipt receipt={receipt} active={active} /></div>)}</div>
          </div>}
          {step === "NEXT" && <div className="vl-next-view">
            <div><span className="vl-eyebrow">YOUR NEXT MOVE</span><h2>Don't keep checking this shit.</h2><p>Where enabled, Watch can bring you back when a reported deployer appears again.</p></div>
            <EvidenceSurface><div className="vl-section-title">WATCH <span>{active.watch === "access-required" ? "ACCESS REQUIRED" : "UNAVAILABLE"}</span></div>
              {active.watch === "access-required" ? <><p>This Case has a synthetic reported address. Check the access boundary before leaving a Watch.</p><button className="vl-utility" aria-expanded={watchGate} aria-controls="vl-watch-gate" onClick={() => setWatchGate(!watchGate)}>{watchGate ? "CLOSE ACCESS DETAILS" : "CHECK WATCH ACCESS"} <Icon kind="arrow" /></button></> : <p>A reported deployer is missing. Watch is unavailable for {active.symbol}; inspect the existing record or return to Fresh Finds.</p>}
            </EvidenceSurface>
            {watchGate && <div id="vl-watch-gate" className="vl-watch-gate" role="status"><strong>Watch requires access.</strong><p>This synthetic Case cannot start a live Watch. Open Telegram to check your actual access. No Watch has been created.</p><a className="vl-utility" href="https://t.me/BinratBot" target="_blank" rel="noopener noreferrer">OPEN TELEGRAM ↗</a></div>}
            <p className="vl-capability-note">WATCH IS NOT TRIPWIRE. Tripwire is building; Working Rat is not live.</p>
          </div>}
        </section>

        <div className="vl-case-bottom"><p><Icon kind="shield" /><span>{active.boundary}</span></p></div>
      </article>
      <footer className="vl-footer"><span><i /> THE WORLD IS DIRTY. THE BOUNDARIES ARE CLEAR.</span><span>VISUAL LAB V2 · SYNTHETIC</span></footer>
    </main>

    {debug && <aside className="vl-material-switcher" aria-label="Visual debug materials"><span>VISUAL DEBUG</span>{(["glass", "refract", "pearl"] as const).map((value) => <button key={value} aria-pressed={material === value} onClick={() => setMaterial(value)}>{value.toUpperCase()}</button>)}</aside>}
  </div>;
}
