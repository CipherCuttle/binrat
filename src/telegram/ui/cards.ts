import type { AutonomousOutcome } from '../../autonomous/outcome.js';
import { type Receipt } from '../../autonomous/model.js';
import { callbackButton, copyButton, webAppButton } from './keyboard.js';
import { TELEGRAM_UI_RENDERER_VERSION, type RatCard } from './types.js';
import { TELEGRAM_MINI_APP_URL } from '../config.js';

export const TELEGRAM_V2_CAPTION_LIMIT = 1024;

export function assertV2Caption(caption: string): string {
  if (Array.from(caption).length > TELEGRAM_V2_CAPTION_LIMIT) throw new Error('TELEGRAM_UI_CAPTION_TOO_LARGE');
  return caption;
}
function card(card: Omit<RatCard,'rendererVersion'>): RatCard { return { ...card,rendererVersion:TELEGRAM_UI_RENDERER_VERSION,caption:assertV2Caption(card.caption) }; }
function share(receipt: { shareId:string }): string { return receipt.shareId; }
function shortReference(value: string): string {
  return Array.from(value).length > 20 ? `${value.slice(0,10)}…${value.slice(-8)}` : value;
}
function launches(count: number): string { return `${count} launch${count === 1 ? '' : 'es'}`; }
function caseFact(receipt: { evidenceRefs:Array<{blockNumber:string}> }): string {
  return `BINRAT found ${launches(receipt.evidenceRefs.length)} from this reported deployer.`;
}
function whyFacts(receipt: { evidenceRefs:Array<{blockNumber:string}> }): string {
  const latest=receipt.evidenceRefs[0];
  return [
    `Same reported deployer across these ${launches(receipt.evidenceRefs.length)}.`,
    latest ? `Latest retained launch: indexed block ${latest.blockNumber}.` : '',
    'Each one has a retained receipt.',
    "That's the pattern. Nothing more inferred."
  ].filter(Boolean).join('\n');
}
function watchCopy(reply: string): string {
  if (/already watching|watch armed/i.test(reply)) return '🐀 WATCHING THESE PAWS. ✓\nA future indexed launch will bring you back.';
  if (/stopped watching/i.test(reply)) return '🐀 PAWS RELEASED.\nNo more alerts for this watch.';
  if (/superseded by a newer watch command/i.test(reply)) return '🐀 NEWER PAW COMMAND WON.\nNo watch changed.';
  if (/watch limit reached/i.test(reply)) return '🐀 BIN IS FULL.\nNo new watch was added.';
  return '🐀 WATCH STATE CHANGED.\nCheck your watches for the current list.';
}
function watchListCopy(outcome: Extract<AutonomousOutcome,{kind:'WATCHLIST'}>): string {
  const visible=outcome.watches.slice(0,5);
  const hidden=outcome.watches.length-visible.length;
  const lines=outcome.watches.length
    ? [
        `🐀 WATCHING ${outcome.watches.length} SET${outcome.watches.length === 1 ? '' : 'S'} OF PAWS.`,
        ...visible.map(w=>`• ${shortReference(w.entity_id)}`),
        hidden > 0 ? `+ ${hidden} more active watch${hidden === 1 ? '' : 'es'} in the full list.` : '',
        'I squeak only when a new indexed launch appears.'
      ]
    : ['🐀 NOTHING IN THE BIN.','No active V1 watches.'];
  if (outcome.legacyWatchCount > 0) {
    lines.push(`${outcome.legacyWatchCount} legacy watch${outcome.legacyWatchCount === 1 ? '' : 'es'} are not active here; re-arm explicitly on Pons 4663.`);
  }
  return lines.filter(Boolean).join('\n');
}
function errorCopy(code: string): string {
  if (/capacity|limit reached/i.test(code)) return '🐀 BIN IS FULL FOR NOW.\nTry again after 00:00 UTC.';
  if (/receipt/i.test(code)) return "🐀 THAT RECEIPT ISN'T HERE.\nIt may have expired or failed verification.";
  if (/live watches|historical evidence/i.test(code)) return '🐀 OLD TRAIL ONLY.\nArc 5042 stays historical. Live watches run on Pons 4663.';
  if (/malformed|unsupported/i.test(code)) return '🐀 WRONG KIND OF SCRAP.\nPaste a deployer address and I\'ll check it.';
  return "🐀 PIPE SMELLS WRONG.\nCan't verify fresh chain data right now.";
}
export function renderRatCard(outcome: AutonomousOutcome): RatCard {
  if (outcome.kind === 'HOME') return card({view:'HOME',media:'idle-neutral',caption:'🐀 BINRAT\n\nCatch repeat launchers early.\nBINRAT remembers who launched what — and squeaks when familiar paws return.',keyboard:[
    [callbackButton('Rats',{action:'RATS'}),callbackButton('DIG',{action:'DIG_PROMPT'})],
    [callbackButton('Watches',{action:'WATCHES'})],[webAppButton('Open Radar',TELEGRAM_MINI_APP_URL)]
  ]});
  if (outcome.kind === 'RATS') {
    const candidate=outcome.snapshot.candidates[outcome.candidateIndex];
    if (!candidate) return card({view:'EMPTY',media:'empty-paws',caption:'🐀 NOTHING IN THE BIN.\nNo repeat launchers in BINRAT\'s current memory.',keyboard:[[callbackButton('DIG',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]});
    const id=share({shareId:candidate.caseId.slice(0,40)});
    const count=candidate.recurrenceCount;
    const latest=candidate.latestLaunch;
    const retained=candidate.evidenceRefs.length;
    const latestName=latest.symbol ? String.fromCharCode(36) + latest.symbol : (latest.name || 'latest launch');
    const pageCount=outcome.snapshot.candidates.length;
    const pageNav=[
      ...(outcome.candidateIndex > 0 ? [callbackButton('Prev',{action:'RATS_PAGE',discoveryId:outcome.snapshot.discoveryId,index:outcome.candidateIndex-1})] : []),
      ...(outcome.candidateIndex < pageCount-1 ? [callbackButton('Next',{action:'RATS_PAGE',discoveryId:outcome.snapshot.discoveryId,index:outcome.candidateIndex+1})] : [])
    ];
    return card({view:'RATS',media:'repeat-creator',caption:[
      `🐀 SAME PAWS. ${launches(count).toUpperCase()} INDEXED.`,
      `Latest: ${latestName} · block ${latest.blockNumber}`,
      `${retained} retained receipt${retained===1?'':'s'} back this card.`,
      `Rat ${outcome.candidateIndex+1} of ${pageCount}.`
    ].join('\n'),keyboard:[
      [callbackButton('Investigate',{action:'CASE',shareId:id}),callbackButton('Watch',{action:'WATCH',shareId:id})],
      [callbackButton('Why',{action:'WHY',shareId:id}),copyButton('Copy address',candidate.entity.entityId)],
      ...(pageNav.length ? [pageNav] : []),
      [webAppButton('Open Radar',TELEGRAM_MINI_APP_URL)],
      [callbackButton('Home',{action:'HOME'})]
    ]});
  }
  if (outcome.kind === 'CASE') {
    const id=share(outcome.receipt); const creator=outcome.receipt.evidenceRefs[0]?.creator;
    const isWhy=outcome.mode === 'WHY';
    const caseActions=creator
      ? [callbackButton(isWhy ? 'Investigate' : 'Why',{action:isWhy ? 'CASE' : 'WHY',shareId:id}),
          ...(outcome.receipt.chainId === 4663 ? [callbackButton('Watch',{action:'WATCH',shareId:id})] : [])]
      : [];
    return card({view:isWhy?'WHY':'CASE',media:outcome.receipt.discovery?'repeat-creator':'evidence-found',caption:isWhy
      ? `🐀 WHY I NOTICED\n${whyFacts(outcome.receipt)}`
      : `🐀 CASE FILE\n${caseFact(outcome.receipt)}`,keyboard:[
      caseActions,
      [webAppButton('Open Case',`${TELEGRAM_MINI_APP_URL}?case=${outcome.receipt.caseId}`)],
      [callbackButton('Full receipt',{action:'FULL',shareId:id}),callbackButton('Share',{action:'SHARE',shareId:id})],
      creator ? [copyButton('Copy address',creator)] : [],
      [callbackButton('Home',{action:'HOME'})]
    ].filter(row=>row.length>0)});
  }
  if (outcome.kind === 'WATCH') {
    return card({view:'WATCH_STATE',media:'inquisitive',caption:watchCopy(outcome.reply),keyboard:[[callbackButton('Watches',{action:'WATCHES'}),callbackButton('Home',{action:'HOME'})]]});
  }
  if (outcome.kind === 'WATCHLIST') {
    const hasWatchState=outcome.watches.length > 0 || outcome.legacyWatchCount > 0;
    return card({view:hasWatchState?'WATCHLIST':'EMPTY',media:hasWatchState?'inquisitive':'empty-paws',caption:watchListCopy(outcome),keyboard:[
      [webAppButton('Open Watch List',`${TELEGRAM_MINI_APP_URL}?view=watches`)],
      [callbackButton('Home',{action:'HOME'})]
    ]});
  }
  if (outcome.kind === 'SHARE') return card({view:'CASE',media:'evidence-found',caption:`🐀 RECEIPT PACKED.\nPublic evidence only. No private watch data.\n\nhttps://t.me/BinratBot?start=receipt_${outcome.receipt.receiptId}`,keyboard:[[callbackButton('Home',{action:'HOME'})]]});
  if (outcome.kind === 'OPEN_RECEIPT') {
    const id=share(outcome.receipt.finding);
    return card({view:'CASE',media:'evidence-found',caption:`🐀 SOMEONE LEFT A RECEIPT.\n${caseFact(outcome.receipt.finding)}`,keyboard:[
      [callbackButton('Full receipt',{action:'FULL',shareId:id})],
      [callbackButton('Home',{action:'HOME'})]
    ]});
  }
  if (outcome.kind === 'REPLAY') return card({view:'WATCH_STATE',media:'inquisitive',caption:outcome.reply,keyboard:[[callbackButton('Home',{action:'HOME'})]]});
  return card({view:'ERROR',media:'error',caption:errorCopy(outcome.code),keyboard:[[callbackButton('DIG',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]});
}

/**
 * Presentation only: delivery has already re-verified the watch, event and
 * canonical evidence before it reaches this renderer. Keep the compact alert
 * separate from the full receipt available through the existing callbacks.
 */
export function renderAlertCard(receipt: Receipt, watchStartBlock: number): RatCard {
  const ref = receipt.evidenceRefs[0];
  if (!ref || !Number.isSafeInteger(watchStartBlock) || watchStartBlock < 0) throw new Error('ALERT_CARD_INPUT_INVALID');
  const id = share(receipt);
  return card({
    view:'ALERT', media:'alert',
    caption:[
      '🐀 SAME PAWS. NEW LAUNCH.',
      'A watched reported deployer showed up again.',
      'Your watch caught a fresh indexed launch.'
    ].join('\n\n'),
    keyboard:[
      [callbackButton('Investigate',{action:'CASE',shareId:id}),callbackButton('Why',{action:'WHY',shareId:id})],
      [callbackButton('Share',{action:'SHARE',shareId:id}),callbackButton('Unwatch',{action:'UNWATCH',shareId:id},'danger')],
      [copyButton('Copy address',ref.creator)]
    ]
  });
}

export function digWaitingCard(): RatCard { return card({view:'DIG_WAITING',media:'inquisitive',caption:"🐀 GIVE ME A DEPLOYER ADDRESS.\nI'll check what BINRAT remembers.",keyboard:[[callbackButton('Home',{action:'HOME'})]]}); }
export function diggingCard(): RatCard { return card({view:'DIGGING',media:'digging',caption:'🐀 RUMMAGING THROUGH OLD LAUNCHES…\nChecking what BINRAT remembers.',keyboard:[]}); }
export function malformedDigCard(): RatCard { return card({view:'DIG_WAITING',media:'empty-paws',caption:"🐀 THAT ISN'T A DEPLOYER ADDRESS I CAN CHECK.\nTry another set of paws.",keyboard:[[callbackButton('Try again',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]}); }
export function digPromptOperationalErrorCard(): RatCard { return card({view:'ERROR',media:'error',caption:"🐀 PIPE SMELLS WRONG.\nI didn't start a dig. Try again.",keyboard:[[callbackButton('Try again',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]}); }
export function digOperationalErrorCard(): RatCard { return card({view:'ERROR',media:'error',caption:"🐀 DIG STOPPED.\nI couldn't verify the receipts. Try again.",keyboard:[[callbackButton('Try again',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]}); }
