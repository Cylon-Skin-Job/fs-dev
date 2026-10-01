// Portable, fixture-only recorder. Kept self-contained for exact-owned main injection.
export function createWatchedTraceCore({clock,sample=()=>({}),emit=()=>{},limit=512}) {
  let sequence=0,overflow=0,observationErrors=0,stopped=false;
  const events=[],restorers=[],listeners=[],timers=new Set(),coverage=[];
  const record=(kind,detail={})=>{
    if(stopped)return;
    try {
      let state;try{state=sample();}catch{state={stateUnavailable:true};observationErrors++;}
      const event={sequence:++sequence,...clock(),kind,...detail,state};
      if(events.length===limit){events.shift();overflow++;}
      events.push(event);try{emit(event);}catch{observationErrors++;}
    } catch {observationErrors++;}
  };
  const wrap=(target,key,label)=>{
    const descriptor=Object.getOwnPropertyDescriptor(target,key),original=target[key];
    if(typeof original!=='function'){coverage.push({label,status:'unavailable'});return;}
    function traced(...args) {
      let callsites=[];try{callsites=(new Error().stack||'').split('\n').slice(2,8).map(line=>line.trim().slice(0,220));}catch{observationErrors++;}
      record('method-call',{method:label,callsites});
      try {const value=Reflect.apply(original,this,args);record('method-return',{method:label});return value;}
      catch(error){record('method-throw',{method:label});throw error;}
    }
    try {
      Object.defineProperty(target,key,{value:traced,writable:true,configurable:true,enumerable:descriptor?.enumerable??false});
      coverage.push({label,status:'wrapped'});
      restorers.push(()=>{
        if(target[key]!==traced){coverage.push({label,status:'restoration-conflict'});return;}
        if(descriptor)Object.defineProperty(target,key,descriptor);else delete target[key];
      });
    } catch {coverage.push({label,status:'unavailable'});}
  };
  const delayed=(kind,detail,delay=200)=>{
    if(timers.size>=64){overflow++;return;}
    const timer=setTimeout(()=>{timers.delete(timer);record(kind,detail);},delay);timers.add(timer);
  };
  const listen=(target,name,label=name)=>{
    const listener=()=>{record('event',{event:label});delayed('post-event-sample',{event:label});};
    target.on(name,listener);listeners.push(()=>target.removeListener(name,listener));
  };
  const interval=setInterval(()=>record('periodic-sample'),1000);interval.unref?.();
  return {record,wrap,listen,
    snapshot:()=>({events:[...events],overflow,observationErrors,coverage:[...coverage],stopped}),
    stop(){
      if(stopped)return;
      clearInterval(interval);for(const timer of timers)clearTimeout(timer);timers.clear();
      for(const cleanup of [...listeners,...restorers.reverse()]){try{cleanup();}catch{observationErrors++;}}
      record('observers-restored');stopped=true;
    },
  };
}
