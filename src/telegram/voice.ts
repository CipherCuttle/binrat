import { createHash } from 'node:crypto';
import type { RatIntent } from './nlp.js';

export const RAT_VOICE_RENDERER_VERSION = 'binrat.rat-voice/0.1';

export type RatMood =
  | 'RUMMAGING'
  | 'DIGGING'
  | 'STUCK_IN_A_PIPE'
  | 'EMPTY_PAWS'
  | 'SMELLS_FAMILIAR'
  | 'BOUNDARY'
  | 'NEUTRAL';

export interface RatAnswerPlan {
  schemaVersion: 'binrat.rat-answer-plan/0.1';
  intent: RatIntent;
  mood: RatMood;
  facts: Record<string, string | number | boolean>;
  receiptIds: string[];
  caveats: string[];
  sourceRefs: string[];
}

export interface RenderedRatReply {
  text: string;
  rendererVersion: typeof RAT_VOICE_RENDERER_VERSION;
  voiceVariant: number;
  replyDigest: string;
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

function stableFacts(facts: RatAnswerPlan['facts']): string {
  return Object.keys(facts).sort().map((key) => `${key}=${String(facts[key])}`).join('|');
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function fact(plan: RatAnswerPlan, key: string, fallback = 'UNKNOWN'): string {
  const value = plan.facts[key];
  return value === undefined ? fallback : String(value);
}

function line(label: string, value: string): string {
  return `${label}: ${value}`;
}

export function validateRatAnswerPlan(plan: RatAnswerPlan): void {
  if (plan.schemaVersion !== 'binrat.rat-answer-plan/0.1') throw new Error('RAT_PLAN_SCHEMA_INVALID');
  if (!plan.intent || !plan.mood) throw new Error('RAT_PLAN_INVALID');
  for (const [key, value] of Object.entries(plan.facts)) {
    if (!key || !['string', 'number', 'boolean'].includes(typeof value)) throw new Error('RAT_PLAN_FACT_INVALID');
  }
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
        fact(plan, 'site')
      ];
    case 'ROADMAP':
      return [
        line('Intelligence V1', fact(plan, 'intelligenceV1')),
        line('Replay Lab', fact(plan, 'replayLab')),
        line('Telegram Rat V0', fact(plan, 'telegramRatV0')),
        line('Dumpster Ledger', fact(plan, 'dumpsterLedger')),
        line('Rat Den V0', fact(plan, 'ratDenV0')),
        line('Rat Watch V0', fact(plan, 'ratWatchV0')),
        line('Dumpster Raids V0', fact(plan, 'dumpsterRaidsV0')),
        '',
        line('launch authorization', fact(plan, 'launchAuthorization'))
      ];
    case 'TOKEN':
      return [
        line('token state', fact(plan, 'tokenState')),
        line('launch authorization', fact(plan, 'launchAuthorization')),
        line('marketing authorized', fact(plan, 'marketingAuthorized')),
        line('launch authorized', fact(plan, 'launchAuthorized')),
        '',
        fact(plan, 'tokenMessage'),
        'Rat Credits are separate, off-chain, non-transferable contribution/coordination units; they are not equity, revenue share, or yield.',
        '',
        line('rule', fact(plan, 'invariant'))
      ];
    case 'PROOF':
      return [
        'receipts > scores.',
        'missing evidence != good evidence.',
        'future data cannot leak into past views.',
        'token ownership cannot buy factual authority.',
        'core evidence does not change because a chart does.',
        '',
        fact(plan, 'invariant')
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
        '/proof — rules of the bin'
      ];
    case 'STATUS':
      return [
        line('index', fact(plan, 'index')),
        line('launches indexed', fact(plan, 'launchCount')),
        line('checkpoint block', fact(plan, 'checkpointBlock')),
        line('historical backfill', fact(plan, 'history')),
        line('observations', fact(plan, 'observations')),
        line('Telegram Rat capability', fact(plan, 'telegramStatus')),
        ...(plan.facts.indexError ? [line('index error', fact(plan, 'indexError'))] : []),
        ...(plan.facts.observationError ? [line('observation error', fact(plan, 'observationError'))] : [])
      ];
    case 'CREATOR_HISTORY':
      if (plan.facts.notFound) return ['no indexed Creator File for that address. unknown is not clean.'];
      if (plan.facts.invalidInput) return ['invalid creator address. expected 0x + 40 hex characters.'];
      return [
        line('reported creator', fact(plan, 'creator')),
        line('indexed launches', fact(plan, 'indexedLaunchCount')),
        line('first indexed block', fact(plan, 'firstIndexedBlock')),
        line('last indexed block', fact(plan, 'lastIndexedBlock')),
        line('history coverage', fact(plan, 'historyCoverage')),
        line('receipt', fact(plan, 'receipt')),
        '',
        'same source-reported address only. not proof of common human identity.',
        ...(plan.facts.identityRiskLanguage
          ? ['wallet history is evidence about an address, not a criminal record about a person.']
          : [])
      ];
    case 'BAG':
      if (plan.facts.notFound) return ['no indexed launch with that id.'];
      if (plan.facts.invalidInput) return ['give me a valid launch id.'];
      return [
        `${fact(plan, 'symbol', '?')} — ${fact(plan, 'name', 'unnamed')}`,
        line('launch', fact(plan, 'launchId')),
        line('reported creator', fact(plan, 'creator')),
        line('prior launches from same reported address', fact(plan, 'priorLaunchCount')),
        line('history coverage', fact(plan, 'historyCoverage')),
        line('receipt', fact(plan, 'receipt'))
      ];
    case 'RECEIPT':
      if (plan.facts.notFound) return ['no indexed launch with that id.'];
      if (plan.facts.invalidInput) return ['give me a valid launch id.'];
      return [
        line('launch', fact(plan, 'launchId')),
        line('receipt', fact(plan, 'receipt')),
        line('as-of block', fact(plan, 'asOfBlock')),
        line('history coverage', fact(plan, 'historyCoverage'))
      ];
    case 'REPLAY':
      if (plan.facts.notFound) return ['no replayable indexed launch with that id.'];
      if (plan.facts.invalidInput) return ['give me a launch id and i will walk the bag through time.'];
      return [
        `${fact(plan, 'symbol', '?')} — ${fact(plan, 'name', 'unnamed')}`,
        line('stages', fact(plan, 'stages')),
        line('observation coverage', fact(plan, 'observationCoverage')),
        line('history coverage', fact(plan, 'historyCoverage')),
        line('replay receipt', fact(plan, 'receipt')),
        '',
        'missing stages stay missing. nothing is simulated.'
      ];
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
  const seed = [
    RAT_VOICE_RENDERER_VERSION,
    plan.intent,
    plan.mood,
    stableFacts(plan.facts),
    [...plan.receiptIds].sort().join(','),
    [...plan.sourceRefs].sort().join(',')
  ].join('|');
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
    intent: plan.intent,
    receiptIds: [...plan.receiptIds]
  };
}
