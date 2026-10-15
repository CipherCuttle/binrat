/** PR178 routes with explicit consent; mounted only by opt-in composition. */
import type { PortablePonsTripwire } from './ponsTripwire.js';

const MAX_BODY = 16_384;
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
async function body(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new Error('BODY_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_BODY');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('INVALID_BODY'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('INVALID_BODY');
  return parsed as Record<string, unknown>;
}

export async function handlePortablePonsTripwireRequest(request: Request, tripwire: PortablePonsTripwire): Promise<Response> {
  if (request.method !== 'POST') return reply(405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
  const action = /^\/api\/pons-tripwire\/(watch|status|cancel)$/.exec(new URL(request.url).pathname)?.[1];
  if (!action) return reply(404, { ok: false, error: 'NOT_FOUND' });
  try {
    const input = await body(request);
    if (Object.keys(input).some(key => key !== 'initData' && key !== 'caseId' && !(action === 'watch' && key === 'consent')) || typeof input.initData !== 'string') throw new Error('INVALID_BODY');
    if (typeof input.caseId !== 'string' || !/^[0-9a-f]{64}$/.test(input.caseId)) throw new Error('INVALID_CASE_ID');
    const principal = tripwire.authorize(input.initData);
    if (action === 'watch') return reply(200, { ok: true, watch: await tripwire.watch(principal, input.caseId, input.consent === true) });
    const watch = await tripwire.forCase(principal, input.caseId);
    if (action === 'cancel') {
      if (watch) tripwire.cancel(principal, watch.generation);
      return reply(200, { ok: true, watch: watch ? await tripwire.forCase(principal, input.caseId) : null });
    }
    return reply(200, { ok: true, watch });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PONS_TRIPWIRE_UNAVAILABLE';
    const status = code === 'BODY_TOO_LARGE' ? 413 : code === 'OWNER_ONLY' || code === 'PONS_TRIPWIRE_DISABLED' ? 403 :
      code === 'MINI_APP_AUTH_INVALID' ? 401 : code === 'INVALID_BODY' || code === 'INVALID_CASE_ID' || code === 'PONS_TRIPWIRE_CONSENT_REQUIRED' ? 400 :
      code === 'PONS_TRIPWIRE_RATE_LIMIT' || code === 'PONS_TRIPWIRE_WATCH_LIMIT' ? 429 : 503;
    // Visible unavailability without leaking provider URLs, tokens or SQL errors.
    return reply(status, { ok: false, error: status === 503 ? 'PONS_TRIPWIRE_UNAVAILABLE' : code });
  }
}
