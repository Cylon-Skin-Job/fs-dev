/* A10 installed Chrome lifecycle projection reached by the documented host. */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');
module.exports=async function(root){
 const {chromium}=require('playwright');const manifest=JSON.parse(fs.readFileSync(path.join(root,'a10-host-manifest.json'),'utf8'));
 const browser=await chromium.launch({executablePath:process.env.LP_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[],network=[],observations=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!r.url().startsWith('file:'))network.push(r.url());});
 try{
  for(const stage of manifest.stages){
   await page.goto(pathToFileURL(stage.path).href);await page.locator('.rv-logo').waitFor();
   assert.equal(await page.evaluate(()=>LPHost.model.generation),stage.generation);
   const job=page.locator('[data-job-uuid="'+stage.job_uuid+'"]');await job.waitFor();const text=await job.textContent();
   if(stage.label==='failed-dispatch'){assert.match(text,/Dispatch failed/);assert.match(text,/Missing acknowledged start/);assert.equal(await job.locator('[data-attempt-uuid]').count(),0);}
   else{
    const attempt=job.locator('[data-attempt-uuid="'+stage.attempt_uuid+'"]');await attempt.waitFor();const state=stage.label.includes('running')?'running':'claimed';
    assert.equal(await attempt.getAttribute('data-run-state'),state);assert.equal(await attempt.getAttribute('data-symbol'),'progress_activity');
    assert.match(await attempt.textContent(),state==='running'?/acknowledged start/:/claim only; start missing/);
    if(stage.label.startsWith('replacement')){assert.match(await attempt.textContent(),/replacement of/);assert.equal(await job.locator('[data-run-state="abandoned"]').count(),1);}
   }
   await (stage.attempt_uuid?job.locator('[data-attempt-uuid="'+stage.attempt_uuid+'"]'):job).scrollIntoViewIfNeeded();
   const shot=path.join(root,'chrome-a10-'+stage.label+'.png');await page.screenshot({path:shot,fullPage:true});
   observations.push({...stage,text,screenshot:shot});
   await job.getByRole('button',{name:'Stored slice briefing',exact:true}).click();assert.match(await page.locator('dialog').textContent(),/A10 exact assigned work/);await page.getByRole('button',{name:'Close',exact:true}).click();
   await page.reload();assert.equal(await page.evaluate(()=>LPHost.model.generation),stage.generation);
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const report={result:'PASS',host:'installed Google Chrome',version:browser.version(),protocol:'file:',observations,errors,network,limits:manifest.limits};
  fs.writeFileSync(path.join(root,'chrome-a10-host-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await context.close();await browser.close();}
};
