import test from "node:test";
import assert from "node:assert/strict";
import { PublicReadPlane, ReadState, validatePublicStatus } from "../web/read-plane.js";
import { adaptLatestLaunches } from "../web/data-source.js";
import { createHash } from "node:crypto";

const status = (block = "100", digest = "d1", state = "FRESH_VERIFIED") => canonicalStatus(canonicalFixture(block, { d1: "A", d2: "B", d3: "C" }[digest] ?? digest), state);
const feed = (block, symbol) => adaptLatestLaunches(canonicalFixture(String(block), symbol));
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
    checkpointBlockHash: null, verifiedAtMs: null, publicationVersion: null, freshnessValidUntilMs: null,
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

async function initialized(h) { h.plane.running = true; h.plane.publish(ReadState.LOADING); await h.plane.loadInitial(); }

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

// Regression fixtures use the actual published contract, not an adapted digest
// invented by the test harness. These assertions must fail on the #122 base.
function canonicalFixture(checkpoint = "200", symbol = "P") {
  const material = {
    schemaVersion: "binrat.latest-launches/0.1", chainId: 4663,
    sourceCheckpoint: checkpoint, checkpointBlockHash: `0x${"1".repeat(64)}`,
    historyCoverage: "PARTIAL", launches: [{
      launchId: "a".repeat(64), factId: `binrat-fact:4663:${"a".repeat(64)}`,
      token: `0x${"2".repeat(40)}`, deployer: `0x${"3".repeat(40)}`,
      txHash: `0x${"4".repeat(64)}`, blockNumber: "100", symbol, name: "Pons",
      priorLaunchCount: 0, metadata: { imageUri: "", website: "", twitter: "", telegram: "" },
    }],
  };
  const normalize = value => Array.isArray(value) ? value.map(normalize) :
    value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k => [k, normalize(value[k])])) : value;
  return { ...material, feedDigest: createHash("sha256").update(JSON.stringify(normalize(material))).digest("hex") };
}
function canonicalStatus(raw, state = "FRESH_VERIFIED") {
  return { schemaVersion: "binrat.public-status/0.1", chainId: raw.chainId, state,
    checkpointBlock: raw.sourceCheckpoint, checkpointBlockHash: raw.checkpointBlockHash,
    feedDigest: raw.feedDigest, verifiedAtMs: Date.now(), runtimeUpdatedAtMs: Date.now(),
    publicationVersion: 1, freshnessValidUntilMs: Date.now() + 180_000, lastSyncError: null };
}
function canonicalHarness(raw = canonicalFixture()) {
  const states = [];
  const plane = new PublicReadPlane({ loadFeed: async () => adaptLatestLaunches(raw),
    fetchImpl: async () => ok(canonicalStatus(raw)), onState: x => states.push(x.state),
    setTimer: () => 1, clearTimer: () => {} });
  return { plane, states, raw };
}
test("regression: adaptation retains canonical hash, digest and complete material", () => {
  const raw = canonicalFixture();
  const adapted = adaptLatestLaunches(raw);
  assert.equal(adapted.chainId, raw.chainId);
  assert.equal(adapted.checkpointBlockHash, raw.checkpointBlockHash);
  assert.equal(adapted.feedDigest, raw.feedDigest);
  assert.deepEqual(adapted.canonicalSnapshot, raw);
  assert.equal(adapted.bags[0].asOfBlockHash, raw.checkpointBlockHash);
});
test("regression: initial feed cannot emit fresh while status is unresolved", async () => {
  const h = canonicalHarness(); const waiting = deferred();
  h.plane.fetchImpl = () => waiting.promise;
  const loading = h.plane.loadInitial();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.states.includes(ReadState.FRESH), false);
  waiting.resolve(ok(canonicalStatus(h.raw)));
  await loading;
  assert.equal(h.plane.state, ReadState.FRESH);
});
test("regression: same checkpoint with another digest or hash fails closed", async () => {
  for (const field of ["feedDigest", "checkpointBlockHash"]) {
    const h = canonicalHarness();
    await h.plane.loadInitial(); h.plane.running = true;
    const before = h.plane.snapshot;
    h.plane.fetchImpl = async () => ok({ ...canonicalStatus(h.raw),
      [field]: field === "feedDigest" ? "b".repeat(64) : `0x${"b".repeat(64)}` });
    await h.plane.poll();
    assert.equal(h.plane.state, ReadState.STALE);
    assert.equal(h.plane.snapshot, before);
  }
});
test("regression: modified canonical payload with unchanged digest is unavailable", async () => {
  const raw = canonicalFixture(); raw.launches[0].symbol = "FORGED";
  const h = canonicalHarness(raw); await h.plane.loadInitial();
  assert.equal(h.plane.state, ReadState.UNAVAILABLE);
  assert.equal(h.plane.snapshot, null);
});
test("regression: retry failure preserves the last verified snapshot", async () => {
  const h = canonicalHarness(); await h.plane.loadInitial();
  const before = h.plane.snapshot;
  h.plane.loadFeed = async () => { throw new Error("OFFLINE"); };
  await h.plane.loadInitial();
  assert.equal(h.plane.state, ReadState.STALE);
  assert.equal(h.plane.snapshot, before);
});
test("regression: no-snapshot status cannot retain non-null binding fields", () => {
  assert.throws(() => validatePublicStatus({ ...canonicalStatus(canonicalFixture()), state: "NO_VERIFIED_SNAPSHOT" }), /PUBLIC_STATUS_INVALID/);
});

test('regression: a newer publication downgrades retained evidence while its binding loads', async()=>{
 const h=harness();await initialized(h);const pending=deferred();h.setStatusLoader(async()=>ok(status('101','d2')));h.setFeedLoader(()=>pending.promise);
 const poll=h.plane.poll();await flush();assert.equal(h.plane.state,ReadState.STALE);assert.equal(h.plane.snapshot.checkpoint,'100');
 pending.resolve(feed(101,'B'));await poll;assert.equal(h.plane.state,ReadState.FRESH);
});
test('regression: freshness expiry remains enforced while the tab is hidden',async()=>{
 const h=harness();let clock=Date.now();h.plane.now=()=>clock;await initialized(h);
 const expiry=h.timers.find(t=>t.delay>120000);assert.ok(expiry);h.setVisible(false);clock=h.plane.status.freshnessValidUntilMs;
 expiry.fn();assert.equal(h.plane.state,ReadState.STALE);assert.equal(h.plane.snapshot.checkpoint,'100');
});

test('hostile H3: future publication and runtime timestamps cannot promote Fresh',async()=>{
 for(const field of ['verifiedAtMs','runtimeUpdatedAtMs']) {
  const h=canonicalHarness();h.plane.fetchImpl=async()=>ok({...canonicalStatus(h.raw),[field]:Date.now()+1_000_000});
  await h.plane.loadInitial();assert.notEqual(h.plane.state,ReadState.FRESH,field);
 }
});
