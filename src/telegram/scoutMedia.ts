import type { ScoutProjection } from './scout.js';

interface ApiResult<T> {
  ok?: boolean;
  result?: T;
}
const MAX_CAPTION = 1024;

/** One first-party static poster until the approved mood derivatives exist. */
export function scoutPosterUrl(origin: string): string {
  const url = new URL(origin);
  if (url.protocol !== 'https:') throw new Error('SCOUT_POSTER_ORIGIN_INVALID');
  return new URL('/assets/binrat-hero.webp', url).toString();
}
export async function sendScoutDiggingPoster(
  token: string, chatId: number, origin: string, fetchImpl: typeof fetch
): Promise<number> {
  const response = await fetchImpl('https://api.telegram.org/bot'+token+'/sendPhoto', {
    method: 'POST', headers: {'content-type':'application/json'},
    body: JSON.stringify({
      chat_id:chatId, photo:scoutPosterUrl(origin),
      caption:'🐀 DIGGING... checking 14 days of indexed creator receipts. Stand clear of the dumpster.'
    })
  });
  const data=await response.json().catch(()=>null) as ApiResult<{message_id?:number}>|null;
  if (!response.ok || data?.ok !== true || !Number.isSafeInteger(data.result?.message_id)) {
    throw new Error('TELEGRAM_SCOUT_PHOTO_FAILED');
  }
  return data.result!.message_id!;
}
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
  const response=await fetchImpl('https://api.telegram.org/bot'+token+'/editMessageCaption',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({
      chat_id:chatId,message_id:messageId,caption,
      reply_markup:{inline_keyboard:keyboard}
    })
  });
  const data=await response.json().catch(()=>null) as ApiResult<unknown>|null;
  if (!response.ok || data?.ok!==true) throw new Error('TELEGRAM_SCOUT_EDIT_FAILED');
}
