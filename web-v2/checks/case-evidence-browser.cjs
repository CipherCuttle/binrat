const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const runner = require("node:module").createRequire(
  path.join(
    process.env.BINRAT_FRONTDOOR_TOOLS ||
      "/tmp/binrat-v3-sprint-runner/node_modules",
    "runner.cjs",
  ),
);
assert.equal(runner("playwright/package.json").version, "1.56.1");
const { chromium } = runner("playwright");
const base = "http://127.0.0.1:4192",
  out = path.resolve(process.env.BINRAT_CASE_OUTPUT || "docs/receipts/sprint-a1-2-ui");
fs.mkdirSync(out, { recursive: true });
const e = JSON.parse(
    fs.readFileSync(
      "docs/receipts/sprint-a1-2-contract/old-case-envelope.json",
    ),
  ),
  id = e.material.caseId;
const sourceCapture = JSON.parse(
  fs.readFileSync("docs/receipts/sprint-a1-2-contract/production-records.json"),
);
const feed = JSON.parse(sourceCapture.snapshot.snapshot_json),
  current = feed.launches[0];
const report = {
  provenance: "COMPILED_LOCAL_FRONTEND_LOCAL_WORKER_CAPTURED_PRODUCTION_D1",
  controls: "EXPLICIT_SIMULATED_ADVERSE_RESPONSES",
  productionEndpointDeployed: false,
  checks: [],
  errors: [],
  requests: [],
  sourceHashes: Object.fromEntries(
    [
      "src/public/caseEvidence.ts",
      "src/cloudflare/publicCaseEvidence.ts",
      "src/cloudflare/worker.ts",
      "web-v2/src/PonsCasePreview.tsx",
      "web-v2/src/historicalCase.ts",
      "web-v2/src/frontdoor-discovery.css",
    ].map((p) => [
      p,
      require("node:crypto")
        .createHash("sha256")
        .update(fs.readFileSync(p))
        .digest("hex"),
    ]),
  ),
  verdict: "FAIL",
};
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log("PASS " + name);
}
async function capture(p, name) {
  await p.screenshot({ path: path.join(out, name + ".png") });
}
async function viewportOK(p, w) {
  assert.ok(
    (await p.evaluate(() => document.documentElement.scrollWidth)) <= w + 1,
    "overflow " + w,
  );
}
async function context(b, w, h) {
  const c = await b.newContext({
    viewport: { width: w, height: h },
    reducedMotion: "reduce",
  });
  c.on("page", (p) => {
    p.on("pageerror", (x) => report.errors.push(x.message));
    p.on("request", (r) => {
      report.requests.push({ url: r.url(), method: r.method() });
      assert.equal(r.method(), "GET");
      assert.equal(new URL(r.url()).origin, base);
    });
    p.on("response", (r) => {
      if (!new URL(r.url()).pathname.startsWith("/api/") && r.status() >= 400)
        report.errors.push("STATIC_" + r.status());
    });
  });
  return c;
}
async function visit(c, route) {
  const p = await c.newPage();
  await p.goto(base + route, { waitUntil: "networkidle" });
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
(async () => {
  const b = await chromium.launch({ headless: true });
  report.browser = b.version();
  try {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
      [320, 800],
      [430, 932],
      [1024, 768],
    ]) {
      const c = await context(b, w, h),
        p = await visit(c, "/bag/" + id);
      await check(
        `${w}: original historical URL, own 19-count WHY and explicit reconstruction`,
        async () => {
          assert.equal(new URL(p.url()).pathname, "/bag/" + id);
          assert.equal(
            await p.locator("#vl-case").getAttribute("data-case"),
            id,
          );
          assert.equal(
            await p.locator("#vl-case").getAttribute("data-projection"),
            "HISTORICAL",
          );
          assert.match(
            await p.locator(".vl-case-intro").innerText(),
            /19 earlier indexed launches in this returned window/,
          );
          assert.match(
            await p.locator(".a12-history-notice").innerText(),
            /not an immutable archived publication or a historical point-in-time replay/,
          );
          assert.equal(
            await p
              .locator("[data-read-state]")
              .first()
              .getAttribute("data-read-state"),
            "STALE_VERIFIED",
          );
          assert.equal(
            await p
              .locator("#vl-case")
              .evaluate((el) => el === document.activeElement),
            true,
          );
          if (w <= 430) {
            const cta = await p
              .locator(".vl-case-intro .vl-primary")
              .boundingBox();
            assert.ok(
              cta.y + cta.height <= h,
              "historical CTA outside first viewport",
            );
          }
          await viewportOK(p, w);
        },
      );
      await capture(p, `historical-${w}x${h}`);
      await check(
        `${w}: meaningful bounded TRAIL and recomputable complete RECEIPTS`,
        async () => {
          await p.getByRole("tab", { name: /TRAIL/ }).click();
          assert.equal(await p.locator(".vl-source-trail li").count(), 20);
          assert.match(
            await p.getByRole("tabpanel").innerText(),
            /not the latest-feed count/,
          );
          assert.equal(
            report.requests.filter((r) => r.url.includes("/api/creator/"))
              .length,
            0,
          );
          await capture(p, `trail-${w}x${h}`);
          await p.getByRole("tab", { name: /RECEIPTS/ }).click();
          await p.locator("summary").click();
          const shown = JSON.parse(await p.locator("pre").innerText());
          assert.equal(shown.digest, e.digest);
          assert.deepEqual(shown, e);
          assert.equal(
            await p
              .getByRole("link", { name: "Canonical Case evidence envelope" })
              .getAttribute("href"),
            "/api/bag/" + id + "/evidence",
          );
          await viewportOK(p, w);
          await capture(p, `receipts-${w}x${h}`);
          await p.reload({ waitUntil: "networkidle" });
          assert.equal(
            await p.locator("#vl-case").getAttribute("data-case"),
            id,
          );
          await p.getByRole("button", { name: "BACK TO DISCOVERY" }).click();
          await p.locator("[data-case-id]").first().click();
          assert.equal(
            await p.locator("#vl-case").getAttribute("data-case"),
            current.launchId,
          );
          assert.equal(
            await p.locator("#vl-case").getAttribute("data-projection"),
            "LATEST",
          );
          await p.goBack();
          assert.equal(await p.locator("#vl-case").count(), 0);
          await p.goBack();
          assert.equal(
            await p.locator("#vl-case").getAttribute("data-case"),
            id,
          );
        },
      );
      await c.close();
    }
    await check(
      "current Case uses latest counts, digest and receipts without requesting historical evidence",
      async () => {
        const c = await context(b, 390, 844),
          start = report.requests.length,
          p = await visit(c, "/bag/" + current.launchId);
        assert.equal(
          await p.locator("#vl-case").getAttribute("data-case"),
          current.launchId,
        );
        await p.getByRole("tab", { name: /RECEIPTS/ }).click();
        await p.locator("summary").click();
        const receipt = JSON.parse(await p.locator("pre").innerText());
        assert.equal(receipt.priorLaunchCount, current.priorLaunchCount);
        assert.equal(receipt.feedDigest, feed.feedDigest);
        assert.ok(
          !report.requests
            .slice(start)
            .some((r) => r.url.endsWith("/evidence")),
        );
        await capture(p, "current-case-regression");
        await c.close();
      },
    );
    for (const name of [
      "field-tamper",
      "wrong-chain",
      "wrong-case",
      "wrong-checkpoint",
      "projection-count",
      "missing-evidence",
      "503-source-only",
      "404-unavailable",
      "unavailable-publication",
    ]) {
      const c = await context(b, 390, 844);
      await c.route("**/api/**", async (r) => {
        const url = new URL(r.request().url());
        if (name === "unavailable-publication")
          return r.fulfill({
            status: 503,
            contentType: "application/json",
            body: "{}",
          });
        if (name === "404-unavailable" && url.pathname.includes("/api/bag/"))
          return r.fulfill({
            status: 404,
            contentType: "application/json",
            body: "{}",
          });
        if (url.pathname.endsWith("/evidence")) {
          if (name === "503-source-only")
            return r.fulfill({
              status: 503,
              contentType: "application/json",
              body: "{}",
            });
          const v = structuredClone(e);
          if (name === "field-tamper")
            v.material.records[0].launch.name = "Injected name";
          if (name === "wrong-chain") v.material.chainId = 5042;
          if (name === "wrong-case") v.material.caseId = "f".repeat(64);
          if (name === "wrong-checkpoint")
            v.material.publication.checkpointBlockHash = "0x" + "f".repeat(64);
          if (name === "projection-count") v.material.priorLaunchCount = 38;
          if (name === "missing-evidence")
            delete v.material.records[0].provenance;
          return r.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(v),
          });
        }
        await r.continue();
      });
      const p = await visit(c, "/bag/" + id);
      await check(
        name + " preserves exact identity and fails closed",
        async () => {
          assert.equal(await p.locator("[data-case]").count(), 0);
          assert.equal(new URL(p.url()).pathname, "/bag/" + id);
          assert.match(await p.locator("#vl-case").innerText(), new RegExp(id));
          assert.equal(
            await p
              .getByRole("link", { name: "CHECK EXACT SOURCE RECORD" })
              .getAttribute("href"),
            "/api/bag/" + id,
          );
          await viewportOK(p, 390);
          await capture(p, name);
        },
      );
      await c.close();
    }
    await check(
      "pending historical proof cannot replace current Case after navigation",
      async () => {
        const c = await context(b, 390, 844);
        let release;
        const gate = new Promise((r) => (release = r));
        await c.route("**/api/bag/" + id + "/evidence", async (r) => {
          await gate;
          await r.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(e),
          });
        });
        const p = await c.newPage();
        await p.goto(base + "/bag/" + id, { waitUntil: "domcontentloaded" });
        await p.locator("[data-historical-state=CHECKING]").waitFor();
        await p.getByRole("button", { name: "BACK TO DISCOVERY" }).click();
        await p.locator("[data-case-id]").first().click();
        release();
        await p.waitForLoadState("networkidle");
        assert.equal(
          await p.locator("#vl-case").getAttribute("data-case"),
          current.launchId,
        );
        await c.close();
      },
    );
    await check(
      "historical evidence 503 recovers only after complete revalidation",
      async () => {
        const c = await context(b, 390, 844);
        let unavailable = true;
        await c.route("**/api/bag/" + id + "/evidence", async (r) => {
          if (unavailable)
            return r.fulfill({
              status: 503,
              contentType: "application/json",
              body: "{}",
            });
          await r.continue();
        });
        const p = await visit(c, "/bag/" + id);
        assert.equal(await p.locator("[data-case]").count(), 0);
        unavailable = false;
        await p.getByRole("button", { name: "RECHECK", exact: true }).click();
        await p.locator("[data-projection=HISTORICAL]").waitFor();
        assert.equal(await p.locator("#vl-case").getAttribute("data-case"), id);
        assert.match(
          await p.locator(".vl-case-intro").innerText(),
          /19 earlier/,
        );
        await c.close();
      },
    );
    await check(
      "explicit fresh-publication control retains historical launch identity and bounded count",
      async () => {
        const c = await context(b, 390, 844);
        const at = e.material.publication.verifiedAtMs;
        // Simulated clock/status control, not a production freshness claim.
        await c.addInitScript((at) => {
          Date.now = () => at + 1000;
        }, at);
        await c.route("**/api/status", (r) =>
          r.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              schemaVersion: "binrat.public-status/0.1",
              state: "FRESH_VERIFIED",
              ...e.material.publication,
              runtimeUpdatedAtMs: at,
              lastSyncError: null,
              freshnessValidUntilMs: at + 60000,
            }),
          }),
        );
        const p = await visit(c, "/bag/" + id);
        assert.equal(
          await p
            .locator("[data-read-state]")
            .first()
            .getAttribute("data-read-state"),
          "FRESH_VERIFIED",
        );
        assert.match(
          await p.locator(".a12-history-notice").innerText(),
          /Publication source checked/,
        );
        assert.match(
          await p.locator(".vl-case-intro").innerText(),
          /19 earlier/,
        );
        assert.equal(await p.locator("#vl-case").getAttribute("data-case"), id);
        await capture(p, "fresh-publication-simulated-control");
        await c.close();
      },
    );
    assert.deepEqual(report.errors, []);
    report.verdict = "PASS";
    console.log("HISTORICAL_CASE_BROWSER_PASS " + report.checks.length);
  } finally {
    await b.close();
    fs.writeFileSync(
      path.join(out, "browser-summary.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
})().catch((x) => {
  console.error(x);
  process.exitCode = 1;
});
