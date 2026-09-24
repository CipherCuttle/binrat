import { useState } from "react";
import { AppLink } from "../Primitives";
import type { DataMode } from "../data";
import { BinratIcon, iconLabels, iconNames } from "./icons/binrat";
import { Micrographic, motifNames } from "./micrographics";
import { EvidenceStamp, RatOperator, ReceiptSheet, ScrapCard, ScrapBookmark, SewerDivider } from "./components";
import type { Bookmark } from "../mobile/MobileExperience";
import s from "./DesignLab.module.css";

const swatches = [
  ["ASPHALT", "#101210"], ["OXIDE", "#263b35"], ["STEEL", "#1c201c"],
  ["RECEIPT", "#cec6b5"], ["BONE", "#e4ddcc"], ["RUST", "#cf9567"],
  ["FAULT", "#ff3948"], ["SEAM", "#596154"],
] as const;
const mock: Bookmark = { kind: "bag", id: "visual-art-sample-not-a-real-bag", mode: "DEMO" };
export function DesignLabPage({ mode, navigate }: { mode: DataMode; navigate: (path: string) => void }) {
  const [sampleSaved, setSampleSaved] = useState(false);
  if (mode !== "DEMO") return <section className={s.restricted}><h1>DESIGN LAB IS NOT PUBLIC LIVE.</h1>
    <p>These art samples are isolated to deterministic DEMO mode.</p><AppLink href="/" navigate={navigate}>BACK TO BINRAT →</AppLink></section>;
  return <div className={s.lab} data-dumpster-os="art-lab">
    <header className={s.hero}>
      <div className={s.topLine}><span>BINRAT / DUMPSTER OS / ART SAMPLE</span><strong>DESIGN REVIEW ONLY · NOT CHAIN PROOF</strong></div>
      <div className={s.heroInner}><div><span className={s.micro}>FIELD UNIT / INDUSTRIAL IDENTITY 001</span>
        <h1>BUILT FROM<br/><em>THE SCRAPS.</em></h1><p>Grimed hardware. Receipt-bound intelligence. One cursed cyborg rat. Two instruments: forensic bench and field scanner.</p>
        <AppLink href="/" navigate={navigate} className={s.home}>← BACK TO DISCOVER</AppLink></div>
        <div className={s.heroRat}><img src={import.meta.env.BASE_URL+"binrat-hero.webp"} alt="" loading="lazy"/>
          <span>OPERATOR 001 / ACTIVE IN DEMO</span></div></div>
    </header>
    <section className={s.chapter}><header><small>01 / SILHOUETTES · FIRST-PARTY</small><h2>THE RAT'S TOOLBOX</h2>
      <p>Thirteen original production-candidate glyphs. Clean one-color silhouettes first; optional rust and scratch at larger sizes. Labels remain readable without icons.</p></header>
      <div className={s.iconGrid}>{iconNames.map((name,i)=>
        <div className={s.iconSpec} key={name} data-os-icon={name}><div className={s.iconStage}>
          <span>{String(i+1).padStart(2,"0")}</span><BinratIcon name={name} decorative size={42}/><BinratIcon name={name} decorative size={20}/>
        </div><b>{iconLabels[name]}</b><code>{name.toUpperCase().replaceAll("-","_")}</code></div>)}</div>
    </section>
    <section className={s.chapter}><header><small>02 / MICROGRAPHICS · MATERIAL HARDWARE</small><h2>RUST, RIVETS, SEAMS.</h2>
      <p>Eight reusable framing parts. They never imply evidence quality; their purpose is to make ordinary app surfaces look like found instruments.</p></header>
      <div className={s.motifGrid}>{motifNames.map((kind,i)=>
        <div className={s.motifSpec} key={kind} data-os-motif={kind}><span>M{String(i+1).padStart(2,"0")}</span>
          <Micrographic kind={kind} size={63} tone={i%2===0?"rust":"bone"}/>
          <b>{kind.toUpperCase().replaceAll("-"," ")}</b></div>)}</div>
    </section>
    <section className={s.chapter}><header><small>03 / MATERIAL & LEGIBILITY</small><h2>OIL / BONE / OXIDE.</h2>
      <p>Hard surface accents stay at the border. Sources, identifiers, timestamps and data states live on clear, quiet material.</p></header>
      <div className={s.swatches}>{swatches.map(([name,hex])=><div key={name} className={s.swatch}>
        <span style={{background:hex}}/><b>{name}</b><code>{hex.toUpperCase()}</code></div>)}</div>
    </section>
    <section className={s.chapter}><header><small>04 / ARTIFACT COMPONENTS · STATIC DEMO</small><h2>NOT A DASHBOARD.</h2></header>
      <div className={s.componentGrid}>
        <ScrapCard variant="oxide" density="bench" className={s.sampleCard}>
          <div className={s.sampleTop}><span>EXHIBIT 004 / INDEXED BAG</span><EvidenceStamp scope="coverage" state="PARTIAL"/></div>
          <div className={s.sampleTitle}><BinratIcon name="bag-dossier" size={47} decorative/><h3>$FERAL</h3><RatOperator size="stamp"/></div>
          <p>Source-reported creator. Three prior indexed demo bags. Exact receipts available inside the dossier.</p>
          <ScrapBookmark label="sample FERAL bag" item={mock} saved={sampleSaved} onToggle={()=>setSampleSaved(v=>!v)}/>
        </ScrapCard>
        <ReceiptSheet mode="DEMO" title="EVIDENCE ARTIFACT / DEMONSTRATION" source="STATIC ART SAMPLE">
          <p>Visible proof metadata has an intentionally clean substrate. The serrated edge and rusted bracket surround the content without altering its meaning.</p>
          <div className={s.specStamp}><EvidenceStamp scope="fact" state="OBSERVED"/> <EvidenceStamp scope="fact" state="UNKNOWN"/></div>
          <code>DEMO_SAMPLE_ONLY / NO CHAIN RECEIPT</code>
        </ReceiptSheet>
      </div>
      <SewerDivider kind="weld"/>
      <div className={s.operatorStrip}><RatOperator size="panel"/><div><strong>THE RAT RUNS THE MACHINE.</strong><p>Small operator fragments in the shell, inspection trays and error states; full mascot art stays rare. Nothing “verified” is animated without a validated event.</p></div>
        <BinratIcon name="cyborg-eye" decorative size={43}/></div>
    </section>
    <footer className={s.footer}><span>13 DOMAIN ICONS / 8 MOTIFS / 5 ARTIFACT PRIMITIVES</span>
      <b>NO SAFE/RUG SCORES. NO BUY CALLS. NO IDENTITY INFERENCE.</b>
      <AppLink href="/" navigate={navigate}>BACK TO PRODUCT ↗</AppLink></footer>
  </div>;
}
