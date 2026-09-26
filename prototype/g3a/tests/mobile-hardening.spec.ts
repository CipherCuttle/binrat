import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const widths = [320, 390, 1440] as const;
const counts = {
  '6h': ['3 / 3', '2 / 3'],
  '24h': ['3 / 3', '2 / 3'],
  '3d': ['2 / 3', '2 / 2'],
  '7d': ['1 / 3', '1 / 1']
} as const;

async function enterTrap(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: /investigate/i }).click();
  await page.getByRole('button', { name: /skip retrieval/i }).click();
  await expect(page.getByTestId('investigation')).toBeVisible();
  await page.getByRole('button', { name: /explore fictional rat trap demo/i }).click();
  await expect(page.getByTestId('rat-trap')).toBeVisible();
}

async function checkAxe(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
}

for (const width of widths) {
  test(`Rat Trap expanded states, keyboard and axe at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await enterTrap(page);
    await expect(page.getByRole('heading', { name: /who fed the mold/i })).toBeFocused();
    await checkAxe(page);
    const funder = page.getByRole('button', { name: /select fictional funder/i });
    await funder.focus();
    await page.keyboard.press('Space');
    await expect(funder).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('heading', { name: /one funder. four transfers/i })).toBeFocused();
    await expect(page.getByTestId('funding-transfer')).toHaveCount(4);
    await checkAxe(page);

    const result = page.getByTestId('thermometer-output');
    for (const [window, expected] of Object.entries(counts)) {
      const button = page.getByRole('button', { name: window, exact: true });
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).toBeFocused();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(result).toContainText(expected[0]);
      await expect(result).toContainText(expected[1]);
    }
    await expect(page.getByText('PRICE UNKNOWN · no simulated headline data')).toBeVisible();
    await checkAxe(page);
    const unfold = page.getByRole('button', { name: /unfold small relationship view/i });
    await unfold.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: /shared address, not shared owner/i })).toBeFocused();
    await expect(page.getByTestId('relationship-map')).toBeVisible();
    await checkAxe(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test(`browser history restores scenes and expanded Rat Trap at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./');
    await page.getByRole('button', { name: /investigate/i }).click();
    await expect(page.getByTestId('retrieval')).toBeVisible();
    await page.evaluate(() => history.back());
    await expect(page.getByTestId('discovery')).toBeVisible();
    await page.evaluate(() => history.forward());
    await expect(page.getByTestId('investigation')).toBeVisible();
    await expect(page.getByTestId('retrieval')).toHaveCount(0);

    await page.getByRole('button', { name: /explore fictional rat trap demo/i }).click();
    await page.getByRole('button', { name: /select fictional funder/i }).click();
    await page.getByRole('button', { name: '7d', exact: true }).click();
    await page.getByRole('button', { name: /unfold small relationship view/i }).click();
    await page.evaluate(() => history.back());
    await expect(page.getByTestId('investigation')).toBeVisible();
    await expect(page.getByRole('button', { name: /explore fictional rat trap demo/i })).toBeFocused();
    await page.evaluate(() => history.forward());
    await expect(page.getByTestId('relationship-map')).toBeVisible();
    await expect(page.getByTestId('thermometer-output')).toContainText('1 / 3');
    await expect(page.getByRole('heading', { name: /shared address, not shared owner/i })).toBeFocused();
    await page.getByRole('button', { name: /back to verified receipt/i }).click();
    await expect(page.getByTestId('investigation')).toBeVisible();
    await page.getByRole('button', { name: /back to fresh garbage/i }).click();
    await expect(page.getByTestId('discovery')).toBeVisible();
  });
}

for (const width of [320, 390] as const) {
  test(`horizontal regions support arrow keys at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await enterTrap(page);
    await page.getByRole('button', { name: /select fictional funder/i }).click();
    const cards = page.getByRole('region', { name: /previous fictional funded launches/i });
    await cards.focus();
    await expect(cards).toBeFocused();
    expect(await cards.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => cards.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    await expect(cards.getByRole('heading', { name: /DUST/i })).toHaveCount(1);
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => cards.evaluate(el => el.scrollLeft)).toBe(0);

    const lanes = page.getByRole('region', { name: /three fictional evidence boundaries/i });
    await lanes.focus();
    expect(await lanes.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => lanes.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    await expect(lanes.getByText('EXIT LIQUIDITY', { exact: true })).toHaveCount(1);
    await checkAxe(page);
  });
}

test('reload of interrupted scan settles on dossier without replay', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /investigate/i }).click();
  await expect(page.getByTestId('retrieval')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('investigation')).toBeVisible();
  await expect(page.getByTestId('retrieval')).toHaveCount(0);
  await page.evaluate(() => history.back());
  await expect(page.getByTestId('discovery')).toBeVisible();
});

test('reduced-motion shortcut remains correct after Back and Forward', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: /investigate/i }).click();
  await expect(page.getByTestId('investigation')).toBeVisible();
  await expect(page.getByTestId('retrieval')).toHaveCount(0);
  await page.evaluate(() => history.back());
  await expect(page.getByTestId('discovery')).toBeVisible();
  await page.evaluate(() => history.forward());
  await expect(page.getByTestId('investigation')).toBeVisible();
});

test('frozen proof provenance and original UNKNOWN limits remain discoverable', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText(/two independent archive RPCs and Robinscan/i)).toBeVisible();
  await page.getByRole('button', { name: /investigate/i }).click();
  await page.getByRole('button', { name: /skip retrieval/i }).click();
  await expect(page.getByRole('link', { name: /frozen independent proof manifest/i })).toHaveAttribute('href', /55af899617fc38af71b746e3e90a9f2de3e6e53a/);
  await expect(page.getByText(/official Blockscout transaction UI displayed an unrelated record/i)).toBeVisible();
  await expect(page.getByText(/does not establish human identity, funding, trading history/i)).toBeVisible();
  await expect(page.getByText(/direct funding:/i)).toBeVisible();
  await expect(page.getByText(/pricing and market cap:/i)).toBeVisible();
  await page.getByRole('button', { name: /explore fictional rat trap demo/i }).click();
  await expect(page.getByText(/nothing here belongs to the historical Pons receipt/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /frozen independent proof manifest/i })).toHaveCount(0);
});
