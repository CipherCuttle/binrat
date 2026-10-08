import { useMemo, useState, type PointerEvent, type ReactNode } from "react";
import alleyDesktop from "../public/visual-lab/scene/alley-bg-desktop.webp";
import alleyMobile from "../public/visual-lab/scene/alley-bg-mobile.webp";
import ratDesktop from "../public/visual-lab/foreground/ratzero-dumpster-desktop.webp";
import ratMobile from "../public/visual-lab/foreground/ratzero-dumpster-mobile.webp";
import foregroundTrash from "../public/visual-lab/foreground/foreground-trash.webp";
import "./visual-lab.css";

type Material = "glass" | "refract" | "pearl";
type Step = "WHAT" | "TRAIL" | "RECEIPTS" | "NEXT";

const finds = [
  { symbol: "$MOLDY", note: "same deployer · 3 earlier indexed launches", tone: "repeat" },
  { symbol: "$SLOP", note: "fresh launch · limited history", tone: "fresh" },
  { symbol: "$CRUST", note: "same reported address surfaced again", tone: "repeat" },
  { symbol: "$OOZE", note: "new metadata · receipts available", tone: "fresh" },
  { symbol: "$TIN", note: "partial history · keep the boundary", tone: "partial" },
];

const trail = [
  ["NOW", "CURRENT BAG", "$MOLDY"],
  ["6D", "SAME REPORTED DEPLOYER", "$CRUST"],
  ["9D", "SAME REPORTED DEPLOYER", "$SLOP"],
  ["10D", "OLDER INDEXED BAG", "$TIN"],
];

function HoloPanel({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const move = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--px", `${event.clientX - box.left}px`);
    event.currentTarget.style.setProperty("--py", `${event.clientY - box.top}px`);
  };
  return (
    <section id={id} className={`vl-panel ${className}`} onPointerMove={move}>
      {children}
    </section>
  );
}

// Decorative environment only. Failed artwork leaves the readable CSS backdrop.
// Import URLs so Vite bundles these alongside the existing canonical publicDir.
function AlleyWorld() {
  const [alleyFailed, setAlleyFailed] = useState(false);
  const [ratFailed, setRatFailed] = useState(false);
  const [trashFailed, setTrashFailed] = useState(false);
  return (
    <div className="vl-world" aria-hidden="true">
      {!alleyFailed && (
        <picture className="vl-alley">
          <source media="(max-width:760px)" srcSet={alleyMobile} />
          <img src={alleyDesktop} alt="" width={1672} height={941}
            decoding="async" fetchPriority="high" onError={() => setAlleyFailed(true)} />
        </picture>
      )}
      {!trashFailed && <img className="vl-world-trash" src={foregroundTrash} alt=""
        width={1600} height={533} decoding="async" onError={() => setTrashFailed(true)} />}
      <div className="vl-world-shade" />
      {!ratFailed && (
        <picture className="vl-rat-scene">
          <source media="(max-width:760px)" srcSet={ratMobile} />
          <img src={ratDesktop} alt="" width={720} height={900}
            decoding="async" onError={() => setRatFailed(true)} />
        </picture>
      )}
    </div>
  );
}

function CrewCard({
  image,
  name,
  role,
  status,
}: {
  image: string;
  name: string;
  role: string;
  status: "LIVE" | "BUILDING" | "PROVING";
}) {
  return (
    <div className="vl-crew-card">
      <img src={image} alt="" />
      <div>
        <strong>{name}</strong>
        <span>{role}</span>
      </div>
      <b className={status.toLowerCase()}>{status}</b>
    </div>
  );
}

export function VisualLab() {
  const [material, setMaterial] = useState<Material>("refract");
  const [activeFind, setActiveFind] = useState(0);
  const [step, setStep] = useState<Step>("WHAT");
  const [section, setSection] = useState("vl-case");
  const active = useMemo(() => finds[activeFind]!, [activeFind]);

  return (
    <div className="visual-lab" data-material={material}>
      <AlleyWorld />

      <header className="vl-topbar vl-panel">
        <a className="vl-brand" href="/visual-lab" aria-label="BINRAT visual lab home">
          <strong>BINRAT</strong>
          <span>HE GETS THE SCRAPS.<br />YOU GET THE RECEIPTS.</span>
        </a>
        <div className="vl-live"><i /> RAT ZERO · LIVE</div>
        <nav aria-label="Visual lab">
          {([["vl-case", "CASES"], ["vl-finds", "FRESH FINDS"], ["vl-crew", "CREW"]] as const).map(([id, label]) => (
            <a key={id} href={`#${id}`} className={section === id ? "active" : ""}
              aria-current={section === id ? "location" : undefined} onClick={() => setSection(id)}>{label}</a>
          ))}
        </nav>
        <div className="vl-lab-stamp">VISUAL LAB · SYNTHETIC · NO LIVE EVIDENCE</div>
      </header>

      <aside className="vl-material-switcher" aria-label="Holographic material preset">
        {(["glass", "refract", "pearl"] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={material === value ? "active" : ""}
            aria-pressed={material === value}
            onClick={() => setMaterial(value)}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </aside>

      <main className="vl-workspace">
        <HoloPanel id="vl-finds" className="vl-finds">
          <header>
            <div><span className="vl-eyebrow">RAT ZERO / SCOUT</span><h2>FRESH FINDS</h2></div>
            <small>SYNTHETIC VISUAL-LAB DATA</small>
          </header>
          <div className="vl-find-rail">
            {finds.map((find, index) => (
              <button
                key={find.symbol}
                type="button"
                className={index === activeFind ? "vl-find active" : "vl-find"}
                aria-pressed={index === activeFind}
                onClick={() => {
                  setActiveFind(index);
                  setStep("WHAT");
                }}
              >
                <span className={`vl-find-mark ${find.tone}`} />
                <strong>{find.symbol}</strong>
                <small>{find.note}</small>
                <b>OPEN CASE →</b>
              </button>
            ))}
          </div>
        </HoloPanel>

        <div className="vl-main-grid">
          <HoloPanel id="vl-case" className="vl-case">
            <div className="vl-case-topline">
              <span>ACTIVE CASE · {String(activeFind + 1).padStart(3, "0")}</span>
              <b><i /> RAT ZERO INVESTIGATING</b>
            </div>

            <div className="vl-case-hero">
              <div className="vl-case-art">
                <div className="vl-case-art-grid" />
                <span>CASE / {active.symbol}</span>
              </div>
              <div>
                <span className="vl-alert">RAT ZERO FOUND SOMETHING.</span>
                <h1>{active.tone === "repeat" ? "SMELLS FAMILIAR." : "FRESH SCRAP."}</h1>
                <p>{active.note}. Open the receipts before deciding what it means.</p>
                <div className="vl-chips">
                  <span>{active.symbol}</span><span>HISTORY: PARTIAL</span><span>NO VERDICT</span>
                </div>
              </div>
            </div>

            <div className="vl-case-steps" role="tablist" aria-label="Case journey">
              {(["WHAT", "TRAIL", "RECEIPTS", "NEXT"] as Step[]).map((name, index) => (
                <button
                  key={name}
                  type="button"
                  className={step === name ? "active" : ""}
                  onClick={() => setStep(name)}
                  role="tab"
                  aria-selected={step === name}
                >
                  <i>{index + 1}</i><strong>{name}</strong>
                  <small>{["why it is here", "what BINRAT remembers", "check the evidence", "leave something watching"][index]}</small>
                </button>
              ))}
            </div>

            <div className="vl-evidence-grid">
              <div>
                <div className="vl-section-title"><span>FOLLOW THE TRAIL</span><b>{step}</b></div>
                <div className="vl-trail">
                  {trail.map(([age, label, symbol]) => (
                    <div key={age + symbol}>
                      <time>{age}</time><i /><span>{label}</span><strong>{symbol}</strong><b>→</b>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="vl-section-title"><span>SUPPORTED FACTS</span><b>BOUNDED</b></div>
                <ul className="vl-facts">
                  <li><i />Pons reported this deployer on the current indexed launch.</li>
                  <li><i />The same reported address appears in earlier indexed launches.</li>
                  <li><i />History coverage is partial; missing history stays unknown.</li>
                  <li><i />No human identity, safety or profitability is inferred.</li>
                </ul>
              </div>
            </div>
          </HoloPanel>

          <div className="vl-side">
            <HoloPanel className="vl-next">
              <span className="vl-eyebrow">NEXT / CURRENT WATCH</span>
              <h2>DON'T KEEP<br />CHECKING THIS SHIT.</h2>
              <p>Where enabled, Watch can bring you back when the same reported deployer appears again.</p>
              <a href="https://t.me/BinratBot" target="_blank" rel="noopener noreferrer">OPEN TELEGRAM ↗</a>
              <small>WATCH IS NOT TRIPWIRE. PERSISTENT TRIPWIRE JOBS ARE NOT LIVE.</small>
            </HoloPanel>

            <HoloPanel id="vl-crew" className="vl-crew">
              <div className="vl-section-title"><span>THE CREW</span><b>STATUS</b></div>
              <CrewCard image="/crew/rat-avatar-48.png" name="RAT ZERO" role="SCOUT" status="LIVE" />
              <CrewCard image="/crew/tripwire.png" name="TRIPWIRE" role="WATCHER" status="BUILDING" />
              <CrewCard image="/crew/sniffer.png" name="SNIFFER" role="TRAIL HUNTER" status="PROVING" />
            </HoloPanel>
          </div>
        </div>
      </main>
      <footer className="vl-footer">BINRAT VISUAL LAB V1 · PRESENTATION ONLY · NO PRODUCTION AUTHORITY</footer>
    </div>
  );
}
