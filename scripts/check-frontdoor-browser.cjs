const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { chromium } = require("playwright");

const baseUrl = process.env.BINRAT_FRONTDOOR_URL ?? "http://127.0.0.1:4173";
const artifactDir = "browser-artifacts/frontdoor";
mkdirSync(artifactDir, { recursive: true });

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1000 }
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/?fixtures=1`, { waitUntil: "networkidle" });
      await page.waitForFunction(() =>
        document.body.dataset.mode === "FIXTURE" &&
        document.querySelectorAll("[data-bag-id]").length > 0
      );

      assert.equal((await page.locator("#hero-title").innerText()).replace(/\s+/g, " ").trim(), "THE RAT FOUND SOMETHING. ↗");
      assert.match(await page.locator(".hero .lede").innerText(), /Every new launch looks new/i);
      assert.match(await page.locator(".hero .lede").innerText(), /BINRAT does/i);
      assert.match(await page.locator(".hero .sublede").innerText(), /You don't start from zero/i);

      const primary = page.locator('.hero-actions a[href="#garbage"]');
      const telegram = page.locator('.hero-actions a[href="https://t.me/BinratBot"]');
      assert.equal(await primary.isVisible(), true);
      assert.equal(await telegram.isVisible(), true);

      const selectors = ["#frontdoor-proof", "#garbage", "#telegram", "#roadmap", "#how", "#token-status"];
      const tops = [];
      for (const selector of selectors) {
        const box = await page.locator(selector).boundingBox();
        assert.ok(box, `missing layout box for ${selector}`);
        tops.push(box.y);
      }
      for (let index = 1; index < tops.length; index += 1) {
        assert.ok(tops[index] > tops[index - 1], `frontdoor order drift: ${selectors.join(" -> ")} / ${tops.join(",")}`);
      }

      const proof = await page.locator("#frontdoor-proof").innerText();
      assert.match(proof, /SMELLS FAMILIAR|NO FAMILIAR PAWS YET/i);

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      }));
      assert.ok(
        overflow.scrollWidth <= overflow.innerWidth + 1,
        `horizontal overflow at ${viewport.name}: ${overflow.scrollWidth} > ${overflow.innerWidth}`
      );

      await page.screenshot({
        path: `${artifactDir}/${viewport.name}-${viewport.width}x${viewport.height}.png`,
        fullPage: true
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  console.log("BINRAT frontdoor browser smoke: PASS");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
