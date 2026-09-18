type FetchLike = typeof fetch;

interface TelegramWebhookResponse {
  ok?: boolean;
  description?: string;
  result?: boolean;
}

interface TelegramWebhookInfoResponse {
  ok?: boolean;
  description?: string;
  result?: {
    url?: string;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
  };
}

export interface TelegramWebhookVerification {
  url: string;
  pendingUpdateCount: number;
  lastErrorDate: number | null;
  lastErrorMessage: string | null;
}

export function validateTelegramWebhookUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('TELEGRAM_WEBHOOK_URL_INVALID');
  }
  if (url.protocol !== 'https:' || !url.hostname) throw new Error('TELEGRAM_WEBHOOK_URL_INVALID');
  return url.toString();
}

export async function registerTelegramWebhook(
  token: string,
  secret: string,
  webhookUrl: string,
  fetchImpl: FetchLike = fetch
): Promise<void> {
  const url = validateTelegramWebhookUrl(webhookUrl);
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ['message'],
      drop_pending_updates: false
    })
  });

  let parsed: TelegramWebhookResponse = {};
  try { parsed = await response.json() as TelegramWebhookResponse; } catch {}
  if (!response.ok || parsed.ok !== true || parsed.result !== true) {
    throw new Error('TELEGRAM_WEBHOOK_REGISTRATION_FAILED');
  }
}


export async function verifyTelegramWebhook(
  token: string,
  expectedWebhookUrl: string,
  fetchImpl: FetchLike = fetch
): Promise<TelegramWebhookVerification> {
  const expected = validateTelegramWebhookUrl(expectedWebhookUrl);
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  let parsed: TelegramWebhookInfoResponse = {};
  try { parsed = await response.json() as TelegramWebhookInfoResponse; } catch {}
  const info = parsed.result;
  if (!response.ok || parsed.ok !== true || !info) {
    throw new Error('TELEGRAM_WEBHOOK_INFO_FAILED');
  }
  const actual = typeof info.url === 'string' ? info.url : '';
  if (actual !== expected) throw new Error('TELEGRAM_WEBHOOK_URL_MISMATCH');

  const pending = Number.isSafeInteger(info.pending_update_count) ? info.pending_update_count! : 0;
  return {
    url: actual,
    pendingUpdateCount: pending,
    lastErrorDate: Number.isSafeInteger(info.last_error_date) ? info.last_error_date! : null,
    lastErrorMessage: typeof info.last_error_message === 'string' ? info.last_error_message : null
  };
}
