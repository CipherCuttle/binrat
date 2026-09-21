import { useEffect, useMemo, useState } from 'react';
import { loadProductData, type DataMode } from './data';
import type { Bag, CoverageState, EvidenceState, PublicFeed, RadarCandidate, RadarWatchlist, RatState } from './types';

type Route =
  | { page: 'home' }
  | { page: 'dumpster' }
  | { page: 'radar' }
  | { page: 'bag'; id: string }
  | { page: 'placeholder'; name: string };

const primaryNav = [
  ['DUMPSTER', '/dumpster'],
  ['RADAR', '/radar'],
  ['WATCH', '/watch'],
  ['REPLAY', '/replay'],
  ['LEDGER', '/ledger']
] as const;

function readRoute(): Route {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/') return { page: 'home' };
  if (path === '/dumpster') return { page: 'dumpster' };
  if (path === '/radar') return { page: 'radar' };
  if (path.startsWith('/bag/')) return { page: 'bag', id: decodeURIComponent(path.slice(5)) };
  return { page: 'placeholder', name: path.slice(1).toUpperCase() || 'HOME' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [feed, setFeed] = useState<PublicFeed | null>(null);
  const [radar, setRadar] = useState<RadarWatchlist | null>(null);
  const [mode, setMode] = useState<DataMode>('DEMO');
  const [error, setError] = useState('');

  useEffect(() => {
    loadProductData().then((data) => {
      setFeed(data.feed);
      setRadar(data.radar);
      setMode(data.mode);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'DATA_UNAVAILABLE'));
  }, []);

  useEffect(() => {
    const onPopState = () => setRoute(readRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.querySelector<HTMLElement>('#content')?.focus({ preventScroll: true });
  }, [route]);

  const navigate = (path: string) => {
    if (path !== window.location.pathname) window.history.pushState({}, '', path + window.location.search);
    setRoute(readRoute());
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const content = error
    ? <EmptyState title="THE TRAIL WENT COLD." detail="The public read plane did not return validated evidence. Nothing was synthesized." />
    : !feed || !radar
      ? <Loading />
      : route.page === 'home'
        ? <Home feed={feed} radar={radar} navigate={navigate} />
        : route.page === 'dumpster'
          ? <Dumpster feed={feed} navigate={navigate} />
          : route.page === 'radar'
            ? <Radar radar={radar} />
            : route.page === 'bag'
              ? <BagDossier bag={feed.bags.find((bag) => bag.id === route.id) ?? feed.bags[0]} navigate={navigate} />
              : <Placeholder name={route.name} navigate={navigate} />;

  return (
    <div className="app-frame">
      <a className="skip-link" href="#content">Skip to evidence</a>
      <ShellNav route={route} navigate={navigate} />
      <div className="workspace">
        <StatusRail mode={mode} feed={feed} />
        <main id="content" tabIndex={-1}>{content}</main>
      </div>
    </div>
  );
}

function ShellNav({ route, navigate }: { route: Route; navigate: (path: string) => void }) {
  const current = route.page === 'bag' ? 'DUMPSTER' : route.page.toUpperCase();
  return (
    <aside className="shell-nav">
      <button className="wordmark" onClick={() => navigate('/')} aria-label="BINRAT home">
        <span className="brand-glyph">BR↗</span><span>BINRAT<small>ARC / 5042</small></span>
      </button>
      <nav aria-label="Primary">
        {primaryNav.map(([label, path], index) => (
          <button key={path} className={current === label ? 'active' : ''} onClick={() => navigate(path)}>
            <span>0{index + 1}</span>{label}
          </button>
        ))}
      </nav>
      <button className="token-link" onClick={() => navigate('/binrat')}>
        <span>$BINRAT</span><b>NOT_LAUNCHED</b>
      </button>
      <p className="shell-motto">DEGEN DECIDES ATTENTION.<br /><b>RECEIPTS DECIDE TRUTH.</b></p>
    </aside>
  );
}

function StatusRail({ mode, feed }: { mode: DataMode; feed: PublicFeed | null }) {
  return (
    <header className="status-rail">
      <span className="status-cluster"><i />{feed ? 'INDEX READY' : 'INDEXING'}</span>
      <span>ARC <b>5042</b></span>
      <span className="rail-wide">CHECKPOINT <b>{feed?.asOfBlock ?? '—'}</b></span>
      <span>COVERAGE <Coverage state={feed?.historyCoverage ?? 'UNVERIFIED'} /></span>
      <span className="demo-flag">{mode === 'DEMO' ? 'SCHEMA-MATCHED DEMO' : 'PUBLIC LIVE'}</span>
    </header>
  );
}

function Home({ feed, radar, navigate }: { feed: PublicFeed; radar: RadarWatchlist; navigate: (path: string) => void }) {
  const latest = feed.bags[0];
  return (
    <div className="home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">LAUNCH MEMORY / PUBLIC RECEIPTS</p>
          <h1>THE RAT<br /><em>REMEMBERS.</em></h1>
          <p className="hero-lede">New launches disappear into the noise. BINRAT keeps what was observable—and shows you where to dig next.</p>
          <div className="action-row">
            <button className="action primary" onClick={() => navigate('/dumpster')}>ENTER THE DUMPSTER <span>↗</span></button>
            <button className="action" onClick={() => navigate('/radar')}>OPEN RAT RADAR</button>
          </div>
          <p className="claim-line">NO SCORE. NO BUY CALL. NO HUMAN IDENTITY INFERENCE.</p>
        </div>
        <RatPresence state="idle" label="STATIC FALLBACK / RIVE CONTRACT READY" />
      </section>
      <section className="live-snapshot" aria-labelledby="snapshot-title">
        <header className="section-title">
          <div><span>LIVE SNAPSHOT / 001</span><h2 id="snapshot-title">RIGHT NOW IN THE BIN</h2></div>
          <button className="text-link" onClick={() => navigate('/dumpster')}>ALL LAUNCHES →</button>
        </header>
        <div className="snapshot-grid">
          <button className="latest-file" onClick={() => navigate(`/bag/${latest.id}`)}>
            <span className="file-tab">LATEST BAG</span>
            <strong>${latest.symbol}</strong><small>{latest.name}</small>
            <div><span>REPORTED CREATOR</span><code>{short(latest.reportedCreatorAddress)}</code></div>
            <div><span>PRIOR BAGS</span><b>{latest.trashTrail.priorLaunchCount.toString().padStart(2, '0')}</b></div>
            <span className="open-cue">OPEN DOSSIER ↗</span>
          </button>
          <div className="radar-tease">
            <span className="file-tab orange">RAT RADAR</span>
            <p><b>{radar.coverage.rankedAddressCount}</b> public observed addresses ranked by recurrence and first-entry timing.</p>
            <div className="mini-recurrence" aria-label="Top observed address appeared across 8 launches">
              {Array.from({ length: 8 }, (_, index) => <i key={index} style={{ opacity: 1 - index * .07 }} />)}
            </div>
            <button className="text-link" onClick={() => navigate('/radar')}>INSPECT THE RECURRENCE →</button>
          </div>
          <ProofNote />
        </div>
      </section>
    </div>
  );
}

function Dumpster({ feed, navigate }: { feed: PublicFeed; navigate: (path: string) => void }) {
  const [query, setQuery] = useState('');
  const [repeatsOnly, setRepeatsOnly] = useState(false);
  const visible = feed.bags.filter((bag) => {
    const text = `${bag.symbol} ${bag.name} ${bag.token} ${bag.reportedCreatorAddress}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (!repeatsOnly || bag.trashTrail.priorLaunchCount > 0);
  });
  return (
    <div className="page-pad">
      <PageHeading index="01" eyebrow="LAUNCH DISCOVERY" title="THE DUMPSTER" detail="Scan what just launched. Open a bag. Follow the reported creator history." />
      <div className="feed-tools">
        <label><span>SEARCH THE BIN</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="TOKEN / ADDRESS" /></label>
        <button aria-pressed={repeatsOnly} onClick={() => setRepeatsOnly((value) => !value)}>REPEAT CREATOR <b>{feed.bags.filter((bag) => bag.trashTrail.priorLaunchCount).length}</b></button>
        <span>NEWEST FIRST ↓</span>
      </div>
      <div className="launch-table" role="list">
        <div className="table-head"><span>BLOCK</span><span>TOKEN</span><span>ARCPAD-REPORTED CREATOR</span><span>PRIOR</span><span>EVIDENCE</span><span /></div>
        {visible.map((bag) => (
          <button className="launch-row" key={bag.id} onClick={() => navigate(`/bag/${bag.id}`)} role="listitem">
            <span data-label="BLOCK"><small>BLK</small>{bag.blockNumber}</span>
            <span className="token-cell" data-label="TOKEN"><b>${bag.symbol}</b><small>{bag.name}</small></span>
            <code data-label="REPORTED CREATOR">{short(bag.reportedCreatorAddress)}</code>
            <strong data-label="PRIOR BAGS">{String(bag.trashTrail.priorLaunchCount).padStart(2, '0')}</strong>
            <span data-label="EVIDENCE"><Coverage state={bag.trashTrail.coverage} /></span>
            <span className="open-cue">OPEN FILE ↗</span>
          </button>
        ))}
      </div>
      {!visible.length && <EmptyState title="NOTHING IN THIS BAG." detail="No indexed launch matches the current filter." />}
    </div>
  );
}

function Radar({ radar }: { radar: RadarWatchlist }) {
  const [selected, setSelected] = useState<RadarCandidate>(radar.candidates[0]);
  return (
    <div className="page-pad radar-page">
      <PageHeading index="02" eyebrow="OBSERVED RECURRENCE / TIMING" title="RAT RADAR" detail="Addresses observed receiving launched tokens across indexed launches. Ranking is an inspection order—not a verdict." />
      <div className="radar-method">
        <div><span>INDEXED LAUNCHES</span><b>{radar.coverage.indexedLaunchCount}</b></div>
        <div><span>ACQUISITION RECEIPTS</span><b>{radar.coverage.acquisitionReceiptCount}</b></div>
        <div><span>OBSERVED ADDRESSES</span><b>{radar.coverage.distinctRecipientAddressCount}</b></div>
        <div><span>COVERAGE</span><Coverage state={radar.coverage.historyCoverage} /></div>
      </div>
      <div className="radar-workbench">
        <section className="radar-list" aria-label="Ranked observed addresses">
          <div className="radar-head"><span>RANK / ADDRESS</span><span>RECURRENCE</span><span>FIRST ENTRY</span><span>RECEIPTS</span></div>
          {radar.candidates.map((candidate) => (
            <button className={selected.rank === candidate.rank ? 'radar-row selected' : 'radar-row'} key={candidate.observedRecipientAddress} onClick={() => setSelected(candidate)}>
              <span className="rank-address"><b>{String(candidate.rank).padStart(2, '0')}</b><code>{short(candidate.observedRecipientAddress)}</code></span>
              <span className="recurrence"><b>{candidate.distinctLaunchCount}</b><i style={{ '--fill': `${Math.min(100, candidate.distinctLaunchCount * 12.5)}%` } as React.CSSProperties} /></span>
              <span><b>+{candidate.medianFirstEntryBlockDelta}</b><small>MEDIAN BLOCKS</small></span>
              <span><b>{candidate.acquisitionReceiptCount}</b><small>OBSERVED</small></span>
            </button>
          ))}
        </section>
        <EvidenceDossier candidate={selected} coverage={radar.coverage.historyCoverage} checkpoint={radar.asOfBlock} />
      </div>
      <p className="boundary-bar">{radar.method.identityBoundary} {radar.method.recommendationBoundary}</p>
    </div>
  );
}

function EvidenceDossier({ candidate, coverage, checkpoint }: { candidate: RadarCandidate; coverage: CoverageState; checkpoint: string }) {
  const [watching, setWatching] = useState(false);
  return (
    <aside className="evidence-dossier" aria-live="polite">
      <span className="file-tab orange">OBSERVED ADDRESS / {String(candidate.rank).padStart(2, '0')}</span>
      <h2>{short(candidate.observedRecipientAddress)}</h2>
      <code className="full-address">{candidate.observedRecipientAddress}</code>
      <div className="dossier-stamp"><span>ROLE</span><b>V3_SWAP_RECIPIENT</b></div>
      <div className="reason-list">
        {candidate.reasons.map((reason, index) => <p key={reason}><span>0{index + 1}</span>{reason}</p>)}
      </div>
      <div className="receipt-stack">
        <div className="receipt-top"><span>EVIDENCE RECEIPTS</span><b>{candidate.evidenceActivityIds.length}</b></div>
        {candidate.evidenceActivityIds.map((id) => <code key={id}>{id.slice(0, 18)}…</code>)}
      </div>
      <div className="receipt-rail"><span>CHECKPOINT {checkpoint}</span><Coverage state={coverage} /></div>
      <button className="action full" onClick={() => setWatching((value) => !value)}>{watching ? 'WATCH ARMED' : 'WATCH THIS ADDRESS'} <span>{watching ? '✓' : '+'}</span></button>
      <small className="identity-note">Address role only. Human identity is not inferred.</small>
    </aside>
  );
}

function BagDossier({ bag, navigate }: { bag: Bag; navigate: (path: string) => void }) {
  const [stage, setStage] = useState('LAUNCH');
  const [watching, setWatching] = useState(false);
  const stageData: Record<string, { state: CoverageState; note: string; value: string }> = {
    LAUNCH: { state: 'COMPLETE', note: 'Launch event, token, pool and reported creator fixed to source receipt.', value: `BLOCK ${bag.blockNumber}` },
    '5m': { state: 'COMPLETE', note: 'Frozen observation exists. Displayed without later evidence.', value: 'OBSERVED +5m' },
    '1h': { state: 'PARTIAL', note: 'Pool and creator-balance reads exist; one external field was unavailable.', value: 'OBSERVED +1h' },
    '24h': { state: 'UNVERIFIED', note: 'No matured observation in this demo bundle. Missing stays missing.', value: 'NOT AVAILABLE' }
  };
  return (
    <div className="page-pad bag-page">
      <button className="back-link" onClick={() => navigate('/dumpster')}>← BACK TO DUMPSTER</button>
      <div className="case-header">
        <div><p className="eyebrow">BAG DOSSIER / LAUNCH EVIDENCE</p><h1>${bag.symbol}<small>{bag.name}</small></h1></div>
        <div className="case-actions">
          <button className="action" onClick={() => setWatching((value) => !value)}>{watching ? 'WATCH ARMED ✓' : 'WATCH CREATOR +'}</button>
          <button className="action primary" onClick={() => document.querySelector('#replay')?.scrollIntoView({ behavior: 'smooth' })}>OPEN REPLAY ↓</button>
        </div>
      </div>
      <div className="case-grid">
        <section className="case-sheet">
          <span className="file-tab">LAUNCH RECEIPT</span>
          <dl className="facts"><div><dt>TOKEN</dt><dd><code>{bag.token}</code></dd></div><div><dt>LAUNCH BLOCK</dt><dd>{bag.blockNumber}</dd></div><div><dt>TRANSACTION</dt><dd><code>{short(bag.txHash)}</code></dd></div><div><dt>COVERAGE</dt><dd><Coverage state={bag.trashTrail.coverage} /></dd></div></dl>
          <h2>EVIDENCE STACK</h2>
          <div className="evidence-stack">{bag.evidence.map((item) => <div key={item.text}><Evidence state={item.state} /><p>{item.text}</p></div>)}</div>
          <div className="receipt-id"><span>RECEIPT</span><code>binrat-bag:{bag.id}</code></div>
        </section>
        <aside className="creator-file">
          <span className="file-tab orange">CREATOR FILE</span>
          <h2>REPORTED ADDRESS</h2><code className="full-address">{bag.reportedCreatorAddress}</code>
          <div className="creator-count"><b>{bag.trashTrail.priorLaunchCount + 1}</b><span>INDEXED LAUNCHES<br />INCLUDING THIS BAG</span></div>
          <p className="identity-note">Same ArcPad-reported address only. This does not establish a human identity or common control beyond the observed address.</p>
          <h3>TRASH TRAIL</h3>
          <div className="trail-list">
            <div className="current"><i /><span>${bag.symbol}<small>BLK {bag.blockNumber}</small></span><b>NOW</b></div>
            {bag.trashTrail.prior.map((prior) => <div key={prior.id}><i /><span>${prior.symbol}<small>BLK {prior.blockNumber}</small></span><b>PRIOR</b></div>)}
            {!bag.trashTrail.prior.length && <p>No earlier launch in current index coverage.</p>}
          </div>
        </aside>
      </div>
      <section className="replay-lab" id="replay">
        <header><div><p className="eyebrow">REPLAY LAB / NO LOOKAHEAD</p><h2>WHAT WAS KNOWABLE, WHEN?</h2></div><Coverage state={stageData[stage].state} /></header>
        <div className="replay-track" role="tablist" aria-label="Observation stage">
          {Object.keys(stageData).map((label, index) => <button role="tab" aria-selected={stage === label} onClick={() => setStage(label)} key={label}><span>0{index + 1}</span><b>{label}</b><i /></button>)}
        </div>
        <div className="replay-readout" aria-live="polite"><span>{stage}</span><b>{stageData[stage].value}</b><p>{stageData[stage].note}</p></div>
        <p className="replay-boundary">Each stage is projected only from evidence available at that horizon. Future observations never fill earlier gaps.</p>
      </section>
    </div>
  );
}

function RatPresence({ state, label }: { state: RatState; label: string }) {
  return <figure className="rat-presence" data-rat-state={state}><img src="/binrat-hero.webp" alt="BINRAT, the approved cyber-eyed dumpster rat mascot" /><figcaption><span>{label}</span><b>STATE / {state.toUpperCase()}</b></figcaption></figure>;
}

function ProofNote() {
  return <div className="proof-note"><span>WHY OPEN TOMORROW?</span><p>See the newest bag.<br />Trace repeat creators.<br />Replay what changed.<br />Arm a watch.</p><b>THE RAT KEEPS DIGGING.</b></div>;
}

function Placeholder({ name, navigate }: { name: string; navigate: (path: string) => void }) {
  return <div className="page-pad"><EmptyState title={`${name} / ARCHITECTED`} detail="This destination is defined in Product Surface V1 but intentionally remains outside the thin demo." /><button className="action primary centered" onClick={() => navigate('/dumpster')}>CONTINUE TO DUMPSTER →</button></div>;
}

function PageHeading({ index, eyebrow, title, detail }: { index: string; eyebrow: string; title: string; detail: string }) {
  return <header className="page-heading"><div><p className="eyebrow">{index} / {eyebrow}</p><h1>{title}<em>.</em></h1></div><p>{detail}</p></header>;
}

function Coverage({ state }: { state: CoverageState }) {
  return <b className={`semantic coverage ${state.toLowerCase()}`}>{state}</b>;
}

function Evidence({ state }: { state: EvidenceState }) {
  return <b className={`semantic evidence ${state.toLowerCase()}`}>{state}</b>;
}

function Loading() {
  return <div className="loading"><span /><p>RAT IS CHECKING THE RECEIPTS…</p></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span>×</span><h2>{title}</h2><p>{detail}</p></div>;
}

function short(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}
