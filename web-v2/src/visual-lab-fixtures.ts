/** Presentation-only records. Never used by the live feed or evidence adapter. */
export type LabReceipt = {
  id: string;
  label: string;
  source: "LOCAL_SYNTHETIC_FIXTURE";
  record: Readonly<Record<string, string>>;
};

export type LabObservation = {
  date: string;
  symbol: string;
  label: string;
  receiptId: string;
};

export type LabCase = {
  id: string;
  symbol: string;
  mark: string;
  tone: "repeat" | "fresh" | "partial";
  discovery: string;
  headline: string;
  summary: string;
  why: string;
  explanation: string;
  facts: readonly { text: string; receiptId: string }[];
  history:
    | { kind: "observed"; prior: readonly [LabObservation, ...LabObservation[]] }
    | { kind: "unknown"; prior: readonly []; reason: string };
  current: LabObservation;
  boundary: string;
  receipts: readonly LabReceipt[];
  watch: "access-required" | "unavailable";
};

function launch(id: string, symbol: string, date: string, address: string): LabReceipt {
  return {
    id, label: `${symbol} · launch record`, source: "LOCAL_SYNTHETIC_FIXTURE",
    record: { kind: "synthetic_launch", symbol, indexedAt: date, reportedDeployer: address, coverage: "partial", chainVerification: "none — invented local example" },
  };
}

const moldy = launch("lab-moldy-01", "$MOLDY", "2026-10-08T14:20:00Z", "lab-address-A");
const crust = launch("lab-crust-01", "$CRUST", "2026-10-02T09:10:00Z", "lab-address-A");
const peel = launch("lab-peel-01", "$PEEL", "2026-09-29T18:40:00Z", "lab-address-A");
const rind = launch("lab-rind-01", "$RIND", "2026-09-28T11:05:00Z", "lab-address-A");
const slop = launch("lab-slop-01", "$SLOP", "2026-10-08T13:45:00Z", "lab-address-B");
const ooze = launch("lab-ooze-01", "$OOZE", "2026-10-07T16:30:00Z", "unknown");
const tin = launch("lab-tin-01", "$TIN", "2026-10-06T08:00:00Z", "unknown");
const priorCrust = { date: "02 OCT", symbol: "$CRUST", label: "Same reported address", receiptId: crust.id };
const priorPeel = { date: "29 SEP", symbol: "$PEEL", label: "Same reported address", receiptId: peel.id };
const priorRind = { date: "28 SEP", symbol: "$RIND", label: "Same reported address", receiptId: rind.id };

export const labCases: readonly LabCase[] = [
  {
    id: "042", symbol: "$MOLDY", mark: "M", tone: "repeat", discovery: "Familiar deployer",
    headline: "SMELLS FAMILIAR.",
    summary: "One reported address. Three earlier launches. Rat Zero picked up a familiar trail.",
    why: "Same address. Another launch.",
    explanation: "The address reported on $MOLDY also appears on three earlier launches in this synthetic index. That recurrence is why Rat Zero brought it to you.",
    facts: [
      { text: "$MOLDY names lab-address-A as its reported deployer.", receiptId: moldy.id },
      { text: "$CRUST is the most recent earlier match in this fixture.", receiptId: crust.id },
    ],
    history: { kind: "observed", prior: [priorCrust, priorPeel, priorRind] },
    current: { date: "08 OCT", symbol: "$MOLDY", label: "Current indexed launch", receiptId: moldy.id },
    boundary: "An address match does not establish a shared human owner, intent, safety or profitability. History coverage is partial.",
    receipts: [moldy, crust, peel, rind], watch: "access-required",
  },
  {
    id: "043", symbol: "$SLOP", mark: "S", tone: "fresh", discovery: "Fresh launch",
    headline: "FRESH SCRAP.",
    summary: "A new launch in the index. The first record is here; the earlier story is unknown.",
    why: "A first sighting. An open question.",
    explanation: "Rat Zero surfaced $SLOP because a launch record was added to the synthetic index. This fixture contains no verified earlier history for its reported address.",
    facts: [{ text: "One launch record reports lab-address-B for $SLOP.", receiptId: slop.id }],
    history: { kind: "unknown", prior: [], reason: "No earlier history is verified in this fixture. A missing record cannot establish a first-ever launch or a clean history." },
    current: { date: "08 OCT", symbol: "$SLOP", label: "First indexed sighting", receiptId: slop.id },
    boundary: "Earlier history is unknown. The reported address is an invented fixture value, not a verified person.",
    receipts: [slop], watch: "access-required",
  },
  {
    id: "044", symbol: "$CRUST", mark: "C", tone: "repeat", discovery: "Address recurrence",
    headline: "SEEN THIS BEFORE.",
    summary: "The reported deployer connects to two earlier indexed launches. Follow the records.",
    why: "Two earlier records share this address.",
    explanation: "At the $CRUST checkpoint, the synthetic index already contains $PEEL and $RIND with the same reported address. Later launches are not presented as its prior history.",
    facts: [
      { text: "$CRUST reports lab-address-A on 02 October.", receiptId: crust.id },
      { text: "$PEEL reports that address on 29 September.", receiptId: peel.id },
    ],
    history: { kind: "observed", prior: [priorPeel, priorRind] },
    current: { date: "02 OCT", symbol: "$CRUST", label: "Selected launch checkpoint", receiptId: crust.id },
    boundary: "Two earlier address matches are supported by this fixture. Shared human ownership and intent remain unknown.",
    receipts: [crust, peel, rind], watch: "access-required",
  },
  {
    id: "045", symbol: "$OOZE", mark: "O", tone: "fresh", discovery: "Metadata changed",
    headline: "NEW COAT. SAME CAN.",
    summary: "A name changed between two synthetic snapshots. The change is inspectable.",
    why: "The metadata moved.",
    explanation: "Rat Zero surfaced $OOZE because its displayed name changed from Ooze to OOZE CLUB. A metadata change alone does not establish deployer recurrence.",
    facts: [{ text: "The display name changes from Ooze to OOZE CLUB.", receiptId: "lab-ooze-02" }],
    history: { kind: "unknown", prior: [], reason: "Deployer history is unknown. These snapshots support a metadata change only; no earlier address match is available." },
    current: { date: "07 OCT", symbol: "$OOZE", label: "Indexed launch snapshot", receiptId: ooze.id },
    boundary: "The reported deployer is unknown. Metadata is not evidence of ownership, intent or safety.",
    receipts: [ooze, { id: "lab-ooze-02", label: "$OOZE · metadata comparison", source: "LOCAL_SYNTHETIC_FIXTURE", record: {
      kind: "synthetic_metadata_change", symbol: "$OOZE", before: "Ooze", after: "OOZE CLUB", beforeAt: "2026-10-07T16:30:00Z", afterAt: "2026-10-08T12:00:00Z", chainVerification: "none — invented local example",
    } }], watch: "unavailable",
  },
  {
    id: "046", symbol: "$TIN", mark: "T", tone: "partial", discovery: "History unknown",
    headline: "ONLY HALF THE STORY.",
    summary: "A launch fragment, with gaps. Rat Zero has a record to inspect, not a recurrence claim.",
    why: "A fragment worth opening.",
    explanation: "The synthetic index contains a partial $TIN launch record. Its reported deployer and earlier history are unknown, so this Case makes no address-match claim.",
    facts: [{ text: "The $TIN record has no reported deployer value.", receiptId: tin.id }],
    history: { kind: "unknown", prior: [], reason: "Earlier history is unknown. The partial record has no reported deployer, so there is no supported address trail." },
    current: { date: "06 OCT", symbol: "$TIN", label: "Partial launch record", receiptId: tin.id },
    boundary: "Unknown fields stay unknown. No connection to another launch or wallet is inferred.",
    receipts: [tin], watch: "unavailable",
  },
];

export const labProvenance = {
  source: "web-v2/src/visual-lab-fixtures.ts",
  boundary: "Invented local examples. No chain lookup, live evidence or human identity verification.",
} as const;
