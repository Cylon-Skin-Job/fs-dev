"""Validate the complete prospective A02 record transaction before staging."""
import copy
from . import authorization, seed, records as typed_records, relations, sources, coverage, decisions, discussions, journal, checkpoints, state_check, support, assignments, attempts, reviews, acceptance, rework, workflow, checklist, integration
from .schema import fail, current, record, schema, validate, ContractError
from .store import uid, now, ref, envelope, container, digest

OPERATIONS=reviews.OPERATIONS|rework.OPERATIONS|assignments.OPERATIONS|attempts.OPERATIONS|typed_records.OPERATIONS|relations.OPERATIONS|{'record.update','record.create','issue.create','acceptance.record','ticket.create','ticket.seed_apply','record.merge'}|decisions.OPERATIONS|discussions.OPERATIONS|{'actor.bind'}|checkpoints.OPERATIONS|state_check.OPERATIONS|support.OPERATIONS|workflow.OPERATIONS|checklist.OPERATIONS|integration.OPERATIONS
GENERIC={'content','category','edge','reference'}
REGISTRY={x['operation']:x for x in schema('operations.json')['operations']}


def changed(old, body, sources, extensions, actor):
    if (old['body'],old['source_refs'],old['extensions'])==(body,sources,extensions):return old
    item=copy.deepcopy(old)
    item['lifecycle_evidence']={k:None for k in old['lifecycle_evidence']}
    item.update(body=copy.deepcopy(body),source_refs=copy.deepcopy(sources),extensions=copy.deepcopy(extensions),
                revision_uuid=uid(),last_updated=now(),writer=seed.writer(actor))
    record(item)
    return item


def invalidate_acceptances(items, subjects, expected, actor):
    return rework.invalidate(items,subjects,expected,actor)


def prepare(root, request, actor, assignment, plan, tickets, expected, coverage_rows=None):
    """Return in-memory complete plan records and changed child snapshots."""
    if request['operation']=='intake.route':typed_records.verify_route(root,request,actor,assignment,plan,tickets)
    if request['operation']=='workflow.edit_apply':workflow.verify_apply(root,request,actor,assignment,plan,tickets)
    if request['operation']=='checklist.reconcile_apply':checklist.verify_apply(root,request,actor,assignment,plan,tickets)
    combined=('transaction.apply','intake.route','workflow.edit_apply','checklist.reconcile_apply')
    rows=coverage_rows if coverage_rows is not None else request['args'].get('coverage_rows',[]) if request['operation'] in ('intake.route','workflow.edit_apply','checklist.reconcile_apply') else []
    operations=copy.deepcopy(request['args']['operations']) if request['operation'] in combined else [dict(operation=request['operation'],args=request['args'])]
    for sub in operations:
        op=sub['operation']
        if op not in OPERATIONS:fail('Suboperation unavailable in A02','UNSUPPORTED_OPERATION')
        if op not in actor['body']['granted_operations']:fail('Suboperation grant absent','FORBIDDEN')
        validate(sub['args'],REGISTRY[op]['args_schema'])
    records=copy.deepcopy(current(plan));prospective=copy.deepcopy(tickets)
    selected=request['scope'].get('ticket_uuid');dirty=set();updated=set();support_guards=[]
    for position,sub in enumerate(operations):
        for guard in support_guards:
            if guard['end']==position:
                guard['images']=support.prospective_dependencies(root,records,prospective,guard['pins'],exact=False)
        op,args=sub['operation'],sub['args'];trial={**request,'operation':op,'args':args,'expected':expected}
        if op=='state.check':
            state_check.apply(root,args,actor,assignment,plan,tickets,records,expected,request['scope'])
            continue
        if op=='support.report_submit':
            if selected not in tickets:fail('Exact support ticket required','MISSING_EVIDENCE')
            support.submit(root,args,actor,assignment,plan,tickets,records,expected)
            continue
        if op=='support.integrate':
            if selected not in tickets:fail('Exact support ticket required','MISSING_EVIDENCE')
            suggested,event,images=support.integration(root,args,actor,assignment,plan,tickets,records,expected,selected)
            support.validate_final(root,records,prospective,images)
            pins=[ref(x['record']) for x in images]
            # Insert into this same canonical prospective transaction. This is
            # the existing edit engine, not a second patch publisher.
            if len(operations)+len(suggested)>100:fail('Expanded support transaction exceeds 100 operations','INVALID_SCHEMA')
            operations[position+1:position+1]=copy.deepcopy(suggested)
            support_guards.append(dict(end=position+1+len(suggested),pins=pins))
            continue
        if op=='actor.bind':
            authorization.bind_actor(root,args,actor,assignment,plan,tickets,records,expected)
            continue
        if op=='ticket.create':
            shadow=container('plan',plan['root_uuid'],records,plan['root_revision_uuid'],plan['commit_seq'],plan['idempotency_receipt_refs'])
            ticket,layout=seed.mint(root,trial,actor,assignment,shadow,prospective)
            records.append(layout);next(x for x in records if x['kind']=='plan')['body']['layout_refs'].append(ref(layout))
            # Make subsequent home collision checks see the new prospective member.
            next(x for x in records if x['kind']=='plan')['body']['ticket_bindings'].append(dict(ticket_uuid=ticket['root_uuid'],ticket_revision_uuid=ticket['root_revision_uuid'],relative_path=next(x for x in current(ticket) if x['kind']=='ticket')['body']['current_home']+'/.revisions/'+ticket['root_revision_uuid']+'/ticket.json',sha256=digest(ticket),current_home=args['ticket_folder']))
            prospective[ticket['root_uuid']]=ticket;dirty.add(ticket['root_uuid']);continue
        if selected not in prospective:fail('Exact selected ticket required','MISSING_EVIDENCE')
        ticket=prospective[selected];items=copy.deepcopy(current(ticket));by_id={x['uuid']:x for x in items}
        if op=='ticket.seed_apply':
            if selected in dirty:fail('Dependent seed edit requires a separate inspected transaction','INVALID_TRANSITION')
            from .transaction import seed_expectations
            value=seed.apply_seed(root,trial,actor,assignment,ticket,rows);seed_expectations(trial,ticket,value)
            if value!=ticket:
                seeded=copy.deepcopy(current(value))
                subjects={x['uuid'] for x in seeded if x['kind']=='content' and x['uuid'] in by_id and x['revision_uuid']!=by_id[x['uuid']]['revision_uuid']}
                if invalidate_acceptances(seeded,subjects,expected,actor):
                    target=next(x for x in seeded if x['kind']=='ticket')
                    target['body']['record_refs']=[ref(x) for x in seeded if x['kind']!='ticket']
                    rebuilt=container('ticket',value['root_uuid'],seeded,value['root_revision_uuid'],value['commit_seq'],value['idempotency_receipt_refs'])
                    known={x['revision_uuid'] for x in seeded}
                    rebuilt['revisions'] += [x for x in value['revisions'] if x['revision_uuid'] not in known]
                    value=rebuilt
                prospective[selected]=value;dirty.add(selected)
            continue
        if op in assignments.OPERATIONS:
            item=assignments.apply(root,op,args,actor,assignment,plan,tickets,items,expected,selected)
        elif op in reviews.OPERATIONS:
            item=reviews.apply(root,op,args,actor,assignment,plan,tickets,items,expected)
        elif op in rework.OPERATIONS:
            item=rework.apply(root,args,actor,assignment,plan,tickets,items,expected)
        elif op in attempts.OPERATIONS:
            item=attempts.apply(root,op,args,actor,assignment,plan,tickets,items,expected)
        elif op=='discussion.register':
            item,created=discussions.register(root,args,actor,assignment,plan,tickets,ticket,items,expected)
            if not created:continue
        elif op=='discussion.summary_record':
            item=journal.append(root,args,actor,assignment,plan,tickets,ticket,items,expected)
        elif op in checkpoints.OPERATIONS:
            item=checkpoints.apply(root,op,args,actor,assignment,plan,tickets,ticket,items,expected)
        elif op=='record.merge':
            item=coverage.merge(root,args,actor,assignment,plan,tickets,items,expected,rows)
            invalidate_acceptances(items,{args['uuid'],args['target_uuid']},expected,actor)
        elif op in decisions.OPERATIONS:
            item=decisions.apply(root,op,args,actor,assignment,plan,tickets,items,expected)
        elif op in relations.OPERATIONS:
            item=relations.apply(root,args,actor,assignment,plan,tickets,items,expected)
            invalidate_acceptances(items,{args['old_uuid']},expected,actor)
        elif op in typed_records.OPERATIONS:
            item=typed_records.apply(root,op,args,actor,assignment,plan,tickets,ticket,items,expected)
            if item==by_id.get(item['uuid']):continue
            if op!='record.clone':invalidate_acceptances(items,{item['uuid']},expected,actor)
        elif op=='record.update' and request['operation']=='workflow.edit_apply' and by_id.get(args['uuid'],{}).get('kind')=='workflow_node':
            item=workflow.update_node(args,actor,items,expected,by_id[args['uuid']])
        elif op=='record.update':
            old=by_id.get(args['uuid'])
            if not old:fail('Record is not in selected ticket','FORBIDDEN')
            if old['uuid'] in updated:fail('Multiple edits to same identity require explicit combined body')
            updated.add(old['uuid'])
            if old['kind'] not in GENERIC or old['lifecycle']!='live':fail('Protected or inactive record','FORBIDDEN')
            if expected.get(old['uuid'])!=old['revision_uuid']:
                raise ContractError('REVISION_CONFLICT','Exact touched object expectation required',{old['uuid']:old['revision_uuid']})
            validate(args['body'],schema('record.schema.json')['$defs'][old['kind']])
            if old['kind']=='content':
                if old['body']['authority']=='owner_decision' or old['body']['authority']!=args['body']['authority']:
                    fail('Generic edit cannot forge owner authority','FORBIDDEN')
                if old['body']['category_uuid']!=args['body']['category_uuid']:
                    fail('Routing requires its named operation','FORBIDDEN')
                coverage.removal(rows,old['body']['item_uuids'],args['body']['item_uuids'])
                decisions_category=next((x for x in items if x['uuid']==old['body']['category_uuid']),None)
                if decisions.requires_presentation(old,items,ticket['revisions']) and args['body']['state']!='pending':fail('Interpretations require named reviewed approval','FORBIDDEN')
                if decisions_category and decisions_category['body'].get('category_key')=='issues' and old['body']['state']=='pending' and args['body']['state']=='active':
                    fail('Issue resolution is derived from exact accepted replacement evidence, not a generic state edit','FORBIDDEN')
            if any(x not in args['source_refs'] for x in old['source_refs']):fail('Generic edit cannot drop source lineage','FORBIDDEN')
            dependencies=[args['body']['category_uuid']]+args['body']['item_uuids'] if old['kind']=='content' else [args['body']['parent_uuid']] if old['kind']=='category' else [args['body']['from_uuid'],args['body']['to_uuid']] if old['kind']=='edge' else []
            local={x['uuid']:x for x in current(tickets[selected])}
            for key in dependencies:
                if key in local and expected.get(key)!=local[key]['revision_uuid']:fail('Exact named dependency expectation required','REVISION_CONFLICT')
            if old['kind']=='edge' and (old['body']['edge_kind']=='supersedes' or args['body']['edge_kind']=='supersedes'):fail('Replacement edges are immutable; use named supersession','FORBIDDEN')
            if old['kind']=='edge':authorization.authority(root,plan,tickets,args['body']['authority_ref'],assignment,expected)
            item=changed(old,args['body'],args['source_refs'],args.get('extensions',old['extensions']),actor)
            if item==old:continue
            items[items.index(old)]=item
            invalidate_acceptances(items,{old['uuid']},expected,actor)
        elif op in ('record.create','issue.create'):
            kind=args.get('kind','content');body=args['body']
            if request['operation']=='workflow.edit_apply' and kind=='workflow_node':
                item=workflow.create_node(args,actor,items,expected)
            elif request['operation']=='workflow.edit_apply' and kind=='edge' and body['edge_kind']=='dependency':
                validate(body,schema('record.schema.json')['$defs']['edge'])
                item=envelope(kind,copy.deepcopy(body),seed.writer(actor),copy.deepcopy(args.get('source_refs',[])))
                item['extensions']=copy.deepcopy(args.get('extensions',{}));record(item);items.append(item)
            else:
                if kind not in GENERIC:fail('Protected records require named operations','FORBIDDEN')
                if kind=='edge' and body['edge_kind'] in ('supersedes','repair_of'):fail('Protected causal edges require named operations','FORBIDDEN')
                validate(body,schema('record.schema.json')['$defs'][kind])
                if kind=='content' and body['authority'] not in ('proposal','implementation_choice'):fail('Generic creation cannot confer source/owner authority','FORBIDDEN')
                if op=='issue.create' and (body['item_uuids']!=args['item_uuids'] or body['authority']!='proposal' or body['state']!='pending'):
                    fail('Issue requires explicit pending proposal body/items')
                if kind=='content' and body['authority'] in ('proposal','implementation_choice') and any(x['uuid']==body['category_uuid'] and x['kind']=='category' and x['body'].get('category_key')=='decisions' for x in ticket['revisions']+items) and body['state']!='pending':fail('Decision interpretations remain pending','FORBIDDEN')
                item=envelope(kind,copy.deepcopy(body),seed.writer(actor),args['source_refs'])
                item['extensions']=copy.deepcopy(args.get('extensions',{}));record(item);items.append(item)
        elif op=='acceptance.record' and acceptance.apply(root,args,actor,assignment,plan,tickets,items,expected):
            pass
        elif op=='acceptance.record':
            if assignment['body']['manager_uuid']!=actor['uuid']:fail('Responsible assigned parent required','FORBIDDEN')
            authority=authorization.authority(root,plan,tickets,args['authority_ref'],assignment,expected)
            instruction=authorization.dependency(root,plan,tickets,args['original_instruction_ref'],expected)
            if instruction!=authority:fail('Original acceptance must pin the assigned owner evidence','FORBIDDEN')
            subjects=[authorization.dependency(root,plan,tickets,{**r,'scope_item_uuids':[]},expected) for r in args['subject_refs']]
            if any(decisions.requires_presentation(x,items,ticket['revisions'],pin['scope_item_uuids']) for x,pin in zip(subjects,args['subject_refs'])):fail('Decision approval requires exact presented batch and original scoped instruction','FORBIDDEN')
            if any(x['kind']!='content' for x in subjects):fail('Native/run acceptance requires LP04 gates','UNSUPPORTED_OPERATION')
            if not subjects or any(x['uuid'] not in by_id for x in subjects):fail('Subjects must belong to selected ticket','FORBIDDEN')
            if any(len(pin['scope_item_uuids'])!=len(set(pin['scope_item_uuids'])) or set(pin['scope_item_uuids'])-set(item['body']['item_uuids']) for item,pin in zip(subjects,args['subject_refs'])):fail('Acceptance scope must name actual unique subject items')
            if not args['gate_refs']:fail('Independent gate required','MISSING_EVIDENCE')
            for pin in args['gate_refs']:
                gate=authorization.dependency(root,plan,tickets,pin,expected)
                b=gate['body']
                if gate['kind']!='review' or b['verdict']!='pass' or b['finding_refs'] or b['subject_refs']!=args['subject_refs'] or b['subject_digest']!=args['subject_digest']:
                    fail('Current-byte passing gate must cover exact subjects','MISSING_EVIDENCE')
                if b['reviewer_actor_uuid'] in {actor['uuid']}|{x['writer']['actor_uuid'] for x in subjects} or gate['writer']['actor_uuid']!=b['reviewer_actor_uuid']:
                    fail('Producer cannot accept its own review','FORBIDDEN')
                if not b['evidence_refs']:fail('Gate must retain actual evidence','MISSING_EVIDENCE')
                for evidence in b['evidence_refs']+[b['report_ref']]:authorization.dependency(root,plan,tickets,evidence,expected)
            body=copy.deepcopy(args);body.update(accepting_actor_uuid=actor['uuid'],state='active',invalidation_reason=None)
            items.append(envelope('acceptance',body,seed.writer(actor)))
        elif op in integration.OPERATIONS:
            if op=='integration.record':item=integration.record(root,args,actor,assignment,plan,tickets,items,expected)
            elif op=='ticket.finalize':item=integration.finalize(root,args,actor,assignment,plan,tickets,items,expected)
            else:item=integration.release_check(root,args,actor,assignment,plan,tickets,items,expected)
        if op in ('record.update','record.create','issue.create','record.merge') or op in typed_records.OPERATIONS or op in relations.OPERATIONS or op=='decision.record':
            local={x['uuid']:x for x in current(tickets[selected])}
            prior=local.get(item['uuid'])
            from pathlib import Path
            from .store import file_hash
            for pin in item['source_refs']:
                if prior and pin in prior['source_refs']:continue
                path=Path(pin['locator'])
                if not path.is_absolute() or path.is_symlink() or not path.is_file() or not any(path.resolve().is_relative_to(base.resolve()) for base in [Path(assignment['body']['source_checkout']),Path(root)/'.evidence']) or file_hash(path)!=pin['sha256']:
                    fail('New source pin must resolve exact assigned bytes','SOURCE_UNVERIFIED')
            dependencies=[item['body'].get('category_uuid')]+item['body'].get('item_uuids',[]) if item['kind']=='content' else [item['body']['parent_uuid']] if item['kind']=='category' else []
            for key in dependencies:
                if key in local and expected.get(key)!=local[key]['revision_uuid']:fail('Exact content dependency expectation required','REVISION_CONFLICT')
        validate_relations(root,plan,tickets,items,assignment,expected)
        target=next(x for x in items if x['kind']=='ticket')
        if op in ('discussion.summary_record','checkpoint.close'):
            target['body']['current_workflow_node_uuid']=discussions.projection(items,target['body']['current_workflow_node_uuid'])['current_phase_node_uuid']
        target['body']['record_refs']=[ref(x) for x in items if x['kind']!='ticket']
        target['body']['category_refs']=[ref(x) for x in items if x['kind']=='category']
        target.update(revision_uuid=uid(),last_updated=now(),writer=seed.writer(actor))
        value=container('ticket',ticket['root_uuid'],items,seq=plan['commit_seq']+1)
        known={x['revision_uuid'] for x in items}
        value['revisions'] += [x for x in ticket['revisions'] if x['revision_uuid'] not in known]
        prospective[selected]=value;dirty.add(selected)
    for guard in support_guards:
        if guard['end']==len(operations):
            guard['images']=support.prospective_dependencies(root,records,prospective,guard['pins'],exact=False)
    if rows:
        if selected not in prospective:fail('Coverage needs a related owned ticket','INVALID_TRANSITION')
        value=prospective[selected];items=copy.deepcopy(current(value))
        captured=current(tickets[selected])
        affected={key for sub in operations for old in captured if old['uuid'] in (sub['args'].get('uuid'),sub['args'].get('target_uuid')) for key in old['body'].get('item_uuids',[])}
        if any(sub['operation']=='ticket.seed_apply' for sub in operations):affected.update(x['uuid'] for x in captured if x['kind']=='source_item')
        coverage.required(rows,affected)
        coverage.apply_rows(root,request,actor,assignment,plan,tickets,items,rows,captured)
        if items==current(value):
            items=None
        if items is not None:
            dirty.add(selected)
            target=next(x for x in items if x['kind']=='ticket');target['body']['record_refs']=[ref(x) for x in items if x['kind']!='ticket']
            target.update(revision_uuid=uid(),last_updated=now(),writer=seed.writer(actor))
            rebuilt=container('ticket',value['root_uuid'],items,seq=plan['commit_seq']+1)
            known={x['revision_uuid'] for x in items};rebuilt['revisions'] += [x for x in value['revisions'] if x['revision_uuid'] not in known]
            prospective[selected]=rebuilt
    # Recheck every exact gate/edge against final bodies, not intermediate subrequests.
    for key in dirty:
        validate_relations(root,plan,tickets,current(prospective[key]),assignment,expected)
        checkpoints.validate_final(root,plan,tickets,current(prospective[key]),current(tickets[key]) if key in tickets else [],expected)
        reviews.validate_final(root,plan,tickets,current(prospective[key]),current(tickets[key]) if key in tickets else [],expected)
    for guard in support_guards:support.validate_final(root,records,prospective,guard['images'])
    return records,[prospective[key] for key in prospective if key in dirty]


def validate_relations(root,plan,tickets,items,assignment,expected):
    by_id={x['uuid']:x for x in items};edges=set();supersedes={};replacement_scopes={};parents={};wfparents={};dependency_graph={}
    captured={x['uuid']:x for ticket in tickets.values() for x in current(ticket)}
    if len(by_id)!=len(items):fail('Duplicate prospective identity')
    for item in items:
        body=item['body']
        sources.validate_reference(item,items,captured,expected)
        if item['kind']=='category' and body['parent_uuid'] is not None:
            parent=by_id.get(body['parent_uuid'])
            if not parent or parent['kind']!='category':fail('Dangling category parent')
            parents[item['uuid']]=[parent['uuid']]
        if item['kind']=='workflow_node' and body['parent_uuid'] is not None:
            parent=by_id.get(body['parent_uuid'])
            if not parent or parent['kind']!='workflow_node':fail('Dangling workflow hierarchy parent')
            wfparents[item['uuid']]=[parent['uuid']]
        if item['kind']=='content':
            if body['category_uuid'] not in by_id or by_id[body['category_uuid']]['kind']!='category':fail('Dangling content category')
            if any(x not in by_id or by_id[x]['kind']!='source_item' for x in body['item_uuids']):fail('Dangling content source item')
        history=[x for ticket in tickets.values() for x in ticket['revisions']]
        if item['kind']=='content' and body['state']!='pending' and body['authority']!='owner_decision' and decisions.requires_presentation(item,items,history):fail('Final interpreted successor must remain pending until named reviewed approval','FORBIDDEN')
        if item['kind']=='acceptance' and body['state']=='active':
            if captured.get(item['uuid'])!=item and any(decisions.requires_presentation(by_id[pin['entry_uuid']],items,history,pin['scope_item_uuids']) for pin in body['subject_refs'] if pin['entry_uuid'] in by_id) and not decisions.presented_provenance(item,items,history):fail('Final interpreted acceptance requires exact presented approval provenance','FORBIDDEN')
            if any(r['entry_uuid'] not in by_id or ref(by_id[r['entry_uuid']])!={**r,'scope_item_uuids':[]} or set(r['scope_item_uuids'])-set(by_id[r['entry_uuid']]['body'].get('item_uuids',[])) for r in body['subject_refs']):fail('Acceptance would reference changed subject','REVISION_CONFLICT')
        if item['kind']!='edge':continue
        a,b=body['from_uuid'],body['to_uuid'];key=(body['edge_kind'],a,b,tuple(sorted(body['scope_item_uuids'])))
        if key in edges or a==b or a not in by_id or b not in by_id:fail('Duplicate/self/dangling edge')
        edges.add(key)
        relations.validate_scope(items,item,captured,expected)
        for end in ('from','to'):
            entry=by_id[body[end+'_uuid']];pin=body[end+'_revision_uuid']
            prior=[x for t in tickets.values() for x in current(t) if x['uuid']==item['uuid']]
            if pin and pin!=entry['revision_uuid'] and (not prior or prior[0]!=item):
                if body['edge_kind']!='repair_of' or not any(x['uuid']==entry['uuid'] and x['revision_uuid']==pin for x in history):fail('New edge endpoint must pin prospective current or retained repair history','REVISION_CONFLICT')
            # Existing edges stay valid without reauthorizing every unrelated update.
            prior=[x for t in tickets.values() for x in current(t) if x['uuid']==item['uuid']]
            if not prior or prior[0]!=item:
                original=captured.get(entry['uuid'])
                if original and expected.get(entry['uuid'])!=original['revision_uuid']:fail('Exact edge endpoint expectation required','REVISION_CONFLICT')
        if not any(x['uuid']==item['uuid'] and x==item for t in tickets.values() for x in current(t)):
            authorization.authority(root,plan,tickets,body['authority_ref'],assignment,expected)
        if body['edge_kind']=='supersedes':
            scope=set(body['scope_item_uuids'])
            if scope-set(by_id[a]['body'].get('item_uuids',[])):fail('Supersession scope item is not on its source')
            for prior in replacement_scopes.get(a,[]):
                if not scope or not prior or scope & prior:fail('Overlapping conflicting supersession')
            replacement_scopes.setdefault(a,[]).append(scope)
            supersedes.setdefault(a,[]).append(b)
        if body['edge_kind']=='dependency':
            dependency_graph.setdefault(a,[]).append(b)
    def visit(graph,node,path):
        if node in path:fail('Cyclic hierarchy/dependency')
        for other in graph.get(node,[]):visit(graph,other,path|{node})
    for graph in (supersedes,parents,wfparents,dependency_graph):
        for node in graph:visit(graph,node,set())
