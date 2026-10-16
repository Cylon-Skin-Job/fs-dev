"""Persist independent requester positions over immutable substantive snapshots."""
import base64
import copy
import json
from datetime import datetime
from .schema import fail, current
from .store import digest, encode, envelope, ref, find_ref, now, read_generation, resolve_plan
from . import seed

OPERATIONS={'state.check'}
EXCLUDED={'receipt','state_check'}


def normalized(scope):return {**scope,'include_history':scope.get('include_history',False)}


def scope_key(scope):return digest(normalized(scope))


def snapshot(plan,tickets,scope):
    selected=scope.get('ticket_uuid')
    values=current(plan)+([x for t in ([tickets[selected]] if selected in tickets else tickets.values()) for x in current(t)] if selected is None or selected in tickets else [])
    result={}
    from . import relations
    hidden={x['uuid'] for x in values if relations.replacement(values,x['uuid'])['fully_superseded']} if not scope.get('include_history',False) else set()
    for item in values:
        if not scope.get('include_history',False) and (item['lifecycle']!='live' or item['uuid'] in hidden):continue
        if item['kind'] in EXCLUDED or item['kind']=='event' and item['body']['event_kind']=='state.check':continue
        body=copy.deepcopy(item['body'])
        if item['kind']=='plan':
            # Snapshot aliases/hashes change when observations publish. Their
            # business ticket contents are compared independently below.
            body.pop('ticket_bindings',None)
        if item['kind']=='ticket':body.pop('record_refs',None);body.pop('category_refs',None)
        for key in ('last_checked_at','checked_at','elapsed_seconds'):body.pop(key,None)
        semantic=dict(uuid=item['uuid'],kind=item['kind'],body=body,writer=item['writer'],source_refs=item['source_refs'],extensions=item['extensions'],lifecycle=item['lifecycle'],lifecycle_evidence=item['lifecycle_evidence'])
        result[item['uuid']]=dict(item=item,sha256=digest(semantic))
    return result


def changes(before,after,requester,exclude,after_all=None):
    result=[]
    for key in sorted(before.keys()|after.keys()):
        old,new=before.get(key),after.get(key)
        if old and new and old['sha256']==new['sha256']:continue
        item=(new or (after_all or {}).get(key) or old)['item']
        # Actual child actor_uuid remains distinct even when parent attribution
        # equals the requester. Never filter by parent_actor_uuid.
        if exclude and item['writer']['actor_uuid']==requester:continue
        result.append(('removed' if new is None else 'added' if old is None else 'changed',item))
    return result


def lookup(plan,pin):return find_ref(plan,{},pin)


def series(plan,check):
    pages=[check];previous=check['body']['previous_check_ref']
    while previous:
        item=lookup(plan,previous)
        if item['body']['observed_generation']!=check['body']['observed_generation']:return pages,item
        pages.insert(0,item);previous=item['body']['previous_check_ref']
    return pages,None


def captured(home,check,scope):
    p,ts,_=read_generation(home,check['body']['observed_generation'])
    return snapshot(p,ts,scope)


def parse_cursor(raw,plan,args):
    try:
        value=json.loads(base64.urlsafe_b64decode(raw));p=value['payload']
        if set(value)!={'payload','sha256'} or set(p)!={'previous_uuid','previous_revision','offset','limit','exclude_actual_self'} or value['sha256']!=digest(p):raise ValueError()
        check=next(x for x in plan['revisions'] if x['uuid']==p['previous_uuid'] and x['revision_uuid']==p['previous_revision'])
        if check['kind']!='state_check' or check['body']['pending_cursor']!=raw or p['limit']!=args.get('limit',20) or p['exclude_actual_self']!=args['exclude_actual_self']:raise ValueError()
        return check,p
    except (ValueError,KeyError,TypeError,StopIteration):fail('Cursor does not match exact saved state page','INVALID_TRANSITION')


def apply(root,args,actor,assignment,plan,tickets,records,expected,outer_scope):
    scope=normalized(args['scope'])
    outer=normalized(outer_scope)
    if args['requester_uuid']!=actor['uuid'] or scope['plan_uuid']!=plan['root_uuid'] or outer['plan_uuid']!=scope['plan_uuid']:
        fail('Exact bound requester/plan required','FORBIDDEN')
    if outer.get('ticket_uuid') and scope.get('ticket_uuid')!=outer['ticket_uuid']:fail('Check scope cannot expand selected ticket','FORBIDDEN')
    assigned=assignment['body']['ticket_uuid']
    if assigned in tickets and scope.get('ticket_uuid')!=assigned:fail('Check scope cannot expand exact assigned ticket','FORBIDDEN')
    if scope.get('ticket_uuid') and scope['ticket_uuid'] not in tickets:fail('Check ticket missing','MISSING_EVIDENCE')
    key=scope_key(scope);limit=args.get('limit',20)
    matches=[x for x in records if x['kind']=='state_check' and (x['body']['requester_uuid'],x['body']['mode'],x['body']['scope_key'])==(actor['uuid'],args['mode'],key)]
    latest=matches[-1] if matches else None
    if latest and expected.get(latest['uuid'])!=latest['revision_uuid']:fail('Exact requester position expectation required','REVISION_CONFLICT')
    offset=0;previous=latest
    if args.get('cursor'):
        previous,p=parse_cursor(args['cursor'],plan,args)
        if previous not in matches:fail('Cursor belongs to another requester/mode/scope','FORBIDDEN')
        offset=p['offset']
        cached=next((x for x in matches if x['body']['previous_check_ref']==ref(previous) and x['body']['observed_generation']==previous['body']['observed_generation']),None)
        if cached:
            if 'acknowledge_high_water' in args and (cached['body']['pending_cursor'] or args['acknowledge_high_water']!=cached['body']['high_water']):fail('Acknowledgment exceeds inspected page','INVALID_TRANSITION')
            return cached
        observed=previous['body']['observed_generation'];high=previous['body']['high_water']
        after=captured(resolve_plan(root,plan['root_uuid']),previous,scope)
        after_all=captured(resolve_plan(root,plan['root_uuid']),previous,{**scope,'include_history':True})
        _,base=series(plan,previous)
    elif latest and latest['body']['pending_cursor']:
        if 'acknowledge_high_water' in args:fail('Pending pages must be fully inspected before acknowledgment','INVALID_TRANSITION')
        pages,_=series(plan,latest)
        initial=pages[0]
        # A missing continuation resumes the original pending page. It must
        # not discard an incompletely inspected frozen interval.
        parse_cursor(initial['body']['pending_cursor'],plan,args)
        return initial
    else:
        observed=plan['root_revision_uuid'];high=plan['commit_seq'];after=snapshot(plan,tickets,scope);after_all=snapshot(plan,tickets,{**scope,'include_history':True});base=latest
    before=captured(resolve_plan(root,plan['root_uuid']),base,scope) if base else {}
    delta=changes(before,after,actor['uuid'],args['exclude_actual_self'],after_all) if base else []
    end=min(offset+limit,len(delta));pending=end<len(delta)
    if 'acknowledge_high_water' in args and (pending or args['acknowledge_high_water']!=high):fail('Acknowledgment must cover the completely inspected frozen high-water','INVALID_TRANSITION')
    checked=now();elapsed=(datetime.fromisoformat(checked.replace('Z','+00:00'))-datetime.fromisoformat(previous['body']['checked_at'].replace('Z','+00:00'))).total_seconds() if previous else None
    gaps=['Actual process liveness is unobserved; turn end does not certify a continuing child']
    if elapsed is not None and elapsed<0:gaps.append('Wall clock moved backwards; monotonic commit order retained')
    ongoing=[ref(x['item']) for x in after.values() if x['item']['kind']=='attempt' and x['item']['body']['state'] in ('claimed','running','paused','blocked') and x['item']['uuid'] in before and x['sha256']==before[x['item']['uuid']]['sha256']]
    body=dict(requester_uuid=actor['uuid'],mode=args['mode'],scope_key=key,previous_check_ref=ref(previous) if previous else None,checked_at=checked,elapsed_seconds=elapsed,observed_generation=observed,high_water=high,snapshot_sha256=digest({k:v['sha256'] for k,v in after.items()}),acknowledged_high_water=base['body']['acknowledged_high_water'] if pending and base else 0 if pending else high,pending_cursor=None,changed_refs=[ref(item) for kind,item in delta[offset:end] if kind!='removed'],unchanged_run_refs=ongoing,gaps=gaps)
    check=envelope('state_check',body,seed.writer(actor))
    # Identity token avoids a self-referential envelope hash cycle.
    if pending:
        payload=dict(previous_uuid=check['uuid'],previous_revision=check['revision_uuid'],offset=end,limit=limit,exclude_actual_self=args['exclude_actual_self'])
        body['pending_cursor']=base64.urlsafe_b64encode(encode(dict(payload=payload,sha256=digest(payload)))).decode()
    records.append(check);return check


def response(root,request,receipt,plan):
    check=lookup(plan,receipt['body']['evidence_refs'][0]);b=check['body'];home=resolve_plan(root,plan['root_uuid']);scope=normalized(request['args']['scope'])
    pages,base=series(plan,check);before=captured(home,base,scope) if base else {};after=captured(home,check,scope)
    delta=changes(before,after,b['requester_uuid'],request['args']['exclude_actual_self'],captured(home,check,{**scope,'include_history':True})) if base else []
    offset=sum(len(x['body']['changed_refs']) for x in pages[:-1])
    # Removed records also occupy pages; recover offset from the prior cursor.
    if len(pages)>1:offset=json.loads(base64.urlsafe_b64decode(pages[-2]['body']['pending_cursor']))['payload']['offset']
    limit=request['args'].get('limit',20);portion=delta[offset:offset+limit]
    previous=lookup(plan,b['previous_check_ref']) if b['previous_check_ref'] else None
    return dict(interface_version=1,operation='state.check',captured_plan_revision_uuid=b['observed_generation'],high_water=b['high_water'],scope=scope,gaps=b['gaps'],continuation=b['pending_cursor'],result_kind='state_check',check_ref=ref(check),previous_checked_at=previous['body']['checked_at'] if previous else None,checked_at=b['checked_at'],elapsed_seconds=b['elapsed_seconds'],prior_snapshot_sha256=base['body']['snapshot_sha256'] if base else None,current_snapshot_sha256=b['snapshot_sha256'],added_refs=[ref(x) for kind,x in portion if kind=='added'],changed_refs=[ref(x) for kind,x in portion if kind=='changed'],removed_uuids=[x['uuid'] for kind,x in portion if kind=='removed'],unchanged_run_refs=b['unchanged_run_refs'],acknowledged_high_water=b['acknowledged_high_water'],clock_anomaly=b['elapsed_seconds'] is not None and b['elapsed_seconds']<0)


def receipt_check(request,actor,old,records):
    args=request['args']
    check=next(x for x in reversed(records) if x['kind']=='state_check' and x['body']['requester_uuid']==actor['uuid'] and x['body']['mode']==args['mode'] and x['body']['scope_key']==scope_key(args['scope']))
    if args.get('cursor'):
        previous,_=parse_cursor(args['cursor'],old,args)
        check=next(x for x in records if x['kind']=='state_check' and x['body']['previous_check_ref']==ref(previous) and x['body']['observed_generation']==previous['body']['observed_generation'])
    elif check['body']['pending_cursor']:check=series({'revisions':records},check)[0][0]
    return ref(check)


def projection(root,plan,tickets,requester,ticket_uuid):
    """Read exact saved observation pages for the current captured discussion log."""
    keys={scope_key(dict(plan_uuid=plan['root_uuid'],ticket_uuid=ticket_uuid)),scope_key(dict(plan_uuid=plan['root_uuid']))}
    logs=[]
    for check in current(plan):
        if check['kind']!='state_check' or check['body']['requester_uuid']!=requester or check['body']['scope_key'] not in keys:continue
        p,ts,_=read_generation(resolve_plan(root,plan['root_uuid']),check['body']['observed_generation'])
        records=p['revisions']+[x for t in ts.values() for x in t['revisions']]
        changed=[next((x for x in records if ref(x)==pin),None) for pin in check['body']['changed_refs']]
        logs.append(dict(check=check,changed_records=changed,scope='Saved observation in this captured view; not progress, checkpoint coverage or approval'))
    return logs
