import { matchingCreatorBags } from "./routeIdentity";
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
  const matches = matchingCreatorBags(feed, address);
  const newest = matches[0];
  if (!newest) {
    return (
      <div className="page-pad route-page">
        <Heading index="03" eyebrow="REPORTED CREATOR RECORD" title="NO SUCH CREATOR FILE" detail="No indexed bag in the present feed reports this exact address. An observed Radar recipient is not a creator identity." />
        <CheckpointRail checkpoint={feed.asOfBlock} coverage={feed.historyCoverage} />
        <AppLink href="/dumpster" navigate={navigate} className="action">BACK TO DUMPSTER →</AppLink>
      </div>
    );
  }
  const available = new Set(feed.bags.map((bag) => bag.id));
  return (
    <div className="page-pad route-page">
      <Heading index="03" eyebrow="SOURCE-REPORTED ADDRESS / CASE FILE" title="CREATOR FILE" detail="Only launches reporting this exact address. No claim of common human ownership, wallet control, or trading identity." />
      <div className="route-grid">
        <section className="route-card">
          <CaseTab tone="orange">SOURCE-REPORTED CREATOR / ARC 5042</CaseTab>
          <h2>EXACT REPORTED ADDRESS</h2>
          <div className="copyable-value"><code className="full-address">{newest.reportedCreatorAddress}</code><CopyButton label="reported creator address" value={newest.reportedCreatorAddress} /></div>
          <div className="route-stat-line">
            <span><b>{matches.length}</b> BAG{matches.length === 1 ? "" : "S"} IN CURRENT FEED</span>
            <span><b>{newest.trashTrail.priorLaunchCount}</b> PRIOR ENTRIES REFERENCED BY LATEST BAG</span>
          </div>
          <p className="route-note">These counts describe different evidence scopes and must not be added together. History coverage: <CoverageStamp state={newest.trashTrail.coverage} />.</p>
          <h3>AVAILABLE BAG FILES / NEWEST FIRST</h3>
          <div className="route-link-list">
            {matches.map((bag) => (
              <AppLink href={"/bag/" + bag.id} navigate={navigate} className="route-result-link" key={bag.id}>
                <span>{"$" + bag.symbol} · {bag.name}<small>BLOCK {bag.blockNumber}</small></span>
                <span>OPEN BAG ↗</span>
              </AppLink>
            ))}
          </div>
        </section>
        <aside className="route-card">
          <CaseTab>TRASH TRAIL / OLDEST FIRST</CaseTab>
          <p className="route-note">The most recent bag references these earlier launches. A referenced bag without a complete current-feed dossier is deliberately not linked.</p>
          <ol className="route-trail">
            {[...newest.trashTrail.prior].reverse().map((prior) => (
              <li key={prior.id}>
                <span>{"$" + prior.symbol}<small>BLOCK {prior.blockNumber}</small></span>
                {available.has(prior.id)
                  ? <AppLink href={"/bag/" + prior.id} navigate={navigate} className="text-link">OPEN BAG ↗</AppLink>
                  : <small>REFERENCE ONLY · FULL FILE UNAVAILABLE HERE</small>}
              </li>
            ))}
            {!newest.trashTrail.prior.length && <li>NO EARLIER BAG REPORTED IN CURRENT COVERAGE.</li>}
          </ol>
          <ProofBoundary>Matching reported creator addresses are on-chain/source fields, not verified human identities. Missing or partial history is not evidence of no other launches.</ProofBoundary>
        </aside>
      </div>
      <CheckpointRail checkpoint={feed.asOfBlock} coverage={feed.historyCoverage} />
      <Receipt title={mode === "DEMO" ? "SYNTHETIC DEMO FEED REFERENCE" : "CURRENT PUBLIC FEED REFERENCE"}>
        <p>This file is assembled from currently available feed bags. The canonical Creator File API and its receipt require separate validated integration for production.</p>
        <div className="copyable-value"><code>{feed.receipt.receiptId}</code><CopyButton label="source feed receipt reference" value={feed.receipt.receiptId} /></div>
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

export function WatchPage({ navigate }: { navigate: Navigate }) {
  return (
    <div className="page-pad route-page">
      <Heading index="05" eyebrow="FUTURE-ONLY EVIDENCE" title="RAT WATCH" detail="Follow recurring evidence, not buy signals. This design demo cannot create or confirm a production subscription." />
      <section className="route-card">
        <CaseTab tone="orange">DEMO CONTROL / NOT A LIVE SUBSCRIPTION</CaseTab>
        <p>The Watch buttons in demo dossiers change local interface state only. They do not submit an address, create a receipt, send Telegram alerts or persist across sessions.</p>
        <p>The existing Telegram Rat belongs to the separate live beta. Subscription management and verified delivery receipts must be connected here before this becomes a production Watch console.</p>
        <div className="route-actions">
          <AppLink href="/radar" navigate={navigate} className="action primary">FIND AN ADDRESS →</AppLink>
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
