import { createHash } from 'node:crypto';
import { ARC_CHAIN_ID } from '../arc/chain.js';
import { resolveProductionFundingConfig } from '../dumpsterLedger/config.js';
import { projectDumpsterLedger } from '../dumpsterLedger/project.js';
import { projectBagIntelligence } from '../public/bagIntelligence.js';
import { projectCreatorFile } from '../public/creatorFile.js';
import { projectPublicFeed } from '../public/project.js';
import { projectReplayBundle } from '../public/replayBundle.js';
import type { PublicFeed } from '../public/types.js';
import { projectPublicRatRadarSwapReceipt } from '../ratRadar/activity.js';
import {
  projectRatRadarFreeWatchlist,
  projectRatRadarHolderWatchlist
} from '../ratRadar/watchlist.js';
import {
  ProductionHolderEligibilitySource,
  type HolderEligibilitySource,
  type HolderPolicyEnv
} from '../holder/eligibility.js';
import { parseRepliesEnabled } from '../telegram/control.js';
import { understandRatMessage } from '../telegram/nlp.js';
import {
  entityFromUnderstanding, forgetRatMemory, generateRatBanter, isRatBanterEligible,
  loadRatMemory, pruneRatConversation, reserveRatAiCall, resolveRatFollowup, saveRatMemory,
  type RatAiBinding, type RatMemory
} from './ratConversation.js';
import { renderRatReplyDetailed, validateCapabilityManifest, type RatConfig } from '../telegram/rat.js';
import { D1RuntimeStateStore, type D1RuntimeState } from './runtimeState.js';
import { D1RatWatchStore } from './ratWatch.js';
import { D1RatRadarStore } from './ratRadarStore.js';
import { D1Store } from './d1Store.js';
import { D1TelegramLedger } from './telegramLedger.js';
import {
  D1HolderAuthStore,
  bearerToken,
  createHolderChallenge,
  proveHolderWallet
} from './holderAuth.js';
import type { D1DatabaseLike } from './d1Types.js';
import {
  enqueueSyncCycle,
  handleSyncQueueBatch,
  type CloudflareSyncEnv,
  type SyncQueueBatchLike,
  type SyncQueueProducerLike
} from './syncQueue.js';

export interface BinratWorkerEnv extends CloudflareSyncEnv, HolderPolicyEnv {
  DB: D1DatabaseLike;
  SYNC_QUEUE?: SyncQueueProducerLike;
  CAPABILITY_MANIFEST_JSON?: string;
  BINRAT_FUNDING_CONFIG_JSON?: string;
  BINRAT_HOLDER_WALLET_AUTH_ENABLED?: string;
  BINRAT_MAX_STATUS_AGE_MS?: string;
  BINRAT_PUBLIC_SITE_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_REPLIES_ENABLED?: string;
  TELEGRAM_MAX_MESSAGES_PER_MINUTE?: string;
  /** Both flags must be explicitly 'true'; inference is default-off. */
  RAT_CONVERSATION_ENABLED?: string;
  RAT_AI_ENABLED?: string;
  AI?: RatAiBinding;
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
  from?: TelegramUser;
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
  holderEligibilitySource?: HolderEligibilitySource;
}

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_DEPS: WorkerDeps = { externalFetch: fetch, now: Date.now };
const botIdentityCache = new Map<string, Promise<TelegramUser>>();

export default {
  fetch(request: Request, env: BinratWorkerEnv): Promise<Response> {
    return handleWorkerRequest(request, env);
  },
  async scheduled(_controller: unknown, env: BinratWorkerEnv): Promise<void> {
    const now = Date.now();
    // Opportunistic daily physical deletion; conversation TTL is enforced on every read.
    const utc = new Date(now);
    if (
      (env.RAT_CONVERSATION_ENABLED === 'true' || env.RAT_AI_ENABLED === 'true') &&
      utc.getUTCHours() === 0 && utc.getUTCMinutes() < 5
    ) {
      try { await pruneRatConversation(env.DB, now); }
      catch { /* Maintenance must never block the indexer cron. */ }
    }
    await enqueueSyncCycle(env);
  },
  queue(batch: SyncQueueBatchLike, env: BinratWorkerEnv): Promise<void> {
    return handleSyncQueueBatch(batch, env);
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

  if (request.method === 'POST' && pathname === '/api/holder/challenge') {
    return holderChallenge(request, env, origin, deps);
  }

  if (request.method === 'POST' && pathname === '/api/holder/session') {
    return holderSession(request, env, origin, deps);
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
    return handleBinratApiRequest(request, env, deps);
  }

  return json(404, { error: 'NOT_FOUND' });
}

export async function handleBinratApiRequest(
  request: Request,
  env: BinratWorkerEnv,
  deps: WorkerDeps = DEFAULT_DEPS
): Promise<Response> {
  if (request.method !== 'GET') return json(405, { error: 'METHOD_NOT_ALLOWED' });

  let pathname: string;
  let url: URL;
  try {
    url = new URL(request.url);
    pathname = url.pathname;
  } catch {
    return json(400, { error: 'INVALID_PATH' });
  }

  try {
    if (pathname === '/api/capabilities') return capabilities(env);
    if (pathname === '/api/health') return health(env);
    if (pathname === '/api/dumpster-ledger') return dumpsterLedger(env);

    const ready = await readyContext(env);
    if (!ready) return json(503, { ready: false, reason: 'INDEX_NOT_READY' });
    const { store, feed } = ready;

    if (pathname === '/api/feed') return json(200, feed);

    if (pathname === '/api/rat-radar/watchlist') {
      const radar = new D1RatRadarStore(env.DB, ARC_CHAIN_ID);
      const receipts = await radar.listThroughBlock(BigInt(feed.asOfBlock));
      const depth = url.searchParams.get('depth');
      if (depth !== null && depth !== 'free' && depth !== 'full') {
        return json(400, { error: 'RAT_RADAR_DEPTH_INVALID' });
      }
      if (depth === 'full') {
        if (!holderWalletAuthEnabled(env)) {
          return json(503, { error: 'HOLDER_WALLET_AUTH_NOT_ENABLED', accessTier: 'FREE' });
        }
        const token = bearerToken(request);
        if (!token) return json(401, { error: 'HOLDER_SESSION_REQUIRED', accessTier: 'FREE' });
        const session = await new D1HolderAuthStore(env.DB).getSession(token, deps.now());
        if (!session) return json(401, { error: 'HOLDER_SESSION_INVALID_OR_EXPIRED', accessTier: 'FREE' });
        if (session.accessTier !== 'HOLDER') {
          return json(403, {
            error: 'HOLDER_TIER_REQUIRED',
            accessTier: 'FREE',
            eligibilityStatus: session.eligibilityStatus
          });
        }
        const holder = await projectRatRadarHolderWatchlist(feed, receipts);
        return json(200, {
          ...holder,
          access: {
            accessTier: session.accessTier,
            wallet: session.wallet,
            policyId: session.policyId,
            expiresAtMs: session.expiresAtMs
          }
        });
      }
      return json(200, await projectRatRadarFreeWatchlist(feed, receipts));
    }

    if (pathname.startsWith('/api/rat-radar/activity/')) {
      const activityId = pathname.slice('/api/rat-radar/activity/'.length).toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(activityId)) {
        return json(400, { error: 'RAT_RADAR_ACTIVITY_ID_INVALID' });
      }
      const radar = new D1RatRadarStore(env.DB, ARC_CHAIN_ID);
      const receipt = await radar.getSwap(activityId);
      if (!receipt || receipt.blockNumber > BigInt(feed.asOfBlock)) {
        return json(404, { error: 'RAT_RADAR_ACTIVITY_NOT_FOUND' });
      }
      return json(200, projectPublicRatRadarSwapReceipt(receipt));
    }

    if (pathname.startsWith('/api/rat-radar/address/') && pathname.endsWith('/activity')) {
      const recipient = pathname
        .slice('/api/rat-radar/address/'.length, -'/activity'.length)
        .toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(recipient)) {
        return json(400, { error: 'RAT_RADAR_RECIPIENT_INVALID' });
      }
      const radar = new D1RatRadarStore(env.DB, ARC_CHAIN_ID);
      const receipts = await radar.listForRecipientThroughBlock(recipient, BigInt(feed.asOfBlock));
      return json(200, {
        schemaVersion: 'binrat.rat-radar-address-activity/0.1',
        chainId: ARC_CHAIN_ID,
        asOfBlock: feed.asOfBlock,
        observedRecipientAddress: recipient,
        activityCount: receipts.length,
        activities: receipts.map(projectPublicRatRadarSwapReceipt),
        identityBoundary: 'An observed recipient address is not automatically a human trader identity.'
      });
    }

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

async function holderChallenge(
  request: Request,
  env: BinratWorkerEnv,
  origin: string,
  deps: WorkerDeps
): Promise<Response> {
  if (!holderWalletAuthEnabled(env)) {
    return json(503, { error: 'HOLDER_WALLET_AUTH_NOT_ENABLED' });
  }
  try {
    const body = await readJsonBody(request);
    const wallet = typeof body.wallet === 'string' ? body.wallet : '';
    const challenge = await createHolderChallenge(
      new D1HolderAuthStore(env.DB),
      { wallet, origin, nowMs: deps.now() }
    );
    return json(201, {
      schemaVersion: 'binrat.holder-challenge/0.1',
      purpose: 'BINRAT_HOLDER_GATE_V0',
      chainId: ARC_CHAIN_ID,
      wallet: challenge.wallet,
      nonce: challenge.nonce,
      message: challenge.message,
      issuedAtMs: challenge.issuedAtMs,
      expiresAtMs: challenge.expiresAtMs,
      transactionSigning: false
    });
  } catch (error) {
    return json(holderHttpStatus(error), { error: holderErrorCode(error) });
  }
}

async function holderSession(
  request: Request,
  env: BinratWorkerEnv,
  origin: string,
  deps: WorkerDeps
): Promise<Response> {
  if (!holderWalletAuthEnabled(env)) {
    return json(503, { error: 'HOLDER_WALLET_AUTH_NOT_ENABLED' });
  }
  try {
    const body = await readJsonBody(request);
    const eligibility = deps.holderEligibilitySource ?? new ProductionHolderEligibilitySource(env);
    const result = await proveHolderWallet(
      new D1HolderAuthStore(env.DB),
      eligibility,
      {
        nonce: typeof body.nonce === 'string' ? body.nonce : '',
        message: typeof body.message === 'string' ? body.message : '',
        signature: typeof body.signature === 'string' ? body.signature : '',
        origin,
        nowMs: deps.now()
      }
    );
    return json(201, {
      schemaVersion: 'binrat.holder-session/0.1',
      token: result.token,
      tokenType: 'Bearer',
      wallet: result.session.wallet,
      accessTier: result.session.accessTier,
      policyId: result.session.policyId,
      eligibilityStatus: result.session.eligibilityStatus,
      issuedAtMs: result.session.issuedAtMs,
      expiresAtMs: result.session.expiresAtMs,
      productionHolderEligibilityActive: false,
      transactionSigning: false
    });
  } catch (error) {
    return json(holderHttpStatus(error), { error: holderErrorCode(error) });
  }
}

function holderWalletAuthEnabled(env: BinratWorkerEnv): boolean {
  return env.BINRAT_HOLDER_WALLET_AUTH_ENABLED?.trim() === 'true';
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

    const watchCommand = parseRatWatchCommand(message.text);
    if (watchCommand) {
      const operational = await handleRatWatchCommand(
        watchCommand,
        message.chat.id,
        env,
        deps.now()
      );
      const telegramMessageId = await sendMessage(
        token,
        message.chat.id,
        operational.text,
        deps.externalFetch
      );
      await ledger.completeOperationalReply({
        updateId: update.update_id,
        chatId: message.chat.id,
        intent: operational.intent,
        replyDigest: createHash('sha256').update(operational.text).digest('hex'),
        telegramMessageId
      }, deps.now());
      return json(200, { ok: true });
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
        return handleBinratApiRequest(localRequest, env, deps);
      }
      return deps.externalFetch(localRequest);
    };

    const authorId = Number.isSafeInteger(message.from?.id)
      ? message.from!.id
      : message.chat.type === 'private' ? message.chat.id : null;
    const addressed = allowUnaddressed || /\b(?:binrat|rat)\b|\$binrat\b/i.test(message.text);
    const memoryEnabled = env.RAT_CONVERSATION_ENABLED === 'true';
    let memory: RatMemory | null = null;
    if (memoryEnabled && addressed && authorId !== null) {
      try { memory = await loadRatMemory(env.DB, message.chat.id, authorId, deps.now()); }
      catch { /* Missing migration or D1 outage never compromises deterministic Rat replies. */ }
    }

    if (message.text.trim().toLowerCase() === '/forget') {
      let forgotten = !memoryEnabled;
      if (memoryEnabled && authorId !== null) {
        try { await forgetRatMemory(env.DB, message.chat.id, authorId); forgotten = true; }
        catch { /* Never claim deletion when D1 failed. */ }
      }
      const answer = forgotten
        ? '🐀 conversation context cleared. i keep no raw user-message history.'
        : '🐀 could not clear memory. try again when the database is back.';
      const telegramMessageId = await sendMessage(token, message.chat.id, answer, deps.externalFetch);
      await ledger.completeOperationalReply({
        updateId: update.update_id, chatId: message.chat.id, intent: 'FORGET',
        replyDigest: createHash('sha256').update(answer).digest('hex'), telegramMessageId
      }, deps.now());
      return json(200, { ok: true });
    }

    const effectiveText = addressed ? resolveRatFollowup(message.text, memory) : message.text;
    const understanding = understandRatMessage(effectiveText, { allowUnaddressed });
    const reply = await renderRatReplyDetailed(
      effectiveText,
      config,
      localFetch,
      { allowUnaddressed }
    );

    // AI only covers harmless, otherwise-unhandled small talk. Factual paths stay deterministic.
    if (
      reply?.intent === 'CLARIFY' && env.RAT_AI_ENABLED === 'true' &&
      env.AI && addressed && authorId !== null &&
      isRatBanterEligible(message.text, understanding)
    ) {
      let banter: string | null = null;
      try {
        if (await reserveRatAiCall(env.DB, message.chat.id, authorId, deps.now())) {
          banter = await generateRatBanter(env.AI, message.text, memory?.lastBotReply ?? '');
        }
      } catch {
        // Quota, unavailable AI or missing D1 migration: use the existing CLARIFY answer.
      }
      if (banter) {
        const telegramMessageId = await sendMessage(token, message.chat.id, banter, deps.externalFetch);
        await ledger.completeOperationalReply({
          updateId: update.update_id, chatId: message.chat.id, intent: 'SMALLTALK',
          replyDigest: createHash('sha256').update(banter).digest('hex'), telegramMessageId
        }, deps.now());
        if (memoryEnabled) {
          try { await saveRatMemory(env.DB, message.chat.id, authorId, deps.now(), banter, null, memory); }
          catch { /* Best-effort short-lived context, never part of evidence authority. */ }
        }
        return json(200, { ok: true, mode: 'SMALLTALK' });
      }
    }

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

    if (memoryEnabled && addressed && authorId !== null) {
      try {
        await saveRatMemory(
          env.DB, message.chat.id, authorId, deps.now(), reply.text,
          entityFromUnderstanding(understanding), memory
        );
      } catch { /* Memory failure cannot retroactively fail a successfully sent reply. */ }
    }

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

type RatWatchCommand =
  | { action: 'WATCH'; creator: string | null }
  | { action: 'UNWATCH'; creator: string | null }
  | { action: 'LIST'; creator: null };

function parseRatWatchCommand(text: string): RatWatchCommand | null {
  const match = text.trim().match(/^\/(watch|unwatch|watches)(?:@[A-Za-z0-9_]+)?(?:\s+(.+))?$/i);
  if (!match) return null;
  const action = match[1]!.toLowerCase();
  const raw = match[2]?.trim() ?? '';
  if (action === 'watches') return { action: 'LIST', creator: null };
  const creator = /^0x[0-9a-fA-F]{40}$/.test(raw) ? raw.toLowerCase() : null;
  return action === 'watch'
    ? { action: 'WATCH', creator }
    : { action: 'UNWATCH', creator };
}

async function handleRatWatchCommand(
  command: RatWatchCommand,
  chatId: number,
  env: BinratWorkerEnv,
  nowMs: number
): Promise<{ intent: string; text: string }> {
  const watches = new D1RatWatchStore(env.DB);

  if (command.action === 'LIST') {
    const rows = await watches.list(chatId);
    return {
      intent: 'WATCH_LIST',
      text: rows.length === 0
        ? '🐀 no watched creator addresses yet.\n\n/watch 0x... — watch an indexed ArcPad-reported creator address'
        : [
            '🐀 watch list.',
            '',
            ...rows.map((row) => row.creator),
            '',
            'exact reported addresses only. address != human identity.'
          ].join('\n')
    };
  }

  if (!command.creator) {
    return {
      intent: command.action,
      text: command.action === 'WATCH'
        ? '🐀 usage: /watch 0x...'
        : '🐀 usage: /unwatch 0x...'
    };
  }

  if (command.action === 'UNWATCH') {
    const removed = await watches.unsubscribe(chatId, command.creator);
    return {
      intent: 'UNWATCH',
      text: removed
        ? `🐀 stopped watching ${command.creator}.`
        : `🐀 ${command.creator} was not on this chat's watch list.`
    };
  }

  const ready = await readyContext(env);
  if (!ready) {
    return {
      intent: 'WATCH',
      text: '🐀 live index is not authoritative right now. watch was not added.'
    };
  }

  const knownCreator = ready.feed.bags.some(
    (bag) => bag.reportedCreatorAddress.toLowerCase() === command.creator
  );
  if (!knownCreator) {
    return {
      intent: 'WATCH',
      text: [
        '🐀 that address is not currently indexed as an ArcPad-reported creator.',
        'watch was not added. unknown is not clean.'
      ].join('\n')
    };
  }

  const result = await watches.subscribe(
    chatId,
    command.creator,
    BigInt(ready.feed.asOfBlock),
    nowMs
  );
  if (result === 'LIMIT_REACHED') {
    return {
      intent: 'WATCH',
      text: '🐀 watch list full. max 25 exact creator addresses per chat.'
    };
  }
  if (result === 'DUPLICATE') {
    return {
      intent: 'WATCH',
      text: `🐀 already watching ${command.creator}.`
    };
  }
  return {
    intent: 'WATCH',
    text: [
      '🐀 watch armed.',
      command.creator,
      '',
      `starting after block ${ready.feed.asOfBlock}.`,
      'i will alert on a future launch from the same ArcPad-reported address.',
      'same address != same human identity.'
    ].join('\n')
  };
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
  const indexReady = Boolean(
    checkpoint &&
    runtime?.sourceVerified &&
    runtime.liveCaughtUp &&
    !runtime.lastSyncError &&
    fresh
  );
  const observationReady = Boolean(runtime?.observationReady && !runtime.lastObservationError && fresh);

  return json(200, {
    ok: indexReady,
    chainId: ARC_CHAIN_ID,
    indexReady,
    checkpointBlock: checkpoint?.blockNumber.toString() ?? null,
    headBlock: runtime?.headBlock?.toString() ?? null,
    targetBlock: runtime?.targetBlock?.toString() ?? null,
    liveCaughtUp: runtime?.liveCaughtUp ?? false,
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

async function dumpsterLedger(env: BinratWorkerEnv): Promise<Response> {
  const manifest = readManifest(env);
  if (!manifest) return json(503, { error: 'CAPABILITY_MANIFEST_NOT_CONFIGURED' });
  const funding = resolveProductionFundingConfig(env.BINRAT_FUNDING_CONFIG_JSON, ARC_CHAIN_ID);
  return json(200, await projectDumpsterLedger(manifest, funding, [], 'PRODUCTION'));
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
    !runtime.liveCaughtUp ||
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
    !afterRuntime.liveCaughtUp ||
    afterRuntime.lastSyncError ||
    !runtimeFresh(afterRuntime, maxStatusAgeMs(env))
  ) return null;

  return { store, runtime: afterRuntime, feed };
}

function maxStatusAgeMs(env: BinratWorkerEnv): number {
  return integerSetting(env.BINRAT_MAX_STATUS_AGE_MS, 180_000, 1_000, 3_600_000);
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

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error('HOLDER_BODY_TOO_LARGE');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new Error('HOLDER_BODY_TOO_LARGE');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('HOLDER_JSON_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('HOLDER_BODY_INVALID');
  }
  return parsed as Record<string, unknown>;
}

function holderErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return /^HOLDER_[A-Z0-9_]+$/.test(message) ? message : 'HOLDER_GATE_FAILED';
}

function holderHttpStatus(error: unknown): number {
  const code = holderErrorCode(error);
  if (code === 'HOLDER_BODY_TOO_LARGE') return 413;
  if (
    code === 'HOLDER_SIGNATURE_WALLET_MISMATCH' ||
    code === 'HOLDER_CHALLENGE_EXPIRED' ||
    code === 'HOLDER_CHALLENGE_USED_OR_UNKNOWN' ||
    code === 'HOLDER_CHALLENGE_USED_OR_EXPIRED'
  ) return 401;
  if (code === 'HOLDER_GATE_FAILED' || code === 'HOLDER_SESSION_PERSISTENCE_FAILED') return 503;
  return 400;
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
