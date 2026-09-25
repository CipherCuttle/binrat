import type { ScoutProjection } from './scout.js';

interface ApiResult<T> {
  ok?: boolean;
  result?: T;
  description?: string;
}
/** Telegram 400 "message is not modified" proves this exact edit already succeeded.
 * A failed ledger commit can replay the same edit after a successful prior response. */
const alreadyApplied = (status:number, data:ApiResult<unknown>|null) =>
  status===400 && typeof data?.description==='string' &&
  /message is not modified/i.test(data.description);
const MAX_CAPTION = 1024;

/** Approved-source pixel-art derivatives in this isolated draft. No arbitrary remote media. */
export type ScoutPosterMood = 'digging' | 'evidence-found' | 'repeat-creator' | 'empty-paws' | 'error';
export function scoutResultMood(projection: ScoutProjection | null): ScoutPosterMood {
  if (!projection) return 'error';
  if (!projection.candidates.length) return 'empty-paws';
  if (projection.candidates.some(row => row.launchCount14d >= 2)) return 'repeat-creator';
  return 'evidence-found';
}
export function scoutPosterUrl(origin: string, mood: ScoutPosterMood = 'digging'): string {
  let url: URL;
  try { url = new URL(origin); } catch { throw new Error('SCOUT_POSTER_ORIGIN_INVALID'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password)
    throw new Error('SCOUT_POSTER_ORIGIN_INVALID');
  return new URL('/assets/telegram/' + mood + '.png', url.origin).toString();
}
export async function sendScoutDiggingPoster(
  token: string, chatId: number, origin: string, fetchImpl: typeof fetch
): Promise<number> {
  const response = await fetchImpl('https://api.telegram.org/bot'+token+'/sendPhoto', {
    method: 'POST', headers: {'content-type':'application/json'},
    body: JSON.stringify({
      chat_id:chatId, photo:scoutPosterUrl(origin,'digging'),
      caption:'🐀 DIGGING... checking 14 days of indexed creator receipts. Stand clear of the dumpster.'
    })
  });
  const data=await response.json().catch(()=>null) as ApiResult<{message_id?:number}>|null;
  if (!response.ok || data?.ok !== true || !Number.isSafeInteger(data.result?.message_id)) {
    throw new Error('TELEGRAM_SCOUT_PHOTO_FAILED');
  }
  return data.result!.message_id!;
}
/** Updates the already-sent photo in place, never sends a second message.
 * A permanent media incompatibility can fall back to editing its caption.
 * Transient Telegram failures still throw: the existing D1 progress fence retries this ID. */
export async function editScoutPoster(
  token: string, chatId: number, messageId: number, caption: string,
  projection: ScoutProjection | null, origin: string, fetchImpl: typeof fetch
): Promise<void> {
  if (!Number.isSafeInteger(messageId) || messageId<1 ||
      !caption || caption.length>MAX_CAPTION) throw new Error('SCOUT_CAPTION_INVALID');
  const keyboard=projection?.candidates.map((candidate,i)=>[{
    text:'🔍 Inspect creator '+(i+1),
    url:new URL('/api/creator/'+encodeURIComponent(candidate.address),origin).toString()
  }]) ?? [];
  const markup={inline_keyboard:keyboard}; // No inert Watch callbacks before authorized webhook permissions.
  const mediaResponse=await fetchImpl('https://api.telegram.org/bot'+token+'/editMessageMedia',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({
      chat_id:chatId,message_id:messageId,
      media:{type:'photo',media:scoutPosterUrl(origin,scoutResultMood(projection)),caption},
      reply_markup:markup
    })
  });
  const mediaData=await mediaResponse.json().catch(()=>null) as ApiResult<unknown>|null;
  if (mediaResponse.ok && mediaData?.ok===true) return;
  if (alreadyApplied(mediaResponse.status,mediaData)) return;
  // An unavailable/unsupported state image must not strand the original digging card.
  // Rate limits and 5xx are transient: fail closed and let the durable retry reuse messageId.
  if (mediaResponse.status!==400 && mediaResponse.status!==404)
    throw new Error('TELEGRAM_SCOUT_EDIT_FAILED');
  const captionResponse=await fetchImpl('https://api.telegram.org/bot'+token+'/editMessageCaption',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({chat_id:chatId,message_id:messageId,caption,reply_markup:markup})
  });
  const captionData=await captionResponse.json().catch(()=>null) as ApiResult<unknown>|null;
  if ((!captionResponse.ok || captionData?.ok!==true) &&
      !alreadyApplied(captionResponse.status,captionData))
    throw new Error('TELEGRAM_SCOUT_EDIT_FAILED');
}
