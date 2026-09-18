type FetchLike = typeof fetch;

interface TelegramWebhookResponse {
  ok?: boolean;
  description?: string;
  result?: boolean;
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
