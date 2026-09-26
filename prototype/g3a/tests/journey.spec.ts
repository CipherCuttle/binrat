import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const receiptUrl =
  'https://robinscan.io/tx/0x44d2bdc412ebe6ce0c25600a16adb229b1bd5c22a41267823b0db39161c6e1cb';

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 }
]) {
  test(`mobile discovery fits ${viewport.width}px and keeps action visible`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('./');

    await expect(page.getByTestId('discovery')).toBeVisible();
    await expect(page.getByText('Verified historical snapshot')).toBeVisible();
    await expect(page.getByText('Not live', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /investigate/i })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 }
]) {
  test(`complete journey fits and works at ${viewport.width}px`, async ({ page }) => {
    const fitsViewport = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    await page.setViewportSize(viewport);
    await page.goto('./');

    const source = page.getByRole('link', { name: /view verified receipt/i });
    await expect(source).toBeVisible();
    await expect(source).toHaveAttribute('href', receiptUrl);
    expect(await fitsViewport()).toBe(true);

    await page.getByRole('button', { name: /investigate/i }).click();
    await expect(page.getByTestId('retrieval')).toBeVisible();
    await expect(page.getByRole('heading', { name: /the rat found a receipt/i })).toBeFocused();
    const retrievalSource = page.getByRole('link', { name: /open original robinscan/i });
    await expect(retrievalSource).toBeVisible();
    await expect(retrievalSource).toHaveAttribute('href', receiptUrl);
    await expect(page.getByRole('button', { name: /skip retrieval/i })).toBeInViewport();
    expect(await fitsViewport()).toBe(true);

    await page.getByRole('button', { name: /skip retrieval/i }).click();
    await expect(page.getByTestId('investigation')).toBeVisible();
    await expect(page.getByRole('heading', { name: /pons v2 \/ factory receipt/i })).toBeFocused();
    await expect(page.getByText('Direct funding:')).toBeVisible();
    await expect(page.getByText('Pricing and market cap:')).toBeVisible();
    const dossierSource = page.getByRole('link', { name: /open robinscan source receipt/i });
    await expect(dossierSource).toHaveAttribute('href', receiptUrl);
    expect(await fitsViewport()).toBe(true);

    const back = page.getByRole('button', { name: /back to fresh garbage/i });
    await back.scrollIntoViewIfNeeded();
    await expect(back).toBeInViewport();
    await back.click();
    await expect(page.getByTestId('discovery')).toBeVisible();
  });
}

test('keyboard activates the primary action', async ({ page }) => {
  await page.goto('./');
  const action = page.getByRole('button', { name: /investigate/i });
  await action.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('retrieval')).toBeVisible();
});

test('reduced motion bypasses the animated retrieval', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: /investigate/i }).click();
  await expect(page.getByTestId('investigation')).toBeVisible();
  await expect(page.getByTestId('retrieval')).toHaveCount(0);
});

test('critical screens have no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('./');
  let results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: /investigate/i }).click();
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: /skip retrieval/i }).click();
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: /explore fictional rat trap demo/i }).click();
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: /select fictional funder/i }).click();
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
