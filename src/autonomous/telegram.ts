import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import { FreeEntitlements, assertPrincipal, type Principal } from './entitlements.js';
import { dig, why } from './evidence.js';
import { entityKey, parseTarget, renderReceipt } from './model.js';
import { discoverRats, renderRats } from './rats.js';
import { createPublicShareReceipt, openPublicShareReceipt, renderOpenedReceipt, renderShareArtifact } from './share.js';
import type { WatchSource } from './source.js';
import { commandReplay, listWatches, mutateWatch, reserveDig } from './watches.js';
import type { AutonomousOutcome } from './outcome.js';

export interface RatCommand { name: 'dig' | 'watch' | 'unwatch' | 'watches' | 'why' | 'rats' | 'share' | 'start'; argument: string }
export function parseAutonomousCommand(text: string): RatCommand | null {
  const match = text.trim().match(/^\/(dig|watch|unwatch|watches|why|rats|share|start)(?:@BinratBot)?(?:\s+([\s\S]*))?$/i);
  return match ? { name:match[1]!.toLowerCase() as RatCommand['name'],argument:match[2]?.trim() ?? '' } : null;
}

export async function executeAutonomousCommand(
  db: D1DatabaseLike, command: RatCommand, principal: Principal, updateId: number, now: number, source: WatchSource
): Promise<AutonomousOutcome> {
  assertPrincipal(principal);
  const replay = await commandReplay(db,principal,updateId);
  if (replay !== null) return { kind:'REPLAY',reply:replay };
  const capacity = await new FreeEntitlements().resolve(principal);
  try {
    if (command.name === 'watches') {
      const rows = await listWatches(db,principal);
      const legacy = await db.prepare('SELECT COUNT(*) AS n FROM rat_watch_subscriptions WHERE chat_id=?')
        .bind(principal.chatId).first<{ n:number }>();
      return { kind:'WATCHLIST',watches:rows,legacyWatchCount:legacy?.n ?? 0 };
    }
    if (command.name === 'rats') {
      if (command.argument) throw new Error('RATS_USAGE');
      return { kind:'RATS',snapshot:await discoverRats(db,now,capacity.ratsCandidates) };
    }
    if (command.name === 'share') return { kind:'SHARE',receipt:await createPublicShareReceipt(db,command.argument,now) };
    if (command.name === 'start') {
      if (!command.argument) {
        return { kind:'HOME' };
      }
      const match = command.argument.match(/^receipt_([0-9a-f]{32})$/);
      if (!match) throw new Error('PUBLIC_RECEIPT_UNAVAILABLE');
      return { kind:'OPEN_RECEIPT',receipt:await openPublicShareReceipt(db,match[1]!,now) };
    }
    if (command.name === 'why') {
      const receipt = await why(db,command.argument,now);
      const own = await db.prepare(`SELECT watch_start_block,watch_created_at_ms,event_timestamp_ms FROM rat_v1_outbox
        WHERE case_id=? AND user_id=? AND chat_id=? LIMIT 1`)
        .bind(receipt.caseId,principal.userId,principal.chatId)
        .first<{ watch_start_block:number;watch_created_at_ms:number;event_timestamp_ms:number|null }>();
      return { kind:'CASE',receipt,mode:'WHY',privateAttention:own
        ? `DERIVED (private attention): exact reported creator matched your explicit watch; event block > ${own.watch_start_block}.` +
          (own.event_timestamp_ms === null ? '\nDelivery time eligibility not verified.' :
            `\nOBSERVED at delivery: canonical event block time ${own.event_timestamp_ms}ms.\nDERIVED: event time > watch creation ${own.watch_created_at_ms}ms.`)
        : null };
    }
    const target = parseTarget(command.argument);
    if (command.name === 'dig') {
      if (!await reserveDig(db,principal,updateId,now,capacity)) throw new Error('CAPACITY_REACHED');
      return { kind:'CASE',receipt:await dig(db,target,now),mode:'DIG',privateAttention:null };
    }
    return { kind:'WATCH',reply:await mutateWatch(db,principal,updateId,target,command.name === 'watch' ? 'WATCH' : 'UNWATCH',capacity,now,source) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    const messages: Record<string,string> = {
      CAPACITY_REACHED:'DIG/WATCH research capacity reached. Try after 00:00 UTC. Existing watches, UNWATCH and WHY remain available.',
      MALFORMED_TARGET:'Use a Robinhood address or launch ID, or 4663:CREATOR:<address> / 4663:TOKEN:<address> / 4663:LAUNCH:<id>. Arc 5042 is historical evidence only.',
      UNSUPPORTED_CHAIN:'Only Robinhood 4663 live intelligence and stored Arc 5042 historical evidence are supported.',
      UNSUPPORTED_ENTITY:'This entity is unsupported. Arbitrary wallet history is not available; a protocol address is not a human identity.',
      WATCH_CREATOR_ONLY:'Live watches support exact Pons-reported deployers only. Use the deployer target shown by DIG.',
      EVIDENCE_UNAVAILABLE:'Canonical evidence is missing or incomplete for this target. No analysis or safety conclusion is available.',
      RECEIPT_UNAVAILABLE:'Receipt unavailable: missing, changed or incomplete canonical evidence. The previous claim cannot be reconstructed.',
      INDEX_UNAVAILABLE:'The live index is unavailable or stale. No new investigation or alert authority.',
      SOURCE_UNAVAILABLE:'A fresh canonical Robinhood boundary could not be verified. Watch was not added.',
      RATS_USAGE:'Usage: /rats',
      DISCOVERY_UNAVAILABLE:'Discovery receipts are unavailable. No rats invented.',
      DISCOVERY_WRITE_FAILED:'Discovery receipts could not be saved. No rats invented.',
      DISCOVERY_RETENTION_FAILED:'Discovery retention is unavailable. No rats invented.',
      PUBLIC_RECEIPT_UNAVAILABLE:'That public receipt is unavailable, expired or invalid.',
      SHARE_WRITE_FAILED:'Public receipt could not be created.',
      SHARE_ID_UNAVAILABLE:'Public receipt ID could not be allocated.',
      SHARE_RETENTION_FAILED:'Public receipt retention is unavailable.'
    };
    if (messages[reason]) return { kind:'ERROR',code:messages[reason]! };
    throw error;
  }
}

/** Legacy commands retain their established full-text rendering. */
export function renderLegacyAutonomousOutcome(outcome: AutonomousOutcome): string {
  switch (outcome.kind) {
    case 'HOME': return '🐀 BINRAT\n\nI dig through Pons launches and reported deployers. You get the receipts.\n\n/rats — what the rat noticed\n/dig <address> — investigate\n/watches — what I\'m watching';
    case 'RATS': return renderRats(outcome.snapshot);
    case 'CASE': return renderReceipt(outcome.receipt,outcome.mode) + (outcome.privateAttention ? `\n\n${outcome.privateAttention}` : '');
    case 'WATCH': case 'REPLAY': return outcome.reply;
    case 'WATCHLIST': return ['🐀 watch list (FREE: 25).',...outcome.watches.map(w=>`${entityKey({chainId:w.chain_id,entityType:w.entity_type,entityId:w.entity_id})} · after block ${w.start_block}`),outcome.watches.length?'':'No active V1 watches.',outcome.legacyWatchCount?'Legacy watches require explicit re-arm with /watch <target>.':''].filter(Boolean).join('\n');
    case 'SHARE': return renderShareArtifact(outcome.receipt);
    case 'OPEN_RECEIPT': return renderOpenedReceipt(outcome.receipt);
    case 'ERROR': return `🐀 ${outcome.code}`;
  }
}

export async function handleAutonomousCommand(
  db: D1DatabaseLike, command: RatCommand, principal: Principal, updateId: number, now: number, source: WatchSource
): Promise<string> {
  return renderLegacyAutonomousOutcome(await executeAutonomousCommand(db,command,principal,updateId,now,source));
}
