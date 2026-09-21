import type { CSSProperties } from "react";
import { AppLink } from "./Primitives";
import characterUrl from "./assets/north-star/binrat-character-master.png";
import worldBackgroundUrl from "./assets/north-star/binrat-world-background.png";

type Navigate = (path: string) => void;

const calibrationNav = [
  ["DUMPSTER", "/dumpster"],
  ["RADAR", "/radar"],
  ["REPLAY", "/replay"],
  ["WATCH", "/watch"],
  ["LEDGER", "/ledger"],
  ["BINRAT", "/binrat"],
] as const;

export function AppWorldBackground() {
  return (
    <div className="cal-world" aria-hidden="true">
      <img src={worldBackgroundUrl} alt="" />
    </div>
  );
}

export function AppHeader({ navigate }: { navigate: Navigate }) {
  return (
    <header className="cal-header">
      <AppLink
        className="cal-brand"
        href="/"
        navigate={navigate}
        ariaLabel="BINRAT home"
      >
        <span className="cal-brand-mark" aria-hidden="true">
          BR
        </span>
        <span className="cal-brand-name">
          BINRAT <small>THE RAT REMEMBERS.</small>
        </span>
      </AppLink>
      <nav aria-label="Primary navigation">
        {calibrationNav.map(([label, path]) => (
          <AppLink
            key={path}
            href={path}
            navigate={navigate}
            className={label === "RADAR" ? "active" : undefined}
          >
            {label}
          </AppLink>
        ))}
      </nav>
    </header>
  );
}

export function RadarMasthead() {
  return (
    <section className="cal-masthead" aria-labelledby="cal-radar-title">
      <div className="cal-masthead-copy">
        <p className="cal-eyebrow">OBSERVE. CONNECT. QUESTION. DIG DEEPER.</p>
        <h1 id="cal-radar-title">RAT RADAR</h1>
        <p className="cal-support">
          Observed recipient recurrence across indexed launches.
        </p>
        <p className="cal-secondary">
          Same addresses. Different evidence histories.
        </p>
        <div className="cal-type" aria-label="Typography calibration">
          <span>DISPLAY / PLEX CONDENSED</span>
          <span>LABEL / PLEX MONO</span>
          <strong>Aa 0123 / SELECTABLE TYPE</strong>
        </div>
      </div>
      <figure className="cal-character">
        <img
          src={characterUrl}
          alt="BINRAT, the canonical cybernetic rat, watching from a dumpster"
        />
        <figcaption>CANONICAL FIELD UNIT / CHARACTER MASTER</figcaption>
      </figure>
    </section>
  );
}

function MachineSample() {
  return (
    <article className="cal-machine" aria-labelledby="machine-sample-title">
      <header>
        <span>01 / MATERIAL CALIBRATION</span>
        <b>MACHINE</b>
      </header>
      <div className="cal-machine-readout">
        <p id="machine-sample-title">INSTRUMENT SURFACE</p>
        <strong>COBALT / TEAL</strong>
        <span>HARD RULE · RESTRAINED WEAR · PHYSICAL CONTROL</span>
      </div>
      <div className="cal-controls" aria-label="Non-functional material controls">
        <span>CALIBRATION ONLY</span>
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <i aria-hidden="true" />
      </div>
    </article>
  );
}

function EvidenceSample() {
  return (
    <article className="cal-evidence" aria-labelledby="evidence-sample-title">
      <header>
        <span>02 / MATERIAL CALIBRATION</span>
        <b>EVIDENCE</b>
      </header>
      <div className="cal-paper-rule">
        <p id="evidence-sample-title">PHYSICAL PAPER SURFACE</p>
        <strong>DIRTY CREAM / HIGH LEGIBILITY</strong>
        <span>RECEIPT VOCABULARY · HARD RULE · NO CLAIM</span>
      </div>
      <div className="cal-paper-footer">
        <span>SPECIMEN — NOT EVIDENCE</span>
        <b>UNVERIFIED</b>
      </div>
    </article>
  );
}

export function RadarCalibration({ navigate }: { navigate: Navigate }) {
  const style = { "--cal-app-width": "1480px" } as CSSProperties;
  return (
    <div className="cal-app" style={style}>
      <a className="skip-link" href="#content">
        Skip to calibration content
      </a>
      <AppWorldBackground />
      <div className="cal-shell">
        <AppHeader navigate={navigate} />
        <main id="content" tabIndex={-1}>
          <RadarMasthead />
          <section className="cal-materials" aria-label="Material calibration">
            <MachineSample />
            <EvidenceSample />
          </section>
        </main>
      </div>
    </div>
  );
}
