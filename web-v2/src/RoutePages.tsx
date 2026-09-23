import { useEffect, useState } from "react";
import { matchingCreatorBags } from "./routeIdentity";
import { loadLiveCreatorFile } from "./data";
import type { LiveCreatorFile } from "./liveAdapter";
import { replayStagesForBag, REPLAY_HORIZONS } from "./evidenceIntegrity";
import type { DataMode } from "./data";
import type { PublicFeed } from "./types";
import { AppLink, CaseTab, CheckpointRail, CopyButton, CoverageStamp, ProofBoundary, Receipt } from "./Primitives";

type Navigate = (path: string) => void;
const liveBeta = "https://binrat-edge-v0.pettevik.workers.dev/";

function Heading({ index, eyebrow, title, detail }: {
  index: string; eyebrow: string; title: string; detail: string;
}) {
  return (
    <header className="page-heading">
      <div><p className="eyebrow">{index} / {eyebrow}</p><h1>{title}<em>.</em></h1></div>
      <p>{detail}</p>
    </header>
  );
}

export function CreatorFilePage({ feed, address, mode, navigate }: {
  feed: PublicFeed; address: string; mode: DataMode; navigate: Navigate;
}) {
  // This is a separately checkpointed canonical projection, not a subset of
  // feed.bags. A failed LIVE request must never fall back to demo/feed history.
  const [liveFile, setLiveFile] = useState<LiveCreatorFile | null | undefined>(undefined);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    if (mode !== "LIVE") return;
    let active = true;
    setLiveFile(undefined);
    setFailure("");
    loadLiveCreatorFile(address)
      .then((result) => { if (active) setLiveFile(result); })
      .catch((reason: unknown) => {
        if (active) setFailure(reason instanceof Error ? reason.message : "CREATOR_FILE_UNAVAILABLE");
      });
    return () => { active = false; };
  }, [address, mode]);

  const rail = <CheckpointRail
    checkpoint={mode === "LIVE" && liveFile ? liveFile.asOfBlock : feed.asOfBlock}
    coverage={mode === "LIVE" && liveFile ? liveFile.historyCoverage : feed.historyCoverage}
  />;
  if (mode === "LIVE" && failure) return (
    <div className="page-pad route-page">
      <Heading index="03" eyebrow="REPORTED CREATOR RECORD" title="CREATOR FILE UNAVAILABLE" detail="The canonical public Creator File did not return validated evidence. Current-feed matches have not been substituted." />
      <p role="alert">{failure}</p>
      <AppLink href="/dumpster" navigate={navigate} className="action">BACK TO DUMPSTER →</AppLink>
    </div>
  );
  if (mode === "LIVE" && liveFile === undefined) return (
    <div className="page-pad route-page">
      <Heading index="03" eyebrow="REPORTED CREATOR RECORD" title="LOADING CREATOR FILE" detail="Waiting for the canonical Creator File and its own evidence receipt." />
      <p role="status">READING VALIDATED PUBLIC EVIDENCE…</p>
    </div>
  );

  const matches = mode === "LIVE"
    ? (liveFile?.launches ?? [])
    : matchingCreatorBags(feed, address);
  const newest = matches[0];
  if (!newest) return (
    <div className="page-pad route-page">
      <Heading index="03" eyebrow="REPORTED CREATOR RECORD" title="NO SUCH CREATOR FILE" detail="This exact address has no indexed canonical Creator File at the current checkpoint. An observed Radar recipient is not a creator identity." />
      {rail}
      <AppLink href="/dumpster" navigate={navigate} className="action">BACK TO DUMPSTER →</AppLink>
    </div>
  );

  const available = new Set(feed.bags.map((bag) => bag.id));
  const priorCount = mode === "LIVE"
    ? liveFile!.indexedLaunchCount - 1
    : matchingCreatorBags(feed, address)[0]!.trashTrail.priorLaunchCount;
  const prior = mode === "LIVE"
    ? [...liveFile!.launches.slice(1)].reverse()
    : [...matchingCreatorBags(feed, address)[0]!.trashTrail.prior].reverse();
  const fileReceipt = mode === "LIVE" ? liveFile!.receipt.receiptId : feed.receipt.receiptId;
  const coverage = mode === "LIVE" ? liveFile!.historyCoverage : feed.historyCoverage;
  return (
    <div className="page-pad route-page">
      <Heading index="03" eyebrow="SOURCE-REPORTED ADDRESS / CASE FILE" title="CREATOR FILE" detail="Only launches reporting this exact address. No claim of common human ownership, wallet control, or trading identity." />
      <div className="route-grid">
        <section className="route-card">
          <CaseTab tone="orange">SOURCE-REPORTED CREATOR / ARC 5042</CaseTab>
          <h2>EXACT REPORTED ADDRESS</h2>
          <div className="copyable-value"><code className="full-address">{mode === "LIVE" ? liveFile!.reportedCreatorAddress : address}</code><CopyButton label="reported creator address" value={address} /></div>
          <div className="route-stat-line">
            <span><b>{matches.length}</b> INDEXED BAG{matches.length === 1 ? "" : "S"} IN {mode === "LIVE" ? "CANONICAL CREATOR FILE" : "CURRENT FEED (DEMO)"}</span>
            <span><b>{priorCount}</b> EARLIER INDEXED BAG{priorCount === 1 ? "" : "S"} IN THIS PROJECTION</span>
          </div>
          <p className="route-note">History coverage: <CoverageStamp state={coverage} />. Missing history never implies a clean record. {mode === "LIVE" ? "This Creator File has its own checkpoint and receipt." : "Synthetic demo data is not chain proof."}</p>
          <h3>AVAILABLE BAG FILES / NEWEST FIRST</h3>
          <div className="route-link-list">
            {matches.map((bag) => (
              available.has(bag.id) ? (
                <AppLink href={"/bag/" + bag.id} navigate={navigate} className="route-result-link" key={bag.id}>
                  <span>{"$" + bag.symbol} · {bag.name}<small>BLOCK {bag.blockNumber}</small></span>
                  <span>OPEN BAG ↗</span>
                </AppLink>
              ) : (
                <div className="route-result-link" key={bag.id}>
                  <span>{"$" + bag.symbol} · {bag.name}<small>BLOCK {bag.blockNumber}</small></span>
                  <small>NOT IN LOADED FEED CHECKPOINT</small>
                </div>
              )
            ))}
          </div>
        </section>
        <aside className="route-card">
          <CaseTab>TRASH TRAIL / OLDEST FIRST</CaseTab>
          <p className="route-note">Only indexed launches are listed. The record is not a proof of exhaustive history.</p>
          <ol className="route-trail">
            {prior.map((bag) => (
              <li key={bag.id}>
                <span>{"$" + bag.symbol}<small>BLOCK {bag.blockNumber}</small></span>
                {available.has(bag.id)
                  ? <AppLink href={"/bag/" + bag.id} navigate={navigate} className="text-link">OPEN BAG ↗</AppLink>
                  : <small>REFERENCE ONLY · FULL BAG NOT IN LOADED FEED</small>}
              </li>
            ))}
            {!prior.length && <li>NO EARLIER INDEXED BAG IN THIS COVERAGE.</li>}
          </ol>
          <ProofBoundary>Matching source-reported addresses are protocol/source facts, not verified human identities. UNVERIFIED coverage cannot prove absence of other launches.</ProofBoundary>
        </aside>
      </div>
      {rail}
      <Receipt title={mode === "DEMO" ? "SYNTHETIC DEMO FEED REFERENCE" : "CANONICAL CREATOR FILE RECEIPT"}>
        <p>{mode === "LIVE" ? "Validated public Creator File projection; its source checkpoint may be newer than the loaded feed." : "This file uses the local demo feed; no production subscription or chain proof is implied."}</p>
        <div className="copyable-value"><code>{fileReceipt}</code><CopyButton label="Creator File receipt reference" value={fileReceipt} /></div>
      </Receipt>
    </div>
  );
}

export function MethodPage({ navigate }: { navigate: Navigate }) {
  return (
    <div className="page-pad route-page">
      <Heading index="06" eyebrow="EVIDENCE METHODOLOGY" title="HOW HE DIGS" detail="What a BINRAT claim means, what the public record can verify, and what remains unknown." />
      <div className="route-grid">
        <section className="route-card">
          <h2>01 / SOURCE FIELDS, NOT IDENTITIES</h2>
          <p>REPORTED CREATOR ADDRESS is the address supplied by the source launchpad. V3_SWAP_RECIPIENT is the address observed receiving a swap's token output. They are different evidence roles; neither proves who controls an address.</p>
          <h2>02 / COVERAGE IS PART OF THE CLAIM</h2>
          <p>COMPLETE, PARTIAL and UNVERIFIED describe the available indexed record at its checkpoint. OBSERVED, NOTED and UNKNOWN mark different levels of evidence, never token safety or investment quality.</p>
          <h2>03 / REPLAY DOES NOT BORROW FROM THE FUTURE</h2>
          <p>Each replay horizon is bounded to what was already evidenced at that time. An unavailable or unvalidated observation is MISSING, not filled with current information.</p>
        </section>
        <aside className="route-card">
          <h2>04 / RAT RADAR IS AN INSPECTION QUEUE</h2>
          <p>Recipient recurrence and timing are deterministic properties of indexed activity. A smaller ranked shortlist is not the entire observed address universe, nor a recommendation.</p>
          <h2>05 / VERIFY THE PUBLIC EVIDENCE</h2>
          <p>Real public activity JSON is available only when the live source supplies a valid activity ID; synthetic demo identifiers have no real evidence destination. The public receipt and status fields remain outside any future holder gate.</p>
          <ProofBoundary>NO BUY/SELL RECOMMENDATION. NO SAFETY SCORE. NO HUMAN IDENTITY INFERENCE. DEMO DATA IS NOT ON-CHAIN PROOF.</ProofBoundary>
          <AppLink href="/radar" navigate={navigate} className="action primary">OPEN RAT RADAR →</AppLink>
        </aside>
      </div>
    </div>
  );
}

export function ReplayIndexPage({ feed, mode, navigate }: {
  feed: PublicFeed; mode: DataMode; navigate: Navigate;
}) {
  return (
    <div className="page-pad route-page">
      <Heading index="04" eyebrow="POINT-IN-TIME EVIDENCE" title="REPLAY FILES" detail="Open a bag's embedded Replay. Demo stages are simulated and bag-specific; live staged observations need their own validated endpoint." />
      <CheckpointRail checkpoint={feed.asOfBlock} coverage={feed.historyCoverage} />
      <div className="route-link-list">
        {feed.bags.map((bag) => {
          const stages = replayStagesForBag(bag, mode);
          return (
            <AppLink href={"/bag/" + bag.id} navigate={navigate} className="route-result-link" key={bag.id}>
              <span>{"$" + bag.symbol} · {bag.name}<small>BLOCK {bag.blockNumber} / {mode === "DEMO" ? "SYNTHETIC DEMO" : "CURRENT FEED"}</small></span>
              <span>{REPLAY_HORIZONS.slice(1).map((horizon) => horizon + ": " + stages[horizon].state).join(" / ")}<small>OPEN BAG ↗</small></span>
            </AppLink>
          );
        })}
        {!feed.bags.length && <p>NO BAG FILES AT THE CURRENT CHECKPOINT. NOTHING WAS SYNTHESIZED.</p>}
      </div>
    </div>
  );
}

export function WatchPage({ navigate, mode }: { navigate: Navigate; mode: DataMode }) {
  return (
    <div className="page-pad route-page">
      <Heading
        index="05"
        eyebrow="FUTURE-ONLY EVIDENCE"
        title="RAT WATCH"
        detail={mode === "DEMO"
          ? "This design demo illustrates a watch interaction but cannot create a production subscription."
          : "Real creator recurrence watches are managed through Telegram Rat. This site has no independent subscription authority."}
      />
      <section className="route-card">
        <CaseTab tone="orange">{mode === "DEMO" ? "DEMO CONTROL / NOT A LIVE SUBSCRIPTION" : "LIVE / TELEGRAM-MANAGED CREATOR WATCH"}</CaseTab>
        {mode === "DEMO" ? (
          <p>The Watch buttons in demo dossiers change local interface state only. They do not submit an address, create a receipt, send Telegram alerts or persist across sessions.</p>
        ) : (
          <>
            <p>Open a LIVE Bag and copy its source-reported creator command. Send that exact <code>/watch 0x...</code> command to Telegram Rat and confirm the bot's response before treating the watch as active.</p>
            <p>Telegram also supports <code>/watches</code> to inspect accepted watches and <code>/unwatch 0x...</code> to remove one. This web page cannot inspect your Telegram subscriptions or confirm delivery.</p>
            <p>Radar recipients are different protocol roles and cannot be watched through the current creator-only Telegram command.</p>
          </>
        )}
        <div className="route-actions">
          <AppLink href="/dumpster" navigate={navigate} className="action primary">FIND A SOURCE-REPORTED CREATOR →</AppLink>
          <a href="https://t.me/BinratBot" target="_blank" rel="noopener noreferrer" className="action">OPEN TELEGRAM RAT ↗</a>
        </div>
      </section>
    </div>
  );
}

export function LedgerPage() {
  return (
    <div className="page-pad route-page">
      <Heading index="07" eyebrow="PUBLIC FUNDING EVIDENCE" title="DUMPSTER LEDGER" detail="Financial transparency must come from the current production authority, never from illustrative demo wallet balances." />
      <section className="route-card">
        <CaseTab tone="orange">LIVE ACCOUNTING NOT IN THIS DEMO</CaseTab>
        <p>The current live beta presents pre-launch funding roles and the available ledger status. This V2 candidate has not yet integrated or independently validated its Ledger API, so no balances or transaction totals are shown here.</p>
        <a href={liveBeta + "#dumpster-ledger"} target="_blank" rel="noopener noreferrer" className="action primary">VIEW EXISTING LIVE LEDGER ↗</a>
      </section>
    </div>
  );
}

export function TokenStatusPage() {
  return (
    <div className="page-pad route-page">
      <Heading index="08" eyebrow="TOKEN STATE / NOT AUTHORITY" title="BINRAT STATUS" detail="Useful rat, unreleased coin. A frontend preview is not a token contract, a launch authorization or a marketing authorization." />
      <section className="route-card">
        <CaseTab tone="red">NOT_LAUNCHED / NO CANONICAL CONTRACT PUBLISHED</CaseTab>
        <p>There is no published official BINRAT token contract in this application. The design demo offers no presale, wallet connection, holder access, buy or sell action.</p>
        <p>Existing public evidence stays public. Any future holder features may add depth, speed and filtering, but cannot purchase factual authority.</p>
        <a href={liveBeta + "#token-status"} target="_blank" rel="noopener noreferrer" className="action primary">VERIFY STATUS ON THE LIVE BETA ↗</a>
      </section>
    </div>
  );
}
