import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import { createRequire } from 'node:module';
import {observeFixedExchangeDom} from './public-dom-oracle-v3.mjs';
const root=process.argv[2],nonce=process.argv[3];assert.equal(fs.readFileSync(path.join(root,'.chat-ar-r3-owned'),'utf8'),nonce+'\n');
const {chromium}=createRequire('/Users/rccurtrightjr./projects/fs-dev/fusion-studio-client/package.json')('@playwright/test');
const browser=await chromium.launch({headless:true});const page=await browser.newPage();
const user='<div class="rv-message-user-content">Reply with exactly CHAT-AR-REPAIR-READY.</div>';
const response='<div class="rv-message rv-message-assistant"><div class="rv-message-assistant-content">CHAT-AR-REPAIR-READY.</div><div class="rv-assistant-reply-shell">completed reply controls</div></div>';
const host=(body,workspace='public-scratch-2',extra='')=>'<div class="rv-panel active"><div data-thread-id="thread-2" data-thread-group-id="group-2" data-selected="true"></div><section data-chat-host="main" data-chat-workspace-id="'+workspace+'" data-chat-view-id="file-viewer" data-chat-thread-id="thread-2" '+extra+'>'+body+'</section></div>';
try{
 const cases=[['harmless different completed response',host(user+response.replace('CHAT-AR-REPAIR-READY.', 'Ready for repair verification.')),true,false,true],['user marker alone',host(user),true,false,false],['completed assistant',host(user+response),true,true,true],['hidden matching assistant',host(user+response.replace('class="rv-message rv-message-assistant"','style="display:none" class="rv-message rv-message-assistant"')),true,false,false],['foreign host marker',host(user)+host(response,'foreign-workspace'),true,false,false],['streaming assistant',host(user+response.replace('rv-message-assistant-content','rv-message-assistant-content streaming').replace('<div class="rv-assistant-reply-shell">completed reply controls</div>','')),true,true,false]];
 const receipts=[];
 for(const [name,html,prompt,reply,complete] of cases){await page.setContent(html);const observed=await page.evaluate(observeFixedExchangeDom,{workspaceId:'public-scratch-2',viewId:'file-viewer'});assert.equal(observed.fixedPromptVisible,prompt,name);assert.equal(observed.fixedResponseVisible,reply,name);assert.equal(observed.completedAssistantVisible,complete,name);receipts.push({name,observed,passed:true});}
 fs.writeFileSync(path.join(root,'public-dom-oracle-v3-fixture-results.json'),JSON.stringify({fixtureOnly:true,liveUIInputs:false,cases:receipts},null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({fixtureOnly:true,passed:receipts.length}));
}finally{await browser.close();}
