"""Publish immutable exact-scope results from independently claimed evaluations."""
import copy
from pathlib import Path
from .schema import fail
from .store import ref, digest, envelope, file_hash
from . import authorization, runtime_binding as binding, assignments, seed

OPERATIONS={'review.attempt_add','review.result_record','review.recheck_record',
            'review.finding_add','review.finding_disposition'}
MODES={'builder','orchestrator','owner-spec','planning-worker','planning-stage','planning-release'}


def subjects(root,plan,tickets,pins,expected):
    if not pins or len({x['entry_uuid'] for x in pins})!=len(pins):fail('Nonempty unique exact subject scope required','MISSING_EVIDENCE')
    result=[]
    for pin in pins:
        item=authorization.dependency(root,plan,tickets,{**pin,'scope_item_uuids':[]},expected)
        scope=pin['scope_item_uuids']
        if len(scope)!=len(set(scope)) or set(scope)-set(item['body'].get('item_uuids',[])):
            fail('Subject scope must name actual unique items','INVALID_SCHEMA')
        result.append(item)
    return result


def evaluation(root,args,actor,assignment,plan,tickets,items,expected):
    job=next((x for x in items if x['kind']=='assignment' and x['uuid']==args['evaluation_assignment_uuid']),None)
    if not job or ref(job)!=ref(assignment) or job['body']['work_kind']!='evaluation' or args['reviewer_actor_uuid']!=actor['uuid']:
        fail('Evaluator must own its exact evaluation assignment','FORBIDDEN')
    authorization.dependency(root,plan,tickets,ref(job),expected)
    binding.claimant(root,plan,job,actor,actor['body']['binding_evidence_ref'])
    attempts=[x for x in items if x['kind']=='attempt' and x['body']['assignment_uuid']==job['uuid'] and x['body']['actor_uuid']==actor['uuid'] and x['body']['state']=='running' and x['body']['start_ref']]
    if len(attempts)!=1:fail('Evaluator own acknowledged running attempt required','MISSING_EVIDENCE')
    attempt=attempts[0];authorization.dependency(root,plan,tickets,ref(attempt),expected)
    values=subjects(root,plan,tickets,args['subject_refs'],expected)
    if args['subject_digest']!=digest(args['subject_refs']):fail('Exact ordered subject manifest digest differs','SOURCE_UNVERIFIED')
    if any({**pin,'scope_item_uuids':[]} not in job['body']['source_refs'] for pin in args['subject_refs']):
        fail('Evaluation job did not pin supplied subjects','SOURCE_UNVERIFIED')
    producers={x['writer']['actor_uuid'] for x in values}
    producers.update(x['body']['actor_uuid'] for x in values if x['kind']=='attempt')
    prior_reviews=[x for t in tickets.values() for x in t['revisions'] if x['kind']=='review']
    prior_reviews += [x for x in items if x['kind']=='review']
    excluded=producers|{job['body']['manager_uuid']}|{x['body']['reviewer_actor_uuid'] for x in prior_reviews}
    # A canonical UUID identifies a record, not a runtime. The original freshness
    # contract is about the actual runtime behind the actor, so the producer,
    # the evaluation manager and every prior evaluator/reviewer are compared by
    # underlying runtime identity, not only by UUID.
    if actor['uuid'] in excluded or any(binding.same_runtime(x,actor) for x in binding.registered_actors(plan,excluded)):
        fail('Producer/manager/prior-reviewer runtime cannot provide a fresh independent evaluation','FORBIDDEN')
    return job,attempt,values


def report(root,args,actor,job,attempt,plan,tickets,expected):
    item=authorization.dependency(root,plan,tickets,args['report_ref'],expected);data=item['body'].get('content',{})
    if item['kind']!='content' or item['body'].get('state')!='active' or not isinstance(data,dict) or item['writer']['actor_uuid']!=actor['uuid']:fail('Frozen structured evaluation report required','MISSING_EVIDENCE')
    exact={'evaluation_assignment_ref':ref(job),'evaluation_attempt_ref':ref(attempt),'reviewer_actor_uuid':actor['uuid'],
           'subject_refs':args['subject_refs'],'subject_digest':args['subject_digest'],'independent':True}
    if any(data.get(k)!=v for k,v in exact.items()):fail('Frozen report differs from exact evaluation/source identity','SOURCE_UNVERIFIED')
    mode=data.get('mode')
    if mode not in MODES or 'gate:'+mode not in job['body']['return_criteria']:fail('Gate mode not authorized by stored evaluation job','FORBIDDEN')
    path=Path(job['body']['report_path'])
    if path.is_symlink() or not path.is_file() or data.get('report_path')!=str(path) or data.get('report_file_sha256')!=file_hash(path):
        fail('Assigned frozen evaluation report save/hash missing','MISSING_EVIDENCE')
    pins=data.get('evidence_refs',[])
    if not pins:fail('Evaluation report needs retained raw evidence','MISSING_EVIDENCE')
    for pin in pins:authorization.dependency(root,plan,tickets,pin,expected)
    return mode,pins,data


def apply(root,op,args,actor,assignment,plan,tickets,items,expected):
    job,attempt,values=evaluation(root,args,actor,assignment,plan,tickets,items,expected)
    starts=[x for x in items if x['kind']=='event' and x['body']['event_kind']=='review.attempt_add' and x['body']['subject_ref']['entry_uuid']==attempt['uuid']]
    if op=='review.attempt_add':
        if starts:fail('Evaluation scope already frozen','INVALID_TRANSITION')
        ev=assignments.event(op,attempt,actor,plan,[ref(job)]+copy.deepcopy(args['subject_refs']));items.append(ev);return ev
    if len(starts)!=1 or starts[0]['body']['evidence_refs']!=[ref(job)]+args['subject_refs']:
        fail('Result must match own previously frozen review scope','MISSING_EVIDENCE')
    mode,pins,data=report(root,args,actor,job,attempt,plan,tickets,expected)
    if op in ('review.finding_add','review.finding_disposition'):
        from . import rework
        return rework.finding(root,op,args,actor,plan,tickets,items,expected,job,pins)
    if op=='review.recheck_record':
        runs=[x for x in values if x['kind']=='attempt' and x['body']['state']=='returned']
        obligations={x['uuid'] for x in items if x['kind']=='content' and isinstance(x['body'].get('content'),dict) and x['body']['content'].get('causal_finding_ref')}
        jobs={x['uuid']:x for x in items if x['kind']=='assignment'}
        if not runs or not all(any(p['entry_uuid'] in obligations for p in jobs[x['body']['assignment_uuid']]['body']['source_refs']) for x in runs):fail('Recheck requires a returned repair pinned to its causal obligation','MISSING_EVIDENCE')
    if data.get('verdict')!=args['verdict'] or data.get('finding_refs')!=args['finding_refs']:
        fail('Verdict/findings differ from frozen report','SOURCE_UNVERIFIED')
    for pin in args['finding_refs']:
        finding=authorization.dependency(root,plan,tickets,pin,expected)
        if finding['kind']!='finding' or finding not in items or finding['writer']['actor_uuid']!=actor['uuid'] or finding['body']['subject_refs']!=args['subject_refs']:fail('Own typed exact-scope causal finding required','MISSING_EVIDENCE')
    if args['verdict']=='pass' and args['finding_refs']:fail('Passing gate cannot retain unresolved findings','INVALID_TRANSITION')
    body={k:copy.deepcopy(args[k]) for k in ('subject_refs','subject_digest','reviewer_actor_uuid','verdict','finding_refs','report_ref')}
    body.update(assignment_uuid=job['uuid'],attempt_uuid=attempt['uuid'],mode=mode,evidence_refs=copy.deepcopy(pins))
    item=envelope('review',body,seed.writer(actor));items.append(item)
    ev=assignments.event(op,item,actor,plan,[ref(starts[0]),args['report_ref']]);items.append(ev);return item


def current_gate(root,plan,tickets,items,gate,expected=None):
    b=gate['body']
    if gate['kind']!='review' or b['verdict']!='pass' or b['finding_refs']:fail('Current passing independent review required','MISSING_EVIDENCE')
    if expected is not None:authorization.dependency(root,plan,tickets,ref(gate),expected)
    # Legacy scoped content/support gates retain their original owners. Canonical
    # A11 gates have a published evaluation job and actual attempt in this ticket.
    job=next((x for x in items if x['kind']=='assignment' and x['uuid']==b['assignment_uuid']),None)
    if not job:fail('Canonical exact evaluation job required','MISSING_EVIDENCE')
    attempt=next((x for x in items if x['kind']=='attempt' and x['uuid']==b['attempt_uuid']),None)
    if not attempt or attempt['body']['state']!='returned' or b['report_ref'] not in attempt['body']['return_refs']:
        fail('Evaluation own frozen return required before parent acceptance','MISSING_EVIDENCE')
    if attempt['body']['assignment_uuid']!=job['uuid'] or attempt['body']['actor_uuid']!=b['reviewer_actor_uuid']:
        fail('Gate evaluation identity differs','FORBIDDEN')
    if b['subject_digest']!=digest(b['subject_refs']):fail('Gate manifest digest differs','SOURCE_UNVERIFIED')
    binding.procedure(job)
    actor=binding.actor_for(plan,b['reviewer_actor_uuid']);binding.claimant(root,plan,job,actor,actor['body']['binding_evidence_ref'])
    report=binding.resolve(root,plan,tickets,b['report_ref'])['body'].get('content',{})
    path=Path(job['body']['report_path'])
    if not path.is_file() or path.is_symlink() or report.get('report_file_sha256')!=file_hash(path):fail('Frozen evaluator report file changed or is unavailable','MISSING_EVIDENCE')
    for pin in b['subject_refs']+[b['report_ref']]+b['evidence_refs']:
        binding.resolve(root,plan,tickets,{**pin,'scope_item_uuids':[]})
    return job


def validate_final(root,plan,tickets,items,captured,expected):
    byid={x['uuid']:x for x in items};old={x['uuid']:x for x in captured}
    for gate in items:
        if gate['kind']!='review' or gate['body']['verdict']!='pass':continue
        for pin in gate['body']['subject_refs']:
            subject=byid.get(pin['entry_uuid'])
            if subject and ref(subject)!={**pin,'scope_item_uuids':[]}:
                fail('Passing review would reference changed prospective subject','REVISION_CONFLICT')
        if gate!=old.get(gate['uuid']):
            for pin in gate['body']['evidence_refs']+[gate['body']['report_ref']]:
                subject=byid.get(pin['entry_uuid'])
                if subject and ref(subject)!=pin:fail('New gate evidence changed in same transaction','REVISION_CONFLICT')
