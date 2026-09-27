import { expect, test } from '@playwright/test';

test('desktop: official licensed Grain Wave island is the only moving hero sky',async ({page})=>{
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1440,height:950});
  await page.goto('./');
  const sky=page.getByTestId('grain-wave-sky');
  const host=page.getByTestId('official-grain-host');
  await expect(sky).toBeVisible();
  await expect(sky).toHaveAttribute('aria-hidden','true');
  await expect(host).toHaveAttribute('data-grain-runtime','official-mounted');
  await expect(page.locator('.rat-stage img')).toHaveAttribute('src','./rat-original.jpg');
  await expect(host.locator('canvas')).toBeVisible({timeout:15000});
  const frameA = await host.screenshot({path:'evidence/screenshots/r4-official-1440-phase-a.png'});
  await page.waitForTimeout(1600);
  const frameB = await host.screenshot({path:'evidence/screenshots/r4-official-1440-phase-b.png'});
  expect(frameA.equals(frameB),'Official shader should change actual rendered pixels within 1.6s').toBe(false);
  await expect(page.getByRole('button',{name:/enter rat radar/i})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:/enter rat radar/i}).click();
  await expect(page.getByTestId('radar')).toBeVisible();
  await expect(page.getByTestId('official-grain-host')).toHaveCount(0);
  const paper=page.getByRole('complementary',{name:/selected historical case file/i});
  await expect(paper).toBeVisible();
  expect(await paper.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
});
for(const width of [390,320] as const){
  test('mobile: official effect rendered and primary actions usable at '+width+'px',async ({page})=>{
    test.setTimeout(60000);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width,height:844});
    await page.goto('./');
    const host=page.getByTestId('official-grain-host');
    await expect(host).toHaveAttribute('data-grain-runtime','official-mounted');
    await expect(host.locator('canvas')).toBeVisible({timeout:15000});
    await expect(page.locator('.rat-stage img')).toBeVisible();
    await expect(page.getByRole('heading',{name:/the rat\s*remembers/i})).toBeVisible();
    await expect(page.getByRole('button',{name:/enter rat radar/i})).toBeInViewport();
    await expect(page.getByRole('button',{name:/investigate the receipt/i})).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const frameA=await host.screenshot({path:'evidence/screenshots/r4-official-'+width+'-phase-a.png'});
    await page.waitForTimeout(1500);
    const frameB=await host.screenshot({path:'evidence/screenshots/r4-official-'+width+'-phase-b.png'});
    expect(frameA.equals(frameB),'Official shader must animate at '+width+'px').toBe(false);
    await page.getByRole('button',{name:/enter rat radar/i}).click();
    await expect(page.getByTestId('radar')).toBeVisible();
    await expect(page.getByTestId('official-grain-host')).toHaveCount(0);
  });
}
test('reduced motion: no WebGL animation, readable fallback sunset',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('./');
  const sky=page.getByTestId('grain-wave-sky');
  await expect(sky).toBeVisible();
  await expect(page.getByTestId('official-grain-host')).toHaveAttribute('data-grain-runtime','reduced-motion');
  await expect(page.getByTestId('official-grain-host').locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:/the rat\s*remembers/i})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.poster').screenshot({path:'evidence/screenshots/r4-official-reduced-390.png'});
  await page.getByRole('button',{name:/investigate the receipt/i}).click();
  await expect(page.getByTestId('investigation')).toBeVisible();
});
