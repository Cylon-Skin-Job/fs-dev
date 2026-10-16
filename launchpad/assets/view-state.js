/* Presentation-only storage and current-snapshot reconciliation; no DOM access. */
globalThis.LPViewState = (() => {
  const VERSION=1, uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
  const id=value=>typeof value==='string'&&uuid.test(value);
  const nullable=value=>value===null||id(value);
  const roles=['selector','back','timeline','logo','toggle','name','description','content','workflow','categories','modal-json','modal-copy','modal-close','modal-pin','modal-current','card','blocked'];
  const offset=value=>object(value)&&Object.keys(value).length===2&&['x','y'].every(k=>Number.isFinite(value[k])&&value[k]>=0);
  const focus=value=>value===null||(object(value)&&Object.keys(value).length===3&&nullable(value.ticket_uuid)&&nullable(value.target_uuid)&&roles.includes(value.role));
  function defaults(ticket=null){return {version:VERSION,ticket_uuid:ticket,section_uuid:null,selection_path:[],expanded:{},modal:null,scroll:{main:{x:0,y:0},containers:{}},focus:null};}
  function valid(value){
    if(!object(value)||Object.keys(value).sort().join(',')!==Object.keys(defaults()).sort().join(','))return false;
    if(value.version!==VERSION||!nullable(value.ticket_uuid)||!nullable(value.section_uuid)||!Array.isArray(value.selection_path)||!value.selection_path.every(id))return false;
    if(!object(value.expanded)||!Object.entries(value.expanded).every(([key,open])=>id(key)&&typeof open==='boolean')||!focus(value.focus))return false;
    const s=value.scroll;if(!object(s)||Object.keys(s).sort().join(',')!=='containers,main'||!offset(s.main)||!object(s.containers))return false;
    if(!Object.entries(s.containers).every(([key,v])=>/^(timeline|workflow|categories|modal):([0-9a-f-]{36})$/i.test(key)&&id(key.split(':')[1])&&offset(v)))return false;
    const m=value.modal;
    return m===null||(object(m)&&Object.keys(m).sort().join(',')==='mode,return_focus,revision_uuid,selector,target_uuid,ticket_uuid'&&focus(m.return_focus)&&id(m.ticket_uuid)&&id(m.target_uuid)&&['content','definition','blocked','source','replacement'].includes(m.mode)&&['current','pinned'].includes(m.selector)&&(m.selector==='pinned'?id(m.revision_uuid):m.revision_uuid===null));
  }
  function path(ticket,target){
    const result=[],seen=new Set();let record=ticket?.records.find(x=>x.uuid===target);
    if(!record&&ticket?.lineage?.[target]?.fully_superseded)record=ticket.snapshot.revisions.find(x=>x.uuid===target&&ticket.snapshot.current.some(p=>p.entry_uuid===target&&p.revision_uuid===x.revision_uuid));
    while(record&&!seen.has(record.uuid)){seen.add(record.uuid);result.push(record.uuid);record=ticket.records.find(x=>x.uuid===(record.kind==='content'?record.body.category_uuid:record.kind==='discussion'?record.body.phase_node_uuid:record.body.parent_uuid));}
    return result;
  }
  function reconcile(value,model){
    const state=JSON.parse(JSON.stringify(value)),tickets=new Map(model.tickets.map(t=>[t.root.uuid,t]));
    if(model.view_kind==='ticket'){
      const target=tickets.has(model.ticket_uuid)?model.ticket_uuid:null;
      if(state.ticket_uuid!==target){state.section_uuid=null;state.selection_path=[];state.focus=null;state.modal=null;state.scroll.main={x:0,y:0};}
      state.ticket_uuid=target;
      if(state.modal?.ticket_uuid!==target)state.modal=null;
      if(state.focus?.ticket_uuid&&state.focus.ticket_uuid!==target)state.focus=null;
    }
    if(!tickets.has(state.ticket_uuid))state.ticket_uuid=model.view_kind==='ticket'&&tickets.has(model.ticket_uuid)?model.ticket_uuid:null;
    const ticket=tickets.get(state.ticket_uuid),ids=new Set(ticket?.records.map(x=>x.uuid)||[]);
    state.selection_path=state.selection_path.filter(x=>ids.has(x));
    if(!ids.has(state.section_uuid))state.section_uuid=state.selection_path[0]||null;
    const all=new Set(model.tickets.flatMap(t=>t.records.map(x=>x.uuid).concat(Object.keys(t.lineage||{}).filter(id=>t.lineage[id].fully_superseded))));
    state.expanded=Object.fromEntries(Object.entries(state.expanded).filter(([key])=>all.has(key)));
    if(state.focus?.target_uuid&&!all.has(state.focus.target_uuid))state.focus=state.section_uuid?{ticket_uuid:state.ticket_uuid,target_uuid:state.section_uuid,role:'name'}:null;
    if(state.focus?.ticket_uuid&&!tickets.has(state.focus.ticket_uuid))state.focus=null;
    if(state.modal){const t=tickets.get(state.modal.ticket_uuid),m=state.modal;
      const retained=m.mode==='replacement'&&t?.lineage?.[m.target_uuid]?.fully_superseded?t.snapshot.revisions.find(x=>x.uuid===m.target_uuid&&x.lifecycle==='live'&&t.snapshot.current.some(p=>p.entry_uuid===x.uuid&&p.revision_uuid===x.revision_uuid)):null;
      const found=m.selector==='pinned'?t?.snapshot.revisions.find(x=>x.uuid===m.target_uuid&&x.revision_uuid===m.revision_uuid):t?.records.find(x=>x.uuid===m.target_uuid)||retained;
      if(m.return_focus?.target_uuid&&!all.has(m.return_focus.target_uuid))m.return_focus=state.section_uuid?{ticket_uuid:state.ticket_uuid,target_uuid:state.section_uuid,role:'name'}:null;
      if(!found){state.modal=null;state.focus=state.section_uuid?{ticket_uuid:state.ticket_uuid,target_uuid:state.section_uuid,role:'name'}:null;}
    }
    return state;
  }
  function open(model,getStorage,onNotice){
    const key=JSON.stringify({framework_uuid:model.framework_uuid,plan_uuid:model.plan_uuid,view_kind:model.view_kind,version:VERSION});
    let state=defaults(model.ticket_uuid),disabled=false;
    const fail=reason=>{disabled=true;onNotice('View restoration unavailable ('+reason+'). Read-only content remains available.');};
    try{const raw=getStorage().getItem(key);if(raw!==null){const stored=JSON.parse(raw);if(!valid(stored))throw Error('invalid shape');state=stored;}}
    catch(error){fail(error instanceof SyntaxError||error.message==='invalid shape'?'corrupt saved state':'storage access denied');}
    state=reconcile(state,model);
    return {key,get:()=>state,set:value=>{state=value;if(disabled)return;try{getStorage().setItem(key,JSON.stringify(state));}catch(_){fail('storage write failed or quota exceeded');}}};
  }
  return {defaults,valid,reconcile,path,open};
})();
