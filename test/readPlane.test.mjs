import test from "node:test";
import assert from "node:assert/strict";
import { PublicReadPlane, ReadState, validatePublicStatus } from "../web/read-plane.js";

const status = (block = "100", digest = "d1", state = "FRESH_VERIFIED") => ({
  schemaVersion: "binrat.public-status/0.1", chainId: 4663, state,
  checkpointBlock: block, checkpointBlockHash: `hash-${block}`, feedDigest: digest,
  verifiedAtMs: 1, runtimeUpdatedAtMs: 2, lastSyncError: null,
});
const feed = (block, symbol) => ({ mode: "LIVE", asOfBlock: String(block), bags: [{ id: symbol, symbol }] });
const ok = (value) => ({ ok: true, status: 200, json: async () => value });
const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test("status contract accepts no-snapshot state without fabricated checkpoint fields", () => {
  assert.equal(validatePublicStatus({
    schemaVersion: "binrat.public-status/0.1", chainId: 4663,
    state: "NO_VERIFIED_SNAPSHOT", checkpointBlock: null, feedDigest: null,
  }).state, "NO_VERIFIED_SNAPSHOT");
  assert.throws(() => validatePublicStatus({
    ...status(), state: "FRESH_VERIFIED", feedDigest: null,
  }), /PUBLIC_STATUS_INVALID/);
});

function harness(initialFeed = feed(100, "A"), initialStatus = status()) {
  const states = [];
  const snapshots = [];
  const timers = [];
  let isVisible = true;
  let feedCalls = 0;
  let statusCalls = 0;
  const plane = new PublicReadPlane({
    loadFeed: async () => { feedCalls += 1; return initialFeed; },
    fetchImpl: async () => { statusCalls += 1; return ok(initialStatus); },
    onState: ({ state }) => states.push(state),
    onSnapshot: (value) => snapshots.push(value),
    isVisible: () => isVisible,
    setTimer: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
    clearTimer: () => {},
    random: () => 0.5,
  });
  return {
    plane, states, snapshots, timers,
    counts: () => ({ feedCalls, statusCalls }),
    setVisible(value) { isVisible = value; plane.visibilityChanged(); },
    setFeedLoader(fn) { plane.loadFeed = async (...args) => { feedCalls += 1; return fn(...args); }; },
    setStatusLoader(fn) { plane.fetchImpl = async (...args) => { statusCalls += 1; return fn(...args); }; },
  };
}

async function initialized(h) { h.plane.start(); await flush(); }

test("initial valid feed renders and a later 503 keeps the verified snapshot stale", async () => {
  const h = harness();
  await initialized(h);
  h.setStatusLoader(async () => ({ ok: false, status: 503 }));
  await h.plane.poll();
  assert.equal(h.plane.state, ReadState.STALE);
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "A");
  assert.equal(h.counts().feedCalls, 1);
});

test("a newer status checkpoint during initial load refreshes before the read is marked fresh", async () => {
  const h = harness(feed(100, "A"), status("101", "d2"));
  const pendingFeeds = [feed(100, "A"), feed(101, "B")];
  h.setFeedLoader(async () => pendingFeeds.shift());
  await initialized(h);
  assert.equal(h.plane.snapshot.checkpoint, "101");
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "B");
  assert.equal(h.plane.state, ReadState.FRESH);
});

test("timeout, malformed status and three failures retain the last-known-good feed", async () => {
  const h = harness();
  await initialized(h);
  h.setStatusLoader(async () => { throw new Error("timeout"); });
  await h.plane.poll();
  await h.plane.poll();
  await h.plane.poll();
  assert.equal(h.plane.state, ReadState.STALE);
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "A");
  assert.equal(h.plane.failures, 3);
  assert.equal(h.timers.at(-1).delay, 60_000);
  h.setStatusLoader(async () => ok({ schemaVersion: "bad" }));
  await h.plane.poll();
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "A");
  h.setStatusLoader(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("invalid JSON"); } }));
  await h.plane.poll();
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "A");
});

test("changed checkpoint with 503 or invalid payload preserves old feed; valid recovery promotes", async () => {
  const h = harness();
  await initialized(h);
  h.setStatusLoader(async () => ok(status("101", "d2")));
  h.setFeedLoader(async () => { throw new Error("feed timeout"); });
  await h.plane.poll();
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "A");
  h.setFeedLoader(async () => { throw new Error("feed 503"); });
  await h.plane.poll();
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "A");
  h.setFeedLoader(async () => ({ mode: "LIVE", asOfBlock: "101", bags: [null] }));
  await h.plane.poll();
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "A");
  h.setFeedLoader(async () => feed(101, "B"));
  await h.plane.poll();
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "B");
  assert.equal(h.plane.state, ReadState.FRESH);
  assert.equal(h.plane.failures, 0);
});

test("unchanged digest avoids feed requests and hidden tab pauses polling", async () => {
  const h = harness();
  await initialized(h);
  h.setStatusLoader(async () => ok(status()));
  await h.plane.poll();
  await h.plane.poll();
  assert.equal(h.counts().feedCalls, 1);
  h.setVisible(false);
  const prior = h.counts().statusCalls;
  await h.plane.poll();
  assert.equal(h.counts().statusCalls, prior);
  assert.equal(h.plane.timer, null);
});

test("initial failure stays unavailable without evidence and a later poll can recover", async () => {
  const h = harness();
  h.setFeedLoader(async () => { throw new Error("offline"); });
  await initialized(h);
  assert.equal(h.plane.state, ReadState.UNAVAILABLE);
  assert.equal(h.plane.snapshot, null);
  h.setStatusLoader(async () => ok(status()));
  h.setFeedLoader(async () => feed(100, "A"));
  await h.plane.poll();
  assert.equal(h.plane.state, ReadState.FRESH);
  assert.equal(h.snapshots.length, 1);
});

test("late obsolete status failure cannot regress a newer snapshot", async () => {
  const h = harness();
  await initialized(h);
  const oldStatus = deferred();
  let requests = 0;
  h.setStatusLoader(async () => {
    requests += 1;
    return requests === 1 ? oldStatus.promise : ok(status("102", "d3"));
  });
  h.setFeedLoader(async () => feed(102, "C"));
  const oldPoll = h.plane.poll();
  await flush();
  h.setVisible(false);
  h.setVisible(true);
  h.setFeedLoader(async () => feed(102, "C"));
  const newPoll = h.plane.poll();
  await newPoll;
  oldStatus.reject(new Error("late 503"));
  await oldPoll;
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "C");
  assert.equal(h.plane.state, ReadState.FRESH);
});

test("late obsolete feed success cannot overwrite the newer digest snapshot", async () => {
  const h = harness();
  await initialized(h);
  const oldFeed = deferred();
  let statusRound = 0;
  let feedRound = 0;
  h.setStatusLoader(async () => {
    statusRound += 1;
    return ok(status(statusRound === 1 ? "101" : "102", statusRound === 1 ? "d2" : "d3"));
  });
  h.setFeedLoader(async () => {
    feedRound += 1;
    return feedRound === 1 ? oldFeed.promise : feed(102, "C");
  });
  const oldPoll = h.plane.poll();
  await flush();
  h.setVisible(false);
  h.setVisible(true);
  const newPoll = h.plane.poll();
  await newPoll;
  oldFeed.resolve(feed(101, "B"));
  await oldPoll;
  assert.equal(h.plane.snapshot.feed.bags[0].symbol, "C");
  assert.equal(h.plane.snapshot.checkpoint, "102");
});
