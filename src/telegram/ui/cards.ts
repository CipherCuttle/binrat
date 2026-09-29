import type { AutonomousOutcome } from '../../autonomous/outcome.js';
import { entityKey } from '../../autonomous/model.js';
import { callbackButton, copyButton } from './keyboard.js';
import { TELEGRAM_UI_RENDERER_VERSION, type RatCard } from './types.js';

export const TELEGRAM_V2_CAPTION_LIMIT = 1024;

export function assertV2Caption(caption: string): string {
  if (Array.from(caption).length > TELEGRAM_V2_CAPTION_LIMIT) throw new Error('TELEGRAM_UI_CAPTION_TOO_LARGE');
  return caption;
}
function card(card: Omit<RatCard,'rendererVersion'>): RatCard { return { ...card,rendererVersion:TELEGRAM_UI_RENDERER_VERSION,caption:assertV2Caption(card.caption) }; }
function share(receipt: { shareId:string }): string { return receipt.shareId; }
function summary(receipt: { source:string; chainId:number; subject:{entityType:string;entityId:string}; evidenceRefs:unknown[]; coverage:{asOfBlock:string} }): string {
  return `${receipt.source === 'PONS_V2' ? 'Robinhood/Pons' : 'Arc'} ${receipt.chainId} · ${receipt.subject.entityType} ${receipt.subject.entityId}\n`+
    `OBSERVED: ${receipt.evidenceRefs.length} retained indexed launch receipt(s).\n`+
    `Coverage: PARTIAL · as of block ${receipt.coverage.asOfBlock}.\n`+
    'UNKNOWN: identity, intent, safety and future outcome.';
}
export function renderRatCard(outcome: AutonomousOutcome): RatCard {
  if (outcome.kind === 'HOME') return card({view:'HOME',media:'idle-neutral',caption:'🐀 BINRAT\n\nEvidence-first Robinhood/Pons receipts. No safety, profitability or identity verdicts.',keyboard:[
    [callbackButton('Rats',{action:'RATS'}),callbackButton('Watches',{action:'WATCHES'})],[callbackButton('DIG — send /dig <address>',{action:'DIG_HINT'})]
  ]});
  if (outcome.kind === 'RATS') {
    const candidate=outcome.snapshot.candidates[0];
    if (!candidate) return card({view:'EMPTY',media:'empty-paws',caption:`🐀 Empty paws. No repeated Pons-reported deployers in current indexed coverage.\nCoverage: PARTIAL · as of block ${outcome.snapshot.sourceCheckpoint}.\nNo candidate or safety conclusion was fabricated.`,keyboard:[[callbackButton('Home',{action:'HOME'})]]});
    const id=share({shareId:candidate.caseId.slice(0,40)});
    return card({view:'RATS',media:'repeat-creator',caption:`🐀 RATS · ${candidate.rankPosition}\n${candidate.entity.entityId}\n${candidate.reasons.map(r=>`${r.epistemicClass}: ${r.text}`).join('\n')}\nCoverage: PARTIAL · indexed Pons V2 only.\nUNKNOWN: identity, intent, safety and future outcome.`,keyboard:[
      [callbackButton('Why',{action:'WHY',shareId:id}),callbackButton('Watch',{action:'WATCH',shareId:id})],
      [copyButton('Copy address',candidate.entity.entityId)],[callbackButton('Home',{action:'HOME'})]
    ]});
  }
  if (outcome.kind === 'CASE') {
    const id=share(outcome.receipt); const creator=outcome.receipt.evidenceRefs[0]?.creator;
    return card({view:outcome.mode==='WHY'?'WHY':'CASE',media:outcome.receipt.discovery?'repeat-creator':'evidence-found',caption:`🐀 ${outcome.mode === 'WHY' ? 'WHY' : 'CASE'}\n${summary(outcome.receipt)}${outcome.privateAttention ? '\nPrivate watch evidence is available in the full receipt.' : ''}`,keyboard:[
      [callbackButton('Why',{action:'WHY',shareId:id}),callbackButton('Full receipt',{action:'FULL',shareId:id})],
      creator ? [callbackButton('Watch',{action:'WATCH',shareId:id}),copyButton('Copy address',creator)] : [],
      [callbackButton('Share',{action:'SHARE',shareId:id}),callbackButton('Home',{action:'HOME'})]
    ].filter(row=>row.length>0)});
  }
  if (outcome.kind === 'WATCH') {
    const active=/watch armed|already watching/i.test(outcome.reply);
    return card({view:'WATCH_STATE',media:'inquisitive',caption:`🐀 WATCH ${active?'ACTIVE':'INACTIVE'}\n${outcome.reply.replace(/^🐀\s*/,'')}\nInteraction state only; it is not a token or creator rating.`,keyboard:[[callbackButton('Watches',{action:'WATCHES'}),callbackButton('Home',{action:'HOME'})]]});
  }
  if (outcome.kind === 'WATCHLIST') return card({view:outcome.watches.length?'WATCHLIST':'EMPTY',media:outcome.watches.length?'inquisitive':'empty-paws',caption:outcome.watches.length ? `🐀 WATCHLIST\n${outcome.watches.slice(0,5).map(w=>`${entityKey({chainId:w.chain_id,entityType:w.entity_type,entityId:w.entity_id})} · after ${w.start_block}`).join('\n')}\nShowing up to 5 active watches.` : '🐀 Empty paws. No active watches.',keyboard:[[callbackButton('Home',{action:'HOME'})]]});
  if (outcome.kind === 'SHARE') return card({view:'CASE',media:'evidence-found',caption:`🐀 Receipt packed. Public evidence only.\nOpen: https://t.me/BinratBot?start=receipt_${outcome.receipt.receiptId}\nNo sharer, watch owner, entitlement or chat context is included.`,keyboard:[[callbackButton('Home',{action:'HOME'})]]});
  if (outcome.kind === 'OPEN_RECEIPT') return card({view:'CASE',media:'evidence-found',caption:`🐀 Public receipt\n${summary(outcome.receipt.finding)}\nThis receipt contains no sharer, watch-owner, entitlement or chat state.`,keyboard:[[callbackButton('Home',{action:'HOME'})]]});
  if (outcome.kind === 'REPLAY') return card({view:'WATCH_STATE',media:'inquisitive',caption:outcome.reply,keyboard:[[callbackButton('Home',{action:'HOME'})]]});
  return card({view:'ERROR',media:'error',caption:`🐀 ${outcome.code}\nNo evidence conclusion was made.`,keyboard:[[callbackButton('Home',{action:'HOME'})]]});
}

export function digHintCard(): RatCard { return card({view:'HOME',media:'inquisitive',caption:'🐀 To investigate an address, send /dig <Robinhood address>. I will only return canonical indexed evidence.',keyboard:[[callbackButton('Home',{action:'HOME'})]]}); }
