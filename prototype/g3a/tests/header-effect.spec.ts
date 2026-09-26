import { expect, test } from '@playwright/test';

test('desktop hero has restrained animated field without blocking navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('./');
  const field = page.getByTestId('hero-flow-mask');
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.rat-stage img')).toHaveAttribute('src', './rat-original.jpg');
  expect(await field.locator('.hero-flow').count()).toBe(3);
  expect(await page.locator('video, canvas').count()).toBe(0);

  const anim = await field.locator('.hero-flow--warm').evaluate(
    el => getComputedStyle(el).animationName
  );
  expect(anim).toBe('slow-ember');

  const poster = page.locator('.poster');
  const rect = await poster.boundingBox();
  if (!rect) throw new Error('poster must have visible bounds');
  await page.mouse.move(rect.x + rect.width * .25, rect.y + rect.height * .43);
  await expect.poll(() => poster.evaluate(el => el.style.getPropertyValue('--flow-x')))
    .not.toBe('');

  await expect(page.getByRole('button', { name: /enter rat radar/i })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'evidence/screenshots/g4r-header-effect-1440.png', fullPage: true });

  await page.getByRole('button', { name: /enter rat radar/i }).click();
  await expect(page.getByTestId('radar')).toBeVisible();
  await expect(page.getByTestId('hero-flow-mask')).toHaveCount(0);
});

for (const width of [390, 320] as const) {
  test('mobile hero keeps the illustration and primary action usable at ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./');
    await expect(page.getByTestId('hero-flow-mask')).toBeVisible();
    await expect(page.locator('.rat-stage img')).toBeVisible();
    await expect(page.getByRole('button', { name: /enter rat radar/i })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'evidence/screenshots/g4r-header-effect-' + width + '.png', fullPage: true });
    await page.getByRole('button', { name: /enter rat radar/i }).click();
    await expect(page.getByTestId('radar')).toBeVisible();
  });
}

test('reduced motion freezes decorative layers and disables pointer-follow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const field = page.getByTestId('hero-flow-mask');
  await expect(field).toBeVisible();
  expect(await field.locator('.hero-flow--warm').evaluate(
    el => getComputedStyle(el).animationName
  )).toBe('none');
  const poster = page.locator('.poster');
  const rect = await poster.boundingBox();
  if (!rect) throw new Error('poster must have visible bounds');
  await page.mouse.move(rect.x + rect.width * .3, rect.y + rect.height * .5);
  expect(await poster.evaluate(el => el.style.getPropertyValue('--flow-x'))).toBe('');
  await expect(page.getByRole('button', { name: /investigate the receipt/i })).toBeVisible();
  await page.getByRole('button', { name: /investigate the receipt/i }).click();
  await expect(page.getByTestId('investigation')).toBeVisible();
});