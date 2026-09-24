import { useEffect, useState, type KeyboardEvent } from "react";
import { MobileBag, MobileDiscover, MobileMore, MobileRadar, MobileSaved, MobileShell, useMobileBookmarks } from "./mobile/MobileExperience";
import { bagIdFromPath, findBagAtCheckpoint, radarShortlistCounts, REPLAY_HORIZONS, replayStagesForBag, type ReplayHorizon, type ReplayStage } from "./evidenceIntegrity";
import { loadProductData, loadLiveReplayBundle, selectedDataMode, type DataMode } from "./data";
import type { LiveReplayBundle } from "./liveAdapter";
import { addressFromRoute, selectRadarCandidate } from "./routeIdentity";
import { RecipientActivityPanel } from "./RecipientActivityPanel";
import { CreatorFilePage, MethodPage, ReplayIndexPage, WatchPage, LedgerPage, TokenStatusPage } from "./RoutePages";
import type {
  Bag,
  EvidenceState,
  PublicFeed,
  RadarCandidate,
  RadarWatchlist,
  RatState,
} from "./types";
import {
  AppLink,
  CaseTab,
  CheckpointRail,
  CopyButton,
  CoverageStamp,
  ProofBoundary,
  Receipt,
  RecurrenceMarks,
  WatchControl,
} from "./Primitives";

type Route =
  | { page: "home" }
  | { page: "dumpster" }
  | { page: "saved" }
  | { page: "more" }
  | { page: "radar"; address?: string }
  | { page: "creator"; address: string }
  | { page: "method" }
  | { page: "replay" }
  | { page: "watch" }
  | { page: "ledger" }
  | { page: "binrat" }
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
  if (path === "/" || path === "/index.html") return { page: "home" };
  if (path === "/saved") return { page: "saved" };
  if (path === "/more") return { page: "more" };
  if (path === "/dumpster") return { page: "dumpster" };
  const radarAddress = addressFromRoute(path, "/radar/address/");
  if (radarAddress !== null) return { page: "radar", address: radarAddress };
  if (path === "/radar") return { page: "radar" };
  const creatorAddress = addressFromRoute(path, "/creator/");
  if (creatorAddress !== null) return { page: "creator", address: creatorAddress };
  if (path === "/method") return { page: "method" };
  if (path === "/replay") return { page: "replay" };
  if (path === "/watch") return { page: "watch" };
  if (path === "/ledger") return { page: "ledger" };
  if (path === "/binrat") return { page: "binrat" };
  if (path.startsWith("/bag/"))
    return { page: "bag", id: bagIdFromPath(path) };
  return { page: "placeholder", name: path.slice(1).toUpperCase() || "HOME" };
}

function useCompactViewport() {
  const [compact, setCompact] = useState(() => window.matchMedia("(max-width: 720px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 720px)");
    const onChange = () => setCompact(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return compact;
}

export default function App() {
  const compact = useCompactViewport();
  const bookmarks = useMobileBookmarks();
  const [route, setRoute] = useState<Route>(readRoute);
  const [feed, setFeed] = useState<PublicFeed | null>(null);
  const [radar, setRadar] = useState<RadarWatchlist | null>(null);
  const [mode, setMode] = useState<DataMode>(selectedDataMode);
  const [loaded, setLoaded] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [radarError, setRadarError] = useState<string | null>(null);
  useEffect(() => {
    loadProductData()
      .then((data) => {
        setFeed(data.feed);
        setRadar(data.radar);
        setMode(data.mode);
        setFeedError(data.feedError);
        setRadarError(data.radarError);
        setLoaded(true);
      })
      .catch((reason: unknown) => {
        // Unexpected transport/setup failure remains visible in both scopes.
        const message = reason instanceof Error ? reason.message : "DATA_UNAVAILABLE";
        setFeedError(message);
        setRadarError(message);
        setLoaded(true);
      });
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
  const requestedBag = feed && route.page === "bag"
    ? findBagAtCheckpoint(feed, route.id)
    : undefined;
  const unavailable = (scope: string, code: string | null) => (
    <section className="page-pad" role="alert">
      <EmptyState title={scope + " UNAVAILABLE."}
        detail={(code ?? "NO VALIDATED PUBLIC DATA") + ". No LIVE/DEMO substitution was made."} />
    </section>
  );
  const content = !loaded ? (
    <Loading />
  ) : route.page === "home" ? (
    <Home feed={feed} radar={radar} feedError={feedError} radarError={radarError} mode={mode} navigate={navigate} />
  ) : route.page === "radar" ? (
    <Radar radar={radar} radarError={radarError} mode={mode} selectedAddress={route.address} navigate={navigate} />
  ) : route.page === "method" ? (
    <MethodPage navigate={navigate} />
  ) : route.page === "watch" ? (
    <WatchPage navigate={navigate} mode={mode} />
  ) : route.page === "ledger" ? (
    <LedgerPage mode={mode} />
  ) : route.page === "binrat" ? (
    <TokenStatusPage />
  ) : route.page === "more" ? (
    <MobileMore mode={mode} navigate={navigate} />
  ) : route.page === "saved" ? (
    <MobileSaved feed={feed} radar={radar} mode={mode} bookmarks={bookmarks} navigate={navigate} />
  ) : !feed ? (
    unavailable("FEED", feedError)
  ) : route.page === "dumpster" ? (
    <Dumpster feed={feed} navigate={navigate} />
  ) : route.page === "creator" ? (
    <CreatorFilePage feed={feed} key={route.address.toLowerCase()} address={route.address} mode={mode} navigate={navigate} />
  ) : route.page === "replay" ? (
    <ReplayIndexPage feed={feed} mode={mode} navigate={navigate} />
  ) : route.page === "bag" ? (
    requestedBag ? (
      <BagDossier key={requestedBag.id} bag={requestedBag} mode={mode} navigate={navigate} />
    ) : (
      <section className="page-pad">
        <EmptyState title="NO MATCHING BAG IN THIS INDEX."
          detail={"No bag matches this exact identifier at checkpoint " + feed.asOfBlock + ". Nothing else was substituted."} />
        <CheckpointRail checkpoint={feed.asOfBlock} coverage={feed.historyCoverage} />
        <AppLink className="action" href="/dumpster" navigate={navigate}>BACK TO THE DUMPSTER →</AppLink>
      </section>
    )
  ) : (
    <Placeholder name={route.name} navigate={navigate} />
  );
  const mobileContent = !loaded ? (
    <div className="loading" role="status"><span /><p>RAT IS CHECKING THE RECEIPTS…</p></div>
  ) : route.page === "home" ? (
    <Home feed={feed} radar={radar} feedError={feedError} radarError={radarError} mode={mode} navigate={navigate} />
  ) : route.page === "dumpster" ? (
    feed ? <MobileDiscover feed={feed} radar={radar} mode={mode} bookmarks={bookmarks} navigate={navigate} />
      : unavailable("FEED", feedError)
  ) : route.page === "radar" ? (
    radar ? <MobileRadar radar={radar} selectedAddress={route.address} mode={mode} bookmarks={bookmarks} navigate={navigate} />
      : <Radar radar={null} radarError={radarError} mode={mode} selectedAddress={route.address} navigate={navigate} />
  ) : route.page === "bag" && requestedBag ? (
    <MobileBag key={requestedBag.id} bag={requestedBag} mode={mode} bookmarks={bookmarks} navigate={navigate} />
  ) : route.page === "saved" ? (
    <MobileSaved feed={feed} radar={radar} mode={mode} bookmarks={bookmarks} navigate={navigate} />
  ) : route.page === "more" ? (
    <MobileMore mode={mode} navigate={navigate} />
  ) : content;
  return compact ? (
    <div className="app-frame">
      <a className="skip-link" href="#content">Skip to evidence</a>
      <MobileShell page={route.page} mode={mode} checkpoint={route.page === "radar" ? radar?.asOfBlock ?? null : feed?.asOfBlock ?? null} navigate={navigate}>
        {mobileContent}
      </MobileShell>
    </div>
  ) : (
    <div className="app-frame">
      <a className="skip-link" href="#content">
        Skip to evidence
      </a>
      <ShellNav route={route} navigate={navigate} />
      <div className="workspace">
        <StatusRail mode={mode} feed={feed} navigate={navigate} />
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
  const current = (route.page === "bag" || route.page === "creator") ? "DUMPSTER" : route.page.toUpperCase();
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
  navigate,
}: {
  mode: DataMode;
  feed: PublicFeed | null;
  navigate: (path: string) => void;
}) {
  return (
    <header className="status-rail">
      <AppLink className="mobile-brand" href="/" navigate={navigate} ariaLabel="BINRAT home">BINRAT <span aria-hidden="true">↗</span></AppLink>
      <span className="status-cluster">
        <i />
        {feed ? (mode === "DEMO" ? "DEMO INDEX READY" : "PUBLIC INDEX READY") : "INDEXING"}
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
  feedError,
  radarError,
  mode,
  navigate,
}: {
  feed: PublicFeed | null;
  radar: RadarWatchlist | null;
  feedError: string | null;
  radarError: string | null;
  mode: DataMode;
  navigate: (path: string) => void;
}) {
  const latest = feed?.bags[0];
  const topRecipient = radar?.candidates[0];
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
              href="/radar"
              navigate={navigate}
            >
              OPEN RAT RADAR <span>↗</span>
            </AppLink>
            <AppLink className="action" href="/dumpster" navigate={navigate}>
              ENTER THE DUMPSTER
            </AppLink>
          </div>
          <p className="claim-line">
            NO SCORE. NO BUY CALL. NO HUMAN IDENTITY INFERENCE.
          </p>
          <div
            className="hero-fragments"
            aria-label="Current evidence mode and coverage"
          >
            <span>
              CHECKPOINT
              <br />
              <b>{feed?.asOfBlock ?? "UNAVAILABLE"}</b>
            </span>
            <span>
              HISTORY
              <br />
              <CoverageStamp state={feed?.historyCoverage ?? "UNVERIFIED"} />
            </span>
            <span>
              DATA MODE
              <br />
              <b>{mode === "DEMO" ? "DEMO / DETERMINISTIC" : "PUBLIC LIVE"}</b>
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
          {!feed && <p role="alert">PUBLIC FEED UNAVAILABLE: {feedError ?? "NO VALIDATED FEED"}. Nothing substituted.</p>}
          {!radar && <p role="alert">RAT RADAR UNAVAILABLE: {radarError ?? "NO VALIDATED SHORTLIST"}. Nothing substituted.</p>}
          {latest ? (
            <AppLink className="latest-file" href={"/bag/" + latest.id} navigate={navigate}>
              <CaseTab>LATEST INDEXED BAG</CaseTab>
              <strong>{"$" + latest.symbol}</strong>
              <small>{latest.name}</small>
              <div>
                <span>REPORTED CREATOR</span>
                <code>{short(latest.reportedCreatorAddress)}</code>
              </div>
              <div>
                <span>PRIOR BAGS</span>
                <b>{latest.trashTrail.priorLaunchCount.toString().padStart(2, "0")}</b>
              </div>
              <span className="open-cue">OPEN DOSSIER ↗</span>
            </AppLink>
          ) : (
            <EmptyState title="NO BAGS AT THIS CHECKPOINT." detail="No indexed launches are currently available. No example launch is substituted." />
          )}
          {topRecipient ? (
            <div className="radar-tease">
              <CaseTab tone="orange">RAT RADAR / RECURRENCE</CaseTab>
              <p>
                <b>{topRecipient.distinctLaunchCount}</b> distinct indexed launches
                share the leading observed recipient address in {mode === "DEMO" ? "this synthetic demo." : "the current public shortlist."}
              </p>
              <RecurrenceMarks count={topRecipient.distinctLaunchCount} />
              <AppLink className="text-link" href={"/radar/address/" + topRecipient.observedRecipientAddress} navigate={navigate}>
                OPEN THE EVIDENCE FILE →
              </AppLink>
            </div>
          ) : (
            <EmptyState title="NO RADAR SHORTLIST YET." detail="No ranked recipient address is present at this checkpoint." />
          )}
          {latest ? (
            <Receipt title={mode === "DEMO" ? "DEMO INDEX RECEIPT / NOT CHAIN PROOF" : "PUBLIC FEED RECEIPT"} count={latest.evidence.length}>
              <p>Launch record at block <b>{latest.blockNumber}</b>.</p>
              <p>Creator history: <CoverageStamp state={latest.trashTrail.coverage} /></p>
              <code>{feed?.receipt.receiptId}</code>
            </Receipt>
          ) : (
            <Receipt title="NO INDEX RECEIPT AVAILABLE">
              <p>Nothing has been substituted for missing feed evidence.</p>
            </Receipt>
          )}
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

function Radar({ radar, radarError, mode, selectedAddress, navigate }: {
  radar: RadarWatchlist | null; radarError: string | null; mode: DataMode;
  selectedAddress?: string; navigate: (path: string) => void;
}) {
  if (!radar) {
    return <div className="page-pad radar-page" role="alert">
      <PageHeading index="02" eyebrow="OBSERVED RECURRENCE / TIMING" title="RAT RADAR"
        detail="The shortlist endpoint is independent from the Feed."/>
      <EmptyState title="RAT RADAR UNAVAILABLE." detail={(radarError ?? "NO VALIDATED SHORTLIST") +
        ". No candidates or rankings were substituted."} />
      {selectedAddress && /^0x[0-9a-f]{40}$/i.test(selectedAddress) &&
        <div className="ns-standalone"><RecipientActivityPanel key={selectedAddress} address={selectedAddress} mode={mode}/></div>}
    </div>;
  }
  const selected = selectRadarCandidate(radar, selectedAddress);
  const counts = radarShortlistCounts(radar);
  if (!selected) {
    return (
      <div className="page-pad radar-page">
        <PageHeading index="02" eyebrow="OBSERVED RECURRENCE / TIMING" title="RAT RADAR" detail="Inspectable observed recipient recurrence, subject to indexed coverage." />
        <p className="radar-sample-note">{counts.displayed} DISPLAYED / {counts.ranked} RANKED / {counts.observed} OBSERVED ADDRESSES.</p>
        <CheckpointRail checkpoint={radar.asOfBlock} coverage={radar.coverage.historyCoverage} />
        <EmptyState title={selectedAddress === undefined ? "NO RADAR FILE IN THIS INDEX." : "ADDRESS OUTSIDE PUBLIC SHORTLIST."} detail="No shortlist rank is assigned to this address. Valid direct links independently request public recipient activity." />
        {selectedAddress && /^0x[0-9a-f]{40}$/i.test(selectedAddress) &&
          <div className="ns-standalone"><RecipientActivityPanel key={selectedAddress} address={selectedAddress} mode={mode} shortlistCheckpoint={radar.asOfBlock}/></div>}
      </div>
    );
  }
  return (
    <div className="page-pad radar-page">
      <PageHeading
        index="02"
        eyebrow="OBSERVED RECURRENCE / TIMING"
        title="RAT RADAR"
        detail="Recurring observed recipient addresses worth inspecting because their evidence is unusual—not because BINRAT recommends buying anything."
      />
      <div className="radar-method">
        <div>
          <span>INDEXED LAUNCHES</span>
          <b>{radar.coverage.indexedLaunchCount}</b>
        </div>
        <div>
          <span>ACQUISITION RECEIPTS</span>
          <b>{radar.coverage.acquisitionReceiptCount}</b>
        </div>
        <div>
          <span>OBSERVED ADDRESSES</span>
          <b>{radar.coverage.distinctRecipientAddressCount}</b>
        </div>
        <div>
          <span>COVERAGE</span>
          <CoverageStamp state={radar.coverage.historyCoverage} />
        </div>
      </div>
      <p className="radar-sample-note">PUBLIC SHORTLIST: {counts.displayed} DISPLAYED / {counts.ranked} RANKED / {counts.observed} OBSERVED ADDRESSES. RANK IS INSPECTION ORDER, NOT A RECOMMENDATION.</p>
      <AppLink href="/method" navigate={navigate} className="text-link">HOW RANKING AND EVIDENCE WORK ↗</AppLink>
      <p className="sr-only" role="status">FILE {selected.rank} OPEN. {selected.distinctLaunchCount} DISTINCT INDEXED LAUNCHES; {selected.acquisitionReceiptCount} ACQUISITION RECEIPTS.</p>
      <div className="radar-workbench">
        <section className="radar-list" aria-label="Ranked observed addresses">
          <div className="radar-head">
            <span>ORDER / ADDRESS</span>
            <span>LAUNCH SCARS</span>
            <span>FIRST ENTRY</span>
            <span>RECEIPTS</span>
          </div>
          {radar.candidates.map((candidate) => (
            <AppLink
              className={selected.rank === candidate.rank ? "radar-row selected" : "radar-row"}
              key={candidate.observedRecipientAddress}
              href={"/radar/address/" + candidate.observedRecipientAddress}
              navigate={navigate}
              ariaLabel={"Open observed-recipient evidence file for " + candidate.observedRecipientAddress}
              ariaCurrent={selected.rank === candidate.rank ? "page" : undefined}
            >
              <span className="rank-address">
                <b>{String(candidate.rank).padStart(2, "0")}</b>
                <code>{short(candidate.observedRecipientAddress)}</code>
              </span>
              <span className="recurrence">
                <b>{candidate.distinctLaunchCount}</b>
                <RecurrenceMarks
                  count={candidate.distinctLaunchCount}
                  compact
                />
              </span>
              <span>
                <b>+{candidate.medianFirstEntryBlockDelta}</b>
                <small>MEDIAN BLOCKS</small>
              </span>
              <span>
                <b>{candidate.acquisitionReceiptCount}</b>
                <small>OBSERVED</small>
              </span>
            </AppLink>
          ))}
        </section>
        <EvidenceDossier
          key={selected.observedRecipientAddress}
          candidate={selected}
          mode={mode}
          coverage={radar.coverage.historyCoverage}
          checkpoint={radar.asOfBlock}
        />
      </div>
      <ProofBoundary>
        {radar.method.identityBoundary} {radar.method.recommendationBoundary}
      </ProofBoundary>
    </div>
  );
}

function EvidenceDossier({
  candidate,
  mode,
  coverage,
  checkpoint,
}: {
  candidate: RadarCandidate;
  mode: DataMode;
  coverage: RadarWatchlist["coverage"]["historyCoverage"];
  checkpoint: string;
}) {
  const [watching, setWatching] = useState(false);
  return (
    <aside className="evidence-dossier">
      <CaseTab tone="orange">
        OPEN FILE / INSPECTION ORDER {String(candidate.rank).padStart(2, "0")}
      </CaseTab>
      <h2>{short(candidate.observedRecipientAddress)}</h2>
      <div className="copyable-value"><code className="full-address">{candidate.observedRecipientAddress}</code><CopyButton label="observed recipient address" value={candidate.observedRecipientAddress} /><CopyButton label="address dossier link" value={window.location.origin + appBase() + "/radar/address/" + candidate.observedRecipientAddress + window.location.search} /></div>
      <div className="dossier-recurrence">
        <span>DISTINCT LAUNCH RECURRENCE</span>
        <b>{candidate.distinctLaunchCount}</b>
        <RecurrenceMarks count={candidate.distinctLaunchCount} />
      </div>
      <div className="dossier-stamp">
        <span>OBSERVED ROLE — NOT CREATOR IDENTITY</span>
        <b>V3_SWAP_RECIPIENT</b>
      </div>
      {mode === "DEMO" ? (
        <WatchControl
          armed={watching}
          onClick={() => setWatching((value) => !value)}
          subject="ADDRESS"
        />
      ) : (
        <p className="route-note" role="status">
          LIVE RADAR RECIPIENT WATCH NOT AVAILABLE. Telegram Rat currently accepts
          source-reported creator addresses only. This observed recipient is a
          separate protocol role; no subscription has been created.
        </p>
      )}
      <div className="reason-list">
        {candidate.reasons.map((reason, index) => (
          <p key={reason}>
            <span>0{index + 1}</span>
            {reason}
          </p>
        ))}
      </div>
      <RecipientActivityPanel address={candidate.observedRecipientAddress} mode={mode} shortlistCheckpoint={checkpoint} />
      <Receipt
        title="ACQUISITION RECEIPTS"
        count={candidate.acquisitionReceiptCount}
      >
        <small className="demo-proof-note">{mode === "DEMO" ? "DEMO ACTIVITY IDS — SYNTHETIC; NOT CHAIN RECEIPTS" : "OBSERVED ACTIVITY IDS — PUBLIC ACTIVITY JSON IS AVAILABLE FOR VALID IDS"}</small>
        {candidate.evidenceActivityIds.map((id) => (
          <div className="copyable-value" key={id}>
            <code>{id}</code>
            <CopyButton label="activity identifier" value={id} />
            {mode === "LIVE" && /^[0-9a-f]{64}$/i.test(id) &&
              <a className="source-link" href={"/api/rat-radar/activity/" + id} target="_blank" rel="noopener noreferrer">PUBLIC ACTIVITY JSON ↗</a>}
          </div>
        ))}
      </Receipt>
      <CheckpointRail checkpoint={checkpoint} coverage={coverage} />
      <small className="identity-note">
        Address role only. Human identity is not inferred.
      </small>
    </aside>
  );
}

function BagDossier({
  bag,
  mode,
  navigate,
}: {
  bag: Bag;
  mode: DataMode;
  navigate: (path: string) => void;
}) {
  const [stage, setStage] = useState<ReplayHorizon>("LAUNCH");
  const [watching, setWatching] = useState(false);
  const [liveReplay, setLiveReplay] = useState<LiveReplayBundle | null>(null);
  const [replayError, setReplayError] = useState("");
  useEffect(() => {
    if (mode !== "LIVE") return;
    let active = true;
    setLiveReplay(null);
    setReplayError("");
    loadLiveReplayBundle(bag.id)
      .then((result) => { if (active) setLiveReplay(result); })
      .catch((reason: unknown) => {
        if (active) setReplayError(reason instanceof Error ? reason.message : "REPLAY_BUNDLE_UNAVAILABLE");
      });
    return () => { active = false; };
  }, [bag.id, mode]);
  const onReplayKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const labels = REPLAY_HORIZONS;
    const current = labels.indexOf(stage);
    let target = current;
    if (event.key === "ArrowRight") target = (current + 1) % labels.length;
    else if (event.key === "ArrowLeft") target = (current - 1 + labels.length) % labels.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = labels.length - 1;
    else return;
    event.preventDefault();
    setStage(labels[target]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
  };
  // DEMO can use authored fixtures. LIVE can only show separately validated
  // canonical Replay stages; even LAUNCH remains unavailable while loading.
  const unavailable = (): ReplayStage => ({
    state: "MISSING",
    value: "NO VALIDATED REPLAY STAGE",
    note: "No independently validated Replay bundle is loaded for this exact bag.",
  });
  const stageData: Record<ReplayHorizon, ReplayStage> = mode === "DEMO"
    ? replayStagesForBag(bag, mode)
    : liveReplay?.stages ?? { LAUNCH: unavailable(), "5m": unavailable(), "1h": unavailable(), "24h": unavailable() };
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
          {mode === "DEMO" ? (
            <WatchControl
              armed={watching}
              onClick={() => setWatching((value) => !value)}
              subject="CREATOR"
            />
          ) : (
            <div className="route-actions">
              <span>TELEGRAM RAT / SOURCE-REPORTED CREATOR</span>
              <CopyButton label="Telegram creator watch command" value={"/watch " + bag.reportedCreatorAddress} />
              <a href="https://t.me/BinratBot" target="_blank" rel="noopener noreferrer" className="action">OPEN TELEGRAM RAT ↗</a>
              <small>Paste the copied command in Telegram and confirm the bot receipt. No subscription was created here.</small>
            </div>
          )}
          <a className="action primary" href="#replay">
            OPEN REPLAY ↓
          </a>
        </div>
      </div>
      <CheckpointRail checkpoint={bag.blockNumber} coverage={bag.trashTrail.coverage} />
      <div className="case-grid">
        <section className="case-sheet">
          <CaseTab>EXACT LAUNCH RECEIPT</CaseTab>
          <dl className="facts">
            <div>
              <dt>TOKEN CONTRACT</dt>
              <dd>
                <div className="copyable-value"><code>{bag.token}</code><CopyButton label="token contract address" value={bag.token} /></div>
              </dd>
            </div>
            <div>
              <dt>LAUNCH BLOCK</dt>
              <dd>{bag.blockNumber}</dd>
            </div>
            <div>
              <dt>TRANSACTION HASH</dt>
              <dd>
                <div className="copyable-value"><code>{bag.txHash}</code><CopyButton label="launch transaction hash" value={bag.txHash} /></div>
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
          <Receipt title={mode === "DEMO" ? "DEMO BAG FILE / NOT CHAIN PROOF" : "BAG FILE ID / NOT AUTHORITY RECEIPT"}>
            <div className="copyable-value"><code>{bag.id}</code><CopyButton label="bag file ID" value={bag.id} /></div>
          </Receipt>
        </section>
        <aside className="creator-file">
          <CaseTab tone="orange">CREATOR FILE / SOURCE-REPORTED</CaseTab>
          <h2>REPORTED CREATOR ADDRESS</h2>
          <div className="copyable-value"><code className="full-address">{bag.reportedCreatorAddress}</code><CopyButton label="reported creator address" value={bag.reportedCreatorAddress} /></div>
          <AppLink className="text-link" href={"/creator/" + bag.reportedCreatorAddress} navigate={navigate}>OPEN SHAREABLE CREATOR FILE ↗</AppLink>
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
          {REPLAY_HORIZONS.map((label, index) => (
            <button
              role="tab"
              aria-selected={stage === label}
              aria-controls="replay-readout"
              id={`replay-tab-${index}`}
              tabIndex={stage === label ? 0 : -1}
              onKeyDown={onReplayKeyDown}
              onClick={() => setStage(label)}
              key={label}
            >
              <span>0{index + 1}</span>
              <b>{label}</b>
              <CoverageStamp state={stageData[label].state} />
              <i aria-hidden="true" />
            </button>
          ))}
        </div>
        <div
          className="replay-readout"
          id="replay-readout"
          role="tabpanel"
          aria-labelledby={`replay-tab-${REPLAY_HORIZONS.indexOf(stage)}`}
          tabIndex={0}
          aria-live="polite"
        >
          <span>CASE AT {stage}</span>
          <b>{stageData[stage].value}</b>
          <p>{stageData[stage].note}</p>
        </div>
        {mode === "LIVE" && (
          <div className="replay-proof-meta">
            {replayError ? (
              <p role="alert">REPLAY UNAVAILABLE / {replayError}. No stages from the feed or demo have been substituted.</p>
            ) : !liveReplay ? (
              <p role="status">LOADING SEPARATELY CHECKPOINTED LIVE REPLAY…</p>
            ) : (
              <>
                <CheckpointRail
                  checkpoint={liveReplay.asOfBlock}
                  coverage={liveReplay.historyCoverage}
                  receiptId={liveReplay.receipt.receiptId}
                />
                <p>OBSERVATION COVERAGE / <CoverageStamp state={liveReplay.observationCoverage} /> · RECEIPT AUTHORITY / {liveReplay.receipt.sourcePublicReceiptId}</p>
                <small>Receipt identifiers and chronology are structurally validated in this browser. Cryptographic projection verification remains the backend's responsibility.</small>
              </>
            )}
          </div>
        )}
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
        src={`${import.meta.env.BASE_URL}binrat-character-master.png`}
        alt="BINRAT, the canonical scruffy charcoal rat with pink ears, segmented tail and red cyber-eye on viewer-right, in the dumpster at sunset"
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
