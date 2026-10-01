import { createHash } from 'node:crypto';
import { executeAutonomousCommand, handleAutonomousCommand, parseAutonomousCommand, renderLegacyAutonomousOutcome } from '../autonomous/telegram.js';
import type { AutonomousOutcome } from '../autonomous/outcome.js';
import { discoverRats, latestPonsLaunches, latestPonsLaunchSnapshot, loadRatsSnapshot } from '../autonomous/rats.js';
import { why } from '../autonomous/evidence.js';
import { listWatches } from '../autonomous/watches.js';
import { robinhoodWatchSource, type WatchSource } from '../autonomous/source.js';
import { ARC_CHAIN_ID } from '../arc/chain.js';
import { ROBINHOOD_CHAIN_ID } from '../pons/chain.js';
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
  parseRatFeedback, validateRatFeedbackBody, saveRatFeedback,
  deleteRatFeedback, pruneRatFeedback, listRecentRatFeedback
} from './ratFeedback.js';
import { handleRatCandidateSmoke } from './ratCandidateSmoke.js';
import { handlePonsBootstrapDiagnostic } from './ponsBootstrapDiagnostic.js';
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
  enqueuePonsSyncCycle,
  handleSyncQueueBatch,
  type CloudflareSyncEnv,
  type SyncQueueBatchLike,
  type SyncQueueProducerLike
} from './syncQueue.js';
import { autonomousResultMedia, editRatCard, sendRatCard } from '../telegram/ratMedia.js';
import { parseCallback, type TelegramUiAction } from '../telegram/ui/callback.js';
import { digOperationalErrorCard, digPromptOperationalErrorCard, diggingCard, digWaitingCard, malformedDigCard, renderRatCard } from '../telegram/ui/cards.js';
import { answerCallback, deleteMessage as deleteUiMessage, editCard as editUiCard, ratCardDigest, sendCard, sendDigForceReply, TelegramUiError } from '../telegram/ui/client.js';
import { consumeExactDigPrompt, loadActiveDigPrompt, replaceDigPrompt } from '../telegram/ui/prompts.js';
import { parseTarget } from '../autonomous/model.js';
import { telegramProductConfig } from '../telegram/config.js';
import { verifyTelegramInitData } from '../telegram/miniAppAuth.js';

export interface BinratWorkerEnv extends CloudflareSyncEnv, HolderPolicyEnv {
  DB: D1DatabaseLike;
  SYNC_QUEUE?: SyncQueueProducerLike;
  CAPABILITY_MANIFEST_JSON?: string;
  BINRAT_FUNDING_CONFIG_JSON?: string;
  BINRAT_HOLDER_WALLET_AUTH_ENABLED?: string;
  BINRAT_MAX_STATUS_AGE_MS?: string;
  BINRAT_PUBLIC_SITE_URL?: string;
  BINRAT_RELEASE_SHA?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_WEBHOOK_SECRET_NEXT?: string;
  TELEGRAM_REPLIES_ENABLED?: string;
  TELEGRAM_MAX_MESSAGES_PER_MINUTE?: string;
  /** Both flags must be explicitly 'true'; inference is default-off. */
  RAT_CONVERSATION_ENABLED?: string;
  RAT_FEEDBACK_ENABLED?: string;
  RAT_FEEDBACK_ADMIN_USER_ID?: string;
  RAT_AI_ENABLED?: string;
  // Trial lease: when present, AI automatically stops at this Unix millisecond timestamp.
  RAT_AI_TRIAL_EXPIRES_AT_MS?: string;
  AI?: RatAiBinding;
  RAT_CANDIDATE_SMOKE_ENABLED?: string;
  RAT_CANDIDATE_SMOKE_SECRET?: string;
  /** Explicit rollout gate for the approved same-origin visual card layer. */
  BINRAT_TELEGRAM_MEDIA_ENABLED?: string;
  /** Default-off native inline-card interaction layer. */
  BINRAT_TELEGRAM_UI_V2_ENABLED?: string;
  /** Explicit future public-mode switch. Controlled activation keeps this false. */
  BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED?: string;
  /** Controlled production activation allowlist. Store as a secret binding. */
  BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID?: string;
  /** Existing isolated-candidate bot allowlist. This gates the entire candidate bot. */
  RAT_CANDIDATE_ALLOWED_USER_ID?: string;
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
  callback_query?: TelegramCallbackQuery;
}
interface TelegramCallbackQuery { id: string; from: TelegramUser; data?: string; message?: TelegramMessage; }

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
  watchSource?: WatchSource;
}

const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_DEPS: WorkerDeps = { externalFetch: fetch, now: Date.now };
const botIdentityCache = new Map<string, Promise<TelegramUser>>();

function ratAiActive(env: BinratWorkerEnv, nowMs: number): boolean {
  if (env.RAT_AI_ENABLED !== 'true' || !env.AI) return false;
  if (env.RAT_AI_TRIAL_EXPIRES_AT_MS !== undefined) {
    const expiresAt = Number(env.RAT_AI_TRIAL_EXPIRES_AT_MS);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowMs) return false;
  }
  return true;
}


export default {
  fetch(request: Request, env: BinratWorkerEnv): Promise<Response> {
    return handleWorkerRequest(request, env);
  },
  async scheduled(_controller: unknown, env: BinratWorkerEnv): Promise<void> {
    const now = Date.now();
    // Opportunistic daily physical deletion; conversation TTL is enforced on every read.
    const utc = new Date(now);
    if (utc.getUTCHours() === 0 && utc.getUTCMinutes() < 5) {
      try { await pruneRatConversation(env.DB, now); }
      catch { /* Maintenance must never block the indexer cron. */ }
      try { await pruneRatFeedback(env.DB, now); }
      catch { /* Feedback maintenance is best-effort. */ }
    }
    // Independent queue messages: legacy Arc may be stale without blocking the live Pons plane.
    await Promise.all([enqueueSyncCycle(env), enqueuePonsSyncCycle(env)]);
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

  if (request.method === 'POST' && pathname === '/__candidate/rat-smoke') {
    return handleRatCandidateSmoke(request, env, deps.now());
  }

  if (request.method === 'POST' && pathname === '/__candidate/pons-bootstrap') {
    return handlePonsBootstrapDiagnostic(request, env, { externalFetch: deps.externalFetch });
  }

  if (request.method === 'POST' && pathname === '/telegram/webhook') {
    return telegramWebhook(request, env, origin, deps);
  }

  if (request.method === 'POST' && pathname === '/api/miniapp/bootstrap') {
    return miniAppBootstrap(request, env, deps.now());
  }

  if (request.method === 'POST' && pathname === '/api/miniapp/case') {
    return miniAppCase(request, env, deps.now());
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
      releaseSha: env.BINRAT_RELEASE_SHA ?? null,
      repliesEnabled,
      conversationEnabled: env.RAT_CONVERSATION_ENABLED === 'true',
      aiEnabled: ratAiActive(env, Date.now()),
      aiTrialExpiresAtMs: env.RAT_AI_TRIAL_EXPIRES_AT_MS ?? null,
      feedbackEnabled: env.RAT_FEEDBACK_ENABLED === 'true',
      autonomousRatEnabled: env.BINRAT_AUTONOMOUS_RAT_ENABLED === 'true',
      autonomousRatPublicEnabled: env.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED === 'true',
      telegramUiV2Enabled: env.BINRAT_TELEGRAM_UI_V2_ENABLED === 'true',
      telegramMediaEnabled: env.BINRAT_TELEGRAM_MEDIA_ENABLED === 'true'
    });
  }

  if (request.method === 'GET' && pathname.startsWith('/api/')) {
    return handleBinratApiRequest(request, env, deps);
  }

  return json(404, { error: 'NOT_FOUND' });
}

async function miniAppBody(request: Request): Promise<{ initData: string; caseId?: string }> {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(length) && length > 16 * 1024) throw new Error('MINI_APP_BODY_INVALID');
  let parsed: unknown;
  try { parsed = await request.json(); } catch { throw new Error('MINI_APP_BODY_INVALID'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('MINI_APP_BODY_INVALID');
  const body = parsed as Record<string, unknown>;
  if (typeof body.initData !== 'string' || body.initData.length > 8192) throw new Error('MINI_APP_BODY_INVALID');
  if (body.caseId !== undefined && typeof body.caseId !== 'string') throw new Error('MINI_APP_BODY_INVALID');
  return { initData: body.initData, ...(typeof body.caseId === 'string' ? { caseId: body.caseId } : {}) };
}

function miniAppPrincipal(initData: string, env: BinratWorkerEnv, now: number) {
  const token = required(env.TELEGRAM_BOT_TOKEN, 'TELEGRAM_BOT_TOKEN');
  const principal = verifyTelegramInitData(initData, token, now, telegramProductConfig.miniApp.authMaxAgeSeconds);
  if (env.BINRAT_AUTONOMOUS_RAT_ENABLED !== 'true' ||
      env.BINRAT_TELEGRAM_UI_V2_ENABLED !== 'true' ||
      env.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED === 'true') throw new Error('MINI_APP_PRIVATE_GATE_CLOSED');
  const allowed = env.BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID?.trim() ?? '';
  if (!/^[1-9]\d*$/.test(allowed) || Number(allowed) !== principal.userId) {
    throw new Error('MINI_APP_PRIVATE_GATE_CLOSED');
  }
  const candidate = env.RAT_CANDIDATE_ALLOWED_USER_ID?.trim();
  if (candidate && (!/^[1-9]\d*$/.test(candidate) || Number(candidate) !== principal.userId)) {
    throw new Error('MINI_APP_PRIVATE_GATE_CLOSED');
  }
  return principal;
}

function miniAppError(error: unknown): Response {
  const code = error instanceof Error ? error.message : '';
  if (code === 'MINI_APP_BODY_INVALID') return json(400, { error: code });
  if (code === 'MINI_APP_AUTH_INVALID') return json(401, { error: code });
  if (code === 'MINI_APP_PRIVATE_GATE_CLOSED') return json(403, { error: code });
  return json(503, { error: 'MINI_APP_UNAVAILABLE' });
}

async function miniAppBootstrap(request: Request, env: BinratWorkerEnv, now: number): Promise<Response> {
  try {
    const body = await miniAppBody(request);
    const principal = miniAppPrincipal(body.initData, env, now);
    const [rats, latestLaunches, watches, sourceHealth] = await Promise.all([
      discoverRats(env.DB, now),
      latestPonsLaunches(env.DB, now, 20),
      listWatches(env.DB, { userId: principal.userId, chatId: principal.chatId }),
      chainHealth(env, ROBINHOOD_CHAIN_ID)
    ]);
    return json(200, {
      user: { firstName: principal.user.first_name ?? null, username: principal.user.username ?? null },
      sourceHealth,
      rats,
      latestLaunches,
      watches: watches.map(watch => ({
        chainId: watch.chain_id, entityType: watch.entity_type, entityId: watch.entity_id,
        startBlock: watch.start_block, createdAtMs: watch.created_at_ms, policy: watch.policy
      })),
      features: telegramProductConfig.features,
      evidenceSemantics: {
        coverage: 'PARTIAL',
        source: 'PONS_V2_INDEXED_LAUNCHES',
        unknowns: ['human identity', 'intent', 'safety', 'future outcome']
      }
    });
  } catch (error) { return miniAppError(error); }
}

async function miniAppCase(request: Request, env: BinratWorkerEnv, now: number): Promise<Response> {
  try {
    const body = await miniAppBody(request);
    miniAppPrincipal(body.initData, env, now);
    if (!body.caseId || !/^[0-9a-f]{64}$/.test(body.caseId)) throw new Error('MINI_APP_BODY_INVALID');
    return json(200, { receipt: await why(env.DB, body.caseId, now) });
  } catch (error) { return miniAppError(error); }
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
    if (pathname === '/api/launches/latest') {
      const snapshot = await latestPonsLaunchSnapshot(env.DB,deps.now(),20);
      return json(200,{
        schemaVersion:'binrat.latest-launches/0.1',
        chainId:ROBINHOOD_CHAIN_ID,
        sourceCheckpoint:snapshot.sourceCheckpoint,
        historyCoverage:'PARTIAL',
        launches:snapshot.launches
      });
    }

    const ready = await readyContext(env);
    if (!ready) return json(503, { ready: false, reason: 'INDEX_NOT_READY' });
    const { store, feed } = ready;

    if (pathname === '/api/feed') return json(200, feed);

    if (feed.chainId === ROBINHOOD_CHAIN_ID && pathname.startsWith('/api/rat-radar/')) {
      return json(410, {
        error: 'LEGACY_ARC_RADAR_RETIRED',
        chainId: ROBINHOOD_CHAIN_ID,
        replacement: 'PONS_DEPLOYER_RECURRENCE'
      });
    }

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
  const webhookSecretNext = env.TELEGRAM_WEBHOOK_SECRET_NEXT?.trim() ?? '';
  const suppliedWebhookSecret = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (suppliedWebhookSecret !== webhookSecret &&
      (!webhookSecretNext || suppliedWebhookSecret !== webhookSecretNext)) {
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

  const receivedCallback = update.callback_query;
  const callbackStartedAt = receivedCallback ? deps.now() : null;
  const receivedAction = receivedCallback && typeof receivedCallback.data === 'string'
    ? parseCallback(receivedCallback.data)
    : null;
  if (receivedCallback && typeof receivedCallback.id === 'string' && receivedCallback.id) {
    if (receivedAction) {
      console.error(JSON.stringify({event:'TELEGRAM_UI_CALLBACK',phase:'RECEIVED',updateId:update.update_id,action:receivedAction.action}));
    }
    try {
      // Telegram's progress state is transport-level UX. Attempt the ACK before
      // any D1 claim/rate/evidence work so storage latency cannot strand it.
      await answerCallback(token,receivedCallback.id,deps.externalFetch);
      if (receivedAction) {
        console.error(JSON.stringify({event:'TELEGRAM_UI_CALLBACK',phase:'ACKED',updateId:update.update_id,action:receivedAction.action,
          elapsedMs:Math.max(0,deps.now()-(callbackStartedAt ?? deps.now()))}));
      }
    } catch {
      if (receivedAction) {
        console.error(JSON.stringify({event:'TELEGRAM_UI_CALLBACK',phase:'ACK_FAILED',updateId:update.update_id,action:receivedAction.action}));
      }
    }
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

    const callback = update.callback_query;
    if (callback) {
      if (env.BINRAT_TELEGRAM_UI_V2_ENABLED !== 'true') {
        await ledger.completeIgnored(update.update_id,'IGNORED',deps.now());
        return json(200,{ok:true,ignored:true,reason:'TELEGRAM_UI_V2_DISABLED'});
      }
      const message = callback.message;
      if (!message || !candidateRatAllowedPrincipal(callback.from,message.chat,env) ||
          !autonomousRatAllowedPrincipal(callback.from,message.chat,env)) {
        await ledger.completeIgnored(update.update_id,'IGNORED',deps.now());
        return json(200,{ok:true,ignored:true,reason:'PRIVATE_DM_REQUIRED'});
      }
      const action = receivedAction;
      if (!action || !callback.id) {
        await ledger.completeIgnored(update.update_id,'IGNORED',deps.now());
        return json(200,{ok:true,ignored:true,reason:'INVALID_CALLBACK'});
      }
      const rateLimit = integerSetting(env.TELEGRAM_MAX_MESSAGES_PER_MINUTE, 12, 1, 10_000);
      if (!(await ledger.allowChat(message.chat.id,rateLimit,60_000,deps.now()))) {
        await ledger.completeIgnored(update.update_id,'RATE_LIMITED',deps.now());
        return json(200,{ok:true,rateLimited:true});
      }
      if (!Number.isSafeInteger(message.message_id) || message.message_id < 1) throw new Error('TELEGRAM_CALLBACK_MESSAGE_INVALID');
      const mediaEnabled = env.BINRAT_TELEGRAM_MEDIA_ENABLED === 'true';
      if (action.action === 'DIG_PROMPT') {
        const waiting = digWaitingCard();
        const prior = await loadActiveDigPrompt(env.DB,message.chat.id,callback.from.id,deps.now());
        // The prompt receipt survived but its update-ledger completion did not. Replaying
        // this callback must complete the ledger, never ask Telegram to create another prompt.
        if (prior?.sourceUpdateId === update.update_id) {
          await ledger.completeOperationalReply({updateId:update.update_id,chatId:message.chat.id,intent:'UI_DIG_PROMPT',
            replyDigest:ratCardDigest(waiting),telegramMessageId:message.message_id,rendererVersion:waiting.rendererVersion},deps.now());
          return json(200,{ok:true,uiV2:true,prompt:true,replayed:true});
        }
        if (prior && prior.sourceUpdateId > update.update_id) {
          // This is an older Telegram retry. Do not disturb the newer card or prompt.
          await ledger.completeIgnored(update.update_id,'IGNORED',deps.now());
          return json(200,{ok:true,uiV2:true,prompt:false,stale:true});
        }
        await editUiCard(token,message.chat.id,message.message_id,origin,waiting,mediaEnabled,deps.externalFetch);
        let promptMessageId: number;
        try {
          promptMessageId = await sendDigForceReply(token,message.chat.id,deps.externalFetch);
        } catch (error) {
          // A timeout/5xx may have created a prompt. Never send a second one for this update.
          const operational = digPromptOperationalErrorCard();
          await editUiCard(token,message.chat.id,message.message_id,origin,operational,mediaEnabled,deps.externalFetch).catch(()=>{});
          await ledger.completeIgnored(update.update_id,'IGNORED',deps.now());
          return json(200,{ok:true,uiV2:true,prompt:false,reason:error instanceof TelegramUiError ? error.code : 'PROMPT_SEND_FAILED'});
        }
        try {
          const promptWrite=await replaceDigPrompt(env.DB,{chatId:message.chat.id,userId:callback.from.id,sourceUpdateId:update.update_id,cardMessageId:message.message_id,promptMessageId,createdAtMs:deps.now()});
          if (promptWrite === 'STALE') {
            await ledger.completeIgnored(update.update_id,'IGNORED',deps.now());
            return json(200,{ok:true,uiV2:true,prompt:false,stale:true});
          }
        } catch {
          // Send succeeded but its receipt did not: terminally close this update. The visible
          // prompt is deliberately inert rather than risking a replayed investigation.
          const operational = digPromptOperationalErrorCard();
          await editUiCard(token,message.chat.id,message.message_id,origin,operational,mediaEnabled,deps.externalFetch).catch(()=>{});
          await ledger.completeIgnored(update.update_id,'IGNORED',deps.now());
          return json(200,{ok:true,uiV2:true,prompt:false,reason:'PROMPT_RECEIPT_FAILED'});
        }
        await ledger.completeOperationalReply({updateId:update.update_id,chatId:message.chat.id,intent:'UI_DIG_PROMPT',
          replyDigest:ratCardDigest(waiting),telegramMessageId:message.message_id,rendererVersion:waiting.rendererVersion},deps.now());
        return json(200,{ok:true,uiV2:true,prompt:true});
      }
      const outcome = await executeUiCallback(env.DB,action,{userId:callback.from.id,chatId:message.chat.id},update.update_id,deps.now(),deps.watchSource ?? robinhoodWatchSource(env.ROBINHOOD_RPC_URL?.trim() || 'https://rpc.mainnet.chain.robinhood.com'));
      console.error(JSON.stringify({event:'TELEGRAM_UI_CALLBACK',phase:'OUTCOME',updateId:update.update_id,action:action.action,
        outcome:outcome.kind,errorCode:outcome.kind === 'ERROR' ? outcome.code : undefined,
        elapsedMs:Math.max(0,deps.now()-(callbackStartedAt ?? deps.now()))}));
      const card = renderRatCard(outcome);
      await editUiCard(token,message.chat.id,message.message_id,origin,card,mediaEnabled,deps.externalFetch);
      console.error(JSON.stringify({event:'TELEGRAM_UI_CALLBACK',phase:'EDITED',updateId:update.update_id,action:action.action,
        view:card.view,elapsedMs:Math.max(0,deps.now()-(callbackStartedAt ?? deps.now()))}));
      // The compact card remains the surface; FULL is the explicit canonical expansion.
      if (action.action === 'FULL') await sendMessage(token,message.chat.id,renderLegacyAutonomousOutcome(outcome),deps.externalFetch);
      await ledger.completeOperationalReply({updateId:update.update_id,chatId:message.chat.id,intent:`UI_${action.action}`,
        replyDigest:ratCardDigest(card),telegramMessageId:message.message_id,rendererVersion:card.rendererVersion},deps.now());
      return json(200,{ok:true,uiV2:true});
    }

    const message = update.message;
    if (!message?.text) {
      await ledger.completeIgnored(update.update_id, 'IGNORED', deps.now());
      return json(200, { ok: true, ignored: true });
    }

    if (!candidateRatAllowedPrincipal(message.from,message.chat,env)) {
      await ledger.completeIgnored(update.update_id, 'IGNORED', deps.now());
      return json(200, { ok: true, ignored: true, reason: 'CANDIDATE_PRIVATE_ONLY' });
    }

    const rateLimit = integerSetting(env.TELEGRAM_MAX_MESSAGES_PER_MINUTE, 12, 1, 10_000);
    if (!(await ledger.allowChat(message.chat.id, rateLimit, 60_000, deps.now()))) {
      await ledger.completeIgnored(update.update_id, 'RATE_LIMITED', deps.now());
      return json(200, { ok: true, rateLimited: true });
    }

    // Feedback is explicit opt-in, DM-only and never sent to the AI model.
    const feedback = parseRatFeedback(message.text);
    if (feedback && env.RAT_FEEDBACK_ENABLED === 'true') {
      let feedbackReply: string;
      let intent = 'FEEDBACK_HELP';
      if (message.chat.type !== 'private' || !Number.isSafeInteger(message.from?.id)) {
        feedbackReply = '🐀 DM me with /feedback <message> so your feedback is not copied into a public group.';
      } else if (feedback.action === 'HELP') {
        feedbackReply =
          '🐀 found the suggestion box.\n\n' +
          'Send /feedback bug: <what broke> or /feedback idea: <what you want>.\n' +
          'Only explicit feedback is stored, for up to 90 days. ' +
          'Your Telegram user ID is retained so you can request deletion with /feedback delete. ' +
          'Please do not send passwords, private keys, seed phrases or other sensitive information. ' +
          '3 submissions per day per user.';
      } else if (feedback.action === 'DELETE') {
        intent = 'FEEDBACK_DELETE';
        const count = await deleteRatFeedback(env.DB, message.from!.id);
        feedbackReply = '🐀 deleted ' + count + ' stored feedback item(s) tied to your Telegram user ID.';
      } else if (feedback.action === 'INBOX') {
        intent = 'FEEDBACK_INBOX';
        const adminId = Number(env.RAT_FEEDBACK_ADMIN_USER_ID);
        if (!Number.isSafeInteger(adminId) || adminId <= 0 || message.from!.id !== adminId) {
          feedbackReply = '🐀 this inbox is private to the BINRAT operator.';
        } else {
          const latest = await listRecentRatFeedback(env.DB, 5);
          feedbackReply = latest.length === 0
            ? '🐀 no stored feedback yet.'
            : '🐀 latest feedback (up to 5; full items in D1):\n\n' +
              latest.map(item => '#' + item.updateId + ' [' + item.kind + '] ' +
                new Date(item.createdAtMs).toISOString().slice(0, 10) + '\n' +
                item.excerpt).join('\n\n');
        }
      } else {
        intent = 'FEEDBACK_SUBMIT';
        const valid = validateRatFeedbackBody(feedback.body);
        if (valid === 'TOO_SHORT') {
          feedbackReply = '🐀 write at least 5 characters. Usage: /feedback bug: what happened';
        } else if (valid === 'TOO_LONG') {
          feedbackReply = '🐀 max 1,200 characters per feedback item. Send a shorter version.';
        } else if (valid === 'SENSITIVE') {
          feedbackReply = '🐀 please remove private keys, passwords and seed phrases before sending feedback.';
        } else {
          const result = await saveRatFeedback(
            env.DB, update.update_id, message.chat.id, message.from!.id,
            feedback.kind, feedback.body, deps.now()
          );
          if (result.state === 'USER_LIMIT') {
            feedbackReply = '🐀 daily feedback limit reached (3). Come back after 00:00 UTC.';
          } else if (result.state === 'GLOBAL_LIMIT') {
            feedbackReply = '🐀 suggestion box is full for today. Try again after 00:00 UTC.';
          } else {
            feedbackReply = '🐀 receipt #' + result.updateId +
              ' — feedback saved. Thank you. Your entry is kept for up to 90 days. ' +
              'Use /feedback delete to remove all your stored submissions.';
          }
        }
      }
      const telegramMessageId = await sendMessage(
        token, message.chat.id, feedbackReply, deps.externalFetch
      );
      await ledger.completeOperationalReply({
        updateId: update.update_id, chatId: message.chat.id, intent,
        replyDigest: createHash('sha256').update(feedbackReply).digest('hex'),
        telegramMessageId
      }, deps.now());
      return json(200, { ok: true, feedback: true });
    }

    const exactPromptReply = env.BINRAT_TELEGRAM_UI_V2_ENABLED === 'true' &&
      autonomousRatAllowed(message,env) &&
      message.chat.type === 'private' && !message.from?.is_bot &&
      Number.isSafeInteger(message.reply_to_message?.message_id) &&
      !/^\//.test(message.text.trim());
    if (exactPromptReply) {
      const prompt = await loadActiveDigPrompt(env.DB,message.chat.id,message.from!.id,deps.now());
      if (prompt && prompt.promptMessageId === message.reply_to_message!.message_id) {
        try {
          // The same parser as legacy /dig: malformed input spends neither a DIG slot nor RPC.
          parseTarget(message.text.trim());
        } catch {
          const malformed=malformedDigCard();
          await editUiCard(token,message.chat.id,prompt.cardMessageId,origin,malformed,env.BINRAT_TELEGRAM_MEDIA_ENABLED === 'true',deps.externalFetch);
          await ledger.completeOperationalReply({updateId:update.update_id,chatId:message.chat.id,intent:'UI_DIG_MALFORMED',
            replyDigest:ratCardDigest(malformed),telegramMessageId:prompt.cardMessageId,rendererVersion:malformed.rendererVersion},deps.now());
          return json(200,{ok:true,uiV2:true,dig:false,malformed:true});
        }
        const consumed=await consumeExactDigPrompt(env.DB,message.chat.id,message.from!.id,prompt.promptMessageId,deps.now());
        if (consumed) {
          const digging=diggingCard();
          await editUiCard(token,message.chat.id,consumed.cardMessageId,origin,digging,env.BINRAT_TELEGRAM_MEDIA_ENABLED === 'true',deps.externalFetch);
          let outcome: AutonomousOutcome;
          try {
            outcome=await executeAutonomousCommand(env.DB,{name:'dig',argument:message.text.trim()},
              {userId:message.from!.id,chatId:message.chat.id},update.update_id,deps.now(),
              deps.watchSource ?? robinhoodWatchSource(env.ROBINHOOD_RPC_URL?.trim() || 'https://rpc.mainnet.chain.robinhood.com'));
          } catch {
            // The prompt is already consumed, so this update must terminate visibly.
            // Never leave the user on DIGGING or ask Telegram to replay a one-shot DIG.
            const operational=digOperationalErrorCard();
            await editUiCard(token,message.chat.id,consumed.cardMessageId,origin,operational,env.BINRAT_TELEGRAM_MEDIA_ENABLED === 'true',deps.externalFetch).catch(()=>{});
            await ledger.completeOperationalReply({updateId:update.update_id,chatId:message.chat.id,intent:'UI_DIG_FAILED',
              replyDigest:ratCardDigest(operational),telegramMessageId:consumed.cardMessageId,rendererVersion:operational.rendererVersion},deps.now()).catch(()=>{});
            console.error(JSON.stringify({event:'TELEGRAM_UI_DIG',phase:'FAILED',stage:'EXECUTE',updateId:update.update_id}));
            return json(200,{ok:true,uiV2:true,dig:false,reason:'DIG_EXECUTION_FAILED'});
          }
          const result=renderRatCard(outcome);
          // If this final edit or ledger receipt fails, the prompt remains consumed: replay cannot DIG again.
          await editUiCard(token,message.chat.id,consumed.cardMessageId,origin,result,env.BINRAT_TELEGRAM_MEDIA_ENABLED === 'true',deps.externalFetch);
          await deleteUiMessage(token,message.chat.id,consumed.promptMessageId,deps.externalFetch).catch(()=>{});
          await ledger.completeOperationalReply({updateId:update.update_id,chatId:message.chat.id,intent:'UI_DIG_RESULT',
            replyDigest:ratCardDigest(result),telegramMessageId:consumed.cardMessageId,rendererVersion:result.rendererVersion},deps.now());
          return json(200,{ok:true,uiV2:true,dig:true});
        }
      }
    }

    const autonomousAllowed = autonomousRatAllowed(message, env);
    const autonomous = autonomousAllowed ? parseAutonomousCommand(message.text) : null;
    if (autonomous) {
      if (message.chat.type !== 'private' || !Number.isSafeInteger(message.from?.id) ||
          message.from!.id <= 0 || message.from!.id !== message.chat.id || message.from?.is_bot) {
        await ledger.completeIgnored(update.update_id,'IGNORED',deps.now());
        return json(200,{ok:true,ignored:true,reason:'PRIVATE_DM_REQUIRED'});
      }
      let telegramMessageId: number | null = null;
      const mediaEnabled = env.BINRAT_TELEGRAM_MEDIA_ENABLED === 'true' && env.BINRAT_TELEGRAM_UI_V2_ENABLED !== 'true';
      if (mediaEnabled) {
        const initialCaption = autonomous.name === 'start'
          ? '🐀 BINRAT\n\nYou get the receipts.'
          : '🐀 DIGGING... checking Robinhood/Pons receipts.';
        try {
          telegramMessageId = await sendRatCard(token, message.chat.id, origin,
            autonomous.name === 'start' ? 'idle-neutral' : 'digging', initialCaption, deps.externalFetch);
        } catch {
          // Artwork delivery is additive personality, never an evidence availability dependency.
        }
      }
      const outcome = await executeAutonomousCommand(env.DB,autonomous,
        {userId:message.from!.id,chatId:message.chat.id},update.update_id,deps.now(),
        deps.watchSource ?? robinhoodWatchSource(env.ROBINHOOD_RPC_URL?.trim() || 'https://rpc.mainnet.chain.robinhood.com'));
      const reply = renderLegacyAutonomousOutcome(outcome);
      if (env.BINRAT_TELEGRAM_UI_V2_ENABLED === 'true') {
        const card = renderRatCard(outcome);
        telegramMessageId = await sendCard(token,message.chat.id,origin,card,env.BINRAT_TELEGRAM_MEDIA_ENABLED === 'true',deps.externalFetch);
        await ledger.completeOperationalReply({updateId:update.update_id,chatId:message.chat.id,
          intent:`UI_${autonomous.name.toUpperCase()}`,replyDigest:ratCardDigest(card),telegramMessageId,rendererVersion:card.rendererVersion},deps.now());
        return json(200,{ok:true,autonomous:true,uiV2:true});
      }
      if (mediaEnabled && telegramMessageId !== null) {
        try {
          await editRatCard(token, message.chat.id, telegramMessageId, origin,
            autonomousResultMedia(autonomous.name, reply), reply, deps.externalFetch);
        } catch {
          // Preserve the digging card and send authoritative text only if the edit itself is transient.
          await sendMessage(token, message.chat.id, reply, deps.externalFetch);
        }
      } else {
        telegramMessageId = await sendMessage(token,message.chat.id,reply,deps.externalFetch);
      }
      await ledger.completeOperationalReply({updateId:update.update_id,chatId:message.chat.id,
        intent:`AUTONOMOUS_${autonomous.name.toUpperCase()}`,
        replyDigest:createHash('sha256').update(reply).digest('hex'),telegramMessageId},deps.now());
      return json(200,{ok:true,autonomous:true});
    }

    const controlledAutonomous = env.BINRAT_AUTONOMOUS_RAT_ENABLED === 'true' &&
      env.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED !== 'true';
    const watchCommand = env.BINRAT_AUTONOMOUS_RAT_ENABLED !== 'true' ||
      (controlledAutonomous && !autonomousAllowed)
      ? parseRatWatchCommand(message.text) : null;
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
      let forgotten = false;
      if (authorId !== null) {
        try { await forgetRatMemory(env.DB, message.chat.id, authorId); forgotten = true; }
        catch { /* Never claim deletion when D1 failed, even with memory toggled OFF. */ }
      }
      const answer = forgotten
        ? '🐀 conversation context cleared. i keep no raw user-message history.'
        : '🐀 cannot confirm deletion. memory is not active if its flag is off; contact an operator if this persists.';
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
      reply?.intent === 'CLARIFY' && ratAiActive(env, deps.now()) &&
      // Paid-account trial: only private DMs may spend the shared AI quota.
      message.chat.type === 'private' && env.AI && addressed && authorId !== null &&
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

function autonomousRatAllowed(message: TelegramMessage, env: BinratWorkerEnv): boolean {
  return !!message.from && autonomousRatAllowedPrincipal(message.from,message.chat,env);
}

/** Whole-bot candidate isolation is independent of Autonomous Rat's tester allowlist. */
function candidateRatAllowedPrincipal(user: TelegramUser | undefined, chat: TelegramChat, env: BinratWorkerEnv): boolean {
  const raw=env.RAT_CANDIDATE_ALLOWED_USER_ID?.trim();
  if (!raw) return true;
  if (!user || !/^[1-9]\d*$/.test(raw) || chat.type !== 'private' || user.is_bot ||
      !Number.isSafeInteger(user.id)) return false;
  const allowed=Number(raw);
  return Number.isSafeInteger(allowed) && user.id===allowed;
}

/** Principal-shaped so a callback is authorized as its actor, never its card owner. */
function autonomousRatAllowedPrincipal(user: TelegramUser, chat: TelegramChat, env: BinratWorkerEnv): boolean {
  if (env.BINRAT_AUTONOMOUS_RAT_ENABLED !== 'true') return false;
  if (chat.type !== 'private' || user.is_bot || !Number.isSafeInteger(user.id) || user.id <= 0 || user.id !== chat.id) return false;
  if (env.BINRAT_AUTONOMOUS_RAT_PUBLIC_ENABLED === 'true') return true;
  const raw = env.BINRAT_AUTONOMOUS_RAT_ALLOWED_USER_ID?.trim();
  if (!raw || !/^[1-9]\d*$/.test(raw)) return false;
  const allowed = Number(raw);
  return Number.isSafeInteger(allowed) && allowed === user.id;
}

async function caseIdForShare(db: D1DatabaseLike, shareId: string): Promise<string> {
  const row = await db.prepare('SELECT case_id FROM rat_v1_cases WHERE share_id=?').bind(shareId)
    .first<{case_id:string}>();
  if (!row || !/^[0-9a-f]{64}$/.test(row.case_id)) throw new Error('RECEIPT_UNAVAILABLE');
  return row.case_id;
}

async function executeUiCallback(
  db: D1DatabaseLike, action: TelegramUiAction, principal: {userId:number;chatId:number}, updateId:number, now:number, source: WatchSource
): Promise<AutonomousOutcome> {
  if (action.action === 'HOME' || action.action === 'DIG_PROMPT') return {kind:'HOME'};
  const commandFor = (name: 'rats'|'watches'|'why'|'watch'|'unwatch'|'share', argument='') =>
    executeAutonomousCommand(db,{name,argument},principal,updateId,now,source);
  if (action.action === 'RATS') return commandFor('rats');
  if (action.action === 'RATS_PAGE') {
    try {
      const snapshot=await loadRatsSnapshot(db,action.discoveryId,now);
      if (action.index >= snapshot.candidates.length) return {kind:'ERROR',code:'That Rat snapshot is unavailable or its page is out of bounds.'};
      return {kind:'RATS',snapshot,candidateIndex:action.index};
    } catch { return {kind:'ERROR',code:'That Rat snapshot is unavailable or expired.'}; }
  }
  if (action.action === 'WATCHES') return commandFor('watches');
  const caseId = await caseIdForShare(db,action.shareId);
  if (action.action === 'CASE') {
    // CASE and WHY rehydrate the same canonical receipt; only their compact
    // presentation differs. FULL remains the unchanged canonical expansion.
    const outcome=await commandFor('why',caseId);
    return outcome.kind === 'CASE' ? { ...outcome,mode:'DIG' } : outcome;
  }
  if (action.action === 'WHY' || action.action === 'FULL') return commandFor('why',caseId);
  if (action.action === 'SHARE') return commandFor('share',caseId);
  const row = await db.prepare('SELECT receipt_json FROM rat_v1_cases WHERE case_id=?').bind(caseId).first<{receipt_json:string}>();
  if (!row) throw new Error('RECEIPT_UNAVAILABLE');
  const receipt = JSON.parse(row.receipt_json) as {chainId:number;subject:{entityType:string;entityId:string};evidenceRefs:Array<{creator:string}>};
  const creator = receipt.subject.entityType === 'CREATOR' ? receipt.subject.entityId : receipt.evidenceRefs[0]?.creator;
  if (!/^0x[0-9a-f]{40}$/.test(creator ?? '')) throw new Error('WATCH_CREATOR_ONLY');
  return commandFor(action.action === 'WATCH' ? 'watch' : 'unwatch',`${receipt.chainId}:CREATOR:${creator}`);
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
        ? '🐀 no watched creator addresses yet.\n\n/watch 0x... — watch an indexed Pons-reported deployer address'
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
        '🐀 that address is not currently indexed as a Pons-reported deployer.',
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
      'i will alert on a future launch from the same Pons-reported deployer address.',
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
  const ponsRuntime = await new D1RuntimeStateStore(env.DB, ROBINHOOD_CHAIN_ID).get();
  // Before the first Pons bootstrap, retain the historical health surface. Once a
  // Pons runtime row exists, even an unhealthy one remains authoritative (no Arc masking).
  const live = await chainHealth(env, ponsRuntime ? ROBINHOOD_CHAIN_ID : ARC_CHAIN_ID);
  const historicalArc = await chainHealth(env, ARC_CHAIN_ID);
  return json(200, { ...live, historicalArc: { ...historicalArc, role: 'HISTORICAL_LEGACY_EVIDENCE' } });
}

async function chainHealth(env: BinratWorkerEnv, chainId: number): Promise<Record<string, unknown>> {
  const store = new D1Store(env.DB, chainId);
  const runtimeStore = new D1RuntimeStateStore(env.DB, chainId);
  const [checkpoint, nextBlock, runtime] = await Promise.all([
    store.getCheckpoint(),
    store.getHistoricalBackfillNextBlock(),
    runtimeStore.get()
  ]);
  const launchCount = checkpoint ? await store.countLaunchesThroughBlock(checkpoint.blockNumber) : 0;

  const fresh = runtime ? runtimeFresh(runtime, maxStatusAgeMs(env)) : false;
  const indexReady = Boolean(
    checkpoint &&
    runtime?.sourceVerified &&
    runtime.liveCaughtUp &&
    !runtime.lastSyncError &&
    fresh &&
    runtime.targetBlock !== null &&
    checkpoint.blockNumber >= runtime.targetBlock
  );
  const observationReady = Boolean(runtime?.observationReady && !runtime.lastObservationError && fresh);

  return {
    ok: indexReady,
    chainId,
    indexReady,
    checkpointBlock: checkpoint?.blockNumber.toString() ?? null,
    headBlock: runtime?.headBlock?.toString() ?? null,
    targetBlock: runtime?.targetBlock?.toString() ?? null,
    liveCaughtUp: runtime?.liveCaughtUp ?? false,
    launchCount,
    historyBackfillComplete: runtime?.historyBackfillComplete ?? false,
    historyBackfillTargetBlock: runtime?.historyBackfillTargetBlock?.toString() ?? null,
    historyBackfillNextBlock: nextBlock?.toString() ?? null,
    lastHistoryError: runtime?.lastHistoryError ?? null,
    observationReady,
    lastObservationError: runtime?.lastObservationError ?? null,
    lastSyncError: runtime?.lastSyncError ?? null,
    runtimeFresh: fresh,
    runtimeUpdatedAtMs: runtime?.updatedAtMs ?? null
  };
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
  // The new live surface is Robinhood-first. Arc remains a historical read fallback
  // only while a Robinhood index has not yet been bootstrapped (not when it is stale).
  const ponsRuntime = await new D1RuntimeStateStore(env.DB, ROBINHOOD_CHAIN_ID).get();
  const chainId = ponsRuntime ? ROBINHOOD_CHAIN_ID : ARC_CHAIN_ID;
  const store = new D1Store(env.DB, chainId);
  const runtimeStore = new D1RuntimeStateStore(env.DB, chainId);
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
    chainId,
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
