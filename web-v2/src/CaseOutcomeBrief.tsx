import type { VerifiedCaseOutcomes } from "../../src/public/caseOutcomes.js";
const horizon = (ms: number) =>
  ms === 300000 ? "5m" : ms === 3600000 ? "1h" : "24h";
export function CaseOutcomeBrief({
  value,
  stage,
  fresh,
}: {
  value: VerifiedCaseOutcomes;
  stage: "WHAT" | "TRAIL" | "RECEIPTS";
  fresh: boolean;
}) {
  const s = value.summary,
    id = value.envelope.material.caseEvidence.material.caseId;
  if (stage === "RECEIPTS")
    return (
      <details className="vl-receipt a2-outcome-proof">
        <summary>
          <strong>Outcome samples and verification inputs</strong> · EXPAND
        </summary>
        <div className="vl-receipt-body">
          <p>
            Same-origin indexed receipts, bound to this exact Case and
            publication. Digests, identities and derivation were checked; these
            are not independent RPC proofs.
          </p>
          <a
            href={"/api/bag/" + id + "/evidence?include=outcomes"}
            target="_blank"
            rel="noreferrer"
          >
            Canonical Case outcome envelope ↗
          </a>
          <pre tabIndex={0}>{JSON.stringify(value.envelope, null, 2)}</pre>
        </div>
      </details>
    );
  return (
    <div
      className="vl-evidence-surface a2-outcome-brief"
      data-outcome-case={id}
    >
      <span className="vl-eyebrow">
        WHAT PREVIOUS LAUNCHES DID ·{" "}
        {fresh ? "INDEXED SAMPLES" : "UPDATES PAUSED · EARLIER SAMPLES"}
      </span>
      <h2>
        {s.earlierWithGraduatedSample > 0
          ? "A previous launch has a graduation sample."
          : s.earlierWithSamples > 0
            ? "Previous launches have recorded curve samples."
            : "Previous outcomes are unknown in this window."}
      </h2>
      <p>
        <strong>DERIVED · </strong>
        {s.earlierWithSamples} of {s.earlierReturned} earlier launches returned
        here have fixed-age receipts. {s.earlierWithGraduatedSample} have a
        recorded GRADUATED sample.
      </p>
      <p>
        <strong>UNKNOWN · </strong>
        {s.earlierWithoutSamples} earlier launches have no outcome receipts in
        this window. Missing receipts do not establish inactivity, failure or
        success.
      </p>
      <p>
        <strong>PARTIAL · </strong>At most 20 launch records through this Case.
        Sampled phases describe their recorded blocks, not current lifecycle
        state. Graduation alone proves neither a usable market nor
        profitability. Funding and human ownership are not established by these
        receipts.
      </p>
      <p className="vl-provenance">
        Same-origin indexed receipts. Identities, digests and derivation are
        checked; the phase is not independently rechecked against RPC here.
      </p>
      {stage === "TRAIL" && (
        <ol className="vl-source-trail a2-outcome-trail">
          {value.launches.slice(1).map(({ record, samples }) => (
            <li key={record.launch.launchId}>
              <span className="vl-eyebrow">
                BLOCK {record.launch.blockNumber}
              </span>
              <strong>
                {record.launch.name ||
                  record.launch.symbol ||
                  record.launch.token.slice(0, 10) + "…"}
              </strong>
              <p>
                {samples.length
                  ? "OBSERVED · " +
                    samples
                      .map((r) => horizon(r.horizonMs) + " target: " + r.phase)
                      .join(" · ")
                  : "UNKNOWN · No fixed-age receipt returned."}
              </p>
              {samples.some((r) => r.phase === "GRADUATED") && (
                <p>
                  PARTIAL ·{" "}
                  {samples
                    .find((r) => r.phase === "GRADUATED")!
                    .missing.includes("V4_POOL_STATE")
                    ? "V4 pool state is missing. Valuation is unavailable."
                    : "No trading success or current market claim is made."}
                </p>
              )}
              <details>
                <summary>EXPAND TECHNICAL PROOF</summary>
                <p className="vl-address">
                  TOKEN <code>{record.launch.token}</code>
                </p>
                <p className="vl-address">
                  LAUNCH TX <code>{record.launch.txHash}</code>
                </p>
                {samples.map((r) => (
                  <p key={r.observationId}>
                    {horizon(r.horizonMs)} target · observed{" "}
                    {new Date(r.observedTimestampMs).toISOString()} · block{" "}
                    {r.observedBlock.toString()} · hash {r.observedBlockHash} ·{" "}
                    {r.status} · receipt {r.evidenceDigest}
                  </p>
                ))}
                <a
                  className="vl-text-action"
                  href={"/bag/" + record.launch.launchId}
                >
                  OPEN EXACT CASE →
                </a>
              </details>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
