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
  await expect(page.getByText(/official Blockscout UI conflict is documented/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /investigate/i })).toBeInViewport();
  await page.getByRole('button', { name: /investigate/i }).click();
  await page.getByRole('button', { name: /skip retrieval/i }).click();
  await expect(page.getByTestId('investigation')).toBeVisible();
  await expect(page.getByRole('link', { name: /frozen independent proof manifest/i })).toHaveAttribute('href', /55af899617fc38af71b746e3e90a9f2de3e6e53a/);
  await expect(page.getByText(/official Blockscout transaction UI displayed an unrelated record/i)).toBeVisible();
  await page.getByRole('button', { name: /explore fictional rat trap demo/i }).click();
  await page.getByRole('button', { name: /select fictional funder/i }).click();
  await expect(page.getByTestId('funding-transfer')).toHaveCount(4);
  await page.getByRole('button', { name: '7d', exact: true }).click();
  await expect(page.getByTestId('thermometer-output')).toContainText('1 / 3');
  await expect(page.getByTestId('thermometer-output')).toContainText('1 / 1');
  await page.getByRole('button', { name: /unfold small relationship view/i }).click();
  await expect(page.getByTestId('relationship-map')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/screenshots/published-mobile-390.png', fullPage: true });
  await page.evaluate(() => history.back());
  await expect(page.getByTestId('investigation')).toBeVisible();
  await page.evaluate(() => history.forward());
  await expect(page.getByTestId('relationship-map')).toBeVisible();
  await page.getByRole('button', { name: /back to verified receipt/i }).click();
  await page.getByRole('button', { name: /back to fresh garbage/i }).click();
  await expect(page.getByTestId('discovery')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
