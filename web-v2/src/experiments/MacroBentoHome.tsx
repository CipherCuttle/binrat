import { useEffect, useState } from "react";
import { AppLink } from "../Primitives";
import { sourceSwitchHref, publicApiUrl } from "../previewRuntime";
import type { DataMode } from "../data";
import type { PublicFeed, RadarWatchlist } from "../types";
import { readPublicHealth, type PublicHealth } from "./healthAdapter";
import worldDesktop from "../../public/north-star-g0/world-desktop-1536.webp";
import worldPhone from "../../public/north-star-g0/world-phone-585x810.webp";
import rat500 from "../../public/north-star-g0/home-visible-rat-dumpster-500w.webp";
import rat780 from "../../public/north-star-g0/home-visible-rat-dumpster-780w.webp";
import s from "./MacroBentoHome.module.css";

interface Props {
  feed: PublicFeed | null;
  radar: RadarWatchlist | null;
  feedError: string | null;
  radarError: string | null;
  mode: DataMode;
  loaded: boolean;
  readAtMs: number | null;
  navigate: (path: string) => void;
}
type HealthView = { value: PublicHealth | null; error: string | null; loading: boolean };
const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
const compactAddress = (address: string) => address.slice(0, 8) + "…" + address.slice(-6);

function useVisibleHealth(mode: DataMode): HealthView {
  const [view, setView] = useState<HealthView>({ value: null, error: null, loading: mode === "LIVE" });
  useEffect(() => {
    if (mode !== "LIVE") return; // DEMO never contacts the public health endpoint.
    let active = true;
    let request: AbortController | null = null;
    const update = async () => {
      if (document.visibilityState !== "visible") return;
      request?.abort();
      const current = new AbortController();
      request = current;
      try {
        const value = await readPublicHealth(current.signal);
        if (active && !current.signal.aborted) setView({ value, error: null, loading: false });
      } catch (error) {
        if (active && !current.signal.aborted)
          setView({ value: null, error: error instanceof Error ? error.message : "PUBLIC_HEALTH_UNAVAILABLE", loading: false });
      }
    };
    void update();
    const timer = window.setInterval(() => { void update(); }, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      active = false;
      request?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [mode]);
  return mode === "DEMO" ? { value: null, error: null, loading: false } : view;
}

function Terminal({ feed, radar, feedError, radarError, mode, loaded, readAtMs }: Omit<Props, "navigate">) {
  const health = useVisibleHealth(mode);
  const status = mode === "DEMO" ? "DEMO FIXTURE" : health.loading
    ? "CHECKING" : health.error ? "UNAVAILABLE" : !health.value?.runtimeFresh || (health.value.runtimeUpdatedAtMs !== null &&
        Date.now() - health.value.runtimeUpdatedAtMs > 180_000)
      ? "STALE" : health.value.ok && health.value.indexReady ? "READY" : "NOT READY";
  const ready = mode === "LIVE" && status === "READY";
  const checkpoints = mode === "LIVE"
    ? [health.value?.checkpointBlock, feed?.asOfBlock, radar?.asOfBlock].filter((value): value is string => !!value)
    : [];
  const asynchronous = new Set(checkpoints).size > 1;
  const healthCount = ready && health.value ? fmt(health.value.launchCount) : "—";
  return <section className={s.terminal} aria-labelledby="mb-terminal-title">
    <div className={s.hardware}><span>BINRAT / SALVAGED FIELD UNIT 01</span><span>ARC · 5042 <i aria-hidden="true">●</i></span></div>
    <div className={s.screen}>
      <header className={s.screenHead}>
        <div><span className={s.micro}>01 / PUBLIC INDEX HEALTH</span><h2 id="mb-terminal-title">ARC MACRO TERMINAL</h2></div>
        <span data-testid="macro-health-state" className={ready ? s.signalReady : s.signalCaution}>{status}</span>
      </header>
      <div className={s.readouts}>
        <div className={s.readout}><small>INDEXED LAUNCHES · HEALTH</small>
          <strong data-testid="macro-launch-count">{mode === "DEMO" ? "—" : healthCount}</strong>
          <span>{mode === "DEMO" ? "No live health in demo" : ready ? "Read-only public health" : "Health not verified ready"}</span>
        </div>
        <div className={s.readout}><small>HEALTH CHECKPOINT</small>
          <strong className={s.block}>{mode === "DEMO" ? "—" : health.value?.checkpointBlock ?? "—"}</strong>
          <span>{mode === "DEMO" ? "No live checkpoint" : health.value?.runtimeUpdatedAtMs
            ? "Runtime updated " + new Date(health.value.runtimeUpdatedAtMs).toLocaleTimeString()
            : health.error ?? "Awaiting health response"}</span>
        </div>
      </div>
      <div className={s.readoutGrid}>
        <div className={s.scope}>
          <span className={s.scopeLabel}>02 / SOURCE-INDEXED LAUNCH FEED <b>{feed ? feed.historyCoverage : !loaded ? "CHECKING" : "UNAVAILABLE"}</b></span>
          {feed ? <>
            <div className={s.scopeValue}><b>{fmt(feed.bags.length)}</b><span>launch records in current response{mode === "DEMO" ? " · SYNTHETIC" : ""}</span></div>
            <p>Feed as-of block <strong>{feed.asOfBlock}</strong></p>
            <small className={s.muted}>Latest displayed {feed.bags[0] ? "$" + feed.bags[0].symbol + " / block " + feed.bags[0].blockNumber : "— no indexed bags"}</small>
          </> : !loaded ? <p role="status">FEED CHECKING / awaiting validated response.</p> : <p role="alert">FEED UNAVAILABLE / {feedError ?? "No validated feed"}. No substitute.</p>}
        </div>
        <div className={s.scope}>
          <span className={s.scopeLabel}>03 / OBSERVED RECIPIENT RADAR <b>{radar?.coverage.status ?? (!loaded ? "CHECKING" : "UNAVAILABLE")}</b></span>
          {radar ? <>
            <div className={s.scopeValue}><b>{fmt(radar.coverage.distinctRecipientAddressCount)}</b><span>observed recipient addresses{mode === "DEMO" ? " · SYNTHETIC" : ""}</span></div>
            <p>Radar as-of block <strong>{radar.asOfBlock}</strong> · {radar.coverage.historyCoverage}</p>
            <small className={s.muted}>{radar.coverage.rankedAddressCount} ranked · {radar.coverage.acquisitionReceiptCount} acquisition receipts</small>
          </> : !loaded ? <p role="status">RADAR CHECKING / awaiting validated response.</p> : <p role="alert">RADAR UNAVAILABLE / {radarError ?? "No validated Radar"}. No substitute.</p>}
        </div>
      </div>
      <div className={s.terminalFoot}>
        <span>{mode === "DEMO" ? "DETERMINISTIC DEMO · NOT CHAIN PROOF" :
          asynchronous ? "DIFFERENT CHECKPOINTS · NOT A SYNCHRONIZED SNAPSHOT" :
          "INDEPENDENT HEALTH / FEED / RADAR SOURCES · NO SYNCHRONIZATION CLAIM"}</span>
        <span>{mode === "LIVE" && health.value && !health.value.historyBackfillComplete ? "HISTORY BACKFILL INCOMPLETE" : "NO BUY / SELL SIGNAL"} {readAtMs !== null ? " · FEED/RADAR CHECKED " + new Date(readAtMs).toLocaleTimeString() : ""}</span>
      </div>
    </div>
    <div className={s.hardwareFoot}><span>READ ONLY // NO PRICE SERIES AVAILABLE</span><span>SYS / ARC-PUB</span></div>
  </section>;
}

function RadarBento({ radar, radarError, mode, navigate, loaded }: Pick<Props, "radar" | "radarError" | "mode" | "navigate" | "loaded">) {
  const [repeatOnly, setRepeatOnly] = useState(false);
  const candidates = radar?.candidates.filter(candidate => !repeatOnly || candidate.distinctLaunchCount > 1) ?? [];
  return <section className={s.radarPanel} aria-labelledby="mb-radar-title">
    <header className={s.panelHead}>
      <div><small>02 / INDEPENDENT EVIDENCE</small><h2 id="mb-radar-title">RAT RADAR <span>↗</span></h2>
        <p>Observed launched-token recipient addresses. Recurrence is not identity, profit, or a recommendation.</p></div>
      <AppLink className={s.textLink} href="/radar" navigate={navigate}>FULL RADAR ↗</AppLink>
    </header>
    <div className={s.filterRow}>
      <span>{mode === "DEMO" ? "SYNTHETIC DEMO" : "PUBLIC WATCHLIST"} · {radar ? radar.coverage.status + " / " + radar.coverage.historyCoverage : !loaded ? "CHECKING" : "UNAVAILABLE"}</span>
      <button type="button" onClick={() => setRepeatOnly(value => !value)} aria-pressed={repeatOnly}
        className={s.filterButton}>{repeatOnly ? "SHOW ALL" : "REPEAT RECIPIENTS (2+)"} ↗</button>
    </div>
    {!radar ? !loaded ? <p className={s.empty} role="status">Checking public Radar watchlist…</p> : <p role="alert" className={s.problem}>RADAR UNAVAILABLE: {radarError ?? "No validated Radar watchlist"}. Feed, if present, remains independent.</p>
      : candidates.length ? <div className={s.radarRows}>
        {candidates.map(candidate => <div className={s.radarRow} key={candidate.observedRecipientAddress}>
          <AppLink href={"/radar/address/" + candidate.observedRecipientAddress} navigate={navigate} className={s.radarAddress}
            ariaLabel={"Open evidence for observed recipient " + candidate.observedRecipientAddress}>
            <span className={s.rank}>#{String(candidate.rank).padStart(2, "0")}</span>
            <span><b>{compactAddress(candidate.observedRecipientAddress)}</b>
              <small>{candidate.distinctLaunchCount} distinct indexed launches · {candidate.acquisitionReceiptCount} acquisition receipts</small></span>
            <span aria-hidden="true">↗</span>
          </AppLink>
          <span className={s.rowEvidence}>{candidate.evidenceActivityIds.length} linked activity IDs
            {mode === "LIVE" && candidate.evidenceActivityIds[0] &&
              <a href={publicApiUrl("/api/rat-radar/activity/" + candidate.evidenceActivityIds[0])}
                target="_blank" rel="noopener noreferrer">RAW RECEIPT ↗</a>}
          </span>
        </div>)}
      </div> : <p className={s.empty}>{repeatOnly && radar.candidates.length ? "No observed recipients meet the 2+ launch filter." :
        radar.coverage.status === "NO_SWAP_EVIDENCE" ? "NO SWAP EVIDENCE AT THIS CHECKPOINT." : "No ranked recipient addresses at this checkpoint."}</p>}
    <footer className={s.panelFoot}>Radar as-of: {radar?.asOfBlock ?? "—"} · {radar?.receipt.receiptId ?? "No receipt"} · Top five only</footer>
  </section>;
}

export default function MacroBentoHome(props: Props) {
  const { mode, navigate } = props;
  return <div className={s.home} data-testid="macro-bento-home" data-source-mode={mode}>
    <header className={s.masthead}>
      <AppLink href="/" navigate={navigate} className={s.wordmark}>BINRAT <span>/ FIELD TERMINAL</span></AppLink>
      <nav aria-label="Experimental homepage">{[["RADAR", "/radar"], ["DUMPSTER", "/dumpster"], ["REPLAY", "/replay"], ["METHOD", "/method"]].map(([label, path]) =>
        <AppLink key={path} href={path} navigate={navigate}>{label}</AppLink>)}</nav>
      <a className={s.modeSwitch} href={sourceSwitchHref(mode === "DEMO")}>{mode} · SWITCH TO {mode === "DEMO" ? "LIVE" : "DEMO"} ↗</a>
    </header>
    <div className={s.canvas}>
      <section className={s.hero} aria-label="BINRAT launch intelligence">
        <div className={s.intro}>
          <picture className={s.world} aria-hidden="true"><source media="(max-width: 720px)" srcSet={worldPhone}/>
            <img src={worldDesktop} alt="" /></picture>
          <span className={s.micro}>THE DUMPSTER HAS A MEMORY. / ARC 5042</span>
          <h1>THE RAT<br/><em>REMEMBERS.</em></h1>
          <p>Launch evidence, reported creator addresses and observed recipient recurrence. Public receipts, without pretending to know who is behind a wallet.</p>
          <div className={s.actions}>
            <AppLink className={s.primary} href="/radar" navigate={navigate}>EXPLORE RAT RADAR <span>↗</span></AppLink>
            <AppLink className={s.secondary} href="/dumpster" navigate={navigate}>ENTER THE DUMPSTER ↗</AppLink>
          </div>
          <small className={s.disclosure}>{mode === "DEMO" ? "DETERMINISTIC DEMO / ALL FIGURES SYNTHETIC" :
            "PUBLIC LIVE REQUESTS / STATUS VERIFIED PER SOURCE"} · NO SAFETY SCORE · NO BUY CALL</small>
        </div>
        <div className={s.terminalArea}>
          <Terminal feed={props.feed} radar={props.radar} feedError={props.feedError} radarError={props.radarError} mode={mode} loaded={props.loaded} readAtMs={props.readAtMs} />
          <img className={s.rat} src={rat500} srcSet={rat500 + " 500w, " + rat780 + " 780w"}
            sizes="(max-width:720px) 125px, 180px" alt="" aria-hidden="true" />
          <span className={s.ratLabel}>FIELD UNIT / 001<br/>SALVAGED CRT OPERATIONS</span>
        </div>
      </section>
      <div className={s.lower}>
        <RadarBento radar={props.radar} radarError={props.radarError} mode={mode} loaded={props.loaded} navigate={navigate}/>
        <aside className={s.side} aria-label="Other BINRAT functions">
          <div className={s.sideHeading}><small>03 / THE REST OF THE WORKBENCH</small><h2>FOLLOW THE RECEIPTS.</h2>
            <p>Open an existing investigation surface. The bento experiment does not change the underlying tools.</p></div>
          <AppLink href="/dumpster" navigate={navigate} className={s.moduleLink}><span>01 / DUMPSTER</span><b>Source-indexed launches</b><i>↗</i></AppLink>
          <AppLink href="/replay" navigate={navigate} className={s.moduleLink}><span>02 / REPLAY</span><b>Available evidence horizons</b><i>↗</i></AppLink>
          <AppLink href="/ledger" navigate={navigate} className={s.moduleLink}><span>03 / LEDGER</span><b>Prelaunch / limited</b><i>↗</i></AppLink>
          <AppLink href="/watch" navigate={navigate} className={s.moduleLink}><span>04 / WATCH</span><b>Telegram confirmation boundary</b><i>↗</i></AppLink>
          <AppLink href="/method" navigate={navigate} className={s.methodLink}>METHOD & COVERAGE LIMITATIONS ↗</AppLink>
        </aside>
      </div>
      <footer className={s.endnote}>BINRAT / EXPERIMENTAL READ-ONLY FIELD SURFACE · PUBLIC DATA REMAINS FREE · ADDRESSES ARE NOT IDENTITIES</footer>
    </div>
  </div>;
}
