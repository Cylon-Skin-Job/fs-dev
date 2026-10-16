"""Record manager dispatch facts and attempt-owned acknowledged lifecycle."""
import copy
from pathlib import Path
from .schema import fail, current
from .store import ref, now, digest, file_hash, confined
from . import authorization, runtime_binding as binding, assignments, acceptance

OPERATIONS={'run.dispatch_intent','run.dispatch_record','run.start_record','run.progress_record',
            'run.summary_set','run.checkpoint','run.block','run.pause','run.resume_record',
            'run.return_record','run.handoff_submit'}


def apply(root,op,args,actor,assignment,plan,tickets,items,expected):
    job=next((x for x in items if x['uuid']==args['assignment_uuid'] and x['kind']=='assignment'),None)
    if not job:fail('Exact published job required','MISSING_EVIDENCE')
    authorization.dependency(root,plan,tickets,ref(job),expected);binding.procedure(job)
    if not args['evidence_refs']:fail('Exact saved transition evidence required','MISSING_EVIDENCE')
    for pin in args['evidence_refs']:authorization.dependency(root,plan,tickets,pin,expected)
    if op in ('run.dispatch_intent','run.dispatch_record'):
        assignments.manager(root,plan,tickets,job,actor,assignment,expected)
        if args.get('attempt_uuid') and not any(x['uuid']==args['attempt_uuid'] and x['kind']=='attempt' and x['body']['assignment_uuid']==job['uuid'] for x in items):
            fail('Dispatch attempt does not belong to job','FORBIDDEN')
        if op=='run.dispatch_record':
            if len(args['evidence_refs'])!=1:fail('One exact dispatch result required','MISSING_EVIDENCE')
            data=binding.resolve(root,plan,tickets,args['evidence_refs'][0])['body'].get('content',{})
            target=binding.actor_for(plan,data.get('actor_uuid'));binding.claimant(root,plan,job,target,target['body']['binding_evidence_ref'])
            proof=binding.proof(root,plan,tickets,args['evidence_refs'][0],expected,'dispatch',job,target)
            if proof.get('result') not in ('dispatched','failed') or proof.get('supplied_assignment_sha256')!=digest(job):
                fail('Dispatch result/supplied job digest missing or differs','MISSING_EVIDENCE')
        ev=assignments.event(op,job,actor,plan,args['evidence_refs']);items.append(ev);return ev
    attempt=next((x for x in items if x['uuid']==args['attempt_uuid'] and x['kind']=='attempt'),None)
    if not attempt or attempt['body']['assignment_uuid']!=job['uuid'] or attempt['body']['actor_uuid']!=actor['uuid'] or ref(job)!=ref(assignment):
        fail('Exact attempt-owned actor/job required','FORBIDDEN')
    authorization.dependency(root,plan,tickets,ref(attempt),expected)
    binding.claimant(root,plan,job,actor,actor['body']['binding_evidence_ref'])
    old=attempt['body'];body=copy.deepcopy(old)
    if old['state'] in ('returned','abandoned'):fail('Terminal attempt cannot record more progress','INVALID_TRANSITION')
    if op in ('run.start_record','run.resume_record'):
        states={'claimed'} if op=='run.start_record' else {'paused','blocked'}
        if old['state'] not in states:fail('Acknowledged start/resume transition invalid','INVALID_TRANSITION')
        if op=='run.start_record' and old['start_ref'] is not None:fail('Start already acknowledged','INVALID_TRANSITION')
        if len(args['evidence_refs'])!=1:fail('One exact loaded briefing acknowledgment required','MISSING_EVIDENCE')
        if op=='run.start_record':
            assignments.required(root,plan,tickets,job['body']['prerequisite_refs'],expected)
            for pin in job['body']['source_refs']:authorization.dependency(root,plan,tickets,pin,expected)
            acceptance.prior_release(root,plan,tickets,items,job,expected)
        binding.start_proof(root,plan,tickets,args['evidence_refs'][0],expected,job,actor,attempt)
        body.update(state='running',last_progress_at=now())
    elif op in ('run.progress_record','run.checkpoint','run.summary_set'):
        if old['state']!='running':fail('Progress requires acknowledged running attempt','INVALID_TRANSITION')
        if op=='run.progress_record':body['last_progress_at']=now()
        if op=='run.checkpoint':body['last_checkpoint_at']=now()
    elif op in ('run.block','run.pause'):
        if old['state']!='running':fail('Pause/block requires running attempt','INVALID_TRANSITION')
        body['state']='blocked' if op=='run.block' else 'paused'
        # The release condition is retained in a structured saved fact rather
        # than added to the closed attempt body.
        data=[binding.resolve(root,plan,tickets,pin)['body'].get('content',{}) for pin in args['evidence_refs']]
        if not any(x.get('release_condition')==args['release_condition'] for x in data):
            fail('Saved stop evidence must preserve exact release condition','MISSING_EVIDENCE')
    elif op in ('run.return_record','run.handoff_submit'):
        if old['state']!='running' or old['start_ref'] is None:fail('Return requires actual acknowledged start','INVALID_TRANSITION')
        if not args['deliverable_refs']:fail('Frozen deliverable/report required','MISSING_EVIDENCE')
        for pin in args['deliverable_refs']:authorization.dependency(root,plan,tickets,pin,expected)
        path=Path(job['body']['report_path'])
        if not path.is_absolute() or path.is_symlink() or not path.is_file():fail('Assigned frozen report file is missing','MISSING_EVIDENCE')
        if not any(path.resolve().is_relative_to(Path(base).resolve()) for base in job['body']['write_paths']):fail('Report leaves assigned writer roots','FORBIDDEN')
        proofs=[binding.resolve(root,plan,tickets,pin)['body'].get('content',{}) for pin in args['evidence_refs']]
        if not any(x.get('proof_kind')=='return' and x.get('attempt_ref')==ref(attempt) and x.get('recipient_actor_uuid')==job['body']['manager_uuid'] and x.get('deliverable_refs')==args['deliverable_refs'] and x.get('return_checks')==args['return_checks'] and x.get('report_path')==job['body']['report_path'] and x.get('report_file_sha256')==file_hash(path) for x in proofs):
            fail('Return needs exact frozen report/checks and assigned recipient evidence','MISSING_EVIDENCE')
        body.update(state='returned',return_refs=copy.deepcopy(args['deliverable_refs']),last_progress_at=now())
    body['summary']=args['summary']
    ev=assignments.event(op,attempt,actor,plan,args['evidence_refs']+args.get('deliverable_refs',[]));items.append(ev)
    if op=='run.start_record':body['start_ref']=ref(ev)
    from .edits import changed
    item=changed(attempt,body,attempt['source_refs'],attempt['extensions'],actor)
    items[items.index(attempt)]=item
    return item


def projection(root,plan,tickets,items):
    releases=acceptance.projection(items)
    jobs={x['uuid']:x for x in items if x['kind']=='assignment'};result={}
    for job in jobs.values():
        attempts=[x for x in items if x['kind']=='attempt' and x['body']['assignment_uuid']==job['uuid']]
        dispatches=[x for x in items if x['kind']=='event' and x['body']['event_kind']=='run.dispatch_record' and x['body']['subject_ref']==ref(job)]
        facts=[]
        for ev in dispatches:
            for pin in ev['body']['evidence_refs']:
                data=binding.resolve(root,plan,tickets,pin)['body'].get('content',{})
                facts.append(dict(event_ref=ref(ev),result=data.get('result'),provenance=data.get('provenance'),actor_uuid=data.get('actor_uuid')))
        rows=[]
        for item in attempts:
            b=item['body'];rows.append(dict(attempt_ref=ref(item),actor_uuid=b['actor_uuid'],state=b['state'],claim_ref=b['claim_ref'],start_ref=b['start_ref'],
                acknowledged_start=b['start_ref'] is not None,icon='output_circle' if b['state']=='returned' else 'progress_activity' if b['state'] in assignments.ACTIVE else 'autostop',
                summary=b['summary'],last_progress_at=b['last_progress_at'],last_checkpoint_at=b['last_checkpoint_at'],return_refs=b['return_refs'],predecessor_attempt_uuid=b['predecessor_attempt_uuid'],release=releases[item['uuid']]))
            rows[-1]['icon']=releases[item['uuid']]['icon'] if b['state']=='returned' else rows[-1]['icon']
        result[job['uuid']]=dict(assignment_ref=ref(job),node_uuid=job['body']['node_uuid'],work_kind=job['body']['work_kind'],
            stored_briefing=job['body'],dispatch_facts=facts,attempts=rows,missing_start=not rows or not rows[-1]['acknowledged_start'],
            limitation='Saved local facts validate exact scope; CLI does not attest native identity or prove full native history.')
    return result
