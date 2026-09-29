interface TelegramResult<T> { ok?: boolean; result?: T; description?: string }

/** This is deliberately a closed allowlist: no user- or provider-controlled media URL reaches Telegram. */
export type RatMediaState =
  | 'idle-neutral' | 'cheeky' | 'inquisitive' | 'digging' | 'evidence-found'
  | 'repeat-creator' | 'alert' | 'empty-paws' | 'error' | 'insulted';

const MAX_CAPTION = 1024;

function alreadyApplied(status: number, result: TelegramResult<unknown> | null): boolean {
  return status === 400 && /message is not modified/i.test(result?.description ?? '');
}

export function ratMediaUrl(origin: string, state: RatMediaState): string {
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new Error('RAT_MEDIA_ORIGIN_INVALID'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) {
    throw new Error('RAT_MEDIA_ORIGIN_INVALID');
  }
  return new URL(`/assets/telegram/${state}.png`, parsed.origin).toString();
}

export function ratCaption(value: string): string {
  const normalized = value.trim();
  return normalized.length <= MAX_CAPTION ? normalized : `${normalized.slice(0, MAX_CAPTION - 1)}…`;
}

export async function sendRatCard(
  token: string, chatId: number, origin: string, state: RatMediaState, caption: string, fetchImpl: typeof fetch
): Promise<number> {
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo: ratMediaUrl(origin, state), caption: ratCaption(caption) })
  });
  const result = await response.json().catch(() => null) as TelegramResult<{ message_id?: number }> | null;
  if (!response.ok || result?.ok !== true || !Number.isSafeInteger(result.result?.message_id)) {
    // Telegram definitively rejected the approved image before creating a message.
    // Callers may safely fall back to text without risking a second card.
    if (response.status === 400 || response.status === 404) throw new Error('TELEGRAM_RAT_MEDIA_UNSUPPORTED');
    throw new Error('TELEGRAM_RAT_MEDIA_SEND_FAILED');
  }
  return result.result!.message_id!;
}

/** Edit exactly the original card. A 400 "not modified" is replay-safe success. */
export async function editRatCard(
  token: string, chatId: number, messageId: number, origin: string, state: RatMediaState, caption: string, fetchImpl: typeof fetch
): Promise<void> {
  if (!Number.isSafeInteger(messageId) || messageId < 1) throw new Error('TELEGRAM_RAT_MEDIA_ID_INVALID');
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/editMessageMedia`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId,
      media: { type: 'photo', media: ratMediaUrl(origin, state), caption: ratCaption(caption) } })
  });
  const result = await response.json().catch(() => null) as TelegramResult<unknown> | null;
  if ((response.ok && result?.ok === true) || alreadyApplied(response.status, result)) return;
  // Invalid/unavailable artwork is not allowed to make the textual result unusable.
  if (response.status !== 400 && response.status !== 404) throw new Error('TELEGRAM_RAT_MEDIA_EDIT_FAILED');
  const fallback = await fetchImpl(`https://api.telegram.org/bot${token}/editMessageCaption`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption: ratCaption(caption) })
  });
  const fallbackResult = await fallback.json().catch(() => null) as TelegramResult<unknown> | null;
  if ((!fallback.ok || fallbackResult?.ok !== true) && !alreadyApplied(fallback.status, fallbackResult)) {
    throw new Error('TELEGRAM_RAT_MEDIA_EDIT_FAILED');
  }
}

export function autonomousResultMedia(command: string, reply: string): RatMediaState {
  if (/source is temporarily unavailable|index is unavailable|could not be verified/i.test(reply)) return 'error';
  if (/empty paws|no qualifying|canonical evidence is missing/i.test(reply)) return 'empty-paws';
  if (command === 'watch') return 'inquisitive';
  if (command === 'start') return /🐀 BINRAT/.test(reply) ? 'idle-neutral' : 'evidence-found';
  if (command === 'why' || command === 'share') return 'evidence-found';
  if (command === 'rats' || (command === 'dig' && /DERIVED:\s*[2-9]\s+referenced launch record/i.test(reply))) return 'repeat-creator';
  return 'evidence-found';
}
