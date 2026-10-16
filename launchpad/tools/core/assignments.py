"""Publish manager-owned immutable jobs and claim exact autonomous slots."""
import copy
from pathlib import Path
from .schema import fail, current
from .store import envelope, ref
from . import authorization, runtime_binding as binding, seed

OPERATIONS={'assignment.publish','assignment.bind','assignment.claim','assignment.release','assignment.handoff'}
ACTIVE={'claimed','running','paused','blocked'}


def required(root,plan,tickets,pins,expected):
    for pin in pins:
        item=authorization.dependency(root,plan,tickets,pin,expected);body=item['body']
        if item['kind']=='acceptance' and body['state']!='active' or item['kind']=='review' and (body['verdict']!='pass' or body['finding_refs']) or item['kind']=='content' and body['state']!='active':
            fail('Required prerequisite is not released','DEPENDENCY_NOT_RELEASED')
        if item['kind']=='acceptance':
            from . import acceptance
            local=[x for t in tickets.values() for x in current(t)]
            linked=acceptance.run_for(local,body['subject_refs'])
            if linked and not all(acceptance.released(local,x)==item for x in linked):fail('Partial acceptance does not release full next work','DEPENDENCY_NOT_RELEASED')
        if item['kind'] not in ('acceptance','review','content','integration'):
            fail('Prerequisite is not a release receipt','DEPENDENCY_NOT_RELEASED')


def manager(root,plan,tickets,job,actor,assignment,expected):
    if job['body']['manager_uuid']!=actor['uuid']:fail('Responsible job manager required','FORBIDDEN')
    authorization.authority(root,plan,tickets,job['body']['authority_ref'],assignment,expected)


def slot(job):
    return job['body']['ticket_uuid'],job['body']['node_uuid'],job['body']['work_kind']


def job_for(root,plan,tickets,items,pin,expected):
    item=authorization.dependency(root,plan,tickets,pin,expected)
    if item['kind']!='assignment' or item not in items:fail('Exact published job in selected ticket required','FORBIDDEN')
    binding.procedure(item)
    return item


def publish(root,args,actor,assignment,plan,tickets,items,expected,selected):
    body=args['body'];authorization.authority(root,plan,tickets,args['authority_ref'],assignment,expected)
    if body['authority_ref']!=args['authority_ref'] or body['manager_uuid']!=actor['uuid'] or body['ticket_uuid']!=selected:
        fail('Job manager/authority/ticket differs from authorized selected scope','FORBIDDEN')
    if assignment['body']['ticket_uuid'] in tickets and body['ticket_uuid']!=assignment['body']['ticket_uuid']:
        fail('Job exceeds manager ticket scope','FORBIDDEN')
    node=next((x for x in items if x['uuid']==body['node_uuid'] and x['kind']=='workflow_node'),None)
    if not node or node['body']['node_kind']!='autonomous' or body['node_uuid']==selected:
        fail('Autonomous node slot required; never claim a ticket','INVALID_TRANSITION')
    if any(pin not in body['prerequisite_refs'] for pin in node['body']['prerequisite_refs']):fail('Job cannot omit node prerequisites','DEPENDENCY_NOT_RELEASED')
    if any(pin not in body['source_refs'] for pin in (ref(node),node['body']['definition_ref'])):fail('Job must pin exact node and its stored definition','MISSING_EVIDENCE')
    if expected.get(node['uuid'])!=node['revision_uuid']:fail('Exact job node expectation required','REVISION_CONFLICT')
    paths=body['write_paths']+[body['report_path']]
    if not paths or any(not Path(p).is_absolute() or not any(Path(p).resolve().is_relative_to(Path(base).resolve()) for base in assignment['body']['write_paths']) for p in paths):
        fail('Job write/report paths exceed manager roots','FORBIDDEN')
    if not Path(body['source_checkout']).is_absolute() or not Path(body['source_checkout']).resolve().is_relative_to(Path(assignment['body']['source_checkout']).resolve()):
        fail('Job source checkout exceeds manager scope','FORBIDDEN')
    item=envelope('assignment',copy.deepcopy(body),seed.writer(actor));binding.procedure(item)
    for pin in body['source_refs']:authorization.dependency(root,plan,tickets,pin,expected)
    required(root,plan,tickets,body['prerequisite_refs'],expected)
    from . import acceptance
    acceptance.prior_release(root,plan,tickets,items,item,expected,publishing=True)
    if any(x['kind']=='assignment' and slot(x)==slot(item) for x in items):
        fail('Slot already has an immutable job; replace its attempt explicitly','CLAIM_CONFLICT')
    items.append(item)
    return item


def event(op,subject,actor,plan,pins,caused=None):
    return envelope('event',dict(event_kind=op,subject_ref=ref(subject),commit_seq=plan['commit_seq']+1,
        event_ordinal=0,caused_by_ref=caused,reply_to_ref=None,evidence_refs=pins),seed.writer(actor))


def claim(root,args,actor,assignment,plan,tickets,items,expected,job=None,predecessor=None,manager_claim=False):
    job=job or job_for(root,plan,tickets,items,args['assignment_ref'],expected)
    if args['actor_uuid']!=actor['uuid']:fail('Claimant cannot borrow another actor','FORBIDDEN')
    if ref(job)!=ref(assignment) and not manager_claim:fail('Claim requires the actor exact assigned job','FORBIDDEN')
    binding.actor_for(plan,actor['uuid']);binding.claimant(root,plan,job,actor,args['binding_evidence_ref'])
    if args['prerequisite_refs']!=job['body']['prerequisite_refs']:fail('Claim prerequisite set differs from stored briefing','DEPENDENCY_NOT_RELEASED')
    required(root,plan,tickets,args['prerequisite_refs'],expected)
    for pin in job['body']['source_refs']:authorization.dependency(root,plan,tickets,pin,expected)
    jobs={x['uuid']:x for x in items if x['kind']=='assignment'}
    if any(x['kind']=='attempt' and x['body']['state'] in ACTIVE and slot(jobs[x['body']['assignment_uuid']])==slot(job) for x in items):
        fail('Another live attempt owns this exact slot','CLAIM_CONFLICT')
    dispatches=[x for x in items if x['kind']=='event' and x['body']['event_kind']=='run.dispatch_record' and x['body']['subject_ref']==ref(job)]
    dispatched=False
    for evt in dispatches:
        for pin in evt['body']['evidence_refs']:
            proof=binding.resolve(root,plan,tickets,pin)['body'].get('content',{})
            if proof.get('actor_uuid')==actor['uuid'] and proof.get('result')=='dispatched':dispatched=True
    if not dispatched:fail('Exact successful actual dispatch receipt missing','MISSING_EVIDENCE')
    pins=[ref(job),args['binding_evidence_ref']]+args['prerequisite_refs']
    if predecessor:pins += [ref(predecessor),args['inactive_or_interrupt_ack_ref']]
    ev=event('assignment.claim',job,actor,plan,pins);items.append(ev)
    attempt=envelope('attempt',dict(assignment_uuid=job['uuid'],actor_uuid=actor['uuid'],predecessor_attempt_uuid=predecessor['uuid'] if predecessor else None,
        claim_ref=ref(ev),start_ref=None,state='claimed',summary='Claimed exact stored job; start not acknowledged',last_progress_at=None,last_checkpoint_at=None,return_refs=[]),seed.writer(actor))
    items.append(attempt)
    return attempt


def apply(root,op,args,actor,assignment,plan,tickets,items,expected,selected):
    if op=='assignment.publish':return publish(root,args,actor,assignment,plan,tickets,items,expected,selected)
    job=job_for(root,plan,tickets,items,args['assignment_ref'],expected)
    if op=='assignment.claim':
        predecessor=None
        if bool(args.get('predecessor_attempt_ref'))!=bool(args.get('inactive_or_interrupt_ack_ref')):
            fail('Replacement needs predecessor and stop proof together','MISSING_EVIDENCE')
        if args.get('predecessor_attempt_ref'):
            predecessor=authorization.dependency(root,plan,tickets,args['predecessor_attempt_ref'],expected)
            if predecessor['kind']!='attempt' or predecessor['body']['assignment_uuid']!=job['uuid'] or predecessor['body']['state']!='abandoned':
                fail('Only manager-released predecessor may be replaced','STOP_UNCONFIRMED')
            release=[x for x in items if x['kind']=='event' and x['body']['event_kind'] in ('assignment.release','assignment.handoff') and args['inactive_or_interrupt_ack_ref'] in x['body']['evidence_refs'] and x['body']['subject_ref']['entry_uuid']==predecessor['uuid']]
            if not release:fail('Manager authorized predecessor stop receipt missing','STOP_UNCONFIRMED')
        elif any(x['kind']=='attempt' and x['body']['assignment_uuid']==job['uuid'] for x in items):
            fail('Existing slot history requires explicit linked replacement','CLAIM_CONFLICT')
        return claim(root,args,actor,assignment,plan,tickets,items,expected,job,predecessor)
    manager(root,plan,tickets,job,actor,assignment,expected)
    if op=='assignment.bind':
        target=binding.actor_for(plan,args['actor_uuid']);binding.claimant(root,plan,job,target,args['binding_evidence_ref'])
        ev=event(op,job,actor,plan,[args['binding_evidence_ref'],ref(target)]);items.append(ev);return ev
    if not args.get('predecessor_attempt_ref'):fail('Exact predecessor attempt required','MISSING_EVIDENCE')
    old=authorization.dependency(root,plan,tickets,args['predecessor_attempt_ref'],expected)
    if old not in items or old['kind']!='attempt' or old['body']['assignment_uuid']!=job['uuid'] or old['body']['state'] not in ACTIVE:
        fail('Exact live predecessor required','INVALID_TRANSITION')
    target=binding.actor_for(plan,old['body']['actor_uuid']);binding.inactive_proof(root,plan,tickets,args['inactive_or_interrupt_ack_ref'],expected,job,target,old,actor)
    if op=='assignment.release' and args['actor_uuid']!=target['uuid']:fail('Release actor differs from predecessor','FORBIDDEN')
    ev=event(op,old,actor,plan,[args['inactive_or_interrupt_ack_ref']]);items.append(ev)
    from .edits import changed
    abandoned=changed(old,{**old['body'],'state':'abandoned','summary':'Manager verified inactive predecessor'},old['source_refs'],old['extensions'],actor)
    items[items.index(old)]=abandoned
    if op=='assignment.release':return abandoned
    replacement=binding.actor_for(plan,args['actor_uuid'])
    fresh={**args,'binding_evidence_ref':replacement['body']['binding_evidence_ref'],'prerequisite_refs':job['body']['prerequisite_refs']}
    return claim(root,fresh,replacement,job,plan,tickets,items,expected,job,abandoned,True)
