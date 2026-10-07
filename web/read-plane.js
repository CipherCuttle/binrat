import { verifyFeedBinding, bindingMatches } from "./snapshot-contract.js";
const STATUS_SCHEMA = "binrat.public-status/0.1";
const FAILURE_BACKOFF_MS = [15_000, 30_000, 60_000, 120_000];

export const ReadState = Object.freeze({
  LOADING: "LOADING_NO_DATA",
  FRESH: "FRESH_VERIFIED",
  STALE: "STALE_VERIFIED",
  UNAVAILABLE: "UNAVAILABLE_NO_DATA",
  FIXTURE: "FIXTURE_DATA",
});

export function validatePublicStatus(value) {
  if (
    value?.schemaVersion !== STATUS_SCHEMA || value.chainId !== 4663 ||
    !["FRESH_VERIFIED", "STALE_VERIFIED", "NO_VERIFIED_SNAPSHOT"].includes(value.state)
  ) throw new Error("PUBLIC_STATUS_INVALID");
  if (value.state === "NO_VERIFIED_SNAPSHOT") {
    if (["checkpointBlock", "checkpointBlockHash", "feedDigest", "verifiedAtMs", "publicationVersion", "freshnessValidUntilMs"].some(key => value[key] !== null)) {
      throw new Error("PUBLIC_STATUS_INVALID");
    }
    return value;
  }
  if (
    typeof value.checkpointBlock !== "string" || !/^(0|[1-9][0-9]*)$/.test(value.checkpointBlock) ||
    !/^0x[0-9a-f]{64}$/.test(value.checkpointBlockHash) ||
    !/^[0-9a-f]{64}$/.test(value.feedDigest) ||
    !Number.isSafeInteger(value.verifiedAtMs) || value.verifiedAtMs < 0 ||
    !Number.isSafeInteger(value.publicationVersion) || value.publicationVersion < 1 ||
    (value.runtimeUpdatedAtMs !== null && (!Number.isSafeInteger(value.runtimeUpdatedAtMs) || value.runtimeUpdatedAtMs < 0)) ||
    (value.freshnessValidUntilMs !== null && (!Number.isSafeInteger(value.freshnessValidUntilMs) || value.freshnessValidUntilMs < 0)) ||
    (value.lastSyncError !== null && typeof value.lastSyncError !== "string") ||
    (value.state === "FRESH_VERIFIED" && (value.runtimeUpdatedAtMs === null || value.freshnessValidUntilMs === null || value.lastSyncError !== null))
  ) throw new Error("PUBLIC_STATUS_INVALID");
  return value;
}

export class PublicReadPlane {
  constructor({
    fetchImpl = globalThis.fetch.bind(globalThis),
    loadFeed,
    pollingEnabled = true,
    validateFeed = (feed) => feed && ["LIVE", "FIXTURE"].includes(feed.mode) &&
      Array.isArray(feed.bags) && feed.bags.every((bag) => bag && typeof bag === "object"),
    onSnapshot = () => {},
    onState = () => {},
    isVisible = () => !globalThis.document?.hidden,
    setTimer = globalThis.setTimeout.bind(globalThis),
    clearTimer = globalThis.clearTimeout.bind(globalThis),
    random = Math.random,
    now = Date.now,
  }) {
    this.fetchImpl = fetchImpl;
    this.loadFeed = loadFeed;
    this.pollingEnabled = pollingEnabled;
    this.validateFeed = validateFeed;
    this.onSnapshot = onSnapshot;
    this.onState = onState;
    this.isVisible = isVisible;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.random = random;
    this.now = now;
    this.expiryTimer = null;
    this.state = ReadState.LOADING;
    this.snapshot = null;
    this.status = null;
    this.error = null;
    this.failures = 0;
    this.timer = null;
    this.generation = 0;
    this.active = null;
    this.running = false;
  }

  publish(state, error = null) {
    if (this.expiryTimer !== null) this.clearTimer(this.expiryTimer);
    this.expiryTimer = null;
    if (state === ReadState.FRESH) {
      const remaining = this.status.freshnessValidUntilMs - this.now();
      if (remaining <= 0) { state = ReadState.STALE; error = new Error("PUBLIC_STATUS_EXPIRED"); }
      else this.expiryTimer = this.setTimer(() => {
        this.expiryTimer = null;
        this.publish(ReadState.STALE, new Error("PUBLIC_STATUS_EXPIRED"));
      }, remaining);
    }
    this.state = state;
    this.error = error;
    this.onState({ state, snapshot: this.snapshot, status: this.status, error });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.publish(ReadState.LOADING);
    void this.loadInitial();
  }

  async loadInitial() {
    if (this.snapshot) this.publish(ReadState.STALE, new Error("PUBLIC_FRESHNESS_BEING_ESTABLISHED"));
    const generation = ++this.generation;
    const controller = new AbortController();
    this.active = { generation, controller };
    try {
      const feed = await this.loadFeed({ signal: controller.signal });
      if (generation !== this.generation) return;
      if (!this.validateFeed(feed)) throw new Error("PUBLIC_FEED_INVALID");
      if (!this.pollingEnabled) {
        if (feed.mode !== "FIXTURE") throw new Error("FIXTURE_MODE_REQUIRED");
        this.snapshot = { feed }; this.onSnapshot(feed); this.publish(ReadState.FIXTURE); return;
      }
      let candidate = { feed, ...await verifyFeedBinding(feed) };
      if (generation !== this.generation) return;
      const status = await this.fetchStatus(controller.signal);
      if (generation !== this.generation) return;
      this.rejectConflict(status);
      if (status.state === "NO_VERIFIED_SNAPSHOT") throw new Error("STATUS_HAS_NO_VERIFIED_SNAPSHOT");
      if (candidate.checkpoint !== status.checkpointBlock) {
        const updatedFeed = await this.loadFeed({ signal: controller.signal });
        if (!this.validateFeed(updatedFeed)) throw new Error("PUBLIC_FEED_INVALID");
        candidate = { feed: updatedFeed, ...await verifyFeedBinding(updatedFeed) };
      }
      if (generation !== this.generation) return;
      this.accept(candidate, status);
    } catch (error) {
      if (generation === this.generation) {
        this.failures += 1;
        this.publish(this.snapshot ? ReadState.STALE : ReadState.UNAVAILABLE, error);
      }
    } finally {
      if (this.active?.generation === generation) this.active = null;
      if (this.running && this.pollingEnabled) this.schedule(this.failures ? this.backoffDelay() : 15_000);
    }
  }

  rejectConflict(status) {
    if (!this.snapshot || status.state === "NO_VERIFIED_SNAPSHOT") return;
    if (status.checkpointBlock === this.snapshot.checkpoint && !bindingMatches(this.snapshot, status)) {
      throw new Error("PUBLIC_SNAPSHOT_CHECKPOINT_CONFLICT");
    }
    if (BigInt(status.checkpointBlock) < BigInt(this.snapshot.checkpoint)) throw new Error("PUBLIC_SNAPSHOT_CHECKPOINT_REGRESSION");
  }

  accept(candidate, status) {
    if (!bindingMatches(candidate, status)) throw new Error("PUBLIC_FEED_BINDING_MISMATCH");
    if (status.state === "FRESH_VERIFIED" && (status.freshnessValidUntilMs <= this.now() || status.verifiedAtMs > this.now() || status.runtimeUpdatedAtMs > this.now())) throw new Error("PUBLIC_STATUS_EXPIRED");
    this.snapshot = candidate;
    this.status = status;
    this.onSnapshot(candidate.feed);
    this.failures = 0;
    this.publish(status.state === "FRESH_VERIFIED" ? ReadState.FRESH : ReadState.STALE);
  }

  async fetchStatus(signal) {
    const requestSignal = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
      : AbortSignal.timeout(10_000);
    const response = await this.fetchImpl("/api/status", {
      headers: { accept: "application/json" },
      signal: requestSignal,
    });
    if (!response.ok) throw new Error(`PUBLIC_STATUS_HTTP_${response.status}`);
    return validatePublicStatus(await response.json());
  }

  schedule(delay) {
    if (!this.running || this.timer !== null || !this.isVisible()) return;
    this.timer = this.setTimer(() => {
      this.timer = null;
      if (this.isVisible() && !this.active) void this.poll();
    }, delay);
  }

  backoffDelay() {
    const base = FAILURE_BACKOFF_MS[Math.min(this.failures - 1, FAILURE_BACKOFF_MS.length - 1)];
    return Math.round(base * (0.9 + this.random() * 0.2));
  }

  async poll() {
    if (!this.running || !this.pollingEnabled || !this.isVisible() || this.active) return;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    const generation = ++this.generation;
    const controller = new AbortController();
    this.active = { generation, controller };
    try {
      const status = await this.fetchStatus(controller.signal);
      if (generation !== this.generation) return;
      if (status.state === "NO_VERIFIED_SNAPSHOT") {
        throw new Error("STATUS_HAS_NO_VERIFIED_SNAPSHOT");
      }
      this.rejectConflict(status);
      let candidate = this.snapshot;
      if (!candidate || candidate.checkpoint !== status.checkpointBlock) {
        if (this.snapshot) this.publish(ReadState.STALE, new Error("PUBLIC_FRESHNESS_BEING_ESTABLISHED"));
        const feed = await this.loadFeed({ signal: controller.signal });
        if (generation !== this.generation) return;
        if (!this.validateFeed(feed)) throw new Error("PUBLIC_FEED_INVALID");
        candidate = { feed, ...await verifyFeedBinding(feed) };
      }
      if (generation !== this.generation) return;
      this.accept(candidate, status);
    } catch (error) {
      if (generation === this.generation) {
        this.failures += 1;
        if (this.snapshot) this.publish(ReadState.STALE, error);
        else this.publish(ReadState.UNAVAILABLE, error);
      }
    } finally {
      if (this.active?.generation === generation) this.active = null;
      if (this.running) this.schedule(this.failures ? this.backoffDelay() : 15_000);
    }
  }

  visibilityChanged() {
    if (!this.running) return;
    if (this.state === ReadState.FRESH && this.status.freshnessValidUntilMs <= this.now()) {
      this.publish(ReadState.STALE, new Error("PUBLIC_STATUS_EXPIRED"));
    }
    if (!this.isVisible()) {
      if (this.timer !== null) this.clearTimer(this.timer);
      this.timer = null;
      if (this.active) {
        this.generation += 1;
        this.active.controller.abort();
        this.active = null;
      }
      return;
    }
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    this.schedule(0);
  }

  retry() {
    if (!this.running || this.active) return;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    void this.loadInitial();
  }

  stop() {
    this.running = false;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
    if (this.expiryTimer !== null) this.clearTimer(this.expiryTimer);
    this.expiryTimer = null;
    if (this.active) this.active.controller.abort();
    this.active = null;
    this.generation += 1;
  }
}
