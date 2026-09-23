/* PR23: read-only LIVE candidate against the existing V0 public API.
 * Runs in an isolated local Vite preview; never deploys or writes to production.
 * Public GET responses are proxied through Playwright to preserve same-origin API paths.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, request } = require("playwright");
const { setTimeout: delay } = require("node:timers/promises");

const preview = (process.env.BINRAT_PREVIEW_URL || "http://127.0.0.1:4174").replace(/\/$/, "");
const publicApi = "https://binrat-edge-v0.pettevik.workers.dev";
const output = path.resolve(__dirname, "../browser-artifacts/live-candidate");
const sizes = [
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];
fs.mkdirSync(output, { recursive: true });

async function openLive(page, route) {
  await page.goto(preview + route + (route.includes("?") ? "&" : "?") + "source=live",
    { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() =>
    document.querySelector(".status-cluster")?.textContent?.includes("PUBLIC INDEX READY") ||
    document.querySelector("main")?.textContent?.includes("THE TRAIL WENT COLD."),
  null, { timeout: 25000 });
  assert.match(await page.locator(".status-cluster").innerText(), /PUBLIC INDEX READY/,
    "LIVE adapter failed closed; no demo fallback is acceptable");
  assert.equal((await page.locator(".demo-flag").innerText()).trim(), "PUBLIC LIVE");
}

async function noOverflow(page, label, width) {
  const bounds = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  assert.ok(bounds.doc <= width + 1 && bounds.body <= width + 1,
    label + " horizontal overflow: " + JSON.stringify(bounds));
}

async function capture(page, label, width) {
  await noOverflow(page, label, width);
  assert.equal(await page.locator(".shell-nav nav a").count(), 5,
    label + ": five application destinations required");
  await page.screenshot({
    path: path.join(output, "LIVE-" + label + "-" + width + ".png"),
    fullPage: label === "home" && width === 390,
  });
  process.stdout.write("LIVE PASS " + width + "px " + label + "\n");
}

// Production can briefly publish a fail-closed SYNC_FAILED state while the next
// scheduled cycle catches up. Require two consecutive healthy snapshots within
// a strictly bounded window; log *every* failed sample rather than masking it.
async function requireStablePublicHealth(api) {
  const samples = [];
  let healthyInRow = 0;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const response = await api.get(publicApi + "/api/health");
      const state = response.status() === 200 ? await response.json() : null;
      const ready = Boolean(response.status() === 200 && state?.ok === true &&
        state?.chainId === 5042 && state?.runtimeFresh === true &&
        state?.indexReady === true && state?.liveCaughtUp === true &&
        state?.lastSyncError === null);
      samples.push({
        attempt, http: response.status(), ok: state?.ok ?? false,
        checkpoint: state?.checkpointBlock ?? null,
        lastSyncError: state?.lastSyncError ?? null, ready,
      });
      healthyInRow = ready ? healthyInRow + 1 : 0;
      if (healthyInRow === 2) {
        process.stdout.write("LIVE API HEALTH PASS: " + JSON.stringify(samples) + "\n");
        return state;
      }
    } catch (error) {
      samples.push({ attempt, error: String(error) });
      healthyInRow = 0;
    }
    if (attempt < 5) await delay(8000);
  }
  throw new Error("LIVE_RUNTIME_UNSTABLE: " + JSON.stringify(samples));
}

(async () => {
  const api = await request.newContext({ timeout: 20000 });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    await requireStablePublicHealth(api);

    for (const viewport of sizes) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const failures = [];
      page.on("pageerror", (error) => failures.push("PAGE_ERROR: " + error.message));
      await context.route("**/api/**", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (route.request().method() !== "GET" || !requestUrl.pathname.startsWith("/api/")) {
          failures.push("NON_READ_ONLY_REQUEST: " + route.request().method());
          await route.abort();
          return;
        }
        try {
          const response = await route.fetch({
            url: publicApi + requestUrl.pathname + requestUrl.search,
            timeout: 20000,
          });
          if (!response.ok()) failures.push(requestUrl.pathname + ": HTTP " + response.status());
          await route.fulfill({ response });
        } catch (error) {
          failures.push(requestUrl.pathname + ": " + String(error));
          await route.abort();
        }
      });
      try {
        await openLive(page, "/");
        const bagPath = await page.locator(".latest-file").getAttribute("href");
        assert.match(bagPath || "", /^\/bag\/[0-9a-f]{64}$/i, "real latest bag missing");
        await capture(page, "home", viewport.width);

        await openLive(page, "/radar");
        assert.ok(await page.locator(".radar-row").count() > 0, "no real free Radar shortlist");
        await capture(page, "radar", viewport.width);

        await openLive(page, bagPath);
        await page.waitForFunction(() => {
          const node = document.querySelector(".replay-proof-meta");
          return node?.querySelector(".checkpoint-rail") || node?.querySelector('[role="alert"]');
        }, null, { timeout: 20000 });
        assert.equal(await page.locator(".replay-proof-meta [role=alert]").count(), 0,
          "canonical LIVE Replay unavailable for selected bag");
        assert.equal(await page.locator(".replay-proof-meta .checkpoint-rail").count(), 1,
          "real replay proof not present");
        const creatorPath = await page.locator(".creator-file .text-link").getAttribute("href");
        assert.match(creatorPath || "", /^\/creator\/0x[0-9a-f]{40}$/i);
        await capture(page, "bag-replay", viewport.width);

        if (viewport.width === 390) {
          await openLive(page, creatorPath);
          await page.getByRole("heading", { name: "CREATOR FILE", exact: true })
            .waitFor({ timeout: 20000 });
          assert.equal(await page.locator('[role="alert"]').count(), 0,
            "real Creator File lookup failed");
          await capture(page, "creator", viewport.width);
        }

        await openLive(page, "/ledger");
        await page.locator(".route-card > .case-tab.orange").first().waitFor();
        assert.match(await page.locator(".route-card > .case-tab.orange").first().innerText(),
          /PRE_LAUNCH_AUTHORITIES_CONFIGURED.*NOT_LAUNCHED/);
        await page.getByText("CANONICAL PRE-LAUNCH LEDGER RECEIPT").waitFor();
        await capture(page, "ledger", viewport.width);

        assert.deepEqual(failures, [], "LIVE endpoints/browser errors must be visible: " + failures.join("; "));
      } catch (error) {
        await page.screenshot({
          path: path.join(output, "FAILED-LIVE-" + viewport.width + ".png"), fullPage: true,
        }).catch(() => {});
        process.stderr.write("LIVE candidate " + viewport.width + "px: " +
          String(error?.stack || error) + "; upstream=" + failures.join("; ") + "\n");
        throw error;
      } finally {
        await context.close();
      }
    }
    process.stdout.write("READ-ONLY LIVE V2 CANDIDATE: ALL PASS\n");
  } finally {
    await browser.close();
    await api.dispose();
  }
})().catch((error) => {
  process.stderr.write("READ-ONLY LIVE V2 CANDIDATE BLOCKED: " + String(error?.stack || error) + "\n");
  process.exitCode = 1;
});
