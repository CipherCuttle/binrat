import { expect, test } from '@playwright/test';

const expectedWindows = {
  '6h': { eligible: '3 / 3', priced: '2 / 3' },
  '24h': { eligible: '3 / 3', priced: '2 / 3' },
  '3d': { eligible: '2 / 3', priced: '2 / 2' },
  '7d': { eligible: '1 / 3', priced: '1 / 1' }
} as const;

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 }
]) {
  test(`fictional Rat Trap journey is complete and bounded at ${viewport.width}px`, async ({ page }) => {
    const fitsViewport = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    await page.setViewportSize(viewport);
    await page.goto('./');

    await page.getByRole('button', { name: /investigate/i }).click();
    await page.getByRole('button', { name: /skip retrieval/i }).click();
    await expect(page.getByTestId('investigation')).toBeVisible();

    await page.getByRole('button', { name: /explore fictional rat trap demo/i }).click();
    await expect(page.getByTestId('rat-trap')).toBeVisible();
    await expect(page.getByRole('heading', { name: /who fed the mold/i })).toBeFocused();
    await expect(page.getByText('DEMO — FICTIONAL SCENARIO')).toBeVisible();
    await expect(page.getByText(/nothing here belongs to the historical pons receipt/i)).toBeVisible();
    expect(await fitsViewport()).toBe(true);

    const funder = page.getByRole('button', { name: /select fictional funder/i });
    await funder.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('rat-trap-reveal')).toBeVisible();
    await expect(page.getByRole('heading', { name: /one funder. four transfers/i })).toBeFocused();
    await expect(page.getByTestId('funding-transfer')).toHaveCount(4);

    for (const launch of ['MOLD', 'GRIME', 'SLUDGE', 'DUST']) {
      await expect(page.getByTestId('funding-transfer').filter({ hasText: launch })).toHaveCount(1);
    }

    const thermometer = page.getByTestId('thermometer-output');
    for (const [window, counts] of Object.entries(expectedWindows)) {
      await page.getByRole('button', { name: window, exact: true }).click();
      await expect(thermometer).toContainText(counts.eligible);
      await expect(thermometer).toContainText(counts.priced);
    }

    await expect(page.getByText('PRICE UNKNOWN · no simulated headline data')).toBeVisible();
    await expect(page.getByText(/exit liquidity unknown/i).first()).toBeVisible();
    await expect(page.getByText(/doesn.t prove shared ownership, safety or profitability/i)).toBeVisible();
    expect(await fitsViewport()).toBe(true);

    await page.getByRole('button', { name: /unfold small relationship view/i }).click();
    await expect(page.getByTestId('relationship-map')).toBeVisible();
    await expect(page.getByRole('heading', { name: /shared address, not shared owner/i })).toBeFocused();
    expect(await fitsViewport()).toBe(true);

    await page.getByRole('button', { name: /back to verified receipt/i }).click();
    await expect(page.getByTestId('investigation')).toBeVisible();
    await page.getByRole('button', { name: /back to fresh garbage/i }).click();
    await expect(page.getByTestId('discovery')).toBeVisible();
  });
}
