/* Isolated Pons 4663 bento preview. Deterministic synthetic contracts only:
 * no RPC, no D1, no wallet and NO inference that this fixture is live. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const base=(process.env.BINRAT_PREVIEW_URL??"http://127.0.0.1:4174").replace(/\/$/,"");
const captures=path.resolve(__dirname,"../browser-artifacts/pons-preview");
fs.mkdirSync(captures,{recursive:true});
const factory="0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const hash="0x89a27da6f703e0a7cdd4f233e7cb57604ff75b164530962d3ff7cf8483a67d84";
const blockHash="0x"+"a".repeat(64);
const creator="0x"+"b".repeat(40);
function sample(id,block,deployer,prior){
  return {id:id.toString(16).padStart(64,"0"),token:"0x"+(100+id).toString(16).padStart(40,"0"),
    curve:"0x"+(200+id).toString(16).padStart(40,"0"),deployer,pairToken:"0x"+"0".repeat(40),
    blockNumber:String(block),blockHash,txHash:"0x"+id.toString(16).padStart(64,"0"),logIndex:id,
    launchConfigId:"0",metadata:{status:"DIRECT_FACTORY_INPUT",name:"Synthetic "+id,
      symbol:"TEST"+id,logo:null,description:null,website:null,telegram:null,twitter:null},
    previousFromSameDeployerWithinWindow:prior};
}
const fixture={schemaVersion:"binrat.pons-preview/0.1",chainId:4663,factory,
  factoryRuntimeCodeHash:hash,authorityId:"ROBINHOOD_PONS_V2_FACTORY_2026_08_03_R1",
  generatedAt:new Date().toISOString(),asOfBlock:"650",asOfBlockHash:blockHash,
  scannedFromBlock:"500",confirmationDepth:12,historyCoverage:"RECENT_WINDOW_ONLY",
  metadataCoverage:"DIRECT_FACTORY_INPUT_ONLY",fundingCoverage:"NOT_COLLECTED",
  launches:[sample(3,620,creator,1),sample(2,610,"0x"+"c".repeat(40),0),sample(1,600,creator,0)]};
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [390,1440]){
    const ctx=await browser.newContext({viewport:{width,height:850},deviceScaleFactor:1,reducedMotion:"reduce"});
    const page=await ctx.newPage();let apiCalls=0;
    await page.route("**/api/**",async route=>{apiCalls++;
      await route.fulfill({status:503,body:"{ }",contentType:"application/json"});});
    await page.route("**/pons-preview-snapshot.json",async route=>
      route.fulfill({status:200,body:JSON.stringify(fixture),contentType:"application/json"}));
    try{
      await page.goto(base+"/index.html?experiment=bento-v1&source=pons#/",{waitUntil:"domcontentloaded"});
      await page.getByTestId("pons-home").waitFor({timeout:12000});
      await page.getByTestId("pons-launch-count").getByText("3").waitFor();
      assert.equal(await page.getByTestId("pons-snapshot-state").innerText(),"CONFIRMED SNAPSHOT");
      assert.equal(await page.getByTestId("pons-portrait-wall").getAttribute("data-visible-tiles"),"3");
      assert.equal(apiCalls,0,"Pons preview never requests the Arc API");
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
      assert.ok(overflow<=1,"Pons home horizontal overflow "+width+": "+overflow);
      await page.screenshot({path:path.join(captures,"fixture-home-"+width+"x850.png"),fullPage:false});
      await page.getByRole("link",{name:/SNIFF THE NEWEST LAUNCH/}).click();
      assert.equal(new URL(page.url()).hash,"#/pons/"+fixture.launches[0].id);
      await page.getByTestId("pons-case").waitFor();
      await page.getByTestId("pons-scan-button").click();
      await page.getByTestId("pons-scan-result").waitFor();
      assert.match(await page.getByTestId("pons-scan-result").innerText(),/FAMILIAR DEPLOYER ADDRESS/);
      assert.equal(await page.getByTestId("pons-creator-matches").getByRole("link").count(),1);
      assert.match(await page.getByTestId("pons-scan-result").innerText(),/FUNDING GRAPH HIDDEN/);
      await page.screenshot({path:path.join(captures,"fixture-scan-"+width+"x850.png"),fullPage:true});
      const links=await page.getByTestId("pons-scan-result").locator('a[href^="https://"]').evaluateAll(xs=>xs.map(x=>x.getAttribute("href")));
      assert.ok(links.some(x=>x.includes("robinhoodchain.blockscout.com/tx/")));
      assert.equal(apiCalls,0);
      console.log("PONS_PREVIEW_MOCK_PASS",width,"real routing, bounded window, no fabricated funding");
    }finally{await ctx.close();}
  }
  const ctx=await browser.newContext({viewport:{width:390,height:850}});
  const page=await ctx.newPage();
  await page.route("**/pons-preview-snapshot.json",async route=>
    route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({...fixture,chainId:5042})}));
  await page.goto(base+"/index.html?experiment=bento-v1&source=pons#/");
  await page.getByTestId("pons-snapshot-unavailable").waitFor();
  assert.match(await page.getByTestId("pons-snapshot-unavailable").innerText(),/SCHEMA_INVALID/);
  await ctx.close();
  console.log("PONS_PREVIEW_FAIL_CLOSED_PASS: invalid-chain JSON rejected");
  fs.writeFileSync(path.join(captures,"README.txt"),
    "Pons preview synthetic Playwright fixture, NOT actual chain observations. "+
    "Actual release snapshot is generated separately from reviewed factory logs with 12 confirmations. "+
    "No simulated funding graph or Arc data substitution.\n");
 }finally{await browser.close();}
})().catch(e=>{console.error("PONS_PREVIEW_SMOKE_FAILED",e);process.exitCode=1;});
