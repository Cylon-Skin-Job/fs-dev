/* Real installed visible Chrome proof from canonical A11 public snapshots. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
module.exports=async function(root){
 const {chromium}=require('playwright'),manifest=JSON.parse(fs.readFileSync(path.join(root,'a11-host-manifest.json'),'utf8'));
 const browser=await chromium.launch({executablePath:process.env.LP_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],network=[],observations=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!r.url().startsWith('file:'))network.push(r.url());});
 try{
  for(const stage of manifest.stages){
   assert.equal(crypto.createHash('sha256').update(fs.readFileSync(stage.path)).digest('hex'),stage.page_sha256);
   await page.goto(pathToFileURL(stage.path).href);await page.locator('.rv-logo').waitFor();assert.equal(await page.evaluate(()=>LPHost.model.generation),stage.generation);
   const row=page.locator('[data-attempt-uuid="'+stage.attempt_uuid+'"]');await row.waitFor();assert.equal(await row.getAttribute('data-symbol'),stage.icon);assert.equal(await row.getAttribute('data-run-state'),'returned');
   const accepted=!['returned','passed-unaccepted','terminal-returned'].includes(stage.label);assert.equal(await row.getAttribute('data-parent-accepted'),String(accepted));
   if(stage.label==='acknowledged-next')assert.match(await row.textContent(),/next acknowledged start/);
   if(stage.label==='failed-next')assert.match(await page.locator('.rv-workflow').textContent(),/Dispatch failed/);
   if(stage.owner_uuid)assert.equal(await page.locator('[data-node-uuid="'+stage.owner_uuid+'"]').first().getAttribute('data-gate-symbol'),stage.owner_icon);
   await row.scrollIntoViewIfNeeded();const screenshot=path.join(root,'chrome-a11-'+stage.label+'.png');await page.screenshot({path:screenshot,fullPage:true});
   await row.click();assert.match(await page.locator('dialog').textContent(),/returned/);await page.getByRole('button',{name:'Pin revision',exact:true}).click();assert.match(await page.locator('dialog').textContent(),/Pinned historical revision/);
   await page.reload();assert.equal(await page.evaluate(()=>LPHost.model.generation),stage.generation);assert.match(await page.locator('dialog').textContent(),/Pinned historical revision/);
   await page.getByRole('button',{name:'Show current',exact:true}).click();assert.match(await page.locator('dialog').textContent(),/Current captured revision/);await page.getByRole('button',{name:'Close',exact:true}).click();
   observations.push({...stage,screenshot,text:await row.textContent()});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const result={result:'PASS',host:'installed visible Google Chrome',version:browser.version(),protocol:'file:',observations,errors,network,limits:manifest.limits};fs.writeFileSync(path.join(root,'chrome-a11-host-report.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
 }finally{await context.close();await browser.close();}
};
