"""Own definition hierarchy edits, acyclic checks and the top-level card projection.

A workflow node is inert authored data. Editing it never executes its text, keeps
its stable UUID and full retained history, and never silently repoints a pinned
active assignment. Preview/apply reuse the existing prospective edit engine and
the authored operations registry entries verbatim; no parallel publisher exists.
"""
import copy
from .schema import fail, current, validate, schema, ContractError
from .store import digest, ref, envelope
from . import authorization, seed

# Authored read operations (all db.get) and the combined preview/apply pair.
READS={'workflow.node_get','workflow.outline','workflow.children','workflow.ancestors',
       'workflow.dependencies','workflow.gates'}
PREVIEW={'workflow.edit_preview'}
APPLY={'workflow.edit_apply'}
OPERATIONS=READS|PREVIEW|APPLY
# workflow.edit_apply is the named authority for node edits; its subrequests use
# the authored generic record operations restricted to workflow nodes/edges.
SUB_OPS={'record.create','record.update'}
ACTIVE={'claimed','running','paused','blocked'}


def nodes(items):
    return [x for x in items if x['kind']=='workflow_node']


def ordered(values):
    return sorted(values,key=lambda x:(x['body']['order'],x['uuid']))


def children(items,uuid):
    return ordered([x for x in nodes(items) if x['body']['parent_uuid']==uuid])


def top_level(items):
    return ordered([x for x in nodes(items) if x['body']['parent_uuid'] is None])


def ancestors(items,uuid):
    by_id={x['uuid']:x for x in nodes(items)};chain=[];seen=set();cursor=uuid
    while cursor:
        if cursor in seen:fail('Cyclic workflow hierarchy','INVALID_SCHEMA')
        seen.add(cursor);node=by_id.get(cursor)
        if not node:break
        chain.append(node);cursor=node['body']['parent_uuid']
    return chain


def dependencies(items,uuid):
    return [x for x in items if x['kind']=='edge' and x['body']['edge_kind']=='dependency'
            and uuid in (x['body']['from_uuid'],x['body']['to_uuid'])]


def outline_row(node,items):
    return dict(uuid=node['uuid'],revision_uuid=node['revision_uuid'],title=node['body']['title'],
                description=node['body']['description'],node_kind=node['body']['node_kind'],order=node['body']['order'],
                gate_kind=node['body']['gate_kind'],prerequisite_refs=node['body']['prerequisite_refs'],
                children=[outline_row(child,items) for child in children(items,node['uuid'])])


def read(root,request,plan,tickets,actor,assignment):
    from .commands import read_response
    from .acceptance import gates_projection
    op=request['operation'];args=request['args'];selected=request['scope'].get('ticket_uuid')
    if selected not in tickets:fail('Exact selected ticket required','MISSING_EVIDENCE')
    snapshot=tickets[selected];items=current(snapshot);pinned=bool(args.get('revision_uuid'))
    pool=snapshot['revisions'] if pinned else items

    def find(uuid):
        matches=[x for x in pool if x['uuid']==uuid]
        if pinned:matches=[x for x in matches if x['revision_uuid']==args['revision_uuid']]
        if not matches:fail('Workflow record missing from exact selected scope','MISSING_EVIDENCE')
        return matches[-1]

    selector='pinned' if pinned else 'current'
    if op=='workflow.outline':
        roots=top_level(items) if not args.get('uuid') else [find(args['uuid'])]
        details=dict(selector=selector,stage_count=len(top_level(items)),
                     outline=[outline_row(node,items) for node in roots if node['kind']=='workflow_node'],
                     disclosure='Authored definition only; inert data, never executed')
        return read_response(request,plan,details)
    item=find(args['uuid'])
    if item['kind']!='workflow_node':fail('Workflow read requires an exact workflow node','MISSING_EVIDENCE')
    if op=='workflow.node_get':
        details=dict(selector=selector,node=item,ancestors=[x['uuid'] for x in ancestors(items,item['uuid'])[1:]],
                     children=[x['uuid'] for x in children(items,item['uuid'])],
                     dependencies=[ref(x) for x in dependencies(items,item['uuid'])])
    elif op=='workflow.children':
        details=dict(selector=selector,children=[outline_row(x,items) for x in children(items,item['uuid'])])
    elif op=='workflow.ancestors':
        details=dict(selector=selector,ancestors=[outline_row(x,items) for x in ancestors(items,item['uuid'])[1:]])
    elif op=='workflow.dependencies':
        details=dict(selector=selector,dependencies=[dict(edge=x,disclosure='Exact dependency edge') for x in dependencies(items,item['uuid'])])
    else:  # workflow.gates
        projection=gates_projection(items)
        details=dict(selector=selector,owner_gate=projection.get(item['uuid']),
                     gates={key:value for key,value in projection.items()},
                     disclosure='Owner gates become eligible only after their own real released prerequisites')
    return read_response(request,plan,details)


def projection(items):
    """Card icon/color derives only from explicit current top-level workflow state.

    Nested review/attempt/gate icons never roll up into the ticket card.
    """
    by_id={x['uuid']:x for x in nodes(items)}
    target=next((x for x in items if x['kind']=='ticket'),None)
    cursor=target['body'].get('current_workflow_node_uuid') if target else None
    chain=[];seen=set()
    while cursor and cursor not in seen:
        node=by_id.get(cursor)
        if not node:break
        seen.add(cursor);chain.append(node);cursor=node['body']['parent_uuid']
    top=chain[-1] if chain else (top_level(items)[0] if top_level(items) else None)
    card=None
    if top:
        icon={'conversation':'chat_display','autonomous':'autostop','owner_gate':'back_hand','checkpoint':'check_circle'}.get(top['body']['node_kind'],'autostop')
        color={'conversation':'neutral','autonomous':'running','owner_gate':'owner','checkpoint':'done'}.get(top['body']['node_kind'],'neutral')
        from .acceptance import gates_projection
        gate=gates_projection(items).get(top['uuid']) if top['body']['node_kind']=='owner_gate' else None
        if gate:icon=gate['icon']
        card=dict(node_uuid=top['uuid'],node_kind=top['body']['node_kind'],icon=icon,color=color,
                  title=top['body']['title'],source='explicit current top-level workflow node',
                  gate_eligible=gate['eligible'] if gate else None)
    return dict(card=card,top_level=[x['uuid'] for x in top_level(items)],node_count=len(by_id))


def _check_ops(operations):
    for sub in operations:
        op=sub['operation']
        if op not in SUB_OPS:fail('Workflow edit operation outside bounded vocabulary','UNSUPPORTED_OPERATION')
        if op=='record.create':
            kind=sub['args'].get('kind')
            if kind not in ('workflow_node','edge','content'):fail('Workflow edit may create workflow nodes, dependency edges or definitions only','UNSUPPORTED_OPERATION')
            if kind=='edge' and sub['args']['body'].get('edge_kind')!='dependency':fail('Workflow edit edges must be dependency edges','UNSUPPORTED_OPERATION')
        if op=='record.update' and sub['args'].get('body') is None:fail('Workflow edit update needs a body','UNSUPPORTED_OPERATION')


def _pins(operations):
    pins=[]
    for sub in operations:
        for pin in sub['args'].get('source_refs',[]):
            if pin not in pins:pins.append(pin)
    return pins


def review_digest(source_refs,operations,target_expected,coverage_rows):
    return digest(dict(source_refs=source_refs,proposed_operations=operations,target_expected=target_expected,coverage_rows=coverage_rows))


def guard(operations,plan,tickets,expected):
    """Refuse silently repointing a definition a published/active assignment pins."""
    changed_nodes={sub['args']['uuid'] for sub in operations if sub['operation']=='record.update' and sub['args'].get('uuid')}
    changed_defs=set()
    for ticket in tickets.values():
        for item in current(ticket):
            if item['uuid'] not in changed_nodes:continue
            if item['kind']=='workflow_node':changed_defs.add(item['body']['definition_ref']['entry_uuid'])
    changed=changed_nodes|changed_defs
    if not changed:return
    for ticket in tickets.values():
        items=current(ticket);jobs={x['uuid']:x for x in items if x['kind']=='assignment'}
        for attempt in items:
            if attempt['kind']!='attempt' or attempt['body']['state'] not in ACTIVE:continue
            job=jobs.get(attempt['body']['assignment_uuid'])
            if not job:continue
            pinned={p['entry_uuid'] for p in job['body']['source_refs']}|{p['entry_uuid'] for p in job['body']['prerequisite_refs']}
            if pinned & changed:
                fail('Active assignment pins this definition; edit cannot silently repoint it','INVALID_TRANSITION')


def verify_apply(root,request,actor,assignment,plan,tickets):
    args=request['args'];_check_ops(args['operations'])
    if assignment['body']['authority_ref'] not in args['authority_refs']:
        fail('Workflow edit requires the explicit assigned authority','MISSING_EVIDENCE')
    for pin in args['authority_refs']:authorization.authority(root,plan,tickets,pin,assignment,request['expected'])
    original=review_digest(_pins(args['operations']),args['operations'],request['expected'],args['coverage_rows'])
    if original!=args['preview_digest']:fail('Workflow preview digest does not match exact operations/expectations','REVISION_CONFLICT')
    guard(args['operations'],plan,tickets,request['expected'])


def preview(root,request,actor,assignment,plan,tickets):
    from .commands import base
    from .transaction import expectations
    from .edits import prepare
    from .records import sources
    args=request['args']
    if request['operation'] not in actor['body']['granted_operations']:fail('Preview grant absent','FORBIDDEN')
    _check_ops(args['proposed_operations'])
    selected=request['scope'].get('ticket_uuid')
    trial={**request,'tool':'db.mutate','operation':'workflow.edit_apply',
           'args':dict(preview_digest=review_digest(args['source_refs'],args['proposed_operations'],args['target_expected'],args['coverage_rows']),
                       operations=args['proposed_operations'],coverage_rows=args['coverage_rows'],
                       authority_refs=[assignment['body']['authority_ref']]),
           'expected':args['target_expected'],'expected_plan_revision_uuid':plan['root_revision_uuid']}
    expectations(trial,plan,[tickets[selected]] if selected in tickets else [],root)
    if args['source_refs']!=_pins(args['proposed_operations']):fail('Workflow preview source pins must equal ordered operation pins')
    sources(root,assignment,args['source_refs'])
    guard(args['proposed_operations'],plan,tickets,args['target_expected'])
    prepare(root,trial,actor,assignment,plan,tickets,args['target_expected'],args['coverage_rows'])
    return {**base(request,plan),'result_kind':'preview','preview_digest':review_digest(args['source_refs'],args['proposed_operations'],args['target_expected'],args['coverage_rows']),
            'proposed_operations':args['proposed_operations'],'expected':args['target_expected'],'coverage_rows':args['coverage_rows'],
            'authority_impacts':['Definition edits are inert data; active assignments keep immutable pins'],
            'recovery_prerequisites':['Exact generation, node expectations, acyclic hierarchy/dependencies and current source pins']}


def create_node(args,actor,items,expected):
    body=copy.deepcopy(args['body'])
    validate(body,schema('record.schema.json')['$defs']['workflow_node'])
    if body['definition_ref']['entry_uuid'] not in {x['uuid'] for x in items}:
        fail('New workflow node must pin a definition owned by the selected ticket','MISSING_EVIDENCE')
    item=envelope('workflow_node',body,seed.writer(actor),copy.deepcopy(args.get('source_refs',[])))
    item['extensions']=copy.deepcopy(args.get('extensions',{}))
    items.append(item)
    return item


def update_node(args,actor,items,expected,old):
    if expected.get(old['uuid'])!=old['revision_uuid']:
        raise ContractError('REVISION_CONFLICT','Exact workflow node expectation required',{old['uuid']:old['revision_uuid']})
    validate(args['body'],schema('record.schema.json')['$defs']['workflow_node'])
    if args['body']['definition_ref']!=old['body']['definition_ref']:
        fail('Workflow node definition_ref is immutable','FORBIDDEN')
    from .edits import changed, invalidate_acceptances
    item=changed(old,args['body'],args.get('source_refs',old['source_refs']),args.get('extensions',old['extensions']),actor)
    if item==old:return old
    items[items.index(old)]=item
    invalidate_acceptances(items,{old['uuid']},expected,actor)
    return item
