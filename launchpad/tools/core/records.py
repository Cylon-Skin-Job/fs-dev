"""Apply content lifecycle and category routing without replacing identity."""
import copy
from .schema import fail, current, record, schema, validate
from .store import uid, now, ref, envelope, digest
from . import authorization, seed

OPERATIONS={'record.archive','record.delete','record.restore','record.move_category','record.clone'}


def sources(root,assignment,pins,prior=None):
    from pathlib import Path
    from .store import file_hash
    prior=prior or []
    if any(x not in pins for x in prior):fail('Source lineage cannot be dropped','FORBIDDEN')
    for pin in pins:
        if pin in prior:continue
        path=Path(pin['locator'])
        if not path.is_absolute() or path.is_symlink() or not path.is_file() or not any(path.resolve().is_relative_to(base.resolve()) for base in (Path(assignment['body']['source_checkout']),Path(root)/'.evidence')) or file_hash(path)!=pin['sha256']:
            fail('Source pin must resolve exact assigned bytes','SOURCE_UNVERIFIED')


def expect(item,expected):
    if expected.get(item['uuid'])!=item['revision_uuid']:fail('Exact touched/dependency expectation required','REVISION_CONFLICT')


def used(items,uuid,revisions):
    def points(value,key=''):
        if isinstance(value,dict):return any(points(v,k) for k,v in value.items())
        if isinstance(value,list):return any(points(x,key) for x in value)
        return value==uuid and (key.endswith('_uuid') or key.endswith('_uuids'))
    known=[x for x in revisions if x['uuid']==uuid]
    versions={x['revision_uuid'] for x in known};hashes={digest(x) for x in known}
    def substantive(item):
        if item['uuid']==uuid:return False
        if any(pin['revision'] in versions or pin['sha256'] in hashes or pin['locator']==uuid or pin['native_ref']==uuid for pin in item['source_refs']):return True
        if item['kind'] in ('ticket','plan','category','receipt'):return False
        if points(item['body']):return True
        body=item['body']
        if item['kind']=='reference' and uuid in body['supported_scope']:return True
        if item['kind']=='reference' and body['target_kind']=='plan_entry' and (body['locator']==uuid or body['used_revision'] in versions or body['used_sha256'] in hashes):return True
        return False
    # Membership/own immutable history are bookkeeping; typed references and exact
    # source-used pins to any retained revision are substantive current consumption.
    return any(substantive(x) for x in items)


def apply(root,op,args,actor,assignment,plan,tickets,ticket,items,expected):
    old=next((x for x in items if x['uuid']==args['uuid']),None)
    if old is None or old['kind']!='content':fail('Named lifecycle/routing requires selected content','FORBIDDEN')
    expect(old,expected)
    for key in [old['body']['category_uuid']]+old['body']['item_uuids']:
        dependency=next((x for x in current(tickets[ticket['root_uuid']]) if x['uuid']==key),None)
        if dependency:expect(dependency,expected)
    item=copy.deepcopy(old)
    if op=='record.restore':
        if old['lifecycle']=='live':fail('Live content cannot restore','INVALID_TRANSITION')
        prior=next((x for x in ticket['revisions'] if x['revision_uuid']==old['lifecycle_evidence']['previous_live_revision_uuid']),None)
        nearest=next((x for x in ticket['revisions'] if x['uuid']==old['uuid'] and x['lifecycle']=='live'),None)
        if not prior:fail('Retained prior live revision missing','MISSING_EVIDENCE')
        if prior!=nearest or prior['uuid']!=old['uuid'] or prior['kind']!=old['kind'] or any(prior[k]!=old[k] for k in ('body','extensions','created_at')) or any(x not in old['source_refs'] for x in prior['source_refs']):
            fail('Retained nearest live predecessor is invalid','INVALID_TRANSITION')
    elif old['lifecycle']!='live':fail('Inactive content requires explicit restore','INVALID_TRANSITION')
    sources(root,assignment,args['source_refs'],old['source_refs'])
    if op in {'record.archive','record.delete','record.restore'}:
        authority=authorization.authority(root,plan,tickets,args['authority_ref'],assignment,expected)
        if op=='record.delete':
            if old['body']['authority']!='proposal' or old['body']['state']!='pending' or old['source_refs'] or old['body']['item_uuids'] or used(current(plan)+[x for t in tickets.values() for x in current(t)]+items,old['uuid'],plan['revisions']+[x for t in tickets.values() for x in t['revisions']]+items):fail('Delete requires unused unevidenced pending proposal','FORBIDDEN')
        item['lifecycle']={'record.archive':'archived','record.delete':'deleted','record.restore':'live'}[op]
        item['lifecycle_evidence']=dict(previous_live_revision_uuid=old['revision_uuid'] if op!='record.restore' else prior['revision_uuid'],reason=args['reason'],authority_ref=ref(authority),changed_at=now())
    elif op=='record.move_category':
        category=next((x for x in items if x['uuid']==args['category_uuid'] and x['kind']=='category'),None)
        if not category:fail('Destination category outside selected ticket','FORBIDDEN')
        captured=next((x for x in current(tickets[ticket['root_uuid']]) if x['uuid']==category['uuid']),None)
        if captured:expect(captured,expected)
        item['body']['category_uuid']=category['uuid']
    elif op=='record.clone':
        if args['kind']!='content':fail('Clone cannot confer protected kind','FORBIDDEN')
        body=copy.deepcopy(args.get('body',old['body']))
        if 'body' not in args:
            body['state']='pending'
            if body['authority'] not in ('proposal','implementation_choice'):body['authority']='proposal'
        validate(body,schema('record.schema.json')['$defs']['content'])
        if body['authority'] not in ('proposal','implementation_choice') or body['state']!='pending':fail('Clone body cannot inherit approved/active authority','FORBIDDEN')
        if body['item_uuids']!=old['body']['item_uuids']:fail('Clone must retain item lineage','FORBIDDEN')
        item=envelope('content',body,seed.writer(actor),args['source_refs'])
        item['extensions']=copy.deepcopy(args.get('extensions',old['extensions']))
        authority=authorization.authority(root,plan,tickets,assignment['body']['authority_ref'],assignment,expected)
        edge=envelope('edge',dict(edge_kind='derived_from',from_uuid=item['uuid'],to_uuid=old['uuid'],from_revision_uuid=None,to_revision_uuid=old['revision_uuid'],scope_item_uuids=old['body']['item_uuids'],authority_ref=ref(authority)),seed.writer(actor))
        record(item);items.extend([item,edge]);return item
    item['source_refs']=copy.deepcopy(args['source_refs'])
    if item==old:return old
    if op=='record.move_category':item['lifecycle_evidence']={k:None for k in old['lifecycle_evidence']}
    item.update(revision_uuid=uid(),last_updated=now(),writer=seed.writer(actor),source_refs=copy.deepcopy(args['source_refs']))
    record(item);items[items.index(old)]=item
    return item


def preview(root,request,actor,assignment,plan,tickets):
    from .transaction import expectations
    from .edits import prepare
    from .commands import base
    args=request['args']
    if request['operation'] not in actor['body']['granted_operations']:fail('Route preview grant absent','FORBIDDEN')
    allowed={'record.move_category','record.update','record.merge','record.clone','decision.record','ticket.seed_apply'}
    if any(x['operation'] not in allowed for x in args['proposed_operations']):fail('Intake operation outside content integration','UNSUPPORTED_OPERATION')
    trial={**request,'operation':'transaction.apply','tool':'db.transaction','args':dict(operations=args['proposed_operations'],expected=args['target_expected']),'expected':args['target_expected'],'expected_plan_revision_uuid':plan['root_revision_uuid']}
    selected=request['scope'].get('ticket_uuid')
    expectations(trial,plan,[tickets[selected]] if selected in tickets else [],root)
    pins=[]
    for operation in args['proposed_operations']:
        for pin in operation['args'].get('source_refs',[]):
            if pin not in pins:pins.append(pin)
    if args['source_refs']!=pins:fail('Route preview source pins must equal ordered operation pins')
    sources(root,assignment,args['source_refs'])
    prepare(root,trial,actor,assignment,plan,tickets,args['target_expected'],args['coverage_rows'])
    return {**base(request,plan),'result_kind':'preview','preview_digest':digest(args),'proposed_operations':args['proposed_operations'],'expected':args['target_expected'],'coverage_rows':args['coverage_rows'],'authority_impacts':['Explicit captured-current destinations resolve to their same-transaction prospective revisions; mapping grants no delivery or approval'],'recovery_prerequisites':['Exact generation, expected objects, complete affected item accounting and source pins']}


def verify_route(root,request,actor,assignment,plan,tickets):
    args=request['args'];allowed={'record.move_category','record.update','record.merge','record.clone','decision.record','ticket.seed_apply'}
    if any(x['operation'] not in allowed for x in args['operations']):fail('Intake operation outside content integration','UNSUPPORTED_OPERATION')
    if args['coverage_rows'] and assignment['body']['authority_ref'] not in args['authority_refs']:fail('Item integration requires explicit assigned authority','MISSING_EVIDENCE')
    for pin in args['authority_refs']:authorization.authority(root,plan,tickets,pin,assignment,request['expected'])
    pins=[]
    for operation in args['operations']:
        for pin in operation['args'].get('source_refs',[]):
            if pin not in pins:pins.append(pin)
    original=dict(source_refs=pins,proposed_operations=args['operations'],target_expected=request['expected'],coverage_rows=args['coverage_rows'])
    if digest(original)!=args['preview_digest']:fail('Route preview digest does not match exact operations/expectations','REVISION_CONFLICT')
