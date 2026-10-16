"""Retain causal repair obligations and scoped gate invalidation history."""
import copy
from .schema import fail
from .store import ref, digest, envelope, uid, now
from . import authorization, assignments, seed

OPERATIONS={'workflow.rework_add'}


def invalidate(items,subjects,expected,actor):
    affected=[x for x in items if (x['kind']=='acceptance' and x['body']['state']=='active' or x['kind']=='review' and x['body']['verdict']=='pass') and any(p['entry_uuid'] in subjects for p in x['body']['subject_refs'])]
    for item in affected:
        if expected.get(item['uuid'])!=item['revision_uuid']:fail('Exact affected gate/acceptance expectation required','REVISION_CONFLICT')
    for item in affected:
        item.update(revision_uuid=uid(),last_updated=now(),writer=seed.writer(actor))
        if item['kind']=='acceptance':item['body'].update(state='invalidated',invalidation_reason='Subject revision changed')
        else:item['body']['verdict']='incomplete'
    return bool(affected)


def finding(root,op,args,actor,plan,tickets,items,expected,job,pins):
    body=args['body']
    if op=='review.finding_add' and body['subject_refs']!=args['subject_refs']:fail('Finding must preserve exact evaluation scope','SOURCE_UNVERIFIED')
    for pin in [body['rule_source_ref']]+body['evidence_refs']:authorization.dependency(root,plan,tickets,pin,expected)
    if not body['description'] or not body['evidence_refs']:fail('Finding requires observable evidence','MISSING_EVIDENCE')
    if op=='review.finding_add':
        if body['state']!='open' or body['repair_ref'] is not None:fail('New finding starts open without invented repair','INVALID_TRANSITION')
        item=envelope('finding',copy.deepcopy(body),seed.writer(actor));items.append(item);return item
    if len(args['finding_refs'])!=1:fail('Exact original causal finding required','MISSING_EVIDENCE')
    old=authorization.dependency(root,plan,tickets,args['finding_refs'][0],expected)
    if old['kind']!='finding' or old not in items or any(body[k]!=old['body'][k] for k in ('subject_refs','rule_source_ref','evidence_refs','impact','confidence','description')):
        fail('Disposition cannot rewrite original finding facts','FORBIDDEN')
    if body['state']=='validated':
        if not body['repair_ref']:fail('Validated repair must retain exact repair scope','MISSING_EVIDENCE')
        repair=authorization.dependency(root,plan,tickets,body['repair_ref'],expected)
        from .acceptance import run_for,released
        runs=run_for(items,[ref(repair)])
        obligations=[x for x in items if x['kind']=='content' and isinstance(x['body'].get('content'),dict) and x['body']['content'].get('causal_finding_ref')==ref(old)]
        if not obligations or not any(x['kind']=='assignment' and ref(obligation) in x['body']['source_refs'] and x['uuid']==run['body']['assignment_uuid'] for obligation in obligations for run in runs for x in items):fail('Repair run must pin original causal obligation','MISSING_EVIDENCE')
        if not runs or not all(released(items,x) for x in runs):fail('Repair needs its own full current builder/orchestrator acceptance','MISSING_EVIDENCE')
    from .edits import changed
    item=changed(old,body,old['source_refs'],old['extensions'],actor);items[items.index(old)]=item;return item


def apply(root,args,actor,assignment,plan,tickets,items,expected):
    authorization.authority(root,plan,tickets,args['authority_ref'],assignment,expected)
    instruction=authorization.dependency(root,plan,tickets,args['original_instruction_ref'],expected)
    from .runtime_binding import resolve
    values=[resolve(root,plan,tickets,{**p,'scope_item_uuids':[]}) for p in args['subject_refs']]
    if not values or len({x['uuid'] for x in values})!=len(values):fail('Exact unique retained repair subjects required','MISSING_EVIDENCE')
    for value in values:
        current_value=next((x for x in items if x['uuid']==value['uuid']),None)
        if not current_value or expected.get(value['uuid'])!=current_value['revision_uuid']:fail('Repair must expect current subject while preserving original pin','REVISION_CONFLICT')
    if args['subject_digest']!=digest(args['subject_refs']):fail('Repair subject digest differs','SOURCE_UNVERIFIED')
    cause=authorization.dependency(root,plan,tickets,args['causal_finding_ref'],expected)
    if cause not in items or cause['kind']!='finding' or cause['body']['state'] not in ('open','propagated_pending_review','blocked') or cause['body']['subject_refs']!=args['subject_refs']:
        fail('Exact open causal finding scope required','MISSING_EVIDENCE')
    if not any(x['kind']=='assignment' and x['body']['manager_uuid']==actor['uuid'] and any(p in x['body']['source_refs'] for p in args['subject_refs']) for x in items):fail('Responsible scope parent required','FORBIDDEN')
    causal_gates=[authorization.dependency(root,plan,tickets,pin,expected) for pin in args['gate_refs']]
    if not causal_gates or not any(x['kind']=='review' and x['body']['verdict'] in ('findings','failed') and ref(cause) in x['body']['finding_refs'] and x['body']['subject_refs']==args['subject_refs'] for x in causal_gates):fail('Repair must retain its actual causal independent finding gate','MISSING_EVIDENCE')
    data=instruction['body'].get('content',{})
    if data.get('kind')!='repair_obligation' or data.get('subject_refs')!=args['subject_refs'] or data.get('causal_finding_ref')!=args['causal_finding_ref'] or data.get('repair_scope')!=args['repair_scope']:
        fail('Original repair direction must name causal scope','MISSING_EVIDENCE')
    obligation=envelope('content',dict(title='Repair obligation',category_uuid=next(x['uuid'] for x in items if x['kind']=='category'),format='json',
        content=copy.deepcopy(args),authority='implementation_choice',state='pending',item_uuids=[]),seed.writer(actor));items.append(obligation)
    for value in values:
        edge=envelope('edge',dict(edge_kind='repair_of',from_uuid=obligation['uuid'],to_uuid=value['uuid'],from_revision_uuid=obligation['revision_uuid'],to_revision_uuid=value['revision_uuid'],scope_item_uuids=value['body'].get('item_uuids',[]),authority_ref=args['authority_ref']),seed.writer(actor));items.append(edge)
    ev=assignments.event('workflow.rework_add',obligation,actor,plan,[args['causal_finding_ref'],args['original_instruction_ref']]+args['gate_refs']);items.append(ev);return obligation
