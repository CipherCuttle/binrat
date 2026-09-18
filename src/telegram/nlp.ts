import nlp from 'compromise';

const ADDRESS_RE = /\b0x[0-9a-fA-F]{40}\b/;
const BAG_ID_RE = /\b[0-9a-fA-F]{64}\b/;
const MAX_NLP_CHARS = 4096;

export type RatIntent =
  | 'HELP'
  | 'STATUS'
  | 'ROADMAP'
  | 'WHY'
  | 'TOKEN'
  | 'PROOF'
  | 'CREATOR_HISTORY'
  | 'BAG'
  | 'RECEIPT'
  | 'REPLAY'
  | 'BUY_BOUNDARY'
  | 'SAFETY_BOUNDARY'
  | 'CLARIFY';

export interface RatUnderstanding {
  intent: RatIntent;
  argument: string;
  confidence: number;
  explicitCommand: boolean;
  identityRiskLanguage: boolean;
}

const COMMANDS: Record<string, RatIntent> = {
  start: 'HELP',
  help: 'HELP',
  faq: 'HELP',
  status: 'STATUS',
  roadmap: 'ROADMAP',
  why: 'WHY',
  token: 'TOKEN',
  proof: 'PROOF',
  creator: 'CREATOR_HISTORY',
  bag: 'BAG',
  receipt: 'RECEIPT',
  replay: 'REPLAY'
};

function containsRatReference(text: string): boolean {
  return /(^|\W)(binrat|rat)(\W|$)/i.test(text) || /\$binrat\b/i.test(text);
}

function hasAny(doc: ReturnType<typeof nlp>, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => doc.has(pattern));
}

export function understandRatMessage(text: string): RatUnderstanding | null {
  const normalized = text.trim().slice(0, MAX_NLP_CHARS);
  if (!normalized) return null;

  if (normalized.startsWith('/')) {
    const [rawCommand, ...rest] = normalized.split(/\s+/);
    const command = rawCommand!.slice(1).split('@')[0]!.toLowerCase();
    const intent = COMMANDS[command];
    if (!intent) return { intent: 'CLARIFY', argument: '', confidence: 1, explicitCommand: true, identityRiskLanguage: false };
    return {
      intent,
      argument: rest.join(' ').trim(),
      confidence: 1,
      explicitCommand: true,
      identityRiskLanguage: /\b(scamm?er|rug(?:ger|ged)?|fraud)\b/i.test(normalized)
    };
  }

  const address = normalized.match(ADDRESS_RE)?.[0] ?? '';
  const bagId = normalized.match(BAG_ID_RE)?.[0] ?? '';
  if (!containsRatReference(normalized)) return null;

  const doc = nlp(normalized);
  const lower = normalized.toLowerCase();
  const identityRiskLanguage = /\b(scamm?er|rug(?:ger|ged)?|fraud|criminal|same (?:guy|person|human))\b/i.test(lower);

  if (
    hasAny(doc, ['{buy}', '{sell}', 'ape', 'snipe', 'entry']) ||
    /\bshould i (?:buy|sell|ape)\b/i.test(lower) ||
    /\bwen moon\b/i.test(lower)
  ) {
    return { intent: 'BUY_BOUNDARY', argument: '', confidence: 0.98, explicitCommand: false, identityRiskLanguage };
  }

  if (address && (
    identityRiskLanguage ||
    hasAny(doc, ['creator', 'developer', 'dev', 'wallet', '{launch}', 'history', 'before', 'previous'])
  )) {
    return { intent: 'CREATOR_HISTORY', argument: address, confidence: 0.95, explicitCommand: false, identityRiskLanguage };
  }

  if (
    hasAny(doc, ['safe', 'safety', 'scam', 'rug', 'rugger', 'honest', 'legit']) ||
    /\bis this (?:good|bad|dangerous)\b/i.test(lower)
  ) {
    return { intent: 'SAFETY_BOUNDARY', argument: address, confidence: 0.94, explicitCommand: false, identityRiskLanguage };
  }

  if (
    hasAny(doc, ['replay', 'timeline']) ||
    /\bwhat happened\b/i.test(lower) ||
    /\bafter (?:the )?launch\b/i.test(lower) ||
    /\b(5m|1h|24h)\b/i.test(lower)
  ) {
    return { intent: 'REPLAY', argument: bagId, confidence: 0.93, explicitCommand: false, identityRiskLanguage };
  }

  if (hasAny(doc, ['receipt', 'proof']) && bagId) {
    return { intent: 'RECEIPT', argument: bagId, confidence: 0.92, explicitCommand: false, identityRiskLanguage };
  }

  if (bagId && hasAny(doc, ['bag', 'launch', 'token'])) {
    return { intent: 'BAG', argument: bagId, confidence: 0.9, explicitCommand: false, identityRiskLanguage };
  }

  if (address) {
    return { intent: 'CREATOR_HISTORY', argument: address, confidence: 0.86, explicitCommand: false, identityRiskLanguage };
  }

  if (
    hasAny(doc, ['roadmap', 'coming', 'next', 'plan', 'planned']) ||
    /\bwhat(?:'s| is) next\b/i.test(lower)
  ) {
    return { intent: 'ROADMAP', argument: '', confidence: 0.9, explicitCommand: false, identityRiskLanguage };
  }

  if (
    hasAny(doc, ['token', 'coin', 'rat credit']) ||
    /\$binrat\b/i.test(normalized) ||
    /\bwen token\b/i.test(lower)
  ) {
    return { intent: 'TOKEN', argument: '', confidence: 0.9, explicitCommand: false, identityRiskLanguage };
  }

  if (
    hasAny(doc, ['status', 'progress', 'live', 'shipped', 'working', 'health']) ||
    /\bwhat have you (?:built|shipped)\b/i.test(lower)
  ) {
    return { intent: 'STATUS', argument: '', confidence: 0.88, explicitCommand: false, identityRiskLanguage };
  }

  if (
    hasAny(doc, ['why', 'purpose', 'point']) ||
    /\bwhat (?:is|does) binrat\b/i.test(lower) ||
    /\bwhy should (?:i|anyone) care\b/i.test(lower)
  ) {
    return { intent: 'WHY', argument: '', confidence: 0.88, explicitCommand: false, identityRiskLanguage };
  }

  if (hasAny(doc, ['proof', 'rules', 'doctrine', 'truth', 'evidence'])) {
    return { intent: 'PROOF', argument: '', confidence: 0.86, explicitCommand: false, identityRiskLanguage };
  }

  if (hasAny(doc, ['help', 'commands', 'what can you do'])) {
    return { intent: 'HELP', argument: '', confidence: 0.86, explicitCommand: false, identityRiskLanguage };
  }

  return { intent: 'CLARIFY', argument: '', confidence: 0.35, explicitCommand: false, identityRiskLanguage };
}
