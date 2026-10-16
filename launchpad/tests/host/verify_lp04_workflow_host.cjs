/* Installed visible Chrome proof for the A12 workflow/prompt/entry hierarchy. */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');
const args=process.argv.slice(2);const root=path.resolve(args[args.indexOf('--root')+1]);
if(args[args.indexOf('--browser')+1]!=='chrome')throw new Error('Required installed Chrome host');
let playwright;try{playwright=require('playwright');}catch(_){if(!process.env.NODE_PATH)throw new Error('Set NODE_PATH to the bundled dependency runtime');playwright=require('playwright');}
const chrome=process.env.LP_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'a12-host-manifest.json'),'utf8'));
 const browser=await playwright.chromium.launch({executablePath:chrome,headless:false});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[],network=[],observations=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!r.url().startsWith('file:'))network.push(r.url());});
 try{
  assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(manifest.ticket_path)).digest('hex'),manifest.ticket_page_sha256);
  await page.goto(pathToFileURL(manifest.plan_path).href);await page.locator('.rv-card').first().waitFor();
  assert.equal(await page.evaluate(()=>LPHost.model.generation),manifest.generation);
  const card=page.locator('.rv-card').first();
  assert.equal(await card.getAttribute('data-card-symbol'),manifest.card_symbol);
  assert.equal(await card.locator('.rv-card-state').getAttribute('title'),manifest.card_symbol);
  await page.screenshot({path:path.join(root,'chrome-a12-plan.png'),fullPage:true});
  // Open the ticket and verify the top-level hierarchy, keyboard targets and prompts.
  await card.locator('.rv-card-open').click();await page.locator('.rv-logo').waitFor();
  assert.equal(await page.locator('.rv-workflow > .rv-node').count(),manifest.stage_count);
  const topNode=page.locator('.rv-workflow > .rv-node').nth(1);
  for(const role of ['toggle','name','description']){
   const button=topNode.locator('[data-focus-role="'+role+'"]').first();await button.waitFor();
   await button.focus();assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.dataset.focusRole),role);
  }
  const nameButton=topNode.locator('[data-focus-role="name"]').first();
  await nameButton.focus();assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.dataset.focusRole),'name');
  const jobNode=page.locator('[data-node-uuid="'+manifest.node_uuid+'"]').first();await jobNode.waitFor();
  const promptButton=jobNode.locator('[data-focus-role="name"]').first();const target=await promptButton.getAttribute('data-target-uuid');
  await promptButton.click();await page.locator('dialog').waitFor();
  const text=await page.locator('dialog').textContent();
  assert.match(text,/"kind": "template"/);assert.match(text,/"inert": true/);assert.match(text,/"provider": "unknown"/);
  assert.match(text,/"evidence": "stored_assignment_briefing"/);assert.match(text,/"evidence": "child_loaded_ack"/);
  await page.getByRole('button',{name:'Pin revision',exact:true}).click();assert.match(await page.locator('dialog').textContent(),/Pinned historical revision/);
  await page.getByRole('button',{name:'Show current',exact:true}).click();assert.match(await page.locator('dialog').textContent(),/Current captured revision/);
  await page.screenshot({path:path.join(root,'chrome-a12-prompt.png'),fullPage:true});
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.dataset.focusRole),'name');
  assert.equal(await page.evaluate(()=>document.activeElement&&document.activeElement.dataset.targetUuid),target);
  // A nested owner gate never rolls its icon up into the ticket card.
  const gate=page.locator('[data-node-uuid="'+manifest.nested_gate_uuid+'"]').first();await gate.waitFor();
  await gate.scrollIntoViewIfNeeded();await gate.locator('[data-focus-role="name"]').first().click();await page.locator('dialog').waitFor();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  const symbolAfter=await page.evaluate(()=>LPHost.model.tickets[0].workflow.card.icon);
  assert.equal(symbolAfter,manifest.card_symbol);
  await page.reload();await page.locator('.rv-logo').waitFor();
  assert.equal(await page.evaluate(()=>LPHost.model.generation),manifest.generation);
  assert.equal(await page.evaluate(()=>LPHost.model.tickets[0].workflow.card.icon),manifest.card_symbol);
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const report={result:'PASS',host:'installed visible Google Chrome',version:browser.version(),protocol:'file:',observations,errors,network,limits:manifest.limits};
  fs.writeFileSync(path.join(root,'chrome-a12-host-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
