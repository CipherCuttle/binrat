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
const { chromium } = runner("playwright"),
  f = JSON.parse(fs.readFileSync("docs/receipts/sprint-a2/specimen.json"));
const out = path.resolve(
  process.env.BINRAT_A2_OUTPUT || ".artifacts/a2/browser",
);
fs.mkdirSync(out, { recursive: true });
const report = {
  verdict: "FAIL",
  source: "COMPILED_REPLAY_OF_ACTUAL_CAPTURED_PRODUCTION_D1",
  capturedAt: f.capturedAt,
  controls: "EXPLICIT_SIMULATED_STALE_503_BAD_DIGEST",
  checks: [],
  errors: [],
  screenshots: [],
  requests: [],
};
const id = f.caseId,
  current = f.currentEnvelope.material.caseId,
  base = "http://127.0.0.1:4205";
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log("PASS " + name);
}
async function capture(p, name) {
  await p.screenshot({ path: path.join(out, name + ".png") });
  report.screenshots.push(name + ".png");
}
async function noOverflow(p, w) {
  assert.ok(
    (await p.evaluate(() => document.documentElement.scrollWidth)) <= w + 1,
    "overflow at " + w,
  );
}
async function ctx(browser, w, h) {
  const c = await browser.newContext({
    viewport: { width: w, height: h },
    reducedMotion: "reduce",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  c.on("page", (p) => {
    p.on("pageerror", (e) => report.errors.push(e.message));
    p.on("request", (r) => {
      report.requests.push({ url: r.url(), method: r.method() });
      assert.equal(r.method(), "GET");
      assert.ok(
        ["http://127.0.0.1:4204", base].includes(new URL(r.url()).origin),
      );
    });
    p.on("response", (r) => {
      if (!new URL(r.url()).pathname.startsWith("/api/") && r.status() >= 400)
        report.errors.push("ASSET_" + r.status() + " " + r.url());
    });
  });
  return c;
}
async function visit(c, url) {
  const p = await c.newPage();
  await p.clock.install({ time: new Date(f.capturedAt) });
  await p.goto(url, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  return p;
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [w, h] of [
      [1440, 900],
      [390, 844],
      [320, 800],
      [430, 900],
      [1024, 900],
    ])
      await check(
        "compiled A1/A2 comparison and interaction " + w,
        async () => {
          const c = await ctx(browser, w, h),
            before = await visit(c, "http://127.0.0.1:4204/bag/" + id);
          await capture(before, "a1-" + w + "-historical");
          await noOverflow(before, w);
          await before.close();
          const p = await visit(c, base + "/bag/" + id);
          const brief = p.locator(".a2-outcome-brief");
          await brief.waitFor();
          assert.match(await brief.innerText(), /11 of 11 earlier launches/);
          assert.match(await brief.innerText(), /1 have a recorded GRADUATED/);
          assert.match(await brief.innerText(), /UNKNOWN|PARTIAL/);
          assert.match(await p.locator("body").innerText(), /FRESH_VERIFIED/);
          await capture(p, "a2-" + w + "-why");
          await brief.scrollIntoViewIfNeeded();
          await capture(p, "a2-" + w + "-finding");
          await noOverflow(p, w);
          await p.getByRole("tab", { name: /TRAIL/ }).click();
          assert.equal(await p.locator(".a2-outcome-trail > li").count(), 11);
          const graduated = p
            .locator(".a2-outcome-trail > li")
            .filter({ hasText: "GRADUATED" });
          assert.equal(await graduated.count(), 1);
          assert.match(
            await graduated.innerText(),
            /5m target: CURVE.*1h target: CURVE.*24h target: GRADUATED/,
          );
          await graduated.scrollIntoViewIfNeeded();
          await capture(p, "a2-" + w + "-trail");
          await graduated.locator("summary").click();
          assert.match(await graduated.innerText(), /V4 pool state is missing/);
          assert.match(await graduated.innerText(), /receipt [0-9a-f]{64}/);
          await noOverflow(p, w);
          await p.getByRole("tab", { name: /RECEIPTS/ }).click();
          await p.locator(".a2-outcome-proof summary").click();
          assert.match(
            await p.locator(".a2-outcome-proof").innerText(),
            /not independent RPC proofs/,
          );
          await noOverflow(p, w);
          await capture(p, "a2-" + w + "-receipts");
          await p.getByRole("tab", { name: /WHY/ }).click();
          await p.getByRole("tab", { name: /WHY/ }).focus();
          await p.keyboard.press("ArrowRight");
          assert.equal(
            await p
              .getByRole("tab", { name: /TRAIL/ })
              .getAttribute("aria-selected"),
            "true",
          );
          await c.close();
        },
      );
    await check(
      "current Case comparison, exact sharing and discovery",
      async () => {
        const c = await ctx(browser, 390, 844),
          b = await visit(c, "http://127.0.0.1:4204/bag/" + current);
        await capture(b, "a1-390-current");
        await b.close();
        const p = await visit(c, base + "/bag/" + current);
        await p.locator(".a2-outcome-brief").waitFor();
        assert.match(
          await p.locator(".a2-outcome-brief").innerText(),
          /outcomes are unknown/,
        );
        await capture(p, "a2-390-current");
        await p.getByRole("button", { name: /COPY.*CASE|COPY.*LINK/i }).click();
        assert.equal(
          await p.evaluate(() => navigator.clipboard.readText()),
          base + "/bag/" + current,
        );
        await p.goto(base, { waitUntil: "networkidle" });
        assert.match(await p.locator("body").innerText(), /Rat Zero/i);
        await p.locator(".a1-crew summary").click();
        assert.match(
          await p.locator(".a1-crew-content").innerText(),
          /TRIPWIRE.*BUILDING/s,
        );
        await p.keyboard.press("Escape");
        assert.equal(await p.locator(".a1-crew").getAttribute("open"), null);
        await capture(p, "a2-390-discovery");
        await p.getByRole("button", { name: /SHOW ALL/ }).click();
        await p.locator('[data-case-id="' + current + '"]').click();
        await p.locator(".a2-outcome-brief").waitFor();
        assert.equal(new URL(p.url()).pathname, "/bag/" + current);
        await c.close();
      },
    );
    await check("expiry preserves samples but pauses freshness", async () => {
      const c = await ctx(browser, 390, 844),
        p = await visit(c, base + "/bag/" + id);
      await p.locator(".a2-outcome-brief").waitFor();
      await p.clock.fastForward(600001);
      await p.evaluate(() => window.dispatchEvent(new Event("pageshow")));
      assert.match(
        await p.locator(".a2-outcome-brief").innerText(),
        /UPDATES PAUSED/,
      );
      assert.match(await p.locator("body").innerText(), /STALE_VERIFIED/);
      await capture(p, "a2-390-stale-control");
      await c.close();
    });
    for (const mode of ["503", "digest"])
      await check(
        "outcome " + mode + " fails closed with Case still separate",
        async () => {
          const c = await ctx(browser, 390, 844);
          await c.route("**/evidence?include=outcomes", async (route) => {
            if (mode === "503")
              await route.fulfill({
                status: 503,
                contentType: "application/json",
                body: '{"error":"EXPLICIT_TEST_CONTROL"}',
              });
            else {
              const r = await route.fetch(),
                v = await r.json();
              v.digest = "f".repeat(64);
              await route.fulfill({ response: r, json: v });
            }
          });
          const p = await visit(c, base + "/bag/" + id);
          await p
            .getByText(/Outcome evidence unavailable at this checkpoint/)
            .waitFor();
          assert.equal(await p.locator(".a2-outcome-brief").count(), 0);
          assert.match(
            await p.locator("body").innerText(),
            /WHY HE BROUGHT IT/,
          );
          await c.close();
        },
      );
    await check("late response cannot replace another exact Case", async () => {
      const c = await ctx(browser, 390, 844);
      await c.route(
        "**/bag/" + id + "/evidence?include=outcomes",
        async (route) => {
          const r = await route.fetch();
          await new Promise((resolve) => setTimeout(resolve, 1000));
          try {
            await route.fulfill({ response: r });
          } catch {}
        },
      );
      const p = await visit(c, base + "/bag/" + id);
      await p.evaluate((next) => {
        history.pushState(null, "", "/bag/" + next);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }, current);
      await p
        .locator('.a2-outcome-brief[data-outcome-case="' + current + '"]')
        .waitFor();
      await p.waitForTimeout(1100);
      assert.equal(
        await p.locator(".a2-outcome-brief").getAttribute("data-outcome-case"),
        current,
      );
      await c.close();
    });
    assert.deepEqual(report.errors, []);
    report.verdict = "PASS";
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(out, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
