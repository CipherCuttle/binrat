import { useEffect, useState } from "react";
import { CheckpointRail, CoverageStamp } from "./Primitives";
import { loadRadarActivities, type DataMode } from "./data";
import type { RadarCandidate, RadarPublicActivity, RadarWatchlist } from "./types";

type ReceiptState =
  | { kind: "loading" }
  | { kind: "ready"; activities: RadarPublicActivity[] }
  | { kind: "unavailable" };

function shortHash(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function receiptFlow(value: RadarPublicActivity["launchedTokenFlow"]) {
  return value.replaceAll("_", " ");
}

export function RadarCaseFile({
  candidate,
  radar,
  mode,
}: {
  candidate: RadarCandidate | undefined;
  radar: RadarWatchlist;
  mode: DataMode;
}) {
  const [receiptState, setReceiptState] = useState<ReceiptState>({ kind: "loading" });
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const activityKey = candidate?.evidenceActivityIds.join(",") ?? "";

  useEffect(() => {
    if (!candidate) {
      setReceiptState({ kind: "ready", activities: [] });
      setSelectedActivityId(null);
      return;
    }
    const controller = new AbortController();
    setReceiptState({ kind: "loading" });
    setCopyMessage("");
    loadRadarActivities(
      candidate.evidenceActivityIds,
      candidate.observedRecipientAddress,
      mode,
      controller.signal,
    )
      .then((activities) => {
        if (controller.signal.aborted) return;
        setReceiptState({ kind: "ready", activities });
        setSelectedActivityId((current) =>
          activities.some((activity) => activity.activityId === current)
            ? current
            : (activities[0]?.activityId ?? null),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setReceiptState({ kind: "unavailable" });
      });
    return () => controller.abort();
  }, [activityKey, candidate?.observedRecipientAddress, mode]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} COPIED`);
    } catch {
      setCopyMessage("COPY UNAVAILABLE");
    }
  };

  if (!candidate) {
    return (
      <aside className="radar-case-file case-empty" aria-live="polite">
        <span>CASE FILE / NO VISIBLE RECIPIENT</span>
        <strong>THE TRAIL WENT COLD.</strong>
        <p>No selected observed recipient remains in this result set.</p>
      </aside>
    );
  }

  const selectedReceipt =
    receiptState.kind === "ready"
      ? receiptState.activities.find(
          (activity) => activity.activityId === selectedActivityId,
        )
      : undefined;

  return (
    <aside className="radar-case-file" aria-labelledby="case-file-title" aria-live="polite">
      <section className="case-paper-head">
        <header>
          <span>CASE FILE / INSPECTION ORDER {String(candidate.rank).padStart(2, "0")}</span>
          <b>OBSERVED. NOT AN IDENTITY.</b>
        </header>
        <h3 id="case-file-title">{shortHash(candidate.observedRecipientAddress)}</h3>
        <code>{candidate.observedRecipientAddress}</code>
        <div className="case-tags">
          <b>{radar.method.evidencedRole}</b>
          <CoverageStamp state={radar.coverage.historyCoverage} />
        </div>
        <button
          type="button"
          className="case-copy"
          onClick={() => copy(candidate.observedRecipientAddress, "ADDRESS")}
        >
          {copyMessage === "ADDRESS COPIED" ? copyMessage : "COPY ADDRESS"}
        </button>
        <span className="sr-only" aria-live="polite">{copyMessage}</span>
      </section>

      <section className="case-facts" aria-label="Selected recipient facts">
        <div>
          <small>DISTINCT LAUNCHES</small>
          <b>{candidate.distinctLaunchCount}</b>
        </div>
        <div>
          <small>MEDIAN FIRST-ENTRY Δ</small>
          <b>+{candidate.medianFirstEntryBlockDelta}</b>
          <span>BLOCKS</span>
        </div>
        <div>
          <small>EARLIEST FIRST-ENTRY Δ</small>
          <b>+{candidate.earliestFirstEntryBlockDelta}</b>
          <span>BLOCKS</span>
        </div>
        <div>
          <small>ACQUISITION RECEIPTS</small>
          <b>{candidate.acquisitionReceiptCount}</b>
        </div>
        <div>
          <small>LATEST SEEN BLOCK</small>
          <b>{candidate.latestSeenBlock}</b>
        </div>
      </section>

      <section className="case-reasons" aria-label="Canonical reasons for inclusion">
        <h4>REASON FOR INCLUSION</h4>
        {candidate.reasons.map((reason, index) => (
          <p key={reason}>
            <b>{String(index + 1).padStart(2, "0")}</b>
            <span>{reason}</span>
          </p>
        ))}
      </section>

      <section className="case-tripwire" aria-label="Future recipient tripwire boundary">
        <div>
          <span>RECIPIENT TRIPWIRE</span>
          <b>NOT YET AVAILABLE</b>
        </div>
        {/* Rat Watch only subscribes Telegram chats to ArcPad-reported creator addresses, never Radar recipients. */}
        <button type="button" disabled aria-describedby="tripwire-boundary">
          RECIPIENT WATCH / FUTURE CAPABILITY
        </button>
        <p id="tripwire-boundary">
          Existing Rat Watch tracks reported creator addresses. This Radar file is an observed swap-recipient address.
        </p>
      </section>

      <section className="case-receipts" aria-labelledby="case-receipts-title">
        <header>
          <h4 id="case-receipts-title">PUBLIC EVIDENCE RECEIPTS</h4>
          <span>{mode === "DEMO" ? "DETERMINISTIC DEMO" : "LIVE PUBLIC READ"}</span>
        </header>
        {receiptState.kind === "loading" && <p className="case-receipt-state">LOADING RECEIPT DETAIL…</p>}
        {receiptState.kind === "unavailable" && (
          <p className="case-receipt-state unavailable">RECEIPT DETAIL UNAVAILABLE</p>
        )}
        {receiptState.kind === "ready" && receiptState.activities.length === 0 && (
          <p className="case-receipt-state">NO BOUNDED RECEIPT DETAIL WAS RETURNED.</p>
        )}
        {receiptState.kind === "ready" &&
          receiptState.activities.map((activity) => {
            const active = activity.activityId === selectedActivityId;
            return (
              <article className={active ? "case-receipt selected" : "case-receipt"} key={activity.activityId}>
                <button
                  type="button"
                  className="case-receipt-select"
                  onClick={() => setSelectedActivityId(activity.activityId)}
                  aria-pressed={active}
                >
                  <span>OBSERVED RECEIPT / {shortHash(activity.activityId)}</span>
                  <b>BLK {activity.blockNumber}</b>
                  <small>{receiptFlow(activity.launchedTokenFlow)}</small>
                </button>
                {active && (
                  <div className="case-receipt-detail">
                    <dl>
                      <div><dt>LAUNCH</dt><dd>{activity.launchId}</dd></div>
                      <div><dt>TX</dt><dd title={activity.txHash}>{shortHash(activity.txHash)}</dd></div>
                      <div><dt>LOG INDEX</dt><dd>{activity.logIndex}</dd></div>
                      <div><dt>PROOF DIGEST</dt><dd title={activity.evidenceDigest}>{shortHash(activity.evidenceDigest)}</dd></div>
                    </dl>
                    <div className="case-receipt-actions">
                      <button type="button" onClick={() => copy(activity.activityId, "ACTIVITY ID")}>COPY ACTIVITY ID</button>
                      <button type="button" onClick={() => copy(activity.txHash, "TX HASH")}>COPY TX HASH</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
      </section>

      <section className="case-checkpoint">
        <h4>CHECKPOINT / COVERAGE</h4>
        <div className="case-progress" aria-label={`Address observed, recurrence measured, receipts present, history coverage ${radar.coverage.historyCoverage}`}>
          <span>ADDRESS OBSERVED</span>
          <span>RECURRENCE MEASURED</span>
          <span>RECEIPTS PRESENT</span>
          <span>HISTORY {radar.coverage.historyCoverage}</span>
        </div>
        <CheckpointRail
          checkpoint={radar.asOfBlock}
          coverage={radar.coverage.historyCoverage}
          receiptId={radar.receipt.receiptId}
          tone="paper"
        />
        <code className="case-projection-digest">PROJECTION DIGEST / {radar.receipt.evidenceDigest}</code>
      </section>

      <footer className="case-boundary">
        <b>EVIDENCED ROLE / {radar.method.evidencedRole}</b>
        <p>{radar.method.identityBoundary}</p>
        <p>{radar.method.recommendationBoundary}</p>
      </footer>
    </aside>
  );
}
