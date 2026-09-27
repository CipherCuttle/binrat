import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const widths = [1440, 390, 320] as const;
const receiptUrl = 'https://robinscan.io/tx/0x44d2bdc412ebe6ce0c25600a16adb229b1bd5c22a41267823b0db39161c6e1cb';

// This suite checks navigation, evidence and accessibility—not GPU rendering.
// The dedicated header-effect suite exercises actual official shader motion.


for (const width of widths) {
  test('cinematic world → Radar → case file works at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto('./');

    await expect(page.getByTestId('discovery')).toBeVisible();
    await expect(page.getByRole('heading', { name: /the rat\s*remembers/i })).toBeVisible();
    await expect(page.locator('.rat-stage img')).toHaveAttribute('src', './rat-original.jpg');
    await page.screenshot({ path: 'evidence/screenshots/g4r-world-' + width + '.png', fullPage: true });

    const enter = page.getByRole('button', { name: /enter rat radar/i });
    await expect(enter).toBeInViewport();
    await enter.click();
    await expect(page.getByTestId('radar')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Observed launches' })).toBeVisible();
    await expect(page.locator('.launch-row')).toHaveCount(1);
    await expect(page.getByText(/not a comprehensive list or live rankings/i)).toBeVisible();
    const caseFile = page.getByRole('complementary', { name: /selected historical case file/i });
    if (width <= 760) {
      await expect(caseFile).toBeHidden();
    } else {
      await expect(caseFile).toBeVisible();
    }
    await page.screenshot({ path: 'evidence/screenshots/g4r-radar-' + width + '.png', fullPage: true });

    await page.getByRole('button', { name: /Pons V2 · native ETH pair/i }).click();
    await expect(caseFile).toBeVisible();
    await expect(page.locator('.radar-case h2')).toBeFocused();
    await expect(caseFile.getByText('Unknown')).toBeVisible();
    await expect(caseFile.getByRole('link', { name: /open original source/i })).toHaveAttribute('href', receiptUrl);
    await page.screenshot({ path: 'evidence/screenshots/g4r-case-' + width + '.png', fullPage: true });

    await page.getByRole('button', { name: /scan the archived receipt/i }).click();
    await expect(page.getByTestId('retrieval')).toBeVisible();
    await expect(page.getByText(/preloaded fixture playback only/i)).toBeVisible();
    await page.getByRole('button', { name: /skip retrieval/i }).click();
    await expect(page.getByTestId('investigation')).toBeVisible();
    await expect(page.getByRole('link', { name: /frozen independent proof manifest/i })).toHaveAttribute('href', /55af899617fc38af71b746e3e90a9f2de3e6e53a/);
    await expect(page.getByText(/official Blockscout transaction UI displayed an unrelated record/i)).toBeVisible();
    await page.screenshot({ path: 'evidence/screenshots/g4r-dossier-' + width + '.png', fullPage: true });

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: /explore fictional rat trap demo/i }).click();
    await expect(page.getByText(/nothing here belongs to the historical Pons receipt/i)).toBeVisible();
    await page.getByRole('button', { name: /inspect fictional funder/i }).click();
    await expect(page.getByTestId('funding-transfer')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('mobile case file returns to the list without losing its evidence source', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('./');
  await page.getByRole('button', { name: /enter rat radar/i }).click();
  await page.locator('.launch-row').click();
  await page.getByRole('button', { name: /back to observed launches/i }).click();
  await expect(page.getByRole('heading', { name: 'Observed launches' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.launch-row').click();
  await expect(page.getByRole('link', { name: /open original source/i })).toHaveAttribute('href', receiptUrl);
  await page.evaluate(() => history.back());
  await expect(page.getByTestId('discovery')).toBeVisible();
  await page.evaluate(() => history.forward());
  await expect(page.getByTestId('radar')).toBeVisible();
});

test('world and Radar have no automatically detectable axe violations at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  let result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
  await page.getByRole('button', { name: /enter rat radar/i }).click();
  result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
  await page.locator('.launch-row').click();
  result = await new AxeBuilder({ page }).analyze();
  expect(result.violations, JSON.stringify(result.violations, null, 2)).toEqual([]);
});