"""Own provisional checklist obligations and exact approved-SPEC alignment.

The draft checklist is provisional. Reconciliation aligns named checklist content
to an exact approved SPEC via the existing prospective edit engine and an exact
digest; unresolved carried obligations stay pending and are never silently closed.
"""
from .schema import fail, current
from .store import digest, ref
from . import authorization
from .workflow import review_digest

READS={'checklist.current','checklist.obligations'}
PREVIEW={'checklist.reconcile_preview'}
APPLY={'checklist.reconcile_apply'}
OPERATIONS=READS|PREVIEW|APPLY
SUB_OPS={'record.create','record.update'}
SPEC_AUTHORITY=('spec_contract','owner_decision')


def category(items):
    cats=[x for x in items if x['kind']=='category' and x['body'].get('category_key')=='checklist']
    if len(cats)!=1:fail('Exact checklist category required','MISSING_EVIDENCE')
    return cats[0]


def contents(items):
    cat=category(items)
    return [x for x in items if x['kind']=='content' and x['lifecycle']=='live' and x['body']['category_uuid']==cat['uuid']]


def _current_binding(items,by_id,content):
    for reference in (x for x in items if x['kind']=='reference' and x['lifecycle']=='live' and x['body']['target_kind']=='plan_entry'):
        if content['uuid'] not in reference['body']['supported_scope']:continue
        target=by_id.get(reference['body']['locator'])
        if target and target['kind']=='content' and reference['body']['used_revision']==target['revision_uuid'] and reference['body']['used_sha256']==digest(target):
            return reference,target
    return None,None


def state(items):
    cat=category(items);by_id={x['uuid']:x for x in items};rows=[];specs={}
    for content in contents(items):
        binding,target=_current_binding(items,by_id,content)
        if binding:specs[binding['body']['used_sha256']]=binding['body']['locator']
        rows.append(dict(content_ref=ref(content),source_item_uuids=list(content['body']['item_uuids']),title=content['body']['title'],
                         text=content['body']['content'],state='reconciled' if binding else 'pending',
                         alignment_ref=ref(binding) if binding else None,spec_uuid=binding['body']['locator'] if binding else None))
    draft=digest([dict(uuid=x['uuid'],revision_uuid=x['revision_uuid']) for x in contents(items)])
    return dict(category_ref=ref(cat),items=rows,item_count=len(rows),draft_digest=draft,
                approved_spec_digest=next(iter(specs)) if specs else None,
                aligned_spec_uuids=sorted(set(specs.values())),
                unresolved_refs=[x['content_ref'] for x in rows if x['state']=='pending'],
                provisional=True,
                disclosure='Draft checklist is provisional; unresolved carried obligations stay pending through reconcile')


def obligations(items):
    """Per-item obligation state; unresolved carried items remain pending."""
    base=state(items);by_id={x['uuid']:x for x in items};rows=[]
    for row in base['items']:
        content=by_id[row['content_ref']['entry_uuid']]
        for item_uuid in row['source_item_uuids']:
            item=by_id.get(item_uuid)
            rows.append(dict(source_item_uuid=item_uuid,content_ref=row['content_ref'],text=item['body']['text'] if item else None,
                             state=row['state'],reason='Exact approved SPEC alignment recorded' if row['state']=='reconciled' else 'Unresolved carried obligation remains pending'))
    base['obligations']=rows
    base['pending']=[x for x in rows if x['state']=='pending']
    base['mapping_is_approval']=False
    return base


def read(root,request,plan,tickets,actor,assignment):
    from .commands import read_response
    args=request['args'];selected=request['scope'].get('ticket_uuid')
    if selected not in tickets:fail('Exact selected ticket required','MISSING_EVIDENCE')
    snapshot=tickets[selected];items=current(snapshot)
    if not any(x['uuid']==args['uuid'] for x in items):fail('Checklist subject missing from exact selected scope','MISSING_EVIDENCE')
    projection=state(items) if request['operation']=='checklist.current' else obligations(items)
    projection['subject_uuid']=args['uuid']
    return read_response(request,plan,projection)


def _check(operations):
    for sub in operations:
        if sub['operation'] not in SUB_OPS:fail('Checklist reconcile operation outside bounded vocabulary','UNSUPPORTED_OPERATION')
        if sub['operation']=='record.create' and sub['args'].get('kind') not in ('reference',):
            fail('Checklist reconcile may create only exact approved-SPEC reference bindings','UNSUPPORTED_OPERATION')


def review_digest(operations,target_expected,coverage_rows):
    """Exact approved-SPEC reconcile digest over operations/coverage (not pins)."""
    return digest(dict(proposed_operations=operations,target_expected=target_expected,coverage_rows=coverage_rows))


def _spec_pins_by_id(items):
    known={x['uuid']:x for x in items if x['kind']=='content' and x['body']['authority'] in SPEC_AUTHORITY}
    return known


def spec_pins(items,operations):
    """Reconstruct the exact approved-SPEC source pins from the reference operations."""
    known=_spec_pins_by_id(items);pins=[]
    for sub in operations:
        if sub['operation']!='record.create' or sub['args'].get('kind')!='reference':continue
        body=sub['args']['body'];target=known.get(body['locator'])
        if not target:continue
        pins.append(dict(kind=target['body']['authority'],locator=body['locator'],revision=body['used_revision'],
                         sha256=body['used_sha256'],recorded_at=body['used_stamp'],native_ref=None))
    return pins


def spec_guard(items,source_refs,operations,expected):
    specs=[pin for pin in source_refs if pin['kind'] in SPEC_AUTHORITY]
    if not specs:fail('Checklist reconcile requires an exact approved SPEC pin','MISSING_EVIDENCE')
    derived=spec_pins(items,operations)
    if source_refs!=derived:fail('Checklist reconcile source pins must equal the exact SPEC the operations bind','SOURCE_UNVERIFIED')
    for pin in specs:
        item=next((x for x in items if x['uuid']==pin['locator'] and x['kind']=='content'),None)
        if not item:fail('Approved SPEC pin must reference an owned content record','MISSING_EVIDENCE')
        if item['body']['authority'] not in SPEC_AUTHORITY or item['body']['state']!='active':fail('Approved SPEC must be active owner/spec authority','FORBIDDEN')
        if pin['sha256']!=digest(item) or pin['revision']!=item['revision_uuid']:fail('Approved SPEC alignment digest is not exact','REVISION_CONFLICT')
    if not any(sub['operation']=='record.create' and sub['args'].get('kind')=='reference' for sub in operations):
        fail('Reconcile must create an exact approved-SPEC reference binding','MISSING_EVIDENCE')


def verify_apply(root,request,actor,assignment,plan,tickets):
    args=request['args'];_check(args['operations'])
    if assignment['body']['authority_ref'] not in args['authority_refs']:fail('Checklist reconcile requires the explicit assigned authority','MISSING_EVIDENCE')
    for pin in args['authority_refs']:authorization.authority(root,plan,tickets,pin,assignment,request['expected'])
    selected=request['scope'].get('ticket_uuid')
    if selected not in tickets:fail('Exact selected ticket required','MISSING_EVIDENCE')
    items=current(tickets[selected])
    spec_guard(items,spec_pins(items,args['operations']),args['operations'],request['expected'])
    if review_digest(args['operations'],request['expected'],args['coverage_rows'])!=args['preview_digest']:
        fail('Checklist preview digest does not match exact operations/expectations','REVISION_CONFLICT')


def preview(root,request,actor,assignment,plan,tickets):
    from .commands import base
    from .transaction import expectations
    from .edits import prepare
    args=request['args']
    if request['operation'] not in actor['body']['granted_operations']:fail('Preview grant absent','FORBIDDEN')
    _check(args['proposed_operations'])
    selected=request['scope'].get('ticket_uuid')
    if selected not in tickets:fail('Exact selected ticket required','MISSING_EVIDENCE')
    spec_guard(current(tickets[selected]),args['source_refs'],args['proposed_operations'],args['target_expected'])
    trial={**request,'tool':'db.mutate','operation':'checklist.reconcile_apply',
           'args':dict(preview_digest=review_digest(args['proposed_operations'],args['target_expected'],args['coverage_rows']),
                       operations=args['proposed_operations'],coverage_rows=args['coverage_rows'],
                       authority_refs=[assignment['body']['authority_ref']]),
           'expected':args['target_expected'],'expected_plan_revision_uuid':plan['root_revision_uuid']}
    expectations(trial,plan,[tickets[selected]],root)
    prepare(root,trial,actor,assignment,plan,tickets,args['target_expected'],args['coverage_rows'])
    return {**base(request,plan),'result_kind':'preview','preview_digest':review_digest(args['proposed_operations'],args['target_expected'],args['coverage_rows']),
            'proposed_operations':args['proposed_operations'],'expected':args['target_expected'],'coverage_rows':args['coverage_rows'],
            'authority_impacts':['Checklist alignment is derived from exact approved-SPEC digests; unresolved obligations stay pending'],
            'recovery_prerequisites':['Exact generation, approved-SPEC digest and complete affected item accounting']}
