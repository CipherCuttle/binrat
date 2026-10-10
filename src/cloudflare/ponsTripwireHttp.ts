import { randomUUID, timingSafeEqual } from 'node:crypto';
import { robinhoodWatchSource, type WatchSource } from '../autonomous/source.js';
import { sha256Hex } from '../evidence/canonical.js';
import { verifyTelegramInitData } from '../telegram/miniAppAuth.js';
import { sendCard } from '../telegram/ui/client.js';
import { TELEGRAM_UI_RENDERER_VERSION } from '../telegram/ui/types.js';
import type { D1DatabaseLike } from './d1Types.js';
import { createPonsTripwireWatch, listPonsTripwireWatches, cancelPonsTripwireWatch, readVerifiedPonsTripwireCase } from './ponsTripwire.js';
import { D1TelegramLedger } from './telegramLedger.js';
import { resolveRobinhoodRpcUrl } from './syncQueue.js';
import { D1SyncLeaseStore } from './syncLease.js';

interface Env {
  DB: D1DatabaseLike;
  BINRAT_PONS_TRIPWIRE_ENABLED?: string;
  BINRAT_PONS_TRIPWIRE_DELIVERY_ENABLED?: string;
  BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_WEBHOOK_SECRET_NEXT?: string;
  ROBINHOOD_RPC_URL?: string;
}
interface Deps { now: () => number; externalFetch: typeof fetch; ponsTripwireSource?: WatchSource }
const CASE_ID = /^[0-9a-f]{64}$/;
const MAX_BODY = 16_384;
function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: {'content-type':'application/json', 'cache-control':'no-store'} });
}
function owner(env: Env): number {
  const configured = env.BINRAT_PONS_TRIPWIRE_ALLOWED_USER_ID;
  if (!configured || !/^[1-9][0-9]*$/.test(configured)) throw new Error('PONS_TRIPWIRE_OWNER_NOT_CONFIGURED');
  const id = Number(configured);
  if (!Number.isSafeInteger(id)) throw new Error('PONS_TRIPWIRE_OWNER_NOT_CONFIGURED');
  return id;
}
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
function failure(error: unknown): Response {
  const code = error instanceof Error ? error.message : 'PONS_TRIPWIRE_UNAVAILABLE';
  if (code === 'BODY_TOO_LARGE') return reply(413, {ok:false,error:code});
  if (code === 'INVALID_BODY' || code === 'INVALID_CASE_ID') return reply(400, {ok:false,error:code});
  if (code === 'OWNER_ONLY') return reply(403, {ok:false,error:code});
  if (code === 'INVALID_TELEGRAM_AUTH') return reply(401, {ok:false,error:code});
  if (code.includes('LIMIT') || code.includes('CAP')) return reply(429, {ok:false,error:'PONS_TRIPWIRE_CAP_REACHED'});
  // Never expose RPC URLs, bot tokens, or provider errors.
  return reply(503, {ok:false,error:'PONS_TRIPWIRE_UNAVAILABLE'});
}

/** Separate owner pilot: never enables autonomous commands or accepts a browser-supplied address/chat. */
export async function handlePonsTripwireRequest(request: Request, env: Env, deps: Deps): Promise<Response> {
  if (env.BINRAT_PONS_TRIPWIRE_ENABLED !== 'true') return reply(403, {ok:false,error:'PONS_TRIPWIRE_DISABLED'});
  if (request.method !== 'POST') return reply(405, {ok:false,error:'METHOD_NOT_ALLOWED'});
  let held: {name:string;token:string} | null = null;
  const leases = new D1SyncLeaseStore(env.DB);
  try {
    const input = await body(request);
    if (Object.keys(input).some(key => key !== 'initData' && key !== 'caseId') || typeof input.initData !== 'string') throw new Error('INVALID_BODY');
    if (typeof input.caseId !== 'string' || !CASE_ID.test(input.caseId)) throw new Error('INVALID_CASE_ID');
    const now = deps.now(); let principal;
    try { principal = verifyTelegramInitData(input.initData, env.TELEGRAM_BOT_TOKEN ?? '', now, 300); }
    catch { throw new Error('INVALID_TELEGRAM_AUTH'); }
    if (principal.userId !== owner(env)) throw new Error('OWNER_ONLY');
    const ownerId = `telegram:${principal.userId}`;
    const action = new URL(request.url).pathname.split('/').at(-1);
    if (action === 'watch' || action === 'cancel') {
      const name = `pons_tripwire:mutation:${ownerId}`, token = randomUUID();
      if (!await leases.claim(name,token,now,90_000)) throw new Error('PONS_TRIPWIRE_BUSY');
      held = {name,token};
    }
    if (action === 'watch') {
      if (!await new D1TelegramLedger(env.DB).allowChat(principal.userId, 4, 60_000, now)) return reply(429, {ok:false,error:'PONS_TRIPWIRE_RATE_LIMIT'});
      const watch = await createPonsTripwireWatch(env.DB, deps.ponsTripwireSource ?? robinhoodWatchSource(resolveRobinhoodRpcUrl(env)),
        {ownerId, chatId:principal.userId, launchId:input.caseId, nowMs:now,
          mutationFence:{leaseName:held!.name,ownerToken:held!.token,now:deps.now}});
      return reply(200, {ok:true,watch});
    }
    // A saved source Case remains a cancellation handle even if its evidence is later reorged.
    const watches = await listPonsTripwireWatches(env.DB, ownerId);
    let watch = watches.find(value => value.sourceCaseUrl === `https://binrat.tech/bag/${input.caseId}`) ?? null;
    if (!watch) {
      const evidence = await readVerifiedPonsTripwireCase(env.DB, input.caseId, now);
      watch = watches.find(value => value.deployer === evidence.deployer) ?? null;
    }
    if (action === 'cancel') {
      if (watch) await cancelPonsTripwireWatch(env.DB, ownerId, watch.generation, now);
      return reply(200, {ok:true,watch:watch ? {...watch,state:'CANCELLED'} : null});
    }
    if (action !== 'status') return reply(404, {ok:false,error:'NOT_FOUND'});
    return reply(200, {ok:true,watch});
  } catch (error) { return failure(error); }
  finally { if (held) await leases.release(held.name,held.token); }
}

function sameSecret(candidate: string | null, expected: string | undefined): boolean {
  if (!candidate || !expected) return false;
  const a = Buffer.from(candidate); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a,b);
}

/** Read-only-profile handoff only. Opening this button does not create a watch. */
export async function handlePonsTripwireStart(request: Request, env: Env, deps: Deps): Promise<Response> {
  if (env.BINRAT_PONS_TRIPWIRE_ENABLED !== 'true') return reply(403, {ok:false,error:'PONS_TRIPWIRE_DISABLED'});
  // The authentication handoff is a Telegram message too; opt-in alone grants no transport authority.
  if (env.BINRAT_PONS_TRIPWIRE_DELIVERY_ENABLED !== 'true') return reply(403, {ok:false,error:'PONS_TRIPWIRE_DELIVERY_DISABLED'});
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (!sameSecret(secret,env.TELEGRAM_WEBHOOK_SECRET) && !sameSecret(secret,env.TELEGRAM_WEBHOOK_SECRET_NEXT)) return reply(401, {ok:false,error:'INVALID_WEBHOOK_SECRET'});
  try {
    const update = await body(request) as any;
    const message = update.message;
    if (!Number.isSafeInteger(update.update_id) || update.update_id < 0) throw new Error('INVALID_BODY');
    if (!message || message.chat?.type !== 'private' || message.from?.is_bot || message.from?.id !== message.chat?.id || message.from?.id !== owner(env)) return reply(200, {ok:true,ignored:true});
    const match = typeof message.text === 'string' && /^\/start(?:@BinratBot)? pons_([A-Za-z0-9_-]{43})$/.exec(message.text);
    if (!match) return reply(200, {ok:true,ignored:true});
    const bytes = Buffer.from(match[1]!, 'base64url');
    if (bytes.length !== 32 || bytes.toString('base64url') !== match[1]) throw new Error('INVALID_CASE_ID');
    const id = bytes.toString('hex'); const now = deps.now();
    await readVerifiedPonsTripwireCase(env.DB,id,now);
    if (!env.TELEGRAM_BOT_TOKEN) throw new Error('PONS_TRIPWIRE_UNAVAILABLE');
    const ledger = new D1TelegramLedger(env.DB);
    const claim = await ledger.claim(update.update_id,now);
    if (claim !== 'CLAIMED') return reply(200,{ok:true,duplicate:true});
    if (!await ledger.allowChat(message.chat.id,4,60_000,now)) {
      await ledger.completeIgnored(update.update_id,'RATE_LIMITED',now);
      return reply(200,{ok:true,rateLimited:true});
    }
    const caseUrl = `https://binrat.tech/bag/${id}`;
    const caption = 'Open this Pons Case, inspect its evidence, then explicitly choose WATCH THIS DEPLOYER. Only future verified launches can trigger an alert.';
    // Terminal claim BEFORE transport: a lost response cannot resend this handoff.
    await ledger.completeOperationalReply({updateId:update.update_id,chatId:message.chat.id,intent:'PONS_TRIPWIRE_CASE_HANDOFF',replyDigest:await sha256Hex(`${caseUrl}\n${caption}`),telegramMessageId:null},now);
    try {
      const messageId = await sendCard(env.TELEGRAM_BOT_TOKEN,message.chat.id,'https://binrat.tech',{
        rendererVersion:TELEGRAM_UI_RENDERER_VERSION,view:'CASE',media:'repeat-creator',caption,
        keyboard:[[{text:'OPEN PONS CASE',webAppUrl:caseUrl}]]
      },false,deps.externalFetch);
      await env.DB.prepare("UPDATE telegram_update_receipts SET telegram_message_id=? WHERE update_id=? AND state='REPLIED' AND intent='PONS_TRIPWIRE_CASE_HANDOFF' AND telegram_message_id IS NULL").bind(messageId,update.update_id).run();
      return reply(200,{ok:true});
    } catch { return reply(200,{ok:true,delivery:'UNKNOWN',retry:false}); }
  } catch (error) { return failure(error); }
}
