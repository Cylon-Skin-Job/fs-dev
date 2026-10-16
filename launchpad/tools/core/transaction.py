"""Publish a complete immutable generation through one POSIX selector."""
import copy
import fcntl
import os
from contextlib import contextmanager
from pathlib import Path
from .schema import ContractError, fail, current, snapshot
from .store import uid, encode, digest, ref, envelope, container, confined, file_hash, read_generation, registry, routing_destination, NIL
from . import authorization, seed
from .boundaries import before


@contextmanager
def lock(path):
    path = Path(path)
    mkdir(path.parent)
    if path.is_symlink():
        fail('Lock path is linked', 'UNSUPPORTED_STORE')
    before('lock_open',path)
    with path.open('a+') as handle:
        before('flock',path)
        fcntl.flock(handle, fcntl.LOCK_EX)
        yield


def fsync_dir(path):
    before('open_dir',path)
    fd = os.open(path, os.O_RDONLY)
    try:
        before('fsync_dir',path)
        os.fsync(fd)
    finally:
        os.close(fd)


def write(path, data):
    path = Path(path)
    mkdir(path.parent)
    before('write',path)
    with path.open('xb') as handle:
        before('write_bytes',path)
        handle.write(data)
        before('flush',path)
        handle.flush()
        before('fsync_file',path)
        os.fsync(handle.fileno())
    fsync_dir(path.parent)


def replace_json(path, value):
    temporary = Path(path).with_name('.' + Path(path).name + '-' + uid())
    write(temporary, encode(value))
    before('replace',path)
    os.replace(temporary, path)
    fsync_dir(Path(path).parent)


def alias(path, target, unselected=False):
    path = Path(path)
    if path.is_symlink():
        if os.readlink(path) != target:
            if not unselected:fail('Conflicting alias','UNSUPPORTED_STORE')
            temporary=path.with_name('.alias-'+uid())
            before('alias_link',temporary);os.symlink(target,temporary)
            before('alias_replace',path);os.replace(temporary,path);fsync_dir(path.parent)
    elif path.exists():
        fail('Read alias has conflicting file', 'UNSUPPORTED_STORE')
    else:
        before('alias',path)
        os.symlink(target, path)
        fsync_dir(path.parent)


def expectations(request, plan, touched, root=None):
    actual = {x['uuid']:x['revision_uuid'] for x in current(plan)}
    for ticket in touched:
        actual.update({x['uuid']:x['revision_uuid'] for x in current(ticket)})
    if request['expected_plan_revision_uuid'] != plan['root_revision_uuid']:
        raise conflict(request,plan,touched,actual,'Plan generation changed')
    for entry in [plan['root_uuid']] + [x['root_uuid'] for x in touched]:
        if request['expected'].get(entry) != actual[entry]:
            raise conflict(request,plan,touched,actual,'Exact touched root expectation required')
    for k,v in request['expected'].items():
        if k not in actual:
            from .store import load
            item=load(confined(home_root := root,Path(home_root)/'.evidence'/(v+'.json')))
            from .schema import record
            record(item)
            if item['uuid']!=k or item['revision_uuid']!=v:fail('Dependency identity mismatch','SOURCE_UNVERIFIED')
            actual[k]=v
    if any(actual.get(k) != v for k,v in request['expected'].items()):
        raise conflict(request,plan,touched,actual,'Object dependency expectation changed')


def replay(request, actor, assignment, plan):
    key = actor['uuid'] + ':' + assignment['uuid'] + ':' + request['idempotency_key']
    for item in current(plan):
        if item['kind'] == 'receipt' and item['body']['idempotency_key'] == key:
            if item['body']['request_sha256'] != digest(request):
                fail('Same retry key has different request', 'IDEMPOTENCY_MISMATCH')
            return item


def seed_expectations(request,before,after):
    old_by_id={x['uuid']:x for x in current(before)}
    capture,_=seed.seed_roles(before,list(old_by_id.values()))
    source_items={x['uuid'] for x in old_by_id.values() if x['kind']=='source_item'}
    all_items=source_items|{x['uuid'] for x in current(after) if x['kind']=='source_item'}
    owned={capture['uuid']}|{x['uuid'] for x in old_by_id.values() if x['kind']=='content' and x['body']['authority']=='source_of_truth_contract' and len(x['body']['item_uuids'])==1 and x['body']['item_uuids'][0] in source_items}
    dependencies={before['root_uuid']}|owned|source_items
    for item in list(old_by_id.values())+current(after):
        if item['kind']=='content' and (item['uuid'] in owned or item['body']['authority']=='source_of_truth_contract' and set(item['body']['item_uuids']) & all_items):
            dependencies.add(item['body']['category_uuid']);dependencies.update(item['body']['item_uuids'])
    for key in dependencies & old_by_id.keys():
        if request['expected'].get(key)!=old_by_id[key]['revision_uuid']:
            raise ContractError('REVISION_CONFLICT','Exact seed touched/dependency expectation required',
                                {x['uuid']:x['revision_uuid'] for x in current(before)})
    for item in current(after):
        old=old_by_id.get(item['uuid'])
        if old and item!=old and request['expected'].get(item['uuid'])!=old['revision_uuid']:
            raise ContractError('REVISION_CONFLICT','Exact changed seed-object expectation required',
                                {x['uuid']:x['revision_uuid'] for x in current(before)})


def response(request, receipt, plan, root=None):
    if request['operation']=='state.check':
        from . import state_check
        return state_check.response(root,request,receipt,plan)
    context=None
    if request['operation']=='track.release_check':
        import json
        from .store import resolve_plan
        from . import integration as _integration
        _,tickets,_=read_generation(resolve_plan(root,request['scope']['plan_uuid']),receipt['body']['new_generation'])
        items=[x for t in tickets.values() for x in current(t)]
        event=next(x for x in items if x['kind']=='event' and x['body']['event_kind']=='track.release_check' and ref(x) in receipt['body']['changed_refs'])
        context=json.dumps(_integration.evaluation(root,plan,tickets,event['body']['subject_ref']),sort_keys=True,separators=(',',':'))
    if request['operation'] in ('assignment.claim','assignment.handoff') or request['operation']=='transaction.apply' and any(x['operation'] in ('assignment.claim','assignment.handoff') for x in request['args']['operations']):
        from .store import resolve_plan
        import json
        _,tickets,_=read_generation(resolve_plan(root,request['scope']['plan_uuid']),receipt['body']['new_generation'])
        items=current(tickets[request['scope']['ticket_uuid']])
        attempts=[x for x in items if x['kind']=='attempt' and ref(x) in receipt['body']['changed_refs'] and x['body']['state']=='claimed']
        if request['operation']!='transaction.apply' and len(attempts)!=1:fail('Committed claim context is missing','UNSUPPORTED_STORE')
        contexts=[]
        for attempt in attempts:
            job=next(x for x in items if x['uuid']==attempt['body']['assignment_uuid'])
            contexts.append(dict(kind='claim_context',assignment_ref=ref(job),stored_briefing=job['body'],attempt_ref=ref(attempt)))
        if contexts:context=json.dumps(contexts[0] if request['operation']!='transaction.apply' else dict(kind='claim_contexts',contexts=contexts),sort_keys=True,separators=(',',':'))
    return dict(interface_version=1, operation=request['operation'], captured_plan_revision_uuid=receipt['body']['new_generation'],
                high_water=plan['commit_seq'], scope=request['scope'], gaps=[], continuation=context, result_kind='mutation',
                commit_state='committed', receipt_ref=ref(receipt), changed_refs=receipt['body']['changed_refs'],
                changed_fields=['body'] if receipt['body']['changed_refs'] else [], generated_view_refs=[])


def committed_error(error,generation,actual):
    return ContractError(error.code if isinstance(error,ContractError) else 'UNSUPPORTED_STORE',
                         'Publication selected '+generation+'; reconcile before retry: '+str(error),actual,'committed_unknown')


def publish(root, home, request, actor, assignment, old, tickets, records, changed, generation=None):
    from .render import render
    routing_destination(root)
    registry(root)
    preflight(home,tickets,changed,request,actor,assignment)
    generation=generation or uid();seq=old['commit_seq']+1 if old else 1
    body=next(x for x in records if x['kind']=='plan')['body']
    for ticket in changed:
        ticket_home=confined(home,home/ticket['revisions'][-1]['body']['current_home']) if ticket['revisions'][-1]['kind']=='ticket' else confined(home,home/next(x for x in current(ticket) if x['kind']=='ticket')['body']['current_home'])
        if ticket['root_uuid'] not in tickets:
            intent=confined(home,home/'.child-intents'/ (ticket_home.name+'.json'))
            if not intent.exists():replace_json(intent,dict(request_sha256=digest(request),actor_uuid=actor['uuid'],assignment_uuid=assignment['uuid']))
        mkdir(ticket_home)
        path=ticket_home/'.revisions'/ticket['root_revision_uuid']/'ticket.json'
        confined(home,path)
        write(path,encode(ticket))
        binding=dict(ticket_uuid=ticket['root_uuid'],ticket_revision_uuid=ticket['root_revision_uuid'],
                     relative_path=str(path.relative_to(home)),sha256=file_hash(path),current_home=ticket_home.name)
        body['ticket_bindings']=[x for x in body['ticket_bindings'] if x['ticket_uuid']!=ticket['root_uuid']]+[binding]
        tickets[ticket['root_uuid']]=ticket
    root_record=next(x for x in records if x['kind']=='plan')
    previous_root=next((x for x in current(old) if x['kind']=='plan'),None) if old else None
    root_changed=root_record!=previous_root
    if old and root_changed:
        root_record['revision_uuid']=uid()
        from .store import now
        root_record['last_updated']=now()
        root_record['writer']=seed.writer(actor)
    # tickets already contains staged candidates: compare with the captured old bindings instead.
    old_by_revision={x['revision_uuid']:x for x in current(old)} if old else {}
    if old:
        _,old_tickets,_=read_generation(home,old['root_revision_uuid'])
        old_by_revision.update({x['revision_uuid']:x for t in old_tickets.values() for x in current(t)})
    changed_refs=[ref(x) for x in records+[x for t in changed for x in current(t)] if old_by_revision.get(x['revision_uuid'])!=x]
    receipt=envelope('receipt',dict(operation=request['operation'],request_sha256=digest(request),
                     idempotency_key=actor['uuid']+':'+assignment['uuid']+':'+request['idempotency_key'],assignment_uuid=assignment['uuid'],
                     old_generation=old['root_revision_uuid'] if old else None,new_generation=generation,
                     changed_refs=changed_refs,evidence_refs=[],result='committed'),seed.writer(actor))
    if request['operation']=='state.check':
        from . import state_check
        receipt['body']['evidence_refs']=[state_check.receipt_check(request,actor,old,records)]
    records.append(receipt)
    plan=container('plan',root_record['uuid'],records,generation,seq,
                   (old['idempotency_receipt_refs'] if old else [])+[ref(receipt)])
    if old:
        known={x['revision_uuid'] for x in records}
        plan['revisions'] += [x for x in old['revisions'] if x['revision_uuid'] not in known]
    snapshot(plan)
    folder=confined(home,home/'.revisions'/generation)
    write(folder/'plan.json',encode(plan))
    pages=render(root,plan,tickets)
    for name,data in pages.items():
        write(folder/name,data.encode())
    old_ticket_ids=set(x['ticket_uuid'] for x in next((x for x in current(old) if x['kind']=='plan'),{'body':{'ticket_bindings':[]}})['body']['ticket_bindings']) if old else set()
    for binding in body['ticket_bindings']:
        ticket_id=binding['ticket_uuid'];child=home/binding['current_home']
        before('payload_alias',folder/'tickets'/f'{ticket_id}.json')
        os.symlink(os.path.relpath(home/binding['relative_path'],folder/'tickets'),folder/'tickets'/f'{ticket_id}.json')
        alias(child/'ticket.html',f'../CURRENT/tickets/{ticket_id}.html',ticket_id not in old_ticket_ids)
        alias(child/'ticket.json',f'../CURRENT/tickets/{ticket_id}.json',ticket_id not in old_ticket_ids)
    fsync_dir(folder/'tickets') if tickets else None
    alias(home/'plan.HTML','CURRENT/plan.HTML')
    prepared=dict(old_generation=old['root_revision_uuid'] if old else None,new_generation=generation,
                  request_sha256=digest(request),plan_sha256=file_hash(folder/'plan.json'),
                  view_hashes={k:file_hash(folder/k) for k in pages})
    write(home/'.prepared'/f'{generation}.json',encode(prepared))
    fsync_dir(folder);fsync_dir(home/'.revisions')
    temp=home/('.CURRENT-'+generation)
    before('selector_link',temp)
    os.symlink('.revisions/'+generation,temp)
    before('selector',home/'CURRENT')
    os.replace(temp,home/'CURRENT')
    try:
        fsync_dir(home)
        before('readback',home)
        readback,_,captured=read_generation(home)
        if readback!=plan or any(file_hash(captured/k)!=v for k,v in prepared['view_hashes'].items()):
            fail('Committed generation readback failed','UNSUPPORTED_STORE')
    except (ContractError,OSError,ValueError,KeyError) as error:
        raise committed_error(error,generation,{root_record['uuid']:root_record['revision_uuid']}) from error
    return response(request,receipt,plan,root)


def create_plan(root, request):
    from .store import safe_name
    from .render import render_registry
    args=request['args'];safe_name(args['plan_folder'])
    if len(args['tracks'])!=4 or sorted(x['order'] for x in args['tracks'])!=list(range(4)) or len({x['uuid'] for x in args['tracks']})!=4:
        fail('Exactly four distinct ordered tracks required')
    if request['expected'] or request['expected_plan_revision_uuid']!=NIL:
        fail('Bootstrap requires empty expectations and nil generation')
    actor,assignment=authorization.bootstrap(root,request)
    home=confined(root,Path(root)/'work-tickets'/args['plan_folder'])
    with lock(Path(root)/'.provision.lock'):
        chooser=routing_destination(root)
        rows=registry(root)
        if home.exists() and (home/'CURRENT').exists():
            old,tickets,_=read_generation(home)
            receipt=replay(request,actor,assignment,old)
            if old['root_uuid']!=request['scope']['plan_uuid'] or not receipt:
                fail('Conflicting plan identity/home','REVISION_CONFLICT')
            captured,_,_=read_generation(home,receipt['body']['new_generation'])
            result=response(request,receipt,captured,root)
        else:
            from .store import load
            intent=confined(root,Path(root)/'.provisioning'/(request['scope']['plan_uuid']+'.json'))
            proof=dict(request_sha256=digest(request),home=str(home))
            if intent.exists() and load(intent)!=proof:fail('Conflicting provisioning retry','IDEMPOTENCY_MISMATCH')
            if any(x['uuid']==request['scope']['plan_uuid'] for x in rows) or (home.exists() and not intent.exists()):
                fail('Duplicate or unpublished plan home','REVISION_CONFLICT')
            if not intent.exists():replace_json(intent,proof)
            mkdir(home)
            w=seed.writer(actor)
            category=envelope('category',dict(title='Layout',category_key='layout',parent_uuid=None,order=0),w)
            plan=envelope('plan',dict(title=args['title'],current_home=str(home.relative_to(root)),ticket_bindings=[],
                          tracks=args['tracks'],layout_refs=[],dependency_refs=[],definition_version='launchpad-core/1'),w,entry=request['scope']['plan_uuid'])
            result=publish(root,home,request,actor,assignment,None,{},[plan,actor,category],[])
        try:
            if not any(x['uuid']==request['scope']['plan_uuid'] for x in rows):
                rows.append(dict(uuid=request['scope']['plan_uuid'],title=args['title'],current_home=str(home.relative_to(root))))
                replace_json(Path(root)/'plans.json',rows)
            # Provisioning owns root routing only; never rewrite another plan snapshot.
            temporary=chooser.with_name('.plans-'+uid()+'.HTML')
            write(temporary,render_registry(rows).encode())
            before('chooser',chooser)
            os.replace(temporary,chooser);fsync_dir(Path(root))
        except (ContractError,OSError,ValueError,KeyError) as error:
            changed=result['changed_refs'][0]
            raise committed_error(error,result['captured_plan_revision_uuid'],{changed['entry_uuid']:changed['revision_uuid']}) from error
        return result


def mutate(root, home, request):
    with lock(confined(root,home/'.write.lock')):
        plan,tickets,_=read_generation(home)
        if plan['root_uuid']!=request['scope']['plan_uuid']:fail('Registry selected another plan','UNSUPPORTED_STORE')
        actor,assignment=authorization.bound(root,request,plan,tickets,write=False)
        previous=replay(request,actor,assignment,plan)
        if previous:
            captured,_,_=read_generation(home,previous['body']['new_generation'])
            return response(request,previous,captured,root)
        authorization.bound(root,request,plan,tickets,write=True)
        selected=request['scope'].get('ticket_uuid')
        touched=[tickets[selected]] if selected in tickets else []
        expected=request['expected']
        if request['operation']=='transaction.apply':
            if request['args']['expected']!=expected:fail('Outer and transaction expectation maps must agree')
        expectations(request,plan,touched,root)
        if request['operation']=='recovery.apply':
            from . import recovery
            generation=recovery.apply(root,home,request,plan,tickets,assignment)
            records=copy.deepcopy(current(plan));changed=[]
        else:
            from .edits import prepare
            records,changed=prepare(root,request,actor,assignment,plan,tickets,expected)
        return publish(root,home,request,actor,assignment,plan,tickets,records,changed,
                       generation if request['operation']=='recovery.apply' else None)


def preflight(home,tickets,changed,request,actor,assignment):
    """Check canonical owners and read aliases before any payload staging."""
    all_tickets={**tickets,**{t['root_uuid']:t for t in changed}}
    homes=set()
    for ticket in all_tickets.values():
        snapshot(ticket)
        item=next(x for x in current(ticket) if x['kind']=='ticket')
        from .store import safe_name
        name=safe_name(item['body']['current_home'])
        if name in homes:fail('Duplicate prospective child home','REVISION_CONFLICT')
        homes.add(name);child=confined(home,home/name)
        confined(home,child/'.revisions')
        unpublished=ticket['root_uuid'] not in tickets
        if unpublished:
            from .store import load
            intent=confined(home,home/'.child-intents'/(name+'.json'))
            proof=dict(request_sha256=digest(request),actor_uuid=actor['uuid'],assignment_uuid=assignment['uuid'])
            if intent.exists() and load(intent)!=proof:fail('Unpublished child has another request owner','IDEMPOTENCY_MISMATCH')
            if child.exists() and not intent.exists():fail('Existing unassigned child home','REVISION_CONFLICT')
        for filename,target in [('ticket.html',f'../CURRENT/tickets/{ticket["root_uuid"]}.html'),('ticket.json',f'../CURRENT/tickets/{ticket["root_uuid"]}.json')]:
            alias_preflight(child/filename,target,unpublished)
    confined(home,home/'.prepared');confined(home,home/'.revisions')
    alias_preflight(home/'plan.HTML','CURRENT/plan.HTML')
    if (home/'CURRENT').exists() and not (home/'CURRENT').is_symlink():fail('CURRENT must be a selector','UNSUPPORTED_STORE')


def alias_preflight(path,target,unselected=False):
    if path.is_symlink():
        if os.readlink(path)!=target:
            import re
            if not unselected or not re.fullmatch(r'\.\./CURRENT/tickets/[a-f0-9-]{36}\.(html|json)',os.readlink(path)):
                fail('Conflicting read alias','UNSUPPORTED_STORE')
    elif path.exists():fail('Read alias has conflicting file','UNSUPPORTED_STORE')


def conflict(request,plan,touched,actual,message):
    error=ContractError('REVISION_CONFLICT',message+'; current generation '+plan['root_revision_uuid'],actual)
    all_snapshots=[plan]+touched
    for value in all_snapshots:
        for item in current(value):
            old=next((x for x in value['revisions'] if x['uuid']==item['uuid'] and x['revision_uuid']==request['expected'].get(item['uuid'])),None)
            if old and old!=item:
                error.changed_fields += [item['uuid']+'.'+key for key in item if old[key]!=item[key]]
    error.changed_fields=error.changed_fields[:100]
    return error


def mkdir(path):
    """Durably create each missing owner directory, including its parent entry."""
    path=Path(path);missing=[];probe=path
    while not probe.exists():missing.append(probe);probe=probe.parent
    for folder in reversed(missing):
        before('mkdir',folder);folder.mkdir(exist_ok=True);fsync_dir(folder.parent)
