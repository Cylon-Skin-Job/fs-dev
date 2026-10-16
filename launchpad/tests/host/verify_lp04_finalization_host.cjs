/* Installed visible Chrome proof for the A13 completed/locked/unlocked timeline. */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
const args=process.argv.slice(2);const root=path.resolve(args[args.indexOf('--root')+1]);
if(args[args.indexOf('--browser')+1]!=='chrome')throw new Error('Required installed Chrome host');
let playwright;try{playwright=require('playwright');}catch(_){if(!process.env.NODE_PATH)throw new Error('Set NODE_PATH to the bundled dependency runtime');playwright=require('playwright');}
const chrome=process.env.LP_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'a13-host-manifest.json'),'utf8'));
 const browser=await playwright.chromium.launch({executablePath:chrome,headless:false});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[],network=[],observations=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>{if(!r.url().startsWith('file:'))network.push(r.url());});
 try{
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(manifest.plan_path)).digest('hex'),manifest.plan_page_sha256);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(manifest.ticket_path)).digest('hex'),manifest.ticket_page_sha256);
  await page.goto(pathToFileURL(manifest.plan_path).href);await page.locator('.rv-card').first().waitFor();
  assert.equal(await page.evaluate(()=>LPHost.model.generation),manifest.generation);
  const card=page.locator('.rv-card').first();
  assert.equal(await card.getAttribute('data-finalization-state'),manifest.finalization_state);
  assert.equal(await card.getAttribute('data-finalization-completed'),'true');
  assert.equal(await card.getAttribute('data-next-mode'),'');
  // The card symbol still derives only from the explicit top-level workflow node.
  assert.equal(await card.getAttribute('data-card-symbol'),manifest.card_symbol);
  await page.screenshot({path:path.join(root,'chrome-a13-plan.png'),fullPage:true});
  await card.locator('.rv-card-open').click();await page.locator('.rv-logo').waitFor();
  const projection=await page.evaluate(()=>LPHost.model.tickets[0].finalization);
  assert.equal(projection.state,'completed');assert.equal(projection.completed,true);assert.equal(projection.next_mode,null);
  const record=await page.evaluate(u=>LPHost.model.tickets[0].records.find(x=>x.uuid===u),manifest.finalization_ref.entry_uuid);
  assert.equal(await page.evaluate(u=>LPHost.model.tickets[0].snapshot.revisions.filter(x=>x.kind==='integration'&&x.uuid===u).length,manifest.finalization_ref.entry_uuid),1);
  // The open discussion is preserved through finalization (never closed by it).
  const discussion=page.locator('[data-node-uuid="'+manifest.discussion_uuid+'"]').first();await discussion.waitFor();
  assert.equal(await discussion.getAttribute('data-discussion-state'),'open');
  await page.screenshot({path:path.join(root,'chrome-a13-ticket.png'),fullPage:true});
  await page.reload();await page.locator('.rv-logo').waitFor();
  assert.equal(await page.evaluate(()=>LPHost.model.generation),manifest.generation);
  assert.equal(await page.evaluate(()=>LPHost.model.tickets[0].finalization.state),'completed');
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  const report={result:'PASS',host:'installed visible Google Chrome',version:browser.version(),protocol:'file:',observations,errors,network,limits:manifest.limits};
  fs.writeFileSync(path.join(root,'chrome-a13-host-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
