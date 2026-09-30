import { readFile } from 'node:fs/promises';

export interface TelegramApiEnvelope<T> {
  ok?: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

export type Sleep = (ms: number) => Promise<void>;

export function redactTelegramSecrets(value: string, token?: string): string {
  let output = value;
  if (token) output = output.split(token).join('[REDACTED_TELEGRAM_TOKEN]');
  return output.replace(/bot\d{5,}:[A-Za-z0-9_-]{20,}/g, 'bot[REDACTED_TELEGRAM_TOKEN]');
}

export class TelegramBotApiError extends Error {
  constructor(readonly code: 'REJECTED' | 'AMBIGUOUS' | 'RATE_LIMITED', message: string) {
    super(message);
  }
}

export class TelegramBotApiClient {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep: Sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  ) {
    if (!token.trim()) throw new Error('TELEGRAM_BOT_TOKEN_MISSING');
  }

  async call<T>(method: string, body: Record<string, unknown> = {}): Promise<T> {
    return this.request<T>(method, () => ({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }));
  }

  async setProfilePhoto(assetPath: string): Promise<boolean> {
    const bytes = await readFile(assetPath);
    return this.request<boolean>('setMyProfilePhoto', () => {
      const form = new FormData();
      form.set('photo', JSON.stringify({ type: 'static', photo: 'attach://profile' }));
      form.set('profile', new Blob([bytes], { type: 'image/jpeg' }), 'profile.jpg');
      return { method: 'POST', body: form };
    });
  }

  private async request<T>(method: string, init: () => RequestInit): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await this.fetchImpl(
          `https://api.telegram.org/bot${this.token}/${method}`,
          { ...init(), signal: controller.signal }
        );
        const parsed = await response.json().catch(() => null) as TelegramApiEnvelope<T> | null;
        if (response.ok && parsed?.ok === true && Object.hasOwn(parsed, 'result')) return parsed.result as T;
        const retryAfter = Number(parsed?.parameters?.retry_after);
        if (response.status === 429 && Number.isSafeInteger(retryAfter) && retryAfter > 0 && retryAfter <= 60) {
          if (attempt === 2) throw new TelegramBotApiError('RATE_LIMITED', 'TELEGRAM_RATE_LIMIT_EXHAUSTED');
          await this.sleep(retryAfter * 1000);
          continue;
        }
        const safe = redactTelegramSecrets(String(parsed?.description ?? 'TELEGRAM_API_REJECTED'), this.token);
        if (response.status >= 400 && response.status < 500) {
          throw new TelegramBotApiError('REJECTED', safe);
        }
        throw new TelegramBotApiError('AMBIGUOUS', 'TELEGRAM_API_AMBIGUOUS');
      } catch (error) {
        if (error instanceof TelegramBotApiError) throw error;
        throw new TelegramBotApiError('AMBIGUOUS', 'TELEGRAM_API_AMBIGUOUS');
      } finally {
        clearTimeout(timer);
      }
    }
    throw new TelegramBotApiError('RATE_LIMITED', 'TELEGRAM_RATE_LIMIT_EXHAUSTED');
  }
}
