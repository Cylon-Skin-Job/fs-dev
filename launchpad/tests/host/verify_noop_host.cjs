/* Installed Chrome observes receipt-only refresh without business changes. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(process.argv[2]),home=path.join(root,'work-tickets/sample');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'sample-manifest.json')));
const plan=JSON.parse(fs.readFileSync(path.join(home,'CURRENT/plan.json')));
const binding=plan.revisions.find(x=>x.kind==='plan').body.ticket_bindings.find(x=>x.ticket_uuid===manifest.ticket_uuids[0]);
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(String(error)));
  try{
    await page.goto(pathToFileURL(path.join(home,binding.current_home,'ticket.html')).href);await page.locator('.rv-logo').waitFor();
    const before=await page.evaluate(()=>LPHost.model.generation),text=await page.locator('.rv-ticket').textContent();
    const update=JSON.parse(execFileSync('python3',[path.join(__dirname,'noop_sample.py'),root],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8'}));
    assert.equal(await page.evaluate(()=>LPHost.model.generation),before);assert.notEqual(update.generation,before);
    await page.reload();assert.equal(await page.evaluate(()=>LPHost.model.generation),update.generation);
    assert.equal(await page.locator('.rv-ticket').textContent(),text);
    await page.screenshot({path:path.join(root,'chrome-noop-ticket.png'),fullPage:true});
    await page.goto(pathToFileURL(path.join(home,'plan.HTML')).href);await page.locator('.rv-card').first().waitFor();
    assert.equal(await page.locator('.rv-card').count(),32);assert.equal(await page.locator('.rv-branch-rail').count(),4);
    assert.equal(await page.evaluate(()=>LPHost.model.generation),update.generation);assert.deepEqual(errors,[]);
    const report={result:'PASS',host:'installed Google Chrome',version:browser.version(),protocol:'file:',population:32,
      before_generation:before,generation:update.generation,payload_sha256:update.payload_sha256,
      checks:['identical public seed apply with fresh key and exact expectations','unchanged original physical ticket payload and binding','unchanged all business envelopes and plan revision/time','authored committed receipt empty changed refs/fields','same-request replay no republication','public current and original pinned ticket root unchanged','open page retains previous generation','manual child refresh advances generation with identical ticket text','plan32/fourbranch refresh agrees'],errors,cleanup:'page and owned browser closed in finally'};
    fs.writeFileSync(path.join(root,'chrome-noop-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  }finally{await page.close();await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
