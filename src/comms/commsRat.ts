export const COMMS_LIFECYCLE_STATES = [
  'EXPERIMENTAL',
  'PLANNED',
  'BUILDING',
  'ENGINEERING_PASS',
  'DEPLOYED',
  'PUBLIC_LIVE',
  'BLOCKED',
  'DEPRECATED',
  'REJECTED',
] as const;

export type CommsLifecycleState = (typeof COMMS_LIFECYCLE_STATES)[number];

export const COMMS_EVENT_TYPES = [
  'FEATURE_CHANGE',
  'FORENSIC_FINDING',
  'CASE_PUBLISHED',
  'ROADMAP_UPDATE',
  'RELEASE',
  'MANUAL_STORY',
] as const;

export type CommsEventType = (typeof COMMS_EVENT_TYPES)[number];
export type CommsVisibility = 'INTERNAL' | 'HOLD' | 'PUBLIC_OK';
export type CommsRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type CommsDecisionKind = 'POST' | 'QUEUE' | 'IGNORE';
export type CommsEvidenceKind =
  | 'PR'
  | 'COMMIT'
  | 'CI'
  | 'DEPLOYMENT'
  | 'RECEIPT'
  | 'DOC'
  | 'PRODUCT_STATUS';

export interface CommsEvidenceRef {
  kind: CommsEvidenceKind;
  ref: string;
  status?: 'PASS' | 'FAIL' | 'UNKNOWN';
}

export interface CommsEvent {
  id: string;
  occurredAt: string;
  type: CommsEventType;
  lifecycle: CommsLifecycleState;
  visibility: CommsVisibility;
  publicAuthorized: boolean;
  headline: string;
  summary: string;
  userValue: 0 | 1 | 2 | 3;
  novelty: 0 | 1 | 2 | 3;
  repetitionPenalty: 0 | 1 | 2 | 3;
  risk: CommsRisk;
  evidence: CommsEvidenceRef[];
}

export interface CommsDecision {
  decision: CommsDecisionKind;
  score: number;
  reasons: string[];
}

export interface ChannelDrafts {
  x: string;
  telegram: string;
}

export interface ClaimViolation {
  code:
    | 'NO_PUBLIC_AUTHORITY'
    | 'NO_EVIDENCE'
    | 'BANNED_LANGUAGE'
    | 'CAPABILITY_STATUS_UPGRADE';
  message: string;
  matched?: string;
}

export interface ShadowPostBundle {
  version: 'binrat.comms.shadow/1';
  eventId: string;
  createdAt: string;
  lifecycle: CommsLifecycleState;
  triageDecision: CommsDecisionKind;
  decision: CommsDecisionKind;
  score: number;
  reasons: string[];
  evidence: CommsEvidenceRef[];
  drafts: ChannelDrafts;
  violations: ClaimViolation[];
  requiresHumanApproval: true;
  publishAllowed: false;
}

const ACTIVE_RANK: Partial<Record<CommsLifecycleState, number>> = {
  EXPERIMENTAL: 0,
  PLANNED: 1,
  BUILDING: 2,
  ENGINEERING_PASS: 3,
  DEPLOYED: 4,
  PUBLIC_LIVE: 5,
};

const BANNED_PATTERNS: RegExp[] = [
  /\bsmart money\b/i,
  /\bgood buy\b/i,
  /\bbad buy\b/i,
  /\bbuy now\b/i,
  /\bsell now\b/i,
  /\bape in\b/i,
  /\bape this\b/i,
  /\bsafe\b/i,
  /\brug score\b/i,
  /\brugger\b/i,
  /\bscammer\b/i,
  /\bguaranteed (?:returns|yield|apy|listing|price appreciation)\b/i,
  /\bnext 100x\b/i,
  /\bgem found\b/i,
  /\balpha found\b/i,
  /\bwhale move\b/i,
  /\btrade smarter\b/i,
  /\bnever miss the next gem\b/i,
  /\btrust the rat\b/i,
  /\bcutting[- ]edge\b/i,
  /\bgame[- ]changing\b/i,
  /\brevolutionary\b/i,
  /\bnext[- ]generation\b/i,
  /\bnext gen\b/i,
  /\bstate[- ]of[- ]the[- ]art intelligence\b/i,
  /\bunparalleled insights\b/i,
  /\bactionable alpha\b/i,
  /\bunlock alpha\b/i,
  /\balpha engine\b/i,
  /\bai[- ]powered\b/i,
  /\bai driven\b/i,
  /\bpowered by ai\b/i,
  /\bintelligent insights\b/i,
  /\bmake smarter trades\b/i,
  /\btrade with confidence\b/i,
  /\bedge the market\b/i,
  /\bbeat the market\b/i,
  /\binstitutional[- ]grade alpha\b/i,
  /\bone[- ]stop shop\b/i,
  /\bseamless experience\b/i,
  /\becosystem of intelligence\b/i,
  /\bweb3 intelligence platform\b/i,
  /\bcrypto intelligence revolution\b/i,
];

const STATUS_PATTERNS: Array<{
  minimum: 'BUILDING' | 'ENGINEERING_PASS' | 'DEPLOYED' | 'PUBLIC_LIVE';
  pattern: RegExp;
  label: string;
}> = [
  { minimum: 'BUILDING', pattern: /\bbuilding\b/i, label: 'BUILDING' },
  {
    minimum: 'ENGINEERING_PASS',
    pattern: /\bengineering[_ -]?pass\b|\bpassed engineering\b/i,
    label: 'ENGINEERING_PASS',
  },
  { minimum: 'DEPLOYED', pattern: /\bdeployed\b/i, label: 'DEPLOYED' },
  {
    minimum: 'PUBLIC_LIVE',
    pattern: /\bpublic[_ -]?live\b|\blive\b|\bshipped\b|\bavailable now\b|\buse it now\b/i,
    label: 'PUBLIC_LIVE',
  },
];

function activeRank(state: CommsLifecycleState): number | null {
  return ACTIVE_RANK[state] ?? null;
}

function isNegatedStatusMatch(text: string, index: number): boolean {
  const prefix = text.slice(Math.max(0, index - 40), index).toLowerCase();
  return (
    /\b(?:not|never)\s+(?:(?:yet|currently|publicly|actually|being|posted|made|marked|considered|called)\s+){0,3}$/.test(
      prefix,
    ) ||
    /\bisn['’]?t\s+(?:(?:yet|currently|publicly|actually|being|posted|made|marked|considered|called)\s+){0,3}$/.test(
      prefix,
    ) ||
    /\bwithout\s+(?:(?:being|going)\s+){0,2}$/.test(prefix)
  );
}

function firstAffirmativeStatusMatch(text: string, pattern: RegExp): RegExpExecArray | null {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);

  for (const match of text.matchAll(globalPattern)) {
    if (!isNegatedStatusMatch(text, match.index ?? 0)) return match;
  }

  return null;
}

function evidenceStrength(evidence: CommsEvidenceRef[]): number {
  if (evidence.length === 0) return 0;

  let score = 0;

  if (
    evidence.some(
      (item) =>
        item.status !== 'FAIL' &&
        (item.kind === 'PR' || item.kind === 'COMMIT' || item.kind === 'DOC'),
    )
  ) {
    score += 1;
  }
  if (evidence.some((item) => item.kind === 'CI' && item.status === 'PASS')) {
    score += 1;
  }
  if (
    evidence.some(
      (item) =>
        (item.kind === 'RECEIPT' && item.status !== 'FAIL') ||
        ((item.kind === 'DEPLOYMENT' || item.kind === 'PRODUCT_STATUS') &&
          item.status === 'PASS'),
    )
  ) {
    score += 1;
  }

  return Math.min(score, 3);
}

export function triageCommsEvent(event: CommsEvent): CommsDecision {
  const reasons: string[] = [];

  if (event.visibility === 'INTERNAL') {
    return { decision: 'IGNORE', score: 0, reasons: ['event is internal-only'] };
  }

  if (event.lifecycle === 'REJECTED') {
    return { decision: 'IGNORE', score: 0, reasons: ['event is rejected'] };
  }

  const evidenceScore = evidenceStrength(event.evidence);
  const riskPenalty = event.risk === 'MEDIUM' ? 1 : 0;
  const score = Math.max(
    0,
    event.userValue + event.novelty + evidenceScore - event.repetitionPenalty - riskPenalty,
  );

  if (event.visibility === 'HOLD') reasons.push('event is explicitly on hold');
  if (!event.publicAuthorized) reasons.push('public communication is not authorized');
  if (event.evidence.length === 0) reasons.push('no receipt or evidence reference is attached');
  if (event.lifecycle === 'EXPERIMENTAL' || event.lifecycle === 'PLANNED') {
    reasons.push('early lifecycle state requires human editorial judgment');
  }
  if (event.lifecycle === 'BLOCKED') reasons.push('blocked state requires manual framing');
  if (event.risk === 'HIGH') reasons.push('high-risk topic requires human review');

  if (
    event.visibility === 'HOLD' ||
    !event.publicAuthorized ||
    event.evidence.length === 0 ||
    event.lifecycle === 'EXPERIMENTAL' ||
    event.lifecycle === 'PLANNED' ||
    event.lifecycle === 'BLOCKED' ||
    event.risk === 'HIGH'
  ) {
    return { decision: 'QUEUE', score, reasons };
  }

  if (score >= 7) {
    reasons.push('high user value / novelty / evidence score');
    return { decision: 'POST', score, reasons };
  }

  if (score >= 4) {
    reasons.push('potentially useful, but not strong enough for immediate publication');
    return { decision: 'QUEUE', score, reasons };
  }

  reasons.push('low public value after repetition/risk penalties');
  return { decision: 'IGNORE', score, reasons };
}

function receiptsLine(evidence: CommsEvidenceRef[]): string {
  if (evidence.length === 0) return 'Receipts: MISSING';
  return `Receipts: ${evidence
    .slice(0, 3)
    .map((item) => `${item.kind} ${item.ref}`)
    .join(' · ')}`;
}

export function buildBaselineDrafts(event: CommsEvent): ChannelDrafts {
  const receipt = receiptsLine(event.evidence);

  return {
    x: [event.headline, `${event.lifecycle}: ${event.summary}`, receipt].join('\n\n'),
    telegram: [
      'BINRAT UPDATE',
      event.headline,
      `Status: ${event.lifecycle}`,
      event.summary,
      receipt,
    ].join('\n\n'),
  };
}

export function validateDraftText(text: string, event: CommsEvent): ClaimViolation[] {
  const violations: ClaimViolation[] = [];

  if (!event.publicAuthorized) {
    violations.push({
      code: 'NO_PUBLIC_AUTHORITY',
      message: 'The event is not authorized for public communication.',
    });
  }

  if (event.evidence.length === 0) {
    violations.push({
      code: 'NO_EVIDENCE',
      message: 'Public factual copy requires at least one evidence reference.',
    });
  }

  for (const pattern of BANNED_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push({
        code: 'BANNED_LANGUAGE',
        message: 'Draft contains Brand V1 banned language.',
        matched: match[0],
      });
    }
  }

  const rank = activeRank(event.lifecycle);
  for (const rule of STATUS_PATTERNS) {
    const match = firstAffirmativeStatusMatch(text, rule.pattern);
    if (!match) continue;

    const requiredRank = ACTIVE_RANK[rule.minimum]!;
    if (rank === null || rank < requiredRank) {
      violations.push({
        code: 'CAPABILITY_STATUS_UPGRADE',
        message: `Draft claims ${rule.label} while event lifecycle is ${event.lifecycle}.`,
        matched: match[0],
      });
    }
  }

  return violations;
}

export function buildShadowPostBundle(
  event: CommsEvent,
  drafts: ChannelDrafts = buildBaselineDrafts(event),
  now = new Date().toISOString(),
): ShadowPostBundle {
  const triage = triageCommsEvent(event);
  const violations = [
    ...validateDraftText(drafts.x, event),
    ...validateDraftText(drafts.telegram, event),
  ];

  const decision: CommsDecisionKind =
    triage.decision === 'POST' && violations.length > 0 ? 'QUEUE' : triage.decision;

  const reasons = [...triage.reasons];
  if (triage.decision === 'POST' && decision === 'QUEUE') {
    reasons.push('claim validation failed; publication downgraded to queue');
  }

  return {
    version: 'binrat.comms.shadow/1',
    eventId: event.id,
    createdAt: now,
    lifecycle: event.lifecycle,
    triageDecision: triage.decision,
    decision,
    score: triage.score,
    reasons,
    evidence: event.evidence,
    drafts,
    violations,
    requiresHumanApproval: true,
    publishAllowed: false,
  };
}
