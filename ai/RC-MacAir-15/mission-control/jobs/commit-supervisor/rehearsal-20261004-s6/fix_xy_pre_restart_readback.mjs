import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const verified=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const mode=process.argv[4]; const output=process.argv[5];
assert(['before-initializer','leave-completion','owner-current'].includes(mode));
assert.equal(verified.repo,config.candidate);assert.equal(verified.profile,config.profile);assert.equal(verified.machine,config.machine);
const require=createRequire(path.join(config.candidate,'fusion-studio-client/package.json'));
const { chromium }=require('@playwright/test');
const browser=await chromium.connectOverCDP(`http://127.0.0.1:${verified.debugPort}`);
const raw={kind:'ACTUAL_PRIVATE_CHECKLIST_READBACK',mode,started:new Date().toISOString(),profile:config.profile,candidate:config.candidate,machine:config.machine,samples:[]};
try {
 const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url()==='fusion-shell://app/');assert(page);
 await page.locator('.rv-connection-status.connected').waitFor();
 assert((await page.locator('.rv-workspace-name').innerText()).includes('S6 Checklist'));
 await page.locator('button.rv-tool-btn[title="Checklist"]').click();
 const frame=page.frameLocator('iframe[title="Checklist"]');await frame.locator('#summary').waitFor();
 const sample=async action=>{const v={at:new Date().toISOString(),action,summary:await frame.locator('#summary').innerText(),rows:(await frame.locator('#tasks label').allTextContents()).map(r=>r.trim()),checks:await frame.getByRole('checkbox').evaluateAll(nodes=>nodes.map(n=>n.checked))};raw.samples.push(v);assert(['Draft report','Review report'].includes(v.rows[0]));assert.deepEqual(v.rows.slice(1),['Review sources','Send summary']);return v;};
 if(mode==='before-initializer'){const v=await sample('independent post-canonical-restart BEFORE any smoke unchecking');assert.deepEqual(v.checks,[false,false,false]);assert.equal(v.summary,'3 remaining of 3');raw.initializer_invoked=false;}
 else if(mode==='leave-completion') {await frame.getByRole('checkbox',{name:'Review report',exact:true}).check();let v=await sample('deliberately leave Review report completion checked');assert.deepEqual(v.checks,[true,false,false]);assert.equal(v.summary,'2 remaining of 3');await page.reload();await page.locator('.rv-connection-status.connected').waitFor();await page.locator('button.rv-tool-btn[title="Checklist"]').click();v=await sample('ordinary shell reload retains owner-test checked state');assert.deepEqual(v.checks,[true,false,false]);assert.equal(v.summary,'2 remaining of 3');raw.deliberately_persisted_for_later_fix_restart_reset=true;}
 else {const v=await sample('known persisted first-owner checked state immediately BEFORE canonical restart; no initializer or completion action');assert.deepEqual(v.checks,[true,false,false]);assert.equal(v.summary,'2 remaining of 3');raw.initializer_invoked=false;raw.completion_action_invoked=false;}
 for(let i=0;i<11;i++){assert.equal(await page.locator('.rv-connection-status.connected').count(),1);await page.waitForTimeout(200);}
 raw.sustainedConnected=true;raw.finished=new Date().toISOString();await page.screenshot({path:`${output}.png`});
} finally {fs.writeFileSync(output,JSON.stringify(raw,null,2)+'\n');await browser.close();}
