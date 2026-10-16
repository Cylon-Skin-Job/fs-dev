/* Portable ticket hierarchy with independent keyboard-accessible hit targets. */
globalThis.LPTree = function ({ticket, onDetail, onToggle, onCopy, expanded = {}, selectedSection = null}) {
  const container = document.createElement('div'); container.className = 'rv-ticket'; container.dataset.ticketUuid = ticket.root.uuid;
  const logo = document.createElement('button'); logo.type='button'; logo.className='rv-logo';
  logo.dataset.focusRole='logo'; logo.dataset.targetUuid=ticket.root.uuid;
  logo.textContent = ticket.root.body.number + '. ' + ticket.root.body.title; logo.onclick = () => onCopy(logo.textContent);
  const status = document.createElement('p'); status.textContent = 'Captured '+ticket.root.body.state+' Ticket · source mapping does not mark work delivered';
  container.append(logo,status);
  function row(item, children) {
    const group = document.createElement('section'); group.className='rv-node'; group.dataset.nodeUuid=item.uuid;
    const header=document.createElement('div'); header.className='rv-row';
    const open=Object.hasOwn(expanded,item.uuid)?expanded[item.uuid]:true;
    const toggle=document.createElement('button'); toggle.type='button'; toggle.className='rv-chevron'; toggle.textContent=open?'▾':'▸'; toggle.setAttribute('aria-label','Expand '+item.body.title); toggle.setAttribute('aria-expanded',String(open));
    if(item.kind==='workflow_node'&&item.uuid===ticket.discussions?.current_phase_node_uuid){group.dataset.currentPhase='true';group.setAttribute('aria-current','step');}
    const name=document.createElement('button'); name.type='button'; name.className='rv-name'; name.textContent=(item.kind==='workflow_node'&&(item.body.title==='Ticket Created'||ticket.discussions?.phase_checks?.[item.uuid])?'✓ ':'')+item.body.title; name.onclick=()=>onDetail(item.uuid,'definition');
    const description=document.createElement('button'); description.type='button'; description.className='rv-description'; description.textContent=item.body.description || 'Inspect saved content'; description.onclick=()=>onDetail(item.uuid,'content');
    const gate=ticket.gates?.[item.uuid];if(gate){group.dataset.gateSymbol=gate.icon;name.textContent=(gate.icon==='check_circle'?'✓ ':gate.icon==='back_hand'?'✋ ':'○ ')+item.body.title;name.setAttribute('aria-label',gate.icon+' · '+item.body.title);description.textContent+=' · '+gate.reason;}
    const content=document.createElement('div'); content.className='rv-node-body';
    toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'▾':'▸';content.hidden=!open;onToggle(item.uuid,open);};
    [[toggle,'toggle'],[name,'name'],[description,'description']].forEach(([element,role])=>{element.dataset.focusRole=role;element.dataset.targetUuid=item.uuid;});
    content.hidden=!open;header.append(toggle,name,description);content.append(...children);group.append(header,content);return group;
  }
  const contentPane=document.createElement('div');contentPane.className='rv-ticket-content';contentPane.dataset.scrollKey='categories:'+ticket.root.uuid;contentPane.tabIndex=0;contentPane.dataset.focusRole='categories';
  for (const category of ticket.records.filter(x=>x.kind==='category').sort((a,b)=>a.body.order-b.body.order)) {
    const contents=ticket.records.filter(x=>x.kind==='content' && x.body.category_uuid===category.uuid);
    if (!contents.length && selectedSection!==category.uuid) continue;
    const elements=contents.map(item=>{const article=document.createElement('article');article.className='rv-content';article.dataset.nodeUuid=item.uuid;
      const button=document.createElement('button');button.type='button';button.dataset.focusRole='content';button.dataset.targetUuid=item.uuid;button.textContent=item.body.title;button.onclick=()=>onDetail(item.uuid,'content');
      const approval=ticket.approvals?.[item.uuid];if(approval){const note=document.createElement('p');note.textContent='Approval · '+approval.state;article.append(note);}
      for(const sourceId of item.body.item_uuids||[]){const entry=ticket.coverage?.entries?.find(x=>x.source_item_uuid===sourceId),note=document.createElement('p');
        const disposition=entry?.disposition;note.textContent=entry?.complete?'Source item · '+disposition.disposition+' · '+disposition.note+(disposition.disposition==='dropped'||disposition.disposition==='deferred'?' · retained source text; not current direction':' · exact mapped scope'): 'Source item · incomplete current accounting · '+(disposition?.disposition||'unmatched')+' · '+(ticket.coverage?.holds?.find(x=>x.source_item_uuid===sourceId)?.reason||'Needs explicit current item disposition');
        note.dataset.sourceItemUuid=sourceId;article.append(note);}
      const residual=ticket.lineage?.[item.uuid];if(residual?.superseded_by.length){const note=document.createElement('p');note.textContent='Partially replaced · '+residual.residual_item_uuids.length+' active source items';article.append(note);}
      const text=document.createElement('pre');text.textContent=typeof item.body.content==='string'?item.body.content:'JSON payload · Inspect saved content to view the actual payload';article.append(button,text);return article;});
    if(!contents.length){const empty=document.createElement('p');empty.textContent='No current saved content in this section.';elements.push(empty);}
    contentPane.append(row(category,elements));
  }
  if(ticket.coverage.item_count!==undefined){const ledger=document.createElement('button');ledger.type='button';ledger.dataset.targetUuid=ticket.root.uuid;ledger.dataset.focusRole='content';ledger.textContent='Source ledger · '+(ticket.coverage.complete?'complete':'incomplete')+' · '+ticket.coverage.item_count+' identified items';ledger.onclick=()=>onDetail(ticket.root.uuid,'content');contentPane.append(ledger);}
  for(const batch of ticket.records.filter(x=>x.kind==='presented_batch')){const button=document.createElement('button');button.type='button';button.dataset.targetUuid=batch.uuid;button.dataset.focusRole='content';button.textContent='Presented approvals · '+batch.body.state;button.onclick=()=>onDetail(batch.uuid,'content');contentPane.append(button);}
  for(const [id,details] of Object.entries(ticket.sources||{})){const article=document.createElement('article');article.className='rv-content';const button=document.createElement('button');button.type='button';button.dataset.targetUuid=id;button.dataset.focusRole='content';button.textContent='Source reference · '+details.source.freshness;button.onclick=()=>onDetail(id,'source');const note=document.createElement('p');note.textContent=details.source.reason+' · '+details.reconciliation.unreconciled_count+' registered entries need reconciliation · captured with this snapshot';article.append(button,note);contentPane.append(article);}
  for(const [id,details] of Object.entries(ticket.lineage||{})){if(!details.fully_superseded)continue;const button=document.createElement('button');button.type='button';button.dataset.targetUuid=id;button.dataset.focusRole='content';button.textContent='Inspect fully replaced source '+id;button.onclick=()=>onDetail(id,'replacement');contentPane.append(button);}
  const workflow=document.createElement('section');workflow.className='rv-workflow';workflow.setAttribute('aria-label','Workflow');workflow.dataset.scrollKey='workflow:'+ticket.root.uuid;workflow.tabIndex=0;workflow.dataset.focusRole='workflow';
  function discussionRow(info){
    const group=document.createElement('section');group.className='rv-node rv-discussion';group.dataset.nodeUuid=info.discussion_uuid;group.dataset.discussionState=info.state;
    const name=document.createElement('button');name.type='button';name.className='rv-name';name.textContent=info.checked?'✓ Checkpoint':'○ Active Discussion';
    const focus=document.createElement('button');focus.type='button';focus.className='rv-description';focus.textContent=info.focus;
    [[name,'name'],[focus,'description']].forEach(([button,role])=>{button.dataset.targetUuid=info.discussion_uuid;button.dataset.focusRole=role;button.onclick=()=>onDetail(info.discussion_uuid,'content');});
    group.append(name,focus);return group;
  }
  function runRow(job){const group=document.createElement('section');group.className='rv-node rv-run';group.dataset.jobUuid=job.assignment_ref.entry_uuid;
    const title=document.createElement('button');title.type='button';title.className='rv-name';title.textContent='Stored '+job.work_kind+' briefing';title.onclick=()=>onDetail(job.assignment_ref.entry_uuid,'content');group.append(title);
    for(const fact of job.dispatch_facts){const note=document.createElement('p');note.textContent='Dispatch '+fact.result+' · '+fact.provenance;group.append(note);}
    if(job.missing_start){const note=document.createElement('p');note.textContent='Missing acknowledged start';group.append(note);}
    for(const attempt of job.attempts){const line=document.createElement('button');line.type='button';line.className='rv-description';line.dataset.attemptUuid=attempt.attempt_ref.entry_uuid;line.dataset.runState=attempt.state;line.dataset.symbol=attempt.icon;line.textContent=attempt.state+' · '+(attempt.acknowledged_start?'acknowledged start':'claim only; start missing')+' · '+attempt.summary+(attempt.predecessor_attempt_uuid?' · replacement of '+attempt.predecessor_attempt_uuid:'');const symbol=document.createElement('span');symbol.className=attempt.icon==='progress_activity'?'rv-run-spinner':'rv-run-symbol';symbol.setAttribute('aria-label',attempt.icon);symbol.textContent=attempt.icon==='progress_activity'?'◌':attempt.icon==='output_circle'?'◯':attempt.icon==='check_circle'?'✓':'○';if(attempt.release){line.dataset.parentAccepted=String(attempt.release.full_scope_accepted);line.dataset.terminal=String(attempt.release.terminal);line.textContent+=' · '+(attempt.release.full_scope_accepted?'parent accepted':'parent acceptance pending')+(attempt.release.next_acknowledged_start?' · next acknowledged start':'');}line.prepend(symbol);line.onclick=()=>onDetail(attempt.attempt_ref.entry_uuid,'content');group.append(line);}
    return group;}
  function node(item){const children=ticket.records.filter(x=>x.kind==='workflow_node'&&x.body.parent_uuid===item.uuid).map(node);
    children.push(...Object.values(ticket.runs||{}).filter(x=>x.node_uuid===item.uuid).map(runRow));
    children.push(...(ticket.discussions?.discussions||[]).filter(x=>x.phase_node_uuid===item.uuid).map(discussionRow));return row(item,children);}
  workflow.append(...ticket.records.filter(x=>x.kind==='workflow_node'&&x.body.parent_uuid===null).sort((a,b)=>a.body.order-b.body.order).map(node));
  const columns=document.createElement('div');columns.className='rv-ticket-columns';columns.append(workflow,contentPane);container.append(columns);return container;
};
