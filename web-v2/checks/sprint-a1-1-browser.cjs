/* Compiled Chromium; recorded public GETs and explicitly labelled adverse controls. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { pathToFileURL } = require("node:url");
const runner = require("node:module").createRequire(
  path.join(
    process.env.BINRAT_FRONTDOOR_TOOLS ||
      "/tmp/binrat-v3-sprint-runner/node_modules",
    "runner.cjs",
  ),
);
assert.equal(runner("playwright/package.json").version, "1.56.1");
const { chromium } = runner("playwright");
const root = path.resolve(__dirname, "../.."),
  out = path.join(root, "docs/receipts/sprint-a1-1");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p)));
const originalFeed = read("docs/receipts/sprint-a1/public-feed.json");
const originalStatus = read("docs/receipts/sprint-a1/public-status.json");
const feed = read("docs/receipts/sprint-a1-1/public-feed.json");
const status = read("docs/receipts/sprint-a1-1/public-status.json");
const source = read("docs/receipts/sprint-a1-1/historical-source.json");
const oldId = originalFeed.launches[0].launchId;
const report = {
  baseSha: "3aedca9d2ea9bfca1aa66d54aab3c8b86df8ef2b",
  provenance: "COMPILED_FRONTEND_RECORDED_PUBLIC_GET_REPLAY",
  controls: "SIMULATED_ADVERSE_STATES_AND_FRESH_STATUS",
  checks: [],
  errors: [],
  measurements: [],
  requests: [],
  historicalCasePermalink: "BLOCKED",
  sourceHashes: Object.fromEntries(
    [
      "web-v2/src/PonsCasePreview.tsx",
      "web-v2/src/frontdoor-discovery.css",
      "web-v2/src/pons-readonly-preview.mjs",
      "web-v2/src/pons-readonly-preview.d.mts",
    ].map((p) => [
      p,
      require("node:crypto")
        .createHash("sha256")
        .update(fs.readFileSync(path.join(root, p)))
        .digest("hex"),
    ]),
  ),
  verdict: "FAIL",
};
const sites = [
  [".artifacts/sprint-a1-1/before-site", 4190],
  [".artifacts/v3-frontdoor/site", 4189],
];
function serve(dir, port) {
  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".webp": "image/webp",
    ".png": "image/png",
    ".woff2": "font/woff2",
  };
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const u = new URL(req.url, "http://localhost");
      const file = path.join(
        root,
        dir,
        u.pathname === "/" ? "index.html" : u.pathname,
      );
      let target = file;
      if (!fs.existsSync(target)) target = path.join(root, dir, "index.html");
      res.writeHead(200, {
        "content-type":
          types[path.extname(target)] || "application/octet-stream",
      });
      fs.createReadStream(target).pipe(res);
    });
    s.listen(port, "127.0.0.1", () => resolve(s));
  });
}
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log("PASS " + name);
}
async function context(b, viewport, state) {
  const c = await b.newContext({ viewport, reducedMotion: "reduce" });
  c.on("page", (p) => {
    p.on("pageerror", (e) => report.errors.push(e.message));
    p.on("response", (r) => {
      if (!new URL(r.url()).pathname.startsWith("/api/") && r.status() >= 400)
        report.errors.push("STATIC_" + r.status());
    });
  });
  await c.route("**/api/**", async (r) => {
    const p = new URL(r.request().url()).pathname;
    assert.equal(r.request().method(), "GET");
    assert.ok(
      ["/api/status", "/api/launches/latest"].includes(p) ||
        /^\/api\/bag\/[0-9a-f]{64}$/.test(p),
      p,
    );
    report.requests.push(p);
    if (state.delayMs && p.startsWith("/api/bag/"))
      await new Promise((resolve) => setTimeout(resolve, state.delayMs));
    const response = state.unavailable
      ? { status: 503, body: { error: "SIMULATED_UNAVAILABLE" } }
      : p.startsWith("/api/bag/")
        ? { status: state.sourceStatus ?? 200, body: state.source }
        : {
            status: 200,
            body: p === "/api/status" ? state.status : state.feed,
          };
    await r.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    });
  });
  return c;
}
async function visit(c, route = "/", port = 4189) {
  const p = await c.newPage();
  await p.goto("http://127.0.0.1:" + port + route, {
    waitUntil: "networkidle",
  });
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((i) => i.loading !== "lazy")
        .map((i) => i.decode()),
    );
  });
  return p;
}
async function capture(p, name) {
  await p.screenshot({ path: path.join(out, name + ".png") });
}
async function recheck(p, expected) {
  await p.getByRole("button", { name: "RECHECK", exact: true }).click();
  await p.getByRole("button", { name: "RECHECK", exact: true }).waitFor();
  await p.waitForFunction(
    (value) =>
      document.querySelector("[data-read-state]")?.dataset.readState === value,
    expected,
  );
  await p.waitForLoadState("networkidle");
}
(async () => {
  const { canonicalSnapshotDigest } = await import(
    pathToFileURL(path.join(root, "web/snapshot-contract.js"))
  );
  const servers = await Promise.all(sites.map(([d, p]) => serve(d, p)));
  const b = await chromium.launch({ headless: true });
  report.browser = b.version();
  try {
    for (const [width, height] of [
      [390, 844],
      [320, 800],
      [1440, 900],
    ]) {
      const c = await context(
        b,
        { width, height },
        { feed: originalFeed, status: originalStatus, source },
      );
      const before = await visit(c, "/", 4190);
      await capture(before, `before-${width}x${height}`);
      await before.close();
      const p = await visit(c);
      await check(
        `${width}x${height}: stale label, Rat Zero, CTA and discovery reach`,
        async () => {
          assert.equal(
            await p
              .locator("[data-read-state]")
              .first()
              .getAttribute("data-read-state"),
            "STALE_VERIFIED",
          );
          assert.match(
            await p.locator("#vl-finds").innerText(),
            /EARLIER FINDS/,
          );
          assert.doesNotMatch(
            await p.locator("body").innerText(),
            /FRESH FINDS|Fresh Pons|JUST HIT|FRESH SCRAP/,
          );
          assert.match(
            await p.locator("#vl-finds").innerText(),
            /not launch age|neither human identity nor profitability/,
          );
          const cta = await p
            .getByRole("button", { name: "START DIGGING" })
            .boundingBox();
          assert.ok(cta.y + cta.height <= height, "CTA outside viewport");
          assert.ok(
            await p
              .locator(".vl-rat-scene img")
              .evaluate((e) => e.complete && e.naturalWidth > 0),
          );
          assert.ok(
            (await p.evaluate(() => document.documentElement.scrollWidth)) <=
              width + 1,
          );
          if (width <= 390) {
            const statusBox = await p.locator(".vl-lab-stamp").boundingBox();
            const brandBox = await p.locator(".vl-brand").boundingBox();
            const ratBox = await p.locator(".vl-rat-scene").boundingBox();
            assert.ok(
              statusBox.y >= brandBox.y + brandBox.height,
              "status overlaps brand",
            );
            assert.ok(
              statusBox.y + statusBox.height <= ratBox.y + 1,
              "status overlaps Rat Zero",
            );
            const recheckBox = await p
              .getByRole("button", { name: "RECHECK", exact: true })
              .boundingBox();
            assert.ok(
              recheckBox.x >= statusBox.x + statusBox.width,
              "recheck must follow status on the right",
            );
            assert.equal(
              await p
                .locator(".vl-lab-stamp b")
                .evaluate((e) => getComputedStyle(e).fontSize),
              "14px",
            );
          }
          report.measurements.push({ width, height, cta });
        },
      );
      await capture(p, `after-${width}x${height}`);
      await p.getByRole("button", { name: "START DIGGING" }).click();
      await check(
        `${width}: one CTA brings first exact discovery payoff into view`,
        async () => {
          assert.ok(
            (await p.locator("[data-case-id]").first().boundingBox()).y <
              height,
          );
          assert.equal(
            await p
              .locator("#vl-finds")
              .evaluate((e) => e === document.activeElement),
            true,
          );
        },
      );
      await capture(p, `discovery-${width}x${height}`);
      await p.locator("[data-case-id]").first().click();
      await check(
        `${width}: current Case uses verified feed fields`,
        async () => {
          assert.equal(
            await p.locator("#vl-case").getAttribute("data-case"),
            oldId,
          );
          assert.equal(new URL(p.url()).pathname, "/bag/" + oldId);
          assert.doesNotMatch(
            await p.locator("#vl-case h1").innerText(),
            /FRESH SCRAP/,
          );
          const cta = await p
            .locator(".vl-case-intro .vl-primary")
            .boundingBox();
          assert.ok(cta.y + cta.height <= height, "Case CTA outside viewport");
        },
      );
      await capture(p, `case-${width}x${height}`);
      await c.close();
    }
    await check(
      "original exact URL after Case leaves actual latest-20 window",
      async () => {
        assert.ok(originalFeed.launches.some((l) => l.launchId === oldId));
        assert.ok(!feed.launches.some((l) => l.launchId === oldId));
        assert.equal(feed.launches.length, 20);
        assert.equal(source.bag.id, oldId);
        const state = { feed: originalFeed, status: originalStatus, source };
        const c = await context(b, { width: 390, height: 844 }, state);
        const p = await visit(c, "/bag/" + oldId);
        assert.equal(
          await p.locator("#vl-case").getAttribute("data-case"),
          oldId,
        );
        state.feed = feed;
        state.status = status;
        await p.reload({ waitUntil: "networkidle" });
        assert.equal(new URL(p.url()).pathname, "/bag/" + oldId);
        assert.equal(await p.locator("[data-case]").count(), 0);
        const expected =
          source.asOfBlock === status.checkpointBlock &&
          source.receipt.asOfBlockHash === status.checkpointBlockHash
            ? "HISTORICAL_SOURCE_ONLY"
            : "UNAVAILABLE";
        assert.equal(
          await p.locator("#vl-case").getAttribute("data-historical-state"),
          expected,
        );
        assert.match(
          await p.locator("#vl-case").innerText(),
          new RegExp(oldId),
        );
        assert.equal(
          await p
            .getByRole("link", { name: "CHECK EXACT SOURCE RECORD" })
            .getAttribute("href"),
          "/api/bag/" + oldId,
        );
        assert.equal(await p.locator("#vl-case pre").count(), 0);
        assert.ok(
          (await p.evaluate(() => document.documentElement.scrollWidth)) <= 391,
          "historical identity overflow",
        );
        await capture(p, "historical-original-url");
        await c.close();
      },
    );
    for (const name of [
      "current-url",
      "historical-unavailable",
      "projection-mismatch",
      "checkpoint-mismatch",
      "fresh-source",
      "503-recovery",
      "late-response-navigation",
    ]) {
      const state = {
        feed: structuredClone(feed),
        status: structuredClone(status),
        source: structuredClone(source),
      };
      const c = await context(b, { width: 390, height: 844 }, state);
      await check(name, async () => {
        if (name === "historical-unavailable") state.sourceStatus = 404;
        if (name === "projection-mismatch")
          state.source.receipt.projectionVersion = "OTHER_PROJECTION";
        if (name === "checkpoint-mismatch")
          state.source.receipt.asOfBlockHash = "0x" + "f".repeat(64);
        if (["fresh-source", "503-recovery"].includes(name))
          Object.assign(state.status, {
            state: "FRESH_VERIFIED",
            verifiedAtMs: Date.now() - 1000,
            runtimeUpdatedAtMs: Date.now() - 1000,
            freshnessValidUntilMs: Date.now() + 60000,
            lastSyncError: null,
          });
        if (name === "late-response-navigation") state.delayMs = 800;
        const p =
          name === "late-response-navigation"
            ? await c.newPage()
            : await visit(
                c,
                ["fresh-source", "503-recovery"].includes(name)
                  ? "/"
                  : name === "current-url"
                    ? "/bag/" + feed.launches[0].launchId
                    : "/bag/" + oldId,
              );
        if (name === "current-url") {
          assert.equal(
            await p.locator("#vl-case").getAttribute("data-case"),
            feed.launches[0].launchId,
          );
          await p.getByRole("tab", { name: /RECEIPTS/ }).click();
          await p.locator("summary").click();
          const receipt = JSON.parse(await p.locator("pre").innerText());
          assert.equal(receipt.feedDigest, feed.feedDigest);
          assert.equal(
            receipt.priorLaunchCount,
            feed.launches[0].priorLaunchCount,
          );
        } else if (name === "fresh-source") {
          assert.match(
            await p.locator("#vl-finds").innerText(),
            /SOURCE CHECKED|not launch age/,
          );
          assert.doesNotMatch(
            await p.locator("body").innerText(),
            /FRESH FINDS|JUST HIT|Fresh Pons/,
          );
          await capture(p, name);
        } else if (name === "503-recovery") {
          state.unavailable = true;
          await recheck(p, "STALE_VERIFIED");
          assert.equal(
            await p
              .locator("[data-read-state]")
              .first()
              .getAttribute("data-read-state"),
            "STALE_VERIFIED",
          );
          assert.match(
            await p.locator("#vl-finds").innerText(),
            /EARLIER FINDS/,
          );
          state.unavailable = false;
          await recheck(p, "FRESH_VERIFIED");
          assert.equal(
            await p
              .locator("[data-read-state]")
              .first()
              .getAttribute("data-read-state"),
            "FRESH_VERIFIED",
          );
        } else if (name === "late-response-navigation") {
          await p.goto("http://127.0.0.1:4189/bag/" + oldId, {
            waitUntil: "domcontentloaded",
          });
          await p.locator("[data-historical-state=CHECKING]").waitFor();
          await p.getByRole("button", { name: "BACK TO DISCOVERY" }).click();
          await p.locator("[data-case-id]").first().click();
          await p.waitForTimeout(1000);
          assert.equal(
            await p.locator("#vl-case").getAttribute("data-case"),
            feed.launches[0].launchId,
          );
        } else {
          assert.equal(
            await p.locator("#vl-case").getAttribute("data-historical-state"),
            "UNAVAILABLE",
          );
          assert.equal(await p.locator("[data-case]").count(), 0);
          assert.equal(new URL(p.url()).pathname, "/bag/" + oldId);
          if (name === "projection-mismatch")
            assert.match(
              await p.locator("#vl-case").innerText(),
              /PONS_HISTORICAL_PROJECTION_MISMATCH/,
            );
          if (name === "checkpoint-mismatch")
            assert.match(
              await p.locator("#vl-case").innerText(),
              /PONS_HISTORICAL_CHECKPOINT_MISMATCH/,
            );
          assert.ok(
            (await p.evaluate(() => document.documentElement.scrollWidth)) <=
              391,
            "failure state overflow",
          );
          await capture(p, name);
        }
        await c.close();
      });
    }
    await check(
      "initial 503 exact identity preserved and recovery requires verified evidence",
      async () => {
        const state = { feed, status, source, unavailable: true };
        const c = await context(b, { width: 320, height: 800 }, state);
        const id = feed.launches[0].launchId;
        const p = await visit(c, "/bag/" + id);
        assert.equal(await p.locator("[data-case]").count(), 0);
        assert.equal(
          await p
            .locator("[data-read-state]")
            .first()
            .getAttribute("data-read-state"),
          "UNAVAILABLE",
        );
        assert.equal(new URL(p.url()).pathname, "/bag/" + id);
        state.unavailable = false;
        await recheck(
          p,
          status.state === "FRESH_VERIFIED" &&
            status.freshnessValidUntilMs > Date.now()
            ? "FRESH_VERIFIED"
            : "STALE_VERIFIED",
        );
        assert.equal(await p.locator("#vl-case").getAttribute("data-case"), id);
        await c.close();
      },
    );
    if (process.env.BINRAT_A1_1_LIVE === "1")
      await check(
        "compiled browser forwards real production GETs: current Case and old exact URL",
        async () => {
          const c = await b.newContext({
            viewport: { width: 390, height: 844 },
            reducedMotion: "reduce",
          });
          const live = {
            provenance: "COMPILED_LOCAL_BROWSER_REAL_PRODUCTION_PUBLIC_GETS",
            origin: "https://binrat.tech",
            requests: [],
            errors: [],
            verdict: "FAIL",
          };
          c.on("page", (p) =>
            p.on("pageerror", (e) => live.errors.push(e.message)),
          );
          await c.route("**/api/**", async (r) => {
            const p = new URL(r.request().url()).pathname;
            assert.equal(r.request().method(), "GET");
            assert.ok(
              ["/api/status", "/api/launches/latest"].includes(p) ||
                p === "/api/bag/" + oldId,
            );
            const res = await c.request.get(live.origin + p, {
              timeout: 20000,
            });
            const body = await res.json();
            live.requests.push({
              path: p,
              status: res.status(),
              checkedAt: new Date().toISOString(),
              body,
            });
            await r.fulfill({
              status: res.status(),
              contentType: "application/json",
              body: JSON.stringify(body),
            });
          });
          try {
            const p = await visit(c);
            assert.ok(
              (await p.locator("[data-case-id]").count()) > 0,
              "live evidence failed closed",
            );
            const id = await p
              .locator("[data-case-id]")
              .first()
              .getAttribute("data-case-id");
            await p.locator("[data-case-id]").first().click();
            assert.equal(
              await p.locator("#vl-case").getAttribute("data-case"),
              id,
            );
            await capture(p, "live-current-case");
            await p.goto("http://127.0.0.1:4189/bag/" + oldId, {
              waitUntil: "networkidle",
            });
            assert.equal(new URL(p.url()).pathname, "/bag/" + oldId);
            assert.equal(await p.locator("[data-case]").count(), 0);
            const last = live.requests
              .filter((r) => r.path === "/api/bag/" + oldId)
              .at(-1);
            assert.equal(last.body.bag.id, oldId);
            assert.equal(last.status, 200);
            assert.equal(
              await p.locator("#vl-case").getAttribute("data-historical-state"),
              "HISTORICAL_SOURCE_ONLY",
            );
            await capture(p, "live-historical-source");
            assert.deepEqual(live.errors, []);
            live.verdict = "PASS_WITH_HISTORICAL_BLOCKER";
          } finally {
            await c.close();
            fs.writeFileSync(
              path.join(out, "live-summary.json"),
              JSON.stringify(live, null, 2) + "\n",
            );
          }
        },
      );
    assert.deepEqual(report.errors, []);
    report.verdict = "PASS_SCOPED_WITH_HISTORICAL_BLOCKER";
    console.log("A1_1_BROWSER_PASS " + report.checks.length);
  } finally {
    await b.close();
    for (const s of servers) await new Promise((resolve) => s.close(resolve));
    fs.writeFileSync(
      path.join(out, "browser-summary.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
