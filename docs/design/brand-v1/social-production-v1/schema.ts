export const SOCIAL_SCHEMA_VERSION = "binrat.social/1" as const;
export const PROOF_LABEL = "DEMO / NON-LIVE" as const;

export type EvidenceState = "COMPLETE" | "PARTIAL" | "UNKNOWN" | "MISSING";
export type SocialFamily = "receipt" | "case-file" | "rat-found";
export type CtaAction = "OPEN_RECEIPTS" | "OPEN_CASE" | "DIG_DEEPER";
export type CtaLabel = "OPEN RECEIPTS →" | "OPEN CASE →" | "DIG DEEPER →";

export type SourceSlot = {
  label: string;
  value: string;
  state: EvidenceState;
};

export type CtaSlot = {
  label: CtaLabel;
  action: CtaAction;
};

export type SocialBase = {
  schemaVersion: typeof SOCIAL_SCHEMA_VERSION;
  fixtureId: string;
  proof: typeof PROOF_LABEL;
  family: SocialFamily;
  headline: string;
  coverage: EvidenceState;
  source: SourceSlot;
  cta: CtaSlot;
};

export type ReceiptSocial = SocialBase & {
  family: "receipt";
  receiptId: string;
  literalExplanation: string;
  deployer: string;
  observation: string;
};

export type CaseFact = {
  label: string;
  value: string;
  state?: EvidenceState;
};

export type CaseFileSocial = SocialBase & {
  family: "case-file";
  caseId: string;
  literalSummary: string;
  facts: readonly CaseFact[];
  evidenceBoundary: "PATTERN · NOT A VERDICT";
};

export type RatFoundSocial = SocialBase & {
  family: "rat-found";
  literalFinding: string;
  evidenceStrip: string;
};

export type SocialContent = ReceiptSocial | CaseFileSocial | RatFoundSocial;

export const COPY_LIMITS = {
  common: {
    fixtureId: 48,
    sourceLabel: 28,
    sourceValue: 120,
    cta: 24
  },
  receipt: {
    receiptId: 24,
    headline: 38,
    literalExplanation: 170,
    deployer: 96,
    observation: 96
  },
  caseFile: {
    caseId: 24,
    headline: 42,
    literalSummary: 200,
    factCountMin: 3,
    factCountMax: 5,
    factLabel: 18,
    factValue: 96,
    evidenceBoundary: 24
  },
  ratFound: {
    headline: 24,
    literalFinding: 150,
    evidenceStrip: 96
  }
} as const;

export const CTA_LABEL_BY_ACTION: Readonly<Record<CtaAction, CtaLabel>> = {
  OPEN_RECEIPTS: "OPEN RECEIPTS →",
  OPEN_CASE: "OPEN CASE →",
  DIG_DEEPER: "DIG DEEPER →"
};

export const SAFE_AREA = {
  wide: { x: 58, y: 48 },
  square: { x: 58, y: 54 },
  note: "Copy/evidence must remain inside this inset. Rat artwork may bleed; literal copy may not."
} as const;

export const WRAP_RULES = {
  headline: "wrap naturally; never ellipsize; apply long-copy density class above 28 characters",
  addressOrHash: "show complete value; overflow-wrap:anywhere; minimum 11px mono; no middle ellipsis in proof cards",
  source: "wrap to multiple lines; never suppress state; full source value remains visible",
  literal: "wrap naturally; never clamp or ellipsize",
  cta: "single line only; validator rejects labels over 24 characters"
} as const;
