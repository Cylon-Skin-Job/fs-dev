"""Expose authored definition, supplied briefing and acknowledged load as distinct evidence.

Three loaded-evidence classes are never conflated: the authored template/definition
(inert data), the actual supplied assignment briefing stored for the child, and the
child's acknowledged loaded evidence with exact hashes/runtime. A prompt whose
provider cannot be established is labeled unknown, never guessed or fabricated.
"""
import copy
from .schema import fail, current
from .store import ref
from . import runtime_binding as binding

READS={'prompt.get'}
OPERATIONS=READS


def _actor(plan,actor_uuid):
    return next((x for x in current(plan) if x['kind']=='actor' and x['uuid']==actor_uuid),None)


def provider(plan,actor_uuid):
    """Provider is only ever read from explicit saved evidence; otherwise unknown."""
    actor=_actor(plan,actor_uuid)
    if not actor:
        return dict(provider='unknown',reason='No bound actor record in captured plan',actor_uuid=actor_uuid)
    body=actor['body'];evidence=None
    try:
        from .store import evidence as _evidence
        item=_evidence_from_plan(plan,body.get('binding_evidence_ref'))
        evidence=(item['body'].get('content') or {}) if item else None
    except Exception:
        evidence=None
    declared=evidence.get('provider') if isinstance(evidence,dict) else None
    if isinstance(declared,str) and declared:
        return dict(provider=declared,reason='Provider established from saved host evidence',actor_uuid=actor_uuid)
    return dict(provider='unknown',reason='Provider not established from saved host evidence; never guessed',
                actor_uuid=actor_uuid,runtime_kind=body.get('runtime_kind'),runtime_id=body.get('runtime_id'))


def _evidence_from_plan(plan,reference):
    if not reference:return None
    return next((x for x in plan['revisions'] if x['uuid']==reference['entry_uuid'] and x['revision_uuid']==reference['revision_uuid']),None)


def identity(plan,actor_uuid):
    actor=_actor(plan,actor_uuid)
    if not actor:
        return dict(actor_uuid=actor_uuid,display_label=None,runtime_kind=None,runtime_id=None,parent_actor_uuid=None,present=False)
    body=actor['body']
    # UUID and underlying runtime are always carried, so identical display labels
    # still preserve genuinely distinct identities.
    return dict(actor_uuid=actor_uuid,display_label=body.get('role'),runtime_kind=body.get('runtime_kind'),
                runtime_id=body.get('runtime_id'),parent_actor_uuid=body.get('parent_actor_uuid'),present=True)


def template_class(items,node):
    definition=next((x for x in items if x['uuid']==node['body']['definition_ref']['entry_uuid']),None)
    return dict(kind='template',evidence='authored_definition',inert=True,executed=False,
                definition_ref=node['body']['definition_ref'],definition=definition,
                disclosure='Authored definition snapshot is inert data and is never executed')


def supplied_class(plan,job):
    supplier=job['writer']['actor_uuid']
    return dict(kind='supplied',evidence='stored_assignment_briefing',assignment_ref=ref(job),briefing=copy.deepcopy(job['body']),
                provider=provider(plan,supplier),identity=identity(plan,supplier),
                disclosure='Actual stored briefing supplied to the child; distinct from the authored definition')


def acknowledged_class(root,plan,tickets,attempt,job):
    start=attempt['body']['start_ref'];loaded=None;loaded_ref=None
    if start:
        try:
            loaded=binding.resolve(root,plan,tickets,start)
            loaded_ref=ref(loaded)
        except Exception:
            loaded=None;loaded_ref=start
    actor_uuid=attempt['body']['actor_uuid']
    return dict(kind='acknowledged',evidence='child_loaded_ack',attempt_ref=ref(attempt),acknowledged=bool(start),
                start_ref=start,loaded_ref=loaded_ref,loaded=loaded,
                provider=provider(plan,actor_uuid),identity=identity(plan,actor_uuid),
                disclosure='Child acknowledged loaded hashes/runtime; separate from claim and never conflated with the supplied briefing')


def compose(root,plan,tickets,items,subject):
    """Return the distinct evidence classes resolvable for one exact subject."""
    result=dict(subject=dict(uuid=subject['uuid'],revision_uuid=subject['revision_uuid'],kind=subject['kind']),
                template=None,supplied=None,acknowledged=None,identities=[],divergence=[])
    jobs=[x for x in items if x['kind']=='assignment']
    attempts=[x for x in items if x['kind']=='attempt']
    by_id={x['uuid']:x for x in items}
    if subject['kind']=='workflow_node':
        result['template']=template_class(items,subject)
        pinned=[j for j in jobs if any(p['entry_uuid']==subject['uuid'] for p in j['body']['source_refs'])]
        result['supplied']=[supplied_class(plan,j) for j in pinned]
        owned={j['uuid'] for j in pinned}
        result['acknowledged']=[acknowledged_class(root,plan,tickets,a,by_id.get(a['body']['assignment_uuid'])) for a in attempts if a['body']['assignment_uuid'] in owned]
    elif subject['kind']=='assignment':
        result['supplied']=supplied_class(plan,subject)
        node=by_id.get(subject['body']['node_uuid'])
        if node and node['kind']=='workflow_node':result['template']=template_class(items,node)
        result['acknowledged']=[acknowledged_class(root,plan,tickets,a,subject) for a in attempts if a['body']['assignment_uuid']==subject['uuid']]
    elif subject['kind']=='attempt':
        job=by_id.get(subject['body']['assignment_uuid'])
        if job:result['supplied']=supplied_class(plan,job)
        node=by_id.get(job['body']['node_uuid']) if job else None
        if node and node['kind']=='workflow_node':result['template']=template_class(items,node)
        result['acknowledged']=acknowledged_class(root,plan,tickets,subject,job)
    else:
        fail('prompt.get requires a workflow node, assignment or attempt in the selected ticket','MISSING_EVIDENCE')
    classes=[]
    classes += [result['supplied']] if isinstance(result['supplied'],dict) else (result['supplied'] or [])
    classes += result['acknowledged'] if isinstance(result['acknowledged'],list) else ([result['acknowledged']] if result['acknowledged'] else [])
    for value in classes:
        if value and value.get('identity') and value['identity']['present']:result['identities'].append(value['identity'])
    unique={x['actor_uuid']:x for x in result['identities']};result['identities']=list(unique.values())
    for left in result['identities']:
        for right in result['identities']:
            if left['actor_uuid']!=right['actor_uuid'] and left['display_label'] is not None and left['display_label']==right['display_label']:
                result['divergence'].append('Same display label '+str(left['display_label'])+' preserves distinct identities '+left['actor_uuid']+' and '+right['actor_uuid'])
    unknown=any((value or {}).get('provider',{}).get('provider')=='unknown' for value in classes)
    result['provider_label']=dict(unknown_provider=unknown,
        template='not_applicable' if result['template'] is None else 'inert_authored_definition',
        disclosure='A prompt whose provider cannot be established is labeled unknown; never guessed or fabricated')
    result['evidence_distinct']=True
    return result


def read(root,request,plan,tickets,actor,assignment):
    from .commands import read_response
    args=request['args'];selected=request['scope'].get('ticket_uuid')
    if selected not in tickets:fail('Exact selected ticket required','MISSING_EVIDENCE')
    snapshot=tickets[selected];pinned=bool(args.get('revision_uuid'))
    pool=snapshot['revisions'] if pinned else current(snapshot)
    matches=[x for x in pool if x['uuid']==args['uuid']]
    if pinned:matches=[x for x in matches if x['revision_uuid']==args['revision_uuid']]
    if not matches:fail('Prompt subject missing from exact selected scope','MISSING_EVIDENCE')
    details=compose(root,plan,tickets,current(snapshot),matches[-1])
    details['selector']='pinned' if pinned else 'current'
    return read_response(request,plan,details)


def projection(root,plan,tickets):
    """Captured per-subject disclosures for the immutable generated view."""
    result={}
    for key,ticket in tickets.items():
        items=current(ticket);rows={}
        for item in items:
            if item['kind'] in ('workflow_node','assignment','attempt'):
                rows[item['uuid']]=compose(root,plan,tickets,items,item)
        result[key]=rows
    return result
