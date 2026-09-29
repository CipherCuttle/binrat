import assert from 'node:assert/strict';
import test from 'node:test';
import { autonomousResultMedia, editRatCard, ratCaption, ratMediaUrl, sendRatCard } from '../src/telegram/ratMedia.js';

test('rat media uses only same-origin HTTPS approved assets and respects the caption bound', () => {
  assert.equal(ratMediaUrl('https://binrat.example/path', 'digging'), 'https://binrat.example/assets/telegram/digging.png');
  assert.throws(() => ratMediaUrl('http://binrat.example', 'digging'), /ORIGIN_INVALID/);
  assert.throws(() => ratMediaUrl('https://u:p@binrat.example', 'digging'), /ORIGIN_INVALID/);
  assert.equal(ratCaption('x'.repeat(2000)).length, 1024);
  assert.equal(autonomousResultMedia('dig', '🐀 empty paws.'), 'empty-paws');
  assert.equal(autonomousResultMedia('dig', 'DERIVED: 2 referenced launch records match this subject.'), 'repeat-creator');
  assert.equal(autonomousResultMedia('why', 'receipt'), 'evidence-found');
});

test('rat media changes the original card and treats message-not-modified as idempotent success', async () => {
  const requests: Array<{ url: string; body: string }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), body: String(init?.body) });
    if (String(url).endsWith('/sendPhoto')) return Response.json({ ok: true, result: { message_id: 7 } });
    return new Response(JSON.stringify({ ok: false, description: 'Bad Request: message is not modified' }), { status: 400 });
  };
  const id = await sendRatCard('token', 1, 'https://binrat.example', 'digging', 'digging', fetchImpl);
  await editRatCard('token', 1, id, 'https://binrat.example', 'evidence-found', 'done', fetchImpl);
  assert.equal(requests.length, 2);
  assert.match(requests[0]!.body, /assets\/telegram\/digging\.png/);
  assert.match(requests[1]!.body, /assets\/telegram\/evidence-found\.png/);
});

test('a definitive unsupported photo reports a safe text-fallback condition', async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 400 });
  await assert.rejects(
    sendRatCard('token', 1, 'https://binrat.example', 'alert', 'found', fetchImpl),
    /TELEGRAM_RAT_MEDIA_UNSUPPORTED/
  );
});
