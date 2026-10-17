#!/usr/bin/env node
/**
 * BINRAT R1: an offline-testable, read-only Cloudflare metadata inventory.
 * NO live CLI runner, token loading, workflow grant or credentialed execution.
 * A separately authorized, commit-bound runner would have to inject request.
 */
const ACCOUNT = '8927d39146b901d0f463b971a1d039e6';
const WORKER = 'binrat-edge-v0';
const QUEUE = 'binrat-sync-v0';
const ROOT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}`;
export const LIMITS = Object.freeze({ calls: 8, msPerGet: 5_000, msTotal: 45_000, bytesPerGet: 65_536, bytesTotal: 524_288 });
const STATIC = Object.freeze({
  settings: `/workers/scripts/${WORKER}/settings`,
  cron: `/workers/scripts/${WORKER}/schedules`,
  queues: '/queues?per_page=100',
  d1: '/d1/database?per_page=100',
  subscriptions: '/subscriptions'
});
const guid = x => typeof x === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(x);
const obj = x => x && typeof x === 'object' && !Array.isArray(x);
const bool = x => typeof x === 'boolean' ? x : null;
const count = x => Number.isSafeInteger(x) && x >= 0 ? x : null;
const iso = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(x) ? x.slice(0, 24) : null;
const pathAllowed = (path, ids) => Object.values(STATIC).includes(path) ||
  (ids.queue && [ `/queues/${ids.queue}`, `/queues/${ids.queue}/metrics` ].includes(path)) ||
  (ids.d1 && path === `/d1/database/${ids.d1}/time_travel/bookmark`);
class Stop extends Error { constructor(code) { super(code); this.code = code; } }

export async function inspectRecovery({ account, token, request, now = Date.now } = {}) {
  const out = {
    schema: 'binrat.recovery-inventory/0.1', status: 'BLOCKED', reason: 'PRECHECK',
    requests: 0, noWrites: true, workerBinding: null, cronCount: null,
    queue: { identityMatched: null, deliveryPaused: null, retentionSeconds: null,
      consumerCount: null, workerConsumerIdentified: null, backlogCount: null,
      backlogBytes: null, oldestMessageAtMs: null },
    d1: { bindingPresent: null, identityMatched: null, bookmarkAccessible: null,
      offPlatformBackupVerified: false },
    billing: { subscriptionCount: null, currentCostCeilingVerified: false },
    liveRoutingVerified: false, sourceCheckpointVerified: false,
    apiOutcomes: []
  };
  if (account !== ACCOUNT || typeof token !== 'string' || token.length < 12 || token.length > 2048 || /[\r\n]/.test(token) || typeof request !== 'function') {
    out.reason = 'SOURCE_OR_CREDENTIAL_UNAVAILABLE'; return out;
  }
  const ids = { queue: null, d1: null };
  let totalBytes = 0;
  const started = now();
  out.observedAtMs = Number.isSafeInteger(started) ? started : null;
  const get = async (kind, path) => {
    if (!pathAllowed(path, ids)) throw new Stop('ENDPOINT_NOT_ALLOWLISTED');
    if (out.requests >= LIMITS.calls) throw new Stop('REQUEST_CAP');
    if (now() - started >= LIMITS.msTotal) throw new Stop('TOTAL_WALL_TIME');
    out.requests++;
    const startedGet = now();
    const controller = new AbortController();
    const remain = Math.min(LIMITS.msPerGet, LIMITS.msTotal - (now() - started));
    if (remain <= 0) throw new Stop('TOTAL_WALL_TIME');
    let rejectDeadline;
    const deadline = new Promise((_, reject) => { rejectDeadline = reject; });
    const timer = setTimeout(() => { controller.abort(); rejectDeadline(new Stop('TIME_LIMIT')); }, remain);
    const bounded = promise => Promise.race([promise, deadline]);
    try {
      let response;
      try {
        response = await bounded(request(ROOT + path, {
          method: 'GET', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
        }));
      } catch (error) {
        if (error instanceof Stop) throw error;
        throw new Stop('TRANSPORT_FAILED');
      }
      if (!response || response.status !== 200) {
        throw new Stop(response?.status === 401 || response?.status === 403 ? 'AUTH_OR_ACCESS_DENIED' : 'HTTP_NOT_SUCCESS');
      }
      const len = Number(response.headers?.get?.('content-length') ?? 0);
      if (!Number.isFinite(len) || len > LIMITS.bytesPerGet || len < 0) throw new Stop('CONTENT_LENGTH_LIMIT');
      const reader = response.body?.getReader?.();
      if (!reader) throw new Stop('BODY_UNAVAILABLE');
      const chunks = []; let bytes = 0;
      try {
        while (true) {
          if (now() - startedGet >= LIMITS.msPerGet || now() - started >= LIMITS.msTotal) throw new Stop('TIME_LIMIT');
          let chunk;
          try { chunk = await bounded(reader.read()); } catch (error) {
            if (error instanceof Stop) throw error;
            throw new Stop('BODY_READ_FAILED');
          }
          if (chunk.done) break;
          if (!(chunk.value instanceof Uint8Array)) throw new Stop('INVALID_CHUNK');
          bytes += chunk.value.byteLength;
          if (bytes > LIMITS.bytesPerGet || totalBytes + bytes > LIMITS.bytesTotal) throw new Stop('BODY_LIMIT');
          chunks.push(Buffer.from(chunk.value));
        }
      } finally {
        try { void reader.cancel().catch(() => {}); } catch {};
        try { reader.releaseLock(); } catch {};
      }
      totalBytes += bytes;
      let json;
      try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Stop('INVALID_JSON'); }
      if (!obj(json) || json.success !== true) throw new Stop('PROVIDER_REJECTED');
      out.apiOutcomes.push({ kind, httpStatus: response.status, bytes });
      return { value: json.result, info: json.result_info };
    } finally { clearTimeout(timer); }
  };
  try {
    const settings = (await get('worker-settings', STATIC.settings)).value;
    const bindings = Array.isArray(settings?.bindings) ? settings.bindings : [];
    const producers = bindings.filter(b => b?.name === 'SYNC_QUEUE' && b?.type === 'queue' && b?.queue_name === QUEUE);
    out.workerBinding = producers.length === 1;
    const databases = bindings.filter(b => b?.name === 'DB' && b?.type === 'd1');
    out.d1.bindingPresent = databases.length === 1;
    const dbId = databases.length === 1 ? (databases[0].id ?? databases[0].database_id) : null;
    if (guid(dbId)) ids.d1 = dbId;
    const scheduled = (await get('cron', STATIC.cron)).value;
    out.cronCount = Array.isArray(scheduled?.schedules) ? count(scheduled.schedules.length) : null;
    const listing = await get('queue-list', STATIC.queues);
    if (!Array.isArray(listing.value)) throw new Stop('QUEUES_UNVERIFIED');
    const partialQueue = obj(listing.info) && count(listing.info.total_count) !== null && listing.info.total_count > listing.value.length;
    if (partialQueue) throw new Stop('QUEUES_PAGE_INCOMPLETE');
    const matches = listing.value.filter(q => q?.queue_name === QUEUE);
    if (matches.length !== 1 || !guid(matches[0].queue_id)) throw new Stop('QUEUE_IDENTITY_UNKNOWN');
    ids.queue = matches[0].queue_id;
    const queue = (await get('queue-detail', `/queues/${ids.queue}`)).value;
    if (!obj(queue) || queue.queue_name !== QUEUE || queue.queue_id !== ids.queue) throw new Stop('QUEUE_IDENTITY_MISMATCH');
    out.queue.identityMatched = true;
    out.queue.deliveryPaused = bool(queue.settings?.delivery_paused);
    out.queue.retentionSeconds = count(queue.settings?.message_retention_period);
    out.queue.consumerCount = count(queue.consumers_total_count) ?? (Array.isArray(queue.consumers) ? queue.consumers.length : null);
    const declaredConsumers = out.queue.consumerCount;
    const consumerList = Array.isArray(queue.consumers) ? queue.consumers : null;
    const workerConsumers = consumerList?.filter(c => c?.type === 'worker') ?? null;
    out.queue.workerConsumerIdentified = consumerList && declaredConsumers === consumerList.length &&
      workerConsumers.every(c => typeof c.script_name === 'string')
      ? workerConsumers.some(c => c.script_name === WORKER) : null;
    const metrics = (await get('queue-metrics', `/queues/${ids.queue}/metrics`)).value;
    out.queue.backlogCount = count(metrics?.backlog_count);
    out.queue.backlogBytes = count(metrics?.backlog_bytes);
    out.queue.oldestMessageAtMs = count(metrics?.oldest_message_timestamp_ms) || null;
    const d1listing = await get('d1-list', STATIC.d1);
    if (!Array.isArray(d1listing.value)) throw new Stop('D1_LIST_UNVERIFIED');
    const partialD1 = obj(d1listing.info) && count(d1listing.info.total_count) !== null && d1listing.info.total_count > d1listing.value.length;
    if (partialD1) throw new Stop('D1_PAGE_INCOMPLETE');
    const dbMatches = ids.d1 ? d1listing.value.filter(d => d?.uuid === ids.d1) : [];
    out.d1.identityMatched = ids.d1 ? dbMatches.length === 1 : null;
    if (out.d1.identityMatched) {
      const bookmark = (await get('d1-bookmark', `/d1/database/${ids.d1}/time_travel/bookmark`)).value;
      out.d1.bookmarkAccessible = typeof bookmark?.bookmark === 'string' && bookmark.bookmark.length > 0;
    }
    const subs = await get('account-subscriptions', STATIC.subscriptions);
    const subscriptionsPartial = obj(subs.info) && count(subs.info.total_count) !== null && subs.info.total_count > (Array.isArray(subs.value) ? subs.value.length : 0);
    out.billing.subscriptionCount = Array.isArray(subs.value) && !subscriptionsPartial ? count(subs.value.length) : null;
    // Intentional: never infer a monetary cap, plan eligibility, backup or DNS cutover from metadata.
    out.status = out.workerBinding && out.queue.identityMatched && out.d1.identityMatched ? 'METADATA_ONLY' : 'INCOMPLETE';
    out.reason = 'NOT_A_RESTART_OR_BACKUP_AUTHORIZATION';
  } catch (error) {
    out.status = 'BLOCKED';
    out.reason = error instanceof Stop ? error.code : 'UNEXPECTED_ERROR';
  }
  return out;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  if (process.argv.length === 3 && process.argv[2] === '--dry-run') {
    console.log(JSON.stringify({ mode: 'OFFLINE_ONLY', maxGet: LIMITS.calls, liveRunner: false, noWrites: true }));
  } else {
    console.error('STOP: no live runner or grant exists; use --dry-run for offline metadata.');
    process.exitCode = 2;
  }
}
