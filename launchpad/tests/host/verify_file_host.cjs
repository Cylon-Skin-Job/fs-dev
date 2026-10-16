/* Actual installed Chrome file-host integration, including A03 restoration. */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const os=require('node:os');const {pathToFileURL}=require('node:url');
const args=process.argv.slice(2),root=path.resolve(args[args.indexOf('--root')+1]);
if(args[args.indexOf('--browser')+1]!=='chrome')throw new Error('Required installed Chrome host');
let playwright;try{playwright=require('playwright');}catch(_){if(!process.env.NODE_PATH)throw new Error('Set NODE_PATH to the bundled dependency runtime');playwright=require('playwright');}
const chrome=process.env.LP_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const manifest=(args.includes('--a10')||args.includes('--a11'))?null:JSON.parse(fs.readFileSync(path.join(root,'sample-manifest.json'),'utf8'));
if(args.includes('--a11')){require('./verify_lp04_acceptance_host.cjs')(root).catch(error=>{console.error(error.stack);process.exitCode=1;});}
else if(args.includes('--a10')){require('./verify_lp04_claims_host.cjs')(root).catch(error=>{console.error(error.stack);process.exitCode=1;});}
else (async()=>{const browser=await playwright.chromium.launch({executablePath:chrome,headless:false});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  try{
    const file=pathToFileURL(path.join(root,'work-tickets/sample/plan.HTML')).href;
    await page.goto(file);await page.locator('.rv-card').first().waitFor();
    assert.equal(await page.locator('.rv-card').count(),32);assert.equal(await page.locator('.rv-branch-rail').count(),4);
    assert.equal(await page.locator('.rv-main-rail').count(),1);assert.equal(await page.locator('select[aria-label="Named plan"]').count(),1);
    assert.match(await page.locator('h1').textContent(),/32-record source\/sample/);
    const before=await page.evaluate(()=>JSON.parse(document.getElementById('rv-snapshot').textContent).generation);
    assert.equal(typeof before,'string');await page.screenshot({path:path.join(root,'chrome-plan.png'),fullPage:true});
    await page.locator('.rv-timeline-viewport').evaluate(node=>{node.scrollLeft=node.scrollWidth;});
    await page.screenshot({path:path.join(root,'chrome-convergence.png'),fullPage:true});
    await page.locator('.rv-timeline-viewport').evaluate(node=>{node.scrollLeft=0;});
    const {execFileSync}=require('node:child_process');
    const oldPageHash=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'work-tickets/sample/plan.HTML'))).digest('hex');
    const registered=JSON.parse(execFileSync(process.env.LP_PYTHON||'python3',[path.join(__dirname,'register_plan.py'),root],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8'}));
    assert.equal(registered.exit,0);await page.reload();
    assert.equal(await page.evaluate(()=>LPHost.model.generation),before);
    assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'work-tickets/sample/plan.HTML'))).digest('hex'),oldPageHash);
    await page.locator('select[aria-label="Named plan"]').selectOption('latest');await page.getByRole('link',{name:'Second named plan',exact:true}).waitFor();
    await page.screenshot({path:path.join(root,'chrome-named-plans.png'),fullPage:true});
    await page.getByRole('link',{name:'Second named plan',exact:true}).click();await page.locator('h1').waitFor();assert.equal(await page.locator('h1').textContent(),'Second named plan');
    await page.locator('select[aria-label="Named plan"]').selectOption('latest');await page.getByRole('link',{name:'32-record source/sample',exact:true}).click();await page.locator('.rv-card').first().waitFor();
    assert.equal(await page.locator('.rv-card').count(),32);assert.equal(await page.evaluate(()=>LPHost.model.generation),before);
    await page.locator('.rv-blocked').first().click();assert.match(await page.locator('dialog').textContent(),/release/);await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.locator('.rv-card-open').first().click();assert.equal(await page.locator('.rv-logo').count(),1);assert.match(await page.locator('.rv-ticket').textContent(),/Initial Capture/);
    assert.match(await page.locator('.rv-ticket').textContent(),/Scope/);assert.match(await page.locator('.rv-ticket').textContent(),/ToDo/);
    await page.screenshot({path:path.join(root,'chrome-ticket.png'),fullPage:true});
    const update=JSON.parse(execFileSync(process.env.LP_PYTHON||'python3',[path.join(__dirname,'refresh_sample.py'),root],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8'}));
    assert.equal(await page.evaluate(()=>LPHost.model.generation),before);assert.notEqual(update.captured_plan_revision_uuid,before);
    await page.reload();await page.locator('.rv-logo').waitFor();const latest=await page.evaluate(()=>LPHost.model.generation);assert.equal(latest,update.captured_plan_revision_uuid);
    await page.getByRole('button',{name:'Back to plan',exact:true}).click();await page.locator('.rv-card').first().waitFor();assert.equal(await page.locator('.rv-card').count(),32);
    const child=pathToFileURL(path.join(root,'work-tickets/sample',JSON.parse(fs.readFileSync(path.join(root,'work-tickets/sample/CURRENT/plan.json'),'utf8')).revisions.find(x=>x.kind==='plan').body.ticket_bindings.find(x=>x.ticket_uuid===manifest.ticket_uuids[0]).current_home,'ticket.html')).href;
    await page.goto(child);assert.equal(await page.evaluate(()=>LPHost.model.generation),latest);assert.equal(await page.locator('.rv-logo').count(),1);
    assert.match(await page.locator('.rv-ticket').textContent(),/Manual refresh probe: updated seed/);
    await page.reload();assert.equal(await page.evaluate(()=>LPHost.model.generation),latest);
    await page.locator('select[aria-label="Named plan"]').selectOption('latest');await page.getByRole('link',{name:'Second named plan',exact:true}).waitFor();
    const immutable=JSON.parse(execFileSync(process.env.LP_PYTHON||'python3',[path.join(__dirname,'render_paths.py'),root],{cwd:path.resolve(__dirname,'../../..'),encoding:'utf8'}));
    for(const target of immutable){
      await page.goto(pathToFileURL(target).href);await page.locator('select[aria-label="Named plan"]').waitFor();
      assert.equal(await page.evaluate(()=>LPHost.model.generation),latest);
      await page.locator('select[aria-label="Named plan"]').selectOption('latest');await page.getByRole('link',{name:'Second named plan',exact:true}).click();
      await page.locator('select[aria-label="Named plan"]').selectOption(manifest.plan_uuid);await page.locator('.rv-card').first().waitFor();
      assert.equal(await page.locator('.rv-card').count(),32);
    }
    const restoration=await require('./verify_restore_host.cjs')({context,root,file,child,manifest});
    assert.deepEqual(errors,[]);
    const report={result:'PASS',host:'installed Google Chrome',version:browser.version(),protocol:'file:',population:32,initial_generation:before,intermediate_generation:latest,generation:restoration.generation,
      checks:['32 real public-minted records','named plan selector','subsequently registered plan reachable bidirectionally from immutable earlier plan and child','public view.render immutable plan+child paths navigate correctly','foreign business snapshot hash unchanged by registration','main/four branch fan-out/convergence paths','number/title cards','blocked reason/release modal','seed Capture/scope/ToDo','manual plan+ticket reload same generation'],
      restoration, screenshots:['chrome-plan.png','chrome-convergence.png','chrome-ticket.png','chrome-named-plans.png'],errors,limits:['Deletion fallback is labeled host-model simulation; LP02 owns public deletion','Dedicated real installed Chrome window; no universal browser claim']};
    fs.writeFileSync(path.join(root,'chrome-host-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
  }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
