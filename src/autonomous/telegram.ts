import type { D1DatabaseLike } from '../cloudflare/d1Types.js';
import { FreeEntitlements, assertPrincipal, type Principal } from './entitlements.js';
import { dig, why } from './evidence.js';
import { entityKey, parseTarget, renderReceipt } from './model.js';
import type { WatchSource } from './source.js';
import { commandReplay, listWatches, mutateWatch, reserveDig } from './watches.js';

export interface RatCommand { name: 'dig' | 'watch' | 'unwatch' | 'watches' | 'why'; argument: string }
export function parseAutonomousCommand(text: string): RatCommand | null {
  const match = text.trim().match(/^\/(dig|watch|unwatch|watches|why)(?:@BinratBot)?(?:\s+([\s\S]*))?$/i);
  return match ? { name:match[1]!.toLowerCase() as RatCommand['name'],argument:match[2]?.trim() ?? '' } : null;
}

export async function handleAutonomousCommand(
  db: D1DatabaseLike, command: RatCommand, principal: Principal, updateId: number, now: number, source: WatchSource
): Promise<string> {
  assertPrincipal(principal);
  const replay = await commandReplay(db,principal,updateId);
  if (replay !== null) return replay;
  const capacity = await new FreeEntitlements().resolve(principal);
  try {
    if (command.name === 'watches') {
      const rows = await listWatches(db,principal);
      const legacy = await db.prepare('SELECT COUNT(*) AS n FROM rat_watch_subscriptions WHERE chat_id=?')
        .bind(principal.chatId).first<{ n:number }>();
      return ['🐀 watch list (FREE: 25).', ...rows.map(w =>
        `${entityKey({chainId:w.chain_id,entityType:w.entity_type,entityId:w.entity_id})} · after block ${w.start_block}`),
      rows.length ? '' : 'No active V1 watches.',
      legacy?.n ? 'Legacy watches require explicit re-arm with /watch <target>.' : ''].filter(Boolean).join('\n');
    }
    if (command.name === 'why') {
      const receipt = await why(db,command.argument,now);
      const own = await db.prepare(`SELECT watch_start_block FROM rat_v1_outbox
        WHERE case_id=? AND user_id=? AND chat_id=? LIMIT 1`)
        .bind(receipt.caseId,principal.userId,principal.chatId).first<{ watch_start_block:number }>();
      return renderReceipt(receipt,'WHY') + (own
        ? `\n\nDERIVED (private attention): exact reported creator matched your explicit watch; event block > ${own.watch_start_block}.`
        : '');
    }
    const target = parseTarget(command.argument);
    if (command.name === 'dig') {
      if (!await reserveDig(db,principal,updateId,now,capacity)) return '🐀 DIG capacity reached. Try after 00:00 UTC. Existing WHY receipts remain accessible.';
      return renderReceipt(await dig(db,target,now),'DIG');
    }
    return await mutateWatch(db,principal,updateId,target,command.name === 'watch' ? 'WATCH' : 'UNWATCH',capacity,now,source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    const messages: Record<string,string> = {
      MALFORMED_TARGET:'Use an address, launch ID, or 5042:CREATOR:<address> / 5042:TOKEN:<address> / 5042:LAUNCH:<id>.',
      UNSUPPORTED_CHAIN:'Only Arc 5042 evidence is supported here. Pons 4663 intelligence is not live.',
      UNSUPPORTED_ENTITY:'This entity is unsupported. Arbitrary wallet history is not available; a pool recipient is not a human identity.',
      WATCH_CREATOR_ONLY:'V1 watches support reported creators only. Use the creator target shown by DIG.',
      EVIDENCE_UNAVAILABLE:'Canonical evidence is missing or incomplete for this target. No analysis or safety conclusion is available.',
      RECEIPT_UNAVAILABLE:'Receipt unavailable: missing, changed or incomplete canonical evidence. The previous claim cannot be reconstructed.',
      INDEX_UNAVAILABLE:'The live index is unavailable or stale. No new investigation or alert authority.',
      SOURCE_UNAVAILABLE:'A fresh canonical Arc boundary could not be verified. Watch was not added.'
    };
    if (messages[reason]) return `🐀 ${messages[reason]}`;
    throw error;
  }
}
