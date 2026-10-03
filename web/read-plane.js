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
  if (value.state === "NO_VERIFIED_SNAPSHOT") return value;
  if (
    typeof value.checkpointBlock !== "string" || !/^(0|[1-9][0-9]*)$/.test(value.checkpointBlock) ||
    typeof value.feedDigest !== "string" || !value.feedDigest
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
    const generation = ++this.generation;
    const controller = new AbortController();
    this.active = { generation, controller };
    try {
      const feed = await this.loadFeed({ signal: controller.signal });
      if (generation !== this.generation) return;
      if (!this.validateFeed(feed)) throw new Error("PUBLIC_FEED_INVALID");
      this.snapshot = { feed, digest: null, checkpoint: String(feed.asOfBlock ?? "") };
      this.onSnapshot(feed);
      this.publish(this.pollingEnabled ? ReadState.FRESH : ReadState.FIXTURE);
      if (!this.pollingEnabled) return;
      try {
        const status = await this.fetchStatus(controller.signal);
        if (generation !== this.generation) return;
        this.status = status;
        if (status.state === "NO_VERIFIED_SNAPSHOT") throw new Error("STATUS_HAS_NO_VERIFIED_SNAPSHOT");
        if (status.checkpointBlock === this.snapshot.checkpoint) {
          this.snapshot.digest = status.feedDigest;
        } else {
          this.publish(ReadState.STALE);
          const updatedFeed = await this.loadFeed({ signal: controller.signal });
          if (generation !== this.generation) return;
          if (!this.validateFeed(updatedFeed) || String(updatedFeed.asOfBlock ?? "") !== status.checkpointBlock)
            throw new Error("PUBLIC_FEED_CHECKPOINT_MISMATCH");
          this.snapshot = { feed: updatedFeed, digest: status.feedDigest, checkpoint: status.checkpointBlock };
          this.onSnapshot(updatedFeed);
        }
        this.publish(status.state === "FRESH_VERIFIED" ? ReadState.FRESH : ReadState.STALE);
        this.failures = 0;
      } catch (error) {
        // The primary validated feed is already available; status is advisory.
        this.failures += 1;
        this.publish(ReadState.STALE, error);
      }
    } catch (error) {
      if (generation === this.generation) {
        this.failures += 1;
        this.publish(ReadState.UNAVAILABLE, error);
      }
    } finally {
      if (this.active?.generation === generation) this.active = null;
      if (this.running && this.pollingEnabled) this.schedule(this.failures ? this.backoffDelay() : 15_000);
    }
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
      this.status = status;
      if (!this.snapshot) {
        if (status.state === "NO_VERIFIED_SNAPSHOT") throw new Error("NO_VERIFIED_SNAPSHOT");
        const feed = await this.loadFeed({ signal: controller.signal });
        if (generation !== this.generation) return;
        if (!this.validateFeed(feed) || String(feed.asOfBlock ?? "") !== status.checkpointBlock)
          throw new Error("PUBLIC_FEED_INVALID");
        this.snapshot = { feed, digest: status.feedDigest, checkpoint: status.checkpointBlock };
        this.onSnapshot(feed);
        this.failures = 0;
        this.publish(status.state === "FRESH_VERIFIED" ? ReadState.FRESH : ReadState.STALE);
        return;
      }
      if (status.state === "NO_VERIFIED_SNAPSHOT") {
        this.publish(ReadState.STALE, new Error("STATUS_HAS_NO_VERIFIED_SNAPSHOT"));
        throw new Error("STATUS_HAS_NO_VERIFIED_SNAPSHOT");
      }

      const checkpointChanged = status.checkpointBlock !== this.snapshot.checkpoint;
      const digestChanged = this.snapshot.digest !== null && status.feedDigest !== this.snapshot.digest;
      if (checkpointChanged || digestChanged || this.snapshot.digest === null) {
        const feed = await this.loadFeed({ signal: controller.signal });
        if (generation !== this.generation) return;
        if (!this.validateFeed(feed)) throw new Error("PUBLIC_FEED_INVALID");
        const checkpoint = String(feed.asOfBlock ?? "");
        if (checkpoint !== status.checkpointBlock) throw new Error("PUBLIC_FEED_CHECKPOINT_MISMATCH");
        this.snapshot = { feed, digest: status.feedDigest, checkpoint };
        this.onSnapshot(feed);
      }
      this.failures = 0;
      this.publish(status.state === "FRESH_VERIFIED" ? ReadState.FRESH : ReadState.STALE);
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
    if (this.active) this.active.controller.abort();
    this.active = null;
    this.generation += 1;
  }
}
