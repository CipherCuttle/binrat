import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { renderRatReply, validateCapabilityManifest, type RatConfig } from './rat.js';
import { PerChatRateGate, UpdateDeliveryFence } from './deliveryGuard.js';

interface TelegramChat {
  id: number;
  type?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
}

const MAX_BODY_BYTES = 64 * 1024;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_CONFIG:${name}`);
  return value;
}

function integerEnv(name: string, fallback: number, minimum: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`INVALID_CONFIG:${name}`);
  return value;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function json(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  });
  response.end(JSON.stringify(value));
}

async function sendMessage(token: string, chatId: number, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4096),
      disable_web_page_preview: true
    })
  });

  let parsed: TelegramApiResponse = {};
  try { parsed = await response.json() as TelegramApiResponse; } catch {}
  if (!response.ok || parsed.ok !== true) throw new Error('TELEGRAM_SEND_FAILED');
}

const token = requiredEnv('TELEGRAM_BOT_TOKEN');
const webhookSecret = requiredEnv('TELEGRAM_WEBHOOK_SECRET');
const updateFence = new UpdateDeliveryFence();
const rateGate = new PerChatRateGate(integerEnv('TELEGRAM_MAX_MESSAGES_PER_MINUTE', 12, 1));
const manifestPath = resolve(process.cwd(), 'docs/CAPABILITY_MANIFEST_V0.json');
const manifest = validateCapabilityManifest(JSON.parse(readFileSync(manifestPath, 'utf8')));
const config: RatConfig = {
  apiBaseUrl: requiredEnv('BINRAT_PUBLIC_BASE_URL'),
  siteUrl: process.env.BINRAT_PUBLIC_SITE_URL?.trim() || requiredEnv('BINRAT_PUBLIC_BASE_URL'),
  manifest
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'GET' && url.pathname === '/health') {
      json(response, 200, {
        ok: true,
        service: 'binrat-telegram-rat',
        capabilityStatus: config.manifest.capabilities.telegramRatV0?.engineeringStatus ?? 'UNKNOWN',
        launchAuthorization: config.manifest.launchAuthorization.status
      });
      return;
    }

    if (request.method !== 'POST' || url.pathname !== '/telegram/webhook') {
      json(response, 404, { error: 'NOT_FOUND' });
      return;
    }

    if (request.headers['x-telegram-bot-api-secret-token'] !== webhookSecret) {
      json(response, 401, { error: 'INVALID_WEBHOOK_SECRET' });
      return;
    }

    const body = await readBody(request);
    const update = JSON.parse(body) as TelegramUpdate;
    const begin = updateFence.begin(update.update_id);
    if (begin === 'INVALID') {
      json(response, 400, { error: 'INVALID_UPDATE_ID' });
      return;
    }
    if (begin === 'SEEN' || begin === 'IN_FLIGHT') {
      json(response, 200, { ok: true, duplicate: true });
      return;
    }

    try {
      const message = update.message;
      if (!message?.text) {
        updateFence.commit(update.update_id);
        json(response, 200, { ok: true, ignored: true });
        return;
      }

      if (!rateGate.allow(message.chat.id)) {
        updateFence.commit(update.update_id);
        json(response, 200, { ok: true, rateLimited: true });
        return;
      }

      const reply = await renderRatReply(message.text, config);
      if (!reply) {
        updateFence.commit(update.update_id);
        json(response, 200, { ok: true, ignored: true });
        return;
      }

      await sendMessage(token, message.chat.id, reply);
      updateFence.commit(update.update_id);
      json(response, 200, { ok: true });
    } catch (error) {
      updateFence.release(update.update_id);
      throw error;
    }
  } catch (error) {
    const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'TELEGRAM_RAT_FAILED';
    json(response, code === 'BODY_TOO_LARGE' ? 413 : 503, { error: code });
  }
});

const port = integerEnv('TELEGRAM_PORT', 4175, 1);
server.listen(port, '0.0.0.0', () => console.log(JSON.stringify({ event: 'TELEGRAM_RAT_READY', port })));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close());
}
