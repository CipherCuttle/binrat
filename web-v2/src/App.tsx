import { useEffect, useState } from "react";
import { loadProductData, type DataMode } from "./data";
import type {
  Bag,
  EvidenceState,
  PublicFeed,
  RadarWatchlist,
  RatState,
} from "./types";
import {
  AppLink,
  CaseTab,
  CheckpointRail,
  CoverageStamp,
  ProofBoundary,
  Receipt,
  RecurrenceMarks,
  WatchControl,
} from "./Primitives";
import { RadarSurface } from "./Calibration";

type Route =
  | { page: "home" }
  | { page: "dumpster" }
  | { page: "radar" }
  | { page: "bag"; id: string }
  | { page: "placeholder"; name: string };
const primaryNav = [
  ["DUMPSTER", "/dumpster"],
  ["RADAR", "/radar"],
  ["WATCH", "/watch"],
  ["REPLAY", "/replay"],
  ["LEDGER", "/ledger"],
] as const;
const appBase = () =>
  import.meta.env.BASE_URL === "/"
    ? ""
    : import.meta.env.BASE_URL.replace(/\/$/, "");

function readRoute(): Route {
  const path =
    window.location.pathname.replace(appBase(), "").replace(/\/$/, "") || "/";
  if (path === "/") return { page: "home" };
  if (path === "/dumpster") return { page: "dumpster" };
  if (path === "/radar") return { page: "radar" };
  if (path.startsWith("/bag/"))
    return { page: "bag", id: decodeURIComponent(path.slice(5)) };
  return { page: "placeholder", name: path.slice(1).toUpperCase() || "HOME" };
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [feed, setFeed] = useState<PublicFeed | null>(null);
  const [radar, setRadar] = useState<RadarWatchlist | null>(null);
  const [mode, setMode] = useState<DataMode>("DEMO");
  const [error, setError] = useState("");
  const isRadar = route.page === "radar";
  useEffect(() => {
    setError("");
    const requestedMode = new URLSearchParams(window.location.search).get("source") === "live"
      ? "LIVE"
      : "DEMO";
    setMode(requestedMode);
    loadProductData()
      .then((data) => {
        setFeed(data.feed);
        setRadar(data.radar);
        setMode(data.mode);
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : "DATA_UNAVAILABLE"),
      );
  }, []);
  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  useEffect(() => {
    document
      .querySelector<HTMLElement>("#content")
      ?.focus({ preventScroll: true });
  }, [route]);
  const navigate = (path: string) => {
    const target = `${appBase()}${path === "/" ? "/" : path}`;
    if (target !== window.location.pathname)
      window.history.pushState({}, "", target + window.location.search);
    setRoute(readRoute());
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };
  if (isRadar)
    return (
      <RadarSurface
        navigate={navigate}
        radar={radar}
        mode={mode}
        error={error}
      />
    );
  const content = error ? (
    <EmptyState
      title="THE TRAIL WENT COLD."
      detail="The public read plane did not return validated evidence. Nothing was synthesized."
    />
  ) : !feed || !radar ? (
    <Loading />
  ) : route.page === "home" ? (
    <Home feed={feed} radar={radar} navigate={navigate} />
  ) : route.page === "dumpster" ? (
    <Dumpster feed={feed} navigate={navigate} />
  ) : route.page === "bag" ? (
    <BagDossier
      bag={feed.bags.find((bag) => bag.id === route.id) ?? feed.bags[0]}
      navigate={navigate}
    />
  ) : (
    <Placeholder name={route.name} navigate={navigate} />
  );
  return (
    <div className="app-frame">
      <a className="skip-link" href="#content">
        Skip to evidence
      </a>
      <ShellNav route={route} navigate={navigate} />
      <div className="workspace">
        <StatusRail mode={mode} feed={feed} />
        <main id="content" tabIndex={-1}>
          {content}
        </main>
      </div>
    </div>
  );
}

function ShellNav({
  route,
  navigate,
}: {
  route: Route;
  navigate: (path: string) => void;
}) {
  const current = route.page === "bag" ? "DUMPSTER" : route.page.toUpperCase();
  return (
    <aside className="shell-nav">
      <AppLink
        className="wordmark"
        href="/"
        navigate={navigate}
        ariaLabel="BINRAT home"
      >
        <span className="brand-glyph">BR↗</span>
        <span>
          BINRAT<small>ARC / 5042</small>
        </span>
      </AppLink>
      <nav aria-label="Primary">
        {primaryNav.map(([label, path], index) => (
          <AppLink
            key={path}
            href={path}
            navigate={navigate}
            className={current === label ? "active" : ""}
          >
            <span>0{index + 1}</span>
            {label}
          </AppLink>
        ))}
      </nav>
      <AppLink className="token-link" href="/binrat" navigate={navigate}>
        <span>$BINRAT</span>
        <b>NOT_LAUNCHED</b>
      </AppLink>
      <p className="shell-motto">
        DEGEN DECIDES ATTENTION.
        <br />
        <b>RECEIPTS DECIDE TRUTH.</b>
      </p>
    </aside>
  );
}

function StatusRail({
  mode,
  feed,
}: {
  mode: DataMode;
  feed: PublicFeed | null;
}) {
  return (
    <header className="status-rail">
      <span className="status-cluster">
        <i />
        {feed ? "INDEX READY" : "INDEXING"}
      </span>
      <span>
        ARC <b>5042</b>
      </span>
      <span className="rail-wide">
        CHECKPOINT <b>{feed?.asOfBlock ?? "—"}</b>
      </span>
      <span>
        COVERAGE <CoverageStamp state={feed?.historyCoverage ?? "UNVERIFIED"} />
      </span>
      <span className="demo-flag">
        {mode === "DEMO" ? "DETERMINISTIC DEMO DATA" : "PUBLIC LIVE"}
      </span>
    </header>
  );
}

function Home({
  feed,
  radar,
  navigate,
}: {
  feed: PublicFeed;
  radar: RadarWatchlist;
  navigate: (path: string) => void;
}) {
  const latest = feed.bags[0];
  return (
    <div className="home-page">
      <section className="home-hero">
        <RatPresence state="idle" label="FIELD UNIT / INDEX READY" />
        <div className="hero-copy">
          <CaseTab tone="orange">ARC LAUNCH MEMORY / CASE 001</CaseTab>
          <h1>
            THE RAT
            <br />
            <em>REMEMBERS.</em>
          </h1>
          <p className="hero-lede">
            BINRAT watches Arc launches, remembers the creator address the
            source reported, and preserves the receipts so recurring evidence
            can be inspected later.
          </p>
          <div className="action-row">
            <AppLink
              className="action primary"
              href="/dumpster"
              navigate={navigate}
            >
              ENTER THE DUMPSTER <span>↗</span>
            </AppLink>
            <AppLink className="action" href="/radar" navigate={navigate}>
              OPEN RAT RADAR
            </AppLink>
          </div>
          <p className="claim-line">
            NO SCORE. NO BUY CALL. NO HUMAN IDENTITY INFERENCE.
          </p>
          <div
            className="hero-fragments"
            aria-label="Current demo evidence status"
          >
            <span>
              CHECKPOINT
              <br />
              <b>{feed.asOfBlock}</b>
            </span>
            <span>
              HISTORY
              <br />
              <CoverageStamp state={feed.historyCoverage} />
            </span>
            <span>
              DATA MODE
              <br />
              <b>DEMO / DETERMINISTIC</b>
            </span>
          </div>
        </div>
      </section>
      <section className="live-snapshot" aria-labelledby="snapshot-title">
        <header className="section-title">
          <div>
            <span>PRODUCT PROOF / 001</span>
            <h2 id="snapshot-title">RIGHT NOW IN THE BIN</h2>
          </div>
          <AppLink className="text-link" href="/dumpster" navigate={navigate}>
            ALL LAUNCHES →
          </AppLink>
        </header>
        <div className="snapshot-grid">
          <AppLink
            className="latest-file"
            href={`/bag/${latest.id}`}
            navigate={navigate}
          >
            <CaseTab>LATEST INDEXED BAG</CaseTab>
            <strong>${latest.symbol}</strong>
            <small>{latest.name}</small>
            <div>
              <span>REPORTED CREATOR</span>
              <code>{short(latest.reportedCreatorAddress)}</code>
            </div>
            <div>
              <span>PRIOR BAGS</span>
              <b>
                {latest.trashTrail.priorLaunchCount.toString().padStart(2, "0")}
              </b>
            </div>
            <span className="open-cue">OPEN DOSSIER ↗</span>
          </AppLink>
          <div className="radar-tease">
            <CaseTab tone="orange">RAT RADAR / RECURRENCE</CaseTab>
            <p>
              <b>{radar.candidates[0].distinctLaunchCount}</b> distinct launches
              share the top observed recipient address in this demo index.
            </p>
            <RecurrenceMarks count={radar.candidates[0].distinctLaunchCount} />
            <AppLink className="text-link" href="/radar" navigate={navigate}>
              OPEN THE EVIDENCE FILE →
            </AppLink>
          </div>
          <Receipt title="PUBLIC PROOF" count={latest.evidence.length}>
            <p>
              Launch receipt fixed to block <b>{latest.blockNumber}</b>.
            </p>
            <p>
              Creator history:{" "}
              <CoverageStamp state={latest.trashTrail.coverage} />
            </p>
            <code>{feed.receipt.receiptId}</code>
          </Receipt>
        </div>
      </section>
    </div>
  );
}

function Dumpster({
  feed,
  navigate,
}: {
  feed: PublicFeed;
  navigate: (path: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [repeatsOnly, setRepeatsOnly] = useState(false);
  const visible = feed.bags.filter(
    (bag) =>
      `${bag.symbol} ${bag.name} ${bag.token} ${bag.reportedCreatorAddress}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!repeatsOnly || bag.trashTrail.priorLaunchCount > 0),
  );
  return (
    <div className="page-pad">
      <PageHeading
        index="01"
        eyebrow="LAUNCH DISCOVERY"
        title="THE DUMPSTER"
        detail="Scan what just launched. Open a bag. Follow the reported creator history."
      />
      <div className="feed-tools">
        <label>
          <span>SEARCH THE BIN</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="TOKEN / ADDRESS"
          />
        </label>
        <button
          aria-pressed={repeatsOnly}
          onClick={() => setRepeatsOnly((value) => !value)}
        >
          REPEAT CREATOR{" "}
          <b>
            {feed.bags.filter((bag) => bag.trashTrail.priorLaunchCount).length}
          </b>
        </button>
        <span>NEWEST FIRST ↓</span>
      </div>
      <div className="launch-table" role="list">
        <div className="table-head">
          <span>BLOCK</span>
          <span>TOKEN</span>
          <span>ARCPAD-REPORTED CREATOR</span>
          <span>PRIOR</span>
          <span>EVIDENCE</span>
          <span />
        </div>
        {visible.map((bag) => (
          <AppLink
            className="launch-row"
            key={bag.id}
            href={`/bag/${bag.id}`}
            navigate={navigate}
          >
            <span data-label="BLOCK">
              <small>BLK</small>
              {bag.blockNumber}
            </span>
            <span className="token-cell" data-label="TOKEN">
              <b>${bag.symbol}</b>
              <small>{bag.name}</small>
            </span>
            <code data-label="REPORTED CREATOR">
              {short(bag.reportedCreatorAddress)}
            </code>
            <strong data-label="PRIOR BAGS">
              {String(bag.trashTrail.priorLaunchCount).padStart(2, "0")}
            </strong>
            <span data-label="EVIDENCE">
              <CoverageStamp state={bag.trashTrail.coverage} />
            </span>
            <span className="open-cue">OPEN FILE ↗</span>
          </AppLink>
        ))}
      </div>
      {!visible.length && (
        <EmptyState
          title="NOTHING IN THIS BAG."
          detail="No indexed launch matches the current filter."
        />
      )}
    </div>
  );
}

type ReplayState = "COMPLETE" | "PARTIAL" | "UNVERIFIED" | "MISSING";
function BagDossier({
  bag,
  navigate,
}: {
  bag: Bag;
  navigate: (path: string) => void;
}) {
  const [stage, setStage] = useState("LAUNCH");
  const [watching, setWatching] = useState(false);
  const stageData: Record<
    string,
    { state: ReplayState; note: string; value: string }
  > = {
    LAUNCH: {
      state: "COMPLETE",
      note: "Launch event, token, pool and reported creator fixed to the source receipt. Later evidence is sealed out.",
      value: `BLOCK ${bag.blockNumber}`,
    },
    "5m": {
      state: "COMPLETE",
      note: "Frozen five-minute observation exists. Only launch and +5m evidence is exposed in this file.",
      value: "OBSERVED +5m",
    },
    "1h": {
      state: "PARTIAL",
      note: "Pool and creator-balance reads exist; one external field was unavailable at this horizon.",
      value: "OBSERVED +1h",
    },
    "24h": {
      state: "MISSING",
      note: "No matured observation exists in this demo bundle. Verification remains UNVERIFIED; no future fact is substituted.",
      value: "NO RECEIPT",
    },
  };
  return (
    <div className="page-pad bag-page">
      <AppLink className="back-link" href="/dumpster" navigate={navigate}>
        ← BACK TO DUMPSTER
      </AppLink>
      <div className="case-header">
        <div>
          <CaseTab tone="orange">
            BAG DOSSIER / CASE {bag.blockNumber.slice(-4)}
          </CaseTab>
          <h1>
            ${bag.symbol}
            <small>{bag.name}</small>
          </h1>
        </div>
        <div className="case-actions">
          <WatchControl
            armed={watching}
            onClick={() => setWatching((value) => !value)}
            subject="CREATOR"
          />
          <a className="action primary" href="#replay">
            OPEN REPLAY ↓
          </a>
        </div>
      </div>
      <CheckpointRail
        checkpoint={bag.blockNumber}
        coverage={bag.trashTrail.coverage}
        receiptId={`binrat-bag:${bag.id}`}
      />
      <div className="case-grid">
        <section className="case-sheet">
          <CaseTab>EXACT LAUNCH RECEIPT</CaseTab>
          <dl className="facts">
            <div>
              <dt>TOKEN CONTRACT</dt>
              <dd>
                <code>{bag.token}</code>
              </dd>
            </div>
            <div>
              <dt>LAUNCH BLOCK</dt>
              <dd>{bag.blockNumber}</dd>
            </div>
            <div>
              <dt>TRANSACTION HASH</dt>
              <dd>
                <code>{bag.txHash}</code>
              </dd>
            </div>
            <div>
              <dt>RECEIPT AUTHORITY</dt>
              <dd>ARCPAD SOURCE / ARC 5042</dd>
            </div>
          </dl>
          <h2>EVIDENCE STACK</h2>
          <div className="evidence-stack">
            {bag.evidence.map((item) => (
              <div key={item.text}>
                <Evidence state={item.state} />
                <p>{item.text}</p>
              </div>
            ))}
          </div>
          <Receipt title="BAG RECEIPT">
            <code>binrat-bag:{bag.id}</code>
          </Receipt>
        </section>
        <aside className="creator-file">
          <CaseTab tone="orange">CREATOR FILE / SOURCE-REPORTED</CaseTab>
          <h2>REPORTED CREATOR ADDRESS</h2>
          <code className="full-address">{bag.reportedCreatorAddress}</code>
          <div className="creator-count">
            <b>{bag.trashTrail.priorLaunchCount + 1}</b>
            <span>
              INDEXED LAUNCHES
              <br />
              INCLUDING THIS BAG
            </span>
          </div>
          <h3>TRASH TRAIL / OLDEST → CURRENT</h3>
          <ol className="trail-list">
            {[...bag.trashTrail.prior].reverse().map((prior, index) => (
              <li key={prior.id}>
                <i />
                <span>
                  ${prior.symbol}
                  <small>BLK {prior.blockNumber}</small>
                </span>
                <b>0{index + 1}</b>
              </li>
            ))}
            <li className="current">
              <i />
              <span>
                ${bag.symbol}
                <small>BLK {bag.blockNumber}</small>
              </span>
              <b>CURRENT</b>
            </li>
            {!bag.trashTrail.prior.length && (
              <p>No earlier launch in current index coverage.</p>
            )}
          </ol>
          <ProofBoundary>
            ArcPad-reported address equality only. No human identity or
            common-control claim.
          </ProofBoundary>
        </aside>
      </div>
      <section className="replay-lab" id="replay" tabIndex={-1}>
        <header>
          <div>
            <CaseTab tone="red">REPLAY / FROZEN EVIDENCE</CaseTab>
            <h2>WHAT WAS KNOWABLE, WHEN?</h2>
          </div>
          <CoverageStamp state={stageData[stage].state} />
        </header>
        <div
          className="replay-strip"
          role="tablist"
          aria-label="Frozen observation horizon"
        >
          {Object.entries(stageData).map(([label, data], index) => (
            <button
              role="tab"
              aria-selected={stage === label}
              aria-controls="replay-readout"
              onClick={() => setStage(label)}
              key={label}
            >
              <span>0{index + 1}</span>
              <b>{label}</b>
              <CoverageStamp state={data.state} />
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
        <div
          className="replay-readout"
          id="replay-readout"
          role="tabpanel"
          aria-live="polite"
        >
          <span>CASE AT {stage}</span>
          <b>{stageData[stage].value}</b>
          <p>{stageData[stage].note}</p>
        </div>
        <ProofBoundary>
          Each horizon redraws the file from evidence available at that moment.
          Future observations never fill earlier gaps.
        </ProofBoundary>
      </section>
    </div>
  );
}

function RatPresence({ state, label }: { state: RatState; label: string }) {
  return (
    <figure className="rat-presence" data-rat-state={state}>
      <img
        src={`${import.meta.env.BASE_URL}binrat-hero.webp`}
        alt="BINRAT, the approved cyber-eyed dumpster rat mascot"
      />
      <div className="rat-overlay" aria-hidden="true">
        <span>SUBJECT / BINRAT</span>
        <span>ARC / 5042</span>
        <span>RECORDER ACTIVE</span>
      </div>
      <figcaption>
        <span>{label}</span>
        <b>STATE / {state.toUpperCase()}</b>
      </figcaption>
    </figure>
  );
}
function Placeholder({
  name,
  navigate,
}: {
  name: string;
  navigate: (path: string) => void;
}) {
  return (
    <div className="page-pad">
      <EmptyState
        title={`${name} / ARCHITECTURE PLACEHOLDER`}
        detail="This destination is defined in Product Surface V1 and intentionally remains outside this visual-direction candidate."
      />
      <AppLink
        className="action primary centered"
        href="/dumpster"
        navigate={navigate}
      >
        CONTINUE TO DUMPSTER →
      </AppLink>
    </div>
  );
}
function PageHeading({
  index,
  eyebrow,
  title,
  detail,
}: {
  index: string;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">
          {index} / {eyebrow}
        </p>
        <h1>
          {title}
          <em>.</em>
        </h1>
      </div>
      <p>{detail}</p>
    </header>
  );
}
function Evidence({ state }: { state: EvidenceState }) {
  return (
    <b className={`semantic evidence ${state.toLowerCase()}`}>
      <span aria-hidden="true" />
      {state}
    </b>
  );
}
function Loading() {
  return (
    <div className="loading">
      <span />
      <p>RAT IS CHECKING THE RECEIPTS…</p>
    </div>
  );
}
function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <span>×</span>
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}
function short(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}
