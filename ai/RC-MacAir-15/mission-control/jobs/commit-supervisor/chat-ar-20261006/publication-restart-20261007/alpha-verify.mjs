import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {systemProcesses,listenerPids,descendants,profileArgument} from '/Users/rccurtrightjr./projects/fs-dev/scripts/fusion-restart-processes.mjs';

const run=path.dirname(fileURLToPath(import.meta.url));
const launch=JSON.parse(fs.readFileSync(path.join(run,'alpha-launch-started.json'),'utf8'));
const before=JSON.parse(fs.readFileSync(path.join(run,'alpha-install-precheck.json'),'utf8'));
const {chromium}=createRequire('/Users/rccurtrightjr./Applications/Fusion-Studio-Alpha-Source/fusion-studio-client/package.json')('@playwright/test');
const executable='/Applications/Fusion Studio Alpha.app/Contents/MacOS/Fusion Studio Alpha';
const serverEntry='/Applications/Fusion Studio Alpha.app/Contents/Resources/fusion-studio-server/server.js';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function identity(){
 const rows=systemProcesses();
 const mains=rows.filter(r=>r.command===executable || r.command.startsWith(executable+' '));
 assert.equal(mains.length,1,'Exactly one installed Alpha main');
 const main=mains[0];
 assert.equal(main.env.FUSION_APP_USER_DATA,launch.profile);
 assert.equal(main.env.FUSION_LOCAL_MACHINE,'RC-Alpha');
 assert.equal(main.executables[0],executable);
 assert.deepEqual(listenerPids(launch.debug_port),[main.pid]);
 const servers=rows.filter(r=>r.ppid===main.pid && r.command.endsWith(' '+serverEntry));
 assert.equal(servers.length,1,'Alpha-owned packaged server');
 const server=servers[0];
 assert.equal(server.env.FUSION_APP_USER_DATA,launch.profile);
 assert.equal(server.env.FUSION_LOCAL_MACHINE,'RC-Alpha');
 const port=Number(fs.readFileSync(path.join(launch.profile,'server.port'),'utf8').trim());
 assert.deepEqual(listenerPids(port),[server.pid]);
 const renderers=descendants(rows,main.pid).filter(r=>r.command.includes('--type=renderer'));
 assert.ok(renderers.length);
 for(const r of renderers){
  assert.equal(profileArgument(r.command),launch.profile);
  assert.equal(r.env.FUSION_APP_USER_DATA,launch.profile);
  assert.equal(r.env.FUSION_LOCAL_MACHINE,'RC-Alpha');
  assert.ok(r.executables[0].startsWith('/Applications/Fusion Studio Alpha.app/'));
 }
 return {mainPid:main.pid,serverPid:server.pid,rendererPids:renderers.map(r=>r.pid),port,profile:launch.profile,machine:'RC-Alpha',mainExecutable:executable,serverEntry,serverUrl:'http://localhost:'+port};
}
let browser;
try{
 let initial,last;
 for(let i=0;i<60;i++){
  try{initial=identity();browser=await chromium.connectOverCDP('http://127.0.0.1:'+launch.debug_port,{timeout:1000});break;}
  catch(e){last=e;await delay(500);}
 }
 if(!browser)throw last;
 let page;
 for(let i=0;i<60;i++){
  page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url()==='fusion-shell://app/');
  if(page)break;
  await delay(500);
 }
 assert.ok(page,'Installed Alpha shell');
 await page.locator('.rv-connection-status.connected').waitFor({state:'visible',timeout:30000});
 const samples=[];
 for(let i=0;i<16;i++){
  const row=await page.evaluate(()=>({url:location.href,connected:document.querySelectorAll('.rv-connection-status.connected').length,text:document.querySelector('.rv-connection-status.connected')?.textContent,workspace:document.querySelector('.rv-workspace-name')?.textContent}));
  assert.equal(row.url,'fusion-shell://app/');assert.equal(row.connected,1);assert.equal(row.text,'Connected');samples.push(row);
  if(i<15)await delay(200);
 }
 const ribbon=await page.locator('.rv-workspace-ribbon-item').evaluateAll(elements=>elements.map(e=>({id:e.getAttribute('data-workspace-id'),label:e.getAttribute('title'),active:e.classList.contains('is-active')})));
 assert.deepEqual(ribbon.map(r=>r.id).sort(),before.expected_workspaces.filter(r=>r.ribbon_visible).map(r=>r.id).sort());
 const active=ribbon.filter(r=>r.active);assert.equal(active.length,1);assert.equal(active[0].id,before.expected_active_workspace);
 assert.equal(samples.at(-1).workspace,active[0].label);
 const paths=before.expected_workspaces.map(r=>({workspaceId:r.id,system:path.join(r.repo_path,'ai','RC-Alpha','System'),exists:fs.existsSync(path.join(r.repo_path,'ai','RC-Alpha','System'))}));
 assert.ok(paths.every(r=>r.exists),'All registered workspaces resolve Alpha System trees');
 const final=identity();assert.equal(final.mainPid,initial.mainPid);assert.equal(final.serverPid,initial.serverPid);
 const current=systemProcesses();
 const foreignMainServers=before.foreign_dev_processes.filter(r=>!r.command.includes('--type='));
 const foreignReadback=foreignMainServers.map(r=>({pid:r.pid,unchanged:current.some(c=>c.pid===r.pid && c.ppid===r.ppid && c.start===r.start && c.command===r.command)}));
 assert.ok(foreignReadback.every(r=>r.unchanged),'Other development main/server process identities preserved');
 await page.screenshot({path:path.join(run,'alpha-connected.png')});
 const serverLog=path.join(launch.profile,'server-live.log');
 const currentLines=fs.readFileSync(serverLog,'utf8').split('\n').filter(l=>l.startsWith('[') && l.slice(1,25)>=launch.at.slice(0,24));
 const recent=currentLines.filter(l=>l.includes('[Server] diagnostic_log') || l.includes('[Server] request_log'));
 assert.ok(recent.length,'Current Alpha log activity');
 const receipt={state:'ALPHA_RUNTIME_VERIFIED',at:new Date().toISOString(),sourceCommit:'a4a4262587a7f72f89f5b9b9c2f54878fe5381bb',...final,debugPort:launch.debug_port,connectedAfterWorkspaceInit:true,samples:samples.length,durationMs:3000,workspaceCount:before.expected_workspaces.length,activeWorkspace:active[0],ribbon,workspacePaths:paths,foreignMainServersPreserved:foreignReadback,currentServerLog:serverLog,currentSanitizedLogLineCount:recent.length,limits:'Current logging intentionally minimizes startup/request diagnostics to categories and does not literally expose workspace count, active ID or paths. Those values are verified through the native initialized shell, read-only SQLite pre/post readbacks, all six Alpha System paths, and exact main/server/renderer environment. No raw prompt/provider test or registry/profile rewrite performed.',appScreenshot:path.join(run,'alpha-connected.png')};
 fs.writeFileSync(path.join(run,'alpha-runtime-verified.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(receipt));
}catch(e){
 fs.writeFileSync(path.join(run,'alpha-runtime-failure.json'),JSON.stringify({at:new Date().toISOString(),error:e.message,stack:e.stack},null,2)+'\n',{flag:'wx'});
 throw e;
}finally{if(browser)await browser.close();}
