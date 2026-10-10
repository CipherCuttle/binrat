export const SHARE_CARD_VERSION = 'BINRAT_SHARE_CARD_V0';
export const SHARE_CARD_MODES = ['FIXTURE', 'LIVE'];

export function buildShareCardModel(bag) {
  if (!bag || typeof bag !== 'object') throw new Error('SHARE_CARD_BAG_REQUIRED');

  if (!SHARE_CARD_MODES.includes(bag.mode)) throw new Error('SHARE_CARD_MODE_INVALID');
  const priorLaunches = nonNegativeInt(bag.priorLaunches);
  const coverage = normalizeCoverage(bag.coverage);
  const reportedCreatorAddress = normalizeAddress(bag.reportedCreatorAddress);

  return Object.freeze({
    version: SHARE_CARD_VERSION,
    mode: bag.mode,
    symbol: cleanText(bag.symbol, '$UNKNOWN'),
    reportedCreatorAddress,
    creatorShort: shortAddress(reportedCreatorAddress),
    priorLaunches,
    coverage,
    note: cleanText(bag.note, 'still digging.'),
    receipt: cleanText(bag.receipt, 'receipt_unavailable'),
    stamp: bag.mode === 'LIVE' ? 'LIVE // PUBLIC PROJECTION' : 'FIXTURE // NOT LIVE EVIDENCE',
    footer: 'HE GETS THE SCRAPS. YOU GET THE RECEIPTS.'
  });
}

export function buildSharePostText(bag) {
  const card = buildShareCardModel(bag);
  return [
    '🔥🗑️ HOT GARBAGE',
    '',
    `${card.symbol} hit THE DUMPSTER.`,
    `ArcPad-reported creator: ${card.creatorShort}`,
    `${card.mode === 'LIVE' ? 'prior indexed bags' : 'prior indexed bags in this fixture'}: ${card.priorLaunches}`,
    `coverage: ${card.coverage}`,
    '',
    `binrat: “${card.note}”`,
    '',
    card.stamp
  ].join('\n');
}

function normalizeCoverage(value) {
  return ['COMPLETE', 'PARTIAL', 'UNVERIFIED'].includes(value) ? value : 'UNVERIFIED';
}

function normalizeAddress(value) {
  const text = String(value ?? '').toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(text) ? text : '0x0000000000000000000000000000000000000000';
}

function shortAddress(value) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function nonNegativeInt(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function cleanText(value, fallback) {
  const text = String(value ?? '').trim();
  return text || fallback;
}
