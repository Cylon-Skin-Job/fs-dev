"""Validate parent release and derive continuing versus terminal run completion."""
import copy
from .schema import fail
from .store import ref, digest, envelope
from . import authorization, runtime_binding as binding, reviews, seed


def run_for(items,pins):
    ids={p['entry_uuid'] for p in pins}
    return [x for x in items if x['kind']=='attempt' and x['body']['state']=='returned' and
            (x['uuid'] in ids or any(p['entry_uuid'] in ids for p in x['body']['return_refs']))]


def full_scope(items,attempt):
    byid={x['uuid']:x for x in items};pins=[ref(attempt)]
    for pin in attempt['body']['return_refs']:
        subject=byid.get(pin['entry_uuid']);pins.append({**pin,'scope_item_uuids':subject['body'].get('item_uuids',[]) if subject else pin['scope_item_uuids']})
    return pins


def apply(root,args,actor,assignment,plan,tickets,items,expected):
    local={x['uuid']:x for x in items}
    if not run_for(items,args['subject_refs']) and not any(local.get(p['entry_uuid'],{}).get('kind')=='workflow_node' for p in args['subject_refs']):return False
    authorization.authority(root,plan,tickets,args['authority_ref'],assignment,expected)
    values=reviews.subjects(root,plan,tickets,args['subject_refs'],expected)
    if args['subject_digest']!=digest(args['subject_refs']):fail('Exact acceptance manifest digest differs','SOURCE_UNVERIFIED')
    runs=run_for(items,args['subject_refs'])
    owner_nodes=[x for x in values if x['kind']=='workflow_node' and x['body']['node_kind']=='owner_gate']
    if not runs and not owner_nodes:return False
    if runs:
        jobs=[next(x for x in items if x['uuid']==a['body']['assignment_uuid']) for a in runs]
        if any(x['body']['manager_uuid']!=actor['uuid'] for x in jobs):fail('Only responsible returned job parent may accept','FORBIDDEN')
        allowed={p['entry_uuid'] for a in runs for p in full_scope(items,a)}
        if any(x['uuid'] not in allowed for x in values):fail('Acceptance adds unrelated returned scope','FORBIDDEN')
    elif assignment['body']['manager_uuid']!=actor['uuid']:fail('Responsible owner receipt recorder required','FORBIDDEN')
    if owner_nodes:
        facts=gates_projection(items)
        if any(not facts[x['uuid']]['eligible'] for x in owner_nodes):fail('Owner gate own prerequisites not released','DEPENDENCY_NOT_RELEASED')
    instruction=authorization.dependency(root,plan,tickets,args['original_instruction_ref'],expected);data=instruction['body'].get('content',{})
    required={'kind':'owner_acceptance' if owner_nodes else 'parent_acceptance','subject_refs':args['subject_refs'],
              'subject_digest':args['subject_digest'],'gate_refs':args['gate_refs'],'accepting_actor_uuid':actor['uuid']}
    if instruction['kind']!='content' or instruction['body'].get('state')!='active' or any(data.get(k)!=v for k,v in required.items()):
        fail('Original acceptance evidence must name exact presented scope/gates/parent','MISSING_EVIDENCE')
    if owner_nodes and instruction['body'].get('authority')!='owner_decision':fail('Owner SPEC gate needs actual original owner direction','FORBIDDEN')
    for finding in (x for x in items if x['kind']=='finding' and x['body']['impact']=='material'):
        overlap=any(a['entry_uuid']==b['entry_uuid'] and (not a['scope_item_uuids'] or not b['scope_item_uuids'] or set(a['scope_item_uuids']) & set(b['scope_item_uuids'])) for a in args['subject_refs'] for b in finding['body']['subject_refs'])
        if not overlap:continue
        if finding['body']['state']!='validated' or not finding['body']['repair_ref']:fail('Material finding needs a validated current accepted repair','MISSING_EVIDENCE')
        repair=authorization.dependency(root,plan,tickets,finding['body']['repair_ref'],expected)
        repaired=run_for(items,[ref(repair)])
        if not repaired or not all(released(items,x) for x in repaired):fail('Validated finding repair is no longer current accepted scope','MISSING_EVIDENCE')
    gates=[];reviewers=[]
    for pin in args['gate_refs']:
        gate=authorization.dependency(root,plan,tickets,pin,expected);job=reviews.current_gate(root,plan,tickets,items,gate,expected);b=gate['body']
        if b['subject_refs']!=args['subject_refs'] or b['subject_digest']!=args['subject_digest']:fail('Required gate does not cover exact accepted scope','MISSING_EVIDENCE')
        if job['body']['manager_uuid']!=actor['uuid'] or b['reviewer_actor_uuid']==actor['uuid']:fail('Independent gate belongs to another responsible parent','FORBIDDEN')
        gates.append(gate);reviewers.append(binding.actor_for(plan,b['reviewer_actor_uuid']))
    modes={x['body']['mode'] for x in gates}
    if not {'builder','orchestrator'}.issubset(modes):fail('Distinct current builder and orchestrator gates required','MISSING_EVIDENCE')
    if len({x['body']['reviewer_actor_uuid'] for x in gates})!=len(gates) or len({x['body']['assignment_uuid'] for x in gates})!=len(gates):fail('Distinct fresh gate identities/assignments required','FORBIDDEN')
    # Revalidate on current records: distinct evaluator UUIDs are not independent
    # if the two gates share one underlying runtime. A historical malformed or
    # contaminated gate pair therefore cannot release through this path.
    if not binding.distinct_runtimes(reviewers):fail('Distinct actual runtime identities required for independent gates','FORBIDDEN')
    body=copy.deepcopy(args);body.update(accepting_actor_uuid=actor['uuid'],state='active',invalidation_reason=None)
    items.append(envelope('acceptance',body,seed.writer(actor)));return True


def released(items,attempt):
    pins=full_scope(items,attempt)
    return next((x for x in items if x['kind']=='acceptance' and x['body']['state']=='active' and
        x['body']['subject_refs']==pins and x['body']['subject_digest']==digest(pins)),None)


def projection(items):
    nodes={x['uuid']:x for x in items if x['kind']=='workflow_node'};jobs={x['uuid']:x for x in items if x['kind']=='assignment'};result={}
    for attempt in (x for x in items if x['kind']=='attempt'):
        b=attempt['body'];job=jobs[b['assignment_uuid']];node=nodes[job['body']['node_uuid']];receipt=released(items,attempt) if b['state']=='returned' else None
        siblings=sorted((x for x in nodes.values() if x['body']['parent_uuid']==node['body']['parent_uuid'] and x['body']['node_kind']=='autonomous'),key=lambda x:(x['body']['order'],x['uuid']))
        successors=[x for x in siblings if x['body']['order']>node['body']['order']]
        following=successors[0] if successors else None;started=False
        if receipt and following:
            laterjobs={x['uuid'] for x in jobs.values() if x['body']['node_uuid']==following['uuid'] and ref(receipt) in x['body']['prerequisite_refs']}
            started=any(x['kind']=='attempt' and x['body']['assignment_uuid'] in laterjobs and x['body']['start_ref'] for x in items)
        result[attempt['uuid']]=dict(parent_acceptance_ref=ref(receipt) if receipt else None,full_scope_accepted=bool(receipt),
            terminal=following is None,next_node_uuid=following['uuid'] if following else None,next_acknowledged_start=started,
            icon='check_circle' if receipt and (following is None or started) else 'output_circle' if b['state']=='returned' else 'progress_activity')
    return result


def gates_projection(items):
    result={}
    nodes=[x for x in items if x['kind']=='workflow_node']
    for node in nodes:
        if node['body']['node_kind']!='owner_gate':continue
        peers=[x for x in nodes if x['body']['parent_uuid']==node['body']['parent_uuid'] and x['body']['order']<node['body']['order'] and x['body']['node_kind']=='autonomous']
        previous=max(peers,key=lambda x:x['body']['order']) if peers else None
        jobs={x['uuid'] for x in items if x['kind']=='assignment' and previous and x['body']['node_uuid']==previous['uuid'] and x['body']['work_kind']!='evaluation'}
        completed=[x for x in items if x['kind']=='attempt' and x['body']['assignment_uuid'] in jobs and x['body']['state']=='returned' and released(items,x)]
        accepted=next((x for x in items if x['kind']=='acceptance' and x['body']['state']=='active' and ref(node) in x['body']['subject_refs']),None)
        result[node['uuid']]=dict(eligible=bool(completed),owner_acceptance_ref=ref(accepted) if accepted else None,
            icon='check_circle' if accepted else 'back_hand' if completed else 'autostop',reason='Owner acceptance remains separate from child parent acceptance' if completed and not accepted else 'Own prerequisites pending' if not completed else 'Exact owner acceptance recorded')
    return result


def prior_release(root,plan,tickets,items,job,expected,publishing=False):
    """A normal following slice needs the exact preceding full accepted return."""
    if job['body']['work_kind']!='slice':return
    obligations={x['uuid'] for x in items if x['kind']=='content' and isinstance(x['body'].get('content'),dict) and x['body']['content'].get('causal_finding_ref')}
    if any(p['entry_uuid'] in obligations for p in job['body']['source_refs']):return
    nodes={x['uuid']:x for x in items if x['kind']=='workflow_node'};node=nodes[job['body']['node_uuid']]
    preceding=[x for x in items if x['kind']=='assignment' and x['body']['work_kind']=='slice' and x['uuid']!=job['uuid'] and nodes[x['body']['node_uuid']]['body']['parent_uuid']==node['body']['parent_uuid'] and nodes[x['body']['node_uuid']]['body']['order']<node['body']['order']]
    if not preceding:return
    prior=max(preceding,key=lambda x:nodes[x['body']['node_uuid']]['body']['order'])
    runs=[x for x in items if x['kind']=='attempt' and x['body']['assignment_uuid']==prior['uuid'] and x['body']['state']!='abandoned']
    if publishing and not any(x['body']['state']=='returned' for x in runs):return
    if len(runs)!=1 or runs[0]['body']['state']!='returned':fail('Preceding slice has not returned','DEPENDENCY_NOT_RELEASED')
    receipt=released(items,runs[0])
    if not receipt or ref(receipt) not in job['body']['prerequisite_refs']:fail('Exact full preceding parent acceptance required before next start','DEPENDENCY_NOT_RELEASED')
    authorization.dependency(root,plan,tickets,ref(receipt),expected)
