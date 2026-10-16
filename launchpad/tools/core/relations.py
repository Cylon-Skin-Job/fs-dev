"""Own one-way scoped replacement with derived residual and inverse disclosure."""
from .schema import fail, current
from .store import envelope, ref
from . import authorization, seed

OPERATIONS={'record.supersede','decision.supersede'}


def replacement(items,uuid):
    subject=next((x for x in items if x['uuid']==uuid),None)
    outgoing=[x for x in items if x['kind']=='edge' and x['lifecycle']=='live' and x['body']['edge_kind']=='supersedes' and x['body']['from_uuid']==uuid]
    incoming=[x for x in items if x['kind']=='edge' and x['lifecycle']=='live' and x['body']['edge_kind']=='supersedes' and x['body']['to_uuid']==uuid]
    ids=subject['body'].get('item_uuids',[]) if subject else []
    covered={key for x in outgoing for key in x['body']['scope_item_uuids']}
    full=bool(outgoing) and (any(not x['body']['scope_item_uuids'] for x in outgoing) or bool(ids) and set(ids)<=covered)
    return dict(fully_superseded=full,residual_item_uuids=[] if full else [x for x in ids if x not in covered],
                superseded_by=[dict(edge_ref=ref(x),replacement_uuid=x['body']['to_uuid'],scope_item_uuids=x['body']['scope_item_uuids']) for x in outgoing],
                supersedes=[dict(edge_ref=ref(x),source_uuid=x['body']['from_uuid'],scope_item_uuids=x['body']['scope_item_uuids']) for x in incoming])


def apply(root,args,actor,assignment,plan,tickets,items,expected):
    # old_uuid/new_uuid are semantic owners even when input is supplied from the
    # new side. reverse_input changes presentation only, never stored direction.
    by_id={x['uuid']:x for x in items};old=by_id.get(args['old_uuid']);new=by_id.get(args['new_uuid'])
    if not old or not new:fail('Replacement endpoints missing from selected ticket','MISSING_EVIDENCE')
    if any(x['kind']!='content' or x['lifecycle']!='live' for x in (old,new)):fail('Replacement requires live content endpoints','INVALID_TRANSITION')
    captured={x['uuid']:x for ticket in tickets.values() for x in current(ticket)}
    for x in (old,new):
        original=captured.get(x['uuid'])
        if original and expected.get(x['uuid'])!=original['revision_uuid']:fail('Exact captured replacement endpoint expectation required','REVISION_CONFLICT')
    scope=args['scope_item_uuids']
    if len(scope)!=len(set(scope)) or set(scope)-set(old['body']['item_uuids']):fail('Invalid or duplicate replacement scope')
    for key in scope:
        item=by_id.get(key)
        if not item or item['kind']!='source_item':fail('Replacement source item missing','MISSING_EVIDENCE')
        original=captured.get(key)
        if original and expected.get(key)!=original['revision_uuid']:fail('Exact captured source item expectation required','REVISION_CONFLICT')
    authority=authorization.authority(root,plan,tickets,args['authority_ref'],assignment,expected)
    edge=envelope('edge',dict(edge_kind='supersedes',from_uuid=old['uuid'],to_uuid=new['uuid'],from_revision_uuid=old['revision_uuid'],to_revision_uuid=new['revision_uuid'],scope_item_uuids=scope,authority_ref=ref(authority)),seed.writer(actor))
    items.append(edge);return edge


def validate_scope(items,edge,captured,expected):
    if edge['body']['edge_kind']!='supersedes':return
    by_id={x['uuid']:x for x in items};body=edge['body'];old=by_id[body['from_uuid']];new=by_id[body['to_uuid']]
    if old['kind']!='content' or new['kind']!='content':fail('Supersession requires content owners')
    if any(x['uuid']!=edge['uuid'] and x['kind']=='edge' and x['body']['edge_kind']=='supersedes' and x['body']['from_uuid']==old['uuid'] and x['body']['to_uuid']==new['uuid'] for x in items):fail('Duplicate canonical replacement endpoints')
    scope=body['scope_item_uuids']
    if len(scope)!=len(set(scope)):fail('Duplicate replacement source item')
    if captured.get(edge['uuid'])==edge:return
    if old['lifecycle']!='live' or new['lifecycle']!='live':fail('New supersession requires live endpoints','INVALID_TRANSITION')
    for key in scope:
        if key not in by_id or by_id[key]['kind']!='source_item':fail('Missing replacement item')
        if key in captured and expected.get(key)!=captured[key]['revision_uuid']:fail('Exact source item expectation required','REVISION_CONFLICT')
