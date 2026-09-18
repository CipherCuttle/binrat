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
  | 'ADDRESS_LOOKUP'
  | 'BAG'
  | 'RECEIPT'
  | 'REPLAY'
  | 'BUY_BOUNDARY'
  | 'SAFETY_BOUNDARY'
  | 'CLARIFY';

export type RatRoutingStrength = 'EXPLICIT' | 'STRONG_RULE' | 'AMBIGUOUS';

export interface RatConversationContext {
  allowUnaddressed?: boolean;
}

export interface RatUnderstanding {
  intent: RatIntent;
  argument: string;
  strength: RatRoutingStrength;
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

function result(
  intent: RatIntent,
  argument: string,
  strength: RatRoutingStrength,
  explicitCommand: boolean,
  identityRiskLanguage: boolean
): RatUnderstanding {
  return { intent, argument, strength, explicitCommand, identityRiskLanguage };
}

function containsRatReference(text: string): boolean {
  return /(^|\W)(binrat|rat)(\W|$)/i.test(text) || /\$binrat\b/i.test(text);
}

function hasAny(doc: ReturnType<typeof nlp>, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => doc.has(pattern));
}

export function understandRatMessage(
  text: string,
  context: RatConversationContext = {}
): RatUnderstanding | null {
  const normalized = text.trim().slice(0, MAX_NLP_CHARS);
  if (!normalized) return null;

  if (normalized.startsWith('/')) {
    const [rawCommand, ...rest] = normalized.split(/\s+/);
    const command = rawCommand!.slice(1).split('@')[0]!.toLowerCase();
    const intent = COMMANDS[command];
    if (!intent) return result('CLARIFY', '', 'EXPLICIT', true, false);
    return result(
      intent,
      rest.join(' ').trim(),
      'EXPLICIT',
      true,
      /\b(scamm?er|rug(?:ger|ged)?|fraud)\b/i.test(normalized)
    );
  }

  if (!containsRatReference(normalized) && context.allowUnaddressed !== true) return null;

  const address = normalized.match(ADDRESS_RE)?.[0] ?? '';
  const bagId = normalized.match(BAG_ID_RE)?.[0] ?? '';
  const doc = nlp(normalized);
  const lower = normalized.toLowerCase();
  const identityRiskLanguage = /\b(scamm?er|rug(?:ger|ged)?|fraud|criminal|same (?:guy|person|human))\b/i.test(lower);

  const tradingAdviceLanguage =
    /\bshould i\b[^?!.]{0,80}\b(?:buy|sell|ape)\b/i.test(lower) ||
    /\b(?:buy|sell|ape)\s+(?:this|it|now)\b/i.test(lower) ||
    /\bwen moon\b/i.test(lower) ||
    hasAny(doc, ['snipe', 'entry']);

  if (tradingAdviceLanguage) {
    return result('BUY_BOUNDARY', '', 'STRONG_RULE', false, identityRiskLanguage);
  }

  if (
    hasAny(doc, ['safe', 'safety', 'scam', 'rug', 'rugger', 'honest', 'legit']) ||
    /\bis this (?:good|bad|dangerous)\b/i.test(lower)
  ) {
    if (!address || !identityRiskLanguage) {
      return result('SAFETY_BOUNDARY', address, 'STRONG_RULE', false, identityRiskLanguage);
    }
  }

  if (address && (
    identityRiskLanguage ||
    hasAny(doc, ['creator', 'developer', 'dev', 'wallet', '{launch}', 'history', 'before', 'previous'])
  )) {
    return result('CREATOR_HISTORY', address, 'STRONG_RULE', false, identityRiskLanguage);
  }

  if (
    hasAny(doc, ['replay', 'timeline']) ||
    /\bwhat happened\b/i.test(lower) ||
    /\bafter (?:the )?launch\b/i.test(lower) ||
    /\b(5m|1h|24h)\b/i.test(lower)
  ) {
    return result('REPLAY', bagId, 'STRONG_RULE', false, identityRiskLanguage);
  }

  if (hasAny(doc, ['receipt', 'proof']) && bagId) {
    return result('RECEIPT', bagId, 'STRONG_RULE', false, identityRiskLanguage);
  }

  if (bagId && hasAny(doc, ['bag', 'launch', 'token'])) {
    return result('BAG', bagId, 'STRONG_RULE', false, identityRiskLanguage);
  }

  if (address) {
    return result('ADDRESS_LOOKUP', address, 'AMBIGUOUS', false, identityRiskLanguage);
  }

  if (
    hasAny(doc, ['roadmap', 'coming', 'next', 'plan', 'planned']) ||
    /\bwhat(?:'s| is) next\b/i.test(lower)
  ) {
    return result('ROADMAP', '', 'STRONG_RULE', false, identityRiskLanguage);
  }

  if (
    hasAny(doc, ['token', 'coin', 'rat credit']) ||
    /\$binrat\b/i.test(normalized) ||
    /\bwen token\b/i.test(lower)
  ) {
    return result('TOKEN', '', 'STRONG_RULE', false, identityRiskLanguage);
  }

  if (
    hasAny(doc, ['status', 'progress', 'live', 'shipped', 'working', 'health']) ||
    /\bwhat have you (?:built|shipped)\b/i.test(lower)
  ) {
    return result('STATUS', '', 'STRONG_RULE', false, identityRiskLanguage);
  }

  if (
    hasAny(doc, ['why', 'purpose', 'point']) ||
    /\bwhat (?:is|does) binrat\b/i.test(lower) ||
    /\bwhy should (?:i|anyone) care\b/i.test(lower)
  ) {
    return result('WHY', '', 'STRONG_RULE', false, identityRiskLanguage);
  }

  if (hasAny(doc, ['proof', 'rules', 'doctrine', 'truth', 'evidence'])) {
    return result('PROOF', '', 'STRONG_RULE', false, identityRiskLanguage);
  }

  if (hasAny(doc, ['help', 'commands', 'what can you do'])) {
    return result('HELP', '', 'STRONG_RULE', false, identityRiskLanguage);
  }

  return result('CLARIFY', '', 'AMBIGUOUS', false, identityRiskLanguage);
}
