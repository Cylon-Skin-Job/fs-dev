"""Record inspected authorized Git facts and finalize the exact accepted ticket.

The helper executes no commit/pull/push. `integration.record` stores inspected,
supplied facts (never executing or fabricating an operation); `ticket.finalize`
requires the full chain of facts and finalizes once; the plan dependency release
re-evaluation is a projection owned by dependencies.py. Commit alone, push alone
or an integration without the verified required pull never finalizes.
"""
import copy
from .schema import fail, current
from .store import ref, envelope
from . import authorization, seed, dependencies

OPERATIONS={'integration.record','ticket.finalize','track.release_check'}

# Inspected operation-inspection receipts. Each *_ref argument names a saved
# content record whose JSON content carries the inspected Git fact. The stored
# integration body strings are copied from these inspected facts; where the
# operation args and the body differ (candidate_digest->subject_digest, and
# pull_source_ref absent from the args) the value is reconciled from inspected
# exact proof and the owner operation assignment, never guessed or schema-widened.
MAIN_KEYS={'git_ref','head_sha'}
CONSUMER_KEYS={'git_ref'}
MAIN_PROOF_KEYS={'commit_sha','main_ref','ancestor'}
PULL_PROOF_KEYS={'verified','pull_source_ref','head_sha'}


def _fact(root,plan,tickets,pin,expected,keys,label):
    item=authorization.dependency(root,plan,tickets,pin,expected)
    body=item['body'].get('content')
    if item['kind']!='content' or not isinstance(body,dict) or set(body)!=set(keys):
        fail('Inspected '+label+' operation receipt is missing or malformed','MISSING_EVIDENCE')
    return body


def _authority(root,plan,tickets,args,assignment,expected):
    if not args['authority_refs'] or assignment['body']['authority_ref'] not in args['authority_refs']:
        fail('Exact approved operation/candidate authorization required','MISSING_EVIDENCE')
    scope=None
    for pin in args['authority_refs']:
        item=authorization.dependency(root,plan,tickets,pin,expected)
        if item['kind']!='content' or item['body']['authority']!='owner_decision' or item['body']['state']!='active':
            fail('Authorization receipt must be an active owner decision','FORBIDDEN')
        content=item['body'].get('content')
        if isinstance(content,dict) and isinstance(content.get('authorized_scope'),dict):
            scope=content['authorized_scope']
    if not scope or not isinstance(scope.get('checkout'),str) or not isinstance(scope.get('branch'),str):
        fail('Applicable owner commit/publication authorization scope required','MISSING_EVIDENCE')
    authorization.authority(root,plan,tickets,assignment['body']['authority_ref'],assignment,expected)
    return scope


def record(root,args,actor,assignment,plan,tickets,items,expected):
    """Store one inspected integration fact with the exact closed body shape."""
    scope=_authority(root,plan,tickets,args,assignment,expected)
    if args['checkout']!=scope['checkout'] or args['branch']!=scope['branch'] or args['consumer_checkout']!=scope['checkout']:
        fail('Wrong checkout/branch/consumer checkout versus authorized operation scope','FORBIDDEN')
    main=_fact(root,plan,tickets,args['main_ref'],expected,MAIN_KEYS,'main ref')
    consumer=_fact(root,plan,tickets,args['consumer_ref'],expected,CONSUMER_KEYS,'consumer ref')
    proof=_fact(root,plan,tickets,args['main_verification_ref'],expected,MAIN_PROOF_KEYS,'main ancestry')
    pull=_fact(root,plan,tickets,args['pull_verification_ref'],expected,PULL_PROOF_KEYS,'required pull')
    if args['pull_head_sha']!=args['main_integration_sha'] or args['commit_sha']!=args['main_integration_sha']:
        fail('Authorized commit, main integration SHA and pulled head SHA must be identical','MISSING_EVIDENCE')
    if main['head_sha']!=args['main_integration_sha']:
        fail('Inspected main ref head differs from the supplied integration SHA','SOURCE_UNVERIFIED')
    if proof['ancestor'] is not True or proof['commit_sha']!=args['commit_sha'] or proof['main_ref']!=main['git_ref']:
        fail('Independently verified main ancestry of the authorized commit is required','MISSING_EVIDENCE')
    if pull['verified'] is not True or pull['head_sha']!=args['pull_head_sha'] or pull['pull_source_ref']!=main['git_ref']:
        fail('Verified required pull into the named consumer checkout/ref is required','MISSING_EVIDENCE')
    body=dict(
        authority_refs=copy.deepcopy(args['authority_refs']),
        subject_digest=args['candidate_digest'],
        checkout=args['checkout'],
        branch=args['branch'],
        commit_sha=args['commit_sha'],
        main_ref=main['git_ref'],
        main_integration_sha=args['main_integration_sha'],
        main_verification_ref=copy.deepcopy(args['main_verification_ref']),
        consumer_checkout=args['consumer_checkout'],
        consumer_ref=consumer['git_ref'],
        pull_head_sha=args['pull_head_sha'],
        pull_source_ref=pull['pull_source_ref'],
        pull_verification_ref=copy.deepcopy(args['pull_verification_ref']),
    )
    item=envelope('integration',body,seed.writer(actor))
    items.append(item)
    event=envelope('event',dict(event_kind='integration.record',subject_ref=ref(item),commit_seq=0,event_ordinal=0,
        caused_by_ref=ref(assignment),reply_to_ref=None,evidence_refs=sorted({args['main_verification_ref']['revision_uuid']:args['main_verification_ref'],args['pull_verification_ref']['revision_uuid']:args['pull_verification_ref']}.values(),key=lambda x:x['entry_uuid'])),seed.writer(actor))
    items.append(event)
    return item


def finalize(root,args,actor,assignment,plan,tickets,items,expected):
    """Finalize once when the full accepted/authorized/verified chain holds."""
    _authority(root,plan,tickets,args,assignment,expected)
    integration=authorization.dependency(root,plan,tickets,args['integration_ref'],expected)
    if integration['kind']!='integration' or integration not in items or integration['lifecycle']!='live':
        fail('Exact current integration fact in the selected ticket required','MISSING_EVIDENCE')
    if args['candidate_digest']!=integration['body']['subject_digest']:
        fail('Finalization candidate digest differs from the recorded integration subject','REVISION_CONFLICT')
    accepted=[x for x in items if x['kind']=='acceptance' and x['body']['state']=='active'
              and x['body']['subject_digest']==args['candidate_digest']]
    if not accepted:
        fail('Exact accepted candidate/scope is required before finalization','MISSING_EVIDENCE')
    target=next(x for x in items if x['kind']=='ticket')
    if target['body']['state']=='finalized' or target['body']['finalization_ref'] is not None:
        fail('Ticket is already finalized; finalization is once-only','INVALID_TRANSITION')
    if target['body']['state'] not in ('live','seed'):
        fail('Finalization requires a live or seed ticket','INVALID_TRANSITION')
    from .edits import changed
    body=copy.deepcopy(target['body']);body.update(state='finalized',finalization_ref=ref(integration))
    updated=changed(target,body,target['source_refs'],target['extensions'],actor)
    items[items.index(target)]=updated
    event=envelope('event',dict(event_kind='ticket.finalize',subject_ref=ref(integration),commit_seq=0,event_ordinal=0,
        caused_by_ref=ref(assignment),reply_to_ref=None,evidence_refs=[args['integration_ref']]+args['authority_refs']),seed.writer(actor))
    items.append(event)
    return updated


def release_check(root,args,actor,assignment,plan,tickets,items,expected):
    """Re-evaluate every plan dependency release condition; never dispatch."""
    integration=authorization.dependency(root,plan,tickets,args['integration_ref'],expected)
    if integration['kind']!='integration' or integration not in items or integration['lifecycle']!='live':
        fail('Exact current integration fact required for the release check','MISSING_EVIDENCE')
    event=envelope('event',dict(event_kind='track.release_check',subject_ref=ref(integration),commit_seq=0,event_ordinal=0,
        caused_by_ref=ref(assignment),reply_to_ref=None,evidence_refs=[args['integration_ref']]),seed.writer(actor))
    items.append(event)
    return event


def evaluation(root,plan,tickets,integration_ref):
    """The public release re-evaluation result for an exact integration fact."""
    items=[x for t in tickets.values() for x in current(t)]
    integration=next((x for x in items if x['uuid']==integration_ref['entry_uuid'] and x['revision_uuid']==integration_ref['revision_uuid']),None)
    evaluated=dependencies.release(root,plan,tickets)
    evaluated['eligible_successors']=dependencies.successors(root,plan,tickets,integration) if integration else []
    evaluated['integration_ref']=integration_ref
    return evaluated


def finalization_projection(root,plan,tickets):
    """Per-ticket timeline completion state for the generated views."""
    evaluated=dependencies.release(root,plan,tickets)
    rows={}
    for key,ticket in tickets.items():
        items=current(ticket)
        target=next(x for x in items if x['kind']=='ticket')
        integration=None
        if target['body']['finalization_ref']:
            integration=next((x for x in items if x['kind']=='integration'
                              and x['uuid']==target['body']['finalization_ref']['entry_uuid']),None)
        row=evaluated['tickets'][key]
        rows[key]=dict(
            state=row['state'],
            completed=row['state']=='completed',
            locked=row['state']=='locked',
            unlocked=row['state']=='unlocked',
            finalization_ref=target['body']['finalization_ref'],
            commit_sha=integration['body']['commit_sha'] if integration else None,
            consumer_ref=integration['body']['consumer_ref'] if integration else None,
            next_mode=None,
            conditions=row['conditions'],
            disclosure='Completed from underlying integration/finalization receipts; Final Commit is terminal with no next mode',
        )
    return rows
