"""Validate report-only support staging and exact reviewed main integration."""
import copy
from .schema import fail, current, validate, schema, ContractError
from .store import envelope, ref, digest, evidence, find_ref
from . import authorization, seed, checkpoints

OPERATIONS={'support.report_submit','support.integrate'}
PATCH_OPERATIONS={'record.update','record.create','issue.create','record.move_category','record.merge','record.supersede','decision.supersede'}


def report(root,args,assignment,plan,tickets,expected):
    item=authorization.dependency(root,plan,tickets,args['report_ref'],expected)
    if item['kind']!='content' or item['body']['format']!='json' or not isinstance(item['body']['content'],dict):fail('Exact saved structured support report required','MISSING_EVIDENCE')
    proof=item['body']['content']
    if set(proof)!={'assignment_uuid','source_base_refs','suggested_operations'} or proof['assignment_uuid']!=args['assignment_uuid'] or proof['source_base_refs']!=args['source_base_refs']:fail('Report source/base/assignment pins differ','REVISION_CONFLICT')
    if not proof['source_base_refs']:fail('Support must name exact source/base revisions','MISSING_EVIDENCE')
    checkpoints.raw_inputs(root,plan,tickets,[args['report_ref']]+args['source_base_refs'],assignment)
    for pin in args['source_base_refs']:authorization.dependency(root,plan,tickets,pin,expected)
    contract=next(x for x in schema('operations.json')['operations'] if x['operation']=='support.report_submit')
    validate(proof['suggested_operations'],contract['args_schema']['properties']['suggested_operations'])
    for sub in proof['suggested_operations']:
        if sub['operation'] not in PATCH_OPERATIONS:fail('Support suggestions must be bounded content operations','FORBIDDEN')
        definition=next(x for x in schema('operations.json')['operations'] if x['operation']==sub['operation'])
        validate(sub['args'],definition['args_schema'])
    return item,proof


def submit(root,args,actor,assignment,plan,tickets,records,expected):
    if actor['body']['runtime_kind']!='child' or actor['body']['parent_actor_uuid'] is None or args['assignment_uuid']!=assignment['uuid']:
        fail('Exact assigned inline support child required','FORBIDDEN')
    item,proof=report(root,args,assignment,plan,tickets,expected)
    if item['writer']!=seed.writer(actor) or proof['suggested_operations']!=args['suggested_operations']:fail('Actual support writer/payload differs from submitted report','FORBIDDEN')
    existing=[x for x in records if x['kind']=='event' and x['body']['event_kind']=='support.report_submit' and x['body']['subject_ref']==args['report_ref']]
    if existing:fail('Report already submitted; use its original receipt','INVALID_TRANSITION')
    event=envelope('event',dict(event_kind='support.report_submit',subject_ref=args['report_ref'],commit_seq=plan['commit_seq']+1,event_ordinal=sum(x['kind']=='event' and x['body']['commit_seq']==plan['commit_seq']+1 for x in records),caused_by_ref=ref(assignment),reply_to_ref=None,evidence_refs=args['source_base_refs']),seed.writer(actor))
    records.append(event);return event


def integration(root,args,actor,assignment,plan,tickets,records,expected,selected):
    authorization.authority(root,plan,tickets,assignment['body']['authority_ref'],assignment,expected)
    if actor['body']['parent_actor_uuid'] is not None or actor['body']['runtime_kind']=='child':fail('Fronting accepting main required','FORBIDDEN')
    if any(x['kind']=='event' and x['body']['event_kind']=='support.integrate' and x['body']['subject_ref']==args['report_ref'] for x in records):fail('Support report already integrated','INVALID_TRANSITION')
    ready=next((x for x in records if x['kind']=='event' and x['body']['event_kind']=='support.report_submit' and x['body']['subject_ref']==args['report_ref']),None)
    if not ready:fail('Exact report-ready receipt required','MISSING_EVIDENCE')
    if expected.get(ready['uuid'])!=ready['revision_uuid']:fail('Exact staged submission expectation required','REVISION_CONFLICT')
    child=next((x for x in current(plan) if x['uuid']==ready['writer']['actor_uuid'] and x['kind']=='actor'),None)
    if not child or child['body']['parent_actor_uuid']!=actor['uuid'] or child['body']['runtime_kind']!='child':fail('Only responsible actual parent may integrate support','FORBIDDEN')
    worker_assignment=evidence(root,ready['body']['caused_by_ref'])
    if worker_assignment['uuid']!=args['assignment_uuid'] or worker_assignment['body']['ticket_uuid']!=selected or worker_assignment['body']['manager_uuid']!=actor['uuid']:fail('Exact support assignment/ticket/parent required','FORBIDDEN')
    authorization.dependency(root,plan,tickets,ref(worker_assignment),expected)
    item,proof=report(root,args,worker_assignment,plan,tickets,expected)
    if item['writer']!=seed.writer(child) or ready['body']['evidence_refs']!=args['source_base_refs']:fail('Submitted actual report/source pins differ','REVISION_CONFLICT')
    if args['preview_digest']!=digest(proof):fail('Reviewed normalized support preview digest differs','REVISION_CONFLICT')
    gate=authorization.dependency(root,plan,tickets,args['worker_review_ref'],expected);b=gate['body'];subjects=[args['report_ref']]+args['source_base_refs']
    if gate['kind']!='review' or b['mode']!='support-raw-source' or b['verdict']!='pass' or b['finding_refs'] or b['subject_refs']!=subjects or b['subject_digest']!=digest(proof) or b['evidence_refs']!=subjects:fail('Passing exact report/source/base/payload review required','MISSING_EVIDENCE')
    reviewer=next((x for x in current(plan) if x['uuid']==b['reviewer_actor_uuid'] and x['kind']=='actor'),None)
    producers={actor['uuid'],child['uuid']}|{checkpoints.exact(root,plan,tickets,p)['writer']['actor_uuid'] for p in args['source_base_refs']}
    if not reviewer or reviewer['uuid'] in producers or reviewer['body']['role']!='support-reviewer' or reviewer['body']['state']!='active' or reviewer['body']['parent_actor_uuid'] is not None or gate['writer']!=seed.writer(reviewer):fail('Fresh independent actual support reviewer required','FORBIDDEN')
    authorization.host_evidence(root,reviewer['body'])
    assignments=[evidence(root,p) for p in reviewer['body']['assignment_refs']]
    if len(assignments)!=1 or assignments[0]['uuid']!=b['assignment_uuid'] or assignments[0]['body']['work_kind']!='evaluation' or assignments[0]['body']['ticket_uuid']!=selected or assignments[0]['body']['node_uuid']!=item['uuid']:fail('Exact support evaluation assignment required','FORBIDDEN')
    for old in (x for x in records if x['kind']=='event' and x['body']['event_kind']=='support.integrate'):
        prior_gate=checkpoints.exact(root,plan,tickets,old['body']['evidence_refs'][-1])
        if prior_gate['body']['reviewer_actor_uuid']==reviewer['uuid']:fail('Fresh review identity required per support report','FORBIDDEN')
    raw_report=authorization.dependency(root,plan,tickets,b['report_ref'],expected)
    expected_proof=dict(report_ref=args['report_ref'],source_base_refs=args['source_base_refs'],preview_digest=args['preview_digest'],reviewer_actor_uuid=reviewer['uuid'],source_review=True)
    if raw_report['kind']!='content' or raw_report['writer']!=seed.writer(reviewer) or raw_report['body'].get('content')!=expected_proof:fail('Exact independent saved source-review proof required','MISSING_EVIDENCE')
    # Every existing suggested target must appear among the frozen base pins.
    bases={p['entry_uuid'] for p in args['source_base_refs']}
    existing={x['uuid'] for x in current(plan)+[y for t in tickets.values() for y in current(t)]}
    def dependencies(value):
        if isinstance(value,str):return {value} & existing
        if isinstance(value,list):return set().union(*(dependencies(v) for v in value)) if value else set()
        if isinstance(value,dict):return set().union(*(dependencies(v) for v in value.values())) if value else set()
        return set()
    for sub in proof['suggested_operations']:
        if dependencies(sub['args'])-bases:fail('Suggested existing target/dependency lacks exact source/base pin','MISSING_EVIDENCE')
        if sub['operation'] not in actor['body']['granted_operations']:fail('Main lacks suggested operation grant','FORBIDDEN')
    acceptance=envelope('acceptance',dict(subject_refs=[args['report_ref']],subject_digest=digest(proof),accepting_actor_uuid=actor['uuid'],authority_ref=assignment['body']['authority_ref'],gate_refs=[args['worker_review_ref']],original_instruction_ref=assignment['body']['authority_ref'],state='active',invalidation_reason=None),seed.writer(actor))
    records.append(acceptance)
    event=envelope('event',dict(event_kind='support.integrate',subject_ref=args['report_ref'],commit_seq=plan['commit_seq']+1,event_ordinal=sum(x['kind']=='event' and x['body']['commit_seq']==plan['commit_seq']+1 for x in records),caused_by_ref=ref(ready),reply_to_ref=ref(acceptance),evidence_refs=[ref(acceptance),args['worker_review_ref']]),seed.writer(actor));records.append(event)
    # Keep every declared dependency, including the actors and assignments that
    # establish responsibility. The edit owner checks these before expansion,
    # freezes the exact reviewed effects, then checks the final transaction.
    pins=subjects+[ref(ready),ref(worker_assignment),args['worker_review_ref'],b['report_ref'],ref(assignment),assignment['body']['authority_ref']]
    for owner in (actor,child,reviewer):
        pins += [ref(owner),owner['body']['binding_evidence_ref']]+owner['body']['assignment_refs']
    for job in [assignment,worker_assignment]+assignments:
        pins += job['body']['source_refs']+job['body']['prerequisite_refs']+[job['body']['authority_ref']]
    pins=list({digest(pin):pin for pin in pins}.values())
    return proof['suggested_operations'],event,prospective_dependencies(root,records,tickets,pins)


def prospective_dependencies(root,records,tickets,pins,exact=True):
    """Freeze dependency images at a boundary owned by the canonical edit engine."""
    owned={x['uuid']:x for x in records+[y for t in tickets.values() for y in current(t)]}
    images=[]
    for pin in pins:
        item=owned.get(pin['entry_uuid'])
        local=item is not None
        if item is None:item=evidence(root,pin)
        if exact and (ref(item)!={**pin,'scope_item_uuids':[]} or item['lifecycle']!='live'):
            fail('Support dependency changed before reviewed effects','REVISION_CONFLICT')
        images.append(dict(record=copy.deepcopy(item),owned=local))
    return images


def validate_final(root,records,tickets,images):
    """Require the final state to preserve the exact authorized reviewed effects."""
    final=prospective_dependencies(root,records,tickets,[ref(x['record']) for x in images],exact=False)
    if final!=images:fail('Final support source/base/review/assignment or reviewed effect changed','REVISION_CONFLICT')


def projection(root,plan,tickets,main):
    """Expose attributable ready/accepted/integrated facts without child liveness."""
    logs=[];actors={x['uuid']:x for x in current(plan) if x['kind']=='actor'}
    for item in current(plan):
        if item['kind']!='event' or item['body']['event_kind'] not in OPERATIONS:continue
        child=actors.get(item['writer']['actor_uuid'])
        if item['body']['event_kind']=='support.report_submit' and (not child or child['body']['parent_actor_uuid']!=main):continue
        if item['body']['event_kind']=='support.integrate' and item['writer']['actor_uuid']!=main:continue
        try:report=checkpoints.exact(root,plan,tickets,item['body']['subject_ref']);gap=None
        except ContractError:report=None;gap='Exact saved support report unavailable in captured view'
        accepted=find_ref(plan,tickets,item['body']['reply_to_ref']) if item['body']['reply_to_ref'] else None
        logs.append(dict(event=item,report=report,accepted_report=accepted,gap=gap,lifetime='Saved return/report fact only; actual continuing process lifetime is unknown'))
    return logs
