import type { CSSProperties } from "react";
import { AppLink } from "./Primitives";
import { RadarWorkbench } from "./RadarWorkbench";
import characterUrl from "./assets/north-star/binrat-character-master.png";
import worldBackgroundUrl from "./assets/north-star/binrat-world-background.png";
import type { DataMode } from "./data";
import type { RadarWatchlist } from "./types";

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

function RadarLoading({ mode }: { mode: DataMode }) {
  return (
    <section className="radar-state" aria-live="polite">
      <span aria-hidden="true" />
      <strong>TRACING OBSERVED RECIPIENTS…</strong>
      <small>{mode === "DEMO" ? "DETERMINISTIC DEMO DATA" : "PUBLIC LIVE DATA"}</small>
    </section>
  );
}

function RadarError({ mode }: { mode: DataMode }) {
  return (
    <section className="radar-state error" role="alert">
      <strong>THE TRAIL WENT COLD.</strong>
      <p>No validated Radar evidence was returned.</p>
      <small>{mode === "LIVE" ? "LIVE READ FAILED / NO DEMO FALLBACK" : "DATA UNAVAILABLE"}</small>
    </section>
  );
}

export function RadarCalibration({
  navigate,
  radar,
  mode,
  error,
}: {
  navigate: Navigate;
  radar: RadarWatchlist | null;
  mode: DataMode;
  error: string;
}) {
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
          {error ? (
            <RadarError mode={mode} />
          ) : radar ? (
            <RadarWorkbench radar={radar} mode={mode} />
          ) : (
            <RadarLoading mode={mode} />
          )}
        </main>
      </div>
    </div>
  );
}
