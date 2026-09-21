import { useEffect, useId, useMemo, useState } from "react";
import { CoverageStamp, RecurrenceMarks } from "./Primitives";
import type { DataMode } from "./data";
import type { RadarCandidate, RadarWatchlist } from "./types";

type SortMode = "inspection" | "recurrence" | "median" | "receipts";

const sorters: Record<SortMode, (a: RadarCandidate, b: RadarCandidate) => number> = {
  inspection: (a, b) => a.rank - b.rank,
  recurrence: (a, b) =>
    b.distinctLaunchCount - a.distinctLaunchCount || a.rank - b.rank,
  median: (a, b) =>
    a.medianFirstEntryBlockDelta - b.medianFirstEntryBlockDelta ||
    a.rank - b.rank,
  receipts: (a, b) =>
    b.acquisitionReceiptCount - a.acquisitionReceiptCount || a.rank - b.rank,
};

function shortAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function CandidateReason({ candidate }: { candidate: RadarCandidate }) {
  const [firstReason, ...overflow] = candidate.reasons;
  return (
    <span className="radar-reason" data-label="REASON">
      <span>{firstReason || "No deterministic reason supplied."}</span>
      {overflow.length > 0 && <b>+{overflow.length} MORE</b>}
    </span>
  );
}

export function RadarWorkbench({
  radar,
  mode,
}: {
  radar: RadarWatchlist;
  mode: DataMode;
}) {
  const searchId = useId();
  const sortId = useId();
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("inspection");
  const [selectedAddress, setSelectedAddress] = useState<string | null>(
    radar.candidates[0]?.observedRecipientAddress ?? null,
  );
  const [copied, setCopied] = useState(false);

  const visibleCandidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...radar.candidates]
      .filter((candidate) => {
        if (!needle) return true;
        return (
          candidate.observedRecipientAddress.toLowerCase().includes(needle) ||
          candidate.reasons.some((reason) =>
            reason.toLowerCase().includes(needle),
          )
        );
      })
      .sort(sorters[sortMode]);
  }, [query, radar.candidates, sortMode]);

  const selected =
    visibleCandidates.find(
      (candidate) => candidate.observedRecipientAddress === selectedAddress,
    ) ?? visibleCandidates[0];

  useEffect(() => {
    const nextAddress = selected?.observedRecipientAddress ?? null;
    if (nextAddress !== selectedAddress) setSelectedAddress(nextAddress);
  }, [selected, selectedAddress]);

  useEffect(() => setCopied(false), [selectedAddress]);

  const copySelectedAddress = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.observedRecipientAddress);
    setCopied(true);
  };

  return (
    <section className="radar-machine" aria-labelledby="radar-workbench-title">
      <header className="radar-machine-title">
        <div>
          <span>02 / OBSERVED RECIPIENTS</span>
          <h2 id="radar-workbench-title">RECURRENCE WORKBENCH</h2>
        </div>
        <b className={mode === "DEMO" ? "radar-mode demo" : "radar-mode"}>
          {mode === "DEMO" ? "DETERMINISTIC DEMO DATA" : "PUBLIC LIVE DATA"}
        </b>
      </header>

      <div className="radar-coverage" aria-label="Radar evidence coverage">
        <span>
          <small>INDEXED LAUNCHES</small>
          <b>{radar.coverage.indexedLaunchCount}</b>
        </span>
        <span>
          <small>ACQUISITION RECEIPTS</small>
          <b>{radar.coverage.acquisitionReceiptCount}</b>
        </span>
        <span>
          <small>OBSERVED ADDRESSES</small>
          <b>{radar.coverage.distinctRecipientAddressCount}</b>
        </span>
        <span>
          <small>HISTORY COVERAGE</small>
          <CoverageStamp state={radar.coverage.historyCoverage} />
        </span>
        <span>
          <small>CHECKPOINT / AS OF BLOCK</small>
          <b>{radar.asOfBlock}</b>
        </span>
      </div>

      <div className="radar-toolbar">
        <div className="radar-search">
          <label htmlFor={searchId}>ADDRESS / REASON SEARCH</label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="0x… or canonical reason"
          />
        </div>
        <div className="radar-sort">
          <label htmlFor={sortId}>SORT VISIBLE RECORDS</label>
          <select
            id={sortId}
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
          >
            <option value="inspection">ORIGINAL INSPECTION ORDER</option>
            <option value="recurrence">RECURRENCE / DISTINCT LAUNCHES</option>
            <option value="median">MEDIAN FIRST-ENTRY DELTA</option>
            <option value="receipts">ACQUISITION RECEIPT COUNT</option>
          </select>
        </div>
        <p aria-live="polite">
          <b>{visibleCandidates.length}</b> / {radar.coverage.rankedAddressCount} RANKED
          ADDRESSES
        </p>
      </div>

      <div className="radar-bench-grid">
        <section className="radar-recipient-list" aria-label="Ranked observed recipients">
          <div className="radar-column-head" aria-hidden="true">
            <span>ORDER / ADDRESS</span>
            <span>LAUNCH SCARS</span>
            <span>MEDIAN FIRST ENTRY</span>
            <span>RECEIPTS</span>
            <span>REASON</span>
          </div>
          {visibleCandidates.map((candidate) => {
            const isSelected =
              selected?.observedRecipientAddress ===
              candidate.observedRecipientAddress;
            return (
              <button
                type="button"
                className={isSelected ? "radar-record selected" : "radar-record"}
                key={candidate.observedRecipientAddress}
                onClick={() => setSelectedAddress(candidate.observedRecipientAddress)}
                aria-pressed={isSelected}
                aria-label={`Inspection order ${candidate.rank}, ${candidate.observedRecipientAddress}, ${candidate.distinctLaunchCount} distinct launches, median first entry ${candidate.medianFirstEntryBlockDelta} blocks, ${candidate.acquisitionReceiptCount} receipts`}
              >
                <span className="radar-address" data-label="ORDER / ADDRESS">
                  <b>{String(candidate.rank).padStart(2, "0")}</b>
                  <code title={candidate.observedRecipientAddress}>
                    {shortAddress(candidate.observedRecipientAddress)}
                  </code>
                </span>
                <span className="radar-scars" data-label="RECURRENCE / SCARS">
                  <b>{candidate.distinctLaunchCount}</b>
                  <RecurrenceMarks count={candidate.distinctLaunchCount} compact />
                </span>
                <span className="radar-metric" data-label="MEDIAN Δ">
                  <b>+{candidate.medianFirstEntryBlockDelta}</b>
                  <small>BLOCKS</small>
                </span>
                <span className="radar-metric" data-label="RECEIPTS">
                  <b>{candidate.acquisitionReceiptCount}</b>
                  <small>OBSERVED</small>
                </span>
                <CandidateReason candidate={candidate} />
              </button>
            );
          })}
          {visibleCandidates.length === 0 && (
            <div className="radar-empty" role="status">
              <strong>THE TRAIL WENT COLD.</strong>
              <span>No validated Radar evidence matches this search.</span>
            </div>
          )}
        </section>

        <aside className="radar-reserved" aria-live="polite">
          <span>RESERVED EVIDENCE ZONE / 40%</span>
          <strong>CASE FILE ARRIVES IN GATE C</strong>
          {selected ? (
            <>
              <small>SELECTED OBSERVED RECIPIENT</small>
              <code>{selected.observedRecipientAddress}</code>
              <button type="button" onClick={copySelectedAddress}>
                {copied ? "ADDRESS COPIED" : "COPY FULL ADDRESS"}
              </button>
              <dl>
                <div>
                  <dt>INSPECTION ORDER</dt>
                  <dd>{String(selected.rank).padStart(2, "0")}</dd>
                </div>
                <div>
                  <dt>LATEST SEEN BLOCK</dt>
                  <dd>{selected.latestSeenBlock}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p>NO VISIBLE RECIPIENT SELECTED.</p>
          )}
        </aside>
      </div>

      <footer className="radar-boundary">
        <span>
          EVIDENCED ROLE <b>{radar.method.evidencedRole}</b>
        </span>
        <p>{radar.method.identityBoundary}</p>
        <p>{radar.method.recommendationBoundary}</p>
      </footer>
    </section>
  );
}
