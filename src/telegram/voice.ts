import { createHash } from 'node:crypto';
import type { RatIntent } from './nlp.js';

export const RAT_VOICE_RENDERER_VERSION = 'binrat.rat-voice/0.2';
export const RAT_ANSWER_PLAN_VERSION = 'binrat.rat-answer-plan/0.2';

export type RatMood =
  | 'RUMMAGING'
  | 'DIGGING'
  | 'STUCK_IN_A_PIPE'
  | 'EMPTY_PAWS'
  | 'SMELLS_FAMILIAR'
  | 'BOUNDARY'
  | 'NEUTRAL';

type NoFacts = Record<string, never>;

export interface RatFactsByIntent {
  HELP: NoFacts;
  STATUS: {
    index: string;
    launchCount: number;
    checkpointBlock: string;
    history: string;
    observations: string;
    telegramStatus: string;
    indexError?: string;
    observationError?: string;
  };
  ROADMAP: {
    intelligenceV1: string;
    replayLab: string;
    telegramRatV0: string;
    dumpsterLedger: string;
    ratDenV0: string;
    ratWatchV0: string;
    dumpsterRaidsV0: string;
    launchAuthorization: string;
  };
  WHY: { site: string };
  TOKEN: {
    tokenState: string;
    launchAuthorization: string;
    marketingAuthorized: string;
    launchAuthorized: string;
    tokenMessage: string;
    invariant: string;
  };
  PROOF: { invariant: string };
  CREATOR_HISTORY:
    | { invalidInput: true }
    | { notFound: true }
    | {
        creator: string;
        indexedLaunchCount: number;
        firstIndexedBlock: string;
        lastIndexedBlock: string;
        historyCoverage: string;
        receipt: string;
        identityRiskLanguage: boolean;
      };
  ADDRESS_LOOKUP: {
    address: string;
    role: 'TOKEN' | 'POOL' | 'REPORTED_CREATOR' | 'AMBIGUOUS' | 'UNKNOWN';
    roles: string;
  };
  BAG:
    | { invalidInput: true }
    | { notFound: true }
    | {
        symbol: string;
        name: string;
        launchId: string;
        creator: string;
        priorLaunchCount: number;
        historyCoverage: string;
        receipt: string;
      };
  RECEIPT:
    | { invalidInput: true }
    | { notFound: true }
    | {
        launchId: string;
        receipt: string;
        asOfBlock: string;
        historyCoverage: string;
      };
  REPLAY:
    | { invalidInput: true }
    | { notFound: true }
    | {
        symbol: string;
        name: string;
        stages: string;
        observationCoverage: string;
        historyCoverage: string;
        receipt: string;
      };
  BUY_BOUNDARY: NoFacts;
  SAFETY_BOUNDARY: NoFacts;
  CLARIFY: NoFacts;
}

interface RatAnswerPlanBase<I extends RatIntent> {
  schemaVersion: typeof RAT_ANSWER_PLAN_VERSION;
  intent: I;
  mood: RatMood;
  facts: RatFactsByIntent[I];
  receiptIds: string[];
  caveats: string[];
  sourceRefs: string[];
}

export type RatAnswerPlan = {
  [I in RatIntent]: RatAnswerPlanBase<I>
}[RatIntent];

export interface RenderedRatReply {
  text: string;
  rendererVersion: typeof RAT_VOICE_RENDERER_VERSION;
  voiceVariant: number;
  replyDigest: string;
  planDigest: string;
  answerPlan: RatAnswerPlan;
  intent: RatIntent;
  receiptIds: string[];
}

const OPENINGS: Record<RatMood, readonly string[]> = {
  RUMMAGING: [
    '🐀 dug through the bin.',
    '🐀 found the receipt pile.',
    '🐀 smelled something. checked it.'
  ],
  DIGGING: [
    '🐀 still digging.',
    '🐀 paws are in the old bags.',
    '🐀 the older trash is still coming in.'
  ],
  STUCK_IN_A_PIPE: [
    '🐀 hit a pipe.',
    '🐀 the bin is making bad noises.',
    '🐀 read plane is coughing.'
  ],
  EMPTY_PAWS: [
    '🐀 came back with empty paws.',
    '🐀 no matching scrap in the bin.',
    '🐀 found lint. not evidence.'
  ],
  SMELLS_FAMILIAR: [
    '🐀 smelled familiar. checked anyway.',
    '🐀 this address has been near the bin before.',
    '🐀 old scent. fresh receipt.'
  ],
  BOUNDARY: [
    '🐀 wrong job for a rat.',
    '🐀 receipts, not prophecies.',
    '🐀 i dig. i do not divine.'
  ],
  NEUTRAL: [
    '🐀 bin report.',
    '🐀 reporting from the dumpster.',
    '🐀 receipt first.'
  ]
};

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
}

function line(label: string, value: string | number): string {
  return `${label}: ${value}`;
}

function hasFlag<T extends string>(facts: object, key: T): boolean {
  return key in facts && (facts as Record<string, unknown>)[key] === true;
}

export function makeRatAnswerPlan<I extends RatIntent>(
  intent: I,
  mood: RatMood,
  facts: RatFactsByIntent[I],
  receiptIds: string[] = [],
  caveats: string[] = [],
  sourceRefs: string[] = []
): Extract<RatAnswerPlan, { intent: I }> {
  return {
    schemaVersion: RAT_ANSWER_PLAN_VERSION,
    intent,
    mood,
    facts,
    receiptIds,
    caveats,
    sourceRefs
  } as Extract<RatAnswerPlan, { intent: I }>;
}

export function validateRatAnswerPlan(plan: RatAnswerPlan): void {
  if (plan.schemaVersion !== RAT_ANSWER_PLAN_VERSION) throw new Error('RAT_PLAN_SCHEMA_INVALID');
  if (!plan.intent || !plan.mood) throw new Error('RAT_PLAN_INVALID');
  if (!plan.facts || typeof plan.facts !== 'object' || Array.isArray(plan.facts)) throw new Error('RAT_PLAN_FACTS_INVALID');
  for (const receiptId of plan.receiptIds) {
    if (!/^binrat-(?:public|creator|intelligence|replay):[0-9a-f]+$/i.test(receiptId)) {
      throw new Error('RAT_PLAN_RECEIPT_INVALID');
    }
  }
}

function bodyFor(plan: RatAnswerPlan): string[] {
  switch (plan.intent) {
    case 'WHY':
      return [
        'BINRAT remembers what launches try to forget.',
        '',
        'creator history. point-in-time observations. trash trails. replayable receipts.',
        'no SAFE/RUG score. no BUY/SELL call. evidence first.',
        '',
        plan.facts.site
      ];
    case 'ROADMAP':
      return [
        line('Intelligence V1', plan.facts.intelligenceV1),
        line('Replay Lab', plan.facts.replayLab),
        line('Telegram Rat V0', plan.facts.telegramRatV0),
        line('Dumpster Ledger', plan.facts.dumpsterLedger),
        line('Rat Den V0', plan.facts.ratDenV0),
        line('Rat Watch V0', plan.facts.ratWatchV0),
        line('Dumpster Raids V0', plan.facts.dumpsterRaidsV0),
        '',
        line('launch authorization', plan.facts.launchAuthorization)
      ];
    case 'TOKEN':
      return [
        line('token state', plan.facts.tokenState),
        line('launch authorization', plan.facts.launchAuthorization),
        line('marketing authorized', plan.facts.marketingAuthorized),
        line('launch authorized', plan.facts.launchAuthorized),
        '',
        plan.facts.tokenMessage,
        'Rat Credits are separate, off-chain, non-transferable contribution/coordination units; they are not equity, revenue share, or yield.',
        '',
        line('rule', plan.facts.invariant)
      ];
    case 'PROOF':
      return [
        'receipts > scores.',
        'missing evidence != good evidence.',
        'future data cannot leak into past views.',
        'token ownership cannot buy factual authority.',
        'core evidence does not change because a chart does.',
        '',
        plan.facts.invariant
      ];
    case 'HELP':
      return [
        'ask me like a person or use commands:',
        '',
        '/status — live index state',
        '/roadmap — canonical capability state',
        '/token — launch/token state',
        '/creator 0x... — creator file',
        '/bag <launch-id> — launch summary',
        '/replay <launch-id> — launch → 5m → 1h → 24h',
        '/receipt <launch-id> — public receipt',
        '/watch 0x... — alert on a future launch from this indexed reported creator address',
        '/unwatch 0x... — stop watching that reported address',
        '/watches — list this chat\'s watched reported addresses',
        '/proof — rules of the bin'
      ];
    case 'STATUS':
      return [
        line('index', plan.facts.index),
        line('launches indexed', plan.facts.launchCount),
        line('checkpoint block', plan.facts.checkpointBlock),
        line('historical backfill', plan.facts.history),
        line('observations', plan.facts.observations),
        line('Telegram Rat capability', plan.facts.telegramStatus),
        ...(plan.facts.indexError ? [line('index error', plan.facts.indexError)] : []),
        ...(plan.facts.observationError ? [line('observation error', plan.facts.observationError)] : [])
      ];
    case 'CREATOR_HISTORY':
      if (hasFlag(plan.facts, 'notFound')) return ['no indexed Creator File for that address. unknown is not clean.'];
      if (hasFlag(plan.facts, 'invalidInput')) return ['invalid creator address. expected 0x + 40 hex characters.'];
      if ('creator' in plan.facts) {
        return [
          line('reported creator', plan.facts.creator),
          line('indexed launches', plan.facts.indexedLaunchCount),
          line('first indexed block', plan.facts.firstIndexedBlock),
          line('last indexed block', plan.facts.lastIndexedBlock),
          line('history coverage', plan.facts.historyCoverage),
          line('receipt', plan.facts.receipt),
          '',
          'same source-reported address only. not proof of common human identity.',
          ...(plan.facts.identityRiskLanguage
            ? ['wallet history is evidence about an address, not a criminal record about a person.']
            : [])
        ];
      }
      return ['creator evidence unavailable.'];
    case 'ADDRESS_LOOKUP':
      if (plan.facts.role === 'UNKNOWN') {
        return [
          line('address', plan.facts.address),
          'not indexed as a token, pool, or ArcPad-reported creator address.',
          'unknown is not clean.'
        ];
      }
      if (plan.facts.role === 'AMBIGUOUS') {
        return [
          line('address', plan.facts.address),
          line('indexed roles', plan.facts.roles),
          '',
          'same bytes, multiple meanings. tell me whether you mean token, pool, or creator.'
        ];
      }
      return [
        line('address', plan.facts.address),
        line('indexed role', plan.facts.role),
        '',
        'i found the role but no deeper projection was available.'
      ];
    case 'BAG':
      if (hasFlag(plan.facts, 'notFound')) return ['no indexed launch with that id.'];
      if (hasFlag(plan.facts, 'invalidInput')) return ['give me a valid launch id.'];
      if ('launchId' in plan.facts) {
        return [
          `${plan.facts.symbol} — ${plan.facts.name}`,
          line('launch', plan.facts.launchId),
          line('reported creator', plan.facts.creator),
          line('prior launches from same reported address', plan.facts.priorLaunchCount),
          line('history coverage', plan.facts.historyCoverage),
          line('receipt', plan.facts.receipt)
        ];
      }
      return ['launch evidence unavailable.'];
    case 'RECEIPT':
      if (hasFlag(plan.facts, 'notFound')) return ['no indexed launch with that id.'];
      if (hasFlag(plan.facts, 'invalidInput')) return ['give me a valid launch id.'];
      if ('launchId' in plan.facts) {
        return [
          line('launch', plan.facts.launchId),
          line('receipt', plan.facts.receipt),
          line('as-of block', plan.facts.asOfBlock),
          line('history coverage', plan.facts.historyCoverage)
        ];
      }
      return ['receipt unavailable.'];
    case 'REPLAY':
      if (hasFlag(plan.facts, 'notFound')) return ['no replayable indexed launch with that id.'];
      if (hasFlag(plan.facts, 'invalidInput')) return ['give me a launch id and i will walk the bag through time.'];
      if ('stages' in plan.facts) {
        return [
          `${plan.facts.symbol} — ${plan.facts.name}`,
          line('stages', plan.facts.stages),
          line('observation coverage', plan.facts.observationCoverage),
          line('history coverage', plan.facts.historyCoverage),
          line('replay receipt', plan.facts.receipt),
          '',
          'missing stages stay missing. nothing is simulated.'
        ];
      }
      return ['replay unavailable.'];
    case 'BUY_BOUNDARY':
      return [
        'i archive garbage. i do not predict candles.',
        '',
        'no buy call. no sell call. no entry. give me a launch or creator and i will show you the receipts.'
      ];
    case 'SAFETY_BOUNDARY':
      return [
        '“safe” is not something BINRAT can prove.',
        '',
        'i can show creator history, observations, coverage and receipts. you decide what they mean.'
      ];
    case 'CLARIFY':
      return [
        'didn’t catch the scent.',
        '',
        'try: “rat what shipped?”, “rat wen token?”, “rat what happened to <launch-id>?”, or “rat check creator 0x…”'
      ];
  }
}

function assertRenderedBoundary(text: string): void {
  const forbidden = [
    /\b(?:you should|i recommend)\s+(?:buy|sell|ape)\b/i,
    /\b(?:is|looks|seems)\s+safe\b/i,
    /\b(?:is|looks|seems)\s+(?:a\s+)?(?:scam|rug|rugger)\b/i,
    /\bwill\s+(?:pump|moon|go up)\b/i,
    /\bguaranteed returns?\b/i
  ];
  if (forbidden.some((pattern) => pattern.test(text))) throw new Error('RAT_VOICE_INVARIANT_VIOLATION');
}

export function renderRatVoice(plan: RatAnswerPlan): RenderedRatReply {
  validateRatAnswerPlan(plan);
  const planDigest = digest(canonical(plan));
  const seed = `${RAT_VOICE_RENDERER_VERSION}|${planDigest}`;
  const seedDigest = digest(seed);
  const openings = OPENINGS[plan.mood];
  const voiceVariant = Number.parseInt(seedDigest.slice(0, 8), 16) % openings.length;

  const lines = [
    openings[voiceVariant]!,
    '',
    ...bodyFor(plan),
    ...(plan.caveats.length ? ['', ...plan.caveats] : [])
  ];
  const text = lines.join('\n').trim();
  assertRenderedBoundary(text);

  return {
    text,
    rendererVersion: RAT_VOICE_RENDERER_VERSION,
    voiceVariant,
    replyDigest: digest(text),
    planDigest,
    answerPlan: plan,
    intent: plan.intent,
    receiptIds: [...plan.receiptIds]
  };
}
