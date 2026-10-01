import type { AutonomousOutcome } from '../../autonomous/outcome.js';
import { type Receipt } from '../../autonomous/model.js';
import { callbackButton, copyButton } from './keyboard.js';
import { TELEGRAM_UI_RENDERER_VERSION, type RatCard } from './types.js';

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
function cleanTokenText(value:string):string {
  return value.replace(/[\u0000-\u001f\u007f-\u009f]+/g,' ').replace(/\s+/g,' ').trim();
}
function launchLabel(launch: {symbol:string;name:string;token:string}): string {
  const symbol=cleanTokenText(launch.symbol);
  const name=cleanTokenText(launch.name);
  const raw=symbol ? String.fromCharCode(36) + symbol : (name || shortReference(launch.token));
  return Array.from(raw).length > 24 ? `${Array.from(raw).slice(0,23).join('')}…` : raw;
}
function caseFact(receipt: Receipt): string {
  const previous=(receipt.discovery?.previousLaunches ?? []).slice(0,3).map(launchLabel);
  return [
    'TRASH TRAIL',
    previous.length ? `Same paws left receipts on ${previous.join(' · ')}.` : `${launches(receipt.evidenceRefs.length)} share this reported deployer.`,
    `Receipts connect ${launches(receipt.evidenceRefs.length)} to this reported deployer.`,
    "RAT TRAP: price trail isn't verified yet, so I'm not calling this gold."
  ].join('\n');
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
  if (/already watching|watch armed/i.test(reply)) return '🐀 RAT WATCH SET. ✓\nI’ll squeak if these paws launch again.';
  if (/stopped watching/i.test(reply)) return '🐀 PAWS RELEASED.\nNo more alerts for this watch.';
  if (/superseded by a newer watch command/i.test(reply)) return '🐀 NEWER PAW COMMAND WON.\nNo watch changed.';
  if (/watch limit reached/i.test(reply)) return '🐀 BIN IS FULL.\nNo new watch was added.';
  return '🐀 WATCH STATE CHANGED.\nCheck your watches for the current list.';
}
function watchListCopy(outcome: Extract<AutonomousOutcome,{kind:'WATCHLIST'}>): string {
  const visible=outcome.watches.slice(0,25);
  const hidden=outcome.watches.length-visible.length;
  const lines=outcome.watches.length
    ? [
        `🐀 RAT WATCH · ${outcome.watches.length} SET${outcome.watches.length === 1 ? '' : 'S'} OF PAWS.`,
        ...visible.map(w=>`• ${shortReference(w.entity_id)}`),
        hidden > 0 ? `+ ${hidden} more active watch${hidden === 1 ? '' : 'es'} in the full list.` : '',
        'I’ll squeak when one of these paws launches again.'
      ]
    : ['🐀 RAT WATCH.','Nothing on Rat Watch yet.'];
  if (outcome.legacyWatchCount > 0) {
    lines.push(`${outcome.legacyWatchCount} older watch${outcome.legacyWatchCount === 1 ? '' : 'es'} ${outcome.legacyWatchCount === 1 ? 'is' : 'are'} outside Rat Watch; re-arm on Pons 4663.`);
  }
  return lines.filter(Boolean).join('\n');
}
function errorCopy(code: string): string {
  if (/capacity|limit reached/i.test(code)) return '🐀 BIN IS FULL FOR NOW.\nTry again after 00:00 UTC.';
  if (/live index is unavailable or stale/i.test(code)) return '🐀 LOST THE TRAIL.\nFresh Pons receipts are not verified right now. No new claim made.';
  if (/fresh canonical Robinhood boundary could not be verified/i.test(code)) return '🐀 STUCK IN A PIPE.\nCould not verify the live Pons boundary. Nothing invented.';
  if (/snapshot is unavailable|snapshot.*expired/i.test(code)) return '🐀 TRAIL WENT COLD.\nOpen Fresh Garbage again and I’ll sniff out a current trail.';
  if (/discovery receipts are unavailable/i.test(code)) return '🐀 CAME BACK EMPTY.\nI could not rebuild the receipts for this trail.';
  if (/discovery receipts could not be saved|discovery retention is unavailable/i.test(code)) return '🐀 DROPPED THE RECEIPT.\nCould not keep this trail safely. Nothing invented.';
  if (/receipt/i.test(code)) return "🐀 THAT RECEIPT ISN'T HERE.\nIt may have expired or failed verification.";
  if (/live watches|historical evidence/i.test(code)) return '🐀 OLD TRAIL ONLY.\nArc 5042 stays historical. Live watches run on Pons 4663.';
  if (/malformed|unsupported/i.test(code)) return '🐀 WRONG KIND OF SCRAP.\nPaste a deployer address and I\'ll check it.';
  return "🐀 LOST THE TRAIL.\nCan't verify the next receipt right now.";
}
export function renderRatCard(outcome: AutonomousOutcome): RatCard {
  if (outcome.kind === 'HOME') return card({view:'HOME',media:'idle-neutral',caption:'🐀 BINRAT\n\nI dig through Pons garbage. When something smells worth keeping, I bring back the receipts.',keyboard:[
    [callbackButton('Fresh Garbage',{action:'RATS'}),callbackButton('Dig',{action:'DIG_PROMPT'})],
    [callbackButton('Rat Watch',{action:'WATCHES'})]
  ]});
  if (outcome.kind === 'RATS') {
    const candidate=outcome.snapshot.candidates[outcome.candidateIndex];
    if (!candidate) return card({view:'EMPTY',media:'empty-paws',caption:'🐀 EMPTY PAWS.\nNothing fresh in the bin is leaving a familiar trail right now.',keyboard:[[callbackButton('Dig',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]});
    const id=share({shareId:candidate.caseId.slice(0,40)});
    const latest=candidate.latestLaunch;
    const latestName=launchLabel(latest);
    const previous=(candidate.previousLaunches ?? []).slice(0,3).map(launchLabel);
    const pageCount=outcome.snapshot.candidates.length;
    const pageNav=[
      ...(outcome.candidateIndex > 0 ? [callbackButton('Newer',{action:'RATS_PAGE',discoveryId:outcome.snapshot.discoveryId,index:outcome.candidateIndex-1})] : []),
      ...(outcome.candidateIndex < pageCount-1 ? [callbackButton('Older',{action:'RATS_PAGE',discoveryId:outcome.snapshot.discoveryId,index:outcome.candidateIndex+1})] : [])
    ];
    return card({view:'RATS',media:'repeat-creator',caption:[
      '🐀 SMELLS FAMILIAR.',
      `Fresh Garbage: ${latestName}`,
      previous.length ? `Same paws left receipts on ${previous.join(' · ')}.` : 'Same paws left older receipts in the bin.',
      'That is a trail worth digging. Not a verdict.',
      `Fresh find ${outcome.candidateIndex+1}/${pageCount} · newest first.`
    ].join('\n'),keyboard:[
      [callbackButton('Dig Deeper',{action:'CASE',shareId:id})],
      [callbackButton('Receipts',{action:'WHY',shareId:id}),copyButton('Copy deployer',candidate.entity.entityId)],
      ...(pageNav.length ? [pageNav] : []),
      [callbackButton('Home',{action:'HOME'})]
    ]});
  }
  if (outcome.kind === 'CASE') {
    const id=share(outcome.receipt); const creator=outcome.receipt.evidenceRefs[0]?.creator;
    const isWhy=outcome.mode === 'WHY';
    const caseActions=creator
      ? [callbackButton(isWhy ? 'Back to case' : 'Receipts',{action:isWhy ? 'CASE' : 'WHY',shareId:id})]
      : [];
    return card({view:isWhy?'WHY':'CASE',media:outcome.receipt.discovery?'repeat-creator':'evidence-found',caption:isWhy
      ? `🐀 RECEIPTS\n${whyFacts(outcome.receipt)}`
      : `🐀 DUG IT UP.\n${caseFact(outcome.receipt)}`,keyboard:[
      caseActions,
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
      '🐀 TRAP SPRUNG.',
      'Familiar paws launched again.',
      'You kept this trail on Rat Watch.'
    ].join('\n'),
    keyboard:[
      [callbackButton('Dig Deeper',{action:'CASE',shareId:id}),callbackButton('Receipts',{action:'WHY',shareId:id})],
      [callbackButton('Share',{action:'SHARE',shareId:id}),callbackButton('Unwatch',{action:'UNWATCH',shareId:id},'danger')],
      [copyButton('Copy address',ref.creator)]
    ]
  });
}

export function digWaitingCard(): RatCard { return card({view:'DIG_WAITING',media:'inquisitive',caption:"🐀 DROP THE ADDRESS.\nGive me a Pons deployer and I'll rummage through its Trash Trail.",keyboard:[[callbackButton('Home',{action:'HOME'})]]}); }
export function diggingCard(): RatCard { return card({view:'DIGGING',media:'digging',caption:'🐀 RUMMAGING THROUGH THE TRASH…\nPulling the receipts.',keyboard:[]}); }
export function malformedDigCard(): RatCard { return card({view:'DIG_WAITING',media:'empty-paws',caption:"🐀 WRONG SCRAP.\nGive me a Pons deployer address.",keyboard:[[callbackButton('Try again',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]}); }
export function digPromptOperationalErrorCard(): RatCard { return card({view:'ERROR',media:'error',caption:"🐀 PIPE SMELLS WRONG.\nI didn't start a dig. Try again.",keyboard:[[callbackButton('Try again',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]}); }
export function digOperationalErrorCard(): RatCard { return card({view:'ERROR',media:'error',caption:"🐀 DIG STOPPED.\nI couldn't verify the receipts. Try again.",keyboard:[[callbackButton('Try again',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]}); }
