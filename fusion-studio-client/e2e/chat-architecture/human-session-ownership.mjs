import {spawnSync} from 'node:child_process';

export const commandFor=pid=>spawnSync('ps',['-p',String(pid),'-o','command='],{encoding:'utf8'}).stdout.trim();
export function exactOwnedPids(token,root) {
  const candidates=[token,root].flatMap(pattern=>spawnSync('pgrep',['-f',pattern],{encoding:'utf8'}).stdout.trim().split(/\s+/).map(Number).filter(n=>n>1));
  const parents=[...new Set(candidates)];
  const visit=pid=>[pid,...spawnSync('pgrep',['-P',String(pid)],{encoding:'utf8'}).stdout.trim().split(/\s+/).map(Number).filter(n=>n>1).flatMap(visit)];
  return [...new Set(parents.flatMap(visit))].filter(pid=>{const command=commandFor(pid);return command.includes(root+'/')||command.includes(token);});
}
export function signalExactOwned(pids,{token,root,signal,command=commandFor,kill=(pid,sig)=>process.kill(pid,sig)}) {
  const signaled=[];
  for(const pid of pids){const current=command(pid);if(!current||(!current.includes(token)&&!current.includes(root+'/')))continue;try{kill(pid,signal);signaled.push(pid);}catch(error){if(error.code!=='ESRCH')throw error;}}
  return signaled;
}
export async function closeHumanRuntime(runtime,{token,root,record}) {
  const owned=exactOwnedPids(token,root).filter(pid=>pid!==process.pid);
  let timer;
  if(runtime?.page&&!runtime.page.isClosed()){try{await Promise.race([runtime.page.evaluate(()=>window.__fusionHumanObserver?.stop()).catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,2000);})]);}finally{clearTimeout(timer);}}
  try{await Promise.race([runtime?.app?.close().catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,12000);})]);}finally{clearTimeout(timer);}
  let remaining=owned.filter(pid=>!!commandFor(pid));
  if(remaining.length){record({kind:'owned-cleanup-signal',signal:'SIGTERM',pids:signalExactOwned(remaining,{token,root,signal:'SIGTERM'})});await new Promise(resolve=>setTimeout(resolve,2000));}
  remaining=remaining.filter(pid=>!!commandFor(pid));
  if(remaining.length){record({kind:'owned-cleanup-signal',signal:'SIGKILL',pids:signalExactOwned(remaining,{token,root,signal:'SIGKILL'})});await new Promise(resolve=>setTimeout(resolve,300));}
  return remaining.filter(pid=>{const cmd=commandFor(pid);return cmd.includes(token)||cmd.includes(root+'/');});
}
