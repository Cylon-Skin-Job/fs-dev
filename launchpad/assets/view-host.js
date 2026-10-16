/* Connected static host: captured content, presentation restore and clipboard. */
(() => {
  // Canonical content loads first. Presentation storage cannot replace the model.
  const model=LPModel.project(JSON.parse(document.getElementById('rv-snapshot').textContent));
  const root=document.getElementById('rv-root');let restoring=true,dialog=null;
  const header=document.createElement('header');header.className='rv-header';
  const title=document.createElement('h1');title.textContent=model.plan.body.title;
  const selector=document.createElement('select');selector.setAttribute('aria-label','Named plan');selector.dataset.focusRole='selector';
  model.plans.forEach(plan=>{const option=document.createElement('option');option.value=plan.uuid;option.textContent=plan.title;option.selected=plan.uuid===model.plan_uuid;selector.append(option);});
  const latest=document.createElement('option');latest.value='latest';latest.textContent='Browse latest named plans';selector.append(latest);
  selector.onchange=()=>{if(selector.value==='latest'){location.href=model.latest_plans_url;return;}const target=model.plans.find(x=>x.uuid===selector.value);if(target)location.href=target.current_entry_url;};
  const generation=document.createElement('p');generation.className='rv-generation';generation.textContent='Snapshot '+model.generation+' · '+model.render_version+' · '+model.tickets.length+' records · manual refresh';
  header.append(title,selector,generation);root.append(header);
  function notice(message){if(header.querySelector('.rv-notice'))return;const element=document.createElement('p');element.className='rv-notice';element.setAttribute('role','status');element.textContent=message;header.append(element);}
  const storage=LPViewState.open(model,()=>localStorage,notice);let state=storage.get();
  const body=document.createElement('div');body.className='rv-body';root.append(body);
  const ticketFor=id=>model.tickets.find(x=>x.root.uuid===id);
  function focused(element){const role=element?.dataset?.focusRole;if(!role)return null;
    return {ticket_uuid:element.closest('.rv-ticket')?.dataset.ticketUuid||state.modal?.ticket_uuid||null,target_uuid:element.dataset.targetUuid||null,role};}
  function findFocus(value){if(!value)return null;
    return [...root.querySelectorAll('[data-focus-role]')].find(x=>x.dataset.focusRole===value.role&&(x.dataset.targetUuid||null)===value.target_uuid&&(!value.ticket_uuid||x.closest('.rv-ticket')?.dataset.ticketUuid===value.ticket_uuid||x.closest('dialog')||['card','blocked'].includes(value.role))&&!x.closest('[hidden]'));
  }
  function capture(){state.scroll.main={x:scrollX,y:scrollY};
    root.querySelectorAll('[data-scroll-key]').forEach(x=>{state.scroll.containers[x.dataset.scrollKey]={x:x.scrollLeft,y:x.scrollTop};});
    const focus=focused(document.activeElement);if(focus)state.focus=focus;
  }
  function save(){if(restoring)return;capture();storage.set(state);}
  function selectTarget(ticket,id){state.selection_path=LPViewState.path(ticket,id);
    state.section_uuid=state.selection_path.find(uuid=>{const r=ticket.records.find(x=>x.uuid===uuid)||LPModel.records(ticket.snapshot).find(x=>x.uuid===uuid);return r&&(r.kind==='category'||(r.kind==='workflow_node'&&r.body.parent_uuid===null));})||null;}
  function restoreLayout(){restoring=true;storage.set(state);requestAnimationFrame(()=>requestAnimationFrame(()=>{
    findFocus(state.focus)?.focus({preventScroll:true});
    root.querySelectorAll('[data-scroll-key]').forEach(x=>{const offset=state.scroll.containers[x.dataset.scrollKey];if(offset){x.scrollLeft=Math.min(offset.x,Math.max(0,x.scrollWidth-x.clientWidth));x.scrollTop=Math.min(offset.y,Math.max(0,x.scrollHeight-x.clientHeight));}});
    scrollTo(Math.min(state.scroll.main.x,Math.max(0,document.documentElement.scrollWidth-innerWidth)),Math.min(state.scroll.main.y,Math.max(0,document.documentElement.scrollHeight-innerHeight)));
    restoring=false;save();
  }));}
  async function copy(value,element){try{await navigator.clipboard.writeText(value);}catch(_){
    const target=element||body.querySelector('.rv-logo');let message=target?.parentElement.querySelector('.rv-copy-notice');
    if(!message){message=document.createElement('p');message.className='rv-notice rv-copy-notice';message.setAttribute('role','status');message.textContent='Copy unavailable. Select the displayed text.';target?.before(message);}
    if(target?.tagName==='PRE'){target.focus();const range=document.createRange();range.selectNodeContents(target);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);}
    else if(target){const fallback=document.createElement('pre');fallback.className='rv-copy-fallback';fallback.tabIndex=0;fallback.textContent=value;target.after(fallback);}
  }}
  function modalRecord(m){const ticket=ticketFor(m.ticket_uuid);return m.selector==='pinned'?ticket?.snapshot.revisions.find(x=>x.uuid===m.target_uuid&&x.revision_uuid===m.revision_uuid):ticket&&LPModel.records(ticket.snapshot).find(x=>x.uuid===m.target_uuid);}
  function showModal(){const m=state.modal,record=m&&modalRecord(m);if(!record)return;
    let value=record,title=record.body.title;
    const ticket=ticketFor(m.ticket_uuid),lineage=ticket?.lineage?.[record.uuid];
    if(record.kind==='ticket'){title='Current Ticket and source ledger';value={record,ledger_ticket_revision_uuid:ticket.root.revision_uuid,source_ledger:ticket.coverage,observation_scope:'Ledger captured with the current view generation; pinned Ticket retains its exact record and does not certify historical ledger completeness.'};}
    if(record.kind==='content'&&ticket.approvals?.[record.uuid])value={record,current_revision_uuid:LPModel.records(ticket.snapshot).find(x=>x.uuid===record.uuid)?.revision_uuid,current_approval:ticket.approvals[record.uuid],observation_scope:'Approval belongs to the named current revision; retained pins do not inherit approval.'};
    if(record.kind==='discussion'){title=record.body.state==='closed'?'Checkpoint saved log':'Active Discussion saved log';
      if(m.selector==='pinned'){
        const checkpoint=ticket.snapshot.revisions.find(x=>record.body.accepted_checkpoint_ref?.revision_uuid===x.revision_uuid);
        const covered=checkpoint?.body.coverage_refs||[],journals=ticket.snapshot.revisions.filter(x=>x.kind==='journal_entry'&&x.body.discussion_uuid===record.uuid);
        const upper=Math.max(record.body.opened_seq,...journals.filter(x=>x.revision_uuid===record.body.latest_direct_entry_ref?.revision_uuid).map(x=>x.body.commit_seq));
        const items=checkpoint?covered.map(pin=>journals.find(x=>x.uuid===pin.entry_uuid&&x.revision_uuid===pin.revision_uuid)).filter(Boolean):journals.filter(x=>x.body.commit_seq<=upper);
        value={discussion:record,checkpoint:checkpoint||null,saved_entries:items,uncovered_entry_refs:checkpoint?(ticket.discussions?.logs?.[record.uuid]?.uncovered_entry_refs||[]):items.map(x=>({entry_uuid:x.uuid,revision_uuid:x.revision_uuid})),coverage:'Exact retained discussion/checkpoint revision; saved journal coverage excludes sibling/tail and native history is separate',observation_scope:checkpoint?'Pinned entries follow exact frozen coverage; uncovered tail references belong to the separately captured current saved log.':'Exact retained open-discussion pointer; no accepted checkpoint coverage.'};}
      else value=ticket.discussions?.logs?.[record.uuid]||{discussion:record,gap:'Saved log unavailable in captured view'};}
    if(record.kind==='reference'){title='Source reference';value=LPModel.sourceInspection(record,ticket,m.selector);}
    if(m.mode==='replacement'){title='Retained replacement source';value={record,lineage};}
    const prompt=ticket?.prompts?.[record.uuid];
    if(prompt&&['workflow_node','assignment','attempt'].includes(record.kind)){
      const scope='Authored definition, supplied briefing and acknowledged load remain distinct; an unknown provider is labeled unknown and is never guessed.';
      value=m.mode==='definition'?{...prompt,record,observation_scope:scope}:{record,prompt_evidence:prompt,observation_scope:scope};
      if(m.mode==='definition')title='Definition, supplied briefing and acknowledged load';
    }
    if(m.mode==='definition'&&record.kind==='workflow_node'&&!prompt){const definition=ticketFor(m.ticket_uuid).snapshot.revisions.find(x=>x.revision_uuid===record.body.definition_ref.revision_uuid);
      value={definition_snapshot:definition,actual_supplied_assignment:'Unknown / not started',acknowledged_loaded_evidence:null};}
    if(m.mode==='blocked'){title='Blocked reason / release';value={reason:'Seed awaits an owner-designated discussion and readiness review.',owner:'Assigned Launchpad',release:'Explicit reviewed prerequisite and owner gates.'};}
    const currentDialog=LPModal({title,value,selector:m.selector,scrollKey:'modal:'+m.target_uuid,onCopy:copy,
      onSelector:selection=>{capture();const focus=state.focus;state.modal={...m,selector:selection,revision_uuid:selection==='pinned'?record.revision_uuid:null};dialog.remove();dialog=null;showModal();state.focus={...focus,role:selection==='pinned'?'modal-current':'modal-pin'};restoreLayout();},
      onClose:()=>{if(dialog!==currentDialog)return;dialog=null;state.modal=null;state.focus=m.return_focus;storage.set(state);findFocus(state.focus)?.focus({preventScroll:true});save();}});
    dialog=currentDialog;root.append(dialog);dialog.showModal();
  }
  function detail(ticket,id,mode,selection='current',revision=null){if(!ticket.records.find(x=>x.uuid===id)&&selection!=='pinned'&&!(mode==='replacement'&&LPModel.records(ticket.snapshot).some(x=>x.uuid===id)))return;
    selectTarget(ticket,id);state.modal={ticket_uuid:ticket.root.uuid,target_uuid:id,mode,selector:selection,revision_uuid:revision,return_focus:focused(document.activeElement)};
    storage.set(state);save();showModal();save();}
  function showTicket(id,initial=false){if(!initial)save();state.ticket_uuid=id;body.replaceChildren();const ticket=ticketFor(id);if(!ticket)return;
    if(model.view_kind==='plan'){const back=document.createElement('button');back.type='button';back.textContent='Back to plan';back.dataset.focusRole='back';back.onclick=()=>showPlan();body.append(back);}
    body.append(LPTree({ticket,expanded:state.expanded,selectedSection:state.section_uuid,onDetail:(target,mode)=>detail(ticket,target,mode),onToggle:(target,open)=>{state.expanded[target]=open;selectTarget(ticket,target);storage.set(state);save();},onCopy:value=>copy(value)}));
    if(!initial){state.modal=null;state.focus={ticket_uuid:id,target_uuid:id,role:'logo'};restoreLayout();}}
  function showPlan(initial=false){if(!initial)save();state.ticket_uuid=null;body.replaceChildren();const viewport=document.createElement('div');viewport.className='rv-timeline-viewport';viewport.tabIndex=0;viewport.dataset.focusRole='timeline';viewport.dataset.scrollKey='timeline:'+model.plan_uuid;
    const timeline=document.createElement('div');timeline.className='rv-timeline';
    const geometry=LPLayout(model);timeline.style.setProperty('--timeline-width',geometry.width+'px');timeline.style.setProperty('--timeline-height',geometry.height+'px');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('rv-links');svg.setAttribute('viewBox',`0 0 ${geometry.width} ${geometry.height}`);svg.setAttribute('aria-label','Main rail with four branch fan-out and convergence');
    geometry.rails.forEach(rail=>{const path=document.createElementNS(svg.namespaceURI,'path');path.classList.add('rv-'+rail.kind+'-rail');path.setAttribute('d',rail.points.map((p,i)=>(i?'L':'M')+p.join(',')).join(' '));svg.append(path);});timeline.append(svg);
    geometry.tracks.forEach((track,index)=>{const name=document.createElement('h2');name.className='rv-track-title';name.dataset.trackUuid=track.uuid;name.textContent=track.title;name.style.setProperty('--track-y',(geometry.trackYs[index]-52)+'px');timeline.append(name);});
    const main=document.createElement('h2');main.className='rv-track-title';main.textContent='main';main.style.setProperty('--track-y',(geometry.mainY-52)+'px');timeline.append(main);
    model.tickets.forEach(ticket=>{const position=geometry.positions.get(ticket.root.uuid);if(!position)return;const card=LPCard({ticket,onOpen:showTicket,onBlocked:()=>detail(ticket,ticket.root.uuid,'blocked')});
      [[card.querySelector('.rv-card-open'),'card'],[card.querySelector('.rv-blocked'),'blocked']].forEach(([x,role])=>{x.dataset.focusRole=role;x.dataset.targetUuid=ticket.root.uuid;});
      card.style.setProperty('--card-x',position.left+'px');card.style.setProperty('--card-y',position.y+'px');timeline.append(card);});viewport.append(timeline);body.append(viewport);
    if(!initial){state.modal=null;state.focus={ticket_uuid:null,target_uuid:null,role:'timeline'};restoreLayout();}}
  root.addEventListener('focusin',event=>{if(restoring)return;const focus=focused(event.target);if(focus){state.focus=focus;const ticket=ticketFor(focus.ticket_uuid);if(ticket&&focus.target_uuid)selectTarget(ticket,focus.target_uuid);}save();});
  document.addEventListener('scroll',save,true);addEventListener('pagehide',save);addEventListener('beforeunload',save);
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  globalThis.LPHost={model,showTicket,showPlan,detail:(ticket,id,mode,selection,revision)=>detail(ticket,id,mode,selection,revision),storageKey:storage.key};
  state.ticket_uuid?showTicket(state.ticket_uuid,true):showPlan(true);showModal();restoreLayout();
})();
