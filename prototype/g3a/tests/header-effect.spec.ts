import { expect, test } from '@playwright/test';

test('desktop: original Grain Wave stays in the world, behind the rat and copy', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('./');
  const sky = page.getByTestId('grain-wave-sky');
  await expect(sky).toBeVisible();
  await expect(sky).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.rat-stage img')).toHaveAttribute('src', './rat-original.jpg');
  await expect(sky.locator('path.grain-wave-ribbon')).toHaveCount(3);
  await expect(sky.locator('stop[stop-color="#2b1f8f"]')).toHaveCount(1);
  await expect(sky.locator('stop[stop-color="#7b3db3"]')).toHaveCount(2);
  await expect(sky.locator('stop[stop-color="#f7ecc8"]')).toHaveCount(1);
  expect(await page.locator('video, canvas, .hero-flow-mask').count()).toBe(0);
  expect(await sky.locator('.grain-wave-ribbon--violet').evaluate(el => getComputedStyle(el).animationName)).toBe('grain-drift-violet');
  expect(await sky.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  await expect(page.getByRole('button', { name: /enter rat radar/i })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/screenshots/g4r2-grain-world-1440.png', fullPage: true });

  await page.getByRole('button', { name: /enter rat radar/i }).click();
  await expect(page.getByTestId('radar')).toBeVisible();
  await expect(page.getByTestId('grain-wave-sky')).toHaveCount(0);
  const paper = page.getByRole('complementary', { name: /selected historical case file/i });
  await expect(paper).toBeVisible();
  expect(await paper.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  await page.screenshot({ path: 'evidence/screenshots/g4r2-radar-1440.png', fullPage: true });
});

for (const width of [390, 320] as const) {
  test('mobile: subdued wave and usable actions at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./');
    const sky = page.getByTestId('grain-wave-sky');
    await expect(sky).toBeVisible();
    expect(Number(await sky.evaluate(el => getComputedStyle(el).opacity))).toBeLessThan(.8);
    await expect(page.locator('.rat-stage img')).toBeVisible();
    await expect(page.getByRole('heading', { name: /the rat\s*remembers/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /enter rat radar/i })).toBeInViewport();
    await expect(page.getByRole('button', { name: /investigate the receipt/i })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'evidence/screenshots/g4r2-grain-world-' + width + '.png', fullPage: true });
    await page.getByRole('button', { name: /enter rat radar/i }).click();
    await expect(page.getByTestId('radar')).toBeVisible();
    await expect(page.getByTestId('grain-wave-sky')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('reduced-motion: still sunset, stationary grain, no pointer-follow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const sky = page.getByTestId('grain-wave-sky');
  await expect(sky).toBeVisible();
  for (const ribbon of await sky.locator('.grain-wave-ribbon').all()) {
    expect(await ribbon.evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  }
  const poster = page.locator('.poster');
  const rect = await poster.boundingBox();
  if (!rect) throw new Error('poster must have visible bounds');
  await page.mouse.move(rect.x + rect.width * .3, rect.y + rect.height * .5);
  expect(await poster.evaluate(el => el.style.getPropertyValue('--flow-x'))).toBe('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/screenshots/g4r2-grain-still-390.png', fullPage: true });
  await page.getByRole('button', { name: /investigate the receipt/i }).click();
  await expect(page.getByTestId('investigation')).toBeVisible();
  await expect(page.getByTestId('grain-wave-sky')).toHaveCount(0);
});
