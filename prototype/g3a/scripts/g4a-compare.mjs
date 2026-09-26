/**
 * Disposable G4a visual experiment: capture identical historical-fixture stages
 * from the pinned G3c build and G4a build, then render a side-by-side review.
 * Both apps run locally. No live chain traffic or inferred facts.
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const out = resolve('evidence/visual-g4a');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const sources = [
  { name: 'g3c', url: process.env.G3C_URL || 'http://127.0.0.1:4174/' },
  { name: 'g4a', url: process.env.G4A_URL || 'http://127.0.0.1:4173/' }
];
const viewports = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1440', width: 1440, height: 1000 },
  { name: 'mobile-320', width: 320, height: 844 }
];
async function screenshot(page, source, view, stage) {
  await page.screenshot({ path: join(out, source + '-' + view + '-' + stage + '.png'), fullPage: true });
}
try {
  for (const view of viewports) {
    for (const source of sources) {
      const page = await browser.newPage({ viewport: { width: view.width, height: view.height },
        reducedMotion: 'reduce', deviceScaleFactor: 1 });
      const response = await page.goto(source.url, { waitUntil: 'networkidle' });
      if (!response?.ok()) throw Error(source.name + ' preview returned ' + response?.status());
      await page.getByTestId('discovery').waitFor();
      await screenshot(page, source.name, view.name, 'discovery');
      await page.getByRole('button', { name: /investigate/i }).click();
      // Reduced motion immediately reveals the receipt for deterministic comparison.
      await page.getByTestId('investigation').waitFor();
      await screenshot(page, source.name, view.name, 'investigation');
      await page.getByRole('button', { name: /explore fictional rat trap demo/i }).click();
      await page.getByRole('button', { name: /select fictional funder/i }).click();
      await page.getByTestId('rat-trap-reveal').waitFor();
      await screenshot(page, source.name, view.name, 'first-reveal');
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw Error(source.name + ' overflows ' + view.width + 'px at first reveal');
      await page.close();
    }
  }
  for (const view of ['mobile-390', 'desktop-1440', 'mobile-320']) {
    for (const stage of ['discovery', 'investigation', 'first-reveal']) {
      const before = (await readFile(join(out, 'g3c-' + view + '-' + stage + '.png'))).toString('base64');
      const after = (await readFile(join(out, 'g4a-' + view + '-' + stage + '.png'))).toString('base64');
      const mobile = view !== 'desktop-1440';
      const width = mobile ? (view === 'mobile-320' ? 690 : 830) : 1450;
      const eachWidth = mobile ? (view === 'mobile-320' ? 320 : 390) : 700;
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
      await page.setContent(
        '<!doctype html><html lang="en"><meta charset="utf-8"><title>BINRAT G4a evidence</title>' +
        '<style>*{box-sizing:border-box}body{margin:0;background:#e9ece6;color:#25392b;font-family:Arial,sans-serif;padding:14px}' +
        'h1{font-size:20px;margin:4px 0 12px}.grid{display:flex;align-items:start;gap:12px}' +
        '.cell{flex:1;min-width:0}.tag{background:#304a3c;color:white;padding:10px 12px;font-weight:bold}' +
        '.tag.before{background:#5d5265}img{display:block;width:100%;height:auto;object-fit:contain}</style>' +
        '<h1>Same historical fixture · ' + view + ' · ' + stage + '</h1><div class="grid">' +
        '<div class="cell" style="max-width:' + eachWidth + 'px"><div class="tag before">G3c · Underground Arcade</div><img alt="G3c" src="data:image/png;base64,' + before + '"></div>' +
        '<div class="cell" style="max-width:' + eachWidth + 'px"><div class="tag">G4a · Field Instrument</div><img alt="G4a" src="data:image/png;base64,' + after + '"></div></div></html>'
      );
      await page.screenshot({ path: join(out, view + '-' + stage + '-comparison.png'), fullPage: true });
      await page.close();
    }
  }
  console.log('G4a visual comparisons captured at 320, 390 and 1440 px for discovery, investigation and first reveal.');
} finally {
  await browser.close();
}