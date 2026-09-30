import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TelegramMiniAppUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedMiniAppPrincipal {
  userId: number;
  chatId: number;
  authDate: number;
  queryId: string | null;
  user: TelegramMiniAppUser;
}

function fail(): never { throw new Error('MINI_APP_AUTH_INVALID'); }

/** Telegram's first-party Mini App HMAC verification, with replay expiry. */
export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  nowMs = Date.now(),
  maxAgeSeconds = 300
): VerifiedMiniAppPrincipal {
  if (!initData || initData.length > 8192 || !botToken || !Number.isSafeInteger(nowMs) ||
      !Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 30 || maxAgeSeconds > 3600) fail();
  const params = new URLSearchParams(initData);
  const entries = [...params.entries()];
  const keys = entries.map(([key]) => key);
  if (new Set(keys).size !== keys.length) fail();
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) fail();
  // First-party bot-token verification covers every received field except the
  // hash itself. The optional Ed25519 `signature` therefore remains signed here.
  const check = entries
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(check).digest();
  const supplied = Buffer.from(hash, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) fail();

  const authDate = Number(params.get('auth_date'));
  const nowSeconds = Math.floor(nowMs / 1000);
  if (!Number.isSafeInteger(authDate) || authDate <= 0 || authDate > nowSeconds + 30 ||
      nowSeconds - authDate > maxAgeSeconds) fail();
  let user: TelegramMiniAppUser;
  try { user = JSON.parse(params.get('user') ?? '') as TelegramMiniAppUser; }
  catch { fail(); }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || user.is_bot === true) fail();
  return {
    userId: user.id,
    // A browser-supplied chat_id is never accepted as authority. Private Mini App
    // ownership is bound to the verified Telegram user.
    chatId: user.id,
    authDate,
    queryId: params.get('query_id'),
    user
  };
}
