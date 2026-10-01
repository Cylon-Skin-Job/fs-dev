import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { build } from 'vite';
const bundle = (async () => {
  const entry = 'virtual:diagnostics-render';
  const source = `
    import React from 'react'; import { createRoot } from 'react-dom/client'; import { flushSync } from 'react-dom';
    import { LiveSegmentRenderer } from ${JSON.stringify(path.resolve('src/components/LiveSegmentRenderer.tsx'))};
    import { ConnectedDiagnostics } from ${JSON.stringify(path.resolve('src/components/diagnostics/ConnectedDiagnostics.tsx'))};
    import { openDiagnosticStream, closeDiagnosticStream, sampleDiagnostic } from ${JSON.stringify(path.resolve('src/lib/diagnostics/stream.ts'))};
    import { handleStreamMessage } from ${JSON.stringify(path.resolve('src/lib/ws/stream-handlers.ts'))};
    import { readRevealSurfaces } from ${JSON.stringify(path.resolve('src/lib/reveal/progress.ts'))};
    import { usePanelStore } from ${JSON.stringify(path.resolve('src/state/panelStore.ts'))};
    import { redactMessageForLog } from ${JSON.stringify(path.resolve('src/lib/ws-client.ts'))};
    const sent=[], completed=[], roots = new Map();
    usePanelStore.setState({ activeWorkspaceId:'ws', ws:{readyState:1,send:r=>sent.push(JSON.parse(r))} });
    const node = id => { let el=document.getElementById(id); if(!el){el=document.createElement('div');el.id=id;document.body.append(el);} if(!roots.has(id))roots.set(id,createRoot(el)); return roots.get(id); };
    function render(segments, terminal=false) { for(const id of ['observed','control']) flushSync(()=>node(id).render(React.createElement(LiveSegmentRenderer,{workspaceId:'ws',threadId:id,surfaceId:id,turnId:'A',segments,...terminal?{onRevealComplete:()=>completed.push(id)}:{}}))); }
    window.fixture={render,sent,completed,read:readRevealSurfaces,sample:()=>sampleDiagnostic('tab'),
      open(){openDiagnosticStream('tab',{workspaceId:'ws',viewId:'wiki-viewer',threadGroupId:'g',threadId:'observed',surfaceId:'observed'});flushSync(()=>node('diagnostics').render(React.createElement(ConnectedDiagnostics,{tabId:'tab'})));},
      emit(text,seq=1,extra={}){const sub=sent.filter(x=>x.type==='chat-turn:diagnostic:subscribe').at(-1);handleStreamMessage({...sub,type:'chat-turn:diagnostic:stream',availability:'available',generation:1,turnId:'A',reset:true,baseline:0,events:[{seq,text,sourceUnits:text.length,sourceBytes:text.length}],...extra});},
      unmount(){flushSync(()=>roots.get('observed').unmount());},
      close(){closeDiagnosticStream('tab');flushSync(()=>roots.get('diagnostics').unmount());},
      log: redactMessageForLog,
    };
  `;
  const result = await build({ configFile:false,logLevel:'silent', plugins:[{name:entry,resolveId:id=>id===entry?'\0'+entry:null,load:id=>id==='\0'+entry?source:null}],
    build:{write:false,minify:false,cssCodeSplit:false,rollupOptions:{input:entry,output:{format:'iife'}}} });
  if(Array.isArray(result)||!('output'in result))throw Error('bundle');
  return {js:result.output.filter(x=>x.type==='chunk').map(x=>x.code).join('\n'),css:result.output.filter(x=>x.type==='asset').map(x=>x.source).join('\n')};
})();
const call = (page: Page, name: string, ...args: unknown[]) => page.evaluate(({name,args})=>(window as any).fixture[name](...args),{name,args});
async function boot(page:Page, segments:unknown[]) {
  await page.clock.install(); await page.clock.pauseAt(new Date()); await page.setContent('<body></body>');
  await page.evaluate(()=>{if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{value:()=>Math.random().toString(36).slice(2)});});
  const b=await bundle; await page.addStyleTag({content:b.css+'\n#diagnostics {height:500px;width:900px;}'}); await page.addScriptTag({content:b.js});
  await call(page,'render',segments); await call(page,'open');
}
const segment=(content:string,complete=false)=>({type:'text',content,complete});
test('native dump gets ahead of actual reveal; active diagnostic sampling leaves output/timeline identical, terminal drains',async({page})=>{
  const content='A deliberately slow visible sentence. '.repeat(20)+'\n\n';
  await boot(page,[segment(content)]); await call(page,'emit',content);
  await page.clock.runFor(200);
  await expect(page.getByLabel('Native event stream')).toHaveText(content+'\n');
  const first=await call(page,'read'); expect((first[0].segments[0]?.visible ?? 0)).toBeLessThan(content.length);
  for(let i=0;i<30;i++){
    await page.clock.runFor(100);
    expect(await page.locator('#observed').textContent()).toBe(await page.locator('#control').textContent());
  }
  await expect(page.getByLabel('Stream diagnostics')).toContainText('Measured reveal (last sample interval)');
  await expect(page.getByLabel('Stream diagnostics')).toContainText('completed source prefix');
  await call(page,'emit','terminal',2,{reset:false,terminal:true});
  await call(page,'render',[segment(content,true)],true);
  for(let i=0;i<80;i++){
    await page.clock.runFor(100);
    expect(await page.locator('#observed').textContent()).toBe(await page.locator('#control').textContent());
  }
  expect(await page.evaluate(()=>(window as any).fixture.completed.sort())).toEqual(['control','observed']);
  await expect(page.getByLabel('Stream diagnostics')).toContainText('future output, tool completion, pauses and event-loop delay are unknown');
});
test('2s wait stays exact with diagnostics open; incomplete source and unmounted observations remain truthful',async({page})=>{
  await boot(page,[segment('first\n\n```js\npartial')]);
  let since:number|null=null;
  for(let i=0;i<1000;i++){const snapshot=await call(page,'read');if(snapshot[0].waitingSince!==null){since=snapshot[0].waitingSince;break;} await page.clock.runFor(10);}
  expect(since).not.toBeNull(); const now=await page.evaluate(()=>Date.now()); await page.clock.runFor(since!+1999-now);
  await expect(page.locator('#observed .rv-working-activity')).toHaveCount(0); await page.clock.runFor(1);
  await expect(page.locator('#observed .rv-working-activity')).toContainText('Working… 2s');
  await page.clock.runFor(200); await call(page,'unmount'); await page.clock.runFor(2000);
  await expect(page.getByLabel('Stream diagnostics')).toContainText('unmounted — last known');
  await expect(page.getByLabel('Stream diagnostics')).toContainText('visible wait unavailable');
  await expect(page.getByLabel('Stream diagnostics')).toContainText('Measured reveal (last sample interval): unavailable');
});
test('real plaintext viewport follows tail only at bottom, bounded sampling and logging suppression',async({page})=>{
  await boot(page,[{type:'shell',content:'',complete:false},segment('queued later\n\n',true)]);
  await call(page,'emit',Array.from({length:100},(_,i)=>'row '+i).join('\n')); await page.clock.runFor(200);
  const stream=page.getByLabel('Native event stream');
  const bottom=await stream.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight); expect(bottom).toBeLessThan(2);
  await stream.evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new Event('scroll'));});
  await call(page,'emit','NEW ROW',2,{reset:false}); await page.clock.runFor(200);
  expect(await stream.evaluate(el=>el.scrollTop)).toBe(0);
  await stream.evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});
  await call(page,'emit','TAIL ROW',3,{reset:false}); await page.clock.runFor(200);
  expect(await stream.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight)).toBeLessThan(2);
  expect(await call(page,'log',{type:'chat-turn:diagnostic:stream',events:[{text:'PRIVATE NATIVE'}]})).toEqual({type:'chat-turn:diagnostic:stream'});
  await expect(page.getByLabel('Stream diagnostics')).toContainText('source prefix unknown');
  await expect(page.getByLabel('Stream diagnostics')).toContainText('Queued later segments (before parsing): 1');
  await page.screenshot({path:'../ai/RC-MacAir-15/Captures/035-Composer_Typing_Regression/ROADMAP/evidence/render-diagnostics/RD-02/diagnostics-runtime.png'});
});
