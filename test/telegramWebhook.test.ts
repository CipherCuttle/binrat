import assert from 'node:assert/strict';
import test from 'node:test';
import { registerTelegramWebhook, validateTelegramWebhookUrl, verifyTelegramWebhook } from '../src/telegram/webhook.js';

test('webhook URL must be HTTPS', () => {
  assert.throws(() => validateTelegramWebhookUrl('http://example.test/hook'), /TELEGRAM_WEBHOOK_URL_INVALID/);
  assert.equal(
    validateTelegramWebhookUrl('https://example.test/telegram/webhook'),
    'https://example.test/telegram/webhook'
  );
});

test('webhook registration posts secret-authenticated message-only webhook', async () => {
  let calledUrl = '';
  let body: Record<string, unknown> = {};
  const fakeFetch: typeof fetch = async (input, init) => {
    calledUrl = String(input);
    body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return new Response(JSON.stringify({ ok: true, result: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  };

  await registerTelegramWebhook(
    '123:secret',
    'webhook-secret',
    'https://binrat.example.test/telegram/webhook',
    fakeFetch
  );

  assert.equal(calledUrl, 'https://api.telegram.org/bot123:secret/setWebhook');
  assert.equal(body.url, 'https://binrat.example.test/telegram/webhook');
  assert.equal(body.secret_token, 'webhook-secret');
  assert.deepEqual(body.allowed_updates, ['message']);
  assert.equal(body.drop_pending_updates, false);
});

test('webhook registration fails closed on Telegram rejection', async () => {
  const fakeFetch: typeof fetch = async () => new Response(
    JSON.stringify({ ok: false, description: 'bad webhook' }),
    { status: 400, headers: { 'content-type': 'application/json' } }
  );

  await assert.rejects(
    () => registerTelegramWebhook(
      '123:secret',
      'webhook-secret',
      'https://binrat.example.test/telegram/webhook',
      fakeFetch
    ),
    /TELEGRAM_WEBHOOK_REGISTRATION_FAILED/
  );
});


test('webhook verification returns only sanitized delivery state', async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
    ok: true,
    result: {
      url: 'https://binrat.example.test/telegram/webhook',
      pending_update_count: 0
    }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

  const result = await verifyTelegramWebhook(
    '123:secret',
    'https://binrat.example.test/telegram/webhook',
    fakeFetch
  );
  assert.deepEqual(result, {
    url: 'https://binrat.example.test/telegram/webhook',
    pendingUpdateCount: 0,
    lastErrorDate: null,
    lastErrorMessage: null
  });
});

test('webhook verification fails closed on URL mismatch', async () => {
  const fakeFetch: typeof fetch = async () => new Response(JSON.stringify({
    ok: true,
    result: {
      url: 'https://wrong.example.test/telegram/webhook',
      pending_update_count: 0
    }
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

  await assert.rejects(
    () => verifyTelegramWebhook(
      '123:secret',
      'https://binrat.example.test/telegram/webhook',
      fakeFetch
    ),
    /TELEGRAM_WEBHOOK_URL_MISMATCH/
  );
});
