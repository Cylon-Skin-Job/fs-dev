"""Freeze selected journals and close only exact independently reviewed readbacks."""
from pathlib import Path
from .schema import fail, current, ContractError
from .store import envelope, ref, digest, find_ref, evidence, file_hash, read_generation, resolve_plan
from . import authorization, discussions, seed

OPERATIONS={'checkpoint.prepare','checkpoint.apply','checkpoint.close'}
NATIVE_GAP='Native history unavailable; saved journal summaries only'
PATCH_KINDS={'content','category','reference','source_item','edge','acceptance','presented_batch'}


def exact(root,plan,tickets,pin):
    if any(x['uuid']==pin['entry_uuid'] for x in plan['revisions']+[y for t in tickets.values() for y in t['revisions']]):
        return find_ref(plan,tickets,pin)
    try:return evidence(root,pin)
    except ContractError as error:
        if error.code=='UNSUPPORTED_STORE':fail('Declared raw input unavailable','MISSING_EVIDENCE')
        raise


def raw_inputs(root,plan,tickets,pins,assignment):
    values=[]
    for pin in pins:
        item=exact(root,plan,tickets,pin)
        if pin['scope_item_uuids']:fail('Checkpoint inputs pin complete original records','INVALID_TRANSITION')
        for source in item['source_refs']:
            path=Path(source['locator'])
            bases=[Path(assignment['body']['source_checkout']),Path(root)/'.evidence']
            if not path.is_absolute() or path.is_symlink() or not path.is_file() or not any(path.resolve().is_relative_to(b.resolve()) for b in bases):
                fail('Declared raw source unavailable or outside assigned source root','MISSING_EVIDENCE')
            if file_hash(path)!=source['sha256']:fail('Declared raw source bytes changed','REVISION_CONFLICT')
        values.append(item)
    return values


def predecessor(plan,items,discussion):
    phases={x['uuid']:x for x in items if x['kind']=='discussion'}
    candidates=[]
    for x in items:
        if x['kind']!='checkpoint' or x['body']['state']!='closed':continue
        d=phases.get(x['body']['discussion_uuid'])
        if not d or d['body']['ticket_uuid']!=discussion['body']['ticket_uuid'] or d['body']['phase_node_uuid']!=discussion['body']['phase_node_uuid']:continue
        if d['body']['accepted_checkpoint_ref']!=ref(x):continue
        receipts=[i for i,r in enumerate(current(plan)) if r['kind']=='receipt' and ref(x) in r['body']['changed_refs']]
        candidates.append((max(receipts,default=len(current(plan))),items.index(x),x))
    return max(candidates,key=lambda x:x[:2])[2] if candidates else None


def continuity(root,plan,tickets,items,discussion,pin,expected):
    latest=predecessor(plan,items,discussion)
    if pin is not None:
        prior=exact(root,plan,tickets,pin)
        owner=next((x for t in tickets.values() for x in current(t) if x['uuid']==prior['body'].get('discussion_uuid')),None)
        if prior['kind']!='checkpoint' or prior['body']['state']!='closed' or not owner or owner['body']['ticket_uuid']!=discussion['body']['ticket_uuid'] or owner['body']['phase_node_uuid']!=discussion['body']['phase_node_uuid'] or owner['body']['accepted_checkpoint_ref']!=pin:
            fail('Predecessor must be an accepted closed same-ticket/phase checkpoint','INVALID_TRANSITION')
    if (ref(latest) if latest else None)!=pin:fail('Latest accepted phase predecessor changed','REVISION_CONFLICT')
    if latest:discussions.expect(latest,expected)


def selected(args,actor,items,expected):
    discussion=next((x for x in items if x['uuid']==args['discussion_uuid']),None)
    if not discussion or discussion['kind']!='discussion' or discussion['body']['state']!='open':fail('Selected open discussion required','INVALID_TRANSITION')
    if actor['uuid']!=discussion['body']['actor_uuid'] or actor['body']['parent_actor_uuid'] is not None:fail('Actual fronting discussion main required','FORBIDDEN')
    discussions.expect(discussion,expected)
    return discussion


def preparation(root,plan,tickets,checkpoint):
    originals=[x for t in tickets.values() for x in t['revisions'] if x['uuid']==checkpoint['uuid'] and x['body']['state']=='prepared']
    if not originals:fail('Original preparation unavailable','MISSING_EVIDENCE')
    original=originals[0]
    receipts=[x for x in current(plan) if x['kind']=='receipt' and ref(original) in x['body']['changed_refs']]
    if len(receipts)!=1:fail('Checkpoint preparation must have a committed receipt','MISSING_EVIDENCE')
    _,ts,_=read_generation(resolve_plan(root,plan['root_uuid']),receipts[0]['body']['new_generation'])
    return next(t for t in ts.values() if any(x['uuid']==checkpoint['uuid'] for x in current(t)))


def patch_manifest(base,items):
    before={x['uuid']:x for x in current(base)}
    return [dict(uuid=x['uuid'],body=x['body'],source_refs=x['source_refs'],extensions=x['extensions'],lifecycle=x['lifecycle'])
            for x in items if x['kind'] in PATCH_KINDS and before.get(x['uuid'])!=x]


def apply(root,op,args,actor,assignment,plan,tickets,ticket,items,expected):
    discussion=selected(args,actor,items,expected)
    if assignment['body']['ticket_uuid'] in tickets and assignment['body']['ticket_uuid']!=ticket['root_uuid']:fail('Checkpoint outside assigned ticket','FORBIDDEN')
    if op=='checkpoint.prepare':
        continuity(root,plan,tickets,items,discussion,args['previous_accepted_ref'],expected)
        high=args['high_water'];lower=discussion['body']['opened_seq']
        if high<lower or high>plan['commit_seq']:fail('High-water must be within committed selected discussion interval','INVALID_TRANSITION')
        journals=sorted((x for x in items if x['kind']=='journal_entry' and x['body']['discussion_uuid']==discussion['uuid'] and lower<=x['body']['commit_seq']<=high),key=lambda x:(x['body']['commit_seq'],x['body']['event_ordinal']))
        pins=[ref(x) for x in journals]
        for pin in args['input_refs']:
            authorization.dependency(root,plan,tickets,pin,expected)
            if pin not in pins:pins.append(pin)
        raw=raw_inputs(root,plan,tickets,pins,assignment)
        gaps=list(dict.fromkeys(g for x in journals for g in x['body']['gaps']))
        if any(g!=NATIVE_GAP for g in gaps):fail('Selected journal has unresolved declared source gaps','MISSING_EVIDENCE')
        body=dict(discussion_uuid=discussion['uuid'],lower_seq=lower,high_seq=high,prior_checkpoint_ref=args['previous_accepted_ref'],input_refs=pins,input_sha256=digest(raw),coverage_refs=[ref(x) for x in journals],gaps=gaps,
                  patched_refs=[],review_ref=None,state='prepared',next_action=args['next_action'])
        item=envelope('checkpoint',body,seed.writer(actor));items.append(item);return item
    candidates=[x for x in items if x['kind']=='checkpoint' and x['body']['discussion_uuid']==discussion['uuid'] and x['body']['state']!='closed']
    if not candidates:fail('Prepared checkpoint required','INVALID_TRANSITION')
    checkpoint=candidates[-1];discussions.expect(checkpoint,expected);body=checkpoint['body']
    continuity(root,plan,tickets,items,discussion,body['prior_checkpoint_ref'],expected)
    raw=raw_inputs(root,plan,tickets,body['input_refs'],assignment)
    if digest(raw)!=body['input_sha256']:fail('Frozen raw input digest differs','REVISION_CONFLICT')
    base=preparation(root,plan,tickets,checkpoint)
    patches=patch_manifest(base,items)
    if op=='checkpoint.apply':
        if body['state']!='prepared':fail('Apply requires a newly prepared checkpoint','INVALID_TRANSITION')
        if digest(dict(input_sha256=body['input_sha256'],patches=patches))!=args['patch_preview_digest']:fail('Inline reconciliation preview differs from exact prospective patch','REVISION_CONFLICT')
        changed={p['uuid'] for p in patches};body.update(state='reconciled',patched_refs=[ref(x) for x in items if x['uuid'] in changed])
        discussions.revise(checkpoint,actor);return checkpoint
    if body['state']!='reconciled':fail('Closure requires inline reconciliation first','INVALID_TRANSITION')
    if [ref(x) for x in items if x['uuid'] in {p['uuid'] for p in patches}]!=body['patched_refs']:fail('Reconciled patch changed before closure','REVISION_CONFLICT')
    for pin in body['patched_refs']:authorization.dependency(root,plan,tickets,pin,expected)
    required=[ref(checkpoint)]+body['patched_refs']
    if args['readback_refs']!=required:fail('Exact reconciled checkpoint and patches must be read back','MISSING_EVIDENCE')
    for pin in args['readback_refs']:authorization.dependency(root,plan,tickets,pin,expected)
    gate=authorization.dependency(root,plan,tickets,args['review_ref'],expected);b=gate['body']
    if gate['kind']!='review' or b['verdict']!='pass' or b['finding_refs'] or b['mode']!='checkpoint-raw-source' or b['subject_refs']!=required or b['subject_digest']!=digest(required):fail('Passing exact current checkpoint/raw-source review required','MISSING_EVIDENCE')
    reviewer=next((x for x in current(plan) if x['uuid']==b['reviewer_actor_uuid'] and x['kind']=='actor'),None)
    producers={actor['uuid']}|{x['writer']['actor_uuid'] for x in raw}|{x['writer']['actor_uuid'] for x in items if ref(x) in body['patched_refs']}
    if not reviewer or reviewer['body']['state']!='active' or reviewer['body']['role']!='checkpoint-reviewer' or reviewer['uuid'] in producers or gate['writer']!=seed.writer(reviewer) or reviewer['body']['parent_actor_uuid'] is not None:fail('Fresh independent bound raw-source reviewer required','FORBIDDEN')
    for prior in (x for x in items if x['kind']=='checkpoint' and x['body']['state']=='closed'):
        old_gate=exact(root,plan,tickets,prior['body']['review_ref'])
        if old_gate['body']['reviewer_actor_uuid']==reviewer['uuid']:fail('A fresh reviewer identity is required for this closure','FORBIDDEN')
    authorization.host_evidence(root,reviewer['body'])
    assignments=[evidence(root,p) for p in reviewer['body']['assignment_refs']]
    if len(assignments)!=1 or assignments[0]['uuid']!=b['assignment_uuid'] or assignments[0]['body']['work_kind']!='evaluation' or assignments[0]['body']['ticket_uuid']!=ticket['root_uuid'] or assignments[0]['body']['node_uuid']!=checkpoint['uuid']:fail('Exact checkpoint evaluation assignment required','FORBIDDEN')
    if b['evidence_refs']!=body['input_refs']:fail('Review must inspect every exact original raw input','MISSING_EVIDENCE')
    report=authorization.dependency(root,plan,tickets,b['report_ref'],expected)
    proof=report['body'].get('content')
    expected_proof=dict(checkpoint_ref=ref(checkpoint),input_sha256=body['input_sha256'],raw_input_refs=body['input_refs'],patched_refs=body['patched_refs'],readback_refs=required,reviewer_actor_uuid=reviewer['uuid'],source_review=True)
    if report['kind']!='content' or report['writer']!=seed.writer(reviewer) or proof!=expected_proof:fail('Raw-source review report/readback proof incomplete or stale','MISSING_EVIDENCE')
    body.update(state='closed',review_ref=args['review_ref'],next_action=args['next_action']);discussions.revise(checkpoint,actor)
    discussion['body'].update(state='closed',accepted_checkpoint_ref=ref(checkpoint));discussions.revise(discussion,actor)
    return checkpoint


def validate_final(root,plan,tickets,items,captured,expected):
    """Later nested edits cannot invalidate a newly closed exact readback."""
    for checkpoint in (x for x in items if x['kind']=='checkpoint' and x['body']['state']!='closed' and x not in captured):
        discussion=next(x for x in items if x['uuid']==checkpoint['body']['discussion_uuid'])
        continuity(root,plan,tickets,items,discussion,checkpoint['body']['prior_checkpoint_ref'],expected)
    for checkpoint in (x for x in items if x['kind']=='checkpoint' and x['body']['state']=='closed' and x not in captured):
        base=preparation(root,plan,tickets,checkpoint)
        patches=patch_manifest(base,items);ids={x['uuid'] for x in patches}
        if [ref(x) for x in items if x['uuid'] in ids]!=checkpoint['body']['patched_refs']:
            fail('Final transaction changed reviewed checkpoint patch','REVISION_CONFLICT')
