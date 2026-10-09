const fs=require('node:fs');
const path=require('node:path');

function installEarlyLifecycle({app,process:ownedProcess,config,self=__filename,write=event=>fs.appendFileSync(config.timeline,JSON.stringify(event)+'\n'),writeSummary=value=>fs.writeFileSync(config.summary,JSON.stringify(value,null,2)),limit=512}) {
 const expected=[config.entry,`--chat-architecture-token=${config.token}`];
 if(ownedProcess.cwd()!==config.cwd)throw Error('EARLY_PRELOAD_CWD_MISMATCH');
 const args=ownedProcess.argv.slice(1);
 if(args.length!==4||args[0]!=='-r'||args[1]!==self||args[2]!==expected[0]||args[3]!==expected[1])throw Error('EARLY_PRELOAD_ARGV_MISMATCH');
 // Electron default_app already selected the original entry before loading modules.
 ownedProcess.argv.splice(1,2);
 let sequence=0,overflow=0,writeErrors=0,unexpectedWindows=0,window=null,stopped=false;
 const removers=[];
 const read=(target,name)=>{try{return typeof target?.[name]==='function'?{available:true,value:target[name]()}:{available:false};}catch{return {available:false};}};
 const dock=()=>{try{return read(app.dock,'isVisible');}catch{return {available:false};}};
 const state=()=>({appActive:read(app,'isActive'),appHidden:read(app,'isHidden'),dockVisible:dock(),
  window:window?{id:window.id,focused:read(window,'isFocused'),visible:read(window,'isVisible'),minimized:read(window,'isMinimized'),focusable:read(window,'isFocusable')}:{bound:false}});
 const record=(kind,detail={})=>{
  if(stopped)return;
  try{if(sequence>=limit){overflow++;return;}write({sequence:++sequence,source:'early-main',pid:ownedProcess.pid,wallMs:Date.now(),monoMs:performance.now(),timeOrigin:performance.timeOrigin,kind,...detail,state:state()});}catch{writeErrors++;}
 };
 const listen=(target,event,callback)=>{target.on(event,callback);removers.push(()=>target.removeListener(event,callback));};
 let timer;
 const snapshot=()=>({records:sequence,overflow,writeErrors,unexpectedWindows,windowId:window?.id??null,stopped});
 const stop=()=>{if(stopped)return;clearInterval(timer);for(const remove of removers){try{remove();}catch{writeErrors++;}}record('early-observers-restored');stopped=true;try{writeSummary(snapshot());}catch{writeErrors++;}};
 try{
  for(const event of ['will-finish-launching','ready','activate','did-become-active','did-resign-active','before-quit','will-quit'])listen(app,event,()=>record('app-event',{event}));
  listen(app,'browser-window-created',(_event,created)=>{
   if(window){unexpectedWindows++;record('unexpected-additional-window');return;}
   window=created;record('window-bound');
   for(const event of ['ready-to-show','show','hide','focus','blur','minimize','restore','closed'])listen(window,event,()=>record('window-event',{event}));
  });
  listen(ownedProcess,'exit',code=>{record('process-exit',{code});stop();});
  timer=setInterval(()=>record('periodic-sample'),1000);timer.unref?.();
  record('preload-installed-before-main',{entry:config.entry,cwd:config.cwd,execPath:ownedProcess.execPath,argvRestored:true,argvLength:ownedProcess.argv.length,readyPolicy:'installed Playwright loader unchanged'});
 }catch(error){stop();throw error;}
 return {record,stop,snapshot};
}
module.exports={installEarlyLifecycle};
if(process.env.FUSION_CHAT_ARCH_EARLY_LIFECYCLE){
 const config=JSON.parse(process.env.FUSION_CHAT_ARCH_EARLY_LIFECYCLE);
 const owner=JSON.parse(fs.readFileSync(path.join(config.stageRoot,'.chat-architecture-owned.json'),'utf8'));
 if(owner.sentinel!==config.token||config.entry!==path.join(config.stageRoot,'fusion-studio-client','electron','main.cjs')||config.cwd!==path.dirname(path.dirname(config.entry)))throw Error('EARLY_PRELOAD_OWNERSHIP_MISMATCH');
 globalThis.__chatArchEarlyLifecycle=installEarlyLifecycle({app:require('electron').app,process,config});
}
