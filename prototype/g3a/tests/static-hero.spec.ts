import { expect, test } from '@playwright/test';

// The moving canvas and its licensed runtime were deliberately removed.
// Preserve the accessible navigation and responsive placement until the
// approved G6 pixel-art sprites and layered scenery arrive.
for(const width of [1440,390,320] as const) {
  test('static pixel sunset and original rat remain usable at '+width+'px',async ({page})=>{
    await page.setViewportSize({width,height:width===1440?950:844});
    await page.goto('./');
    const sky=page.getByTestId('static-hero-sky');
    await expect(sky).toBeVisible();
    await expect(sky).toHaveAttribute('aria-hidden','true');
    expect(await sky.evaluate(el=>getComputedStyle(el).backgroundImage)).not.toBe('none');
    await expect(page.locator('.rat-stage img')).toHaveAttribute('src','./rat-original.jpg');
    await expect(page.locator('.rat-stage img')).toBeVisible();
    await expect(page.getByRole('heading',{name:/the rat\s*remembers/i})).toBeVisible();
    await expect(page.getByRole('button',{name:/enter rat radar/i})).toBeInViewport();
    await expect(page.getByRole('button',{name:/investigate the receipt/i})).toBeInViewport();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.locator('.grain-wave-sky,.official-grain-host')).toHaveCount(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    if(width<=390){
      const rat=await page.locator('.rat-stage').boundingBox();
      expect(rat).not.toBeNull();
      expect(rat!.y).toBeLessThan(725);
    }
    await page.locator('.poster').screenshot({path:'evidence/screenshots/g6-static-hero-'+width+'.png'});
    await page.getByRole('button',{name:/enter rat radar/i}).click();
    await expect(page.getByTestId('radar')).toBeVisible();
    await expect(page.locator('canvas')).toHaveCount(0);
    const caseFile=page.getByRole('complementary',{name:/selected historical case file/i});
    if(width===1440)await expect(caseFile).toBeVisible();
  });
}
test('reduced-motion respects native static hero and scanner bypass',async ({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});
  await page.goto('./');
  await expect(page.getByTestId('static-hero-sky')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('button',{name:/investigate the receipt/i}).click();
  await expect(page.getByTestId('investigation')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('static hero has no animation, GPU dependency, or obsolete compare mode',async ({page})=>{
  await page.addInitScript(()=>{
    HTMLCanvasElement.prototype.getContext=function(){throw new Error('No canvas supported here');};
  });
  await page.setViewportSize({width:390,height:844});
  await page.goto('./?demo-isolate=1');
  await expect(page.getByTestId('discovery')).toBeVisible();
  await expect(page.getByTestId('static-hero-sky')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.official-grain-host')).toHaveCount(0);
  await expect(page.getByRole('button',{name:/enter rat radar/i})).toBeInViewport();
  await page.getByRole('button',{name:/enter rat radar/i}).click();
  await expect(page.getByTestId('radar')).toBeVisible();
});
