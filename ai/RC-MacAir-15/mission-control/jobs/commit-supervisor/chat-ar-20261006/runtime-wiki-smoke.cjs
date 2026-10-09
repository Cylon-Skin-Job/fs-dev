 'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const candidate='/private/tmp/chat-ar-integration-r6pe5gmi/candidate';
const {chromium}=require(candidate+'/fusion-studio-client/node_modules/@playwright/test');
const matter=require(candidate+'/fusion-studio-client/node_modules/gray-matter');
const root=process.argv[2],nonce=process.argv[3];
assert.equal(fs.readFileSync(path.join(root,'.chat-ar-integration-owned'),'utf8'),nonce+'\n');
const prep=JSON.parse(fs.readFileSync(path.join(root,'runtime-preparation.json'),'utf8'));
const runs=fs.readdirSync(path.join(prep.profile,'fusion-restart')).filter(n=>n.startsWith('run-'));
assert.equal(runs.length,1);
const verified=JSON.parse(fs.readFileSync(path.join(prep.profile,'fusion-restart',runs[0],'verified.json'),'utf8'));
const wiki='ai/RC-MacAir-15/Wiki/';
const cases=[
 {topic:'Runtime Model',file:'007-Chat_System/006-Runtime_Model/PAGE.md'},
 {topic:'Screenshot Capture',file:'004-Integrations_And_Tools/004-Screenshot_Capture/PAGE.md'},
 {topic:'Chat UI',edge:'Composer',file:'007-Chat_System/004-Chat_UI/001-Composer/PAGE.md'},
 {topic:'Change Storm Control',file:'010-Events_And_Ledger/008-Change_Storm_Control/PAGE.md'},
 {collection:'Events And Ledger',file:'010-Events_And_Ledger/000-Events_And_Ledger/PAGE.md'},
 {topic:'Testing And Operations',edge:'Fusion Restart',file:'007-Chat_System/005-Testing_And_Operations/004-Fusion_Restart/PAGE.md'}
];
const observations=[];let browser;
const save=(name,d)=>fs.writeFileSync(path.join(root,name),JSON.stringify(d,null,2)+'\n',{flag:'wx',mode:0o600});
(async()=>{try{
 browser=await chromium.connectOverCDP('http://127.0.0.1:'+verified.debugPort);
 const pages=browser.contexts().flatMap(c=>c.pages()).filter(p=>p.url().startsWith('fusion-shell://app/'));assert.equal(pages.length,1);const page=pages[0];
 await page.locator('.rv-tools-panel button[title="Candidate Wiki"]').click();
 await page.locator('.rv-wiki-topic-name').first().waitFor();
 await page.locator('.rv-wiki-page-frontmatter-header:visible').waitFor();
 for(const c of cases){
  const bytes=fs.readFileSync(path.join(candidate,wiki,c.file));const actualScratch=fs.readFileSync(path.join(prep.workspace,wiki,c.file));assert.ok(bytes.equals(actualScratch));
  const expected=matter(bytes.toString()).data;
  if(c.collection) await page.locator('.rv-wiki-collection-header').filter({hasText:c.collection}).click();
  else {
   const section=c.file.split('/')[0].replace(/^\d+[-_]*/, '').replace(/_/g,' ');
   const group=page.locator('.rv-wiki-collection-group').filter({has:page.locator('.rv-wiki-collection-header').getByText(section,{exact:true})});
   await group.locator('.rv-wiki-topic-name').getByText(c.topic,{exact:true}).click();
  }
  if(c.edge) await page.locator('.rv-wiki-edge-link-text').getByText(c.edge,{exact:true}).click();
  const content=page.locator('.rv-wiki-page-content:visible');
  await page.waitForFunction(name=>[...document.querySelectorAll('.rv-wiki-page-frontmatter-header h1')].some(e=>e.textContent===name),expected.name,{timeout:10000});
  assert.equal(await content.locator('.rv-wiki-page-frontmatter-header h1').innerText(),expected.name);
  assert.equal(await content.locator('.rv-wiki-page-frontmatter-header p').innerText(),expected.description);
  const footer=content.locator('.rv-wiki-page-metadata-footer section').filter({has:page.getByRole('heading',{name:'Source Files',exact:true})});
  const sources=await footer.locator('li').allTextContents();assert.deepEqual(sources,expected.metadata?.['source-files']??[]);
  const text=await content.innerText();assert.ok(!text.startsWith('---'));assert.equal(await page.locator('.rv-wiki-page-error:visible').count(),0);
  assert.equal(await page.locator('.rv-connection-status:visible').innerText(),'Connected');
  const screenshot=path.join(root,'wiki-'+observations.length+'.png');await page.screenshot({path:screenshot});
  observations.push({route:c,file:wiki+c.file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),title:expected.name,description:expected.description,sourceFiles:sources,renderedBodyBytes:text.length,screenshot});
 }
 save('runtime-wiki-smoke.json',{status:'PASS',at:new Date().toISOString(),candidate,profile:prep.profile,workspace:prep.workspace,machine:prep.machine,pageUrl:page.url(),observations,boundary:'Actual private candidate Wiki UI public navigation and parsed title/description/source-footer rendering; no store mutation or injected runtime.'});
 console.log(JSON.stringify({status:'PASS',articles:observations.length,output:path.join(root,'runtime-wiki-smoke.json')}));
 }catch(e){save('runtime-wiki-smoke-failure-03.json',{status:'FAIL',at:new Date().toISOString(),name:e.name,message:e.message,observations});throw e;}finally{if(browser)await browser.close();}})();
