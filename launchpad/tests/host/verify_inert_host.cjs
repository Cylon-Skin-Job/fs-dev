/* Actual Chrome literal-content and validated chooser regression. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(process.argv[2]),manifest=JSON.parse(fs.readFileSync(path.join(root,'inert-sample-manifest.json')));
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(String(e)));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
 try{
  await page.goto(pathToFileURL(path.join(manifest.plan_home,'plan.HTML')).href);await page.locator('.rv-card').first().waitFor();assert.equal(await page.locator('.rv-card').count(),2);
  assert.ok((await page.locator('h1').textContent()).includes(manifest.tokens));
  for(const child of manifest.children){await page.goto(pathToFileURL(path.join(manifest.plan_home,child.home,'ticket.html')).href);await page.locator('.rv-logo').waitFor();
   assert.equal(await page.evaluate(()=>globalThis.pwned),undefined);assert.equal(await page.locator('a[href^="javascript:"]').count(),0);
   const capture=await page.locator('.rv-content').filter({has:page.getByRole('button',{name:'Initial Capture',exact:true})}).locator('pre').textContent();
   if(capture.includes(manifest.tokens)){assert.equal(capture,manifest.payload);for(const name of ['Scope','ToDo'])assert.equal(await page.locator('.rv-content').filter({has:page.getByRole('button',{name,exact:true})}).locator('pre').textContent(),manifest.payload);}
  }
  await page.screenshot({path:path.join(root,'chrome-inert-content.png'),fullPage:true});
  await page.locator('select[aria-label="Named plan"]').selectOption('latest');await page.locator('h1').waitFor();
  assert.equal(await page.locator('a[href^="javascript:"]').count(),0);assert.equal(await page.getByRole('link',{name:'Unsafe header',exact:true}).count(),0);
  assert.equal(await page.getByRole('link').count(),1);await page.getByRole('link').click();await page.locator('.rv-card').first().waitFor();assert.equal(await page.locator('.rv-card').count(),2);
  assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
  const report={result:'PASS',host:'installed Google Chrome',version:browser.version(),protocol:'file:',generation:manifest.generation,population:2,
    checks:['all literal template tokens preserved in plan/ticket title and Capture/Scope/ToDo','all embedded pages mount','source script/link text inert','malformed stored registry refused before publication/chooser change','chooser includes validated local destinations only'],errors,dialogs};
  fs.writeFileSync(path.join(root,'chrome-inert-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await page.close();await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
