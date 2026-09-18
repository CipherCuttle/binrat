import { ARC_CHAIN_ID } from '../arc/chain.js';
import { projectBagIntelligence } from '../public/bagIntelligence.js';
import { projectCreatorFile } from '../public/creatorFile.js';
import { projectPublicFeed } from '../public/project.js';
import { projectReplayBundle } from '../public/replayBundle.js';
import type { PublicFeed } from '../public/types.js';
import { parseRepliesEnabled } from '../telegram/control.js';
import { renderRatReplyDetailed, validateCapabilityManifest, type RatConfig } from '../telegram/rat.js';
import { D1RuntimeStateStore, type D1RuntimeState } from './runtimeState.js';
import { D1Store } from './d1Store.js';
import { D1TelegramLedger } from './telegramLedger.js';
import type { D1DatabaseLike } from './d1Types.js';

export interface BinratWorkerEnv {
  DB: D1DatabaseLike;
  CAPABILITY_MANIFEST_JSON?: string;
  BINRAT_MAX_STATUS_AGE_MS?: string;
  BINRAT_PUBLIC_SITE_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_REPLIES_ENABLED?: string;
  TELEGRAM_MAX_MESSAGES_PER_MINUTE?: string;
}

interface ReadyContext {
  store: D1Store;
  runtime: D1RuntimeState;
  feed: PublicFeed;
}

interface TelegramChat {
  id: number;
  type?: string;
}

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  text?: string;
  reply_to_message?: {
    message_id: number;
    from?: TelegramUser;
  };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramApiResponse<T> {
  ok?: boolean;
  description?: string;
  result?: T;
  parameters?: { retry_after?: number };
}

export interface WorkerDeps {
  externalFetch: typeof fetch;
  now: () => number;
}

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_DEPS: WorkerDeps = { externalFetch: fetch, now: Date.now };
const botIdentityCache = new Map<string, Promise<TelegramUser>>();

export default {
  fetch(request: Request, env: BinratWorkerEnv): Promise<Response> {
    return handleWorkerRequest(request, env);
  }
};

export async function handleWorkerRequest(
  request: Request,
  env: BinratWorkerEnv,
  deps: WorkerDeps = DEFAULT_DEPS
): Promise<Response> {
  let pathname: string;
  let origin: string;
  try {
    const url = new URL(request.url);
    pathname = url.pathname;
    origin = url.origin;
  } catch {
    return json(400, { error: 'INVALID_PATH' });
  }

  if (request.method === 'POST' && pathname === '/telegram/webhook') {
    return telegramWebhook(request, env, origin, deps);
  }

  if (request.method === 'GET' && pathname === '/health') {
    let repliesEnabled = false;
    try { repliesEnabled = parseRepliesEnabled(env.TELEGRAM_REPLIES_ENABLED); } catch {}
    const manifest = readManifest(env);
    return json(200, {
      ok: true,
      service: 'binrat-cloudflare-edge',
      capabilityStatus: manifest?.capabilities.telegramRatV0?.engineeringStatus ?? 'UNKNOWN',
      launchAuthorization: manifest?.launchAuthorization.status ?? 'UNVERIFIED_REMOTE_STATUS',
      repliesEnabled
    });
  }

  if (request.method === 'GET' && pathname.startsWith('/api/')) {
    return handleBinratApiRequest(request, env);
  }

  return json(404, { error: 'NOT_FOUND' });
}

export async function handleBinratApiRequest(
  request: Request,
  env: BinratWorkerEnv
): Promise<Response> {
  if (request.method !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  let pathname: string;
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return json(400, { error: 'INVALID_PATH' });
  }

  try {
    if (pathname === '/api/capabilities') return capabilities(env);
    if (pathname === '/api/health') return health(env);

    const ready = await readyContext(env);
    if (!ready) return json(503, { ready: false, reason: 'INDEX_NOT_READY' });
    const { store, feed } = ready;

    if (pathname === '/api/feed') return json(200, feed);

    if (pathname.startsWith('/api/creator/')) {
      const creator = pathname.slice('/api/creator/'.length).toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(creator)) return json(400, { error: 'CREATOR_ADDRESS_INVALID' });
      const creatorFile = await projectCreatorFile(feed, creator);
      return creatorFile ? json(200, creatorFile) : json(404, { error: 'CREATOR_NOT_INDEXED' });
    }

    if (pathname.startsWith('/api/bag/') && pathname.endsWith('/intelligence')) {
      const bagId = pathname.slice('/api/bag/'.length, -'/intelligence'.length);
      if (!bagId) return json(400, { error: 'BAG_ID_INVALID' });
      const bag = feed.bags.find((item) => item.id === bagId);
      if (!bag) return json(404, { error: 'BAG_NOT_FOUND' });
      const observations = (await store.listObservationsForLaunch(bag.id))
        .filter((receipt) => receipt.observedBlock <= BigInt(feed.asOfBlock));
      return json(200, await projectBagIntelligence(feed, bag, observations));
    }

    if (pathname.startsWith('/api/bag/') && pathname.endsWith('/replay')) {
      const bagId = pathname.slice('/api/bag/'.length, -'/replay'.length);
      if (!bagId) return json(400, { error: 'BAG_ID_INVALID' });
      const bag = feed.bags.find((item) => item.id === bagId);
      if (!bag) return json(404, { error: 'BAG_NOT_FOUND' });
      const observations = (await store.listObservationsForLaunch(bag.id))
        .filter((receipt) => receipt.observedBlock <= BigInt(feed.asOfBlock));
      return json(200, await projectReplayBundle(feed, bag, observations));
    }

    if (pathname.startsWith('/api/bag/')) {
      const bagId = pathname.slice('/api/bag/'.length);
      if (!bagId) return json(400, { error: 'BAG_ID_INVALID' });
      const bag = feed.bags.find((item) => item.id === bagId);
      if (!bag) return json(404, { error: 'BAG_NOT_FOUND' });
      return json(200, {
        schemaVersion: feed.schemaVersion,
        chainId: feed.chainId,
        asOfBlock: feed.asOfBlock,
        historyCoverage: feed.historyCoverage,
        bag,
        receipt: feed.receipt
      });
    }

    return json(404, { error: 'NOT_FOUND' });
  } catch {
    return json(503, { ready: false, reason: 'PUBLIC_PROJECTION_UNAVAILABLE' });
  }
}

async function telegramWebhook(
  request: Request,
  env: BinratWorkerEnv,
  origin: string,
  deps: WorkerDeps
): Promise<Response> {
  const token = required(env.TELEGRAM_BOT_TOKEN, 'TELEGRAM_BOT_TOKEN');
  const webhookSecret = required(env.TELEGRAM_WEBHOOK_SECRET, 'TELEGRAM_WEBHOOK_SECRET');
  if (request.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) {
    return json(401, { error: 'INVALID_WEBHOOK_SECRET' });
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(413, { error: 'BODY_TOO_LARGE' });
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return json(400, { error: 'INVALID_BODY' });
  }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return json(413, { error: 'BODY_TOO_LARGE' });
  }

  let update: TelegramUpdate;
  try {
    update = JSON.parse(text) as TelegramUpdate;
  } catch {
    return json(400, { error: 'INVALID_JSON' });
  }

  const ledger = new D1TelegramLedger(env.DB);
  let claim: 'CLAIMED' | 'BUSY' | 'SEEN';
  try {
    claim = await ledger.claim(update.update_id, deps.now());
  } catch (error) {
    return json(error instanceof Error && error.message === 'INVALID_UPDATE_ID' ? 400 : 503, {
      error: safeErrorCode(error)
    });
  }

  if (claim === 'BUSY') return json(503, { ok: false, retryable: true, reason: 'UPDATE_IN_FLIGHT' });
  if (claim === 'SEEN') return json(200, { ok: true, duplicate: true, persisted: true });

  try {
    const repliesEnabled = parseRepliesEnabled(env.TELEGRAM_REPLIES_ENABLED);
    if (!repliesEnabled) {
      await ledger.completeIgnored(update.update_id, 'IGNORED', deps.now());
      return json(200, { ok: true, ignored: true, repliesEnabled: false });
    }

    const message = update.message;
    if (!message?.text) {
      await ledger.completeIgnored(update.update_id, 'IGNORED', deps.now());
      return json(200, { ok: true, ignored: true });
    }

    const rateLimit = integerSetting(env.TELEGRAM_MAX_MESSAGES_PER_MINUTE, 12, 1, 10_000);
    if (!(await ledger.allowChat(message.chat.id, rateLimit, 60_000, deps.now()))) {
      await ledger.completeIgnored(update.update_id, 'RATE_LIMITED', deps.now());
      return json(200, { ok: true, rateLimited: true });
    }

    let allowUnaddressed = message.chat.type === 'private';
    if (!allowUnaddressed && message.reply_to_message?.from?.id !== undefined) {
      const identity = await getBotIdentity(token, deps.externalFetch);
      allowUnaddressed = message.reply_to_message.from.id === identity.id;
    }

    const manifest = readManifest(env);
    if (!manifest) throw new Error('CAPABILITY_MANIFEST_INVALID');

    const config: RatConfig = {
      apiBaseUrl: origin,
      siteUrl: env.BINRAT_PUBLIC_SITE_URL?.trim() || origin,
      manifest,
      manifestMode: 'REMOTE_FAIL_CLOSED'
    };

    const localFetch: typeof fetch = async (input, init) => {
      const localRequest = input instanceof Request ? input : new Request(input, init);
      const url = new URL(localRequest.url);
      if (url.origin === origin && url.pathname.startsWith('/api/')) {
        return handleBinratApiRequest(localRequest, env);
      }
      return deps.externalFetch(localRequest);
    };

    const reply = await renderRatReplyDetailed(
      message.text,
      config,
      localFetch,
      { allowUnaddressed }
    );

    if (!reply) {
      await ledger.completeIgnored(update.update_id, 'IGNORED', deps.now());
      return json(200, { ok: true, ignored: true });
    }

    const telegramMessageId = await sendMessage(
      token,
      message.chat.id,
      reply.text,
      deps.externalFetch
    );

    await ledger.completeReply({
      updateId: update.update_id,
      chatId: message.chat.id,
      intent: reply.intent,
      rendererVersion: reply.rendererVersion,
      voiceVariant: reply.voiceVariant,
      planDigest: reply.planDigest,
      replyDigest: reply.replyDigest,
      answerPlan: reply.answerPlan,
      receiptIds: reply.receiptIds,
      telegramMessageId
    }, deps.now());

    console.log(JSON.stringify({
      event: 'TELEGRAM_RAT_REPLY',
      updateId: update.update_id,
      intent: reply.intent,
      rendererVersion: reply.rendererVersion,
      voiceVariant: reply.voiceVariant,
      replyDigest: reply.replyDigest,
      planDigest: reply.planDigest,
      answerPlan: reply.answerPlan,
      receiptIds: reply.receiptIds,
      telegramMessageId
    }));

    return json(200, { ok: true });
  } catch (error) {
    await ledger.release(update.update_id).catch(() => {});
    return json(503, { error: safeErrorCode(error) });
  }
}

async function getBotIdentity(token: string, fetchImpl: typeof fetch): Promise<TelegramUser> {
  let pending = botIdentityCache.get(token);
  if (!pending) {
    pending = (async () => {
      const response = await fetchImpl(`https://api.telegram.org/bot${token}/getMe`);
      let parsed: TelegramApiResponse<TelegramUser> = {};
      try { parsed = await response.json() as TelegramApiResponse<TelegramUser>; } catch {}
      if (!response.ok || parsed.ok !== true || !parsed.result || !Number.isSafeInteger(parsed.result.id)) {
        throw new Error('TELEGRAM_GET_ME_FAILED');
      }
      return parsed.result;
    })();
    botIdentityCache.set(token, pending);
    pending.catch(() => botIdentityCache.delete(token));
  }
  return pending;
}

async function sendMessage(
  token: string,
  chatId: number,
  text: string,
  fetchImpl: typeof fetch
): Promise<number | null> {
  const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.slice(0, 4096),
      disable_web_page_preview: true
    })
  });

  let parsed: TelegramApiResponse<{ message_id?: number }> = {};
  try { parsed = await response.json() as TelegramApiResponse<{ message_id?: number }>; } catch {}
  if (!response.ok || parsed.ok !== true) {
    const retryAfter = parsed.parameters?.retry_after;
    if (Number.isSafeInteger(retryAfter) && retryAfter! > 0) {
      console.error(JSON.stringify({ event: 'TELEGRAM_RATE_LIMITED', retryAfterSeconds: retryAfter }));
    }
    throw new Error('TELEGRAM_SEND_FAILED');
  }
  return Number.isSafeInteger(parsed.result?.message_id) ? parsed.result!.message_id! : null;
}

async function health(env: BinratWorkerEnv): Promise<Response> {
  const store = new D1Store(env.DB, ARC_CHAIN_ID);
  const runtimeStore = new D1RuntimeStateStore(env.DB, ARC_CHAIN_ID);
  const [checkpoint, launches, nextBlock, runtime] = await Promise.all([
    store.getCheckpoint(),
    store.listLaunches(),
    store.getHistoricalBackfillNextBlock(),
    runtimeStore.get()
  ]);

  const fresh = runtime ? runtimeFresh(runtime, maxStatusAgeMs(env)) : false;
  const indexReady = Boolean(checkpoint && runtime?.sourceVerified && !runtime.lastSyncError && fresh);
  const observationReady = Boolean(runtime?.observationReady && !runtime.lastObservationError && fresh);

  return json(200, {
    ok: indexReady,
    chainId: ARC_CHAIN_ID,
    indexReady,
    checkpointBlock: checkpoint?.blockNumber.toString() ?? null,
    launchCount: checkpoint
      ? launches.filter((launch) => launch.blockNumber <= checkpoint.blockNumber).length
      : 0,
    historyBackfillComplete: runtime?.historyBackfillComplete ?? false,
    historyBackfillTargetBlock: runtime?.historyBackfillTargetBlock?.toString() ?? null,
    historyBackfillNextBlock: nextBlock?.toString() ?? null,
    lastHistoryError: runtime?.lastHistoryError ?? null,
    observationReady,
    lastObservationError: runtime?.lastObservationError ?? null,
    lastSyncError: runtime?.lastSyncError ?? null,
    runtimeFresh: fresh,
    runtimeUpdatedAtMs: runtime?.updatedAtMs ?? null
  });
}

function capabilities(env: BinratWorkerEnv): Response {
  const manifest = readManifest(env);
  return manifest
    ? json(200, manifest)
    : json(503, { error: 'CAPABILITY_MANIFEST_NOT_CONFIGURED' });
}

function readManifest(env: BinratWorkerEnv) {
  if (!env.CAPABILITY_MANIFEST_JSON) return null;
  try {
    return validateCapabilityManifest(JSON.parse(env.CAPABILITY_MANIFEST_JSON));
  } catch {
    return null;
  }
}

async function readyContext(env: BinratWorkerEnv): Promise<ReadyContext | null> {
  const store = new D1Store(env.DB, ARC_CHAIN_ID);
  const runtimeStore = new D1RuntimeStateStore(env.DB, ARC_CHAIN_ID);
  const runtime = await runtimeStore.get();
  if (
    !runtime ||
    !runtime.sourceVerified ||
    runtime.lastSyncError ||
    !runtimeFresh(runtime, maxStatusAgeMs(env))
  ) return null;

  const state = await store.readPublicProjectionState();
  if (!state) return null;

  const feed = await projectPublicFeed({
    chainId: ARC_CHAIN_ID,
    asOfBlock: state.checkpoint.blockNumber,
    asOfBlockHash: state.checkpoint.blockHash,
    launches: state.launches,
    facts: state.facts
  });

  const [after, afterRuntime] = await Promise.all([
    store.getCheckpoint(),
    runtimeStore.get()
  ]);
  if (
    !after ||
    after.blockNumber !== state.checkpoint.blockNumber ||
    after.blockHash !== state.checkpoint.blockHash ||
    !afterRuntime ||
    afterRuntime.updatedAtMs !== runtime.updatedAtMs ||
    !afterRuntime.sourceVerified ||
    afterRuntime.lastSyncError ||
    !runtimeFresh(afterRuntime, maxStatusAgeMs(env))
  ) return null;

  return { store, runtime: afterRuntime, feed };
}

function maxStatusAgeMs(env: BinratWorkerEnv): number {
  return integerSetting(env.BINRAT_MAX_STATUS_AGE_MS, 60_000, 1_000, 3_600_000);
}

function runtimeFresh(runtime: D1RuntimeState, maxAgeMs: number): boolean {
  const age = Date.now() - runtime.updatedAtMs;
  return age >= 0 && age <= maxAgeMs;
}

function integerSetting(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function required(value: string | undefined, name: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`MISSING_CONFIG:${name}`);
  return trimmed;
}

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return /^[A-Z0-9_:.-]+$/.test(message) ? message : 'TELEGRAM_RAT_FAILED';
}

function json(status: number, value: unknown): Response {
  return Response.json(value, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}
