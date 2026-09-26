import { test } from '@playwright/test';

const evidence = 'evidence/screenshots';

test('capture inspected desktop and mobile states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');
  await page.screenshot({ path: `${evidence}/desktop-discovery.png`, fullPage: true });

  await page.getByRole('button', { name: /investigate/i }).click();
  await page.screenshot({ path: `${evidence}/desktop-retrieval.png`, fullPage: true });
  await page.getByRole('button', { name: /skip retrieval/i }).click();
  await page.screenshot({ path: `${evidence}/desktop-investigation.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /back to fresh garbage/i }).click();
  await page.screenshot({ path: `${evidence}/mobile-390-discovery.png`, fullPage: true });
  await page.getByRole('button', { name: /investigate/i }).click();
  await page.screenshot({ path: `${evidence}/mobile-390-retrieval.png`, fullPage: true });
  await page.getByRole('button', { name: /skip retrieval/i }).click();
  await page.screenshot({ path: `${evidence}/mobile-390-investigation.png`, fullPage: true });

  await page.setViewportSize({ width: 320, height: 844 });
  await page.getByRole('button', { name: /back to fresh garbage/i }).click();
  await page.screenshot({ path: `${evidence}/mobile-320-discovery.png`, fullPage: true });
  await page.getByRole('button', { name: /investigate/i }).click();
  await page.screenshot({ path: `${evidence}/mobile-320-retrieval.png`, fullPage: true });
  await page.getByRole('button', { name: /skip retrieval/i }).click();
  await page.screenshot({ path: `${evidence}/mobile-320-investigation.png`, fullPage: true });
});
