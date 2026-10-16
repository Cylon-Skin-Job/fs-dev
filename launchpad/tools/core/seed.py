"""Mint fresh seed tickets from pinned, assigned sources."""
import copy
from pathlib import Path
from .schema import fail, current
from .store import uid, now, digest, ref, envelope, container, evidence, file_hash, safe_name

TEMPLATE = Path(__file__).resolve().parents[2] / 'work-tickets/template/template.json'


def writer(actor):
    b = actor['body']
    return dict(actor_uuid=actor['uuid'], runtime_kind=b['runtime_kind'],
                runtime_id=b['runtime_id'], parent_actor_uuid=b['parent_actor_uuid'])


def lineage(root,source):
    return copy.deepcopy(source['source_refs'])+[dict(kind='source_of_truth_contract',locator=str(Path(root)/'.evidence'/(source['revision_uuid']+'.json')),
               revision=source['revision_uuid'],sha256=digest(source),recorded_at=source['last_updated'],native_ref=None)]


def retained_pins(old, pins):
    return copy.deepcopy(old['source_refs'])+[copy.deepcopy(x) for x in pins if x not in old['source_refs']]


def verified_seed(root, reference, assignment):
    source = evidence(root, reference)
    if source['kind'] != 'content' or not source['source_refs']:
        fail('Seed needs pinned source content', 'SOURCE_UNVERIFIED')
    base = Path(assignment['body']['source_checkout']).resolve()
    for pin in source['source_refs']:
        path = Path(pin['locator'])
        if not path.is_absolute() or not path.resolve().is_relative_to(base):
            fail('Seed source outside assigned source root', 'FORBIDDEN')
        if path.is_symlink() or not path.is_file() or file_hash(path) != pin['sha256']:
            fail('Seed source bytes do not match pin', 'SOURCE_UNVERIFIED')
    return source


def mint(root, request, actor, assignment, plan, tickets):
    import json
    args = request['args']
    template = json.loads(TEMPLATE.read_text())
    if args['template_revision'] != file_hash(TEMPLATE):
        fail('Template changed', 'SOURCE_UNVERIFIED')
    safe_name(args['ticket_folder'])
    source = verified_seed(root, args['seed_ref'], assignment)
    aliases=[x['source_alias'] for key in ('scope_items','checklist_items') for x in args[key]]
    if None in aliases or len(set(aliases))!=len(aliases):
        fail('Seed items require unique source aliases')
    root_record = next(x for x in current(plan) if x['kind'] == 'plan')
    if args['track_uuid'] not in [x['uuid'] for x in root_record['body']['tracks']]:
        fail('Unknown selected track')
    if any(x['current_home'].split('/')[-1] == args['ticket_folder'] for x in root_record['body']['ticket_bindings']):
        fail('Duplicate ticket home', 'REVISION_CONFLICT')
    ticket_id = uid()
    w = writer(actor)
    source_pins = lineage(root,source)
    records = []
    categories = {}
    for order, title in enumerate(template['categories']):
        cat = envelope('category', dict(title=title, category_key=title.lower().replace(' ', '_'), parent_uuid=None, order=order), w)
        records.append(cat)
        categories[title] = cat
    capture = envelope('content', dict(title='Initial Capture', category_uuid=categories['Capture']['uuid'],
                       format=source['body']['format'], content=copy.deepcopy(source['body']['content']),
                       authority='source_of_truth_contract', state='active', item_uuids=[]), w, source_pins)
    records.append(capture)
    capture['extensions']=copy.deepcopy(source['extensions'])
    for label, values in [('Scope', args['scope_items']), ('ToDo', args['checklist_items'])]:
        for value in values:
            item_source = evidence(root, value['source'])
            if item_source['uuid'] != source['uuid'] or item_source['revision_uuid'] != source['revision_uuid']:
                fail('Scope item is not from assigned seed', 'SOURCE_UNVERIFIED')
            item = envelope('source_item', copy.deepcopy(value), w, source_pins)
            content = envelope('content', dict(title=label, category_uuid=categories['Capture' if label=='Scope' else 'Checklist']['uuid'],
                               format='plain', content=value['text'], authority='source_of_truth_contract', state='active',
                               item_uuids=[item['uuid']]), w, source_pins)
            records += [item, content]
            capture['body']['item_uuids'].append(item['uuid'])
    # Definition is a content snapshot, separate from supplied assignments or runtime starts.
    definition = envelope('content', dict(title='Seed workflow definition', category_uuid=categories['Ticket']['uuid'],
                          format='json', content=template['workflow'], authority='implementation_choice', state='active', item_uuids=[]), w)
    records.append(definition)
    nodes = []
    for order, step in enumerate(template['workflow']):
        node = envelope('workflow_node', dict(title=step['title'], description=step['description'], node_kind=step['node_kind'],
                        parent_uuid=None, order=order, prerequisite_refs=[], definition_ref=ref(definition),
                        gate_kind='owner' if step['node_kind']=='owner_gate' else None), w)
        nodes.append(node)
        if step['title'] in ('Readiness Check','Pre-Flight Check'):
            review_node=envelope('workflow_node',dict(title='Report Review',description='Discuss the exact saved report before proceeding.',
                       node_kind='conversation',parent_uuid=node['uuid'],order=0,prerequisite_refs=[],definition_ref=ref(definition),gate_kind=None),w)
            records.append(review_node)
        if step['checkpoint']:
            records.append(envelope('workflow_node', dict(title='Closing Checkpoint', description='Reviewed closure of this discussion.',
                            node_kind='checkpoint', parent_uuid=node['uuid'], order=1, prerequisite_refs=[],
                            definition_ref=ref(definition), gate_kind='independent_review'), w))
    records += nodes
    ticket = envelope('ticket', dict(title=args['title'], number=len(tickets)+1, plan_uuid=plan['root_uuid'],
                      current_home=args['ticket_folder'], state='seed', seed_ref=args['seed_ref'],
                      category_refs=[ref(x) for x in categories.values()], current_workflow_node_uuid=nodes[1]['uuid'],
                      record_refs=[ref(x) for x in records], finalization_ref=None), w, source_pins, ticket_id)
    records.append(ticket)
    result = container('ticket', ticket_id, records, seq=plan['commit_seq']+1)
    layout_category = next(x for x in current(plan) if x['kind']=='category' and x['body']['category_key']=='layout')
    presentation=source['extensions'].get('source.preserved',{}).get('presentation',{})
    if set(presentation)-{'position','slot'} or presentation.get('position','track') not in ('opening','track','convergence') or type(presentation.get('slot',0)) is not int or presentation.get('slot',0)<0:
        fail('Invalid source presentation declaration')
    layout = envelope('content', dict(title='Ticket placement', category_uuid=layout_category['uuid'], format='json',
                      content={'ticket_uuid':ticket_id,'track_uuid':args['track_uuid'],'position':presentation.get('position','track'),'slot':presentation.get('slot')},
                      authority='implementation_choice',state='active',item_uuids=[]), w)
    return result, layout


def seed_roles(ticket, records):
    """Resolve immutable mint roles once, then retain their logical UUIDs."""
    initial=min((x for x in ticket['revisions'] if x['kind']=='ticket'),key=lambda x:x['last_updated'])
    revisions={x['revision_uuid']:x for x in ticket['revisions']}
    originals=[]
    for pin in initial['body']['record_refs']:
        item=revisions.get(pin['revision_uuid'])
        if not item or ref(item)!=pin:fail('Original seed role reference corrupt','UNSUPPORTED_STORE')
        originals.append(item)
    categories={x['body']['category_key']:x['uuid'] for x in originals if x['kind']=='category'}
    captures=[x for x in originals if x['kind']=='content' and x['body']['title']=='Initial Capture' and x['body']['category_uuid']==categories.get('capture') and x['body']['authority']=='source_of_truth_contract']
    if len(captures)!=1:fail('Original seed role missing/ambiguous','UNSUPPORTED_STORE')
    by_id={x['uuid']:x for x in records}
    capture=by_id.get(captures[0]['uuid'])
    if not capture or any(categories.get(key) not in by_id for key in ('capture','checklist')):
        fail('Current seed role missing','UNSUPPORTED_STORE')
    return capture,categories


def apply_seed(root, request, actor, assignment, ticket, dispositions=None):
    from . import dependencies
    dependencies.seed_guard([ticket])
    source = verified_seed(root, request['args']['seed_ref'], assignment)
    root_record = next(x for x in current(ticket) if x['kind']=='ticket')
    if root_record['body']['state'] != 'seed':
        fail('Seed edits require seed state', 'INVALID_TRANSITION')
    # Shape-equivalent replacements retain the ticket identity, never native claims or grants.
    args = request['args']
    records = copy.deepcopy(current(ticket))
    old_items={x['body']['source_alias']:x for x in records if x['kind']=='source_item'}
    aliases=[x['source_alias'] for key in ('scope_items','checklist_items') for x in args[key]]
    removed=set(old_items)-set(aliases)
    if removed:
        from . import coverage
        coverage.removal(dispositions or [],[old_items[x]['uuid'] for x in removed],[])
    if None in aliases or len(set(aliases))!=len(aliases):
        fail('Seed edit requires unique item aliases and complete prior-item accounting','SOURCE_UNVERIFIED')
    old_capture,cats=seed_roles(ticket,records)
    item_ids={x['uuid'] for x in old_items.values()}
    owned_contents=[x for x in records if x['kind']=='content' and x['uuid']!=old_capture['uuid'] and x['body']['authority']=='source_of_truth_contract' and len(x['body']['item_uuids'])==1 and x['body']['item_uuids'][0] in item_ids]
    owned_ids={old_capture['uuid']}|{x['uuid'] for x in owned_contents}
    if any(x['lifecycle']!='live' for x in records if x['uuid'] in owned_ids):fail('Inactive seed content requires explicit restore','INVALID_TRANSITION')
    removed_ids={old_items[x]['uuid'] for x in removed}
    keep = [x for x in records if x['kind']!='source_item' and x['uuid'] not in owned_ids]
    keep += [x for x in records if x['uuid'] in removed_ids or x['kind']=='content' and x['uuid'] in owned_ids-{old_capture['uuid']} and set(x['body']['item_uuids'])<=removed_ids]
    w = writer(actor)
    pins = lineage(root,source)
    capture = envelope('content',dict(title=old_capture['body']['title'],category_uuid=cats['capture'],format=source['body']['format'],
                       content=source['body']['content'],authority='source_of_truth_contract',state='active',item_uuids=[]),w,pins)
    capture['uuid']=old_capture['uuid'];capture['created_at']=old_capture['created_at'];capture['extensions']=copy.deepcopy(old_capture['extensions'])
    capture['source_refs']=retained_pins(old_capture,pins)
    keep.append(capture)
    for label,key in [('Scope','scope_items'),('ToDo','checklist_items')]:
        for value in args[key]:
            if evidence(root,value['source']) != source:
                fail('Foreign seed item','SOURCE_UNVERIFIED')
            item=envelope('source_item',value,w,pins)
            previous=old_items.get(value['source_alias'])
            if previous:
                item['uuid']=previous['uuid'];item['created_at']=previous['created_at']
                item['extensions']=copy.deepcopy(previous['extensions']);item['source_refs']=retained_pins(previous,pins)
            category=cats['capture' if label=='Scope' else 'checklist']
            old_content=next((x for x in owned_contents if item['uuid'] in x['body']['item_uuids']),None)
            title=old_content['body']['title'] if old_content and old_content['body']['category_uuid']==category else label
            content=envelope('content',dict(title=title,category_uuid=category,
                     format='plain',content=value['text'],authority='source_of_truth_contract',state='active',item_uuids=[item['uuid']]),w,pins)
            if old_content:
                content['uuid']=old_content['uuid'];content['created_at']=old_content['created_at']
                content['extensions']=copy.deepcopy(old_content['extensions']);content['source_refs']=retained_pins(old_content,pins)
            keep += [item,content]
            capture['body']['item_uuids'].append(item['uuid'])
    target=next(x for x in keep if x['kind']=='ticket')
    old_by_id={x['uuid']:copy.deepcopy(x) for x in records}
    for index,item in enumerate(keep):
        if item['kind']=='ticket':continue
        old=old_by_id.get(item['uuid'])
        # Reconstructed live seed envelopes have no new lifecycle event. An
        # unchanged business value keeps the exact old restoration evidence too.
        if old and all(item[key]==old[key] for key in ('kind','body','source_refs','extensions','lifecycle')):
            keep[index]=old
    order={x['uuid']:index for index,x in enumerate(records)}
    keep.sort(key=lambda x:order.get(x['uuid'],len(order)))
    target['body']['seed_ref']=args['seed_ref']
    target['source_refs']=retained_pins(target,pins)
    target['body']['record_refs']=[ref(x) for x in keep if x['kind']!='ticket']
    original=old_by_id[target['uuid']]
    if any(target[key]!=original[key] for key in ('body','source_refs','extensions')):
        target['revision_uuid']=uid();target['last_updated']=now()
    if keep==current(ticket):
        return ticket
    value=container('ticket',ticket['root_uuid'],keep,seq=ticket['commit_seq']+1)
    known={x['revision_uuid'] for x in value['revisions']}
    value['revisions'] += [x for x in ticket['revisions'] if x['revision_uuid'] not in known]
    return value
