import { test,expect } from '@playwright/test';
import path from 'node:path';
import { build } from 'vite';

// Actual App/document effect; unrelated service hooks and visual children are
// isolated. The keyboard handler is never copied or replaced by the fixture.
async function appKeyboardBundle() {
  const appPath=path.resolve('src/components/App.tsx'),entry='virtual:app-composition-test';
  const result=await build({configFile:false,logLevel:'silent',plugins:[{
    name:'app-keyboard-boundary-fixture', enforce:'pre',
    resolveId(source,importer){
      if(source===entry)return '\0'+entry;
      if(importer===appPath&&source!=='react'&&!source.startsWith('react/')&&source!=='../lib/composition-key')return '\0app-keyboard-mock:'+source;
    },
    load(id){
      if(id==='\0'+entry)return `import React from 'react';import{createRoot}from'react-dom/client';import App from ${JSON.stringify(appPath)};createRoot(document.getElementById('root')).render(React.createElement(App));`;
      if(!id.startsWith('\0app-keyboard-mock:'))return;
      const source=id.slice('\0app-keyboard-mock:'.length);
      if(source.endsWith('.css'))return '';
      if(source.endsWith('/panelStore'))return `const state={currentPanel:'capture-viewer',setCurrentPanel(){},ws:null,panelConfigs:[],viewStates:{},themes:[]};export const usePanelStore=Object.assign(fn=>fn(state),{getState:()=>state});`;
      if(source.endsWith('/workspaceStore'))return `export const useWorkspaceStore=fn=>fn({hasReceivedInit:false,activeWorkspaceId:null});`;
      if(source.endsWith('/worksurfaceController'))return 'export function flushBoundView(){};export function flushBoundWorkspaceViews(){}';
      if(source.endsWith('/chat-action-controller'))return 'export function installChatActionConsumer(){}';
      if(source==='../screenshots')return `export const SCREENSHOT_FLASH_EVENT='fixture-flash';export function captureAndAttachScreenshot(){};export function ScreenshotFlashOverlay(){return null;}`;
      const name=source.endsWith('/ViewLayoutControls')?'AppHeaderLayoutControls':source.split('/').pop();
      return `export function ${name}(){return ${name==='useWebSocket'?"'disconnected'":'null'};}`;
    },
  }],build:{write:false,minify:false,rollupOptions:{input:entry,output:{format:'iife',name:'AppCompositionFixture'}}}}) as any;
  return result.output.find((x:any)=>x.type==='chunk').code;
}

test('actual App preserves composing Escape focus and retains ordinary Escape',async({page})=>{
  await page.setContent('<div id="root"></div><textarea aria-label="Owned fixture input"></textarea>');
  await page.addScriptTag({content:await appKeyboardBundle()});
  await expect(page.getByText('Fusion server disconnected.')).toBeVisible();
  const input=page.getByRole('textbox',{name:'Owned fixture input'});
  await input.focus();await input.press('Escape');await expect(input).not.toBeFocused();
  for(const flags of [{isComposing:true,keyCode:27},{isComposing:false,keyCode:229}]) {
    await input.focus();
    const prevented=await input.evaluate((node,flags)=>{
      const event=new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Escape',...flags});
      node.dispatchEvent(event);return event.defaultPrevented;
    },flags);
    expect(prevented).toBe(false);await expect(input).toBeFocused();
  }
  await input.press('Escape');await expect(input).not.toBeFocused();
});
