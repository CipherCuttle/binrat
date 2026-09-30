import type { AutonomousOutcome } from '../../autonomous/outcome.js';
import type { Receipt } from '../../autonomous/model.js';
import { callbackButton, webAppButton } from './keyboard.js';
import { TELEGRAM_UI_RENDERER_VERSION, type RatCard } from './types.js';
import { TELEGRAM_MINI_APP_URL } from '../config.js';

export const TELEGRAM_V2_CAPTION_LIMIT = 1024;
export const TELEGRAM_NORMAL_COPY_LIMIT = 320;
export const TELEGRAM_WHY_COPY_LIMIT = 420;
export const TELEGRAM_VISIBLE_ACTION_LIMIT = 4;

const MAIN_SURFACE_JARGON = /sourceVerified|runtimeFresh|authority_json|checkpointBlock|evidenceDigest|LAUNCH_IDENTITY_CONFLICT|SYNC_[A-Z_]+|\bOBSERVED:|\bDERIVED:|\bUNKNOWN:/i;

export function assertV2Caption(caption: string): string {
  if (Array.from(caption).length > TELEGRAM_V2_CAPTION_LIMIT) throw new Error('TELEGRAM_UI_CAPTION_TOO_LARGE');
  return caption;
}

export function assertPresentationCard(input: Omit<RatCard,'rendererVersion'>): void {
  const copyLimit = input.view === 'WHY' ? TELEGRAM_WHY_COPY_LIMIT : TELEGRAM_NORMAL_COPY_LIMIT;
  if (Array.from(input.caption).length > copyLimit) throw new Error('TELEGRAM_UI_COPY_BUDGET_EXCEEDED');
  if (input.keyboard.flat().length > TELEGRAM_VISIBLE_ACTION_LIMIT) throw new Error('TELEGRAM_UI_ACTION_BUDGET_EXCEEDED');
  if (MAIN_SURFACE_JARGON.test(input.caption)) throw new Error('TELEGRAM_UI_JARGON_LEAK');
}

function card(input: Omit<RatCard,'rendererVersion'>): RatCard {
  assertPresentationCard(input);
  return { ...input,rendererVersion:TELEGRAM_UI_RENDERER_VERSION,caption:assertV2Caption(input.caption) };
}

function share(receipt: { shareId:string }): string { return receipt.shareId; }

function shortReference(value: string): string {
  return Array.from(value).length > 20 ? `${value.slice(0,8)}…${value.slice(-6)}` : value;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

function sourceLabel(receipt: Receipt): string {
  return receipt.source === 'PONS_V2' ? 'Pons' : 'ArcPad';
}

function caseHeadline(receipt: Receipt, privateAttention: string | null): string {
  const count = receipt.evidenceRefs.length;
  if (privateAttention) return '🐀 Same paws. New launch.';
  if (receipt.discovery) return `🐀 Same paws. ${count} ${plural(count,'launch','launches')}.`;
  return `🐀 Dug it up. ${count} ${plural(count,'launch','launches')}.`;
}

function caseCaption(receipt: Receipt, privateAttention: string | null): string {
  const creator = receipt.evidenceRefs[0]?.creator ?? receipt.subject.entityId;
  const lines = [
    caseHeadline(receipt,privateAttention),
    `${sourceLabel(receipt)} reported deployer ${shortReference(creator)}.`
  ];
  if (privateAttention) lines.push('Matched your watch after it was armed.');
  return lines.join('\n');
}

function whyCaption(receipt: Receipt, privateAttention: string | null): string {
  const count = receipt.evidenceRefs.length;
  if (privateAttention) {
    return [
      '🐀 Why I squeaked',
      'This deployer matched your explicit watch.',
      'The new launch landed after the watch boundary.',
      'Nothing else inferred.'
    ].join('\n');
  }
  if (receipt.discovery) {
    return [
      '🐀 Why I noticed',
      `Same reported deployer across ${count} ${plural(count,'launch','launches')}.`,
      `Latest receipt: block ${receipt.evidenceRefs[0]!.blockNumber}.`,
      'Known history is partial.',
      "That's the pattern — nothing more inferred."
    ].join('\n');
  }
  return [
    '🐀 Why this surfaced',
    `BINRAT found ${count} retained launch ${plural(count,'receipt')} for this ${receipt.subject.entityType.toLowerCase()}.`,
    'Known history is partial.',
    'Nothing stronger inferred.'
  ].join('\n');
}

function watchCaption(reply: string): string {
  if (/already watching|watch armed/i.test(reply)) {
    return "🐀 Watching these paws. ✓\nI'll squeak if this deployer launches again.";
  }
  if (/stopped watching/i.test(reply)) return '🐀 Watch off.\nNo more alerts for these paws.';
  if (/watch limit reached/i.test(reply)) return '🐀 Watchlist full.\nNothing changed.';
  if (/superseded/i.test(reply)) return '🐀 Newer command already won.\nNothing changed.';
  return '🐀 Watch state updated.';
}

function errorCaption(code: string): string {
  if (/capacity reached/i.test(code)) return "🐀 Rat's done digging for today.\nWatches and receipts still work.";
  if (/Use a Robinhood address|unsupported entity|watch.*deployers only/i.test(code)) {
    return '🐀 Wrong scent.\nSend a Robinhood/Pons deployer address.';
  }
  if (/live index|fresh canonical Robinhood boundary|source unavailable/i.test(code)) {
    return "🐀 Pipe smells wrong.\nI can't verify fresh Robinhood data right now.";
  }
  if (/evidence is missing|Receipt unavailable|public receipt.*unavailable|expired or invalid/i.test(code)) {
    return "🐀 Missing receipt.\nI won't fake proof I can't reconstruct.";
  }
  if (/Discovery|receipt could not be|retention is unavailable/i.test(code)) {
    return "🐀 Bin's jammed.\nCouldn't save a clean receipt. Nothing invented.";
  }
  if (/Usage: \/rats/i.test(code)) return '🐀 No extra scent needed.\nTap Find rats.';
  return "🐀 Pipe smells wrong.\nI couldn't verify this cleanly.";
}

export function renderRatCard(outcome: AutonomousOutcome): RatCard {
  if (outcome.kind === 'HOME') return card({
    view:'HOME',
    media:'idle-neutral',
    caption:"🐀 Hunting familiar paws.\nI remember repeat launchers and squeak when watched ones come back.\nNo vibes. Receipts.",
    keyboard:[
      [callbackButton('Find rats',{action:'RATS'}),callbackButton('DIG',{action:'DIG_PROMPT'})],
      [callbackButton('Watches',{action:'WATCHES'}),webAppButton('Open BINRAT',TELEGRAM_MINI_APP_URL)]
    ]
  });

  if (outcome.kind === 'RATS') {
    const candidate=outcome.snapshot.candidates[outcome.candidateIndex];
    if (!candidate) return card({
      view:'EMPTY',
      media:'empty-paws',
      caption:'🐀 Nothing in the bin.\nNo repeat Pons deployers in the history I can verify right now.',
      keyboard:[[callbackButton('DIG',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]
    });
    const id=share({shareId:candidate.caseId.slice(0,40)});
    const latest=candidate.evidenceRefs[0];
    const count=candidate.evidenceRefs.length;
    const caption=[
      `🐀 Same paws. Again. · ${outcome.candidateIndex+1}/${outcome.snapshot.candidates.length}`,
      `BINRAT has receipts for ${count} ${plural(count,'launch','launches')} from this deployer.`,
      `${shortReference(candidate.entity.entityId)}${latest ? ` · latest block ${latest.blockNumber}` : ''}`
    ].join('\n');
    const navigation = outcome.snapshot.candidates.length > 1
      ? [
          callbackButton('← Prev',{action:'RATS_PAGE',discoveryId:outcome.snapshot.discoveryId,index:Math.max(0,outcome.candidateIndex-1)}),
          callbackButton('Next →',{action:'RATS_PAGE',discoveryId:outcome.snapshot.discoveryId,index:Math.min(outcome.snapshot.candidates.length-1,outcome.candidateIndex+1)})
        ]
      : [callbackButton('Why',{action:'WHY',shareId:id}),callbackButton('Home',{action:'HOME'})];
    return card({
      view:'RATS',
      media:'repeat-creator',
      caption,
      keyboard:[
        [callbackButton('Investigate',{action:'CASE',shareId:id}),callbackButton('Watch',{action:'WATCH',shareId:id})],
        navigation
      ]
    });
  }

  if (outcome.kind === 'CASE') {
    const id=share(outcome.receipt);
    if (outcome.mode === 'WHY') return card({
      view:'WHY',
      media:outcome.receipt.discovery?'repeat-creator':'evidence-found',
      caption:whyCaption(outcome.receipt,outcome.privateAttention),
      keyboard:[
        [webAppButton('Open Case',`${TELEGRAM_MINI_APP_URL}?case=${outcome.receipt.caseId}`),callbackButton('Full receipt',{action:'FULL',shareId:id})],
        [callbackButton('Back',{action:'CASE',shareId:id})]
      ]
    });
    const creator=outcome.receipt.evidenceRefs[0]?.creator;
    return card({
      view:'CASE',
      media:outcome.receipt.discovery?'repeat-creator':'evidence-found',
      caption:caseCaption(outcome.receipt,outcome.privateAttention),
      keyboard:[
        creator
          ? [callbackButton('Watch',{action:'WATCH',shareId:id}),webAppButton('Open Case',`${TELEGRAM_MINI_APP_URL}?case=${outcome.receipt.caseId}`)]
          : [webAppButton('Open Case',`${TELEGRAM_MINI_APP_URL}?case=${outcome.receipt.caseId}`)],
        [callbackButton('Why',{action:'WHY',shareId:id}),callbackButton('Share',{action:'SHARE',shareId:id})]
      ]
    });
  }

  if (outcome.kind === 'WATCH') return card({
    view:'WATCH_STATE',
    media:'inquisitive',
    caption:watchCaption(outcome.reply),
    keyboard:[[callbackButton('Watches',{action:'WATCHES'}),callbackButton('Home',{action:'HOME'})]]
  });

  if (outcome.kind === 'WATCHLIST') {
    if (!outcome.watches.length) return card({
      view:'EMPTY',
      media:'empty-paws',
      caption:[
        '🐀 Nothing on watch.',
        "Arm a deployer and I'll squeak if it launches again.",
        outcome.legacyWatchCount ? `${outcome.legacyWatchCount} old ${plural(outcome.legacyWatchCount,'watch','watches')} need re-arming.` : ''
      ].filter(Boolean).join('\n'),
      keyboard:[[callbackButton('Find rats',{action:'RATS'}),callbackButton('Home',{action:'HOME'})]]
    });
    return card({
      view:'WATCHLIST',
      media:'inquisitive',
      caption:[
        `🐀 Watching ${outcome.watches.length} ${plural(outcome.watches.length,'deployer')}.`,
        ...outcome.watches.slice(0,5).map(w=>`• ${shortReference(w.entity_id)}`),
        "I'll squeak only when something actually changes."
      ].join('\n'),
      keyboard:[[callbackButton('Find rats',{action:'RATS'}),callbackButton('Home',{action:'HOME'})]]
    });
  }

  if (outcome.kind === 'SHARE') return card({
    view:'CASE',
    media:'evidence-found',
    caption:`🐀 Receipt packed.\nPublic evidence only.\nhttps://t.me/BinratBot?start=receipt_${outcome.receipt.receiptId}`,
    keyboard:[[callbackButton('Home',{action:'HOME'})]]
  });

  if (outcome.kind === 'OPEN_RECEIPT') {
    const creator=outcome.receipt.finding.evidenceRefs[0]?.creator ?? outcome.receipt.subject.entityId;
    const count=outcome.receipt.finding.evidenceRefs.length;
    return card({
      view:'CASE',
      media:'evidence-found',
      caption:[
        '🐀 Somebody left a receipt.',
        `${count} ${plural(count,'launch receipt')} tied to ${shortReference(creator)}.`,
        'Public evidence only.'
      ].join('\n'),
      keyboard:[[callbackButton('Home',{action:'HOME'})]]
    });
  }

  if (outcome.kind === 'REPLAY') return card({
    view:'WATCH_STATE',
    media:'inquisitive',
    caption:watchCaption(outcome.reply),
    keyboard:[[callbackButton('Watches',{action:'WATCHES'}),callbackButton('Home',{action:'HOME'})]]
  });

  return card({
    view:'ERROR',
    media:'error',
    caption:errorCaption(outcome.code),
    keyboard:[[callbackButton('Home',{action:'HOME'})]]
  });
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
    view:'ALERT',
    media:'alert',
    caption:[
      '🐀 SAME PAWS. NEW LAUNCH.',
      'One of your watched deployers is back.',
      `${shortReference(ref.creator)} · block ${ref.blockNumber}`
    ].join('\n'),
    keyboard:[
      [callbackButton('Investigate',{action:'CASE',shareId:id}),callbackButton('Why',{action:'WHY',shareId:id})],
      [callbackButton('Unwatch',{action:'UNWATCH',shareId:id},'danger')]
    ]
  });
}

export function digWaitingCard(): RatCard {
  return card({
    view:'DIG_WAITING',
    media:'inquisitive',
    caption:"🐀 Give me a deployer.\nDrop a Robinhood/Pons deployer address. I'll dig through what BINRAT remembers.",
    keyboard:[[callbackButton('Home',{action:'HOME'})]]
  });
}

export function diggingCard(): RatCard {
  return card({view:'DIGGING',media:'digging',caption:"🐀 Digging through the bin…\nChecking BINRAT's saved Pons receipts.",keyboard:[]});
}

export function malformedDigCard(): RatCard {
  return card({
    view:'DIG_WAITING',
    media:'empty-paws',
    caption:"🐀 Wrong scent.\nThat doesn't look like a Robinhood/Pons deployer address.",
    keyboard:[[callbackButton('Try again',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]
  });
}

export function digPromptOperationalErrorCard(): RatCard {
  return card({
    view:'ERROR',
    media:'error',
    caption:'🐀 Prompt slipped down the pipe.\nNothing was investigated. Try DIG again.',
    keyboard:[[callbackButton('Try again',{action:'DIG_PROMPT'}),callbackButton('Home',{action:'HOME'})]]
  });
}
