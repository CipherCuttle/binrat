import { expect, test } from '@playwright/test';

const publishedUrl = process.env.PUBLISHED_URL;

test.skip(!publishedUrl, 'PUBLISHED_URL is required');

test('published GitHack build completes the primary journey', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let loaded = false;
  for (let attempt = 0; attempt < 6 && !loaded; attempt += 1) {
    const response = await page.goto(publishedUrl!, { waitUntil: 'networkidle' });
    loaded = Boolean(response?.ok());
    if (!loaded) await page.waitForTimeout(5_000);
  }
  expect(loaded).toBe(true);

  // GitHack may show a one-time external-content notice before the proxied
  // branch build. Exercise that real first-visit path instead of bypassing it.
  const openPage = page.getByRole('button', { name: 'Open the page' });
  if (await openPage.isVisible()) {
    await openPage.click();
  }

  await expect(page.getByTestId('discovery')).toBeVisible();
  await expect(page.getByRole('button', { name: /investigate/i })).toBeInViewport();
  await page.getByRole('button', { name: /investigate/i }).click();
  await page.getByRole('button', { name: /skip retrieval/i }).click();
  await expect(page.getByTestId('investigation')).toBeVisible();
  await page.getByRole('button', { name: /back to fresh garbage/i }).click();
  await expect(page.getByTestId('discovery')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/screenshots/published-mobile-390.png', fullPage: true });
});
