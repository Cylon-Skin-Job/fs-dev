"""Own exact item dispositions and derived handoff completeness."""
import copy
from .schema import fail, current, record, schema, validate
from .store import ref, envelope, digest, uid, now, find_ref, evidence
from . import authorization, seed


def exact(root,plan,tickets,items,pin):
    """Resolve a scoped reference without changing its retained revision."""
    bare={**pin,'scope_item_uuids':[]}
    match=next((x for x in items if ref(x)==bare),None)
    if match:return match
    local=plan['revisions']+[x for t in tickets.values() for x in t['revisions']]
    if any(x['uuid']==pin['entry_uuid'] for x in local):return find_ref(plan,tickets,bare)
    return evidence(root,bare)


def check_row(root,plan,tickets,items,body,require_current=False):
    validate(body,schema('record.schema.json')['$defs']['coverage'])
    by_id={x['uuid']:x for x in items};source=by_id.get(body['source_item_uuid'])
    if not source or source['kind']!='source_item':fail('Coverage source item missing','MISSING_EVIDENCE')
    if body['source_revision_uuid']!=source['body']['source']['revision_uuid']:fail('Coverage must pin exact source entry revision','SOURCE_UNVERIFIED')
    exact(root,plan,tickets,items,source['body']['source'])
    if not body['note'].strip():fail('Item disposition needs a note','MISSING_EVIDENCE')
    destinations=body['destination_refs'];decision=body['disposition_decision']
    if body['disposition'] in ('dropped','deferred'):
        if destinations or not decision:fail('Drop/defer requires exact disposition decision only','MISSING_EVIDENCE')
    elif not destinations:fail('Carried/adapted/changed item needs real destinations','MISSING_EVIDENCE')
    if len({digest(x) for x in destinations})!=len(destinations):fail('Duplicate item destinations')
    for pin in destinations:
        target=exact(root,plan,tickets,items,pin)
        if target['uuid'] not in by_id or target['kind']!='content' or target['lifecycle']!='live':fail('Destination must be owned live content','MISSING_EVIDENCE')
        scope=pin['scope_item_uuids']
        if not scope or len(scope)!=len(set(scope)) or source['uuid'] not in scope or set(scope)-set(target['body']['item_uuids']):fail('Destination must name the actual carried source item','MISSING_EVIDENCE')
        if require_current:
            from .relations import replacement
            active=replacement(items,target['uuid'])
            if active['fully_superseded'] or set(scope)-set(active['residual_item_uuids']):fail('Coverage destination item scope has been superseded; reconcile explicit current successor','REVISION_CONFLICT')
            if ref(by_id[target['uuid']])!={**pin,'scope_item_uuids':[]}:fail('Coverage destination is no longer current','REVISION_CONFLICT')
    if decision:
        target=exact(root,plan,tickets,items,decision)
        if target['kind']!='content' or target['body']['authority']!='owner_decision' or target['body']['state']!='active' or target['lifecycle']!='live':fail('Disposition requires actual owner decision','FORBIDDEN')
        if source['uuid'] not in decision['scope_item_uuids'] or source['uuid'] not in target['body']['item_uuids']:fail('Disposition decision must name exact item scope','MISSING_EVIDENCE')
        if require_current and target['uuid'] in by_id:
            from .relations import replacement
            active=replacement(items,target['uuid'])
            if active['fully_superseded'] or source['uuid'] not in active['residual_item_uuids']:fail('Disposition decision item scope has been superseded','REVISION_CONFLICT')
            if ref(by_id[target['uuid']])!={**decision,'scope_item_uuids':[]}:fail('Disposition decision is no longer current','REVISION_CONFLICT')
    return source


def apply_rows(root,request,actor,assignment,plan,tickets,items,rows,captured):
    """Captured destination refs are explicit bindings to each edited prospective owner.

    Only references to captured-current entries changed by this exact transaction
    are rebound. Caller source/item/disposition/scope never changes; arbitrary or
    historical pins are refused instead of silently repaired.
    """
    authority=authorization.authority(root,plan,tickets,assignment['body']['authority_ref'],assignment,request['expected'])
    seen=set()
    for original in rows:
        body=copy.deepcopy(original);key=body['source_item_uuid']
        if key in seen:fail('One current disposition per source item')
        seen.add(key)
        source=next((x for x in captured if x['uuid']==key and x['kind']=='source_item'),None)
        if not source:fail('Coverage source must be captured owned item','MISSING_EVIDENCE')
        if request['expected'].get(key)!=source['revision_uuid']:fail('Exact source item expectation required','REVISION_CONFLICT')
        for pin in body['destination_refs']:
            old=next((x for x in captured if x['uuid']==pin['entry_uuid']),None)
            new=next((x for x in items if x['uuid']==pin['entry_uuid']),None)
            if not old or not new or ref(old)!={**pin,'scope_item_uuids':[]} or request['expected'].get(old['uuid'])!=old['revision_uuid']:fail('Destination must bind exact captured current revision','REVISION_CONFLICT')
            pin.update(ref(new),scope_item_uuids=pin['scope_item_uuids'])
        if body['disposition_decision']:
            pin=body['disposition_decision'];decision=authorization.dependency(root,plan,tickets,{**pin,'scope_item_uuids':[]},request['expected'])
            if decision['body'].get('authority')!='owner_decision':fail('Disposition authority is not owner instruction','FORBIDDEN')
        check_row(root,plan,tickets,items,body,True)
        prior=next((x for x in items if x['kind']=='coverage' and x['body']['source_item_uuid']==key),None)
        if prior:
            if request['expected'].get(prior['uuid'])!=prior['revision_uuid']:fail('Exact current coverage expectation required','REVISION_CONFLICT')
            if prior['body']==body:continue
            item=copy.deepcopy(prior);item.update(body=body,revision_uuid=uid(),last_updated=now(),writer=seed.writer(actor))
            items[items.index(prior)]=item
        else:items.append(envelope('coverage',body,seed.writer(actor),seed.lineage(root,authority)))

    # Explicit removed-item rows are the canonical split producer. Record real
    # scoped lineage, never infer direction from unrelated shared raw item IDs.
    by_id={x['uuid']:x for x in items};transfers={}
    for old in captured:
        if old['kind']!='content':continue
        new=by_id.get(old['uuid'])
        removed=set(old['body']['item_uuids'])-set(new['body']['item_uuids']) if new else set()
        for body in rows:
            if body['source_item_uuid'] not in removed:continue
            for pin in body['destination_refs']:
                if pin['entry_uuid']!=old['uuid']:transfers.setdefault((pin['entry_uuid'],old['uuid']),set()).add(body['source_item_uuid'])
    for (child,parent),scope in transfers.items():
        existing=[x for x in items if x['kind']=='edge' and x['body']['edge_kind']=='derived_from' and x['body']['from_uuid']==child and x['body']['to_uuid']==parent]
        if any(not x['body']['scope_item_uuids'] for x in existing):continue
        scope-=set(key for x in existing for key in x['body']['scope_item_uuids'])
        if scope:items.append(envelope('edge',dict(edge_kind='derived_from',from_uuid=child,to_uuid=parent,from_revision_uuid=by_id[child]['revision_uuid'],to_revision_uuid=by_id[parent]['revision_uuid'],scope_item_uuids=sorted(scope),authority_ref=ref(authority)),seed.writer(actor)))


def required(rows,keys):
    if set(keys)-{x['source_item_uuid'] for x in rows}:fail('Every affected source item needs a complete disposition','MISSING_EVIDENCE')


def removal(rows,old,new):
    removed=set(old)-set(new)
    for key in removed:
        row=next((x for x in rows if x['source_item_uuid']==key),None)
        if not row or not row['note'].strip() or (row['disposition'] in ('dropped','deferred') and not row['disposition_decision']) or (row['disposition'] in ('carried','adapted','changed') and not row['destination_refs']):fail('Source removal requires explicit destination or drop/defer decision','MISSING_EVIDENCE')


def ledger(root,plan,tickets,items):
    rows=[x for x in items if x['kind']=='coverage'];entries=[];gaps=[]
    for source in [x for x in items if x['kind']=='source_item']:
        matches=[x for x in rows if x['body']['source_item_uuid']==source['uuid']]
        reason=None
        if len(matches)!=1:reason='Missing or ambiguous current disposition'
        else:
            try:check_row(root,plan,tickets,items,matches[0]['body'],True)
            except Exception as error:reason=str(error)
        if reason:gaps.append(dict(source_item_uuid=source['uuid'],reason=reason))
        entries.append(dict(source_item_uuid=source['uuid'],source_ref=source['body']['source'],text=source['body']['text'],coverage_ref=ref(matches[0]) if len(matches)==1 else None,disposition=matches[0]['body'] if len(matches)==1 else None,complete=reason is None))
    return dict(complete=not gaps,item_count=len(entries),entries=entries,holds=gaps,mapping_is_delivery=False,mapping_is_approval=False,scope='Identified registered source items only; source/import gaps remain explicit')


def merge(root,args,actor,assignment,plan,tickets,items,expected,rows):
    from .edits import changed
    from . import records, relations
    by_id={x['uuid']:x for x in items};old=by_id.get(args['uuid']);target=by_id.get(args['target_uuid'])
    if not old or not target or old==target or any(x['kind']!='content' or x['lifecycle']!='live' for x in (old,target)):fail('Merge needs distinct live owned content','INVALID_TRANSITION')
    for item in (old,target):
        prior=next((x for t in tickets.values() for x in current(t) if x['uuid']==item['uuid']),None)
        if prior:records.expect(prior,expected)
    validate(args['body'],schema('record.schema.json')['$defs']['content'])
    if args['body']['authority']!=target['body']['authority'] or args['body']['state']!=target['body']['state']:fail('Merge cannot confer authority or approval','FORBIDDEN')
    if target['body']['authority']=='owner_decision':fail('Owner decisions require named decision authority','FORBIDDEN')
    records.sources(root,assignment,args['source_refs'],old['source_refs']+target['source_refs'])
    required(rows,set(old['body']['item_uuids'])|set(target['body']['item_uuids']))
    removal(rows,target['body']['item_uuids'],args['body']['item_uuids'])
    for key in old['body']['item_uuids']:
        row=next(x for x in rows if x['source_item_uuid']==key)
        if row['disposition'] not in ('dropped','deferred') and (key not in args['body']['item_uuids'] or not any(p['entry_uuid']==target['uuid'] for p in row['destination_refs'])):fail('Merge must account for every source item in explicit target','MISSING_EVIDENCE')
    item=changed(target,args['body'],args['source_refs'],target['extensions'],actor)
    items[items.index(target)]=item
    relations.apply(root,dict(old_uuid=old['uuid'],new_uuid=item['uuid'],scope_item_uuids=old['body']['item_uuids'],authority_ref=assignment['body']['authority_ref'],reverse_input=False),actor,assignment,plan,tickets,items,expected)
    return item
