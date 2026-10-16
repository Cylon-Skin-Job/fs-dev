"""Read-only exact-CWD discovery and bounded, bound Resume context."""
import json
from pathlib import Path
from .schema import fail, current, ContractError
from .store import registry, read_generation, evidence, ref, file_hash, confined
from . import authorization, discussions

CONTEXT={'discussion.resume_context','context.startup','context.reentry'}


def actual(args):
    path=Path(args['actual_cwd'])
    if not path.is_absolute() or path.resolve()!=Path.cwd().resolve():
        fail('Declared actual CWD differs from the public CLI process','SOURCE_UNVERIFIED')
    return path.resolve()


def assignment_proof(root,pin):
    item=evidence(root,pin)
    if item['kind']!='assignment' or item['lifecycle']!='live':fail('Exact live assignment evidence required','SOURCE_UNVERIFIED')
    authority=evidence(root,item['body']['authority_ref'])
    if authority['kind']!='content' or authority['body']['authority']!='owner_decision' or authority['body']['state']!='active':
        fail('Assignment owner evidence unavailable','SOURCE_UNVERIFIED')
    if any(not Path(path).is_absolute() for path in item['body']['write_paths']+[item['body']['report_path'],item['body']['source_checkout']]):fail('Exact absolute assignment paths required','SOURCE_UNVERIFIED')
    procedure=Path(item['body']['procedure_path'])
    if not procedure.is_file() or procedure.is_symlink() or file_hash(procedure)!=item['body']['procedure_sha256']:
        fail('Assigned procedure bytes changed','SOURCE_UNVERIFIED')
    for source in item['body']['source_refs']+item['body']['prerequisite_refs']:evidence(root,source)
    return item


def headers(items):
    result=[]
    for item in items:
        body=item['body'];fields={k:body[k] for k in ('title','state','phase_node_uuid','actor_uuid','latest_direct_entry_ref','accepted_checkpoint_ref','focus','summary','open_threads','gaps','next_action','verdict','finding_refs','subject_refs','work_kind','node_uuid','manager_uuid') if k in body}
        fields['last_updated']=item['last_updated'];fields['writer']=item['writer']
        result.append(dict(uuid=item['uuid'],revision_uuid=item['revision_uuid'],kind=item['kind'],fields=fields,
                           omitted_fields=['body.'+k for k in body if k not in fields]))
    return result


def fit(result,budget,collections):
    """Never silently truncate; bounded omissions remain explicit."""
    size=lambda:len(json.dumps(result,ensure_ascii=False,separators=(',',':')).encode())
    collection=lambda key:result[key] if isinstance(key,str) else result[key[0]][key[1]]
    omitted=0
    for key,minimum in collections:
        values=collection(key)
        while size()>budget and len(values)>minimum:
            values.pop();result['remaining']+=1;omitted+=1
    if omitted:
        result['gaps'].append('Byte budget omitted headers/options/source pins; remaining counts omissions; request explicit scope or a larger budget')
        # Adding disclosure may require another header, but never discard the
        # required one resolved/two ambiguous candidate choices.
        for key,minimum in collections:
            values=collection(key)
            while size()>budget and len(values)>minimum:values.pop();result['remaining']+=1
    if size()>budget:fail('Byte budget cannot represent the required bounded entry/choice envelope','INVALID_SCHEMA')
    return result


def discover(root,request):
    args=request['args'];cwd=actual(args);scope=request.get('scope',{});pin=args.get('assignment_ref')
    assignment=assignment_proof(root,pin) if pin else None
    selected_ticket=args.get('ticket_uuid',scope.get('ticket_uuid'))
    if args.get('ticket_uuid') and scope.get('ticket_uuid') and args['ticket_uuid']!=scope['ticket_uuid']:
        fail('Explicit ticket selections conflict','BINDING_AMBIGUOUS')
    if assignment and args.get('source_checkout') and Path(args['source_checkout']).resolve()!=Path(assignment['body']['source_checkout']).resolve():
        fail('Supplied source checkout differs from assignment','SOURCE_UNVERIFIED')
    routes=registry(root);routes=[x for x in routes if not scope.get('plan_uuid') or x['uuid']==scope['plan_uuid']]
    if assignment:routes=[x for x in routes if str((Path(root)/x['current_home']).resolve()) in assignment['body']['write_paths']]
    omitted_routes=max(0,len(routes)-100);candidates=[];captures={};gaps=[];unavailable=[];physical=set()
    for route in routes[:100]:
        home=confined(root,Path(root)/route['current_home'])
        # No directory walk: only registered immutable plan routing bindings.
        if assignment and str(home.resolve()) not in assignment['body']['write_paths']:continue
        try:plan,tickets,_=read_generation(home)
        except (ContractError,OSError) as error:
            # Stored JSON shape/lifecycle and ordinary physical read failures
            # are unavailable observations. Routing confinement and explicit
            # owner selections remain fail-closed; no global error rewriting.
            if isinstance(error,ContractError) and error.code not in {'UNSUPPORTED_STORE','INVALID_SCHEMA','MISSING_EVIDENCE'}:raise
            if assignment or scope.get('plan_uuid') or cwd==home.resolve() or cwd.parent==home.resolve():raise
            unavailable.append(route['uuid'])
            continue
        captures[plan['root_uuid']]=(plan,tickets)
        if plan['root_uuid']!=route['uuid']:fail('Routing header identity mismatch','UNSUPPORTED_STORE')
        root_item=next(x for x in current(plan) if x['kind']=='plan')
        exact=[]
        if cwd==home.resolve():
            exact.append((None,'unassigned'));physical.add((plan['root_uuid'],None))
        for binding in root_item['body']['ticket_bindings']:
            if cwd==(home/binding['current_home']).resolve():
                exact.append((binding['ticket_uuid'],'unassigned'));physical.add((plan['root_uuid'],binding['ticket_uuid']))
        for actor in (x for x in current(plan) if x['kind']=='actor' and x['body']['state']=='active' and Path(x['body']['actual_cwd']).resolve()==cwd):
            for ap in actor['body']['assignment_refs']:
                if pin and ap!=pin:continue
                assigned=assignment_proof(root,ap)
                if str(home.resolve()) not in assigned['body']['write_paths']:continue
                authorization.validate_assignment(actor,assigned)
                ticket=assigned['body']['ticket_uuid'] if assigned['body']['ticket_uuid'] in tickets else None
                exact.append((ticket,assigned['body']['role']))
        if assignment:
            ticket=assignment['body']['ticket_uuid'] if assignment['body']['ticket_uuid'] in tickets else None
            assigned_cwd=cwd==Path(assignment['body']['source_checkout']).resolve() or str(cwd) in assignment['body']['write_paths'] or any(role==assignment['body']['role'] for _,role in exact)
            if not assigned_cwd:fail('Actual CWD is not the exact assigned checkout/home or registered actor CWD','SOURCE_UNVERIFIED')
            exact=[(ticket,assignment['body']['role'])]
            if selected_ticket and ticket!=selected_ticket:fail('Explicit ticket differs from assignment','BINDING_AMBIGUOUS')
        elif args.get('source_checkout'):
            fail('Source checkout needs exact assignment evidence','SOURCE_UNVERIFIED')
        if selected_ticket:
            if selected_ticket not in tickets:continue
            # Explicit selection is useful at the exact plan parent or a verified
            # actor checkout. It cannot silently select a foreign physical child.
            exact=[(selected_ticket,role) for ticket,role in exact if ticket in (None,selected_ticket)]
        # Exact physical ticket takes precedence over parent-level routing.
        if any(ticket is not None for ticket,_ in exact):exact=[x for x in exact if x[0] is not None]
        for ticket,role in exact:
            candidate=dict(plan_uuid=plan['root_uuid'],ticket_uuid=ticket,current_home=str(home/(next(x['current_home'] for x in root_item['body']['ticket_bindings'] if x['ticket_uuid']==ticket) if ticket else '')),
                           captured_plan_revision_uuid=plan['root_revision_uuid'],role_hint=role)
            if candidate not in candidates:candidates.append(candidate)
    if unavailable:gaps.append(str(len(unavailable))+' registered plan headers unavailable; exact IDs: '+', '.join(unavailable[:5])+('; additional IDs omitted; supply exact plan/assignment' if len(unavailable)>5 else ''))
    if pin and not candidates and scope.get('plan_uuid'):fail('Selected plan differs from the supplied assignment','BINDING_AMBIGUOUS')
    # Role hints are context, not extra competing bindings for one exact scope.
    unique={}
    for candidate in candidates:
        key=(candidate['plan_uuid'],candidate['ticket_uuid'])
        if key not in unique or candidate['role_hint']!='unassigned':unique[key]=candidate
    candidates=sorted(unique.values(),key=lambda x:(x['plan_uuid'],x['ticket_uuid'] or ''))
    certain=bool(assignment or scope.get('plan_uuid')) or len(candidates)==1 and (candidates[0]['plan_uuid'],candidates[0]['ticket_uuid']) in physical or not omitted_routes and not unavailable
    resolution='resolved' if len(candidates)==1 and certain else 'ambiguous' if len(candidates)>1 else 'missing'
    if candidates and not certain:gaps.append('Unverified routing headers may share this actor checkout; supply exact plan/assignment')
    supplied=request.get('actor_binding_ref');binding=None
    if supplied:
        if resolution!='resolved':fail('Supplied binding requires uniquely resolved scope','FORBIDDEN')
        c=candidates[0];plan,tickets=captures[c['plan_uuid']]
        try:
            actor,assigned=authorization.bound(root,{**request,'scope':{'plan_uuid':c['plan_uuid'],**({'ticket_uuid':c['ticket_uuid']} if c['ticket_uuid'] else {})}},plan,tickets)
            if pin and pin not in actor['body']['assignment_refs']:fail('Binding does not carry selected assignment','FORBIDDEN')
            binding=ref(actor)
        except ContractError as error:
            fail('Supplied actor binding is not verified: '+error.message,'FORBIDDEN')
    if omitted_routes:gaps.append('Registered routing lookup limit reached; supply exact plan/assignment')
    result=dict(interface_version=1,operation='session.entry',result_kind='entry',resolution=resolution,actual_cwd=str(cwd),assignment_evidence_ref=pin,
                candidate_bindings=candidates[:100] if resolution!='missing' else [],selected_scope=None,actor_binding_ref=None,context_headers=[],
                next_action='ask_scope_choice' if resolution=='ambiguous' else 'supply_missing_assignment',options=[],gaps=gaps,remaining=max(0,len(candidates)-100)+omitted_routes+len(unavailable),continuation=None)
    if resolution=='resolved':
        c=candidates[0];result['selected_scope']={'plan_uuid':c['plan_uuid'],'include_history':False,**({'ticket_uuid':c['ticket_uuid']} if c['ticket_uuid'] else {})}
        result.update(actor_binding_ref=binding,next_action='use_existing_binding' if binding else 'request_manager_binding')
        plan,tickets=captures[c['plan_uuid']]
        items=current(tickets[c['ticket_uuid']]) if c['ticket_uuid'] else [x for x in current(plan) if x['kind']=='plan']
        result['context_headers']=headers([x for x in items if x['kind'] in ('ticket','plan','discussion','journal_entry','checkpoint','action','attempt')])
        result['options']=['Assigned role: '+assignment['body']['role']] if assignment else ['Return selected scope to the assigned manager for actor.bind']
    elif resolution=='ambiguous':result['options']=['Select plan '+c['plan_uuid']+(' ticket '+c['ticket_uuid'] if c['ticket_uuid'] else ' parent') for c in candidates[:100]]
    else:
        result['options']=['Ask manager for missing exact ticket/home; assigned role: '+assignment['body']['role']] if assignment else ['Supply exact manager assignment or selected plan/ticket','Owner-facing role choice unresolved: Launchpad or Mission Control']
        if candidates:result['options']+=['Verify explicit plan '+c['plan_uuid']+(' ticket '+c['ticket_uuid'] if c['ticket_uuid'] else ' parent')+' before choosing its known scope' for c in candidates[:100]]
    return fit(result,args.get('budget_bytes',16384),[('context_headers',0),('options',0),('candidate_bindings',2 if resolution=='ambiguous' else 1 if resolution=='resolved' else 0)])


def resume(request,plan,tickets,actor,assignment):
    args=request['args'];actual(args);selected=request['scope'].get('ticket_uuid')
    if args['ticket_uuid']!=selected or selected not in tickets:fail('Exact bound ticket scope required','FORBIDDEN')
    if args.get('assignment_uuid') and args['assignment_uuid']!=assignment['uuid']:fail('Assignment conflicts with bound role','BINDING_AMBIGUOUS')
    if args.get('source_checkout') and Path(args['source_checkout']).resolve()!=Path(assignment['body']['source_checkout']).resolve():fail('Source checkout differs','SOURCE_UNVERIFIED')
    items=current(tickets[selected]);target=next(x for x in items if x['kind']=='ticket');landscape=discussions.projection(items,target['body']['current_workflow_node_uuid'])
    opened=[x for x in landscape['discussions'] if x['state']=='open']
    details=dict(role=actor['body']['role'],assignment_ref=ref(assignment),granted_operations=actor['body']['granted_operations'],
                 current_phase_node_uuid=landscape['current_phase_node_uuid'],phase_checks=landscape['phase_checks'],unfinished_discussion_uuids=[x['discussion_uuid'] for x in opened],
                 options=['Ask owner for prior context','Ask owner whether to request the prior discussion checkpoint','Begin fresh, preserving unfinished discussions'] if opened else [],
                 prior_chat='Native availability unverified; ask owner how to proceed if unavailable',role_question_required=False,
                 source_limits=['Saved journals are not native history; no native recovery, messages or cursor advancement'],source_pins=assignment['body']['source_refs'])
    result=dict(interface_version=1,operation=request['operation'],captured_plan_revision_uuid=plan['root_revision_uuid'],high_water=plan['commit_seq'],scope=request['scope'],gaps=[],continuation=None,result_kind='read',
                rows=headers([x for x in items if x['kind'] in ('discussion','journal_entry','checkpoint','action','attempt','acceptance','review','assignment') or x['kind']=='content' and x['body']['category_uuid'] in {c['uuid'] for c in items if c['kind']=='category' and c['body']['category_key']=='issues'}]),details=details,remaining=0)
    return fit(result,args.get('budget_bytes',16384),[('rows',0),(('details','source_pins'),0),(('details','unfinished_discussion_uuids'),0)])
